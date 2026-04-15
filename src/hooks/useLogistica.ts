import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Types
export type HojaRutaEstado = 'planificada' | 'en_carga' | 'en_ruta' | 'completada' | 'cancelada';
export type ParadaEstado = 'pendiente' | 'en_camino' | 'entregado' | 'entrega_parcial' | 'rechazado' | 'no_entregado';
export type DevolucionMotivo = 'rechazo_cliente' | 'producto_vencido' | 'producto_roto' | 'producto_faltante' | 'cambio' | 'error_pedido' | 'otro';

export interface Vehiculo {
  id: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  capacidad_kg: number | null;
  capacidad_bultos: number | null;
  activo: boolean;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface HojaRuta {
  id: string;
  numero_hoja: number;
  fecha: string;
  vehiculo_id: string | null;
  chofer_id: string | null;
  responsable_id: string | null;
  estado: HojaRutaEstado;
  hora_salida_estimada: string | null;
  hora_salida_real: string | null;
  hora_regreso: string | null;
  km_inicial: number | null;
  km_final: number | null;
  observaciones: string | null;
  usuario_id: string;
  created_at: string;
  updated_at: string;
  vehiculo?: Vehiculo;
  chofer?: { id: string; nombre: string };
  responsable?: { id: string; nombre: string };
  paradas?: HojaRutaParada[];
}

export interface HojaRutaParada {
  id: string;
  hoja_ruta_id: string;
  pedido_id: string;
  orden: number;
  estado: ParadaEstado;
  hora_llegada: string | null;
  hora_salida: string | null;
  ventana_horaria_desde: string | null;
  ventana_horaria_hasta: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  pedido?: {
    id: string;
    numero_pedido: number;
    cliente: { id: string; nombre: string; direccion: string | null; telefono: string | null };
    total: number;
    detalles?: Array<{
      id: string;
      producto_id: string | null;
      cantidad_pedida: number;
      cantidad_entregada: number | null;
      producto?: { descripcion: string; codigo_articulo: string };
    }>;
  };
}

export interface HojaRutaDevolucion {
  id: string;
  hoja_ruta_id: string;
  parada_id: string;
  pedido_detalle_id: string;
  cantidad: number;
  motivo: DevolucionMotivo;
  detalle_motivo: string | null;
  reingresado_stock: boolean;
  usuario_id: string;
  created_at: string;
}

// ============== VEHICULOS ==============
export function useVehiculos() {
  return useQuery({
    queryKey: ['vehiculos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehiculos')
        .select('*')
        .eq('activo', true)
        .order('patente');
      if (error) throw error;
      return data as Vehiculo[];
    },
  });
}

