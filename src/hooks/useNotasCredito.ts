import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type NCEstado = 'pendiente' | 'aprobada' | 'descartada';
export type NCOrigen = 'rechazo_logistica' | 'devolucion_manual' | 'rechazo_pedido';

export interface NotaCreditoPendiente {
  id: string;
  cliente_id: string;
  producto_id: string | null;
  pedido_id: string | null;
  pedido_detalle_id: string | null;
  hoja_ruta_id: string | null;
  parada_id: string | null;
  origen: NCOrigen;
  cantidad: number;
  precio_unitario: number;
  importe_total: number;
  motivo: string;
  detalle_motivo: string | null;
  estado: NCEstado;
  reingresar_stock: boolean;
  generar_nc: boolean;
  cliente_movimiento_id: string | null;
  observaciones_admin: string | null;
  usuario_creador_id: string;
  usuario_aprobador_id: string | null;
  fecha_aprobacion: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { id: string; nombre: string; codigo_cliente: string | null };
  producto?: { id: string; descripcion: string; codigo_articulo: string };
  pedido?: { id: string; numero_pedido: number };
}

// Listar NCs (con filtros opcionales)
export function useNotasCreditoPendientes(filtros?: {
  cliente_id?: string;
  estado?: NCEstado;
  origen?: NCOrigen;
}) {
  return useQuery({
    queryKey: ['notas-credito-pendientes', filtros],
    queryFn: async () => {
      let q = supabase
        .from('notas_credito_pendientes')
        .select(`
          *,
          cliente:clientes(id, nombre, codigo_cliente),
          producto:productos(id, descripcion, codigo_articulo),
          pedido:pedidos(id, numero_pedido)
        `)
        .order('created_at', { ascending: false });

      if (filtros?.cliente_id) q = q.eq('cliente_id', filtros.cliente_id);
      if (filtros?.estado) q = q.eq('estado', filtros.estado);
      if (filtros?.origen) q = q.eq('origen', filtros.origen);

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as NotaCreditoPendiente[];
    },
  });
}

// Aprobar NC: crea el movimiento NCR + (opcional) reingresa stock
export function useAprobarNC() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      ncId,
      reingresarStock,
      generarNC,
      observaciones,
    }: {
      ncId: string;
      reingresarStock: boolean;
      generarNC: boolean;
      observaciones?: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      // 1. Obtener la NC pendiente
      const { data: nc, error: ncErr } = await supabase
        .from('notas_credito_pendientes')
        .select('*, pedido:pedidos(numero_pedido)')
        .eq('id', ncId)
        .single();

      if (ncErr) throw ncErr;
      if (nc.estado !== 'pendiente') throw new Error('Esta NC ya fue procesada');

      let movimientoId: string | null = null;

      // 2. Generar movimiento NCR en cuenta corriente (si corresponde)
      if (generarNC && Number(nc.importe_total) > 0) {
        const concepto = nc.origen === 'devolucion_manual'
          ? `NC por devolución manual - ${nc.motivo}`
          : `NC por rechazo${(nc.pedido as any)?.numero_pedido ? ` - Pedido #${(nc.pedido as any).numero_pedido}` : ''} - ${nc.motivo}`;

        const { data: mov, error: movErr } = await supabase
          .from('cliente_movimientos')
          .insert({
            cliente_id: nc.cliente_id,
            tipo: 'nota_credito',
            monto: Number(nc.importe_total),
            concepto,
            usuario_registro_id: user.id,
          })
          .select('id')
          .single();

        if (movErr) throw movErr;
        movimientoId = mov.id;
      }

      // 3. Reingresar stock si corresponde
      if (reingresarStock && nc.producto_id) {
        const { data: producto } = await supabase
          .from('productos')
          .select('stock_actual')
          .eq('id', nc.producto_id)
          .single();

        if (producto) {
          const stockAnterior = producto.stock_actual || 0;
          const stockNuevo = stockAnterior + Number(nc.cantidad);

          await supabase
            .from('productos')
            .update({ stock_actual: stockNuevo })
            .eq('id', nc.producto_id);

          await supabase.from('movimientos_inventario').insert({
            producto_id: nc.producto_id,
            tipo: 'entrada',
            cantidad: Number(nc.cantidad),
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
            motivo: `NC aprobada: ${nc.motivo}`,
            usuario_id: user.id,
          });
        }

        // Marcar el rechazo de logística como reingresado
        if (nc.origen === 'rechazo_logistica' && nc.parada_id && nc.pedido_detalle_id) {
          await supabase
            .from('hoja_ruta_devoluciones')
            .update({ reingresado_stock: true })
            .eq('parada_id', nc.parada_id)
            .eq('pedido_detalle_id', nc.pedido_detalle_id);
        }
      }

      // 4. Marcar NC como aprobada
      const { error: updErr } = await supabase
        .from('notas_credito_pendientes')
        .update({
          estado: 'aprobada',
          reingresar_stock: reingresarStock,
          generar_nc: generarNC,
          cliente_movimiento_id: movimientoId,
          usuario_aprobador_id: user.id,
          fecha_aprobacion: new Date().toISOString(),
          observaciones_admin: observaciones || null,
        })
        .eq('id', ncId);

      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-credito-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente_movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast({ title: 'NC aprobada correctamente' });
    },
    onError: (e: any) => {
      toast({ title: 'Error al aprobar NC', description: e.message, variant: 'destructive' });
    },
  });
}

