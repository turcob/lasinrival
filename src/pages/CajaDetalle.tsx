import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Loader2,
  Printer,
  ExternalLink,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LABEL_CATEGORIA, type CategoriaMedio } from '@/components/cajas/categoriaMedio';
import { DetalleOperacionesArqueoDialog } from '@/components/cajas/DetalleOperacionesArqueoDialog';

interface Caja {
  id: string;
  usuario_id: string;
  fondo_inicial: number;
  total_ventas: number | null;
  total_egresos: number | null;
  conteo_declarado: number | null;
  diferencia: number | null;
  estado: string;
  observaciones: string | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  arqueo_confirmado?: boolean;
  arqueo_pendiente_revision?: boolean;
  usuario_nombre?: string | null;
}

interface MovimientoRow {
  id: string;
  caja_id: string;
  tipo: string;
  concepto: string;
  monto: number;
  created_at: string;
  usuario_id: string;
  venta_id: string | null;
}

interface VentaRow {
  id: string;
  numero_comprobante: number | null;
  fecha: string;
  total: number;
  anulada: boolean;
  estado: string | null;
  cliente_id: string | null;
  cliente_nombre?: string | null;
  usuario_id: string | null;
  usuario_nombre?: string | null;
  pagos?: { forma_pago_id: string; monto: number; forma_pago_nombre: string; categoria: string | null; transferencia_id?: string | null; cheque_id?: string | null }[];
}

interface PagoRow {
  id: string;
  venta_id: string;
  forma_pago_id: string;
  forma_pago_nombre: string;
  categoria: string | null;
  monto: number;
  cuotas: number | null;
  created_at: string;
  numero_operacion?: string | null;
  transferencia_id?: string | null;
  cheque_id?: string | null;
  venta_numero: number | null;
  cliente_nombre: string | null;
}

interface ArqueoDetalle { denominacion: number; cantidad: number; subtotal: number; }
interface ArqueoOtroMedio { tipo: string; monto: number; }
interface ArqueoPorMedioRow {
  categoria: string | null;
  forma_pago_id: string | null;
  forma_pago_nombre: string | null;
  total: number;
  cantidad_operaciones: number;
}