export function useCrearVehiculo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<Vehiculo, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: vehiculo, error } = await supabase
        .from('vehiculos')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return vehiculo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehiculos'] });
      toast({ title: 'Vehículo creado exitosamente' });
    },
    onError: (error) => {
      toast({ title: 'Error al crear vehículo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useActualizarVehiculo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Vehiculo> & { id: string }) => {
      const { error } = await supabase
        .from('vehiculos')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehiculos'] });
      toast({ title: 'Vehículo actualizado' });
    },
    onError: (error) => {
      toast({ title: 'Error al actualizar vehículo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useEliminarVehiculo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehiculos')
        .update({ activo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehiculos'] });
      toast({ title: 'Vehículo desactivado' });
    },
    onError: (error) => {
      toast({ title: 'Error al desactivar vehículo', description: error.message, variant: 'destructive' });
    },
  });
}

// ============== HOJAS DE RUTA ==============
export function useHojasRuta(filtros?: { estado?: HojaRutaEstado; fecha?: string }) {
  return useQuery({
    queryKey: ['hojas-ruta', filtros],
    queryFn: async () => {
      let query = supabase
        .from('hojas_ruta')
        .select(`
          *,
          vehiculo:vehiculos(id, patente, marca, modelo),
          chofer:empleados!hojas_ruta_chofer_id_fkey(id, nombre),
          responsable:empleados!hojas_ruta_responsable_id_fkey(id, nombre)
        `)
        .order('fecha', { ascending: false })
        .order('numero_hoja', { ascending: false });

      if (filtros?.estado) {
        query = query.eq('estado', filtros.estado);
      }
      if (filtros?.fecha) {
        query = query.eq('fecha', filtros.fecha);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as HojaRuta[];
    },
  });
}

export function useHojaRuta(id: string | undefined) {
  return useQuery({
    queryKey: ['hoja-ruta', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: hojaRuta, error: hojaError } = await supabase
        .from('hojas_ruta')
        .select(`
          *,
          vehiculo:vehiculos(id, patente, marca, modelo),
          chofer:empleados!hojas_ruta_chofer_id_fkey(id, nombre),
          responsable:empleados!hojas_ruta_responsable_id_fkey(id, nombre)
        `)
        .eq('id', id)
        .single();

      if (hojaError) throw hojaError;

      // Get paradas with pedido details
      const { data: paradas, error: paradasError } = await supabase
        .from('hoja_ruta_paradas')
        .select(`
          *,
          pedido:pedidos(
            id, numero_pedido, total, fecha_pedido,
            cliente:clientes(id, nombre, codigo_cliente, direccion, telefono, zona:zonas(nombre)),
            vendedor:vendedores(id, nombre),
            detalles:pedido_detalles(
              id, producto_id, cantidad_pedida, cantidad_entregada,
              producto:productos(descripcion, codigo_articulo)
            )
          )
        `)
        .eq('hoja_ruta_id', id)
        .order('orden');

      if (paradasError) throw paradasError;

      return { ...hojaRuta, paradas } as unknown as HojaRuta;
    },
    enabled: !!id,
  });
}

export function useCrearHojaRuta() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      fecha: string;
      vehiculo_id?: string;
      chofer_id?: string;
      responsable_id?: string;
      hora_salida_estimada?: string;
      observaciones?: string;
      pedido_ids?: string[];
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      const { data: hojaRuta, error: hojaError } = await supabase
        .from('hojas_ruta')
        .insert({
          fecha: data.fecha,
          vehiculo_id: data.vehiculo_id || null,
          chofer_id: data.chofer_id || null,
          responsable_id: data.responsable_id || null,
          hora_salida_estimada: data.hora_salida_estimada || null,
          observaciones: data.observaciones || null,
          usuario_id: user.id,
          estado: 'planificada'
        })
        .select()
        .single();

      if (hojaError) throw hojaError;

      // Add pedidos as paradas and change their status to 'despachado'
      if (data.pedido_ids && data.pedido_ids.length > 0) {
        const paradasInsert = data.pedido_ids.map((pedido_id, index) => ({
          hoja_ruta_id: hojaRuta.id,
          pedido_id,
          orden: index + 1,
          estado: 'pendiente' as ParadaEstado
        }));

        const { error: paradasError } = await supabase
          .from('hoja_ruta_paradas')
          .insert(paradasInsert);

        if (paradasError) throw paradasError;

        // Cambiar estado de pedidos a 'despachado' automáticamente
        const { error: updateError } = await supabase
          .from('pedidos')
          .update({ estado: 'despachado' })
          .in('id', data.pedido_ids);

        if (updateError) throw updateError;

        // Registrar en historial de cada pedido
        const historialInsert = data.pedido_ids.map(pedido_id => ({
          pedido_id,
          estado_anterior: 'preparado' as const,
          estado_nuevo: 'despachado' as const,
          usuario_id: user.id,
          observaciones: `Asignado a hoja de ruta #${hojaRuta.numero_hoja}`
        }));

        await supabase.from('pedido_historial').insert(historialInsert);
      }

      return hojaRuta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hojas-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-disponibles-ruta'] });
      toast({ title: 'Hoja de ruta creada exitosamente' });
    },
    onError: (error) => {
      toast({ title: 'Error al crear hoja de ruta', description: error.message, variant: 'destructive' });
    },
  });
}

export function useActualizarHojaRuta() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<HojaRuta> & { id: string }) => {
      const { error } = await supabase
        .from('hojas_ruta')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hojas-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta'] });
      toast({ title: 'Hoja de ruta actualizada' });
    },
    onError: (error) => {
      toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCambiarEstadoHojaRuta() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: HojaRutaEstado }) => {
      const updateData: Record<string, unknown> = { estado };
      
      if (estado === 'en_ruta') {
        updateData.hora_salida_real = new Date().toISOString();
      } else if (estado === 'completada') {
        updateData.hora_regreso = new Date().toISOString();
      }

      const { error } = await supabase
        .from('hojas_ruta')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hojas-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta'] });
      toast({ title: 'Estado actualizado' });
    },
    onError: (error) => {
      toast({ title: 'Error al cambiar estado', description: error.message, variant: 'destructive' });
    },
  });
}

