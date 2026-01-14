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
  Calculator
} from 'lucide-react';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type CashRegisterStatus = Database['public']['Enums']['cash_register_status'];

interface Caja {
  id: string;
  usuario_id: string;
  fondo_inicial: number;
  total_ventas: number;
  total_egresos: number;
  conteo_declarado: number | null;
  diferencia: number | null;
  estado: CashRegisterStatus;
  observaciones: string | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
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

export default function Cajas() {
  const { user, profile } = useAuth();
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cajaActiva, setCajaActiva] = useState<Caja | null>(null);
  const [loading, setLoading] = useState(true);
  const [aperturaDialogOpen, setAperturaDialogOpen] = useState(false);
  const [movimientoDialogOpen, setMovimientoDialogOpen] = useState(false);
  const [cierreDialogOpen, setCierreDialogOpen] = useState(false);
  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false);
  const [selectedCaja, setSelectedCaja] = useState<Caja | null>(null);
  const [fondoInicial, setFondoInicial] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState<'ingreso' | 'egreso'>('egreso');
  const [movimientoData, setMovimientoData] = useState({ concepto: '', monto: '' });
  const [cierreData, setCierreData] = useState({ conteo_declarado: '', observaciones: '' });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch cajas with profiles
      const { data: cajasData, error: cajasError } = await supabase
        .from('cajas')
        .select('*')
        .order('fecha_apertura', { ascending: false });

      if (cajasError) throw cajasError;
      setCajas(cajasData || []);

      // Check if user has an open cash register
      const cajaAbierta = (cajasData || []).find(
        (c) => c.usuario_id === user.id && c.estado === 'abierta'
      );
      setCajaActiva(cajaAbierta || null);

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

  const handleCerrarCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaActiva || !user) return;

    const conteo = parseFloat(cierreData.conteo_declarado);
    if (isNaN(conteo) || conteo < 0) {
      toast.error('Ingrese el conteo de caja válido');
      return;
    }

    try {
      const esperado = cajaActiva.fondo_inicial + (cajaActiva.total_ventas || 0) - (cajaActiva.total_egresos || 0);
      const diferencia = conteo - esperado;

      const { error } = await supabase
        .from('cajas')
        .update({
          estado: 'cerrada' as CashRegisterStatus,
          fecha_cierre: new Date().toISOString(),
          conteo_declarado: conteo,
          diferencia: diferencia,
          observaciones: cierreData.observaciones || null,
        })
        .eq('id', cajaActiva.id);

      if (error) throw error;

      toast.success('Caja cerrada correctamente');
      setCierreDialogOpen(false);
      setCierreData({ conteo_declarado: '', observaciones: '' });
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
    setDetalleDialogOpen(true);
  };

  const columns = [
    {
      key: 'fecha_apertura',
      header: 'Fecha Apertura',
      render: (item: Caja) => format(new Date(item.fecha_apertura), 'dd/MM/yyyy HH:mm', { locale: es }),
    },
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
      render: (item: Caja) => (
        <Badge variant={item.estado === 'abierta' ? 'default' : 'secondary'}>
          {item.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
        </Badge>
      ),
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
      render: (item: Caja) => (
        <Button variant="ghost" size="icon" onClick={() => openDetalleDialog(item)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
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

      <DataTable
        data={cajas}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCerrarCaja} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="conteo_declarado">Conteo Declarado *</Label>
              <Input
                id="conteo_declarado"
                type="number"
                step="0.01"
                min="0"
                value={cierreData.conteo_declarado}
                onChange={(e) => setCierreData({ ...cierreData, conteo_declarado: e.target.value })}
                placeholder="0.00"
                required
              />
              {cierreData.conteo_declarado && (
                <p className={`text-sm ${parseFloat(cierreData.conteo_declarado) - esperado === 0 
                  ? 'text-muted-foreground' 
                  : parseFloat(cierreData.conteo_declarado) - esperado > 0 
                    ? 'text-success' 
                    : 'text-destructive'}`}>
                  Diferencia: ${(parseFloat(cierreData.conteo_declarado) - esperado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={cierreData.observaciones}
                onChange={(e) => setCierreData({ ...cierreData, observaciones: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCierreDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Cerrar Caja</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalle Dialog */}
      <Dialog open={detalleDialogOpen} onOpenChange={setDetalleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Detalle de Caja - {selectedCaja && format(new Date(selectedCaja.fecha_apertura), 'dd/MM/yyyy', { locale: es })}
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
    </MainLayout>
  );
}
