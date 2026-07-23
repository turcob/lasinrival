import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';
import { Eye, XCircle, FileText, Download, Printer, Users, Calendar, Banknote, CreditCard, Landmark, ClipboardList, UserCheck, Globe, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, FileMinus } from 'lucide-react';
import { imprimirTicketFactura } from '@/lib/imprimirTicketFactura';
import { NotaCreditoParcialWizard } from '@/components/facturacion/NotaCreditoParcialWizard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface ComprobanteAfip {
  id: string;
  tipo_comprobante: number;
  punto_venta: number;
  numero_comprobante: number;
  cae: string;
  cae_vencimiento: string;
  importe_total: number;
  importe_neto: number;
  importe_iva: number;
  doc_tipo: number;
  doc_nro: number;
  fecha_emision: string;
}

interface Venta {
  id: string;
  numero_comprobante: number;
  fecha: string;
  subtotal: number;
  descuento: number;
  total: number;
  anulada: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  usuario_id: string;
  cliente_id: string | null;
  caja_id: string | null;
  estado: string;
  clientes?: { nombre: string; dni_cuit: string | null; condicion_iva?: number; vendedor_id?: string | null } | null;
  profiles?: { nombre: string } | null;
  comprobantes_afip?: ComprobanteAfip[] | null;
  // Synthetic-row markers for web/reparto pedidos shown alongside real ventas
  _es_pedido?: boolean;
  _pedido_id?: string;
  _tipo_pedido?: string;
  _numero_pedido?: number;
  _pedido_estado?: string;
}

interface VentaDetalle {
  id: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  productos?: { codigo_articulo: string; descripcion: string } | null;
}

interface VentaPago {
  id: string;
  monto: number;
  formas_pago?: { nombre: string } | null;
}

const CONDICIONES_IVA: Record<number, string> = {
  1: "IVA Responsable Inscripto",
  4: "IVA Sujeto Exento",
  5: "Consumidor Final",
  6: "Responsable Monotributo",
};

const TIPOS_COMPROBANTE: Record<number, string> = {
  1: "A",
  6: "B",
  11: "C",
  3: "NCA",
  8: "NCB",
  13: "NCC",
};