// Descartar NC
export function useDescartarNC() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ ncId, observaciones }: { ncId: string; observaciones?: string }) => {
      if (!user) throw new Error('Usuario no autenticado');
      const { error } = await supabase
        .from('notas_credito_pendientes')
        .update({
          estado: 'descartada',
          usuario_aprobador_id: user.id,
          fecha_aprobacion: new Date().toISOString(),
          observaciones_admin: observaciones || null,
        })
        .eq('id', ncId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-credito-pendientes'] });
      toast({ title: 'NC descartada' });
    },
    onError: (e: any) => {
      toast({ title: 'Error al descartar', description: e.message, variant: 'destructive' });
    },
  });
}

// ============== DEVOLUCIONES MANUALES ==============

export interface DevolucionManual {
  id: string;
  cliente_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  importe_total: number;
  motivo: string;
  detalle_motivo: string | null;
  generar_nc: boolean;
  reingresar_stock: boolean;
  nc_pendiente_id: string | null;
  fecha: string;
  observaciones: string | null;
  usuario_id: string;
  created_at: string;
  cliente?: { id: string; nombre: string; codigo_cliente: string | null };
  producto?: { id: string; descripcion: string; codigo_articulo: string };
}

export function useDevolucionesManuales() {
  return useQuery({
    queryKey: ['devoluciones-manuales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devoluciones_manuales')
        .select(`
          *,
          cliente:clientes(id, nombre, codigo_cliente),
          producto:productos(id, descripcion, codigo_articulo)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as DevolucionManual[];
    },
  });
}

export function useCrearDevolucionManual() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      cliente_id: string;
      producto_id: string;
      cantidad: number;
      precio_unitario: number;
      motivo: string;
      detalle_motivo?: string;
      generar_nc: boolean;
      reingresar_stock: boolean;
      observaciones?: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      const importeTotal = data.cantidad * data.precio_unitario;

      // 1. Crear devolución manual
      const { data: dev, error: devErr } = await supabase
        .from('devoluciones_manuales')
        .insert({
          cliente_id: data.cliente_id,
          producto_id: data.producto_id,
          cantidad: data.cantidad,
          precio_unitario: data.precio_unitario,
          importe_total: importeTotal,
          motivo: data.motivo,
          detalle_motivo: data.detalle_motivo || null,
          generar_nc: data.generar_nc,
          reingresar_stock: data.reingresar_stock,
          observaciones: data.observaciones || null,
          usuario_id: user.id,
        })
        .select('id')
        .single();

      if (devErr) throw devErr;

      // 2. Si se debe generar NC, crear NC pendiente
      if (data.generar_nc) {
        const { data: nc, error: ncErr } = await supabase
          .from('notas_credito_pendientes')
          .insert({
            cliente_id: data.cliente_id,
            producto_id: data.producto_id,
            origen: 'devolucion_manual',
            cantidad: data.cantidad,
            precio_unitario: data.precio_unitario,
            importe_total: importeTotal,
            motivo: data.motivo,
            detalle_motivo: data.detalle_motivo || null,
            reingresar_stock: data.reingresar_stock,
            generar_nc: true,
            usuario_creador_id: user.id,
          })
          .select('id')
          .single();

        if (ncErr) throw ncErr;

        await supabase
          .from('devoluciones_manuales')
          .update({ nc_pendiente_id: nc.id })
          .eq('id', dev.id);
      }

      return dev;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devoluciones-manuales'] });
      queryClient.invalidateQueries({ queryKey: ['notas-credito-pendientes'] });
      toast({ title: 'Devolución registrada' });
    },
    onError: (e: any) => {
      toast({ title: 'Error al registrar devolución', description: e.message, variant: 'destructive' });
    },
  });
}
