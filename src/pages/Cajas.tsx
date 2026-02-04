import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DollarSign, 
  Lock, 
  Plus, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Eye,
  Calculator,
  Printer,
  Users,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import { EditarArqueoDialog } from '@/components/cajas/EditarArqueoDialog';
import { ConfirmarArqueoDialog } from '@/components/cajas/ConfirmarArqueoDialog';

type CashRegisterStatus = Database['public']['Enums']['cash_register_status'];

interface Caja {
  id: string;
  usuario_id: string;
  fondo_inicial: number;
  total_ventas: number | null;
  total_egresos: number | null;
  conteo_declarado: number | null;
  diferencia: number | null;
  estado: CashRegisterStatus;
  observaciones: string | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  arqueo_confirmado?: boolean;
  arqueo_pendiente_revision?: boolean;
  confirmado_por?: string | null;
  fecha_confirmacion?: string | null;
  profiles?: { nombre: string } | null;
}

interface Movimiento {
  id: string;
  caja_id: string;
  tipo: string;
  concepto: string;
  monto: number;
  created_at: string;
  usuario_id: string;
  profiles?: { nombre: string } | null;
}

interface ArqueoDetalle {
  denominacion: number;
  cantidad: number;
  subtotal: number;
}

interface ArqueoOtroMedio {
  tipo: string;
  monto: number;
}