export default function Ventas() {
  const { user, hasPermission, hasRole } = useAuth();
  const { config: comercioConfig, formatCuit } = useConfiguracionComercio();
  const puedeVerTodas = hasRole('admin') || hasRole('encargado') || hasRole('administracion');
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [pagosPorVenta, setPagosPorVenta] = useState<Record<string, VentaPago[]>>({});
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ id: string; nombre: string }[]>([]);
  const [origenPorVenta, setOrigenPorVenta] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [detalles, setDetalles] = useState<VentaDetalle[]>([]);
  const [pagos, setPagos] = useState<VentaPago[]>([]);

  // NC wizard state
  const [ncWizardOpen, setNcWizardOpen] = useState(false);
  const [facturaParaNc, setFacturaParaNc] = useState<any>(null);
  const [ncPreset, setNcPreset] = useState<{ alcance: 'parcial' | 'total'; anular: 'si' | 'no' }>({ alcance: 'parcial', anular: 'no' });
  
  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState<string>('todos');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [filtroOrigen, setFiltroOrigen] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('confirmada');
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);

  // RPC-based payment breakdown
  const [rpcTotales, setRpcTotales] = useState<{ totales: Record<string, number>; totalGeneral: number; countVentas: number; countPedidos: number }>({
    totales: {}, totalGeneral: 0, countVentas: 0, countPedidos: 0,
  });
  const [refreshTotales, setRefreshTotales] = useState(0);

  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<ComprobanteAfip | null>(null);
  const [reintentandoAfipId, setReintentandoAfipId] = useState<string | null>(null);
  const [facturaDetalles, setFacturaDetalles] = useState<Array<{ nombre: string; cantidad: number; precio: number; subtotal: number; descuento_porcentaje: number }>>([]);
  const [facturaEmpleado, setFacturaEmpleado] = useState<{ nombre: string; dni?: string | null } | null>(null);

  const canAnular = hasPermission('ventas', 'anular');
  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchUsuarios();
    fetchVendedores();
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page when filters or search change
  useEffect(() => {
    setPage(1);
  }, [filtroUsuario, filtroVendedor, filtroOrigen, filtroEstado, fechaDesde, fechaHasta, searchDebounced, pageSize]);

  // Fetch the paginated server-side list whenever filters/page change
  useEffect(() => {
    fetchVentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroUsuario, filtroVendedor, filtroOrigen, filtroEstado, fechaDesde, fechaHasta, searchDebounced, page, pageSize]);

  // Fetch payment breakdown via RPC whenever filters change
  useEffect(() => {
    const fetchTotales = async () => {
      const params: Record<string, any> = {
        p_estado: filtroEstado,
      };
      if (filtroUsuario !== 'todos') params.p_usuario_id = filtroUsuario;
      if (fechaDesde) params.p_fecha_desde = startOfDay(fechaDesde).toISOString();
      if (fechaHasta) params.p_fecha_hasta = endOfDay(fechaHasta).toISOString();

      const { data, error } = await supabase.rpc('get_ventas_totales_por_medio_pago', params);
      
      if (error) {
        console.error('Error fetching totales:', error);
        return;
      }

      const totales: Record<string, number> = {};
      let totalGeneral = 0;
      let countVentas = 0;
      let countPedidos = 0;

      if (data && data.length > 0) {
        totalGeneral = Number(data[0].total_general) || 0;
        countVentas = Number(data[0].count_ventas) || 0;
        countPedidos = Number(data[0].count_pedidos) || 0;
        data.forEach((row: any) => {
          if (row.forma_pago_nombre) {
            totales[row.forma_pago_nombre] = Number(row.total) || 0;
          }
        });
      }

      setRpcTotales({ totales, totalGeneral, countVentas, countPedidos });
    };

    fetchTotales();
  }, [filtroUsuario, filtroEstado, fechaDesde, fechaHasta, refreshTotales]);

  const fetchUsuarios = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre')
      .eq('estado', true)
      .order('nombre');
    setUsuarios(data || []);
  };

  const fetchVendedores = async () => {
    const { data } = await supabase
      .from('vendedores')
      .select('id, nombre')
      .order('nombre');
    setVendedores(data || []);
  };

  const fetchVentas = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        p_estado: filtroEstado,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      };
      if (filtroUsuario !== 'todos') params.p_usuario_id = filtroUsuario;
      if (filtroVendedor === 'sin_vendedor') {
        params.p_sin_vendedor = true;
      } else if (filtroVendedor !== 'todos') {
        params.p_vendedor_id = filtroVendedor;
      }
      if (filtroOrigen !== 'todos') params.p_origen = filtroOrigen;
      if (fechaDesde) params.p_fecha_desde = startOfDay(fechaDesde).toISOString();
      if (fechaHasta) params.p_fecha_hasta = endOfDay(fechaHasta).toISOString();
      if (searchDebounced) params.p_search = searchDebounced;

      const { data, error } = await supabase.rpc('get_ventas_lista', params);
      if (error) throw error;

      const rows = (data as any[]) || [];
      setTotalCount(rows.length > 0 ? Number(rows[0].total_count) || 0 : 0);

      const origenMap: Record<string, string> = {};
      const pagosMap: Record<string, VentaPago[]> = {};
      const mapped: Venta[] = rows.map((r: any) => {
        origenMap[r.id] = r.origen || 'mostrador';
        pagosMap[r.id] = (r.pagos || []).map((p: any) => ({
          id: p.id,
          monto: Number(p.monto) || 0,
          formas_pago: p.forma_pago_nombre ? { nombre: p.forma_pago_nombre } : null,
        }));
        return {
          id: r.id,
          numero_comprobante: r.numero_comprobante,
          fecha: r.fecha,
          subtotal: Number(r.subtotal) || 0,
          descuento: Number(r.descuento) || 0,
          total: Number(r.total) || 0,
          anulada: !!r.anulada,
          motivo_anulacion: r.motivo_anulacion,
          fecha_anulacion: r.fecha_anulacion,
          usuario_id: r.usuario_id,
          cliente_id: r.cliente_id,
          caja_id: r.caja_id,
          estado: r.estado,
          clientes: r.cliente_nombre
            ? {
                nombre: r.cliente_nombre,
                dni_cuit: r.cliente_dni_cuit,
                condicion_iva: r.cliente_condicion_iva,
                vendedor_id: r.cliente_vendedor_id,
              }
            : null,
          profiles: r.usuario_nombre ? { nombre: r.usuario_nombre } : null,
          comprobantes_afip: (r.afip || []) as ComprobanteAfip[],
          _es_pedido: !!r.es_pedido,
          _pedido_id: r.pedido_id || undefined,
          _tipo_pedido: r.tipo_pedido || undefined,
          _numero_pedido: r.es_pedido ? r.numero_comprobante : undefined,
          _pedido_estado: r.pedido_estado || undefined,
        };
      });

      setVentas(mapped);
      setOrigenPorVenta(origenMap);
      setPagosPorVenta(pagosMap);
    } catch (error) {
      console.error('Error fetching ventas:', error);
      toast.error('Error al cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  // Server already returns filtered + paginated rows.
  const ventasFiltradas = ventas;

  // Use the RPC payment-breakdown totals (server-side, reflects all current filters).
  const totalesPorMedioPago = rpcTotales;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getMedioPagoIcon = (nombre: string) => {
    const lower = nombre.toLowerCase();
    if (lower.includes('efectivo')) return <Banknote className="h-4 w-4" />;
    if (lower.includes('transfer')) return <Landmark className="h-4 w-4" />;
    if (lower.includes('tarjeta') || lower.includes('debito') || lower.includes('credito')) return <CreditCard className="h-4 w-4" />;
    return <Banknote className="h-4 w-4" />;
  };

  const openDetalleDialog = async (venta: Venta) => {
    setSelectedVenta(venta);
    
    try {
      if (venta._es_pedido && venta._pedido_id) {
        const { data: pdData } = await supabase
          .from('pedido_detalles')
          .select('id, cantidad_pedida, precio_unitario, descuento_porcentaje, subtotal, productos(codigo_articulo, descripcion)')
          .eq('pedido_id', venta._pedido_id);
        const mapped: VentaDetalle[] = (pdData || []).map((d: any) => ({
          id: d.id,
          cantidad: Number(d.cantidad_pedida) || 0,
          precio_unitario: Number(d.precio_unitario) || 0,
          descuento: Number(d.descuento_porcentaje) || 0,
          subtotal: Number(d.subtotal) || 0,
          productos: d.productos || null,
        }));
        setDetalles(mapped);
        setPagos([]);
        setDetalleDialogOpen(true);
        return;
      }
      const [detallesRes, pagosRes] = await Promise.all([
        supabase
          .from('venta_detalles')
          .select('*, productos(codigo_articulo, descripcion)')
          .eq('venta_id', venta.id),
        supabase
          .from('venta_pagos')
          .select('*, formas_pago(nombre)')
          .eq('venta_id', venta.id),
      ]);

      if (detallesRes.data) setDetalles(detallesRes.data);
      if (pagosRes.data) setPagos(pagosRes.data);
      setDetalleDialogOpen(true);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Error al cargar el detalle');
    }
  };

  const openFacturaDialog = async (venta: Venta) => {
    setSelectedVenta(venta);
    setSelectedFactura(venta.comprobantes_afip?.[0] || null);
    setFacturaDetalles([]);
    setFacturaEmpleado(null);
    setFacturaDialogOpen(true);

    try {
      const [detRes, ventaRes] = await Promise.all([
        supabase
          .from('venta_detalles')
          .select('cantidad, precio_unitario, descuento_porcentaje, subtotal, producto_temporal_nombre, productos(descripcion)')
          .eq('venta_id', venta.id),
        supabase
          .from('ventas')
          .select('empleado_id, empleados:empleado_id(nombre, dni)')
          .eq('id', venta.id)
          .maybeSingle(),
      ]);

      const detalles = (detRes.data || []).map((d: any) => ({
        nombre: d.producto_temporal_nombre || d.productos?.descripcion || 'Producto',
        cantidad: Number(d.cantidad) || 0,
        precio: Number(d.precio_unitario) || 0,
        subtotal: Number(d.subtotal) || 0,
        descuento_porcentaje: Number(d.descuento_porcentaje) || 0,
      }));
      setFacturaDetalles(detalles);

      const emp = ventaRes.data?.empleados
        ? { nombre: (ventaRes.data.empleados as any).nombre, dni: (ventaRes.data.empleados as any).dni }
        : null;
      setFacturaEmpleado(emp);
    } catch (err) {
      console.error('Error cargando factura:', err);
      toast.error('Error al cargar el detalle de la factura');
    }
  };


  const handleReintentarAfip = async (venta: Venta) => {
    // placeholder to keep boundary
    if (!user) return;
    if (venta._es_pedido || venta.anulada || venta.estado !== 'confirmada') return;

    setReintentandoAfipId(venta.id);
    try {
      // Cargar detalles de la venta
      const { data: detallesData, error: detallesErr } = await supabase
        .from('venta_detalles')
        .select('cantidad, precio_unitario, descuento_porcentaje, producto_temporal_nombre, productos(descripcion)')
        .eq('venta_id', venta.id);
      if (detallesErr) throw detallesErr;
      if (!detallesData || detallesData.length === 0) {
        toast.error('La venta no tiene detalles para facturar');
        return;
      }

      // Determinar tipo de comprobante y datos del receptor
      const condIva = venta.clientes?.condicion_iva ?? 5;
      const docNroRaw = (venta.clientes?.dni_cuit || '').replace(/\D/g, '');
      const esRespInscripto = condIva === 1;
      const tipoComprobante = esRespInscripto ? 1 : 6; // A o B
      const docTipo = esRespInscripto ? 80 : (docNroRaw.length >= 11 ? 80 : docNroRaw.length === 8 ? 96 : 99);
      const docNro = docNroRaw ? parseInt(docNroRaw) : 0;

      const totalFacturar = venta.total;
      const netoSinIva = totalFacturar / 1.21;
      const ivaAmount = totalFacturar - netoSinIva;

      const items = (detallesData as any[]).map((d) => {
        const precioFinal = Number(d.precio_unitario) * (1 - (Number(d.descuento_porcentaje) || 0) / 100);
        return {
          descripcion: d.productos?.descripcion || d.producto_temporal_nombre || 'Item',
          cantidad: Number(d.cantidad),
          precio_unitario: precioFinal / 1.21,
          iva_id: 5,
        };
      });

      const { data: facturaResult, error: facturaError } = await supabase.functions.invoke(
        'afip-facturacion/emitir',
        {
          body: {
            tipo_comprobante: tipoComprobante,
            punto_venta: comercioConfig?.punto_venta || 1,
            concepto: 1,
            doc_tipo: docTipo,
            doc_nro: docNro,
            condicion_iva_receptor: condIva,
            importe_total: totalFacturar,
            importe_neto: parseFloat(netoSinIva.toFixed(2)),
            importe_iva: parseFloat(ivaAmount.toFixed(2)),
            items,
            venta_id: venta.id,
          },
        }
      );

      if (facturaError) {
        toast.error('Error al emitir factura AFIP: ' + facturaError.message);
        return;
      }
      if ((facturaResult as any)?.error) {
        toast.error('Error AFIP: ' + (facturaResult as any).error);
        return;
      }

      const formatFechaAfip = (fecha: string): string => {
        if (fecha && fecha.length === 8) {
          return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
        }
        return fecha || new Date().toISOString().split('T')[0];
      };

      const { error: insertErr } = await supabase
        .from('comprobantes_afip')
        .insert({
          tipo_comprobante: tipoComprobante,
          punto_venta: (facturaResult as any).punto_venta,
          numero_comprobante: (facturaResult as any).numero_comprobante,
          cae: (facturaResult as any).cae,
          cae_vencimiento: formatFechaAfip((facturaResult as any).cae_vencimiento),
          cuit_emisor: comercioConfig?.cuit?.replace(/\D/g, '') || '',
          doc_tipo: docTipo,
          doc_nro: docNro,
          importe_total: totalFacturar,
          importe_neto: parseFloat(netoSinIva.toFixed(2)),
          importe_iva: parseFloat(ivaAmount.toFixed(2)),
          usuario_id: user.id,
          venta_id: venta.id,
        });

      if (insertErr) {
        toast.warning(`Factura emitida (CAE: ${(facturaResult as any).cae}) pero hubo error al guardar: ${insertErr.message}`);
      } else {
        toast.success(`Factura emitida - CAE: ${(facturaResult as any).cae}`);
      }

      fetchVentas();
      setRefreshTotales((n) => n + 1);
    } catch (err: any) {
      toast.error('Error al reintentar factura AFIP: ' + (err?.message || 'desconocido'));
    } finally {
      setReintentandoAfipId(null);
    }
  };

  const columns = [
    {
      key: 'numero_comprobante',
      header: 'Nº Venta',
      render: (item: Venta) => (
        <span className="font-mono font-medium">
          {item._es_pedido ? 'P-' : '#'}
          {(item.numero_comprobante ?? 0).toString().padStart(item._es_pedido ? 6 : 8, '0')}
        </span>
      ),
    },
    {
      key: 'numero_factura',
      header: 'Nº Factura',
      render: (item: Venta) => {
        const cmp = item.comprobantes_afip?.[0];
        if (!cmp) return <span className="text-muted-foreground text-xs">—</span>;
        const letra = TIPOS_COMPROBANTE[cmp.tipo_comprobante] || '';
        const pv = String(cmp.punto_venta).padStart(4, '0');
        const nro = String(cmp.numero_comprobante).padStart(8, '0');
        return (
          <span className="font-mono font-medium">
            {letra ? `${letra} ` : ''}{pv}-{nro}
          </span>
        );
      },
    },
    {
      key: 'fecha',
      header: 'Fecha',
      render: (item: Venta) => format(new Date(item.fecha), 'dd/MM/yyyy HH:mm', { locale: es }),
    },
    {
      key: 'vendedor',
      header: 'Usuario',
      render: (item: Venta) => item.profiles?.nombre || 'Sin asignar',
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (item: Venta) => item.clientes?.nombre || 'Consumidor Final',
    },
    {
      key: 'origen',
      header: 'Origen',
      render: (item: Venta) => {
        const origen = origenPorVenta[item.id] || 'mostrador';
        const label = origen.charAt(0).toUpperCase() + origen.slice(1);
        const variant = origen === 'web' ? 'default' : origen === 'reparto' ? 'secondary' : 'outline';
        return <Badge variant={variant as any}>{label}</Badge>;
      },
    },
    {
      key: 'total',
      header: 'Total',
      render: (item: Venta) => (
        <span className="font-medium">
          ${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'metodo_pago',
      header: 'Método de Pago',
      render: (item: Venta) => {
        if (item._es_pedido) return <span className="text-muted-foreground text-xs">—</span>;
        const pagosVenta = pagosPorVenta[item.id] || [];
        if (pagosVenta.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {pagosVenta.map((p, idx) => (
              <Badge key={idx} variant="outline" className="text-xs font-normal">
                {p.formas_pago?.nombre || 'Otro'}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (item: Venta) => (
        <div className="flex items-center gap-2">
          {item._es_pedido ? (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
              {item._pedido_estado || 'Pedido'}
            </Badge>
          ) : item.anulada ? (
            <Badge variant="destructive">Anulada</Badge>
          ) : item.estado === 'pedido' ? (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              Pedido
            </Badge>
          ) : (
            <Badge variant="default">Válida</Badge>
          )}
          {item.comprobantes_afip && item.comprobantes_afip.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Fact. {TIPOS_COMPROBANTE[item.comprobantes_afip[0].tipo_comprobante] || '?'}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Venta) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openDetalleDialog(item)} title="Ver detalle">
            <Eye className="h-4 w-4" />
          </Button>
          {!item._es_pedido && item.comprobantes_afip && item.comprobantes_afip.length > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => openFacturaDialog(item)}
              title="Reimprimir factura"
            >
              <Printer className="h-4 w-4 text-primary" />
            </Button>
          )}
          {!item._es_pedido &&
            !item.anulada &&
            item.estado === 'confirmada' &&
            (!item.comprobantes_afip || item.comprobantes_afip.length === 0) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReintentarAfip(item)}
                disabled={reintentandoAfipId === item.id}
                title="Reintentar factura AFIP"
              >
                <RefreshCw className={`h-4 w-4 text-amber-600 ${reintentandoAfipId === item.id ? 'animate-spin' : ''}`} />
              </Button>
            )}
          {!item._es_pedido && !item.anulada && canAnular && item.comprobantes_afip && item.comprobantes_afip.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openNcWizard(item, { alcance: 'parcial', anular: 'no' })}
                title="Emitir Nota de Crédito"
              >
                <FileMinus className="h-4 w-4 text-amber-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openNcWizard(item, { alcance: 'total', anular: 'si' })}
                title="Anular venta (NC total)"
              >
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title="Ventas" description="Historial de ventas y comprobantes">
        <Button variant="outline" onClick={() => toast.info('Función de exportación próximamente')}>
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {puedeVerTodas && (
            <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Usuario que cargó" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los usuarios</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vendedor del cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vendedores</SelectItem>
              <SelectItem value="sin_vendedor">Sin vendedor</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroOrigen} onValueChange={setFiltroOrigen}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los orígenes</SelectItem>
              <SelectItem value="mostrador">Mostrador</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="reparto">Reparto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="confirmada">Confirmadas</SelectItem>
              <SelectItem value="pedido">Pedidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                {fechaDesde ? format(fechaDesde, 'dd/MM/yyyy') : 'Desde'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={fechaDesde}
                onSelect={setFechaDesde}
                locale={es}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">-</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                {fechaHasta ? format(fechaHasta, 'dd/MM/yyyy') : 'Hasta'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={fechaHasta}
                onSelect={setFechaHasta}
                locale={es}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {(fechaDesde || fechaHasta) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setFechaDesde(undefined); setFechaHasta(undefined); }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Resumen de Totales */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Total Grande */}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                {filtroEstado === 'pedido' ? 'Total Pedidos Pendientes' : 'Total Ventas'}
              </p>
              <p className="text-4xl font-bold text-primary">
                {formatCurrency(totalesPorMedioPago.totalGeneral)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {totalesPorMedioPago.countVentas > 0 && `${totalesPorMedioPago.countVentas} ventas`}
                {totalesPorMedioPago.countVentas > 0 && totalesPorMedioPago.countPedidos > 0 && ', '}
                {totalesPorMedioPago.countPedidos > 0 && `${totalesPorMedioPago.countPedidos} pedidos`}
                {(fechaDesde || fechaHasta) && ' en el período seleccionado'}
              </p>
            </div>

            {/* Desglose por Medio de Pago */}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">Desglose por Medio de Pago</p>
              <div className="flex flex-wrap gap-4">
                {Object.entries(totalesPorMedioPago.totales).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                ) : (
                  Object.entries(totalesPorMedioPago.totales)
                    .sort((a, b) => b[1] - a[1])
                    .map(([nombre, total]) => (
                      <div key={nombre} className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg">
                        {getMedioPagoIcon(nombre)}
                        <div>
                          <p className="text-xs text-muted-foreground">{nombre}</p>
                          <p className="font-semibold">{formatCurrency(total)}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server-paginated table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por Nº comprobante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">registros</span>
          </div>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map((c) => (
                  <TableHead key={c.key} className="font-semibold">{c.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : ventasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                    No se encontraron registros
                  </TableCell>
                </TableRow>
              ) : (
                ventasFiltradas.map((item) => (
                  <TableRow key={item.id} className="table-row-hover">
                    {columns.map((c) => (
                      <TableCell key={c.key}>{c.render(item)}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} a{' '}
            {Math.min(page * pageSize, totalCount)} de {totalCount} registros
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1 || loading}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-4 text-sm">
              Página {page} de {Math.max(1, Math.ceil(totalCount / pageSize))}
            </span>
            <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= totalCount || loading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage(Math.max(1, Math.ceil(totalCount / pageSize)))} disabled={page * pageSize >= totalCount || loading}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Detalle Dialog */}
      <Dialog open={detalleDialogOpen} onOpenChange={setDetalleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Comprobante #{selectedVenta?.numero_comprobante.toString().padStart(8, '0')}
            </DialogTitle>
          </DialogHeader>

          {selectedVenta && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Fecha</p>
                    <p className="font-medium">
                      {format(new Date(selectedVenta.fecha), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">
                      {selectedVenta.clientes?.nombre || 'Consumidor Final'}
                    </p>
                    {selectedVenta.clientes?.dni_cuit && (
                      <p className="text-sm text-muted-foreground">
                        {selectedVenta.clientes.dni_cuit}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {selectedVenta.anulada && (
                <Card className="border-destructive bg-destructive/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <XCircle className="h-4 w-4" />
                      <span className="font-medium">Venta Anulada</span>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Motivo: </span>
                      {selectedVenta.motivo_anulacion}
                    </p>
                    {selectedVenta.fecha_anulacion && (
                      <p className="text-sm text-muted-foreground">
                        Anulada el {format(new Date(selectedVenta.fecha_anulacion), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Products */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-48">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Producto</th>
                          <th className="text-right py-2">Cant.</th>
                          <th className="text-right py-2">P. Unit.</th>
                          <th className="text-right py-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalles.map((detalle) => (
                          <tr key={detalle.id} className="border-b last:border-0">
                            <td className="py-2">
                              <p className="font-medium">{detalle.productos?.descripcion}</p>
                              <p className="text-xs text-muted-foreground">
                                {detalle.productos?.codigo_articulo}
                              </p>
                            </td>
                            <td className="text-right py-2">{detalle.cantidad}</td>
                            <td className="text-right py-2">
                              ${detalle.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right py-2 font-medium">
                              ${detalle.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Totals & Payments */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Formas de Pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pagos.map((pago) => (
                      <div key={pago.id} className="flex justify-between py-1">
                        <span>{pago.formas_pago?.nombre}</span>
                        <span className="font-medium">
                          ${pago.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Totales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${selectedVenta.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {selectedVenta.descuento > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Descuento</span>
                        <span>-${selectedVenta.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>${selectedVenta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Anular Dialog */}
      <AlertDialog open={anularDialogOpen} onOpenChange={setAnularDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción anulará el comprobante #{selectedVenta?.numero_comprobante.toString().padStart(8, '0')} 
              y devolverá el stock de los productos.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedVenta?.comprobantes_afip && selectedVenta.comprobantes_afip.length > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold mb-1">Se emitirá una Nota de Crédito electrónica</p>
              <p>
                Al anular esta venta, el sistema emitirá automáticamente una Nota de Crédito en AFIP
                referenciando la factura original{' '}
                <span className="font-mono font-semibold">
                  {TIPOS_COMPROBANTE[selectedVenta.comprobantes_afip[0].tipo_comprobante] || ''}{' '}
                  {String(selectedVenta.comprobantes_afip[0].punto_venta).padStart(4, '0')}-
                  {String(selectedVenta.comprobantes_afip[0].numero_comprobante).padStart(8, '0')}
                </span>
                {' '}por el mismo importe.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo de anulación *</Label>
            <Textarea
              id="motivo"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              placeholder="Ingrese el motivo de la anulación..."
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMotivoAnulacion('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAnular} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Anular Venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Factura Dialog for Reprint */}
      <Dialog open={facturaDialogOpen} onOpenChange={setFacturaDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factura Electrónica
            </DialogTitle>
          </DialogHeader>
          
          {selectedVenta && selectedFactura && (
            <>
              {/* Preview en formato Ticket Térmico 80mm */}
              <div
                id="printable-invoice"
                className="mx-auto border rounded-lg bg-white text-black p-4 font-mono text-[13px] leading-tight"
                style={{ width: '320px' }}
              >
                {/* Header */}
                <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                  <p className="font-bold text-base">
                    {comercioConfig?.nombre_fantasia || comercioConfig?.razon_social || 'EMPRESA'}
                  </p>
                  {comercioConfig?.razon_social && <p>{comercioConfig.razon_social}</p>}
                  {comercioConfig?.direccion && <p>{comercioConfig.direccion}</p>}
                  {comercioConfig?.localidad && (
                    <p>
                      {comercioConfig.localidad}
                      {comercioConfig.provincia ? `, ${comercioConfig.provincia}` : ''}
                    </p>
                  )}
                  <p>CUIT: {formatCuit(comercioConfig?.cuit || '')}</p>
                  <p>{comercioConfig?.condicion_iva || 'IVA Resp. Inscripto'}</p>
                  <div className="inline-block border border-black px-3 py-1 my-1 font-bold text-lg">
                    {TIPOS_COMPROBANTE[selectedFactura.tipo_comprobante] || '?'}
                  </div>
                  <p className="font-bold">FACTURA {TIPOS_COMPROBANTE[selectedFactura.tipo_comprobante]}</p>
                  <p className="font-bold">
                    Nº {String(selectedFactura.punto_venta).padStart(4, '0')}-
                    {String(selectedFactura.numero_comprobante).padStart(8, '0')}
                  </p>
                  <p>Fecha: {new Date(selectedVenta.fecha).toLocaleString('es-AR')}</p>
                </div>

                {/* Cliente / Empleado */}
                <div className="border-b border-dashed border-black pb-2 mb-2">
                  {facturaEmpleado ? (
                    <>
                      <p><strong>Empleado:</strong> {facturaEmpleado.nombre}</p>
                      {facturaEmpleado.dni && <p><strong>DNI:</strong> {facturaEmpleado.dni}</p>}
                      <p className="text-[10px]">(Cuenta Corriente)</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Cliente:</strong> {selectedVenta.clientes?.nombre || 'Consumidor Final'}</p>
                      <p><strong>CUIT/DNI:</strong> {selectedVenta.clientes?.dni_cuit || selectedFactura.doc_nro || 'Sin identificar'}</p>
                      <p><strong>IVA:</strong> {CONDICIONES_IVA[selectedVenta.clientes?.condicion_iva || 5]}</p>
                    </>
                  )}
                  <p><strong>Cond. Venta:</strong> {facturaEmpleado ? 'Cuenta Corriente' : 'Contado'}</p>
                </div>

                {/* Detalle */}
                <div className="border-b border-dashed border-black pb-2 mb-2">
                  <p className="font-bold text-center mb-1">DETALLE</p>
                  {facturaDetalles.length === 0 ? (
                    <p className="text-center text-[11px]">Cargando productos…</p>
                  ) : (
                    facturaDetalles.map((it, i) => (
                      <div key={i} className="mb-1">
                        <p className="font-bold break-words">{it.nombre}</p>
                        <div className="flex justify-between">
                          <span>{it.cantidad} x ${it.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          <span>${it.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {it.descuento_porcentaje > 0 && (
                          <p className="text-right text-[11px]">Desc: {it.descuento_porcentaje}%</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Totales */}
                <div className="text-right">
                  <p>Neto Gravado: ${(selectedFactura.importe_neto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                  <p>IVA 21%: ${(selectedFactura.importe_iva || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                  <p className="font-bold text-base border-t-2 border-black pt-1 mt-1">
                    TOTAL: ${selectedFactura.importe_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* CAE */}
                <div className="text-center mt-2 text-[11px]">
                  <p className="font-bold">CAE: {selectedFactura.cae}</p>
                  <p>Vto. CAE: {selectedFactura.cae_vencimiento}</p>
                  <p className="mt-1">Comprobante Autorizado - AFIP</p>
                  <p>www.afip.gob.ar/fe/qr/</p>
                  <p className="mt-2">¡Gracias por su compra!</p>
                </div>
              </div>

              <Button className="w-full mt-4" onClick={() => {
                imprimirTicketFactura({
                    comercio: comercioConfig,
                    fecha: selectedVenta.fecha,
                    total: selectedVenta.total,
                    descuento: selectedVenta.descuento,
                    numero_comprobante: selectedVenta.numero_comprobante,
                    detalles: facturaDetalles,
                    cliente: selectedVenta.clientes,
                    empleado: facturaEmpleado,
                    factura: {
                      tipo_comprobante: selectedFactura.tipo_comprobante,
                      punto_venta: selectedFactura.punto_venta,
                      numero_comprobante: selectedFactura.numero_comprobante,
                      cae: selectedFactura.cae,
                      cae_vencimiento: selectedFactura.cae_vencimiento,
                      importe_total: selectedFactura.importe_total,
                      importe_neto: selectedFactura.importe_neto,
                      importe_iva: selectedFactura.importe_iva,
                      doc_nro: selectedFactura.doc_nro,
                    },
                  });
              }}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Factura
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
