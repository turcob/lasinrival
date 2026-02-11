import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Tipos para el consolidado
export interface PedidoConsolidado {
  id: string;
  numero_pedido: number;
  total: number;
  estado: string;
  fecha_pedido: string;
  cliente: {
    id: string;
    nombre: string;
    codigo_cliente: string | null;
    vendedor_id: string | null;
    zona_id: string | null;
  };
  detalles: DetalleConsolidado[];
  tiene_pesables: boolean;
}

export interface DetalleConsolidado {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  cantidad_pedida: number;
  precio_unitario: number;
  descuento_porcentaje: number | null;
  subtotal: number;
  producto: {
    id: string;
    descripcion: string;
    codigo_articulo: string;
    unidad_medida: string | null;
    es_frio: boolean;
    categoria_id: string | null;
  } | null;
}

export interface ProductoConsolidadoItem {
  producto_id: string;
  codigo_articulo: string;
  descripcion: string;
  unidad_medida: string | null;
  es_frio: boolean;
  cantidad_total: number;
  tipo: 'no_pesable' | 'frio' | 'pesable';
}

function esPesable(unidad: string | null): boolean {
  if (!unidad) return false;
  const normalizada = unidad.toUpperCase().replace(/\./g, '').trim();
  return ['KG', 'KILO', 'KILOS'].includes(normalizada);
}

function clasificarProducto(prod: { unidad_medida: string | null; es_frio: boolean }): 'pesable' | 'frio' | 'no_pesable' {
  if (esPesable(prod.unidad_medida)) return 'pesable';
  if (prod.es_frio) return 'frio';
  return 'no_pesable';
}

export function useVendedoresActivos() {
  return useQuery({
    queryKey: ['vendedores-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nombre, codigo')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });
}

export function useZonasDeVendedor(vendedorId: string | null) {
  return useQuery({
    queryKey: ['zonas-vendedor', vendedorId],
    queryFn: async () => {
      if (!vendedorId) return [];
      // Get unique zona_ids from clients with this vendedor
      const { data: clientes, error } = await supabase
        .from('clientes')
        .select('zona_id')
        .eq('vendedor_id', vendedorId)
        .not('zona_id', 'is', null);
      if (error) throw error;

      const zonaIds = [...new Set(clientes.map(c => c.zona_id).filter(Boolean))] as string[];
      if (zonaIds.length === 0) return [];

      const { data: zonas, error: zonasError } = await supabase
        .from('zonas')
        .select('id, nombre, codigo')
        .in('id', zonaIds)
        .order('nombre');
      if (zonasError) throw zonasError;
      return zonas;
    },
    enabled: !!vendedorId,
  });
}

export function usePedidosConsolidado(
  vendedorId: string | null,
  zonaId: string | null,
  estado: string = 'pendiente'
) {
  return useQuery({
    queryKey: ['pedidos-consolidado', vendedorId, zonaId, estado],
    queryFn: async () => {
      // Query pedidos directly by estado, then filter by vendedor/zona via the joined cliente
      const { data: allPedidos, error: pedidosError } = await supabase
        .from('pedidos')
        .select(`
          id, numero_pedido, total, estado, fecha_pedido,
          cliente:clientes(id, nombre, codigo_cliente, vendedor_id, zona_id)
        `)
        .eq('estado', estado as any)
        .order('numero_pedido', { ascending: true });

      if (pedidosError) throw pedidosError;
      if (!allPedidos || allPedidos.length === 0) return [];

      // Filter by vendedor/zona client-side using the joined cliente data
      let pedidos = allPedidos.filter((p: any) => {
        if (!p.cliente) return false;
        if (vendedorId && p.cliente.vendedor_id !== vendedorId) return false;
        if (zonaId && p.cliente.zona_id !== zonaId) return false;
        return true;
      });

      if (pedidos.length === 0) return [];
      const pedidoIds = pedidos.map((p: any) => p.id);

      // Get all detalles with product info (including es_frio)
      const { data: detalles, error: detallesError } = await supabase
        .from('pedido_detalles')
        .select(`
          id, pedido_id, producto_id, cantidad_pedida, precio_unitario, descuento_porcentaje, subtotal,
          producto:productos(id, descripcion, codigo_articulo, unidad_medida, es_frio, categoria_id)
        `)
        .in('pedido_id', pedidoIds);

      if (detallesError) throw detallesError;

      // Map detalles to pedidos and determine tiene_pesables
      const detallesPorPedido = new Map<string, DetalleConsolidado[]>();
      for (const d of (detalles || [])) {
        const list = detallesPorPedido.get(d.pedido_id) || [];
        list.push(d as DetalleConsolidado);
        detallesPorPedido.set(d.pedido_id, list);
      }

      return pedidos.map(p => {
        const dets = detallesPorPedido.get(p.id) || [];
        const tienePesables = dets.some(d => d.producto && esPesable(d.producto.unidad_medida));
        return {
          ...p,
          detalles: dets,
          tiene_pesables: tienePesables,
        } as PedidoConsolidado;
      });
    },
    enabled: true,
  });
}

