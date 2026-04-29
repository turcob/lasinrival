import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { imprimirDevolucionesHojaRuta } from '@/lib/imprimirWorkflows';
import { Button } from '@/components/ui/button';
import { 
  useHojaRuta,
  useCambiarEstadoHojaRuta,
  useActualizarEstadoParada,
  useEliminarParada,
  useCobrosHojaRuta,
  useDevolucionesHojaRuta,
  useRendicionHojaRuta,
  useHojaCarga,
  useActualizarHojaRuta,
  type HojaRuta,
  type HojaRutaEstado,
  type ParadaEstado
} from '@/hooks/useLogistica';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Truck, 
  User, 
  Calendar, 
  Clock, 
  MapPin,
  Play,
  CheckCircle,
  XCircle,
  Package,
  Phone,
  Trash2,
  AlertTriangle,
  Loader2,
  DollarSign,
  FileCheck,
  Banknote,
  PackageX,
  Printer,
  RotateCcw,
  X,
  UserCog,
  History
} from 'lucide-react';
import { RegistrarCobroDialog } from './RegistrarCobroDialog';
import { RendicionHojaRutaDialog } from './RendicionHojaRutaDialog';
import { RegistrarDevolucionDialog } from './RegistrarDevolucionDialog';
import { RefacturarHojaRutaDialog } from './RefacturarHojaRutaDialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const estadoHojaConfig: Record<HojaRutaEstado, { label: string; className: string }> = {
  planificada: { label: 'Planificada', className: 'bg-muted text-muted-foreground' },
  en_carga: { label: 'Esperando Confirmación', className: 'bg-amber-100 text-amber-800' },
  carga_confirmada: { label: 'Carga Confirmada', className: 'bg-emerald-100 text-emerald-800' },
  en_ruta: { label: 'En Ruta', className: 'bg-blue-100 text-blue-800' },
  completada: { label: 'Completada', className: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
};

const estadoParadaConfig: Record<ParadaEstado, { label: string; className: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', className: 'text-muted-foreground', icon: Clock },
  en_camino: { label: 'En Camino', className: 'text-blue-600', icon: Truck },
  entregado: { label: 'Entregado', className: 'text-green-600', icon: CheckCircle },
  entrega_parcial: { label: 'Parcial', className: 'text-amber-600', icon: AlertTriangle },
  rechazado: { label: 'Rechazado', className: 'text-destructive', icon: XCircle },
  no_entregado: { label: 'No Entregado', className: 'text-destructive', icon: XCircle },
};

