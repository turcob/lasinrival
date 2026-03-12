import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addDays, isAfter, isBefore, startOfDay } from 'date-fns';

export type ChequeEstado = 'en_cartera' | 'depositado' | 'cobrado' | 'rechazado' | 'endosado' | 'vencido' | 'anulado';
export type ChequeTipo = 'terceros' | 'propio';

export interface Cheque {
  id: string;
  tipo: ChequeTipo;
  estado: ChequeEstado;
  numero_cheque: string;
  banco: string;
  sucursal_banco: string | null;
  emisor: string;
  cuit_emisor: string | null;
  beneficiario: string | null;
  cliente_id: string | null;
  monto: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_deposito: string | null;
  fecha_cobro: string | null;
  fecha_rechazo: string | null;
  fecha_endoso: string | null;
  motivo_rechazo: string | null;
  endosado_a: string | null;
  cuenta_deposito: string | null;
  banco_deposito: string | null;
  observaciones: string | null;
  cliente_movimiento_id: string | null;
  usuario_registro_id: string;
  created_at: string;
  updated_at: string;
  cliente?: { nombre: string } | null;
}

export interface ChequeHistorial {
  id: string;
  cheque_id: string;
  estado_anterior: ChequeEstado | null;
  estado_nuevo: ChequeEstado;
  usuario_id: string;
  observaciones: string | null;
  created_at: string;
}

