import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// ============== EMPLEADO ACTUAL ==============
export function useEmpleadoActual() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['empleado-actual', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('empleados')
        .select('id, nombre, cargo')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}

// ============== MIS HOJAS DE RUTA ==============
export function useMisHojasRuta() {
  const { data: empleado } = useEmpleadoActual();
  return useQuery({
    queryKey: ['encargado-hojas', empleado?.id],
    queryFn: async () => {
      if (!empleado?.id) return [];
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select(`
          id, numero_hoja, fecha, estado,
          hora_salida_estimada, hora_salida_real, hora_regreso,
          observaciones, responsable_id, chofer_id,
          vehiculo:vehiculos(patente, marca, modelo),
          chofer:empleados!hojas_ruta_chofer_id_fkey(id, nombre),
          responsable:empleados!hojas_ruta_responsable_id_fkey(id, nombre),
          paradas:hoja_ruta_paradas(id, estado)
        `)
        .or(`responsable_id.eq.${empleado.id},chofer_id.eq.${empleado.id}`)
        .neq('estado', 'cancelada')
        .order('fecha', { ascending: false })
        .order('numero_hoja', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empleado?.id,
    staleTime: 30_000,
  });
}

// ============== CARGA ITEMS ==============
export interface CargaItem {
  id: string;
  hoja_ruta_id: string;
  pedido_id: string;
  producto_id: string;
  cantidad_esperada: number;
  cantidad_cargada: number | null;
  estado: 'pendiente' | 'cargado' | 'faltante' | 'parcial';
  observaciones: string | null;
  producto?: { codigo_articulo: string; descripcion: string };
}

export function useCargaItems(hojaRutaId: string | undefined) {
  return useQuery({
    queryKey: ['carga-items', hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return [];
      const { data, error } = await supabase
        .from('hoja_ruta_carga_items')
        .select(`
          id, hoja_ruta_id, pedido_id, producto_id,
          cantidad_esperada, cantidad_cargada, estado, observaciones,
          producto:productos(codigo_articulo, descripcion)
        `)
        .eq('hoja_ruta_id', hojaRutaId);
      if (error) throw error;

      // Consolidar por producto (sumar cantidades de varios pedidos)
      const map = new Map<string, CargaItem>();
      (data ?? []).forEach((row: any) => {
        const key = row.producto_id;
        const existing = map.get(key);
        if (existing) {
          existing.cantidad_esperada = Number(existing.cantidad_esperada) + Number(row.cantidad_esperada);
          // Si hay múltiples filas para el mismo producto, usar el "peor" estado
          if (row.estado === 'pendiente') existing.estado = 'pendiente';
        } else {
          map.set(key, {
            ...row,
            cantidad_esperada: Number(row.cantidad_esperada),
            cantidad_cargada: row.cantidad_cargada !== null ? Number(row.cantidad_cargada) : null,
          });
        }
      });
      return Array.from(map.values()).sort((a, b) => {
        const cA = a.producto?.codigo_articulo ?? '';
        const cB = b.producto?.codigo_articulo ?? '';
        return cA.localeCompare(cB);
      });
    },
    enabled: !!hojaRutaId,
    staleTime: 15_000,
  });
}

export function useMarcarCargaItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      productoId,
      hojaRutaId,
      estado,
      cantidadCargada,
    }: {
      productoId: string;
      hojaRutaId: string;
      estado: 'pendiente' | 'cargado' | 'faltante' | 'parcial';
      cantidadCargada?: number;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');
      // Actualizar TODAS las filas del mismo producto en esa hoja
      const patch: Record<string, unknown> = {
        estado,
        verificado_por: user.id,
        verificado_at: new Date().toISOString(),
      };
      if (cantidadCargada !== undefined) patch.cantidad_cargada = cantidadCargada;
      const { error } = await supabase
        .from('hoja_ruta_carga_items')
        .update(patch)
        .eq('hoja_ruta_id', hojaRutaId)
        .eq('producto_id', productoId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['carga-items', vars.hojaRutaId] });
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta', vars.hojaRutaId] });
      queryClient.invalidateQueries({ queryKey: ['encargado-hojas'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useConfirmarCargaForzada() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ hojaRutaId, observaciones }: { hojaRutaId: string; observaciones?: string }) => {
      const patch: Record<string, unknown> = {
        estado: 'carga_confirmada',
        carga_confirmada_at: new Date().toISOString(),
        carga_confirmada_por: user?.id ?? null,
        carga_forzada: true,
      };
      if (observaciones) patch.observaciones = observaciones;
      const { error } = await supabase
        .from('hojas_ruta')
        .update(patch)
        .eq('id', hojaRutaId)
        .eq('estado', 'en_carga');
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta', vars.hojaRutaId] });
      queryClient.invalidateQueries({ queryKey: ['encargado-hojas'] });
      toast({ title: 'Carga confirmada' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

// ============== FORMAS DE PAGO ==============
export function useFormasPago() {
  return useQuery({
    queryKey: ['formas-pago-encargado'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formas_pago')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

// ============== REGISTRAR COBROS (multi-medio) ==============
export function useRegistrarCobrosEncargado() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      hojaRutaId,
      paradaId,
      pedidoId,
      totalPedido,
      montoCobradoPrevio,
      cobros,
      devolucionesVendedor,
    }: {
      hojaRutaId: string;
      paradaId: string;
      pedidoId: string;
      totalPedido: number;
      montoCobradoPrevio: number;
      cobros: Array<{ forma_pago_id: string; monto: number; referencia?: string }>;
      devolucionesVendedor?: Array<{ monto: number; descripcion: string }>;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');
      const validos = (cobros as Array<{ forma_pago_id: string; monto: number; referencia?: string; foto?: File | null }>)
        .filter(c => c.forma_pago_id && c.monto > 0);
      const devs = (devolucionesVendedor || []).filter(d => d.monto > 0 && (d.descripcion || '').trim());
      if (validos.length === 0 && devs.length === 0) throw new Error('Ingresá al menos un cobro o devolución');

      // Subir fotos (si las hay) y armar payload
      const payload: any[] = [];
      for (const c of validos) {
        let foto_path: string | null = null;
        let foto_nombre: string | null = null;
        if (c.foto) {
          const ext = (c.foto.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `${hojaRutaId}/${paradaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('comprobantes-cobros')
            .upload(path, c.foto, { contentType: c.foto.type || 'image/jpeg', upsert: false });
          if (upErr) throw new Error(`Error subiendo comprobante: ${upErr.message}`);
          foto_path = path;
          foto_nombre = c.foto.name;
        }
        payload.push({
          hoja_ruta_id: hojaRutaId,
          parada_id: paradaId,
          pedido_id: pedidoId,
          forma_pago_id: c.forma_pago_id,
          monto: c.monto,
          referencia: c.referencia || null,
          usuario_id: user.id,
          foto_comprobante_path: foto_path,
          foto_comprobante_nombre: foto_nombre,
        });
      }

      if (payload.length > 0) {
        const { error } = await supabase.from('hoja_ruta_cobros').insert(payload);
        if (error) throw error;
      }

      // Devoluciones del vendedor (descuento aplicado al cobro)
      let totalDevoluciones = 0;
      if (devs.length > 0) {
        const { error: devErr } = await supabase
          .from('hoja_ruta_devoluciones_vendedor' as any)
          .insert(devs.map(d => ({
            hoja_ruta_id: hojaRutaId,
            parada_id: paradaId,
            monto: d.monto,
            descripcion: d.descripcion,
            usuario_id: user.id,
          })));
        if (devErr) throw devErr;
        totalDevoluciones = devs.reduce((s, d) => s + Number(d.monto), 0);
      }

      const totalNuevo = validos.reduce((s, c) => s + Number(c.monto), 0);
      const acumulado = montoCobradoPrevio + totalNuevo + totalDevoluciones;
      await supabase
        .from('pedidos')
        .update({
          monto_cobrado: acumulado,
          cobrado_en_entrega: acumulado >= totalPedido,
        })
        .eq('id', pedidoId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['cobros-parada', vars.paradaId] });
      queryClient.invalidateQueries({ queryKey: ['cobros-hoja-ruta', vars.hojaRutaId] });
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta', vars.hojaRutaId] });
      queryClient.invalidateQueries({ queryKey: ['devoluciones-vendedor', vars.paradaId] });
      queryClient.invalidateQueries({ queryKey: ['devoluciones-vendedor-hoja', vars.hojaRutaId] });
    },
    onError: (e: Error) => toast({ title: 'Error al cobrar', description: e.message, variant: 'destructive' }),
  });
}

// ============== DEVOLUCIONES DEL VENDEDOR ==============
export function useDevolucionesVendedorParada(paradaId: string | undefined) {
  return useQuery({
    queryKey: ['devoluciones-vendedor', paradaId],
    queryFn: async () => {
      if (!paradaId) return [];
      const { data, error } = await (supabase as any)
        .from('hoja_ruta_devoluciones_vendedor')
        .select('id, monto, descripcion, created_at')
        .eq('parada_id', paradaId)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!paradaId,
  });
}

export function useDevolucionesVendedorHojaRuta(hojaRutaId: string | undefined) {
  return useQuery({
    queryKey: ['devoluciones-vendedor-hoja', hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return [];
      const { data, error } = await (supabase as any)
        .from('hoja_ruta_devoluciones_vendedor')
        .select(`
          id, monto, descripcion, created_at, parada_id,
          parada:hoja_ruta_paradas(id, pedido:pedidos(numero_pedido, cliente:clientes(nombre)))
        `)
        .eq('hoja_ruta_id', hojaRutaId)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hojaRutaId,
  });
}

// ============== STOCK DISPONIBLE RECHAZADO + VENTAS ==============
export function useStockRechazadoHojaRuta(hojaRutaId: string | undefined) {
  return useQuery({
    queryKey: ['stock-rechazado', hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return [];
      // Devoluciones registradas en esta hoja (productos rechazados por clientes)
      const { data: devs, error: e1 } = await supabase
        .from('hoja_ruta_devoluciones')
        .select(`
          cantidad,
          pedido_detalle:pedido_detalles(
            producto_id, precio_unitario, descuento_porcentaje,
            producto:productos(id, codigo_articulo, descripcion, unidad_medida)
          )
        `)
        .eq('hoja_ruta_id', hojaRutaId);
      if (e1) throw e1;

      // Ventas ya realizadas del stock rechazado
      const { data: vendidos, error: e2 } = await (supabase as any)
        .from('hoja_ruta_ventas_rechazados')
        .select('producto_id, cantidad')
        .eq('hoja_ruta_id', hojaRutaId);
      if (e2) throw e2;

      const map = new Map<string, {
        producto_id: string; codigo: string; descripcion: string; unidad: string;
        precio_sugerido: number; rechazado: number; vendido: number; disponible: number;
      }>();

      (devs ?? []).forEach((d: any) => {
        const pd = d.pedido_detalle;
        if (!pd?.producto_id || !pd?.producto) return;
        const precio = Number(pd.precio_unitario ?? 0) * (1 - Number(pd.descuento_porcentaje ?? 0) / 100);
        const cur = map.get(pd.producto_id) ?? {
          producto_id: pd.producto_id,
          codigo: pd.producto.codigo_articulo ?? '-',
          descripcion: pd.producto.descripcion ?? 'Producto',
          unidad: pd.producto.unidad_medida ?? 'UN',
          precio_sugerido: precio,
          rechazado: 0, vendido: 0, disponible: 0,
        };
        cur.rechazado += Number(d.cantidad ?? 0);
        if (precio > 0 && cur.precio_sugerido === 0) cur.precio_sugerido = precio;
        map.set(pd.producto_id, cur);
      });

      (vendidos ?? []).forEach((v: any) => {
        const cur = map.get(v.producto_id);
        if (cur) cur.vendido += Number(v.cantidad ?? 0);
      });

      return Array.from(map.values())
        .map(x => ({ ...x, disponible: Math.max(0, x.rechazado - x.vendido) }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo));
    },
    enabled: !!hojaRutaId,
    staleTime: 15_000,
  });
}

export function useVentasRechazadosHojaRuta(hojaRutaId: string | undefined) {
  return useQuery({
    queryKey: ['ventas-rechazados', hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) return [];
      const { data, error } = await (supabase as any)
        .from('hoja_ruta_ventas_rechazados')
        .select(`
          id, cantidad, precio_unitario, monto_total, observaciones, created_at,
          producto:productos(codigo_articulo, descripcion),
          cliente:clientes(nombre),
          forma_pago:formas_pago(id, nombre),
          parada_id
        `)
        .eq('hoja_ruta_id', hojaRutaId)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hojaRutaId,
  });
}

export function useRegistrarVentaRechazado() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      hoja_ruta_id: string;
      parada_id: string;
      cliente_id: string;
      producto_id: string;
      cantidad: number;
      precio_unitario: number;
      forma_pago_id: string;
      observaciones?: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');
      const monto_total = Number(data.cantidad) * Number(data.precio_unitario);
      const { error } = await (supabase as any)
        .from('hoja_ruta_ventas_rechazados')
        .insert({
          hoja_ruta_id: data.hoja_ruta_id,
          parada_id: data.parada_id,
          cliente_id: data.cliente_id,
          producto_id: data.producto_id,
          cantidad: data.cantidad,
          precio_unitario: data.precio_unitario,
          monto_total,
          forma_pago_id: data.forma_pago_id,
          observaciones: data.observaciones || null,
          usuario_id: user.id,
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['stock-rechazado', vars.hoja_ruta_id] });
      queryClient.invalidateQueries({ queryKey: ['ventas-rechazados', vars.hoja_ruta_id] });
      queryClient.invalidateQueries({ queryKey: ['cobros-hoja-ruta', vars.hoja_ruta_id] });
      toast({ title: 'Venta registrada', description: 'Se sumará a la rendición' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

// ============== GUARDAR RENDICIÓN ==============
export function useGuardarRendicion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      hojaRutaId,
      numeroHoja,
      rendicionExistenteId,
      totales,
      observaciones,
      impactarCuentaCorriente,
    }: {
      hojaRutaId: string;
      numeroHoja: number;
      rendicionExistenteId?: string | null;
      totales: {
        efectivo: number;
        transferencias: number;
        qr: number;
        tarjeta: number;
        general: number;
        diferencia: number;
      };
      observaciones?: string;
      impactarCuentaCorriente: boolean;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');
      const row = {
        hoja_ruta_id: hojaRutaId,
        usuario_id: user.id,
        total_efectivo: totales.efectivo,
        total_transferencias: totales.transferencias,
        total_qr: totales.qr,
        total_tarjeta: totales.tarjeta,
        total_general: totales.general,
        diferencia: totales.diferencia,
        observaciones: observaciones || null,
        estado: 'pendiente' as const,
      };

      if (rendicionExistenteId) {
        const { error } = await supabase
          .from('hoja_ruta_rendiciones')
          .update(row)
          .eq('id', rendicionExistenteId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hoja_ruta_rendiciones').insert(row);
        if (error) throw error;

        // Impactar cuenta corriente en la primera rendición
        if (impactarCuentaCorriente) {
          const { data: cobros } = await supabase
            .from('hoja_ruta_cobros')
            .select(`monto, forma_pago_id, pedido:pedidos(numero_pedido, cliente_id)`)
            .eq('hoja_ruta_id', hojaRutaId);

          const porCliente = new Map<string, { total: number; formaPagoId: string | null; pedidos: number[] }>();
          (cobros ?? []).forEach((c: any) => {
            const clienteId = c.pedido?.cliente_id;
            if (!clienteId) return;
            const cur = porCliente.get(clienteId) ?? { total: 0, formaPagoId: c.forma_pago_id ?? null, pedidos: [] };
            cur.total += Number(c.monto);
            const num = c.pedido?.numero_pedido;
            if (num && !cur.pedidos.includes(num)) cur.pedidos.push(num);
            porCliente.set(clienteId, cur);
          });

          const movimientos = Array.from(porCliente.entries())
            .filter(([_, v]) => v.total > 0)
            .map(([clienteId, v]) => ({
              cliente_id: clienteId,
              tipo: 'pago',
              monto: v.total,
              concepto: v.pedidos.length
                ? `Cobro en entrega - Pedido(s) #${v.pedidos.join(', #')} - HR #${numeroHoja}`
                : `Cobro en entrega - HR #${numeroHoja}`,
              forma_pago_id: v.formaPagoId,
              usuario_registro_id: user.id,
              estado_imputacion: 'confirmado',
            }));

          if (movimientos.length) {
            const { error: movErr } = await supabase.from('cliente_movimientos').insert(movimientos);
            if (movErr) console.error('[encargado] error impactar cuenta corriente', movErr);
          }
        }
      }

      // Asegurar que la hoja queda completada
      await supabase.from('hojas_ruta').update({ estado: 'completada' }).eq('id', hojaRutaId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['rendicion-hoja-ruta', vars.hojaRutaId] });
      queryClient.invalidateQueries({ queryKey: ['hoja-ruta', vars.hojaRutaId] });
      queryClient.invalidateQueries({ queryKey: ['encargado-hojas'] });
      toast({ title: 'Rendición enviada', description: 'Pendiente de aprobación' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

// ============== CLASIFICAR MEDIO DE PAGO ==============
export function clasificarMedioPago(nombre: string): 'efectivo' | 'transferencias' | 'qr' | 'tarjeta' | 'otro' {
  const n = (nombre || '').toLowerCase();
  if (n.includes('efectivo')) return 'efectivo';
  if (n.includes('transfer')) return 'transferencias';
  if (n.includes('qr') || n.includes('mercado pago')) return 'qr';
  if (n.includes('tarjeta') || n.includes('debito') || n.includes('credito') || n.includes('crédito') || n.includes('débito')) return 'tarjeta';
  return 'otro';
}