export default function Cajas() {
  const { user, profile, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isVendedor = hasRole('vendedor');
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cajaActiva, setCajaActiva] = useState<Caja | null>(null);
  const [cajasAbiertas, setCajasAbiertas] = useState<Caja[]>([]); // Todas las cajas abiertas (para admin)
  const [loading, setLoading] = useState(true);
  const [aperturaDialogOpen, setAperturaDialogOpen] = useState(false);
  const [movimientoDialogOpen, setMovimientoDialogOpen] = useState(false);
  const [cierreDialogOpen, setCierreDialogOpen] = useState(false);
  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false);
  const [selectedCaja, setSelectedCaja] = useState<Caja | null>(null);
  const [cajaACerrar, setCajaACerrar] = useState<Caja | null>(null); // Caja que admin quiere cerrar
  const [arqueoDetalles, setArqueoDetalles] = useState<ArqueoDetalle[]>([]);
  const [arqueoOtrosMedios, setArqueoOtrosMedios] = useState<ArqueoOtroMedio[]>([]);
  const [editarArqueoDialogOpen, setEditarArqueoDialogOpen] = useState(false);
  const [confirmarArqueoDialogOpen, setConfirmarArqueoDialogOpen] = useState(false);
  const [editarMovimientoDialogOpen, setEditarMovimientoDialogOpen] = useState(false);
  const [movimientoAEditar, setMovimientoAEditar] = useState<Movimiento | null>(null);
  const [fondoInicial, setFondoInicial] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState<'ingreso' | 'egreso'>('egreso');
  const [movimientoData, setMovimientoData] = useState({ concepto: '', monto: '' });
  const [cierreData, setCierreData] = useState({ observaciones: '' });
  
  // Filtro por usuario para admins
  const [filtroUsuario, setFiltroUsuario] = useState<string>('todos');
  const [arqueo, setArqueo] = useState<Record<string, number>>({
    // Billetes
    '20000': 0,
    '10000': 0,
    '2000': 0,
    '1000': 0,
    '500': 0,
    '200': 0,
    '100': 0,
  });
  const [otrosMedios, setOtrosMedios] = useState({
    posnet: 0,
    transferencias: 0,
  });

  const denominaciones = [
    { valor: 20000, label: '$20.000' },
    { valor: 10000, label: '$10.000' },
    { valor: 2000, label: '$2.000' },
    { valor: 1000, label: '$1.000' },
    { valor: 500, label: '$500' },
    { valor: 200, label: '$200' },
    { valor: 100, label: '$100' },
  ];

  const totalEfectivo = Object.entries(arqueo).reduce((sum, [denominacion, cantidad]) => {
    return sum + (parseInt(denominacion) * cantidad);
  }, 0);

  const totalArqueo = totalEfectivo + otrosMedios.posnet + otrosMedios.transferencias;

  useEffect(() => {
    fetchData();
    if (isAdmin) {
      fetchUsuarios();
    }
  }, [user, isAdmin]);

  const fetchUsuarios = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre')
      .eq('estado', true)
      .order('nombre');
    setUsuarios(data || []);
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Si es admin, traer todas las cajas; sino solo las del usuario
      let query = supabase
        .from('cajas')
        .select('*')
        .order('fecha_apertura', { ascending: false });
      
      if (!isAdmin) {
        query = query.eq('usuario_id', user.id);
      }
      
      const { data: cajasData, error: cajasError } = await query;

      if (cajasError) throw cajasError;
      
      // Si es admin, obtener nombres de usuarios
      if (isAdmin && cajasData) {
        const userIds = [...new Set(cajasData.map(c => c.usuario_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nombre')
          .in('id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const cajasWithProfiles = cajasData.map(c => ({
          ...c,
          profiles: profilesMap.get(c.usuario_id) || null
        }));
        setCajas(cajasWithProfiles);
      } else {
        setCajas(cajasData || []);
      }

      // Check if user has an open cash register (siempre buscar la del usuario actual)
      const cajaAbierta = (cajasData || []).find(
        (c) => c.usuario_id === user.id && c.estado === 'abierta'
      );
      setCajaActiva(cajaAbierta || null);

      // Para admins, guardar todas las cajas abiertas
      if (isAdmin && cajasData) {
        const todasCajasAbiertas = cajasData.filter(c => c.estado === 'abierta');
        setCajasAbiertas(todasCajasAbiertas);
      }

      // Fetch movements for active cash register
      if (cajaAbierta) {
        const { data: movimientosData } = await supabase
          .from('movimientos_caja')
          .select('*')
          .eq('caja_id', cajaAbierta.id)
          .order('created_at', { ascending: false });

        setMovimientos(movimientosData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar cajas según usuario seleccionado (solo para admins)
  const cajasFiltradas = filtroUsuario === 'todos' 
    ? cajas 
    : cajas.filter(c => c.usuario_id === filtroUsuario);

  const handleAbrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const fondo = parseFloat(fondoInicial);
    if (isNaN(fondo) || fondo < 0) {
      toast.error('Ingrese un fondo inicial válido');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cajas')
        .insert([{
          usuario_id: user.id,
          fondo_inicial: fondo,
          estado: 'abierta' as CashRegisterStatus,
        }])
        .select()
        .single();

      if (error) throw error;

      // Register opening movement
      await supabase.from('movimientos_caja').insert([{
        caja_id: data.id,
        usuario_id: user.id,
        tipo: 'ingreso',
        concepto: 'Fondo inicial de caja',
        monto: fondo,
      }]);

      toast.success('Caja abierta correctamente');
      setAperturaDialogOpen(false);
      setFondoInicial('');
      fetchData();
    } catch (error) {
      console.error('Error opening caja:', error);
      toast.error('Error al abrir la caja');
    }
  };

  const handleRegistrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaActiva || !user) return;

    const monto = parseFloat(movimientoData.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    try {
      const { error } = await supabase.from('movimientos_caja').insert([{
        caja_id: cajaActiva.id,
        usuario_id: user.id,
        tipo: tipoMovimiento,
        concepto: movimientoData.concepto,
        monto: monto,
      }]);

      if (error) throw error;

      // Update caja totals
      const updateField = tipoMovimiento === 'ingreso' ? 'total_ventas' : 'total_egresos';
      const currentValue = tipoMovimiento === 'ingreso' 
        ? cajaActiva.total_ventas || 0 
        : cajaActiva.total_egresos || 0;

      await supabase
        .from('cajas')
        .update({ [updateField]: currentValue + monto })
        .eq('id', cajaActiva.id);

      toast.success('Movimiento registrado correctamente');
      setMovimientoDialogOpen(false);
      setMovimientoData({ concepto: '', monto: '' });
      fetchData();
    } catch (error) {
      console.error('Error registering movement:', error);
      toast.error('Error al registrar el movimiento');
    }
  };

  const handleEditarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movimientoAEditar || !isAdmin) return;

    const nuevoMonto = parseFloat(movimientoData.monto);
    if (isNaN(nuevoMonto) || nuevoMonto <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    try {
      const montoAnterior = movimientoAEditar.monto;
      const diferenciaMonto = nuevoMonto - montoAnterior;

      // Actualizar el movimiento
      const { error } = await supabase
        .from('movimientos_caja')
        .update({
          concepto: movimientoData.concepto,
          monto: nuevoMonto,
        })
        .eq('id', movimientoAEditar.id);

      if (error) throw error;

      // Actualizar totales de la caja si el monto cambió
      if (diferenciaMonto !== 0) {
        const updateField = movimientoAEditar.tipo === 'ingreso' ? 'total_ventas' : 'total_egresos';
        
        // Obtener la caja actual
        const { data: cajaData } = await supabase
          .from('cajas')
          .select(updateField)
          .eq('id', movimientoAEditar.caja_id)
          .single();

        if (cajaData) {
          const valorActual = (cajaData as any)[updateField] || 0;
          await supabase
            .from('cajas')
            .update({ [updateField]: valorActual + diferenciaMonto })
            .eq('id', movimientoAEditar.caja_id);
        }
      }

      toast.success('Movimiento actualizado correctamente');
      setEditarMovimientoDialogOpen(false);
      setMovimientoAEditar(null);
      setMovimientoData({ concepto: '', monto: '' });
      fetchData();
    } catch (error) {
      console.error('Error updating movement:', error);
      toast.error('Error al actualizar el movimiento');
    }
  };

  const handleCerrarCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    // Usar cajaACerrar si está definida (admin cerrando otra caja), sino usar cajaActiva
    const cajaParaCerrar = cajaACerrar || cajaActiva;
    if (!cajaParaCerrar || !user) return;

    if (totalArqueo < 0) {
      toast.error('El arqueo no puede ser negativo');
      return;
    }

    try {
      const esperado = cajaParaCerrar.fondo_inicial + (cajaParaCerrar.total_ventas || 0) - (cajaParaCerrar.total_egresos || 0);
      const diferencia = totalArqueo - esperado;

      const { error } = await supabase
        .from('cajas')
        .update({
          estado: 'cerrada' as CashRegisterStatus,
          fecha_cierre: new Date().toISOString(),
          conteo_declarado: totalArqueo,
          diferencia: diferencia,
          observaciones: cierreData.observaciones || null,
        })
        .eq('id', cajaParaCerrar.id);

      if (error) throw error;

      // Guardar detalle de arqueo - denominaciones
      const arqueoInserts = denominaciones
        .filter(d => arqueo[d.valor.toString()] > 0)
        .map(d => ({
          caja_id: cajaParaCerrar.id,
          denominacion: d.valor,
          cantidad: arqueo[d.valor.toString()],
          subtotal: d.valor * arqueo[d.valor.toString()],
        }));

      if (arqueoInserts.length > 0) {
        const { error: arqueoError } = await supabase
          .from('arqueo_detalles')
          .insert(arqueoInserts);
        if (arqueoError) console.error('Error saving arqueo details:', arqueoError);
      }

      // Guardar otros medios (posnet, transferencias)
      const otrosMediosInserts = [];
      if (otrosMedios.posnet > 0) {
        otrosMediosInserts.push({
          caja_id: cajaParaCerrar.id,
          tipo: 'posnet',
          monto: otrosMedios.posnet,
        });
      }
      if (otrosMedios.transferencias > 0) {
        otrosMediosInserts.push({
          caja_id: cajaParaCerrar.id,
          tipo: 'transferencias',
          monto: otrosMedios.transferencias,
        });
      }

      if (otrosMediosInserts.length > 0) {
        const { error: otrosError } = await supabase
          .from('arqueo_otros_medios')
          .insert(otrosMediosInserts);
        if (otrosError) console.error('Error saving otros medios:', otrosError);
      }

      toast.success('Caja cerrada correctamente');
      setCierreDialogOpen(false);
      setCajaACerrar(null);
      setCierreData({ observaciones: '' });
      setArqueo({
        '20000': 0, '10000': 0, '2000': 0, '1000': 0, '500': 0, '200': 0, '100': 0,
      });
      setOtrosMedios({ posnet: 0, transferencias: 0 });
      fetchData();
    } catch (error) {
      console.error('Error closing caja:', error);
      toast.error('Error al cerrar la caja');
    }
  };

  const openDetalleDialog = async (caja: Caja) => {
    setSelectedCaja(caja);
    
    // Fetch movements for this caja
    const { data } = await supabase
      .from('movimientos_caja')
      .select('*')
      .eq('caja_id', caja.id)
      .order('created_at', { ascending: false });

    setMovimientos(data || []);

    // Fetch arqueo details if caja is closed
    if (caja.estado === 'cerrada') {
      const [detallesRes, otrosRes] = await Promise.all([
        supabase
          .from('arqueo_detalles')
          .select('*')
          .eq('caja_id', caja.id)
          .order('denominacion', { ascending: false }),
        supabase
          .from('arqueo_otros_medios')
          .select('*')
          .eq('caja_id', caja.id)
      ]);
      
      setArqueoDetalles((detallesRes.data || []).map((d: { denominacion: number; cantidad: number; subtotal: number }) => ({
        denominacion: d.denominacion,
        cantidad: d.cantidad,
        subtotal: d.subtotal
      })));
      setArqueoOtrosMedios((otrosRes.data || []).map((o: { tipo: string; monto: number }) => ({
        tipo: o.tipo,
        monto: o.monto
      })));
    } else {
      setArqueoDetalles([]);
      setArqueoOtrosMedios([]);
    }

    setDetalleDialogOpen(true);
  };

  const handlePrintArqueo = () => {
    if (!selectedCaja) return;

    const esperado = selectedCaja.fondo_inicial + (selectedCaja.total_ventas || 0) - (selectedCaja.total_egresos || 0);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }

    const totalEfectivoArqueo = arqueoDetalles.reduce((sum, d) => sum + d.subtotal, 0);
    const totalOtrosMediosArqueo = arqueoOtrosMedios.reduce((sum, o) => sum + o.monto, 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo de Arqueo</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
          h2 { text-align: center; font-size: 14px; color: #666; margin-top: 0; }
          .divider { border-top: 1px dashed #000; margin: 15px 0; }
          .row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 12px; }
          .row.total { font-weight: bold; font-size: 14px; }
          .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 13px; }
          .difference { font-size: 16px; text-align: center; padding: 10px; margin: 10px 0; }
          .difference.positive { background: #e8f5e9; color: #2e7d32; }
          .difference.negative { background: #ffebee; color: #c62828; }
          .difference.zero { background: #e3f2fd; color: #1565c0; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>RECIBO DE ARQUEO</h1>
        <h2>Cierre de Caja</h2>
        <div class="divider"></div>
        
        <div class="row"><span>Fecha Apertura:</span><span>${format(new Date(selectedCaja.fecha_apertura), 'dd/MM/yyyy HH:mm')}</span></div>
        <div class="row"><span>Fecha Cierre:</span><span>${selectedCaja.fecha_cierre ? format(new Date(selectedCaja.fecha_cierre), 'dd/MM/yyyy HH:mm') : '-'}</span></div>
        
        <div class="divider"></div>
        
        <div class="row"><span>Fondo Inicial:</span><span>$${selectedCaja.fondo_inicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        <div class="row"><span>Total Ingresos:</span><span>$${(selectedCaja.total_ventas || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        <div class="row"><span>Total Egresos:</span><span>-$${(selectedCaja.total_egresos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        <div class="row total"><span>ESPERADO:</span><span>$${esperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        
        <div class="divider"></div>
        <p class="section-title">DETALLE EFECTIVO</p>
        ${arqueoDetalles.length > 0 
          ? arqueoDetalles.map(d => `
            <div class="row">
              <span>$${d.denominacion.toLocaleString('es-AR')} x ${d.cantidad}</span>
              <span>$${d.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          `).join('')
          : '<div class="row"><span>Sin detalle de efectivo</span></div>'
        }
        <div class="row total"><span>Subtotal Efectivo:</span><span>$${totalEfectivoArqueo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        
        ${arqueoOtrosMedios.length > 0 ? `
          <div class="divider"></div>
          <p class="section-title">OTROS MEDIOS</p>
          ${arqueoOtrosMedios.map(o => `
            <div class="row">
              <span>${o.tipo === 'posnet' ? 'Posnet' : 'Transferencias'}:</span>
              <span>$${o.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          `).join('')}
          <div class="row total"><span>Subtotal Otros:</span><span>$${totalOtrosMediosArqueo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        ` : ''}
        
        <div class="divider"></div>
        <div class="row total"><span>TOTAL CONTADO:</span><span>$${(selectedCaja.conteo_declarado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        
        <div class="difference ${(selectedCaja.diferencia || 0) === 0 ? 'zero' : (selectedCaja.diferencia || 0) > 0 ? 'positive' : 'negative'}">
          Diferencia: ${(selectedCaja.diferencia || 0) >= 0 ? '+' : ''}$${(selectedCaja.diferencia || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          ${(selectedCaja.diferencia || 0) === 0 ? ' ✓' : (selectedCaja.diferencia || 0) > 0 ? ' (Sobrante)' : ' (Faltante)'}
        </div>
        
        ${selectedCaja.observaciones ? `
          <div class="divider"></div>
          <p class="section-title">OBSERVACIONES</p>
          <p style="font-size: 12px;">${selectedCaja.observaciones}</p>
        ` : ''}
        
        <div class="footer">
          <p>Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const columns = [
    {
      key: 'fecha_apertura',
      header: 'Fecha Apertura',
      render: (item: Caja) => format(new Date(item.fecha_apertura), 'dd/MM/yyyy HH:mm', { locale: es }),
    },
    ...(isAdmin ? [{
      key: 'usuario',
      header: 'Usuario',
      render: (item: Caja) => item.profiles?.nombre || 'Sin asignar',
    }] : []),
    {
      key: 'fondo_inicial',
      header: 'Fondo Inicial',
      render: (item: Caja) => `$${item.fondo_inicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'total_ventas',
      header: 'Ingresos',
      render: (item: Caja) => (
        <span className="text-success">
          +${(item.total_ventas || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'total_egresos',
      header: 'Egresos',
      render: (item: Caja) => (
        <span className="text-destructive">
          -${(item.total_egresos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (item: Caja) => {
        if (item.estado === 'abierta') {
          return <Badge variant="default">Abierta</Badge>;
        }
        // Caja cerrada - mostrar estado de confirmación
        if (item.arqueo_confirmado) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Confirmada
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Arqueo confirmado por administrador</TooltipContent>
            </Tooltip>
          );
        }
        if (item.arqueo_pendiente_revision) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 border-warning text-warning">
                  <Clock className="h-3 w-3" />
                  Pendiente
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Arqueo pendiente de confirmación</TooltipContent>
            </Tooltip>
          );
        }
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Sin confirmar
              </Badge>
            </TooltipTrigger>
            <TooltipContent>El arqueo puede ser editado</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: 'diferencia',
      header: 'Diferencia',
      render: (item: Caja) => {
        if (item.diferencia === null) return '-';
        const color = item.diferencia === 0 
          ? 'text-muted-foreground' 
          : item.diferencia > 0 
            ? 'text-success' 
            : 'text-destructive';
        return (
          <span className={color}>
            ${item.diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Caja) => {
        const canEdit = item.estado === 'cerrada' && 
                        !item.arqueo_confirmado && 
                        !item.arqueo_pendiente_revision &&
                        (item.usuario_id === user?.id || isAdmin);
        const canConfirm = isAdmin && 
                          item.estado === 'cerrada' && 
                          item.arqueo_pendiente_revision;
        
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => openDetalleDialog(item)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalle</TooltipContent>
            </Tooltip>
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setSelectedCaja(item);
                      setEditarArqueoDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar arqueo</TooltipContent>
              </Tooltip>
            )}
            {canConfirm && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-success hover:text-success"
                    onClick={() => {
                      setSelectedCaja(item);
                      setConfirmarArqueoDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Confirmar arqueo</TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ];

  const esperado = cajaActiva
    ? cajaActiva.fondo_inicial + (cajaActiva.total_ventas || 0) - (cajaActiva.total_egresos || 0)
    : 0;

  return (
    <MainLayout>
      <PageHeader title="Cajas" description="Gestión de cajas y arqueos">
        {!cajaActiva ? (
          <Button onClick={() => setAperturaDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Abrir Caja
          </Button>
        ) : (
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => {
                  setTipoMovimiento('egreso');
                  setMovimientoDialogOpen(true);
                }}>
                  <ArrowDownCircle className="mr-2 h-4 w-4" />
                  Egreso
                </Button>
                <Button variant="outline" onClick={() => {
                  setTipoMovimiento('ingreso');
                  setMovimientoDialogOpen(true);
                }}>
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  Ingreso
                </Button>
              </>
            )}
            <Button onClick={() => setCierreDialogOpen(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Cerrar Caja
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Active Cash Register Summary */}
      {cajaActiva && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Fondo Inicial</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ${cajaActiva.fondo_inicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ingresos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-success">
                +${(cajaActiva.total_ventas || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Egresos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">
                -${(cajaActiva.total_egresos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Esperado</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ${esperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtro por usuario para admins */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtrar por usuario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los usuarios</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <DataTable
        data={cajasFiltradas}
        columns={columns}
        searchPlaceholder="Buscar cajas..."
        searchKeys={[]}
        loading={loading}
      />

      {/* Apertura Dialog */}
      <Dialog open={aperturaDialogOpen} onOpenChange={setAperturaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAbrirCaja} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fondo_inicial">Fondo Inicial *</Label>
              <Input
                id="fondo_inicial"
                type="number"
                step="0.01"
                min="0"
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setAperturaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Abrir Caja</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movimiento Dialog */}
      <Dialog open={movimientoDialogOpen} onOpenChange={setMovimientoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registrar {tipoMovimiento === 'ingreso' ? 'Ingreso' : 'Egreso'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegistrarMovimiento} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto *</Label>
              <Input
                id="concepto"
                value={movimientoData.concepto}
                onChange={(e) => setMovimientoData({ ...movimientoData, concepto: e.target.value })}
                placeholder={tipoMovimiento === 'ingreso' ? 'Ej: Venta adicional' : 'Ej: Pago a proveedor'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto">Monto *</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0.01"
                value={movimientoData.monto}
                onChange={(e) => setMovimientoData({ ...movimientoData, monto: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setMovimientoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cierre Dialog */}
      <Dialog open={cierreDialogOpen} onOpenChange={setCierreDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Arqueo y Cierre de Caja
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCerrarCaja} className="space-y-4">
            {/* Resumen */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Resumen de Caja</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Fondo Inicial:</span>
                  <span>${cajaActiva?.fondo_inicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>Ingresos:</span>
                  <span>+${(cajaActiva?.total_ventas || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Egresos:</span>
                  <span>-${(cajaActiva?.total_egresos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total Esperado:</span>
                  <span>${esperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Arqueo de Billetes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Conteo de Efectivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {denominaciones.map((denom) => (
                    <div key={denom.valor} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{denom.label}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={arqueo[denom.valor.toString()] || ''}
                          onChange={(e) => setArqueo({
                            ...arqueo,
                            [denom.valor.toString()]: parseInt(e.target.value) || 0
                          })}
                          className="h-8 text-center"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        ${((arqueo[denom.valor.toString()] || 0) * denom.valor).toLocaleString('es-AR')}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-sm font-medium">Subtotal Efectivo:</span>
                  <span className="font-bold">${totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Otros Medios de Pago */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Comprobantes Posnet y Transferencias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="posnet">Comprobantes Posnet (Débito/Crédito)</Label>
                    <Input
                      id="posnet"
                      type="number"
                      min="0"
                      step="0.01"
                      value={otrosMedios.posnet || ''}
                      onChange={(e) => setOtrosMedios({
                        ...otrosMedios,
                        posnet: parseFloat(e.target.value) || 0
                      })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Suma total de los comprobantes del posnet
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transferencias">Transferencias Bancarias</Label>
                    <Input
                      id="transferencias"
                      type="number"
                      min="0"
                      step="0.01"
                      value={otrosMedios.transferencias || ''}
                      onChange={(e) => setOtrosMedios({
                        ...otrosMedios,
                        transferencias: parseFloat(e.target.value) || 0
                      })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Suma total de transferencias recibidas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total del Arqueo */}
            <Card className={totalArqueo - esperado === 0 ? 'border-success' : totalArqueo - esperado > 0 ? 'border-blue-500' : 'border-destructive'}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Total Contado:</span>
                  <span className="text-2xl font-bold">
                    ${totalArqueo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`flex justify-between items-center text-sm ${
                  totalArqueo - esperado === 0 
                    ? 'text-success' 
                    : totalArqueo - esperado > 0 
                      ? 'text-blue-600' 
                      : 'text-destructive'
                }`}>
                  <span>Diferencia:</span>
                  <span className="font-semibold">
                    {totalArqueo - esperado >= 0 ? '+' : ''}${(totalArqueo - esperado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    {totalArqueo - esperado === 0 && ' ✓'}
                    {totalArqueo - esperado > 0 && ' (Sobrante)'}
                    {totalArqueo - esperado < 0 && ' (Faltante)'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={cierreData.observaciones}
                onChange={(e) => setCierreData({ ...cierreData, observaciones: e.target.value })}
                placeholder="Notas adicionales sobre el cierre..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCierreDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Lock className="mr-2 h-4 w-4" />
                Cerrar Caja
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalle Dialog */}
      <Dialog open={detalleDialogOpen} onOpenChange={setDetalleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Detalle de Caja - {selectedCaja && format(new Date(selectedCaja.fecha_apertura), 'dd/MM/yyyy', { locale: es })}</span>
              {isAdmin && selectedCaja?.estado === 'cerrada' && (
                <Button variant="outline" size="sm" onClick={handlePrintArqueo}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Arqueo
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCaja && (
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Estado</p>
                    <Badge variant={selectedCaja.estado === 'abierta' ? 'default' : 'secondary'}>
                      {selectedCaja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Esperado</p>
                    <p className="text-xl font-bold">
                      ${(selectedCaja.fondo_inicial + (selectedCaja.total_ventas || 0) - (selectedCaja.total_egresos || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detalle de Arqueo - solo para cajas cerradas */}
              {selectedCaja.estado === 'cerrada' && (arqueoDetalles.length > 0 || arqueoOtrosMedios.length > 0) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Detalle del Arqueo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {arqueoDetalles.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Efectivo</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {arqueoDetalles.map((d) => (
                            <div key={d.denominacion} className="flex justify-between bg-muted/50 px-2 py-1 rounded">
                              <span>${d.denominacion.toLocaleString('es-AR')} x {d.cantidad}</span>
                              <span className="font-medium">${d.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {arqueoOtrosMedios.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Otros Medios</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {arqueoOtrosMedios.map((o) => (
                            <div key={o.tipo} className="flex justify-between bg-muted/50 px-2 py-1 rounded">
                              <span>{o.tipo === 'posnet' ? 'Posnet' : 'Transferencias'}</span>
                              <span className="font-medium">${o.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-medium">Total Contado:</span>
                      <span className="font-bold">${(selectedCaja.conteo_declarado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className={`flex justify-between text-sm ${
                      (selectedCaja.diferencia || 0) === 0 
                        ? 'text-success' 
                        : (selectedCaja.diferencia || 0) > 0 
                          ? 'text-blue-600' 
                          : 'text-destructive'
                    }`}>
                      <span>Diferencia:</span>
                      <span className="font-semibold">
                        {(selectedCaja.diferencia || 0) >= 0 ? '+' : ''}${(selectedCaja.diferencia || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        {(selectedCaja.diferencia || 0) === 0 && ' ✓'}
                        {(selectedCaja.diferencia || 0) > 0 && ' (Sobrante)'}
                        {(selectedCaja.diferencia || 0) < 0 && ' (Faltante)'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="border rounded-lg">
                <div className="p-4 border-b bg-muted/50">
                  <h4 className="font-medium">Movimientos</h4>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {movimientos.length === 0 ? (
                    <p className="p-4 text-center text-muted-foreground">No hay movimientos</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left p-2 text-sm">Hora</th>
                          <th className="text-left p-2 text-sm">Concepto</th>
                          <th className="text-right p-2 text-sm">Monto</th>
                          {isAdmin && <th className="text-center p-2 text-sm w-12">Acc.</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((mov) => (
                          <tr key={mov.id} className="border-t">
                            <td className="p-2 text-sm">
                              {format(new Date(mov.created_at), 'HH:mm')}
                            </td>
                            <td className="p-2 text-sm">{mov.concepto}</td>
                            <td className={`p-2 text-sm text-right ${mov.tipo === 'ingreso' ? 'text-success' : 'text-destructive'}`}>
                              {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            {isAdmin && (
                              <td className="p-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setMovimientoAEditar(mov);
                                    setMovimientoData({ concepto: mov.concepto, monto: mov.monto.toString() });
                                    setEditarMovimientoDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {selectedCaja.observaciones && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Observaciones</p>
                    <p className="text-sm">{selectedCaja.observaciones}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Editar Arqueo Dialog */}
      <EditarArqueoDialog
        open={editarArqueoDialogOpen}
        onOpenChange={setEditarArqueoDialogOpen}
        caja={selectedCaja}
        onSuccess={fetchData}
      />

      {/* Confirmar Arqueo Dialog (solo admin) */}
      <ConfirmarArqueoDialog
        open={confirmarArqueoDialogOpen}
        onOpenChange={setConfirmarArqueoDialogOpen}
        caja={selectedCaja}
        onSuccess={fetchData}
      />

      {/* Editar Movimiento Dialog (solo admin) */}
      <Dialog open={editarMovimientoDialogOpen} onOpenChange={(open) => {
        setEditarMovimientoDialogOpen(open);
        if (!open) {
          setMovimientoAEditar(null);
          setMovimientoData({ concepto: '', monto: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar {movimientoAEditar?.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditarMovimiento} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_concepto">Concepto *</Label>
              <Input
                id="edit_concepto"
                value={movimientoData.concepto}
                onChange={(e) => setMovimientoData({ ...movimientoData, concepto: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_monto">Monto *</Label>
              <Input
                id="edit_monto"
                type="number"
                step="0.01"
                min="0.01"
                value={movimientoData.monto}
                onChange={(e) => setMovimientoData({ ...movimientoData, monto: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditarMovimientoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
