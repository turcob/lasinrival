import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, Search, Clock, CreditCard, Building2, FileUp, Paperclip, Eye, Upload, Sparkles, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ImportarBancoDialog } from '@/components/clientes/ImportarBancoDialog';

interface MovimientoPendiente {
  id: string;
  cliente_id: string;
  tipo: string;
  monto: number;
  fecha: string;
  concepto: string | null;
  forma_pago_id: string | null;
  estado_imputacion: string;
  created_at: string;
  cliente_nombre: string;
  forma_pago_nombre: string | null;
  usuario_registro_nombre: string | null;
  numero_operacion: string | null;
  cheque?: {
    numero_cheque: string;
    banco: string;
    emisor: string;
    fecha_emision: string;
    fecha_vencimiento: string;
    cuit_emisor: string | null;
    observaciones: string | null;
  } | null;
  source?: 'movimiento' | 'transferencia' | 'cheque';
  transferencia_id?: string;
  cheque_id?: string;
  venta_numero?: number | null;
  foto_comprobante_path?: string | null;
  foto_comprobante_nombre?: string | null;
  titular_nombre?: string | null;
  titular_cuil?: string | null;
  fecha_transferencia?: string | null;
  transferencia_origen?: string | null;
  observacion_rechazo?: string | null;
  rechazado_at?: string | null;
}

interface VentaPendiente {
  id: string;
  numero_comprobante: number;
  fecha: string;
  total: number;
  saldo_pendiente: number;
}

