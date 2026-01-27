import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Check, X, Search, Clock, CreditCard, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  cheque?: {
    numero_cheque: string;
    banco: string;
    emisor: string;
    fecha_emision: string;
    fecha_vencimiento: string;
    cuit_emisor: string | null;
    observaciones: string | null;
  } | null;
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
        cheque: chequesMap.get(m.id) || null,
      }));

      setMovimientos(movimientosCompletos);
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
      m.cheque?.banco?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedTab === 'pendientes') {
      return matchesSearch && m.estado_imputacion === 'pendiente';
    } else if (selectedTab === 'confirmados') {
      return matchesSearch && m.estado_imputacion === 'confirmado';
    } else if (selectedTab === 'rechazados') {
      return matchesSearch && m.estado_imputacion === 'rechazado';
    }
    return matchesSearch;
  });

  const handleConfirmar = async () => {
    if (!selectedMovimiento || !user) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('cliente_movimientos')
        .update({
          estado_imputacion: 'confirmado',
          fecha_imputacion: new Date().toISOString(),
          imputado_por: user.id,
        })
        .eq('id', selectedMovimiento.id);

      if (error) throw error;

      toast.success('Movimiento confirmado correctamente');
      setConfirmDialogOpen(false);
      setSelectedMovimiento(null);
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
    setConfirmDialogOpen(true);
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

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, nº cheque o banco..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Imputación</DialogTitle>
            </DialogHeader>
            {selectedMovimiento && (
              <div className="space-y-4">
                <p>¿Está seguro de confirmar este movimiento?</p>
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
      </div>
    </MainLayout>
  );
}
