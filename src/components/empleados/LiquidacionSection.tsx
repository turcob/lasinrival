import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, CheckCircle, FileText, Printer, AlertTriangle, History } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PagarLiquidacionDialog } from './PagarLiquidacionDialog';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';
import { imprimirReciboLiquidacion } from '@/lib/imprimirReciboLiquidacion';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface Empleado {
  id: string;
  nombre: string;
  sueldo_base: number;
  activo: boolean;
  comision_porcentaje?: number;
}

interface LiquidacionData {
  empleado: Empleado;
  sueldo_base: number;
  total_compras: number;
  total_adelantos: number;
  total_comisiones: number;
  comision_porcentaje: number;
  ventas_web_monto: number;
  ventas_tradicional_monto: number;
  comision_auto: number;
  comision_manual: number;
  neto_a_pagar: number;
  pendientes_chofer?: Array<{ id: string; monto: number; concepto: string; fecha: string }>;
  overlap?: Array<{ id: string; fecha_desde: string; fecha_hasta: string; estado: string; neto_a_pagar: number }>;
  liquidacion_existente?: {
    id: string;
    estado: string;
  };
}

interface LiquidacionSectionProps {
  empleados: Empleado[];
  onRefresh: () => void;
}

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

export function LiquidacionSection({ empleados, onRefresh }: LiquidacionSectionProps) {
  const { user } = useAuth();
  const { config } = useConfiguracionComercio();
  const today = new Date();
  const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [fechaHasta, setFechaHasta] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [historialOpen, setHistorialOpen] = useState(false);

  // Diálogo de confirmación por solapamiento de fechas
  const [overlapConfirm, setOverlapConfirm] = useState<{
    liq: LiquidacionData;
    pendientesIds: string[];
  } | null>(null);

  // Diálogo para elegir qué pendientes del chofer descontar
  const [pendientesDialog, setPendientesDialog] = useState<{
    liq: LiquidacionData;
    seleccionados: Set<string>;
  } | null>(null);
  
  // Payment dialog state
  const [pagarDialogOpen, setPagarDialogOpen] = useState(false);
  const [liquidacionAPagar, setLiquidacionAPagar] = useState<{
    id: string;
    empleadoNombre: string;
    monto: number;
    sueldoBase: number;
    totalComisiones: number;
    totalDescuentos: number;
  } | null>(null);

  useEffect(() => {
    calcularLiquidaciones();
  }, [fechaDesde, fechaHasta, empleados]);

  const calcularLiquidaciones = async () => {
    setLoading(true);
    try {
      const empleadosActivos = empleados.filter(e => e.activo);
      const startDate = fechaDesde;
      const endDate = fechaHasta;
      if (!startDate || !endDate || startDate > endDate) {
        setLiquidaciones([]);
        return;
      }

      // Fetch movimientos for the period
      const { data: movimientos } = await supabase
        .from('empleado_movimientos')
        .select('*')
        .gte('fecha', startDate)
        .lte('fecha', endDate);

      // Fetch existing liquidaciones que solapen con el rango seleccionado
      const { data: liquidacionesExistentes } = await supabase
        .from('empleado_liquidaciones')
        .select('*')
        .in('empleado_id', empleadosActivos.map(e => e.id))
        .lte('fecha_desde', endDate)
        .gte('fecha_hasta', startDate);

      // Fetch pendientes_chofer aún sin descontar (estado=pendiente) para los empleados activos
      const { data: pendientesChofer } = await (supabase as any)
        .from('chofer_pendientes')
        .select('id, empleado_id, monto, concepto, fecha')
        .eq('estado', 'pendiente')
        .in('empleado_id', empleadosActivos.map(e => e.id));

      // Vendedores vinculados a los empleados (para cruzar pedidos)
      const { data: vendedoresData } = await supabase
        .from('vendedores')
        .select('id, empleado_id')
        .in('empleado_id', empleadosActivos.map(e => e.id));
      const vendedorIds = (vendedoresData ?? []).map((v: any) => v.id);
      const vendedorByEmpleado = new Map<string, string[]>();
      (vendedoresData ?? []).forEach((v: any) => {
        const arr = vendedorByEmpleado.get(v.empleado_id) ?? [];
        arr.push(v.id);
        vendedorByEmpleado.set(v.empleado_id, arr);
      });

      // Pedidos despachados (web/reparto) entregados en el rango
      const endDateNext = new Date(endDate);
      endDateNext.setDate(endDateNext.getDate() + 1);
      const endDateNextStr = endDateNext.toISOString().split('T')[0];

      let pedidosDespachados: any[] = [];
      if (vendedorIds.length > 0) {
        const { data: pedData } = await supabase
          .from('pedidos')
          .select('id, vendedor_id, total, estado, fecha_entrega_real, fecha_pedido, tipo_pedido')
          .in('vendedor_id', vendedorIds)
          .eq('estado', 'despachado');
        pedidosDespachados = (pedData ?? []).filter((p: any) => {
          const f = p.fecha_entrega_real || p.fecha_pedido;
          if (!f) return false;
          const fd = f.split('T')[0];
          return fd >= startDate && fd <= endDate;
        });
      }

      // Ventas tradicionales confirmadas del empleado
      const { data: ventasData } = await supabase
        .from('ventas')
        .select('id, empleado_id, total, estado, anulada, fecha')
        .in('empleado_id', empleadosActivos.map(e => e.id))
        .eq('anulada', false)
        .eq('estado', 'confirmada')
        .gte('fecha', startDate)
        .lte('fecha', endDateNextStr);

      const liquidacionesData: LiquidacionData[] = empleadosActivos.map(emp => {
        const empMovimientos = movimientos?.filter(m => m.empleado_id === emp.id) || [];
        
        const total_compras = empMovimientos
          .filter(m => m.tipo === 'compra')
          .reduce((sum, m) => sum + Number(m.monto), 0);
        
        const total_adelantos = empMovimientos
          .filter(m => m.tipo === 'adelanto')
          .reduce((sum, m) => sum + Number(m.monto), 0);
        
        const comision_manual = empMovimientos
          .filter(m => m.tipo === 'comision')
          .reduce((sum, m) => sum + Number(m.monto), 0);

        // Cálculo automático
        const vendIds = vendedorByEmpleado.get(emp.id) ?? [];
        const ventas_web_monto = pedidosDespachados
          .filter((p: any) => vendIds.includes(p.vendedor_id))
          .reduce((s: number, p: any) => s + Number(p.total || 0), 0);
        const ventas_tradicional_monto = (ventasData ?? [])
          .filter((v: any) => v.empleado_id === emp.id)
          .reduce((s: number, v: any) => s + Number(v.total || 0), 0);
        const comision_porcentaje = Number(emp.comision_porcentaje || 0);
        const comision_auto = (ventas_web_monto + ventas_tradicional_monto) * (comision_porcentaje / 100);
        const total_comisiones = comision_manual + comision_auto;

        const sueldo_base = Number(emp.sueldo_base) || 0;
        const neto_a_pagar = sueldo_base + total_comisiones - total_compras - total_adelantos;

        const overlapAll = (liquidacionesExistentes ?? []).filter(l => l.empleado_id === emp.id);
        // "existente" estricta = rango exactamente igual
        const liquidacion_existente = overlapAll.find(l =>
          l.fecha_desde === startDate && l.fecha_hasta === endDate
        );
        const overlap = overlapAll
          .filter(l => !(l.fecha_desde === startDate && l.fecha_hasta === endDate))
          .map(l => ({
            id: l.id,
            fecha_desde: l.fecha_desde,
            fecha_hasta: l.fecha_hasta,
            estado: l.estado,
            neto_a_pagar: Number(l.neto_a_pagar),
          }));

        const pendientes_chofer = (pendientesChofer ?? [])
          .filter((p: any) => p.empleado_id === emp.id)
          .map((p: any) => ({ id: p.id, monto: Number(p.monto), concepto: p.concepto, fecha: p.fecha }));

        return {
          empleado: emp,
          sueldo_base,
          total_compras,
          total_adelantos,
          total_comisiones,
          comision_porcentaje,
          ventas_web_monto,
          ventas_tradicional_monto,
          comision_auto,
          comision_manual,
          neto_a_pagar,
          pendientes_chofer,
          overlap,
          liquidacion_existente: liquidacion_existente ? {
            id: liquidacion_existente.id,
            estado: liquidacion_existente.estado,
          } : undefined,
        };
      });

      setLiquidaciones(liquidacionesData);
    } catch (error) {
      console.error('Error calculating liquidaciones:', error);
      toast.error('Error al calcular liquidaciones');
    } finally {
      setLoading(false);
    }
  };

  const cargarHistorial = async () => {
    const empleadosActivos = empleados.filter(e => e.activo);
    const { data } = await supabase
      .from('empleado_liquidaciones')
      .select('*')
      .in('empleado_id', empleadosActivos.map(e => e.id))
      .order('fecha_desde', { ascending: false })
      .limit(100);
    setHistorial(data ?? []);
  };

  const handleGenerarClick = (liq: LiquidacionData) => {
    const startPendientes = () => {
      if ((liq.pendientes_chofer?.length ?? 0) > 0) {
        setPendientesDialog({ liq, seleccionados: new Set(liq.pendientes_chofer!.map(p => p.id)) });
      } else {
        generarLiquidacion(liq);
      }
    };
    if ((liq.overlap?.length ?? 0) > 0) {
      setOverlapConfirm({ liq, pendientesIds: [] });
      return;
    }
    startPendientes();
  };

  const generarLiquidacion = async (data: LiquidacionData, pendientesIds: string[] = []) => {
    if (!user) return;
    setProcessingId(data.empleado.id);

    try {
      // Calcular monto de pendientes seleccionados para descontar
      const pendientesSeleccionados = (data.pendientes_chofer ?? []).filter(p => pendientesIds.includes(p.id));
      const totalPendientes = pendientesSeleccionados.reduce((s, p) => s + p.monto, 0);
      const total_descuentos = data.total_compras + data.total_adelantos + totalPendientes;
      const neto_final = data.sueldo_base + data.total_comisiones - total_descuentos;

      const desdeDate = parseISO(fechaDesde);
      const mes = desdeDate.getMonth() + 1;
      const anio = desdeDate.getFullYear();

      // Create liquidacion record
      const { data: liqInsertada, error: liqError } = await supabase
        .from('empleado_liquidaciones')
        .insert([{
          empleado_id: data.empleado.id,
          mes,
          anio,
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          sueldo_base: data.sueldo_base,
          total_descuentos,
          total_comisiones: data.total_comisiones,
          neto_a_pagar: neto_final,
          estado: 'pendiente',
          usuario_id: user.id,
        }])
        .select('id')
        .single();

      if (liqError) {
        if (liqError.code === '23505') {
          toast.error('Ya existe una liquidación para este empleado en este período');
        } else {
          throw liqError;
        }
        return;
      }

      // Marcar pendientes seleccionados como descontados
      if (pendientesIds.length > 0 && liqInsertada?.id) {
        const { error: pErr } = await (supabase as any)
          .from('chofer_pendientes')
          .update({ estado: 'descontado', liquidacion_id: liqInsertada.id })
          .in('id', pendientesIds);
        if (pErr) console.error('Error al marcar pendientes como descontados', pErr);
      }

      // Create liquidacion movement to clear the account
      if (data.total_compras + data.total_adelantos > 0) {
        await supabase.from('empleado_movimientos').insert([{
          empleado_id: data.empleado.id,
          tipo: 'liquidacion',
          monto: data.total_compras + data.total_adelantos,
          concepto: `Liquidación ${format(parseISO(fechaDesde), 'dd/MM/yyyy')} - ${format(parseISO(fechaHasta), 'dd/MM/yyyy')}`,
          fecha: new Date().toISOString().split('T')[0],
          usuario_registro_id: user.id,
        }]);
      }

      toast.success('Liquidación generada correctamente');
      await generarExcelDetalle(data);
      calcularLiquidaciones();
      if (historialOpen) cargarHistorial();
      onRefresh();
    } catch (error) {
      console.error('Error generating liquidacion:', error);
      toast.error('Error al generar la liquidación');
    } finally {
      setProcessingId(null);
      setPendientesDialog(null);
      setOverlapConfirm(null);
    }
  };

  const abrirDialogoPago = (liq: LiquidacionData) => {
    if (!liq.liquidacion_existente) return;
    
    setLiquidacionAPagar({
      id: liq.liquidacion_existente.id,
      empleadoNombre: liq.empleado.nombre,
      monto: liq.neto_a_pagar,
      sueldoBase: liq.sueldo_base,
      totalComisiones: liq.total_comisiones,
      totalDescuentos: liq.total_compras + liq.total_adelantos,
    });
    setPagarDialogOpen(true);
  };

  const handlePagoSuccess = () => {
    calcularLiquidaciones();
    if (historialOpen) cargarHistorial();
    onRefresh();
  };

  const handleReimprimirRecibo = (liq: LiquidacionData) => {
    const desdeDate = parseISO(fechaDesde);
    const success = imprimirReciboLiquidacion({
      empleadoNombre: liq.empleado.nombre,
      mes: desdeDate.getMonth() + 1,
      anio: desdeDate.getFullYear(),
      sueldoBase: liq.sueldo_base,
      totalComisiones: liq.total_comisiones,
      totalDescuentos: liq.total_compras + liq.total_adelantos,
      netoAPagar: liq.neto_a_pagar,
      comercio: config ? {
        razonSocial: config.razon_social,
        nombreFantasia: config.nombre_fantasia,
        cuit: config.cuit,
        direccion: config.direccion,
        localidad: config.localidad,
        provincia: config.provincia,
        telefono: config.telefono,
      } : undefined,
    });
    
    if (!success) {
      toast.error('No se pudo abrir la ventana de impresión. Verifique que no estén bloqueados los popups.');
    }
  };

  const exportarExcel = () => {
    // resumen general (todas las liquidaciones del listado)
    const data = liquidaciones.map(l => ({
      'Empleado': l.empleado.nombre,
      'Sueldo Base': l.sueldo_base,
      'Compras': l.total_compras,
      'Adelantos': l.total_adelantos,
      'Comisiones': l.total_comisiones,
      'Neto a Pagar': l.neto_a_pagar,
      'Estado': l.liquidacion_existente?.estado || 'Sin generar',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidaciones');
    XLSX.writeFile(wb, `Liquidaciones_${fechaDesde}_a_${fechaHasta}.xlsx`);
    toast.success('Archivo exportado correctamente');
  };

  const generarExcelDetalle = async (data: LiquidacionData) => {
    try {
      const emp = data.empleado;
      const pct = Number(emp.comision_porcentaje || 0);
      const endDateNext = new Date(fechaHasta);
      endDateNext.setDate(endDateNext.getDate() + 1);
      const endDateNextStr = endDateNext.toISOString().split('T')[0];

      // Vendedores vinculados
      const { data: vendedoresData } = await supabase
        .from('vendedores')
        .select('id, nombre, empleado_id')
        .eq('empleado_id', emp.id);
      const vendIds = (vendedoresData ?? []).map((v: any) => v.id);

      // Pedidos web/reparto despachados en rango
      let pedidos: any[] = [];
      if (vendIds.length > 0) {
        const { data: pedData } = await supabase
          .from('pedidos')
          .select('id, numero_pedido, vendedor_id, total, estado, fecha_entrega_real, fecha_pedido, tipo_pedido, cliente:clientes(razon_social, nombre_fantasia)')
          .in('vendedor_id', vendIds)
          .eq('estado', 'despachado');
        pedidos = (pedData ?? []).filter((p: any) => {
          const f = p.fecha_entrega_real || p.fecha_pedido;
          if (!f) return false;
          const fd = f.split('T')[0];
          return fd >= fechaDesde && fd <= fechaHasta;
        });
      }

      // Ventas tradicionales confirmadas
      const { data: ventasData } = await supabase
        .from('ventas')
        .select('id, numero_comprobante, total, estado, anulada, fecha, cliente:clientes(razon_social, nombre_fantasia)')
        .eq('empleado_id', emp.id)
        .eq('anulada', false)
        .eq('estado', 'confirmada')
        .gte('fecha', fechaDesde)
        .lte('fecha', endDateNextStr);

      const filasPedidos = pedidos.map((p: any) => {
        const total = Number(p.total || 0);
        const cliente = p.cliente?.nombre_fantasia || p.cliente?.razon_social || '';
        return {
          'Tipo': 'Pedido Web/Reparto',
          'Comprobante': p.numero_pedido ? `PED-${String(p.numero_pedido).padStart(6, '0')}` : p.id,
          'Fecha': (p.fecha_entrega_real || p.fecha_pedido || '').split('T')[0],
          'Cliente': cliente,
          'Total Venta': total,
          '% Comisión': pct,
          'Comisión': total * (pct / 100),
        };
      });

      const filasVentas = (ventasData ?? []).map((v: any) => {
        const total = Number(v.total || 0);
        const cliente = v.cliente?.nombre_fantasia || v.cliente?.razon_social || '';
        return {
          'Tipo': 'Venta Tradicional',
          'Comprobante': v.numero_comprobante || v.id,
          'Fecha': (v.fecha || '').split('T')[0],
          'Cliente': cliente,
          'Total Venta': total,
          '% Comisión': pct,
          'Comisión': total * (pct / 100),
        };
      });

      const todas = [...filasPedidos, ...filasVentas];
      const totalVentas = todas.reduce((s, r) => s + Number(r['Total Venta'] || 0), 0);
      const totalComision = todas.reduce((s, r) => s + Number(r['Comisión'] || 0), 0);

      const filasConTotales: any[] = [...todas, {}, {
        'Tipo': 'TOTAL',
        'Comprobante': '',
        'Fecha': '',
        'Cliente': '',
        'Total Venta': totalVentas,
        '% Comisión': '',
        'Comisión': totalComision,
      }];

      const ws = XLSX.utils.json_to_sheet(filasConTotales);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detalle Comisiones');
      const safeNombre = emp.nombre.replace(/[^a-zA-Z0-9]+/g, '_');
      XLSX.writeFile(wb, `Liquidacion_${safeNombre}_${fechaDesde}_a_${fechaHasta}.xlsx`);
    } catch (e) {
      console.error('Error generando excel detalle:', e);
      toast.error('No se pudo generar el Excel de detalle');
    }
  };

  const setPresetMes = () => {
    setFechaDesde(format(startOfMonth(today), 'yyyy-MM-dd'));
    setFechaHasta(format(endOfMonth(today), 'yyyy-MM-dd'));
  };
  const setPresetQuincena = (segunda: boolean) => {
    const y = today.getFullYear();
    const m = today.getMonth();
    if (!segunda) {
      setFechaDesde(format(new Date(y, m, 1), 'yyyy-MM-dd'));
      setFechaHasta(format(new Date(y, m, 15), 'yyyy-MM-dd'));
    } else {
      setFechaDesde(format(new Date(y, m, 16), 'yyyy-MM-dd'));
      setFechaHasta(format(endOfMonth(today), 'yyyy-MM-dd'));
    }
  };

  const totalNeto = liquidaciones.reduce((sum, l) => sum + l.neto_a_pagar, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Liquidación de Sueldos
          </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={exportarExcel}>
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const next = !historialOpen;
                setHistorialOpen(next);
                if (next) cargarHistorial();
              }}>
                <History className="h-4 w-4 mr-1" /> Historial
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-44" />
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button variant="ghost" size="sm" onClick={setPresetMes}>Mes actual</Button>
              <Button variant="ghost" size="sm" onClick={() => setPresetQuincena(false)}>1ª Quincena</Button>
              <Button variant="ghost" size="sm" onClick={() => setPresetQuincena(true)}>2ª Quincena</Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : liquidaciones.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No hay empleados activos para liquidar
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Sueldo Base</TableHead>
                  <TableHead className="text-right">Compras</TableHead>
                  <TableHead className="text-right">Adelantos</TableHead>
                  <TableHead className="text-right">Comisiones</TableHead>
                  <TableHead className="text-right">Neto a Pagar</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidaciones.map((liq) => (
                  <TableRow key={liq.empleado.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {liq.empleado.nombre}
                        {(liq.overlap?.length ?? 0) > 0 && !liq.liquidacion_existente && (
                          <span title={`${liq.overlap!.length} liquidación(es) solapan con este rango`}>
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      ${liq.sueldo_base.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -${liq.total_compras.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -${liq.total_adelantos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      <div
                        className="cursor-help"
                        title={
                          `Auto (${liq.comision_porcentaje}%): $${liq.comision_auto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n` +
                          `  • Ventas web: $${liq.ventas_web_monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n` +
                          `  • Ventas tradicionales: $${liq.ventas_tradicional_monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n` +
                          `Manual (movimientos): $${liq.comision_manual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        }
                      >
                        +${liq.total_comisiones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        {liq.comision_auto > 0 && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {liq.comision_porcentaje}% · web ${liq.ventas_web_monto.toLocaleString('es-AR', { maximumFractionDigits: 0 })} + trad ${liq.ventas_tradicional_monto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      ${liq.neto_a_pagar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {liq.liquidacion_existente ? (
                        <Badge variant={liq.liquidacion_existente.estado === 'pagada' ? 'default' : 'secondary'}>
                          {liq.liquidacion_existente.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sin generar</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!liq.liquidacion_existente ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleGenerarClick(liq)}
                          disabled={processingId === liq.empleado.id}
                        >
                          {processingId === liq.empleado.id
                            ? 'Generando...'
                            : (liq.pendientes_chofer?.length ?? 0) > 0
                              ? `Generar (${liq.pendientes_chofer!.length} pend.)`
                              : 'Generar'}
                        </Button>
                      ) : liq.liquidacion_existente.estado === 'pendiente' ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => abrirDialogoPago(liq)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Pagar
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleReimprimirRecibo(liq)}
                          title="Reimprimir recibo"
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Recibo
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex justify-end">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Neto a Pagar</p>
                <p className="text-2xl font-bold">
                  ${totalNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            {historialOpen && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" /> Historial de liquidaciones
                </h3>
                {historial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin liquidaciones registradas.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historial.map((h) => {
                        const emp = empleados.find(e => e.id === h.empleado_id);
                        const desde = h.fecha_desde ? format(parseISO(h.fecha_desde), 'dd/MM/yyyy', { locale: es }) : '—';
                        const hasta = h.fecha_hasta ? format(parseISO(h.fecha_hasta), 'dd/MM/yyyy', { locale: es }) : '—';
                        return (
                          <TableRow key={h.id}>
                            <TableCell>{emp?.nombre ?? h.empleado_id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm">{desde} → {hasta}</TableCell>
                            <TableCell className="text-right font-medium">
                              ${Number(h.neto_a_pagar).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={h.estado === 'pagada' ? 'default' : 'secondary'}>
                                {h.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {h.fecha_pago ? format(parseISO(h.fecha_pago), 'dd/MM/yyyy') : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Payment Dialog */}
      {liquidacionAPagar && user && (
        <PagarLiquidacionDialog
          open={pagarDialogOpen}
          onOpenChange={setPagarDialogOpen}
          liquidacionId={liquidacionAPagar.id}
          empleadoNombre={liquidacionAPagar.empleadoNombre}
          monto={liquidacionAPagar.monto}
          mes={parseISO(fechaDesde).getMonth() + 1}
          anio={parseISO(fechaDesde).getFullYear()}
          sueldoBase={liquidacionAPagar.sueldoBase}
          totalComisiones={liquidacionAPagar.totalComisiones}
          totalDescuentos={liquidacionAPagar.totalDescuentos}
          onSuccess={handlePagoSuccess}
          userId={user.id}
        />
      )}

      {/* Diálogo de confirmación por solapamiento */}
      <Dialog open={!!overlapConfirm} onOpenChange={(v) => { if (!v) setOverlapConfirm(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Período solapado
            </DialogTitle>
          </DialogHeader>
          {overlapConfirm && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{overlapConfirm.liq.empleado.nombre}</strong> ya tiene liquidaciones que se superponen
                con el rango <strong>{format(parseISO(fechaDesde), 'dd/MM/yyyy')}</strong> →{' '}
                <strong>{format(parseISO(fechaHasta), 'dd/MM/yyyy')}</strong>:
              </p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {overlapConfirm.liq.overlap!.map(o => (
                  <div key={o.id} className="text-sm border rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {format(parseISO(o.fecha_desde), 'dd/MM/yyyy')} → {format(parseISO(o.fecha_hasta), 'dd/MM/yyyy')}
                      </div>
                      <Badge variant={o.estado === 'pagada' ? 'default' : 'secondary'} className="mt-1">
                        {o.estado}
                      </Badge>
                    </div>
                    <div className="font-semibold">
                      ${o.neto_a_pagar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Si continuás, podés estar liquidando dos veces los mismos movimientos del período.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverlapConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!overlapConfirm) return;
                const liq = overlapConfirm.liq;
                setOverlapConfirm(null);
                if ((liq.pendientes_chofer?.length ?? 0) > 0) {
                  setPendientesDialog({ liq, seleccionados: new Set(liq.pendientes_chofer!.map(p => p.id)) });
                } else {
                  generarLiquidacion(liq);
                }
              }}
            >
              Continuar de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para seleccionar pendientes del chofer */}
      <Dialog open={!!pendientesDialog} onOpenChange={(v) => { if (!v) setPendientesDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pendientes de Chofer — {pendientesDialog?.liq.empleado.nombre}</DialogTitle>
          </DialogHeader>
          {pendientesDialog && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {pendientesDialog.liq.pendientes_chofer!.map(p => {
                const checked = pendientesDialog.seleccionados.has(p.id);
                return (
                  <label key={p.id} className="flex items-start gap-3 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = new Set(pendientesDialog.seleccionados);
                        if (v) next.add(p.id); else next.delete(p.id);
                        setPendientesDialog({ ...pendientesDialog, seleccionados: next });
                      }}
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">{p.concepto}</div>
                      <div className="text-xs text-muted-foreground">{p.fecha}</div>
                    </div>
                    <div className="font-semibold text-destructive">
                      ${p.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendientesDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => pendientesDialog && generarLiquidacion(
                pendientesDialog.liq,
                Array.from(pendientesDialog.seleccionados),
              )}
              disabled={processingId === pendientesDialog?.liq.empleado.id}
            >
              Generar liquidación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