interface DetalleHojaRutaDialogProps {
  hojaRutaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetalleHojaRutaDialog({ hojaRutaId, open, onOpenChange }: DetalleHojaRutaDialogProps) {
  const { data: hojaRuta, isLoading, refetch } = useHojaRuta(hojaRutaId || undefined);
  const { data: cobros } = useCobrosHojaRuta(hojaRutaId || undefined);
  const { data: devoluciones } = useDevolucionesHojaRuta(hojaRutaId || undefined);
  const { data: rendicionExistente } = useRendicionHojaRuta(hojaRutaId || undefined);
  const { data: productosCarga = [] } = useHojaCarga(hojaRutaId || undefined);
  const cambiarEstado = useCambiarEstadoHojaRuta();
  const actualizarParada = useActualizarEstadoParada();
  const eliminarParada = useEliminarParada();
  const actualizarHojaRuta = useActualizarHojaRuta();

  // Reasignación de responsable
  const [reasignarOpen, setReasignarOpen] = useState(false);
  const [nuevoResponsableId, setNuevoResponsableId] = useState<string>('');

  // Solo empleados con rol "responsable" (vía user_roles)
  const { data: empleados = [] } = useQuery({
    queryKey: ['empleados-rol-responsable'],
    queryFn: async () => {
      const { data: rolesUsuarios, error: errRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'responsable' as any);
      if (errRoles) throw errRoles;
      const userIds = (rolesUsuarios || []).map((r: any) => r.user_id).filter(Boolean);
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('empleados')
        .select('id, nombre, user_id')
        .eq('activo', true)
        .in('user_id', userIds)
        .order('nombre');
      if (error) throw error;
      return (data || []) as Array<{ id: string; nombre: string; user_id: string | null }>;
    },
  });

  const handleAbrirReasignar = () => {
    setNuevoResponsableId(hojaRuta?.responsable_id || '');
    setReasignarOpen(true);
  };

  const handleConfirmarReasignar = async () => {
    if (!hojaRuta) return;
    await actualizarHojaRuta.mutateAsync({
      id: hojaRuta.id,
      responsable_id: nuevoResponsableId || null,
    } as any);
    setReasignarOpen(false);
  };

  // Estados para diálogos de cobro, rendición y devoluciones
  const [cobroDialog, setCobroDialog] = useState<{
    open: boolean;
    paradaId: string;
    pedidoId: string;
    totalPedido: number;
    montoCobrado: number;
  }>({ open: false, paradaId: '', pedidoId: '', totalPedido: 0, montoCobrado: 0 });
  const [rendicionOpen, setRendicionOpen] = useState(false);
  const [refacturarOpen, setRefacturarOpen] = useState(false);
  const [historiaOpen, setHistoriaOpen] = useState(false);
  const [devolucionDialog, setDevolucionDialog] = useState<{
    open: boolean;
    paradaId: string;
    marcarParcialAlGuardar?: boolean;
    pedidoDetalles: Array<{
      id: string;
      producto_id: string | null;
      cantidad_pedida: number;
      cantidad_entregada: number | null;
      producto?: { descripcion: string; codigo_articulo: string };
    }>;
  }>({ open: false, paradaId: '', marcarParcialAlGuardar: false, pedidoDetalles: [] });

  // Calcular monto cobrado por pedido
  const getCobradoPorPedido = (pedidoId: string): number => {
    if (!cobros) return 0;
    return cobros
      .filter((c: any) => c.pedido?.numero_pedido && c.pedido)
      .filter((c: any) => {
        return true;
      })
      .reduce((sum: number, c: any) => sum + (c.monto || 0), 0);
  };

  const getCobradoPorParada = (paradaId: string): number => {
    if (!cobros) return 0;
    return cobros
      .filter((c: any) => c.parada?.id === paradaId)
      .reduce((sum: number, c: any) => sum + (c.monto || 0), 0);
  };

  // Calcular monto de devoluciones por parada
  const getDevolucionesPorParada = (paradaId: string): number => {
    if (!devoluciones) return 0;
    return devoluciones
      .filter((d: any) => d.parada_id === paradaId || d.parada?.id === paradaId)
      .reduce((sum: number, d: any) => {
        const precio = d.pedido_detalle?.precio_unitario || 0;
        const descuento = d.pedido_detalle?.descuento_porcentaje || 0;
        const precioNeto = precio * (1 - descuento / 100);
        return sum + (d.cantidad * precioNeto);
      }, 0);
  };

  // Total neto del pedido (total - devoluciones)
  const getTotalNeto = (paradaId: string, totalPedido: number): number => {
    return totalPedido - getDevolucionesPorParada(paradaId);
  };

  // Total neto considerando el estado de la parada:
  // - Si está rechazado, el total esperado es 0 (no se cobra nada)
  // - Si está entregado/parcial, se descuentan las devoluciones registradas
  const getTotalEsperadoParada = (paradaId: string, paradaEstado: string, totalPedido: number): number => {
    if (paradaEstado === 'rechazado' || paradaEstado === 'no_entregado') return 0;
    return getTotalNeto(paradaId, totalPedido);
  };

  const devolucionesRegistradas = devoluciones || [];
  const paradasConDevolucion = new Set(
    devolucionesRegistradas.map((d: any) => d.parada_id || d.parada?.id).filter(Boolean)
  );
  const productosRechazadosControl = hojaRuta
    ? [
        ...devolucionesRegistradas,
        ...(hojaRuta.paradas || [])
          .filter((parada: any) => parada.estado === 'rechazado' && !paradasConDevolucion.has(parada.id))
          .flatMap((parada: any) =>
            (parada.pedido?.detalles || []).map((detalle: any) => ({
              id: `rechazo-total-${parada.id}-${detalle.id}`,
              cantidad: Number(detalle.cantidad_entregada) > 0
                ? detalle.cantidad_entregada
                : (detalle.cantidad_pedida ?? 0),
              motivo: 'rechazo_cliente',
              detalle_motivo: parada.observaciones || 'Pedido completo rechazado',
              reingresado_stock: false,
              created_at: parada.hora_llegada || parada.updated_at || parada.created_at,
              parada_id: parada.id,
              parada: {
                id: parada.id,
                orden: parada.orden,
                pedido: {
                  numero_pedido: parada.pedido?.numero_pedido,
                  cliente: parada.pedido?.cliente,
                },
              },
              pedido_detalle: {
                id: detalle.id,
                precio_unitario: detalle.precio_unitario || 0,
                descuento_porcentaje: detalle.descuento_porcentaje || 0,
                producto: detalle.producto,
              },
            }))
          ),
      ]
    : [];

  if (!hojaRutaId) return null;

  const getNextEstado = (current: HojaRutaEstado): HojaRutaEstado | null => {
    switch (current) {
      case 'planificada': return 'en_carga';
      case 'en_carga': return null; // requiere confirmación del responsable o forzado manual
      case 'carga_confirmada': return 'en_ruta';
      case 'en_ruta': return 'completada';
      default: return null;
    }
  };

  const handleCambiarEstadoHoja = async () => {
    if (!hojaRuta) return;
    const nextEstado = getNextEstado(hojaRuta.estado);
    if (nextEstado) {
      await cambiarEstado.mutateAsync({ id: hojaRuta.id, estado: nextEstado });
    }
  };

  const handleEstadoParada = async (paradaId: string, estado: ParadaEstado, pedidoDetalles: any[] = []) => {
    if (estado === 'entrega_parcial') {
      setDevolucionDialog({
        open: true,
        paradaId,
        marcarParcialAlGuardar: true,
        pedidoDetalles,
      });
      return;
    }

    await actualizarParada.mutateAsync({ id: paradaId, estado });
  };

  const handleForzarConfirmacion = async () => {
    if (!hojaRuta) return;
    if (!confirm('¿Confirmar manualmente la carga sin esperar al responsable en la app?\n\nQuedará registrado como confirmación forzada desde el sistema web.')) return;
    await cambiarEstado.mutateAsync({ id: hojaRuta.id, estado: 'carga_confirmada', forzada: true });
  };

  const handleEliminarParada = async (paradaId: string) => {
    if (confirm('¿Eliminar esta parada de la hoja de ruta?')) {
      await eliminarParada.mutateAsync(paradaId);
    }
  };

  const formatDateTime = (value?: string | null) => value
    ? format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: es })
    : '-';

  const formatMoney = (value: number) =>
    `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const eventosHistoria = hojaRuta ? [
    {
      fecha: hojaRuta.created_at,
      titulo: 'Hoja de ruta creada',
      detalle: `Se armó la hoja #${hojaRuta.numero_hoja} con ${hojaRuta.paradas?.length || 0} paradas. Chofer: ${hojaRuta.chofer?.nombre || '-'}, vehículo: ${hojaRuta.vehiculo?.patente || '-'}.`,
    },
    ...(hojaRuta.carga_confirmada_at ? [{
      fecha: hojaRuta.carga_confirmada_at,
      titulo: hojaRuta.carga_forzada ? 'Carga confirmada manualmente' : 'Carga confirmada',
      detalle: hojaRuta.carga_forzada ? 'La carga fue confirmada desde el sistema web.' : 'El responsable confirmó la carga de la hoja.',
    }] : []),
    ...(hojaRuta.hora_salida_real ? [{
      fecha: hojaRuta.hora_salida_real,
      titulo: 'Ruta iniciada',
      detalle: `Salida real registrada. Km inicial: ${hojaRuta.km_inicial ?? '-'}.`,
    }] : []),
    ...((hojaRuta.paradas || []).flatMap((parada: any) => {
      const cobrosParada = (cobros || []).filter((c: any) => c.parada?.id === parada.id);
      const devolucionesParada = productosRechazadosControl.filter((d: any) => (d.parada_id || d.parada?.id) === parada.id);
      const totalOriginal = Number(parada.pedido?.total) || 0;
      const totalDevoluciones = devolucionesParada.reduce((sum: number, d: any) => {
        const precio = Number(d.pedido_detalle?.precio_unitario) || 0;
        const descuento = Number(d.pedido_detalle?.descuento_porcentaje) || 0;
        return sum + ((Number(d.cantidad) || 0) * precio * (1 - descuento / 100));
      }, 0);
      const totalEsperado = getTotalEsperadoParada(parada.id, parada.estado, totalOriginal);
      const totalCobrado = cobrosParada.reduce((sum: number, c: any) => sum + (Number(c.monto) || 0), 0);
      const saldo = Math.max(totalEsperado - totalCobrado, 0);
      const estadoEntrega = estadoParadaConfig[parada.estado as ParadaEstado]?.label || parada.estado;
      const estadoCobranza = parada.estado === 'rechazado' || parada.estado === 'no_entregado'
        ? 'No corresponde cobrar por rechazo/no entrega'
        : totalEsperado <= 0
          ? 'Sin importe a cobrar'
          : totalCobrado >= totalEsperado
            ? 'Cobranza completa'
            : totalCobrado > 0
              ? 'Cobranza parcial'
              : 'Sin cobranza registrada';
      const detalleCobros = cobrosParada.length > 0
        ? cobrosParada.map((c: any) => `${formatDateTime(c.created_at)} ${c.forma_pago?.nombre || c.medio_pago || 'Efectivo'} ${formatMoney(Number(c.monto) || 0)}${c.referencia ? ` ref. ${c.referencia}` : ''}`).join(' | ')
        : 'No hubo pagos registrados';
      return [
        {
          fecha: parada.created_at,
          titulo: `Parada ${parada.orden} asignada`,
          detalle: `Pedido #${parada.pedido?.numero_pedido || '-'} · Cliente: ${parada.pedido?.cliente?.nombre || '-'} · Fecha pedido: ${parada.pedido?.fecha_pedido ? formatDateTime(parada.pedido.fecha_pedido) : '-'} · Importe original: ${formatMoney(totalOriginal)}.`,
        },
        {
          fecha: parada.hora_salida || parada.hora_llegada || parada.updated_at || parada.created_at,
          titulo: `Resumen de parada ${parada.orden}: ${estadoEntrega}`,
          detalle: `Cliente: ${parada.pedido?.cliente?.nombre || '-'} · Pedido #${parada.pedido?.numero_pedido || '-'} · Llegada: ${formatDateTime(parada.hora_llegada)} · Salida: ${formatDateTime(parada.hora_salida)} · Estado entrega: ${estadoEntrega} · Importe original: ${formatMoney(totalOriginal)} · Rechazos/devoluciones: ${formatMoney(totalDevoluciones)} · Neto a cobrar: ${formatMoney(totalEsperado)} · Cobrado: ${formatMoney(totalCobrado)} · Saldo: ${formatMoney(saldo)} · Estado cobranza: ${estadoCobranza} · Pagos: ${detalleCobros}${parada.observaciones ? ` · Observaciones: ${parada.observaciones}` : ''}.`,
        },
        ...(parada.hora_llegada ? [{
          fecha: parada.hora_llegada,
          titulo: `Llegada a parada ${parada.orden}`,
          detalle: `Cliente: ${parada.pedido?.cliente?.nombre || '-'} · Hora de llegada: ${formatDateTime(parada.hora_llegada)} · Estado actual: ${estadoEntrega} · Importe esperado al llegar: ${formatMoney(totalEsperado)}.`,
        }] : []),
        ...devolucionesParada.map((d: any) => {
          const precio = d.pedido_detalle?.precio_unitario || 0;
          const descuento = d.pedido_detalle?.descuento_porcentaje || 0;
          const importe = (Number(d.cantidad) || 0) * precio * (1 - descuento / 100);
          return {
            fecha: d.created_at,
            titulo: `Producto rechazado en parada ${parada.orden}`,
            detalle: `${d.pedido_detalle?.producto?.codigo_articulo || '-'} · ${d.pedido_detalle?.producto?.descripcion || 'Producto'} · Cantidad: ${d.cantidad} · Importe: ${formatMoney(importe)} · Motivo: ${(d.motivo || 'Sin motivo').replace(/_/g, ' ')}${d.detalle_motivo ? ` · Detalle: ${d.detalle_motivo}` : ''}.`,
          };
        }),
        ...cobrosParada.map((c: any) => ({
          fecha: c.created_at,
          titulo: `Cobro registrado en parada ${parada.orden}`,
          detalle: `Fecha/hora: ${formatDateTime(c.created_at)} · Cliente: ${parada.pedido?.cliente?.nombre || '-'} · Pedido #${parada.pedido?.numero_pedido || '-'} · Monto cobrado: ${formatMoney(Number(c.monto) || 0)} · Forma de pago: ${c.forma_pago?.nombre || c.medio_pago || 'Efectivo'} · Neto a cobrar de la parada: ${formatMoney(totalEsperado)} · Total cobrado en la parada: ${formatMoney(totalCobrado)} · Saldo luego de cobranzas: ${formatMoney(saldo)}${c.referencia ? ` · Referencia: ${c.referencia}` : ''}${c.observaciones ? ` · Obs.: ${c.observaciones}` : ''}.`,
        })),
        ...(parada.hora_salida ? [{
          fecha: parada.hora_salida,
          titulo: `Parada ${parada.orden} finalizada`,
          detalle: `Fecha/hora salida: ${formatDateTime(parada.hora_salida)} · Resultado: ${estadoEntrega} · Cobranza: ${estadoCobranza} · Neto a cobrar: ${formatMoney(totalEsperado)} · Cobrado: ${formatMoney(totalCobrado)} · Saldo: ${formatMoney(saldo)}${parada.observaciones ? ` · Observaciones: ${parada.observaciones}` : ''}.`,
        }] : []),
      ];
    })),
    ...(rendicionExistente ? [{
      fecha: rendicionExistente.fecha_aprobacion || rendicionExistente.updated_at || rendicionExistente.created_at,
      titulo: 'Rendición registrada',
      detalle: `Estado: ${rendicionExistente.estado || '-'} · Diferencia: ${formatMoney(Number(rendicionExistente.diferencia) || 0)} · Efectivo: ${formatMoney(Number(rendicionExistente.total_efectivo) || 0)} · Tarjeta: ${formatMoney(Number(rendicionExistente.total_tarjeta) || 0)}.`,
    }] : []),
    ...(hojaRuta.hora_regreso ? [{
      fecha: hojaRuta.hora_regreso,
      titulo: 'Ruta finalizada',
      detalle: `Regreso registrado. Km final: ${hojaRuta.km_final ?? '-'}.`,
    }] : []),
  ].filter((e) => e.fecha).sort((a, b) => new Date(a.fecha as string).getTime() - new Date(b.fecha as string).getTime()) : [];

  type CobroListado = { monto?: number | null; medio_pago?: string | null; parada_id?: string | null; parada?: { id?: string | null } | null; forma_pago?: { nombre?: string | null } | null };
  type DevolucionListado = { cantidad?: number | null; parada_id?: string | null; parada?: { id?: string | null } | null; pedido_detalle?: { precio_unitario?: number | null; descuento_porcentaje?: number | null } | null };
  type ParadaListado = NonNullable<HojaRuta['paradas']>[number];
  type ItemListado = { parada: ParadaListado; aCobrar: number; rechazado: number; cobrado: number; saldo: number; medios: Array<[string, number]> };

  const imprimirListadoParadas = (hoja: HojaRuta) => {
    const ventana = window.open('', '_blank', 'width=900,height=600');
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
      return;
    }

    const fechaHoja = format(new Date(hoja.fecha), 'dd/MM/yyyy', { locale: es });

    const escapeHtml = (value: unknown) => String(value ?? '-')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const formatNumero = (num: number) => {
      const pv = '00001';
      const nro = num.toString().padStart(8, '0');
      return `B ${pv}-${nro}`;
    };

    const formatCurrency = (v: number) =>
      new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

    const getCobrosParadaListado = (paradaId: string) => ((cobros || []) as CobroListado[])
      .filter((c) => (c.parada_id || c.parada?.id) === paradaId);

    const getDevolucionImporteListado = (parada: ParadaListado) => {
      const totalOriginal = Number(parada.pedido?.total) || 0;
      if (parada.estado === 'rechazado' || parada.estado === 'no_entregado') return totalOriginal;
      return (productosRechazadosControl as DevolucionListado[])
        .filter((d) => (d.parada_id || d.parada?.id) === parada.id)
        .reduce((sum, d) => {
          const precio = Number(d.pedido_detalle?.precio_unitario) || 0;
          const descuento = Number(d.pedido_detalle?.descuento_porcentaje) || 0;
          return sum + ((Number(d.cantidad) || 0) * precio * (1 - descuento / 100));
        }, 0);
    };

    const paradas = (hoja.paradas || [])
      .filter((p): p is ParadaListado & { pedido: NonNullable<ParadaListado['pedido']> } => Boolean(p.pedido))
      .map((parada): ItemListado => {
        const cobrosParada = getCobrosParadaListado(parada.id);
        const mediosMap = cobrosParada.reduce((map: Map<string, number>, c) => {
          const medio = c.forma_pago?.nombre || c.medio_pago || 'Efectivo';
          map.set(medio, (map.get(medio) || 0) + (Number(c.monto) || 0));
          return map;
        }, new Map<string, number>());
        const aCobrar = Number(parada.pedido?.total) || 0;
        const rechazado = getDevolucionImporteListado(parada);
        const cobrado = Array.from(mediosMap.values()).reduce((sum, monto) => sum + monto, 0);
        return {
          parada,
          aCobrar,
          rechazado,
          cobrado,
          saldo: Math.max(aCobrar - rechazado - cobrado, 0),
          medios: Array.from(mediosMap.entries()),
        };
      });
    const FILAS_POR_PAGINA = 38;

    const generarFilas = (items: ItemListado[], startIndex: number) => items.map((item, i: number) => {
      const parada = item.parada;
      const pedido = parada.pedido;
      const cliente = pedido.cliente;
      const idx = startIndex + i;
      const fechaRemito = format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy', { locale: es });
      const nroRemito = formatNumero(pedido.numero_pedido);
      const codCliente = cliente?.codigo_cliente || '-';
      const razonSocial = cliente?.nombre || '-';
      const mediosPago = item.medios.length > 0
        ? item.medios.map(([medio, monto]: [string, number]) => `${escapeHtml(medio)}: $ ${formatCurrency(monto)}`).join('<br>')
        : '-';

      return `
        <tr${idx % 2 === 1 ? ' style="background:#f7f7f7;"' : ''}>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700; text-align:center;">${idx + 1}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700;">${fechaRemito}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700; font-family:'Courier New',monospace;">${nroRemito}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700; font-family:'Courier New',monospace;">${escapeHtml(codCliente)}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700;">${escapeHtml(razonSocial)}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:800; text-align:right; font-family:'Courier New',monospace;">$ ${formatCurrency(item.aCobrar)}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:800; text-align:right; font-family:'Courier New',monospace;">$ ${formatCurrency(item.rechazado)}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:800; text-align:right; font-family:'Courier New',monospace;">$ ${formatCurrency(item.cobrado)}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:800; text-align:right; font-family:'Courier New',monospace;">$ ${formatCurrency(item.saldo)}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:9px; font-weight:700; line-height:1.25;">${mediosPago}</td>
        </tr>
      `;
    }).join('');

    const totalACobrar = paradas.reduce((sum, item) => sum + item.aCobrar, 0);
    const totalRechazado = paradas.reduce((sum, item) => sum + item.rechazado, 0);
    const totalCobrado = paradas.reduce((sum, item) => sum + item.cobrado, 0);
    const totalSaldo = paradas.reduce((sum, item) => sum + item.saldo, 0);
    const totalesMedios = paradas.reduce((map: Map<string, number>, item) => {
      item.medios.forEach(([medio, monto]: [string, number]) => {
        map.set(medio, (map.get(medio) || 0) + monto);
      });
      return map;
    }, new Map<string, number>());
    const totalesMediosHTML = Array.from(totalesMedios.entries()).map(([medio, monto]) => `
      <tr>
        <td>${escapeHtml(medio)}</td>
        <td class="right">$ ${formatCurrency(monto)}</td>
      </tr>
    `).join('') || '<tr><td colspan="2">Sin cobros registrados</td></tr>';

    // Dividir en páginas de 50 filas
    const paginas: ItemListado[][] = [];
    for (let i = 0; i < paradas.length; i += FILAS_POR_PAGINA) {
      paginas.push(paradas.slice(i, i + FILAS_POR_PAGINA));
    }

    const theadHTML = `
      <thead>
        <tr>
          <th class="center" style="width:25px;">#</th>
          <th style="width:70px;">Fecha</th>
          <th style="width:120px;">Nº Remito</th>
          <th style="width:55px;">Cód. Cli.</th>
          <th>Razón Social</th>
          <th class="right" style="width:82px;">A cobrar</th>
          <th class="right" style="width:82px;">Rechazado</th>
          <th class="right" style="width:82px;">Cobrado</th>
          <th class="right" style="width:82px;">Saldo</th>
          <th style="width:150px;">Medios de pago</th>
        </tr>
      </thead>`;

    const headerHTML = `
      <div class="header">
        <div class="header-title">COBRANZAS POR CLIENTE</div>
        <div class="header-info">
          <span>Hoja de Ruta #${hoja.numero_hoja}</span>
          <span>Fecha: ${fechaHoja}</span>
          <span>Chofer: ${hoja.chofer?.nombre || '-'} | Vehículo: ${hoja.vehiculo?.patente || '-'}</span>
        </div>
      </div>`;

    const paginasHTML = paginas.map((pagina, pIdx) => {
      const isLast = pIdx === paginas.length - 1;
      return `
        <div class="page-container${!isLast ? ' page-break' : ''}">
          <div class="container">
            ${headerHTML}
            ${paginas.length > 1 ? `<div style="text-align:right;padding:2px 8px;font-size:9px;color:#666;">Página ${pIdx + 1} de ${paginas.length}</div>` : ''}
            <table>
              ${theadHTML}
              <tbody>
                ${generarFilas(pagina, pIdx * FILAS_POR_PAGINA)}
              </tbody>
            </table>
            ${isLast ? `
              <div class="total-row">
                <span>A COBRAR: $ ${formatCurrency(totalACobrar)}</span>
                <span>RECHAZADO: $ ${formatCurrency(totalRechazado)}</span>
                <span>COBRADO: $ ${formatCurrency(totalCobrado)}</span>
                <span>SALDO: $ ${formatCurrency(totalSaldo)}</span>
              </div>
              <div class="medios-summary">
                <div class="summary-title">TOTAL COBRADO POR MEDIO DE PAGO</div>
                <table>
                  <tbody>${totalesMediosHTML}</tbody>
                </table>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Listado Paradas - Ruta #${hoja.numero_hoja}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4 portrait; margin: 8mm; }
            .page-break { page-break-after: always; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            font-size: 11px;
            font-weight: 700;
            color: #1a1a1a;
            max-width: 800px;
            margin: 0 auto;
            padding: 8px;
          }
          .page-container { margin-bottom: 16px; }
          .container { border: 2px solid #222; border-radius: 3px; overflow: hidden; }
          .header {
            display: flex; align-items: center; justify-content: space-between;
            border-bottom: 2px solid #222; background: #f5f5f5; padding: 6px 10px;
          }
          .header-title { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
          .header-info { font-size: 11px; font-weight: 800; text-align: right; }
          .header-info span { display: block; }
          table { width: 100%; border-collapse: collapse; }
          thead th {
            background: #222; color: #fff; padding: 3px 4px; text-align: left;
            font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
          }
          thead th.right { text-align: right; }
          thead th.center { text-align: center; }
          .total-row {
            display: flex; justify-content: flex-end; align-items: center; gap: 12px; flex-wrap: wrap;
            border-top: 2px solid #222; background: #eee; padding: 6px 10px;
          }
          .total-row span { font-size: 12px; font-weight: 900; font-family: 'Courier New', monospace; }
          .medios-summary { border-top: 1px solid #222; padding: 6px 10px; background: #fafafa; }
          .summary-title { font-size: 11px; font-weight: 900; margin-bottom: 4px; }
          .medios-summary table { width: 280px; margin-left: auto; border-collapse: collapse; }
          .medios-summary td { padding: 2px 4px; border-bottom: 1px solid #d0d0d0; font-size: 10px; font-weight: 800; }
          .right { text-align: right; font-family: 'Courier New', monospace; }
          .print-button {
            position: fixed; bottom: 20px; right: 20px; padding: 10px 20px;
            background: #2563eb; color: white; border: none; border-radius: 6px;
            cursor: pointer; font-size: 13px; font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          .print-button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        ${paginasHTML}
        <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
      </body>
      </html>
    `;

    ventana.document.write(html);
    ventana.document.close();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Hoja de Ruta #{hojaRuta?.numero_hoja || '...'}
              </h2>
              <p className="text-sm text-muted-foreground">Detalle y gestión de entregas</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Cerrar">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="w-full px-6 py-6">

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : hojaRuta ? (
          <div className="space-y-6 mt-6">
            {/* Estado badge */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${estadoHojaConfig[hojaRuta.estado].className}`}>
                  {estadoHojaConfig[hojaRuta.estado].label}
                </span>
                {hojaRuta.estado === 'en_carga' && (
                  <span className="text-xs text-muted-foreground">
                    Esperando que el responsable confirme la carga desde la app.
                  </span>
                )}
                {hojaRuta.estado === 'carga_confirmada' && hojaRuta.carga_confirmada_at && (
                  <span className="text-xs text-muted-foreground">
                    Confirmada el {format(new Date(hojaRuta.carga_confirmada_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    {hojaRuta.carga_forzada ? ' · Confirmación manual' : ' · Confirmada por el responsable'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHistoriaOpen(true)}
                  disabled={!hojaRuta}
                >
                  <History className="h-4 w-4 mr-2" />
                  Historia
                </Button>
                {hojaRuta.estado === 'en_carga' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleForzarConfirmacion}
                    disabled={cambiarEstado.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Forzar confirmación
                  </Button>
                )}
                {hojaRuta.estado === 'en_carga' && (hojaRuta.paradas?.length || 0) > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRefacturarOpen(true)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Refacturar hoja
                  </Button>
                )}
                {hojaRuta.estado !== 'completada' && hojaRuta.estado !== 'cancelada' && hojaRuta.estado !== 'en_carga' && (
                  <Button
                    size="sm"
                    onClick={handleCambiarEstadoHoja}
                    disabled={cambiarEstado.isPending}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {hojaRuta.estado === 'planificada' && 'Iniciar Carga'}
                    {hojaRuta.estado === 'carga_confirmada' && 'Iniciar Ruta'}
                    {hojaRuta.estado === 'en_ruta' && 'Completar'}
                  </Button>
                )}
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {format(new Date(hojaRuta.fecha), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Vehículo</p>
                  <p className="font-medium">{hojaRuta.vehiculo?.patente || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Chofer</p>
                  <p className="font-medium">{hojaRuta.chofer?.nombre || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Responsable</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{hojaRuta.responsable?.nombre || '-'}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleAbrirReasignar}
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Salida Est.</p>
                  <p className="font-medium">{hojaRuta.hora_salida_estimada || '-'}</p>
                </div>
              </div>
            </div>

            {/* Hoja de Carga - visible en planificada/en_carga */}
            {(hojaRuta.estado === 'planificada' || hojaRuta.estado === 'en_carga') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Hoja de Carga ({productosCarga.length} productos)
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {hojaRuta.paradas?.length || 0} paradas asignadas
                  </Badge>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Código</th>
                        <th className="px-3 py-2 text-left font-medium">Descripción</th>
                        <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y max-h-[400px]">
                      {productosCarga.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                            No hay productos para cargar
                          </td>
                        </tr>
                      ) : (
                        productosCarga.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 font-mono text-xs">{p.codigo}</td>
                            <td className="px-3 py-2">{p.descripcion}</td>
                            <td className="px-3 py-2 text-right font-semibold">{p.cantidad_total}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Los pedidos individuales estarán disponibles para gestionar cuando se inicie la ruta.
                </p>
              </div>
            )}

            {/* Paradas - visible solo cuando la ruta está en curso o terminada */}
            {(hojaRuta.estado === 'en_ruta' || hojaRuta.estado === 'completada' || hojaRuta.estado === 'cancelada') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Paradas ({hojaRuta.paradas?.length || 0})
                </h3>
                {hojaRuta.paradas && hojaRuta.paradas.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => imprimirListadoParadas(hojaRuta)}
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir Listado
                  </Button>
                )}
              </div>
              
              <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                {!hojaRuta.paradas || hojaRuta.paradas.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No hay paradas asignadas
                  </div>
                ) : (
                  hojaRuta.paradas.map((parada, index) => {
                    const estadoConfig = estadoParadaConfig[parada.estado];
                    const IconEstado = estadoConfig.icon;
                    const cobrosParada = (cobros || []).filter((c) => ((c as { parada_id?: string; parada?: { id?: string } }).parada_id || (c as { parada?: { id?: string } }).parada?.id) === parada.id);
                    const totalCobradoParada = cobrosParada.reduce((sum: number, c) => sum + (Number((c as { monto?: number }).monto) || 0), 0);
                    const totalOriginalParada = Number(parada.pedido?.total) || 0;
                    const devolucionImporteParada = parada.estado === 'rechazado' || parada.estado === 'no_entregado'
                      ? totalOriginalParada
                      : getDevolucionesPorParada(parada.id);
                    const totalEsperadoParadaDetalle = parada.pedido
                      ? getTotalEsperadoParada(parada.id, parada.estado, totalOriginalParada)
                      : 0;
                    const saldoParada = Math.max(totalEsperadoParadaDetalle - totalCobradoParada, 0);
                    const formasPagoParada = Array.from(cobrosParada.reduce((map: Map<string, number>, c) => {
                      const cobro = c as { forma_pago?: { nombre?: string }; medio_pago?: string; monto?: number };
                      const forma = cobro.forma_pago?.nombre || cobro.medio_pago || 'Efectivo';
                      map.set(forma, (map.get(forma) || 0) + (Number(cobro.monto) || 0));
                      return map;
                    }, new Map<string, number>()).entries());
                    
                    return (
                      <div key={parada.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">
                            {index + 1}
                          </span>
                          
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold">
                                #{parada.pedido?.numero_pedido}
                              </span>
                              <IconEstado className={`h-4 w-4 ${estadoConfig.className}`} />
                              <span className={`text-sm ${estadoConfig.className}`}>
                                {estadoConfig.label}
                              </span>
                            </div>
                            
                            <p className="font-medium">
                              {parada.pedido?.cliente?.nombre}
                            </p>
                            
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {parada.pedido?.cliente?.direccion && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {parada.pedido.cliente.direccion}
                                </span>
                              )}
                              {parada.pedido?.cliente?.telefono && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {parada.pedido.cliente.telefono}
                                </span>
                              )}
                            </div>

                            {parada.pedido && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-md border bg-muted/30 p-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground">Cobrado</p>
                                  <p className="font-semibold">{formatMoney(totalCobradoParada)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Forma de pago</p>
                                  <p className="font-semibold">
                                    {formasPagoParada.length > 0
                                      ? formasPagoParada.map(([forma, monto]) => `${forma}: ${formatMoney(monto)}`).join(' · ')
                                      : 'Sin cobro'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Devolución</p>
                                  <p className="font-semibold">{formatMoney(devolucionImporteParada)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Saldo</p>
                                  <p className="font-semibold">{formatMoney(saldoParada)}</p>
                                </div>
                              </div>
                            )}

                            {/* Actions for parada */}
                            {hojaRuta.estado === 'en_ruta' && parada.estado === 'pendiente' && (
                              <div className="flex flex-wrap gap-2 pt-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleEstadoParada(parada.id, 'entregado')}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Entregado
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleEstadoParada(parada.id, 'entrega_parcial', parada.pedido?.detalles || [])}
                                >
                                  <AlertTriangle className="h-4 w-4 mr-1" />
                                  Parcial
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleEstadoParada(parada.id, 'rechazado')}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Rechazado
                                </Button>
                              </div>
                            )}

                            {/* Botones de cobro y devolución - visible cuando está en ruta o entregado */}
                            {(hojaRuta.estado === 'en_ruta' || hojaRuta.estado === 'completada') && 
                             ['entregado', 'entrega_parcial', 'rechazado'].includes(parada.estado) && parada.pedido && (() => {
                              const totalNeto = getTotalEsperadoParada(parada.id, parada.estado, parada.pedido!.total);
                              const cobrado = getCobradoPorParada(parada.id);
                              const pedidoCobradoCompleto = cobrado >= totalNeto && totalNeto > 0;
                              
                              return (
                              <div className="pt-2 flex flex-wrap items-center gap-2">
                                {cobrado > 0 && (
                                  <Badge variant={pedidoCobradoCompleto ? "default" : "secondary"} className={`text-xs ${pedidoCobradoCompleto ? 'bg-green-600' : ''}`}>
                                    <Banknote className="h-3 w-3 mr-1" />
                                    {pedidoCobradoCompleto ? 'Cobrado ✓' : `Cobrado: $${cobrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                  </Badge>
                                )}
                                
                                {/* Botón Cobrar - oculto si ya está cobrado completo */}
                                {!pedidoCobradoCompleto && ['entregado', 'entrega_parcial'].includes(parada.estado) && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => setCobroDialog({
                                      open: true,
                                      paradaId: parada.id,
                                      pedidoId: parada.pedido!.id,
                                      totalPedido: totalNeto,
                                      montoCobrado: cobrado,
                                    })}
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    {cobrado > 0 ? 'Agregar Cobro' : 'Cobrar'}
                                  </Button>
                                )}

                                {/* Botón Devoluciones - oculto si ya está cobrado completo */}
                                {!pedidoCobradoCompleto && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDevolucionDialog({
                                      open: true,
                                      paradaId: parada.id,
                                      marcarParcialAlGuardar: false,
                                      pedidoDetalles: parada.pedido?.detalles || [],
                                    })}
                                  >
                                    <PackageX className="h-4 w-4 mr-1" />
                                    Devoluciones
                                  </Button>
                                )}
                              </div>
                              );
                            })()}
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-semibold">
                              ${parada.pedido?.total?.toLocaleString('es-AR')}
                            </p>
                            {parada.estado === 'rechazado' && parada.pedido && (
                              <div className="mt-1">
                                <p className="text-xs text-destructive line-through">
                                  ${parada.pedido.total?.toLocaleString('es-AR')}
                                </p>
                                <p className="text-sm font-bold text-destructive">
                                  $0,00
                                </p>
                                <p className="text-xs text-destructive">
                                  Pedido rechazado
                                </p>
                              </div>
                            )}
                            {parada.estado !== 'rechazado' && getDevolucionesPorParada(parada.id) > 0 && (
                              <div className="mt-1">
                                <p className="text-xs text-destructive line-through">
                                  ${parada.pedido?.total?.toLocaleString('es-AR')}
                                </p>
                                <p className="text-sm font-bold text-primary">
                                  ${getTotalNeto(parada.id, parada.pedido?.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-amber-600">
                                  -${getDevolucionesPorParada(parada.id).toLocaleString('es-AR', { minimumFractionDigits: 2 })} dev.
                                </p>
                              </div>
                            )}
                            {hojaRuta.estado === 'planificada' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive mt-2"
                                onClick={() => handleEliminarParada(parada.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="space-y-6 lg:col-span-1">

            {/* Sección de Devoluciones Registradas */}
            {productosRechazadosControl.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                    Productos Rechazados ({productosRechazadosControl.length})
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => imprimirDevolucionesHojaRuta(hojaRuta, productosRechazadosControl)}
                    title="Imprimir detalle para control posterior"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir control
                  </Button>
                </div>
                
                <div className="border border-amber-200 rounded-lg divide-y bg-amber-50/50 max-h-[200px] overflow-y-auto">
                  {productosRechazadosControl.map((devolucion: any) => {
                    const precio = devolucion.pedido_detalle?.precio_unitario || 0;
                    const descuento = devolucion.pedido_detalle?.descuento_porcentaje || 0;
                    const precioNeto = precio * (1 - descuento / 100);
                    const valorDevolucion = devolucion.cantidad * precioNeto;
                    
                    return (
                      <div key={devolucion.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {devolucion.pedido_detalle?.producto?.descripcion || 'Producto'}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {devolucion.cantidad} un.
                            </Badge>
                            {valorDevolucion > 0 && (
                              <span className="text-sm font-semibold text-destructive">
                                -${valorDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="capitalize">
                            {devolucion.motivo?.replace(/_/g, ' ') || 'Sin motivo'}
                          </span>
                          <span>
                            {format(new Date(devolucion.created_at), 'dd/MM HH:mm', { locale: es })}
                          </span>
                        </div>
                        {devolucion.detalle_motivo && (
                          <p className="text-xs text-muted-foreground italic">
                            {devolucion.detalle_motivo}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Total devoluciones */}
                <div className="flex justify-end px-3">
                  <span className="text-sm font-bold text-destructive">
                    {'Total devoluciones: -$'}
                    {productosRechazadosControl.reduce((sum: number, d: any) => {
                      const precio = d.pedido_detalle?.precio_unitario || 0;
                      const descuento = d.pedido_detalle?.descuento_porcentaje || 0;
                      return sum + (d.cantidad * precio * (1 - descuento / 100));
                    }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Sección de Cobros Registrados */}
            {cobros && cobros.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  Cobros Registrados ({cobros.length})
                </h3>
                
                <div className="border border-green-200 rounded-lg divide-y bg-green-50/50 max-h-[200px] overflow-y-auto">
                  {cobros.map((cobro: any) => (
                    <div key={cobro.id} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">
                          ${cobro.monto?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {cobro.forma_pago?.nombre || cobro.medio_pago || 'Efectivo'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(cobro.created_at), 'dd/MM HH:mm', { locale: es })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón de Rendición - visible cuando la ruta está en curso o completada */}
            {(hojaRuta.estado === 'en_ruta' || hojaRuta.estado === 'completada') && (
              <div className="pt-4 border-t">
                {rendicionExistente ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-600">Rendición registrada</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setRendicionOpen(true)}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Ver / Imprimir Rendición
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full"
                    onClick={() => setRendicionOpen(true)}
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    Rendición de Cobranza
                  </Button>
                )}
              </div>
            )}
            </div>
            </div>
            )}
          </div>
        ) : null}
          </div>
        </div>
      )}

      {/* Diálogo de Cobro */}
      <RegistrarCobroDialog
        open={cobroDialog.open}
        onOpenChange={(open) => setCobroDialog({ ...cobroDialog, open })}
        hojaRutaId={hojaRutaId}
        paradaId={cobroDialog.paradaId}
        pedidoId={cobroDialog.pedidoId}
        totalPedido={cobroDialog.totalPedido}
        montoCobrado={cobroDialog.montoCobrado}
        onSuccess={() => refetch()}
      />

      {/* Diálogo de Rendición */}
      {hojaRuta && (
        <RendicionHojaRutaDialog
          open={rendicionOpen}
          onOpenChange={setRendicionOpen}
          hojaRutaId={hojaRutaId}
          numeroHoja={hojaRuta.numero_hoja}
          onSuccess={async () => {
            await refetch();
          }}
        />
      )}

      {/* Diálogo de Devoluciones */}
      {hojaRutaId && (
        <RegistrarDevolucionDialog
          open={devolucionDialog.open}
          onOpenChange={(open) => setDevolucionDialog({ ...devolucionDialog, open })}
          hojaRutaId={hojaRutaId}
          paradaId={devolucionDialog.paradaId}
          pedidoDetalles={devolucionDialog.pedidoDetalles}
          onSuccess={async () => {
            if (devolucionDialog.marcarParcialAlGuardar && devolucionDialog.paradaId) {
              await actualizarParada.mutateAsync({ id: devolucionDialog.paradaId, estado: 'entrega_parcial' });
            }
            await refetch();
          }}
        />
      )}

      {hojaRuta && (
        <RefacturarHojaRutaDialog
          open={refacturarOpen}
          onOpenChange={setRefacturarOpen}
          hojaRuta={hojaRuta}
          productosCarga={productosCarga || []}
          onSuccess={async () => {
            await refetch();
          }}
        />
      )}

      <Dialog open={historiaOpen} onOpenChange={setHistoriaOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historia de hoja de ruta #{hojaRuta?.numero_hoja || ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm rounded-lg border bg-muted/30 p-3">
            <div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-medium">{hojaRuta ? format(new Date(hojaRuta.fecha), 'dd/MM/yyyy', { locale: es }) : '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Chofer</p><p className="font-medium">{hojaRuta?.chofer?.nombre || '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Vehículo</p><p className="font-medium">{hojaRuta?.vehiculo?.patente || '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Estado</p><p className="font-medium">{hojaRuta ? estadoHojaConfig[hojaRuta.estado]?.label : '-'}</p></div>
          </div>
          <div className="space-y-3 py-2">
            {eventosHistoria.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No hay movimientos registrados.</div>
            ) : (
              eventosHistoria.map((evento, index) => (
                <div key={`${evento.fecha}-${index}`} className="flex gap-3 rounded-lg border p-3">
                  <div className="flex flex-col items-center">
                    <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{index + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                      <p className="font-semibold">{evento.titulo}</p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(evento.fecha)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{evento.detalle}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de reasignación de responsable */}
      <Dialog open={reasignarOpen} onOpenChange={setReasignarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reasignar responsable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="responsable-select">Responsable</Label>
            <select
              id="responsable-select"
              value={nuevoResponsableId}
              onChange={(e) => setNuevoResponsableId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Sin responsable</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Los pedidos de esta hoja le aparecerán al responsable seleccionado en la app móvil.
              Si no se elige responsable, los verá el chofer asignado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasignarOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarReasignar}
              disabled={actualizarHojaRuta.isPending}
            >
              {actualizarHojaRuta.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