// ============== PARADAS ==============
export function useAgregarParada() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      hoja_ruta_id: string;
      pedido_id: string;
      orden?: number;
      ventana_horaria_desde?: string;
      ventana_horaria_hasta?: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      // Get max orden
      const { data: maxOrden } = await supabase
        .from('hoja_ruta_paradas')
        .select('orden')
        .eq('hoja_ruta_id', data.hoja_ruta_id)
        .order('orden', { ascending: false })
        .limit(1)
        .single();

      // Get hoja de ruta number
      const { data: hojaRuta } = await supabase
        .from('hojas_ruta')
        .select('numero_hoja')
        .eq('id', data.hoja_ruta_id)
        .single();

      const { error } = await supabase
        .from('hoja_ruta_paradas')
        .insert({
          hoja_ruta_id: data.hoja_ruta_id,
          pedido_id: data.pedido_id,
          orden: data.orden ?? ((maxOrden?.orden ?? 0) + 1),
          ventana_horaria_desde: data.ventana_horaria_desde || null,
          ventana_horaria_hasta: data.ventana_horaria_hasta || null,
          estado: 'pendiente'
        });

      if (error) throw error;

      // Cambiar estado del pedido a 'despachado' automáticamente
      await supabase
        .from('pedidos')
        .update({ estado: 'despachado' })
        .eq('id', data.pedido_id);

      // Registrar en historial del pedido
      await supabase.from('pedido_historial').insert({
        pedido_id: data.pedido_id,
        estado_anterior: 'preparado' as const,
        estado_nuevo: 'despachado' as const,
        usuario_id: user.id,
        observaciones: `Asignado a hoja de ruta #${hojaRuta?.numero_hoja || 'N/A'}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-disponibles-ruta'] });
      toast({ title: 'Parada agregada' });
    },
    onError: (error) => {
      toast({ title: 'Error al agregar parada', description: error.message, variant: 'destructive' });
    },
  });
}

export function useActualizarOrdenParadas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paradas: { id: string; orden: number }[]) => {
      for (const parada of paradas) {
        const { error } = await supabase
          .from('hoja_ruta_paradas')
          .update({ orden: parada.orden })
          .eq('id', parada.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta'] });
    },
  });
}

export function useActualizarEstadoParada() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, estado, observaciones }: { 
      id: string; 
      estado: ParadaEstado;
      observaciones?: string;
    }) => {
      const updateData: Record<string, unknown> = { estado };
      
      if (estado === 'en_camino') {
        updateData.hora_llegada = null;
      } else if (['entregado', 'entrega_parcial', 'rechazado', 'no_entregado'].includes(estado)) {
        updateData.hora_salida = new Date().toISOString();
        if (!updateData.hora_llegada) {
          updateData.hora_llegada = new Date().toISOString();
        }
      }
      
      if (observaciones !== undefined) {
        updateData.observaciones = observaciones;
      }

      // Actualizar la parada
      const { error } = await supabase
        .from('hoja_ruta_paradas')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;

      // Obtener la hoja de ruta asociada para verificar si todas las paradas están completas
      const { data: parada } = await supabase
        .from('hoja_ruta_paradas')
        .select('hoja_ruta_id')
        .eq('id', id)
        .single();

      if (parada?.hoja_ruta_id) {
        // Verificar si todas las paradas tienen estado final
        const estadosFinales = ['entregado', 'entrega_parcial', 'rechazado', 'no_entregado'];
        
        const { data: todasParadas } = await supabase
          .from('hoja_ruta_paradas')
          .select('estado')
          .eq('hoja_ruta_id', parada.hoja_ruta_id);

        if (todasParadas && todasParadas.length > 0) {
          const todasCompletas = todasParadas.every(p => estadosFinales.includes(p.estado));
          
          if (todasCompletas) {
            // Verificar que la hoja esté en estado 'en_ruta' antes de completarla
            const { data: hojaRuta } = await supabase
              .from('hojas_ruta')
              .select('estado')
              .eq('id', parada.hoja_ruta_id)
              .single();

            if (hojaRuta?.estado === 'en_ruta') {
              // Completar automáticamente la hoja de ruta
              await supabase
                .from('hojas_ruta')
                .update({ 
                  estado: 'completada',
                  hora_regreso: new Date().toISOString()
                })
                .eq('id', parada.hoja_ruta_id);
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['hojas-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({ title: 'Estado de parada actualizado' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useEliminarParada() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('hoja_ruta_paradas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta'] });
      toast({ title: 'Parada eliminada' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// ============== DEVOLUCIONES ==============
export function useRegistrarDevolucion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      hoja_ruta_id: string;
      parada_id: string;
      pedido_detalle_id: string;
      cantidad: number;
      motivo: DevolucionMotivo;
      detalle_motivo?: string;
      reingresarStock?: boolean;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      const { error: devError } = await supabase
        .from('hoja_ruta_devoluciones')
        .insert({
          hoja_ruta_id: data.hoja_ruta_id,
          parada_id: data.parada_id,
          pedido_detalle_id: data.pedido_detalle_id,
          cantidad: data.cantidad,
          motivo: data.motivo,
          detalle_motivo: data.detalle_motivo || null,
          reingresado_stock: data.reingresarStock ?? false,
          usuario_id: user.id
        });

      if (devError) throw devError;

      // Reingress stock if needed
      if (data.reingresarStock) {
        const { data: detalle } = await supabase
          .from('pedido_detalles')
          .select('producto_id')
          .eq('id', data.pedido_detalle_id)
          .single();

        if (detalle?.producto_id) {
          const { data: producto } = await supabase
            .from('productos')
            .select('stock_actual')
            .eq('id', detalle.producto_id)
            .single();

          if (producto) {
            await supabase
              .from('productos')
              .update({ stock_actual: (producto.stock_actual || 0) + data.cantidad })
              .eq('id', detalle.producto_id);

            await supabase.from('movimientos_inventario').insert({
              producto_id: detalle.producto_id,
              tipo: 'entrada',
              cantidad: data.cantidad,
              stock_anterior: producto.stock_actual || 0,
              stock_nuevo: (producto.stock_actual || 0) + data.cantidad,
              motivo: `Devolución en ruta: ${data.motivo}`,
              usuario_id: user.id
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast({ title: 'Devolución registrada' });
    },
    onError: (error) => {
      toast({ title: 'Error al registrar devolución', description: error.message, variant: 'destructive' });
    },
  });
}

// ============== HOJA DE CARGA ==============
export function useHojaCarga(hojaRutaId: string | undefined) {
  return useQuery({
    queryKey: ['hoja-carga', hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return null;

      const { data: paradas, error } = await supabase
        .from('hoja_ruta_paradas')
        .select(`
          pedido:pedidos(
            detalles:pedido_detalles(
              cantidad_pedida,
              producto:productos(id, codigo_articulo, descripcion)
            )
          )
        `)
        .eq('hoja_ruta_id', hojaRutaId);

      if (error) throw error;

      // Consolidate products
      const productosMap = new Map<string, {
        id: string;
        codigo: string;
        descripcion: string;
        cantidad_total: number;
      }>();

      paradas?.forEach((parada: unknown) => {
        const p = parada as { pedido?: { detalles?: Array<{ cantidad_pedida: number; producto?: { id: string; codigo_articulo: string; descripcion: string } }> } };
        p.pedido?.detalles?.forEach((detalle) => {
          if (detalle.producto) {
            const existing = productosMap.get(detalle.producto.id);
            if (existing) {
              existing.cantidad_total += detalle.cantidad_pedida;
            } else {
              productosMap.set(detalle.producto.id, {
                id: detalle.producto.id,
                codigo: detalle.producto.codigo_articulo,
                descripcion: detalle.producto.descripcion,
                cantidad_total: detalle.cantidad_pedida
              });
            }
          }
        });
      });

      return Array.from(productosMap.values()).sort((a, b) => 
        a.codigo.localeCompare(b.codigo)
      );
    },
    enabled: !!hojaRutaId,
  });
}

// ============== PEDIDOS DISPONIBLES PARA RUTA ==============
export function usePedidosDisponiblesParaRuta() {
  return useQuery({
    queryKey: ['pedidos-disponibles-ruta'],
    queryFn: async () => {
      // Get pedidos that are already assigned to a route
      const { data: pedidosAsignados } = await supabase
        .from('hoja_ruta_paradas')
        .select('pedido_id');

      const pedidosAsignadosIds = pedidosAsignados?.map(p => p.pedido_id) || [];

      // Solo mostrar pedidos en estado 'preparado' que no estén asignados
      let query = supabase
        .from('pedidos')
        .select(`
          id, numero_pedido, fecha_pedido, total, estado,
          cliente:clientes(id, nombre, direccion, telefono, zona_id, vendedor_id),
          vendedor_id
        `)
        .eq('estado', 'preparado');  // Solo pedidos preparados

      if (pedidosAsignadosIds.length > 0) {
        query = query.not('id', 'in', `(${pedidosAsignadosIds.join(',')})`);
      }

      const { data, error } = await query.order('fecha_pedido');
      if (error) throw error;
      return data;
    },
  });
}

// ============== COBROS EN HOJA DE RUTA ==============
export function useCobrosParada(paradaId: string | undefined) {
  return useQuery({
    queryKey: ['cobros-parada', paradaId],
    queryFn: async () => {
      if (!paradaId) return [];
      
      const { data, error } = await supabase
        .from('hoja_ruta_cobros')
        .select(`
          id,
          monto,
          referencia,
          observaciones,
          created_at,
          forma_pago:formas_pago(id, nombre)
        `)
        .eq('parada_id', paradaId)
        .order('created_at');

      if (error) throw error;
      return data;
    },
    enabled: !!paradaId,
  });
}

export function useCobrosHojaRuta(hojaRutaId: string | undefined) {
  return useQuery({
    queryKey: ['cobros-hoja-ruta', hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return [];
      
      // Consultar la tabla nueva hoja_ruta_cobros
      const { data: cobrosNuevos, error: errorNuevos } = await supabase
        .from('hoja_ruta_cobros')
        .select(`
          id,
          monto,
          referencia,
          observaciones,
          created_at,
          forma_pago:formas_pago(id, nombre),
          pedido:pedidos(numero_pedido),
          parada:hoja_ruta_paradas(id)
        `)
        .eq('hoja_ruta_id', hojaRutaId)
        .order('created_at');

      if (errorNuevos) throw errorNuevos;

      // También consultar la tabla legacy cobros (vinculada via paradas)
      const { data: paradas } = await supabase
        .from('hoja_ruta_paradas')
        .select('id')
        .eq('hoja_ruta_id', hojaRutaId);
      
      const paradasIds = paradas?.map(p => p.id) || [];
      
      let cobrosLegacy: Array<{
        id: string;
        monto: number;
        referencia: string | null;
        observaciones: string | null;
        created_at: string;
        forma_pago: { id: string; nombre: string } | null;
        pedido: { numero_pedido: number } | null;
        parada: { id: string } | null;
        medio_pago: string;
      }> = [];

      if (paradasIds.length > 0) {
        const { data: cobrosViejos } = await supabase
          .from('cobros')
          .select(`
            id,
            monto,
            referencia,
            observaciones,
            created_at,
            medio_pago,
            hoja_ruta_parada_id
          `)
          .in('hoja_ruta_parada_id', paradasIds)
          .order('created_at');

        if (cobrosViejos) {
          cobrosLegacy = cobrosViejos.map(c => ({
            id: c.id,
            monto: c.monto,
            referencia: c.referencia,
            observaciones: c.observaciones,
            created_at: c.created_at,
            forma_pago: { id: 'legacy', nombre: c.medio_pago },
            pedido: null,
            parada: { id: c.hoja_ruta_parada_id },
            medio_pago: c.medio_pago,
          }));
        }
      }

      // Combinar y ordenar por fecha
      const todosCobros = [...(cobrosNuevos || []), ...cobrosLegacy].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return todosCobros;
    },
    enabled: !!hojaRutaId,
  });
}

export function useRendicionHojaRuta(hojaRutaId: string | undefined) {
  return useQuery({
    queryKey: ['rendicion-hoja-ruta', hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return null;
      
      const { data, error } = await supabase
        .from('hoja_ruta_rendiciones')
        .select('*')
        .eq('hoja_ruta_id', hojaRutaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!hojaRutaId,
  });
}

// ============== DEVOLUCIONES QUERY ==============
export function useDevolucionesParada(paradaId: string | undefined) {
  return useQuery({
    queryKey: ['devoluciones-parada', paradaId],
    queryFn: async () => {
      if (!paradaId) return [];
      
      const { data, error } = await supabase
        .from('hoja_ruta_devoluciones')
        .select(`
          id,
          cantidad,
          motivo,
          detalle_motivo,
          reingresado_stock,
          created_at,
          pedido_detalle:pedido_detalles(
            id,
            producto:productos(codigo_articulo, descripcion)
          )
        `)
        .eq('parada_id', paradaId)
        .order('created_at');

      if (error) throw error;
      return data;
    },
    enabled: !!paradaId,
  });
}

export function useDevolucionesHojaRuta(hojaRutaId: string | undefined) {
  return useQuery({
    queryKey: ['devoluciones-hoja-ruta', hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return [];
      
      // Consultar la tabla nueva hoja_ruta_devoluciones
      const { data: devolucionesNuevas, error: errorNuevas } = await supabase
        .from('hoja_ruta_devoluciones')
        .select(`
          id,
          cantidad,
          motivo,
          detalle_motivo,
          reingresado_stock,
          created_at,
          parada:hoja_ruta_paradas(
            id,
            pedido:pedidos(numero_pedido, cliente:clientes(nombre))
          ),
          pedido_detalle:pedido_detalles(
            id,
            producto:productos(codigo_articulo, descripcion)
          )
        `)
        .eq('hoja_ruta_id', hojaRutaId)
        .order('created_at');

      if (errorNuevas) throw errorNuevas;

      // También consultar la tabla legacy devoluciones (vinculada via paradas)
      const { data: paradas } = await supabase
        .from('hoja_ruta_paradas')
        .select('id')
        .eq('hoja_ruta_id', hojaRutaId);
      
      const paradasIds = paradas?.map(p => p.id) || [];
      
      let devolucionesLegacy: Array<{
        id: string;
        cantidad: number;
        motivo: string;
        detalle_motivo: string | null;
        reingresado_stock: boolean | null;
        created_at: string;
        parada: { id: string } | null;
        pedido_detalle: { id: string; producto: { codigo_articulo: string; descripcion: string } | null } | null;
      }> = [];

      if (paradasIds.length > 0) {
        const { data: devolucionesViejas } = await supabase
          .from('devoluciones')
          .select(`
            id,
            cantidad,
            motivo,
            detalle_motivo,
            created_at,
            hoja_ruta_parada_id,
            producto_id
          `)
          .in('hoja_ruta_parada_id', paradasIds)
          .order('created_at');

        if (devolucionesViejas && devolucionesViejas.length > 0) {
          // Obtener los productos asociados en una consulta separada
          const productoIds = devolucionesViejas
            .map(d => d.producto_id)
            .filter((id): id is string => id !== null);
          
          let productosMap: Record<string, { codigo_articulo: string; descripcion: string }> = {};
          
          if (productoIds.length > 0) {
            const { data: productos } = await supabase
              .from('productos')
              .select('id, codigo_articulo, descripcion')
              .in('id', productoIds);
            
            if (productos) {
              productosMap = productos.reduce((acc, p) => {
                acc[p.id] = { codigo_articulo: p.codigo_articulo, descripcion: p.descripcion };
                return acc;
              }, {} as Record<string, { codigo_articulo: string; descripcion: string }>);
            }
          }

          devolucionesLegacy = devolucionesViejas.map((d: any) => ({
            id: d.id,
            cantidad: d.cantidad,
            motivo: d.motivo,
            detalle_motivo: d.detalle_motivo,
            reingresado_stock: null,
            created_at: d.created_at,
            parada: { id: d.hoja_ruta_parada_id },
            pedido_detalle: d.producto_id && productosMap[d.producto_id] ? { 
              id: d.producto_id, 
              producto: productosMap[d.producto_id] 
            } : null,
          }));
        }
      }

      // Combinar y ordenar por fecha
      const todasDevoluciones = [...(devolucionesNuevas || []), ...devolucionesLegacy].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return todasDevoluciones;
    },
    enabled: !!hojaRutaId,
  });
}
