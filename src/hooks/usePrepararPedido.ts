import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { PedidoEstado } from '@/hooks/usePedidos';

interface LineaPreparacion {
  detalleId: string;
  productoId: string | null;
  codigo: string;
  descripcion: string;
  cantidadPedida: number;
  cantidadPreparada: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
  subtotal: number;
}

interface PrepararPedidoParams {
  pedidoId: string;
  clienteId: string;
  numeroPedido: number;
  clienteNombre: string;
  clienteDireccion: string;
  lineas: LineaPreparacion[];
  totalFinal: number;
  estadoDestino?: PedidoEstado;
  registrarDeuda?: boolean;
  observacionesHistorial?: string;
}

export function usePrepararPedido() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: PrepararPedidoParams) => {
      if (!user) throw new Error('Usuario no autenticado');

      const {
        pedidoId,
        clienteId,
        numeroPedido,
        lineas,
        totalFinal,
        estadoDestino = 'preparado',
        registrarDeuda = true,
        observacionesHistorial,
      } = params;

      // Get current pedido state
      const { data: pedido, error: fetchError } = await supabase
        .from('pedidos')
        .select('estado, total')
        .eq('id', pedidoId)
        .single();

      if (fetchError) throw fetchError;

      // Update each pedido_detalle with cantidad_entregada (prepared quantity)
      for (const linea of lineas) {
        const { error: updateError } = await supabase
          .from('pedido_detalles')
          .update({
            cantidad_entregada: linea.cantidadPreparada,
            subtotal: linea.subtotal,
          })
          .eq('id', linea.detalleId);

        if (updateError) throw updateError;
      }

      // Update pedido with new total and estado final
      const { error: pedidoUpdateError } = await supabase
        .from('pedidos')
        .update({
          estado: estadoDestino,
          total: totalFinal,
          subtotal: totalFinal,
        })
        .eq('id', pedidoId);

      if (pedidoUpdateError) throw pedidoUpdateError;

      // Record in historial
      await supabase.from('pedido_historial').insert({
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: estadoDestino,
        usuario_id: user.id,
        observaciones: observacionesHistorial ?? `Pedido ${estadoDestino}. Total: $${totalFinal.toFixed(2)}`
      });

      if (registrarDeuda) {
        const { error: movimientoError } = await supabase
          .from('cliente_movimientos')
          .insert({
            cliente_id: clienteId,
            tipo: 'compra',
            monto: totalFinal,
            concepto: `Remito Pedido #${numeroPedido.toString().padStart(6, '0')}`,
            usuario_registro_id: user.id,
          });

        if (movimientoError) throw movimientoError;
      }

      return { success: true, numeroPedido, totalFinal, estadoDestino, registrarDeuda };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido'] });
      queryClient.invalidateQueries({ queryKey: ['pedido-historial'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-saldos'] });
      toast({ 
        title: data.estadoDestino === 'borrador' ? 'Pedido guardado en borrador' : 'Pedido preparado',
        description: data.registrarDeuda
          ? `Se registró una deuda de $${data.totalFinal.toFixed(2)} en la cuenta corriente del cliente.`
          : `El pedido quedó en ${data.estadoDestino} con total de $${data.totalFinal.toFixed(2)}.`
      });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al preparar pedido', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
}
