import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type TransferenciaEstado = 'pendiente' | 'validada' | 'rechazada';
export type TransferenciaOrigen = 'manual' | 'venta' | 'cobro_cc';

export interface Transferencia {
  id: string;
  fecha_transferencia: string;
  cliente_id: string;
  titular_nombre: string;
  titular_cuil: string | null;
  numero_operacion: string | null;
  importe: number;
  estado: TransferenciaEstado;
  observacion_rechazo: string | null;
  origen: TransferenciaOrigen;
  venta_id: string | null;
  cobro_id: string | null;
  cliente_movimiento_id: string | null;
  creado_por: string | null;
  validado_por: string | null;
  validado_at: string | null;
  rechazado_por: string | null;
  rechazado_at: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { nombre: string } | null;
  creador?: { nombre: string | null; email: string | null } | null;
  validador?: { nombre: string | null; email: string | null } | null;
  rechazador?: { nombre: string | null; email: string | null } | null;
}

const db = supabase as any;

export function useTransferencias() {
  return useQuery({
    queryKey: ['transferencias'],
    queryFn: async (): Promise<Transferencia[]> => {
      const { data, error } = await db
        .from('transferencias')
        .select(
          `*,
           cliente:clientes(nombre),
           creador:profiles!transferencias_creado_por_fkey(nombre,email),
           validador:profiles!transferencias_validado_por_fkey(nombre,email),
           rechazador:profiles!transferencias_rechazado_por_fkey(nombre,email)`
        )
        .order('created_at', { ascending: false });
      if (error) {
        // Fallback sin joins de profiles si las FKs no se nombran igual
        const { data: d2, error: e2 } = await db
          .from('transferencias')
          .select('*, cliente:clientes(nombre)')
          .order('created_at', { ascending: false });
        if (e2) throw e2;
        return (d2 || []) as Transferencia[];
      }
      return (data || []) as Transferencia[];
    },
  });
}

export function useCrearTransferencia() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      fecha_transferencia: string;
      cliente_id: string;
      titular_nombre: string;
      titular_cuil?: string | null;
      numero_operacion?: string | null;
      importe: number;
    }) => {
      const { error } = await db.from('transferencias').insert({
        ...input,
        origen: 'manual',
        creado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] });
      toast.success('Transferencia registrada');
    },
    onError: (e: any) => {
      const msg = e?.message?.includes('transferencias_cliente_num_op_uidx')
        ? 'Ya existe una transferencia con ese número de operación para este cliente'
        : e?.message || 'Error al registrar la transferencia';
      toast.error(msg);
    },
  });
}

export function useValidarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('transferencias')
        .update({ estado: 'validada' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] });
      toast.success('Transferencia validada');
    },
    onError: (e: any) => toast.error(e?.message || 'Error al validar'),
  });
}

export function useRechazarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, observacion }: { id: string; observacion: string }) => {
      const { error } = await db
        .from('transferencias')
        .update({ estado: 'rechazada', observacion_rechazo: observacion })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] });
      toast.success('Transferencia rechazada');
    },
    onError: (e: any) => toast.error(e?.message || 'Error al rechazar'),
  });
}