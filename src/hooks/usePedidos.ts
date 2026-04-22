import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type PedidoEstadoDb = Database['public']['Enums']['pedido_estado'];

// Estados del sistema de pedidos
export type PedidoEstado = PedidoEstadoDb;

export type TipoPedido = 'web' | 'reparto';

export interface Pedido {
  id: string;
  numero_pedido: number;
  cliente_id: string;
  vendedor_id: string | null;
  usuario_id: string;
  lista_precio_id: string | null;
  estado: PedidoEstado;
  tipo_pedido: TipoPedido;
  fecha_pedido: string;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  observaciones: string | null;
  rendido: boolean;
  fecha_rendicion: string | null;
  rendido_por: string | null;
  venta_id: string | null;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: string;
    nombre: string;
    codigo_cliente: string | null;
    dni_cuit: string | null;
    direccion: string | null;
    telefono: string | null;
    zona?: { id: string; nombre: string } | null;
  };
  vendedor?: {
    id: string;
    nombre: string;
    codigo: string;
  };
  detalles?: PedidoDetalle[];
}

export interface PedidoDetalle {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  cantidad_pedida: number;
  cantidad_entregada: number;
  cantidad_devuelta: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  subtotal: number;
  observaciones: string | null;
  producto?: {
    id: string;
    descripcion: string;
    codigo_articulo: string;
    stock_actual: number | null;
    unidad_medida: string | null;
  };
}

export interface PedidoHistorial {
  id: string;
  pedido_id: string;
  estado_anterior: PedidoEstado | null;
  estado_nuevo: PedidoEstado;
  usuario_id: string;
  observaciones: string | null;
  created_at: string;
  usuario?: {
    nombre: string;
  };
}

export interface ProductoFrecuente {
  cliente_id: string;
  producto_id: string;
  producto_nombre: string;
  codigo_articulo: string;
  veces_comprado: number;
  cantidad_total: number;
  ultima_compra: string;
}

export function usePedidos(filtros?: { estado?: PedidoEstado; clienteId?: string; tipoPedido?: TipoPedido }) {
  return useQuery({
    queryKey: ['pedidos', filtros],
    queryFn: async () => {
      let query = supabase
        .from('pedidos')
        .select(`
          *,
          cliente:clientes(id, nombre, codigo_cliente, dni_cuit, direccion, telefono, zona:zonas(id, nombre)),
          vendedor:vendedores(id, nombre, codigo),
          detalles:pedido_detalles(id, producto_id, cantidad_pedida, cantidad_entregada, cantidad_devuelta, precio_unitario, descuento_porcentaje, subtotal, observaciones, producto:productos(id, descripcion, codigo_articulo, stock_actual, unidad_medida))
        `)
        .order('fecha_pedido', { ascending: false });

      if (filtros?.estado) {
        query = query.eq('estado', filtros.estado);
      }
      if (filtros?.clienteId) {
        query = query.eq('cliente_id', filtros.clienteId);
      }
      if (filtros?.tipoPedido) {
        query = query.eq('tipo_pedido', filtros.tipoPedido);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Pedido[];
    },
  });
}

export function usePedido(id: string | undefined) {
  return useQuery({
    queryKey: ['pedido', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`
          *,
          cliente:clientes(id, nombre, codigo_cliente, dni_cuit, direccion, telefono, zona:zonas(id, nombre)),
          vendedor:vendedores(id, nombre, codigo)
        `)
        .eq('id', id)
        .single();

      if (pedidoError) throw pedidoError;

      const { data: detalles, error: detallesError } = await supabase
        .from('pedido_detalles')
        .select(`
          *,
          producto:productos(id, descripcion, codigo_articulo, stock_actual, unidad_medida)
        `)
        .eq('pedido_id', id);

      if (detallesError) throw detallesError;

      return { ...pedido, detalles } as Pedido;
    },
    enabled: !!id,
  });
}

export function usePedidoHistorial(pedidoId: string | undefined) {
  return useQuery({
    queryKey: ['pedido-historial', pedidoId],
    queryFn: async () => {
      if (!pedidoId) return [];
      
      const { data, error } = await supabase
        .from('pedido_historial')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user names
      const userIds = [...new Set(data.map(h => h.usuario_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nombre')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.nombre]) || []);
      
      return data.map(h => ({
        ...h,
        usuario: { nombre: profileMap.get(h.usuario_id) || 'Usuario' }
      })) as PedidoHistorial[];
    },
    enabled: !!pedidoId,
  });
}

export function useProductosFrecuentes(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['productos-frecuentes', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const { data, error } = await supabase
        .from('cliente_productos_frecuentes')
        .select('*')
        .eq('cliente_id', clienteId)
        .limit(20);

      if (error) throw error;
      return data as ProductoFrecuente[];
    },
    enabled: !!clienteId,
  });
}

export function useClienteSaldoVencido(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-saldo-vencido', clienteId],
    queryFn: async () => {
      if (!clienteId) return { tieneVencido: false, montoVencido: 0 };
      
      // Buscar movimientos de deuda (tipo 'cargo' o 'deuda') no pagados
      const { data: movimientos, error } = await supabase
        .from('cliente_movimientos')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'cargo');

      if (error) throw error;

      // Calcular saldo vencido (movimientos de más de 30 días sin pagar)
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);

      const movimientosVencidos = movimientos?.filter(m => {
        const fechaMovimiento = new Date(m.fecha || m.created_at);
        return fechaMovimiento < hace30Dias;
      }) || [];

      const montoVencido = movimientosVencidos.reduce((sum, m) => sum + Number(m.monto), 0);

      return {
        tieneVencido: montoVencido > 0,
        montoVencido
      };
    },
    enabled: !!clienteId,
  });
}

