import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Proveedor {
  id: string;
  codigo_proveedor: string;
  razon_social: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  cuit: string | null;
  condicion_iva: string | null;
  activo: boolean;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProveedorMovimiento {
  id: string;
  proveedor_id: string;
  tipo: string;
  numero_comprobante: string | null;
  tipo_comprobante: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  monto: number;
  saldo_pendiente: number;
  concepto: string | null;
  forma_pago_id: string | null;
  usuario_registro_id: string;
  observaciones: string | null;
  created_at: string;
}

export interface OrdenCompra {
  id: string;
  numero_orden: number;
  proveedor_id: string;
  estado: string;
  fecha_orden: string;
  fecha_entrega_estimada: string | null;
  fecha_recepcion: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  observaciones: string | null;
  usuario_id: string;
  created_at: string;
  proveedor?: Proveedor;
}

export interface OrdenCompraDetalle {
  id: string;
  orden_compra_id: string;
  producto_id: string | null;
  descripcion: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  cantidad_recibida: number;
}

export function useProveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProveedores = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('razon_social');

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los proveedores', variant: 'destructive' });
    } else {
      setProveedores((data as any[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchProveedores(); }, [fetchProveedores]);

  const crearProveedor = async (data: Partial<Proveedor>) => {
    const { error } = await supabase.from('proveedores').insert(data as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Proveedor creado' });
    fetchProveedores();
    return true;
  };

  const actualizarProveedor = async (id: string, data: Partial<Proveedor>) => {
    const { error } = await supabase.from('proveedores').update(data as any).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Proveedor actualizado' });
    fetchProveedores();
    return true;
  };

  const eliminarProveedor = async (id: string) => {
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Proveedor eliminado' });
    fetchProveedores();
    return true;
  };

  return { proveedores, loading, fetchProveedores, crearProveedor, actualizarProveedor, eliminarProveedor };
}

export function useProveedorMovimientos(proveedorId?: string) {
  const [movimientos, setMovimientos] = useState<ProveedorMovimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMovimientos = useCallback(async () => {
    if (!proveedorId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('proveedor_movimientos')
      .select('*')
      .eq('proveedor_id', proveedorId)
      .order('fecha_vencimiento', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los movimientos', variant: 'destructive' });
    } else {
      setMovimientos((data as any[]) || []);
    }
    setLoading(false);
  }, [proveedorId, toast]);

  useEffect(() => { fetchMovimientos(); }, [fetchMovimientos]);

  const crearMovimiento = async (data: Partial<ProveedorMovimiento>) => {
    const { error } = await supabase.from('proveedor_movimientos').insert({ ...data, usuario_registro_id: user?.id } as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Movimiento registrado' });
    fetchMovimientos();
    return true;
  };

  const saldoTotal = movimientos.reduce((acc, m) => {
    if (m.tipo === 'factura' || m.tipo === 'nota_debito') return acc + m.saldo_pendiente;
    if (m.tipo === 'pago' || m.tipo === 'nota_credito') return acc - m.monto;
    return acc;
  }, 0);

  return { movimientos, loading, fetchMovimientos, crearMovimiento, saldoTotal };
}

export function useOrdenesCompra() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes_compra')
      .select('*, proveedores(*)')
      .order('fecha_orden', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las órdenes', variant: 'destructive' });
    } else {
      const mapped = (data as any[])?.map(d => ({ ...d, proveedor: d.proveedores })) || [];
      setOrdenes(mapped);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  const crearOrden = async (orden: any, detalles: any[]) => {
    const { data, error } = await supabase
      .from('ordenes_compra')
      .insert({ ...orden, usuario_id: user?.id } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }

    if (detalles.length > 0) {
      const items = detalles.map(d => ({ ...d, orden_compra_id: (data as any).id }));
      const { error: detError } = await supabase.from('orden_compra_detalles').insert(items as any);
      if (detError) {
        toast({ title: 'Error en detalles', description: detError.message, variant: 'destructive' });
      }
    }

    toast({ title: 'Orden de compra creada' });
    fetchOrdenes();
    return true;
  };

  const actualizarEstado = async (id: string, estado: string) => {
    const updateData: any = { estado };
    if (estado === 'recibida') updateData.fecha_recepcion = new Date().toISOString();
    
    const { error } = await supabase.from('ordenes_compra').update(updateData).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Estado actualizado' });
    fetchOrdenes();
    return true;
  };

  return { ordenes, loading, fetchOrdenes, crearOrden, actualizarEstado };
}