const money = (n: number) =>
  `$${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CajaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('admin');

  const [caja, setCaja] = useState<Caja | null>(null);
  const [loading, setLoading] = useState(true);
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([]);
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [arqueoDetalles, setArqueoDetalles] = useState<ArqueoDetalle[]>([]);
  const [arqueoOtrosMedios, setArqueoOtrosMedios] = useState<ArqueoOtroMedio[]>([]);
  const [arqueoPorMedio, setArqueoPorMedio] = useState<ArqueoPorMedioRow[]>([]);
  const [canVerTransferencias, setCanVerTransferencias] = useState(false);

  // Filtros por tab
  const [ventasSearch, setVentasSearch] = useState('');
  const [ventasFormaPago, setVentasFormaPago] = useState<string>('todas');
  const [ventasIncluirAnuladas, setVentasIncluirAnuladas] = useState(true);

  const [pagosCategoria, setPagosCategoria] = useState<string>('todas');
  const [pagosSearch, setPagosSearch] = useState('');

  const [movimientosTipo, setMovimientosTipo] = useState<string>('todos');
  const [movimientosSearch, setMovimientosSearch] = useState('');

  // Drill-down
  const [drillDown, setDrillDown] = useState<{ open: boolean; categoria: CategoriaMedio | null; esperado: number }>({ open: false, categoria: null, esperado: 0 });

  // Editar movimiento manual
  const [editOpen, setEditOpen] = useState(false);
  const [editMov, setEditMov] = useState<MovimientoRow | null>(null);
  const [editForm, setEditForm] = useState({ concepto: '', monto: '' });

  useEffect(() => {
    (async () => {
      if (hasRole('admin')) { setCanVerTransferencias(true); return; }
      setCanVerTransferencias(await hasPermission('transferencias', 'ver'));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cajaRes, movsRes, ventasRes, detRes, otrosRes, porMedioRes] = await Promise.all([
        supabase.from('cajas').select('*, profiles:usuario_id(nombre)').eq('id', id).single(),
        supabase.from('movimientos_caja').select('*').eq('caja_id', id).order('created_at', { ascending: false }),
        supabase
          .from('ventas')
          .select('id, numero_comprobante, fecha, total, anulada, estado, cliente_id, usuario_id, clientes:cliente_id(nombre), profiles:usuario_id(nombre)')
          .eq('caja_id', id)
          .order('fecha', { ascending: false }),
        supabase.from('arqueo_detalles').select('denominacion, cantidad, subtotal').eq('caja_id', id).order('denominacion', { ascending: false }),
        supabase.from('arqueo_otros_medios').select('tipo, monto').eq('caja_id', id),
        supabase.rpc('get_arqueo_por_medio', { p_caja_id: id }),
      ]);

      if (cajaRes.error) throw cajaRes.error;
      const cajaData = cajaRes.data as any;
      setCaja({
        ...cajaData,
        usuario_nombre: cajaData.profiles?.nombre || null,
      });

      setMovimientos((movsRes.data || []) as MovimientoRow[]);

      const ventasBase = (ventasRes.data || []) as any[];
      const ventaIds = ventasBase.map(v => v.id);

      // Fetch pagos + formas_pago
      let pagosFlat: PagoRow[] = [];
      if (ventaIds.length > 0) {
        const [pagosR, transfR, chequesR] = await Promise.all([
          supabase
            .from('venta_pagos')
            .select('id, venta_id, forma_pago_id, monto, cuotas, created_at, formas_pago:forma_pago_id(nombre, categoria)')
            .in('venta_id', ventaIds),
          supabase.from('transferencias').select('id, venta_id, numero_operacion').in('venta_id', ventaIds),
          supabase.from('cheques').select('id, venta_id').in('venta_id', ventaIds),
        ]);
        const pagosData = pagosR.data;
        const transfByVenta = new Map<string, { id: string; numero_operacion: string | null }>();
        (transfR.data || []).forEach((t: any) => transfByVenta.set(t.venta_id, { id: t.id, numero_operacion: t.numero_operacion }));
        const chequeByVenta = new Map<string, string>();
        (chequesR.data || []).forEach((c: any) => chequeByVenta.set(c.venta_id, c.id));
        const ventaMap = new Map(ventasBase.map(v => [v.id, v]));
        pagosFlat = ((pagosData || []) as any[]).map((p) => {
          const v = ventaMap.get(p.venta_id);
          const cat = p.formas_pago?.categoria || null;
          const t = cat === 'transferencia' ? transfByVenta.get(p.venta_id) : undefined;
          const chId = cat === 'cheque' ? chequeByVenta.get(p.venta_id) : undefined;
          return {
            id: p.id,
            venta_id: p.venta_id,
            forma_pago_id: p.forma_pago_id,
            forma_pago_nombre: p.formas_pago?.nombre || '—',
            categoria: cat,
            monto: Number(p.monto || 0),
            cuotas: p.cuotas,
            created_at: p.created_at,
            numero_operacion: t?.numero_operacion || null,
            transferencia_id: t?.id || null,
            cheque_id: chId || null,
            venta_numero: v?.numero_comprobante || null,
            cliente_nombre: v?.clientes?.nombre || null,
          } as PagoRow;
        });
      }
      setPagos(pagosFlat);

      // Agrupar pagos por venta para columna medios de pago
      const pagosPorVenta = new Map<string, PagoRow[]>();
      pagosFlat.forEach(p => {
        const arr = pagosPorVenta.get(p.venta_id) || [];
        arr.push(p);
        pagosPorVenta.set(p.venta_id, arr);
      });

      setVentas(ventasBase.map(v => ({
        id: v.id,
        numero_comprobante: v.numero_comprobante,
        fecha: v.fecha,
        total: Number(v.total || 0),
        anulada: !!v.anulada,
        estado: v.estado,
        cliente_id: v.cliente_id,
        cliente_nombre: v.clientes?.nombre || null,
        usuario_id: v.usuario_id,
        usuario_nombre: v.profiles?.nombre || null,
        pagos: (pagosPorVenta.get(v.id) || []).map(p => ({
          forma_pago_id: p.forma_pago_id,
          forma_pago_nombre: p.forma_pago_nombre,
          categoria: p.categoria,
          monto: p.monto,
          transferencia_id: p.transferencia_id || null,
          cheque_id: p.cheque_id || null,
        })),
      })));

      setArqueoDetalles((detRes.data || []) as ArqueoDetalle[]);
      setArqueoOtrosMedios((otrosRes.data || []) as ArqueoOtroMedio[]);
      setArqueoPorMedio((porMedioRes.data || []) as ArqueoPorMedioRow[]);
    } catch (e: any) {
      console.error('[CajaDetalle] error', e);
      toast.error(e.message || 'Error cargando la caja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const esperado = useMemo(() => {
    if (!caja) return 0;
    return (caja.fondo_inicial || 0) + (caja.total_ventas || 0) - (caja.total_egresos || 0);
  }, [caja]);

  const formasPagoUnicas = useMemo(() => {
    const map = new Map<string, string>();
    pagos.forEach(p => map.set(p.forma_pago_id, p.forma_pago_nombre));
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [pagos]);

  const ventasFiltradas = useMemo(() => {
    const q = ventasSearch.trim().toLowerCase();
    return ventas.filter(v => {
      if (!ventasIncluirAnuladas && v.anulada) return false;
      if (ventasFormaPago !== 'todas' && !(v.pagos || []).some(p => p.forma_pago_id === ventasFormaPago)) return false;
      if (q) {
        const hay = `${v.numero_comprobante || ''} ${v.cliente_nombre || ''} ${v.usuario_nombre || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ventas, ventasSearch, ventasFormaPago, ventasIncluirAnuladas]);

  const pagosFiltrados = useMemo(() => {
    const q = pagosSearch.trim().toLowerCase();
    return pagos.filter(p => {
      if (pagosCategoria !== 'todas' && (p.categoria || 'otro') !== pagosCategoria) return false;
      if (q) {
        const hay = `${p.venta_numero || ''} ${p.cliente_nombre || ''} ${p.forma_pago_nombre} ${p.numero_operacion || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pagos, pagosCategoria, pagosSearch]);

  const movimientosFiltrados = useMemo(() => {
    const q = movimientosSearch.trim().toLowerCase();
    return movimientos.filter(m => {
      if (movimientosTipo !== 'todos' && m.tipo !== movimientosTipo) return false;
      if (q && !m.concepto.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [movimientos, movimientosTipo, movimientosSearch]);

  const totalDeclarado = caja?.conteo_declarado || 0;

  const handlePrintArqueo = () => {
    if (!caja) return;
    const totalEfectivoArqueo = arqueoDetalles.reduce((s, d) => s + Number(d.subtotal || 0), 0);
    const totalOtros = arqueoOtrosMedios.reduce((s, o) => s + Number(o.monto || 0), 0);
    const w = window.open('', '_blank');
    if (!w) { toast.error('No se pudo abrir la ventana de impresión'); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Arqueo</title><style>
      body{font-family:Arial,sans-serif;padding:20px;max-width:420px;margin:0 auto}
      h1{text-align:center;font-size:18px;margin:0}
      h2{text-align:center;font-size:13px;color:#555;margin:4px 0 12px}
      .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}
      .total{font-weight:bold;font-size:14px;border-top:1px dashed #000;padding-top:6px;margin-top:6px}
      .sec{font-weight:bold;margin-top:10px;font-size:13px}
    </style></head><body>
      <h1>Arqueo de Caja</h1>
      <h2>${format(new Date(caja.fecha_apertura), 'dd/MM/yyyy HH:mm')} — ${caja.usuario_nombre || ''}</h2>
      <div class="row"><span>Fondo inicial</span><span>${money(caja.fondo_inicial)}</span></div>
      <div class="row"><span>Ventas</span><span>${money(caja.total_ventas || 0)}</span></div>
      <div class="row"><span>Egresos</span><span>-${money(caja.total_egresos || 0)}</span></div>
      <div class="row total"><span>Esperado</span><span>${money(esperado)}</span></div>
      <div class="sec">Efectivo declarado</div>
      ${arqueoDetalles.map(d => `<div class="row"><span>$${d.denominacion} x ${d.cantidad}</span><span>${money(d.subtotal)}</span></div>`).join('')}
      <div class="row total"><span>Subtotal efectivo</span><span>${money(totalEfectivoArqueo)}</span></div>
      ${arqueoOtrosMedios.length > 0 ? `<div class="sec">Otros medios</div>${arqueoOtrosMedios.map(o => `<div class="row"><span>${o.tipo}</span><span>${money(o.monto)}</span></div>`).join('')}<div class="row total"><span>Subtotal otros</span><span>${money(totalOtros)}</span></div>` : ''}
      <div class="row total"><span>Total contado</span><span>${money(totalDeclarado)}</span></div>
      <div class="row total"><span>Diferencia</span><span>${money(caja.diferencia || 0)}</span></div>
      <script>window.print();</script>
    </body></html>`);
    w.document.close();
  };

  const handleEditarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMov || !caja) return;
    const nuevoMonto = parseFloat(editForm.monto);
    if (isNaN(nuevoMonto) || nuevoMonto <= 0) { toast.error('Monto inválido'); return; }
    try {
      const diff = nuevoMonto - Number(editMov.monto);
      const { error } = await supabase.from('movimientos_caja')
        .update({ concepto: editForm.concepto, monto: nuevoMonto })
        .eq('id', editMov.id);
      if (error) throw error;
      if (diff !== 0) {
        const field = editMov.tipo === 'ingreso' ? 'total_ventas' : 'total_egresos';
        const { data: cd } = await supabase.from('cajas').select(field).eq('id', caja.id).single();
        if (cd) {
          const cur = (cd as any)[field] || 0;
          await supabase.from('cajas').update({ [field]: cur + diff }).eq('id', caja.id);
        }
      }
      toast.success('Movimiento actualizado');
      setEditOpen(false);
      setEditMov(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar');
    }
  };

  const handleEliminarMovimiento = async (mov: MovimientoRow) => {
    if (!caja) return;
    if (!confirm(`¿Eliminar ${mov.tipo} de ${money(mov.monto)}?`)) return;
    try {
      const { error } = await supabase.from('movimientos_caja').delete().eq('id', mov.id);
      if (error) throw error;
      const field = mov.tipo === 'ingreso' ? 'total_ventas' : 'total_egresos';
      const { data: cd } = await supabase.from('cajas').select(field).eq('id', caja.id).single();
      if (cd) {
        const cur = (cd as any)[field] || 0;
        await supabase.from('cajas').update({ [field]: Math.max(0, cur - Number(mov.monto)) }).eq('id', caja.id);
      }
      toast.success('Movimiento eliminado');
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  const categoriaBadge = (cat: string | null) => {
    const c = (cat || 'otro') as CategoriaMedio;
    const colors: Record<string, string> = {
      efectivo: 'bg-green-500/10 text-green-700 border-green-500/30',
      debito: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
      credito: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
      transferencia: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/30',
      cheque: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
      otro: 'bg-muted text-muted-foreground',
    };
    return <Badge variant="outline" className={`text-xs ${colors[c] || colors.otro}`}>{LABEL_CATEGORIA[c] || 'Otro'}</Badge>;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </MainLayout>
    );
  }

  if (!caja) {
    return (
      <MainLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Caja no encontrada</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/cajas')}>Volver</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cajas')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
        </div>

        <PageHeader
          title={`Caja ${format(new Date(caja.fecha_apertura), 'dd/MM/yyyy HH:mm', { locale: es })}`}
          description={`${caja.usuario_nombre || ''} — ${caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}`}
        >
          <div className="flex gap-2">
              {canVerTransferencias && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/imputacion?caja=${caja.id}`)}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Ver en Imputación
                </Button>
              )}
              {caja.estado === 'cerrada' && (
                <Button variant="outline" size="sm" onClick={handlePrintArqueo}>
                  <Printer className="h-4 w-4 mr-1" /> Imprimir arqueo
                </Button>
              )}
          </div>
        </PageHeader>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Estado</p><Badge variant={caja.estado === 'abierta' ? 'default' : 'secondary'}>{caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</Badge></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Fondo inicial</p><p className="text-lg font-semibold">{money(caja.fondo_inicial)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total ventas</p><p className="text-lg font-semibold text-success">{money(caja.total_ventas || 0)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total egresos</p><p className="text-lg font-semibold text-destructive">{money(caja.total_egresos || 0)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Esperado</p><p className="text-lg font-bold">{money(esperado)}</p></CardContent></Card>
          {caja.estado === 'cerrada' && (
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Diferencia</p><p className={`text-lg font-bold ${(caja.diferencia || 0) === 0 ? 'text-success' : (caja.diferencia || 0) > 0 ? 'text-blue-600' : 'text-destructive'}`}>{money(caja.diferencia || 0)}</p></CardContent></Card>
          )}
        </div>

        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="ventas">Ventas ({ventas.length})</TabsTrigger>
            <TabsTrigger value="pagos">Pagos ({pagos.length})</TabsTrigger>
            <TabsTrigger value="movimientos">Ingresos/Egresos ({movimientos.length})</TabsTrigger>
            {caja.estado === 'cerrada' && <TabsTrigger value="arqueo">Arqueo</TabsTrigger>}
          </TabsList>

          {/* RESUMEN */}
          <TabsContent value="resumen" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {arqueoPorMedio.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No hay operaciones registradas por medio.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Forma de pago</TableHead>
                        <TableHead className="text-right">Operaciones</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Acc.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {arqueoPorMedio.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{categoriaBadge(r.categoria)}</TableCell>
                          <TableCell>{r.forma_pago_nombre || '—'}</TableCell>
                          <TableCell className="text-right">{r.cantidad_operaciones}</TableCell>
                          <TableCell className="text-right font-medium">{money(Number(r.total))}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => setDrillDown({ open: true, categoria: (r.categoria as CategoriaMedio) || 'otro', esperado: Number(r.total) })}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VENTAS */}
          <TabsContent value="ventas" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Buscar por N°, cliente, usuario..." value={ventasSearch} onChange={(e) => setVentasSearch(e.target.value)} className="max-w-xs" />
              <Select value={ventasFormaPago} onValueChange={setVentasFormaPago}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Forma de pago" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las formas</SelectItem>
                  {formasPagoUnicas.map(fp => <SelectItem key={fp.id} value={fp.id}>{fp.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant={ventasIncluirAnuladas ? 'default' : 'outline'} size="sm" onClick={() => setVentasIncluirAnuladas(!ventasIncluirAnuladas)}>
                {ventasIncluirAnuladas ? 'Ocultar anuladas' : 'Ver anuladas'}
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>N°</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Medios</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventasFiltradas.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin ventas</TableCell></TableRow>
                    ) : ventasFiltradas.map(v => (
                      <TableRow key={v.id} className={v.anulada ? 'opacity-60' : ''}>
                        <TableCell className="text-xs">{format(new Date(v.fecha), 'HH:mm')}</TableCell>
                        <TableCell className="font-mono text-sm">{v.numero_comprobante ? `#${v.numero_comprobante}` : '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{v.cliente_nombre || 'Consumidor final'}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs">{v.usuario_nombre || '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(v.pagos || []).map((p, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{p.forma_pago_nombre}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{money(v.total)}</TableCell>
                        <TableCell>
                          {v.anulada ? <Badge variant="destructive" className="text-xs">Anulada</Badge> : <Badge variant="outline" className="text-xs">{v.estado || 'ok'}</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/ventas?venta=${v.id}`)}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAGOS */}
          <TabsContent value="pagos" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Buscar por N° venta, cliente, forma..." value={pagosSearch} onChange={(e) => setPagosSearch(e.target.value)} className="max-w-xs" />
              <Select value={pagosCategoria} onValueChange={setPagosCategoria}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Venta</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Acc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosFiltrados.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin pagos</TableCell></TableRow>
                    ) : pagosFiltrados.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{format(new Date(p.created_at), 'HH:mm')}</TableCell>
                        <TableCell className="font-mono text-sm">{p.venta_numero ? `#${p.venta_numero}` : '—'}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{p.cliente_nombre || '—'}</TableCell>
                        <TableCell>{categoriaBadge(p.categoria)}</TableCell>
                        <TableCell className="text-sm">{p.forma_pago_nombre}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.cuotas && p.cuotas > 1 ? `${p.cuotas} cuotas` : ''}
                          {p.numero_operacion ? ` · Op: ${p.numero_operacion}` : ''}
                        </TableCell>
                        <TableCell className="text-right font-medium">{money(p.monto)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.transferencia_id && canVerTransferencias && (
                              <Button size="sm" variant="ghost" title="Ver transferencia" onClick={() => navigate(`/imputacion?transferencia_id=${p.transferencia_id}`)}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {p.cheque_id && (
                              <Button size="sm" variant="ghost" title="Ver cheque" onClick={() => navigate(`/cheques?id=${p.cheque_id}`)}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" title="Ver venta" onClick={() => navigate(`/ventas?venta=${p.venta_id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MOVIMIENTOS MANUALES */}
          <TabsContent value="movimientos" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Buscar concepto..." value={movimientosSearch} onChange={(e) => setMovimientosSearch(e.target.value)} className="max-w-xs" />
              <Select value={movimientosTipo} onValueChange={setMovimientosTipo}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ingreso">Ingresos</SelectItem>
                  <SelectItem value="egreso">Egresos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      {isAdmin && <TableHead className="text-right">Acc.</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientosFiltrados.length === 0 ? (
                      <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-6">Sin movimientos</TableCell></TableRow>
                    ) : movimientosFiltrados.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{format(new Date(m.created_at), 'HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${m.tipo === 'ingreso' ? 'bg-green-500/10 text-green-700 border-green-500/30' : 'bg-red-500/10 text-red-700 border-red-500/30'}`}>
                            {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                          </Badge>
                        </TableCell>
                        <TableCell>{m.concepto}</TableCell>
                        <TableCell className={`text-right font-medium ${m.tipo === 'ingreso' ? 'text-success' : 'text-destructive'}`}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{money(m.monto)}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {!m.venta_id && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditMov(m); setEditForm({ concepto: m.concepto, monto: String(m.monto) }); setEditOpen(true); }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleEliminarMovimiento(m)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ARQUEO */}
          {caja.estado === 'cerrada' && (
            <TabsContent value="arqueo" className="mt-4 space-y-3">
              <Card>
                <CardContent className="pt-4 space-y-4">
                  {arqueoDetalles.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Efectivo declarado</p>
                      <div className="grid gap-2 grid-cols-2 md:grid-cols-3 text-sm">
                        {arqueoDetalles.map((d) => (
                          <div key={d.denominacion} className="flex justify-between bg-muted/50 px-3 py-2 rounded">
                            <span>${d.denominacion.toLocaleString('es-AR')} × {d.cantidad}</span>
                            <span className="font-medium">{money(d.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {arqueoOtrosMedios.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Otros medios</p>
                      <div className="grid gap-2 grid-cols-2 md:grid-cols-3 text-sm">
                        {arqueoOtrosMedios.map((o) => (
                          <div key={o.tipo} className="flex justify-between bg-muted/50 px-3 py-2 rounded">
                            <span className="capitalize">{o.tipo}</span>
                            <span className="font-medium">{money(o.monto)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t pt-3 space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Esperado</span><span className="font-medium">{money(esperado)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Declarado</span><span className="font-medium">{money(totalDeclarado)}</span></div>
                    <div className={`flex justify-between font-bold ${(caja.diferencia || 0) === 0 ? 'text-success' : (caja.diferencia || 0) > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                      <span>Diferencia</span>
                      <span>{money(caja.diferencia || 0)}</span>
                    </div>
                  </div>
                  {caja.observaciones && (
                    <div>
                      <p className="text-sm font-medium">Observaciones</p>
                      <p className="text-sm text-muted-foreground">{caja.observaciones}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <DetalleOperacionesArqueoDialog
        open={drillDown.open}
        onOpenChange={(open) => setDrillDown((d) => ({ ...d, open }))}
        cajaId={caja.id}
        categoria={drillDown.categoria}
        esperado={drillDown.esperado}
      />

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setEditMov(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editMov?.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditarMovimiento} className="space-y-3">
            <div className="space-y-1">
              <Label>Concepto</Label>
              <Input value={editForm.concepto} onChange={(e) => setEditForm({ ...editForm, concepto: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input type="number" step="0.01" min="0.01" value={editForm.monto} onChange={(e) => setEditForm({ ...editForm, monto: e.target.value })} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}