export function generarConsolidado(pedidos: PedidoConsolidado[]): ProductoConsolidadoItem[] {
  const map = new Map<string, ProductoConsolidadoItem>();

  for (const pedido of pedidos) {
    for (const detalle of pedido.detalles) {
      if (!detalle.producto || !detalle.producto_id) continue;
      const existing = map.get(detalle.producto_id);
      const tipo = clasificarProducto(detalle.producto);
      if (existing) {
        existing.cantidad_total += detalle.cantidad_pedida;
      } else {
        map.set(detalle.producto_id, {
          producto_id: detalle.producto_id,
          codigo_articulo: detalle.producto.codigo_articulo,
          descripcion: detalle.producto.descripcion,
          unidad_medida: detalle.producto.unidad_medida,
          es_frio: detalle.producto.es_frio,
          cantidad_total: detalle.cantidad_pedida,
          tipo,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.descripcion.localeCompare(b.descripcion));
}

export function useQuitarProductoConsolidado() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      productoId,
      pedidoIds,
    }: {
      productoId: string;
      pedidoIds: string[];
    }) => {
      // Get all detalles of this product in these pedidos
      const { data: detalles, error: fetchError } = await supabase
        .from('pedido_detalles')
        .select('id, pedido_id, subtotal')
        .eq('producto_id', productoId)
        .in('pedido_id', pedidoIds);

      if (fetchError) throw fetchError;
      if (!detalles || detalles.length === 0) return;

      // Delete the detalles
      const detalleIds = detalles.map(d => d.id);
      const { error: deleteError } = await supabase
        .from('pedido_detalles')
        .delete()
        .in('id', detalleIds);
      if (deleteError) throw deleteError;

      // Recalculate totals for each affected pedido
      const pedidosAfectados = [...new Set(detalles.map(d => d.pedido_id))];
      for (const pedidoId of pedidosAfectados) {
        const { data: remaining, error: remError } = await supabase
          .from('pedido_detalles')
          .select('subtotal')
          .eq('pedido_id', pedidoId);
        if (remError) throw remError;

        const nuevoTotal = remaining?.reduce((sum, d) => sum + d.subtotal, 0) || 0;
        const { error: updateError } = await supabase
          .from('pedidos')
          .update({ subtotal: nuevoTotal, total: nuevoTotal })
          .eq('id', pedidoId);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-consolidado'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({ title: 'Producto quitado de todos los pedidos' });
    },
    onError: (error) => {
      toast({
        title: 'Error al quitar producto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useConfirmarPedidosMasivo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (pedidoIds: string[]) => {
      if (!user) throw new Error('Usuario no autenticado');
      if (pedidoIds.length === 0) throw new Error('No hay pedidos seleccionados');

      // Update all pedidos to preparado
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ estado: 'preparado' })
        .in('id', pedidoIds)
        .eq('estado', 'pendiente');

      if (updateError) throw updateError;

      // Insert historial for each
      const historial = pedidoIds.map(id => ({
        pedido_id: id,
        estado_anterior: 'pendiente' as const,
        estado_nuevo: 'preparado' as const,
        usuario_id: user.id,
        observaciones: 'Confirmado masivamente desde consolidado',
      }));

      const { error: histError } = await supabase
        .from('pedido_historial')
        .insert(historial);

      if (histError) throw histError;

      return pedidoIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-consolidado'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({ title: `${count} pedidos confirmados como preparados` });
    },
    onError: (error) => {
      toast({
        title: 'Error al confirmar pedidos',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