export function useCheques() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCheques = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cheques')
      .select('*, cliente:clientes(nombre)')
      .order('fecha_vencimiento', { ascending: true });

    if (error) {
      toast({ title: 'Error al cargar cheques', description: error.message, variant: 'destructive' });
    } else {
      setCheques((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchCheques();
  }, [user]);

  const crearCheque = async (cheque: Omit<Cheque, 'id' | 'created_at' | 'updated_at' | 'cliente'>) => {
    const { data, error } = await supabase
      .from('cheques')
      .insert(cheque as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error al crear cheque', description: error.message, variant: 'destructive' });
      return null;
    }

    // Register in history
    await supabase.from('cheque_historial').insert({
      cheque_id: data.id,
      estado_nuevo: cheque.estado,
      usuario_id: cheque.usuario_registro_id,
      observaciones: 'Cheque registrado',
    } as any);

    toast({ title: 'Cheque registrado correctamente' });
    fetchCheques();
    return data;
  };

  const cambiarEstado = async (chequeId: string, nuevoEstado: ChequeEstado, datosExtra?: Record<string, any>, observaciones?: string) => {
    const chequeActual = cheques.find(c => c.id === chequeId);
    if (!chequeActual) return;

    const updateData: any = { estado: nuevoEstado, ...datosExtra };

    const { error } = await supabase
      .from('cheques')
      .update(updateData)
      .eq('id', chequeId);

    if (error) {
      toast({ title: 'Error al actualizar cheque', description: error.message, variant: 'destructive' });
      return;
    }

    await supabase.from('cheque_historial').insert({
      cheque_id: chequeId,
      estado_anterior: chequeActual.estado,
      estado_nuevo: nuevoEstado,
      usuario_id: user!.id,
      observaciones: observaciones || `Estado cambiado de ${chequeActual.estado} a ${nuevoEstado}`,
    } as any);

    toast({ title: 'Estado actualizado' });
    fetchCheques();
  };

  const fetchHistorial = async (chequeId: string): Promise<ChequeHistorial[]> => {
    const { data, error } = await supabase
      .from('cheque_historial')
      .select('*')
      .eq('cheque_id', chequeId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data as any) || [];
  };

  // KPIs
  const kpis = useMemo(() => {
    const hoy = startOfDay(new Date());
    const en7dias = addDays(hoy, 7);

    const enCartera = cheques.filter(c => c.estado === 'en_cartera');
    const totalEnCartera = enCartera.reduce((s, c) => s + Number(c.monto), 0);
    const porVencer = enCartera.filter(c => {
      const venc = new Date(c.fecha_vencimiento);
      return isBefore(venc, en7dias) && isAfter(venc, hoy);
    });
    const vencidos = enCartera.filter(c => isBefore(new Date(c.fecha_vencimiento), hoy));
    const rechazados = cheques.filter(c => c.estado === 'rechazado');
    const totalRechazados = rechazados.reduce((s, c) => s + Number(c.monto), 0);
    const depositados = cheques.filter(c => c.estado === 'depositado');
    const totalDepositados = depositados.reduce((s, c) => s + Number(c.monto), 0);
    const cobrados = cheques.filter(c => c.estado === 'cobrado');
    const totalCobrados = cobrados.reduce((s, c) => s + Number(c.monto), 0);

    return {
      totalEnCartera,
      cantEnCartera: enCartera.length,
      porVencer: porVencer.length,
      montoPorVencer: porVencer.reduce((s, c) => s + Number(c.monto), 0),
      vencidos: vencidos.length,
      montoVencidos: vencidos.reduce((s, c) => s + Number(c.monto), 0),
      rechazados: rechazados.length,
      totalRechazados,
      depositados: depositados.length,
      totalDepositados,
      cobrados: cobrados.length,
      totalCobrados,
    };
  }, [cheques]);

  // Análisis por banco
  const analysisPorBanco = useMemo(() => {
    const map: Record<string, { total: number; cantidad: number; rechazados: number }> = {};
    cheques.forEach(c => {
      if (!map[c.banco]) map[c.banco] = { total: 0, cantidad: 0, rechazados: 0 };
      map[c.banco].total += Number(c.monto);
      map[c.banco].cantidad += 1;
      if (c.estado === 'rechazado') map[c.banco].rechazados += 1;
    });
    return Object.entries(map).map(([banco, data]) => ({ banco, ...data })).sort((a, b) => b.total - a.total);
  }, [cheques]);

  // Análisis por cliente
  const analysisPorCliente = useMemo(() => {
    const map: Record<string, { nombre: string; total: number; cantidad: number; rechazados: number }> = {};
    cheques.filter(c => c.cliente_id).forEach(c => {
      const clienteNombre = (c.cliente as any)?.nombre || c.emisor;
      const key = c.cliente_id!;
      if (!map[key]) map[key] = { nombre: clienteNombre, total: 0, cantidad: 0, rechazados: 0 };
      map[key].total += Number(c.monto);
      map[key].cantidad += 1;
      if (c.estado === 'rechazado') map[key].rechazados += 1;
    });
    return Object.entries(map).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.total - a.total);
  }, [cheques]);

  // Alertas
  const alertas = useMemo(() => {
    const hoy = startOfDay(new Date());
    const en3dias = addDays(hoy, 3);
    const en7dias = addDays(hoy, 7);
    const items: { tipo: 'urgente' | 'warning' | 'info'; mensaje: string; chequeId: string }[] = [];

    cheques.filter(c => c.estado === 'en_cartera').forEach(c => {
      const venc = new Date(c.fecha_vencimiento);
      if (isBefore(venc, hoy)) {
        items.push({ tipo: 'urgente', mensaje: `Cheque #${c.numero_cheque} de ${c.emisor} está VENCIDO ($${Number(c.monto).toLocaleString()})`, chequeId: c.id });
      } else if (isBefore(venc, en3dias)) {
        items.push({ tipo: 'urgente', mensaje: `Cheque #${c.numero_cheque} vence en menos de 3 días ($${Number(c.monto).toLocaleString()})`, chequeId: c.id });
      } else if (isBefore(venc, en7dias)) {
        items.push({ tipo: 'warning', mensaje: `Cheque #${c.numero_cheque} vence esta semana ($${Number(c.monto).toLocaleString()})`, chequeId: c.id });
      }
    });

    // Clientes con alta tasa de rechazo
    analysisPorCliente.forEach(c => {
      if (c.cantidad >= 3 && c.rechazados / c.cantidad > 0.3) {
        items.push({ tipo: 'warning', mensaje: `${c.nombre}: ${Math.round(c.rechazados / c.cantidad * 100)}% de rechazo (${c.rechazados}/${c.cantidad} cheques)`, chequeId: '' });
      }
    });

    return items.sort((a, b) => (a.tipo === 'urgente' ? -1 : b.tipo === 'urgente' ? 1 : 0));
  }, [cheques, analysisPorCliente]);

  return {
    cheques,
    loading,
    kpis,
    analysisPorBanco,
    analysisPorCliente,
    alertas,
    crearCheque,
    cambiarEstado,
    fetchHistorial,
    refetch: fetchCheques,
  };
}