export function useCrearPedido() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      cliente_id: string;
      vendedor_id?: string;
      lista_precio_id?: string;
      fecha_entrega_estimada?: string;
      observaciones?: string;
      tipo_pedido?: TipoPedido;
      detalles: {
        producto_id: string;
        cantidad: number;
        precio_unitario: number;
        descuento_porcentaje?: number;
      }[];
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      const subtotal = data.detalles.reduce((sum, d) => {
        const desc = d.descuento_porcentaje || 0;
        return sum + (d.cantidad * d.precio_unitario * (1 - desc / 100));
      }, 0);

      // Crear pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: data.cliente_id,
          vendedor_id: data.vendedor_id || null,
          usuario_id: user.id,
          lista_precio_id: data.lista_precio_id || null,
          fecha_entrega_estimada: data.fecha_entrega_estimada || null,
          observaciones: data.observaciones || null,
          tipo_pedido: data.tipo_pedido || 'reparto',
          subtotal,
          total: subtotal,
          estado: 'borrador'
        } as any)
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Crear detalles
      const detallesInsert = data.detalles.map(d => ({
        pedido_id: pedido.id,
        producto_id: d.producto_id,
        cantidad_pedida: d.cantidad,
          cantidad_entregada: d.cantidad,
        cantidad_devuelta: 0,
        precio_unitario: d.precio_unitario,
        descuento_porcentaje: d.descuento_porcentaje || 0,
        subtotal: d.cantidad * d.precio_unitario * (1 - (d.descuento_porcentaje || 0) / 100)
      }));

      const { error: detallesError } = await supabase
        .from('pedido_detalles')
        .insert(detallesInsert);

      if (detallesError) throw detallesError;

      // Registrar en historial
      await supabase.from('pedido_historial').insert({
        pedido_id: pedido.id,
        estado_anterior: null,
        estado_nuevo: 'borrador',
        usuario_id: user.id,
        observaciones: 'Pedido creado en borrador'
      });

      return pedido;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({ title: 'Pedido creado en borrador' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al crear pedido', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
}

export function useCambiarEstadoPedido() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      pedidoId, 
      nuevoEstado, 
      observaciones 
    }: { 
      pedidoId: string; 
      nuevoEstado: PedidoEstado; 
      observaciones?: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      // Get current state
      const { data: pedido, error: fetchError } = await supabase
        .from('pedidos')
        .select('estado')
        .eq('id', pedidoId)
        .single();

      if (fetchError) throw fetchError;

      // Update state
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ 
          estado: nuevoEstado,
          ...(nuevoEstado === 'entregado' ? { fecha_entrega_real: new Date().toISOString() } : {})
        })
        .eq('id', pedidoId);

      if (updateError) throw updateError;

      // Record in history
      await supabase.from('pedido_historial').insert({
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: nuevoEstado,
        usuario_id: user.id,
        observaciones
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido'] });
      queryClient.invalidateQueries({ queryKey: ['pedido-historial'] });
      toast({ title: 'Estado actualizado' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al cambiar estado', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
}

export function useRendirPedido() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pedidoId,
      devoluciones,
      cajaId
    }: {
      pedidoId: string;
      devoluciones: { detalleId: string; cantidad: number; motivo?: string }[];
      cajaId?: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      // Get pedido with details
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`
          *,
          cliente:clientes(id, nombre),
          detalles:pedido_detalles(*)
        `)
        .eq('id', pedidoId)
        .single();

      if (pedidoError) throw pedidoError;

      // Process returns and update details
      for (const dev of devoluciones) {
        if (dev.cantidad > 0) {
          // Register return
          await supabase.from('pedido_devoluciones').insert({
            pedido_id: pedidoId,
            pedido_detalle_id: dev.detalleId,
            cantidad: dev.cantidad,
            motivo: dev.motivo || null,
            reingresado_stock: true,
            usuario_id: user.id
          });

          // Update detail
          const detalle = pedido.detalles.find((d: PedidoDetalle) => d.id === dev.detalleId);
          if (detalle) {
            await supabase
              .from('pedido_detalles')
              .update({
                cantidad_devuelta: dev.cantidad,
                cantidad_entregada: detalle.cantidad_pedida - dev.cantidad
              })
              .eq('id', dev.detalleId);

            // Restock
            const { data: producto } = await supabase
              .from('productos')
              .select('stock_actual')
              .eq('id', detalle.producto_id)
              .single();

            if (producto) {
              await supabase
                .from('productos')
                .update({ stock_actual: (producto.stock_actual || 0) + dev.cantidad })
                .eq('id', detalle.producto_id);

              await supabase.from('movimientos_inventario').insert({
                producto_id: detalle.producto_id,
                tipo: 'entrada',
                cantidad: dev.cantidad,
                stock_anterior: producto.stock_actual || 0,
                stock_nuevo: (producto.stock_actual || 0) + dev.cantidad,
                motivo: `Devolución de pedido #${pedido.numero_pedido}`,
                usuario_id: user.id
              });
            }
          }
        } else {
          // Mark as fully delivered
          const detalle = pedido.detalles.find((d: PedidoDetalle) => d.id === dev.detalleId);
          if (detalle) {
            await supabase
              .from('pedido_detalles')
              .update({
                cantidad_entregada: detalle.cantidad_pedida,
                cantidad_devuelta: 0
              })
              .eq('id', dev.detalleId);
          }
        }
      }

      // Calculate final total (after returns)
      const { data: detallesActualizados } = await supabase
        .from('pedido_detalles')
        .select('*')
        .eq('pedido_id', pedidoId);

      const totalFinal = detallesActualizados?.reduce((sum, d) => {
        const cantidadReal = d.cantidad_entregada;
        const precio = d.precio_unitario * (1 - (d.descuento_porcentaje || 0) / 100);
        return sum + (cantidadReal * precio);
      }, 0) || 0;

      // Create venta
      const { data: venta, error: ventaError } = await supabase
        .from('ventas')
        .insert({
          cliente_id: pedido.cliente_id,
          usuario_id: user.id,
          caja_id: cajaId || null,
          subtotal: totalFinal,
          total: totalFinal,
          estado: 'confirmada'
        })
        .select()
        .single();

      if (ventaError) throw ventaError;

      // Create venta_detalles
      const ventaDetalles = detallesActualizados
        ?.filter(d => d.cantidad_entregada > 0)
        .map(d => ({
          venta_id: venta.id,
          producto_id: d.producto_id,
          cantidad: d.cantidad_entregada,
          precio_unitario: d.precio_unitario,
          descuento_porcentaje: d.descuento_porcentaje,
          descuento: d.precio_unitario * d.cantidad_entregada * (d.descuento_porcentaje / 100),
          subtotal: d.cantidad_entregada * d.precio_unitario * (1 - (d.descuento_porcentaje || 0) / 100)
        })) || [];

      if (ventaDetalles.length > 0) {
        await supabase.from('venta_detalles').insert(ventaDetalles);
      }

      // Register payment in cliente_movimientos (cuenta corriente)
      await supabase.from('cliente_movimientos').insert({
        cliente_id: pedido.cliente_id,
        tipo: 'cargo',
        monto: totalFinal,
        concepto: `Pedido #${pedido.numero_pedido} rendido`,
        venta_id: venta.id,
        usuario_registro_id: user.id
      });

      // Generate automatic NCR for returned items
      const hayDevoluciones = devoluciones.some(d => d.cantidad > 0);
      if (hayDevoluciones) {
        const totalOriginal = pedido.detalles.reduce((sum: number, d: any) => {
          const precio = d.precio_unitario * (1 - (d.descuento_porcentaje || 0) / 100);
          return sum + (d.cantidad_pedida * precio);
        }, 0);
        const montoNCR = totalOriginal - totalFinal;

        if (montoNCR > 0) {
          await supabase.from('cliente_movimientos').insert({
            cliente_id: pedido.cliente_id,
            tipo: 'NCR',
            monto: montoNCR,
            concepto: `NC por devolución - Pedido #${pedido.numero_pedido}`,
            venta_id: venta.id,
            usuario_registro_id: user.id
          });
        }
      }

      // Update pedido
      await supabase
        .from('pedidos')
        .update({
          rendido: true,
          fecha_rendicion: new Date().toISOString(),
          rendido_por: user.id,
          venta_id: venta.id,
          estado: hayDevoluciones ? 'parcial' : 'entregado',
          total: totalFinal
        })
        .eq('id', pedidoId);

      // History
      await supabase.from('pedido_historial').insert({
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: hayDevoluciones ? 'parcial' : 'entregado',
        usuario_id: user.id,
        observaciones: `Pedido rendido. Venta #${venta.numero_comprobante} generada.`
      });

      return venta;
    },
    onSuccess: (venta) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido'] });
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast({ 
        title: 'Pedido rendido exitosamente', 
        description: `Se generó la venta #${venta.numero_comprobante}` 
      });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al rendir pedido', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
}

export function useRechazarPedido() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ pedidoId, motivo }: { pedidoId: string; motivo: string }) => {
      if (!user) throw new Error('Usuario no autenticado');

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('estado')
        .eq('id', pedidoId)
        .single();

      await supabase
        .from('pedidos')
        .update({ estado: 'rechazado' })
        .eq('id', pedidoId);

      await supabase.from('pedido_historial').insert({
        pedido_id: pedidoId,
        estado_anterior: pedido?.estado,
        estado_nuevo: 'rechazado',
        usuario_id: user.id,
        observaciones: motivo
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido'] });
      toast({ title: 'Pedido rechazado' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al rechazar pedido', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
}