export default function Imputacion() {
  const { user } = useAuth();
  const [movimientos, setMovimientos] = useState<MovimientoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('pendientes');
  
  // Dialog states
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedMovimiento, setSelectedMovimiento] = useState<MovimientoPendiente | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Factura selection states
  const [ventasPendientes, setVentasPendientes] = useState<VentaPendiente[]>([]);
  const [selectedVentas, setSelectedVentas] = useState<string[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [conceptoImputacion, setConceptoImputacion] = useState('');
  const [importarBancoOpen, setImportarBancoOpen] = useState(false);
  useEffect(() => {
    fetchMovimientos();
  }, []);

  const fetchMovimientos = async () => {
    setLoading(true);
    try {
      // Fetch movimientos with estado_imputacion
      const { data: movData, error: movError } = await supabase
        .from('cliente_movimientos')
        .select('*')
        .in('estado_imputacion', ['pendiente', 'confirmado', 'rechazado'])
        .order('created_at', { ascending: false });

      if (movError) throw movError;

      // Get unique client IDs, forma_pago IDs, and user IDs
      const clienteIds = [...new Set((movData || []).map(m => m.cliente_id))];
      const formaPagoIds = [...new Set((movData || []).filter(m => m.forma_pago_id).map(m => m.forma_pago_id!))];
      const usuarioIds = [...new Set((movData || []).map(m => m.usuario_registro_id))];
      const movimientoIds = (movData || []).map(m => m.id);

      // Fetch related data in parallel
      const [clientesRes, formasPagoRes, usuariosRes, chequesRes] = await Promise.all([
        clienteIds.length > 0 
          ? supabase.from('clientes').select('id, nombre').in('id', clienteIds)
          : { data: [] },
        formaPagoIds.length > 0 
          ? supabase.from('formas_pago').select('id, nombre').in('id', formaPagoIds)
          : { data: [] },
        usuarioIds.length > 0 
          ? supabase.from('profiles').select('id, nombre').in('id', usuarioIds)
          : { data: [] },
        movimientoIds.length > 0
          ? supabase.from('cheque_detalles').select('*').in('cliente_movimiento_id', movimientoIds)
          : { data: [] },
      ]);

      const clientesMap = new Map((clientesRes.data || []).map(c => [c.id, c.nombre]));
      const formasPagoMap = new Map((formasPagoRes.data || []).map(f => [f.id, f.nombre]));
      const usuariosMap = new Map((usuariosRes.data || []).map(u => [u.id, u.nombre]));
      const chequesMap = new Map((chequesRes.data || []).map(ch => [ch.cliente_movimiento_id, ch]));

      const movimientosCompletos: MovimientoPendiente[] = (movData || []).map(m => ({
        ...m,
        cliente_nombre: clientesMap.get(m.cliente_id) || 'Cliente desconocido',
        forma_pago_nombre: m.forma_pago_id ? formasPagoMap.get(m.forma_pago_id) || null : null,
        usuario_registro_nombre: usuariosMap.get(m.usuario_registro_id) || null,
        numero_operacion: (m as any).numero_operacion || null,
        cheque: chequesMap.get(m.id) || null,
        source: 'movimiento' as const,
      }));

      // Fetch standalone transferencias (origen='venta' o 'manual') que no estén
      // ligadas a un cliente_movimiento — vienen del POS o de carga manual.
      const { data: transfData, error: transfError } = await supabase
        .from('transferencias')
        .select('*')
        .is('cliente_movimiento_id', null)
        .in('estado', ['pendiente', 'validada', 'rechazada'])
        .order('created_at', { ascending: false });

      if (transfError) throw transfError;

      const transfClienteIds = [...new Set((transfData || [])
        .map(t => t.cliente_id)
        .filter((id): id is string => !!id))];
      const transfVentaIds = [...new Set((transfData || [])
        .map(t => t.venta_id)
        .filter((id): id is string => !!id))];

      const [transfClientesRes, transfVentasRes] = await Promise.all([
        transfClienteIds.length > 0
          ? supabase.from('clientes').select('id, nombre').in('id', transfClienteIds)
          : Promise.resolve({ data: [] as any[] }),
        transfVentaIds.length > 0
          ? supabase.from('ventas').select('id, numero_comprobante').in('id', transfVentaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const transfClientesMap = new Map((transfClientesRes.data || []).map((c: any) => [c.id, c.nombre]));
      const transfVentasMap = new Map((transfVentasRes.data || []).map((v: any) => [v.id, v.numero_comprobante]));

      const estadoMap: Record<string, string> = {
        pendiente: 'pendiente',
        validada: 'confirmado',
        rechazada: 'rechazado',
      };

      const transferenciasComoMov: MovimientoPendiente[] = (transfData || []).map((t: any) => {
        const ventaNro = t.venta_id ? transfVentasMap.get(t.venta_id) : null;
        const conceptoBase = t.origen === 'venta' && ventaNro
          ? `Transferencia venta POS #${ventaNro}`
          : `Transferencia · ${t.titular_nombre}`;
        return {
          id: `transf:${t.id}`,
          cliente_id: t.cliente_id || '',
          tipo: 'pago',
          monto: Number(t.importe),
          fecha: t.fecha_transferencia,
          concepto: conceptoBase,
          forma_pago_id: null,
          estado_imputacion: estadoMap[t.estado] || 'pendiente',
          created_at: t.created_at,
          cliente_nombre: t.cliente_id
            ? (transfClientesMap.get(t.cliente_id) || 'Cliente desconocido')
            : 'Consumidor Final',
          forma_pago_nombre: 'Transferencia',
          usuario_registro_nombre: null,
          numero_operacion: t.numero_operacion || null,
          cheque: null,
          source: 'transferencia' as const,
          transferencia_id: t.id,
          venta_numero: ventaNro || null,
          foto_comprobante_path: t.foto_comprobante_path || null,
          foto_comprobante_nombre: t.foto_comprobante_nombre || null,
          titular_nombre: t.titular_nombre || null,
          titular_cuil: t.titular_cuil || null,
          fecha_transferencia: t.fecha_transferencia || null,
          transferencia_origen: t.origen || null,
          observacion_rechazo: t.observacion_rechazo || null,
          rechazado_at: t.rechazado_at || null,
        };
      });

      // Fetch cheques registrados desde POS (estado 'pendiente_validacion',
      // o ya procesados: 'en_cartera' = confirmado, 'rechazado' = rechazado),
      // que tengan venta_id (vienen del POS).
      const { data: chequesData, error: chequesError } = await supabase
        .from('cheques')
        .select('*')
        .in('estado', ['pendiente_validacion', 'en_cartera', 'rechazado'] as any)
        .not('venta_id', 'is', null)
        .order('created_at', { ascending: false });

      if (chequesError) throw chequesError;

      const chequeClienteIds = [...new Set((chequesData || [])
        .map((c: any) => c.cliente_id)
        .filter((id): id is string => !!id))];
      const chequeVentaIds = [...new Set((chequesData || [])
        .map((c: any) => c.venta_id)
        .filter((id): id is string => !!id))];

      const [chequeClientesRes, chequeVentasRes] = await Promise.all([
        chequeClienteIds.length > 0
          ? supabase.from('clientes').select('id, nombre').in('id', chequeClienteIds)
          : Promise.resolve({ data: [] as any[] }),
        chequeVentaIds.length > 0
          ? supabase.from('ventas').select('id, numero_comprobante').in('id', chequeVentaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const chequeClientesMap = new Map((chequeClientesRes.data || []).map((c: any) => [c.id, c.nombre]));
      const chequeVentasMap = new Map((chequeVentasRes.data || []).map((v: any) => [v.id, v.numero_comprobante]));

      const chequeEstadoMap: Record<string, string> = {
        pendiente_validacion: 'pendiente',
        en_cartera: 'confirmado',
        rechazado: 'rechazado',
      };

      const chequesComoMov: MovimientoPendiente[] = (chequesData || []).map((c: any) => {
        const ventaNro = c.venta_id ? chequeVentasMap.get(c.venta_id) : null;
        return {
          id: `cheque:${c.id}`,
          cliente_id: c.cliente_id || '',
          tipo: 'pago',
          monto: Number(c.monto),
          fecha: c.fecha_emision,
          concepto: ventaNro ? `Cheque venta POS #${ventaNro}` : `Cheque · ${c.emisor}`,
          forma_pago_id: null,
          estado_imputacion: chequeEstadoMap[c.estado] || 'pendiente',
          created_at: c.created_at,
          cliente_nombre: c.cliente_id
            ? (chequeClientesMap.get(c.cliente_id) || 'Cliente desconocido')
            : 'Consumidor Final',
          forma_pago_nombre: 'Cheque',
          usuario_registro_nombre: null,
          numero_operacion: c.numero_cheque || null,
          cheque: {
            numero_cheque: c.numero_cheque,
            banco: c.banco,
            emisor: c.emisor,
            fecha_emision: c.fecha_emision,
            fecha_vencimiento: c.fecha_vencimiento,
            cuit_emisor: c.cuit_emisor,
            observaciones: c.observaciones,
          },
          source: 'cheque' as const,
          cheque_id: c.id,
          venta_numero: ventaNro || null,
          observacion_rechazo: c.motivo_rechazo || null,
        };
      });

      const combinados = [...movimientosCompletos, ...transferenciasComoMov, ...chequesComoMov].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setMovimientos(combinados);
    } catch (error) {
      console.error('Error fetching movimientos:', error);
      toast.error('Error al cargar los movimientos');
    } finally {
      setLoading(false);
    }
  };

  const filteredMovimientos = movimientos.filter(m => {
    const matchesSearch = 
      m.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.cheque?.numero_cheque?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.cheque?.banco?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.numero_operacion?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedTab === 'pendientes') {
      return matchesSearch && m.estado_imputacion === 'pendiente';
    } else if (selectedTab === 'confirmados') {
      return matchesSearch && m.estado_imputacion === 'confirmado';
    } else if (selectedTab === 'rechazados') {
      return matchesSearch && m.estado_imputacion === 'rechazado';
    }
    return matchesSearch;
  });

  const fetchVentasPendientes = async (clienteId: string) => {
    setLoadingVentas(true);
    try {
      // Obtener ventas del cliente que tienen movimientos tipo 'compra' en cuenta corriente
      const { data: movCompras, error: movError } = await supabase
        .from('cliente_movimientos')
        .select('venta_id, monto')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'compra')
        .not('venta_id', 'is', null);

      if (movError) throw movError;

      // Obtener pagos confirmados para cada venta
      const { data: movPagos, error: pagosError } = await supabase
        .from('cliente_movimientos')
        .select('venta_id, monto')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'pago')
        .eq('estado_imputacion', 'confirmado')
        .not('venta_id', 'is', null);

      if (pagosError) throw pagosError;

      // Calcular saldos por venta
      const ventaMontos = new Map<string, { compra: number; pagado: number }>();
      
      (movCompras || []).forEach(m => {
        if (m.venta_id) {
          const current = ventaMontos.get(m.venta_id) || { compra: 0, pagado: 0 };
          current.compra += Number(m.monto);
          ventaMontos.set(m.venta_id, current);
        }
      });

      (movPagos || []).forEach(m => {
        if (m.venta_id) {
          const current = ventaMontos.get(m.venta_id) || { compra: 0, pagado: 0 };
          current.pagado += Number(m.monto);
          ventaMontos.set(m.venta_id, current);
        }
      });

      // Filtrar ventas con saldo pendiente
      const ventaIds = Array.from(ventaMontos.entries())
        .filter(([_, v]) => v.compra > v.pagado)
        .map(([id]) => id);

      if (ventaIds.length === 0) {
        setVentasPendientes([]);
        return;
      }

      // Obtener detalles de las ventas
      const { data: ventas, error: ventasError } = await supabase
        .from('ventas')
        .select('id, numero_comprobante, fecha, total')
        .in('id', ventaIds)
        .order('fecha', { ascending: true });

      if (ventasError) throw ventasError;

      const ventasConSaldo: VentaPendiente[] = (ventas || []).map(v => {
        const montos = ventaMontos.get(v.id) || { compra: 0, pagado: 0 };
        return {
          ...v,
          saldo_pendiente: montos.compra - montos.pagado,
        };
      }).filter(v => v.saldo_pendiente > 0);

      setVentasPendientes(ventasConSaldo);
    } catch (error) {
      console.error('Error fetching ventas pendientes:', error);
      setVentasPendientes([]);
    } finally {
      setLoadingVentas(false);
    }
  };

  const handleConfirmar = async () => {
    if (!selectedMovimiento || !user) return;
    
    setProcessing(true);
    try {
      // Caso transferencia POS / standalone → actualiza la tabla transferencias
      if (selectedMovimiento.source === 'transferencia' && selectedMovimiento.transferencia_id) {
        // Revalidación de duplicados global: si otro registro validado ya usa
        // el mismo numero_operacion (incluso de otro cliente), avisamos.
        const numOp = selectedMovimiento.numero_operacion?.trim();
        if (numOp) {
          const { data: dupes } = await supabase
            .from('transferencias')
            .select('id, cliente_id, importe, fecha_transferencia')
            .eq('numero_operacion', numOp)
            .eq('estado', 'validada')
            .neq('id', selectedMovimiento.transferencia_id);
          if (dupes && dupes.length > 0) {
            const otroCliente = dupes.some(d => d.cliente_id !== selectedMovimiento.cliente_id);
            const msg = otroCliente
              ? `Ya existe una transferencia validada con el mismo Nº de operación (${numOp}) en OTRO cliente. ¿Confirmar de todas formas?`
              : `Ya existe una transferencia validada con el mismo Nº de operación (${numOp}). ¿Confirmar de todas formas?`;
            if (!window.confirm(msg)) {
              setProcessing(false);
              return;
            }
          }
        }
        const { error } = await supabase
          .from('transferencias')
          .update({ estado: 'validada' })
          .eq('id', selectedMovimiento.transferencia_id);
        if (error) throw error;
        toast.success('Transferencia validada correctamente');
        setConfirmDialogOpen(false);
        setSelectedMovimiento(null);
        setSelectedVentas([]);
        setConceptoImputacion('');
        setVentasPendientes([]);
        fetchMovimientos();
        return;
      }

      // Caso cheque POS → actualiza la tabla cheques (pendiente_validacion -> en_cartera)
      if (selectedMovimiento.source === 'cheque' && selectedMovimiento.cheque_id) {
        const { error } = await supabase
          .from('cheques')
          .update({ estado: 'en_cartera' as any })
          .eq('id', selectedMovimiento.cheque_id);
        if (error) throw error;
        toast.success('Cheque validado correctamente');
        setConfirmDialogOpen(false);
        setSelectedMovimiento(null);
        setSelectedVentas([]);
        setConceptoImputacion('');
        setVentasPendientes([]);
        fetchMovimientos();
        return;
      }

      // Construir concepto con las facturas seleccionadas
      let conceptoFinal = selectedMovimiento.concepto || '';
      if (selectedVentas.length > 0) {
        const ventasSeleccionadas = ventasPendientes.filter(v => selectedVentas.includes(v.id));
        const facturasTexto = ventasSeleccionadas.map(v => `Fact. #${v.numero_comprobante}`).join(', ');
        conceptoFinal = conceptoFinal 
          ? `${conceptoFinal} - Imputa a: ${facturasTexto}`
          : `Imputa a: ${facturasTexto}`;
      } else if (conceptoImputacion.trim()) {
        conceptoFinal = conceptoFinal 
          ? `${conceptoFinal} - ${conceptoImputacion.trim()}`
          : conceptoImputacion.trim();
      }

      const { error } = await supabase
        .from('cliente_movimientos')
        .update({
          estado_imputacion: 'confirmado',
          fecha_imputacion: new Date().toISOString(),
          imputado_por: user.id,
          concepto: conceptoFinal || selectedMovimiento.concepto,
        })
        .eq('id', selectedMovimiento.id);

      if (error) throw error;

      toast.success('Movimiento confirmado correctamente');
      setConfirmDialogOpen(false);
      setSelectedMovimiento(null);
      setSelectedVentas([]);
      setConceptoImputacion('');
      setVentasPendientes([]);
      fetchMovimientos();
    } catch (error) {
      console.error('Error confirming movimiento:', error);
      toast.error('Error al confirmar el movimiento');
    } finally {
      setProcessing(false);
    }
  };

  const handleRechazar = async () => {
    if (!selectedMovimiento || !user || !motivoRechazo.trim()) return;
    
    setProcessing(true);
    try {
      if (selectedMovimiento.source === 'transferencia' && selectedMovimiento.transferencia_id) {
        const { error } = await supabase
          .from('transferencias')
          .update({ estado: 'rechazada', observacion_rechazo: motivoRechazo.trim() })
          .eq('id', selectedMovimiento.transferencia_id);
        if (error) throw error;
        toast.success('Transferencia rechazada');
        setRejectDialogOpen(false);
        setSelectedMovimiento(null);
        setMotivoRechazo('');
        fetchMovimientos();
        return;
      }

      if (selectedMovimiento.source === 'cheque' && selectedMovimiento.cheque_id) {
        const { error } = await supabase
          .from('cheques')
          .update({
            estado: 'rechazado' as any,
            motivo_rechazo: motivoRechazo.trim(),
            fecha_rechazo: new Date().toISOString().slice(0, 10),
          })
          .eq('id', selectedMovimiento.cheque_id);
        if (error) throw error;
        toast.success('Cheque rechazado');
        setRejectDialogOpen(false);
        setSelectedMovimiento(null);
        setMotivoRechazo('');
        fetchMovimientos();
        return;
      }

      const { error } = await supabase
        .from('cliente_movimientos')
        .update({
          estado_imputacion: 'rechazado',
          fecha_imputacion: new Date().toISOString(),
          imputado_por: user.id,
          motivo_rechazo: motivoRechazo.trim(),
        })
        .eq('id', selectedMovimiento.id);

      if (error) throw error;

      toast.success('Movimiento rechazado');
      setRejectDialogOpen(false);
      setSelectedMovimiento(null);
      setMotivoRechazo('');
      fetchMovimientos();
    } catch (error) {
      console.error('Error rejecting movimiento:', error);
      toast.error('Error al rechazar el movimiento');
    } finally {
      setProcessing(false);
    }
  };

  const openConfirmDialog = (mov: MovimientoPendiente) => {
    setSelectedMovimiento(mov);
    setSelectedVentas([]);
    setConceptoImputacion('');
    setConfirmDialogOpen(true);
    if (mov.source !== 'transferencia' && mov.source !== 'cheque' && mov.cliente_id) {
      fetchVentasPendientes(mov.cliente_id);
    } else {
      setVentasPendientes([]);
    }
  };

  const toggleVentaSelection = (ventaId: string) => {
    setSelectedVentas(prev => 
      prev.includes(ventaId) 
        ? prev.filter(id => id !== ventaId)
        : [...prev, ventaId]
    );
  };

  const openRejectDialog = (mov: MovimientoPendiente) => {
    setSelectedMovimiento(mov);
    setMotivoRechazo('');
    setRejectDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const pendientesCount = movimientos.filter(m => m.estado_imputacion === 'pendiente').length;

  const esCheque = (mov: MovimientoPendiente) => {
    return mov.forma_pago_nombre?.toLowerCase().includes('cheque') && mov.cheque;
  };

  const esTransferencia = (mov: MovimientoPendiente) => {
    return mov.forma_pago_nombre?.toLowerCase().includes('transferencia');
  };

  const [uploadingTransfId, setUploadingTransfId] = useState<string | null>(null);
  const [detalleTransfOpen, setDetalleTransfOpen] = useState(false);
  const [detalleTransfMov, setDetalleTransfMov] = useState<MovimientoPendiente | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [loadingComprobante, setLoadingComprobante] = useState(false);

  // Edición de campos faltantes en transferencia pendiente + autocompletado con IA
  type FieldSource = 'manual' | 'ai';
  type ConfLevel = 'alta' | 'media' | 'baja';
  interface EditableCampos {
    numero_operacion: string;
    titular_nombre: string;
    titular_cuil: string;
    fecha_transferencia: string;
    banco: string; // solo display, no se persiste
  }
  const [editableCampos, setEditableCampos] = useState<EditableCampos | null>(null);
  const [camposMeta, setCamposMeta] = useState<Record<string, { source: FieldSource; confianza?: ConfLevel }>>({});
  const [autocompletandoIA, setAutocompletandoIA] = useState(false);
  const [savingCampos, setSavingCampos] = useState(false);

  const transferenciaPendienteIncompleta = (mov: MovimientoPendiente | null) => {
    if (!mov || mov.source !== 'transferencia') return false;
    if (mov.estado_imputacion !== 'pendiente') return false;
    return !mov.numero_operacion || !mov.titular_cuil || !mov.titular_nombre;
  };

  const setCampo = (key: keyof EditableCampos, value: string) => {
    setEditableCampos(prev => (prev ? { ...prev, [key]: value } : prev));
    // Al editar manualmente, marcar el campo como manual
    setCamposMeta(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      return next;
    });
  };

  const handleAutocompletarIA = async () => {
    if (!detalleTransfMov?.foto_comprobante_path || !editableCampos) return;
    const path = detalleTransfMov.foto_comprobante_path;
    if (/\.pdf$/i.test(path)) {
      toast.error('Solo imágenes JPG/PNG por IA. Los PDF deben completarse manualmente.');
      return;
    }
    setAutocompletandoIA(true);
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('comprobantes-cobros')
        .download(path);
      if (dlErr || !blob) throw dlErr || new Error('No se pudo descargar el comprobante');

      const mimeType = blob.type || 'image/jpeg';
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      const imageBase64 = dataUrl.split(',')[1];

      const { data, error } = await supabase.functions.invoke('extraer-numero-operacion', {
        body: { imageBase64, mimeType },
      });
      if (error) throw error;

      const r = (data || {}) as {
        numero_operacion: string | null;
        fecha: string | null;
        cuil_titular: string | null;
        titular: string | null;
        banco: string | null;
        confianza?: ConfLevel;
        confianza_campos?: Record<string, ConfLevel>;
      };

      const cc = r.confianza_campos || {};
      const nuevoMeta: Record<string, { source: FieldSource; confianza?: ConfLevel }> = { ...camposMeta };
      const next = { ...editableCampos };

      // Solo rellenar campos hoy vacíos; nunca pisar lo editado por el usuario
      if (!next.numero_operacion && r.numero_operacion) {
        next.numero_operacion = r.numero_operacion;
        nuevoMeta.numero_operacion = { source: 'ai', confianza: r.confianza };
      }
      if (!next.fecha_transferencia && r.fecha) {
        next.fecha_transferencia = r.fecha;
        nuevoMeta.fecha_transferencia = { source: 'ai', confianza: cc.fecha };
      }
      if (!next.titular_cuil && r.cuil_titular) {
        next.titular_cuil = r.cuil_titular;
        nuevoMeta.titular_cuil = { source: 'ai', confianza: cc.cuil_titular };
      }
      if (!next.titular_nombre && r.titular) {
        next.titular_nombre = r.titular;
        nuevoMeta.titular_nombre = { source: 'ai', confianza: cc.titular };
      }
      if (!next.banco && r.banco) {
        next.banco = r.banco;
        nuevoMeta.banco = { source: 'ai', confianza: cc.banco };
      }

      setEditableCampos(next);
      setCamposMeta(nuevoMeta);
      toast.success('Comprobante analizado con IA. Revisá los datos antes de validar.');
    } catch (e: any) {
      console.error('Error autocompletando con IA:', e);
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('429')) toast.error('Demasiadas solicitudes de IA. Reintentá en unos segundos.');
      else if (msg.includes('402')) toast.error('Créditos de IA insuficientes.');
      else toast.error('No se pudo analizar el comprobante con IA');
    } finally {
      setAutocompletandoIA(false);
    }
  };

  const handleGuardarCampos = async () => {
    if (!detalleTransfMov?.transferencia_id || !editableCampos) return;
    const cuilDigits = editableCampos.titular_cuil.replace(/\D/g, '');
    if (cuilDigits && cuilDigits.length !== 11) {
      toast.error('El CUIL/CUIT debe tener 11 dígitos, o dejarse vacío');
      return;
    }
    if (editableCampos.fecha_transferencia && !/^\d{4}-\d{2}-\d{2}$/.test(editableCampos.fecha_transferencia)) {
      toast.error('Fecha inválida');
      return;
    }
    setSavingCampos(true);
    try {
      const payload: any = {
        numero_operacion: editableCampos.numero_operacion.trim() || null,
        titular_nombre: editableCampos.titular_nombre.trim() || null,
        titular_cuil: cuilDigits || null,
      };
      if (editableCampos.fecha_transferencia) {
        payload.fecha_transferencia = editableCampos.fecha_transferencia;
      }
      const { error } = await supabase
        .from('transferencias')
        .update(payload)
        .eq('id', detalleTransfMov.transferencia_id);
      if (error) throw error;

      toast.success('Datos de la transferencia actualizados');
      setDetalleTransfMov({
        ...detalleTransfMov,
        numero_operacion: payload.numero_operacion,
        titular_nombre: payload.titular_nombre,
        titular_cuil: payload.titular_cuil,
        fecha_transferencia: payload.fecha_transferencia || detalleTransfMov.fecha_transferencia,
      });
      setCamposMeta({});
      fetchMovimientos();
    } catch (e: any) {
      console.error('Error guardando campos:', e);
      toast.error('No se pudo guardar: ' + (e?.message || ''));
    } finally {
      setSavingCampos(false);
    }
  };

  const openDetalleTransferencia = async (mov: MovimientoPendiente) => {
    setDetalleTransfMov(mov);
    setDetalleTransfOpen(true);
    setComprobanteUrl(null);
    setCamposMeta({});
    setEditableCampos({
      numero_operacion: mov.numero_operacion || '',
      titular_nombre: mov.titular_nombre || '',
      titular_cuil: mov.titular_cuil || '',
      fecha_transferencia: mov.fecha_transferencia || '',
      banco: '',
    });
    if (mov.foto_comprobante_path) {
      setLoadingComprobante(true);
      try {
        const { data, error } = await supabase.storage
          .from('comprobantes-cobros')
          .createSignedUrl(mov.foto_comprobante_path, 60 * 10);
        if (error) throw error;
        setComprobanteUrl(data?.signedUrl || null);
      } catch (e) {
        console.error('Error firmando URL:', e);
      } finally {
        setLoadingComprobante(false);
      }
    }
  };

  const handleVerComprobante = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('comprobantes-cobros')
        .createSignedUrl(path, 60 * 10);
      if (error || !data?.signedUrl) throw error || new Error('No se pudo generar URL');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      console.error('Error abriendo comprobante:', e);
      toast.error('No se pudo abrir el comprobante');
    }
  };

  const handleUploadComprobante = async (
    mov: MovimientoPendiente,
    file: File
  ) => {
    if (!mov.transferencia_id) return;
    setUploadingTransfId(mov.transferencia_id);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `transferencias/${mov.transferencia_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('comprobantes-cobros')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg',
        });
      if (upErr) throw upErr;

      // Eliminar el anterior si existía
      if (mov.foto_comprobante_path) {
        await supabase.storage
          .from('comprobantes-cobros')
          .remove([mov.foto_comprobante_path])
          .catch(() => {});
      }

      const { error: updErr } = await supabase
        .from('transferencias')
        .update({
          foto_comprobante_path: fileName,
          foto_comprobante_nombre: file.name,
        })
        .eq('id', mov.transferencia_id);
      if (updErr) throw updErr;

      toast.success(mov.foto_comprobante_path ? 'Comprobante reemplazado' : 'Comprobante adjuntado');
      // Refrescar detalle abierto
      if (detalleTransfMov?.transferencia_id === mov.transferencia_id) {
        const { data: signed } = await supabase.storage
          .from('comprobantes-cobros')
          .createSignedUrl(fileName, 60 * 10);
        setComprobanteUrl(signed?.signedUrl || null);
        setDetalleTransfMov({
          ...detalleTransfMov,
          foto_comprobante_path: fileName,
          foto_comprobante_nombre: file.name,
        });
      }
      fetchMovimientos();
    } catch (e: any) {
      console.error('Error subiendo comprobante:', e);
      toast.error('Error al subir el comprobante: ' + (e?.message || ''));
    } finally {
      setUploadingTransfId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Imputación de Pagos"
          description="Gestión de cheques y transferencias pendientes de confirmación"
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{pendientesCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cheques Pendientes</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {movimientos.filter(m => m.estado_imputacion === 'pendiente' && esCheque(m)).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transferencias Pendientes</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {movimientos.filter(m => m.estado_imputacion === 'pendiente' && esTransferencia(m)).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Import */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, nº cheque, banco o nº operación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={() => setImportarBancoOpen(true)}>
            <FileUp className="h-4 w-4 mr-2" />
            Importar Extracto Bancario
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="pendientes" className="relative">
              Pendientes
              {pendientesCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {pendientesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="confirmados">Confirmados</TabsTrigger>
            <TabsTrigger value="rechazados">Rechazados</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredMovimientos.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No hay movimientos en esta categoría
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Forma de Pago</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      {selectedTab === 'pendientes' && <TableHead>Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovimientos.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-sm">
                          {format(new Date(mov.fecha), 'dd/MM/yyyy', { locale: es })}
                        </TableCell>
                        <TableCell className="font-medium">{mov.cliente_nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{mov.tipo}</Badge>
                        </TableCell>
                        <TableCell>{mov.forma_pago_nombre || '-'}</TableCell>
                        <TableCell>
                          {mov.cheque ? (
                            <div className="text-xs space-y-0.5">
                              <div><span className="text-muted-foreground">Nº:</span> {mov.cheque.numero_cheque}</div>
                              <div><span className="text-muted-foreground">Banco:</span> {mov.cheque.banco}</div>
                              <div><span className="text-muted-foreground">Emisor:</span> {mov.cheque.emisor}</div>
                              <div><span className="text-muted-foreground">Vto:</span> {format(new Date(mov.cheque.fecha_vencimiento), 'dd/MM/yyyy')}</div>
                            </div>
                          ) : mov.source === 'transferencia' ? (
                            <div className="flex items-center gap-2">
                              <div className="text-xs">
                                {mov.venta_numero && (
                                  <div><span className="text-muted-foreground">Venta:</span> #{mov.venta_numero}</div>
                                )}
                                {mov.numero_operacion && (
                                  <div><span className="text-muted-foreground">Nro. Op.:</span> <span className="font-mono">{mov.numero_operacion}</span></div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => openDetalleTransferencia(mov)}
                              >
                                <Eye className="h-3 w-3 mr-1" /> Ver detalle
                              </Button>
                            </div>
                          ) : mov.numero_operacion ? (
                            <div className="text-xs space-y-0.5">
                              <div><span className="text-muted-foreground">Nro. Op.:</span> <span className="font-mono">{mov.numero_operacion}</span></div>
                              {mov.concepto && <div className="text-muted-foreground">{mov.concepto}</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">{mov.concepto || '-'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(mov.monto)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              mov.estado_imputacion === 'confirmado' ? 'default' :
                              mov.estado_imputacion === 'rechazado' ? 'destructive' : 'secondary'
                            }
                          >
                            {mov.estado_imputacion}
                          </Badge>
                        </TableCell>
                        {selectedTab === 'pendientes' && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => openConfirmDialog(mov)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => openRejectDialog(mov)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Confirm Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Confirmar Imputación</DialogTitle>
            </DialogHeader>
            {selectedMovimiento && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-md space-y-2">
                  <div><strong>Cliente:</strong> {selectedMovimiento.cliente_nombre}</div>
                  <div><strong>Monto:</strong> {formatCurrency(selectedMovimiento.monto)}</div>
                  <div><strong>Forma de Pago:</strong> {selectedMovimiento.forma_pago_nombre}</div>
                  {selectedMovimiento.cheque && (
                    <>
                      <div><strong>Nº Cheque:</strong> {selectedMovimiento.cheque.numero_cheque}</div>
                      <div><strong>Banco:</strong> {selectedMovimiento.cheque.banco}</div>
                      <div><strong>Emisor:</strong> {selectedMovimiento.cheque.emisor}</div>
                    </>
                  )}
                </div>

                {/* Sección de facturas pendientes */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Imputar a facturas (opcional)</Label>
                  
                  {loadingVentas ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : ventasPendientes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay facturas pendientes para este cliente
                    </p>
                  ) : (
                    <ScrollArea className="h-[200px] border rounded-md p-3">
                      <div className="space-y-2">
                        {ventasPendientes.map((venta) => (
                          <div 
                            key={venta.id} 
                            className={`flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-muted/50 ${
                              selectedVentas.includes(venta.id) ? 'bg-primary/10 border-primary' : ''
                            }`}
                            onClick={() => toggleVentaSelection(venta.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={selectedVentas.includes(venta.id)}
                                onCheckedChange={() => toggleVentaSelection(venta.id)}
                              />
                              <div>
                                <div className="font-medium">Factura #{venta.numero_comprobante}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(venta.fecha), 'dd/MM/yyyy', { locale: es })}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-destructive">
                                {formatCurrency(venta.saldo_pendiente)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Total: {formatCurrency(venta.total)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {selectedVentas.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {selectedVentas.length} factura(s) seleccionada(s) - Total saldo: {
                        formatCurrency(
                          ventasPendientes
                            .filter(v => selectedVentas.includes(v.id))
                            .reduce((sum, v) => sum + v.saldo_pendiente, 0)
                        )
                      }
                    </div>
                  )}

                  {ventasPendientes.length === 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Concepto de imputación</Label>
                      <Input
                        value={conceptoImputacion}
                        onChange={(e) => setConceptoImputacion(e.target.value)}
                        placeholder="Ej: Pago a cuenta, Anticipo..."
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmar} disabled={processing}>
                {processing ? 'Procesando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rechazar Imputación</DialogTitle>
            </DialogHeader>
            {selectedMovimiento && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-md space-y-2">
                  <div><strong>Cliente:</strong> {selectedMovimiento.cliente_nombre}</div>
                  <div><strong>Monto:</strong> {formatCurrency(selectedMovimiento.monto)}</div>
                  {selectedMovimiento.cheque && (
                    <>
                      <div><strong>Nº Cheque:</strong> {selectedMovimiento.cheque.numero_cheque}</div>
                      <div><strong>Banco:</strong> {selectedMovimiento.cheque.banco}</div>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Motivo del rechazo *</label>
                  <Textarea
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    placeholder="Ingrese el motivo del rechazo..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleRechazar} 
                disabled={processing || !motivoRechazo.trim()}
              >
                {processing ? 'Procesando...' : 'Rechazar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ImportarBancoDialog
          open={importarBancoOpen}
          onOpenChange={setImportarBancoOpen}
          onSuccess={fetchMovimientos}
        />

        {/* Detalle Transferencia Dialog */}
        <Dialog open={detalleTransfOpen} onOpenChange={setDetalleTransfOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalle de la Transferencia</DialogTitle>
            </DialogHeader>
            {detalleTransfMov && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted p-4 rounded-md">
                  <div>
                    <div className="text-xs text-muted-foreground">Cliente</div>
                    <div className="font-medium">{detalleTransfMov.cliente_nombre}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Importe</div>
                    <div className="font-medium">{formatCurrency(detalleTransfMov.monto)}</div>
                  </div>
                  {detalleTransfMov.venta_numero && (
                    <div>
                      <div className="text-xs text-muted-foreground">Nº Venta</div>
                      <div className="font-medium">#{detalleTransfMov.venta_numero}</div>
                    </div>
                  )}
                  {detalleTransfMov.transferencia_origen && (
                    <div>
                      <div className="text-xs text-muted-foreground">Origen</div>
                      <div className="font-medium capitalize">{detalleTransfMov.transferencia_origen}</div>
                    </div>
                  )}
                  {detalleTransfMov.titular_nombre && (
                    <div>
                      <div className="text-xs text-muted-foreground">Titular</div>
                      <div className="font-medium">{detalleTransfMov.titular_nombre}</div>
                    </div>
                  )}
                  {detalleTransfMov.titular_cuil && (
                    <div>
                      <div className="text-xs text-muted-foreground">CUIL/CUIT</div>
                      <div className="font-mono">{detalleTransfMov.titular_cuil}</div>
                    </div>
                  )}
                  {detalleTransfMov.numero_operacion && (
                    <div>
                      <div className="text-xs text-muted-foreground">Nº Operación</div>
                      <div className="font-mono">{detalleTransfMov.numero_operacion}</div>
                    </div>
                  )}
                  {detalleTransfMov.fecha_transferencia && (
                    <div>
                      <div className="text-xs text-muted-foreground">Fecha de transferencia</div>
                      <div className="font-medium">
                        {format(new Date(detalleTransfMov.fecha_transferencia), 'dd/MM/yyyy', { locale: es })}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground">Estado</div>
                    <Badge
                      variant={
                        detalleTransfMov.estado_imputacion === 'confirmado' ? 'default' :
                        detalleTransfMov.estado_imputacion === 'rechazado' ? 'destructive' : 'secondary'
                      }
                    >
                      {detalleTransfMov.estado_imputacion}
                    </Badge>
                  </div>
                  {detalleTransfMov.concepto && (
                    <div className="col-span-2">
                      <div className="text-xs text-muted-foreground">Concepto</div>
                      <div>{detalleTransfMov.concepto}</div>
                    </div>
                  )}
                </div>

                {detalleTransfMov.estado_imputacion === 'rechazado' && detalleTransfMov.observacion_rechazo && (
                  <div className="border border-destructive/40 bg-destructive/5 p-3 rounded-md space-y-1">
                    <div className="text-xs font-medium text-destructive uppercase tracking-wide">
                      Motivo de rechazo
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {detalleTransfMov.observacion_rechazo}
                    </div>
                    {detalleTransfMov.rechazado_at && (
                      <div className="text-xs text-muted-foreground">
                        Rechazada el {format(new Date(detalleTransfMov.rechazado_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </div>
                    )}
                  </div>
                )}

                {detalleTransfMov.estado_imputacion === 'pendiente' && editableCampos && (
                  <div className="border rounded-md p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <Label className="text-sm font-medium">Datos de la transferencia</Label>
                        <div className="text-xs text-muted-foreground">
                          Podés completar o corregir los campos. Usá "Autocompletar con IA" para leer el comprobante.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!detalleTransfMov.foto_comprobante_path || autocompletandoIA}
                          onClick={handleAutocompletarIA}
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          {autocompletandoIA ? 'Analizando...' : 'Autocompletar con IA'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleGuardarCampos}
                          disabled={savingCampos}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          {savingCampos ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                      </div>
                    </div>

                    {(() => {
                      const renderCampo = (
                        key: keyof EditableCampos,
                        label: string,
                        opts: { mono?: boolean; type?: string; placeholder?: string } = {}
                      ) => {
                        const meta = camposMeta[key];
                        const isAI = meta?.source === 'ai';
                        return (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Label className="text-xs">{label}</Label>
                              {isAI && (
                                <Badge variant="secondary" className="h-4 text-[10px] gap-1 px-1.5">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  IA{meta?.confianza ? ` · ${meta.confianza}` : ''}
                                </Badge>
                              )}
                            </div>
                            <Input
                              type={opts.type || 'text'}
                              value={editableCampos[key]}
                              onChange={(e) => setCampo(key, e.target.value)}
                              placeholder={opts.placeholder}
                              className={`${opts.mono ? 'font-mono' : ''} ${isAI ? 'border-primary/60 bg-primary/5' : ''}`}
                            />
                          </div>
                        );
                      };
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          {renderCampo('numero_operacion', 'Nº Operación', { mono: true })}
                          {renderCampo('fecha_transferencia', 'Fecha', { type: 'date' })}
                          {renderCampo('titular_nombre', 'Titular')}
                          {renderCampo('titular_cuil', 'CUIL/CUIT', { mono: true, placeholder: '11 dígitos' })}
                          {renderCampo('banco', 'Banco (referencia)')}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Comprobante</Label>
                  {loadingComprobante ? (
                    <div className="flex items-center justify-center h-40 border rounded-md">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : detalleTransfMov.foto_comprobante_path && comprobanteUrl ? (
                    <div className="border rounded-md overflow-hidden bg-muted/30">
                      {/\.pdf$/i.test(detalleTransfMov.foto_comprobante_path) ? (
                        <iframe
                          src={comprobanteUrl}
                          className="w-full h-[400px]"
                          title="Comprobante PDF"
                        />
                      ) : (
                        <img
                          src={comprobanteUrl}
                          alt="Comprobante de transferencia"
                          className="w-full max-h-[400px] object-contain"
                        />
                      )}
                      <div className="p-2 flex items-center justify-between border-t bg-background">
                        <span className="text-xs text-muted-foreground truncate">
                          {detalleTransfMov.foto_comprobante_nombre || 'comprobante'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => window.open(comprobanteUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Abrir en nueva pestaña
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 border rounded-md text-sm text-muted-foreground italic">
                      Sin comprobante adjunto
                    </div>
                  )}
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={uploadingTransfId === detalleTransfMov.transferencia_id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadComprobante(detalleTransfMov, f);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      disabled={uploadingTransfId === detalleTransfMov.transferencia_id}
                    >
                      <span>
                        {detalleTransfMov.foto_comprobante_path ? (
                          <><Upload className="h-4 w-4 mr-1" /> Cambiar comprobante</>
                        ) : (
                          <><Paperclip className="h-4 w-4 mr-1" /> Adjuntar comprobante</>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetalleTransfOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
