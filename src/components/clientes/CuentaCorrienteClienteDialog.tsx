import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RegistrarPagoClienteDialog } from './RegistrarPagoClienteDialog';

interface Cliente {
  id: string;
  nombre: string;
  dni_cuit: string | null;
}

interface Movimiento {
  id: string;
  tipo: string;
  monto: number;
  concepto: string | null;
  fecha: string;
  created_at: string;
  venta_id: string | null;
  forma_pago_id: string | null;
  usuario_registro_id: string;
  forma_pago_nombre?: string;
  usuario_nombre?: string;
  numero_comprobante?: string | null;
  codigo_deposito?: string | null;
  nombre_vendedor?: string | null;
  origen?: string | null;
}

interface Saldo {
  total_deuda: number;
  total_pagado: number;
  saldo_actual: number;
}

interface CuentaCorrienteClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente;
  onMovimientoRegistrado?: () => void;
}

const TIPO_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  compra: { label: 'Compra', color: 'destructive', icon: TrendingDown },
  pago: { label: 'Pago', color: 'default', icon: TrendingUp },
  devolucion: { label: 'Devolución', color: 'default', icon: TrendingUp },
  nota_debito: { label: 'Nota de Débito', color: 'destructive', icon: TrendingDown },
  nota_credito: { label: 'Nota de Crédito', color: 'default', icon: TrendingUp },
  anulacion: { label: 'Anulación', color: 'default', icon: TrendingUp },
  saldo_inicial: { label: 'Saldo Inicial', color: 'secondary', icon: TrendingDown },
};

export function CuentaCorrienteClienteDialog({ open, onOpenChange, cliente, onMovimientoRegistrado }: CuentaCorrienteClienteDialogProps) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cuenta');

  useEffect(() => {
    if (open && cliente) {
      fetchData();
    }
  }, [open, cliente]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [movRes, saldoRes, formasPagoRes, profilesRes] = await Promise.all([
        supabase
          .from('cliente_movimientos')
          .select('*')
          .eq('cliente_id', cliente.id)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('cliente_saldos')
          .select('*')
          .eq('cliente_id', cliente.id)
          .maybeSingle(),
        supabase
          .from('formas_pago')
          .select('id, nombre'),
        supabase
          .from('profiles')
          .select('id, nombre'),
      ]);

      const formasPagoMap = new Map(formasPagoRes.data?.map(fp => [fp.id, fp.nombre]) || []);
      const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p.nombre]) || []);

      if (movRes.data) {
        const movsConNombres: Movimiento[] = movRes.data.map(mov => ({
          ...mov,
          forma_pago_nombre: mov.forma_pago_id ? formasPagoMap.get(mov.forma_pago_id) : undefined,
          usuario_nombre: profilesMap.get(mov.usuario_registro_id),
          origen: (mov as any).origen || 'sistema',
        }));
        setMovimientos(movsConNombres);
      }
      if (saldoRes.data) setSaldo(saldoRes.data);
      else setSaldo({ total_deuda: 0, total_pagado: 0, saldo_actual: 0 });
    } catch (error) {
      console.error('Error fetching cuenta corriente cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePagoSuccess = () => {
    setPagoDialogOpen(false);
    fetchData();
    onMovimientoRegistrado?.();
  };

  const saldoActual = Number(saldo?.saldo_actual) || 0;

  const movimientosCuenta = movimientos.filter(m => m.origen !== 'historico');
  const movimientosHistorial = movimientos.filter(m => m.origen === 'historico');

  const renderMovimientosTable = (movs: Movimiento[], showFormaPago = true) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      );
    }
    if (movs.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No hay movimientos registrados
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead>Depósito</TableHead>
            <TableHead>Vendedor</TableHead>
            {showFormaPago && <TableHead>Forma Pago</TableHead>}
            <TableHead>Registrado por</TableHead>
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movs.map((mov) => {
            const tipoInfo = TIPO_LABELS[mov.tipo] || { label: mov.tipo, color: 'secondary', icon: null };
            const esDeuda = ['compra', 'nota_debito', 'saldo_inicial'].includes(mov.tipo);
            const IconComponent = tipoInfo.icon;

            return (
              <TableRow key={mov.id}>
                <TableCell className="text-sm">
                  {format(new Date(mov.fecha), 'dd/MM/yyyy', { locale: es })}
                </TableCell>
                <TableCell>
                  <Badge variant={tipoInfo.color as any} className="flex items-center gap-1 w-fit">
                    {IconComponent && <IconComponent className="h-3 w-3" />}
                    {tipoInfo.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {mov.concepto || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {mov.codigo_deposito || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {mov.nombre_vendedor || '-'}
                </TableCell>
                {showFormaPago && (
                  <TableCell className="text-sm text-muted-foreground">
                    {mov.forma_pago_nombre || '-'}
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">
                  {mov.usuario_nombre || '-'}
                </TableCell>
                <TableCell className={`text-right font-medium ${esDeuda ? 'text-destructive' : 'text-green-600'}`}>
                  {esDeuda ? '+' : '-'}${Number(mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Cuenta Corriente - {cliente.nombre}</span>
              <Button size="sm" onClick={() => setPagoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Registrar Pago
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Total Deuda</p>
              <p className="text-xl font-bold text-destructive">
                ${Number(saldo?.total_deuda || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Total Pagado</p>
              <p className="text-xl font-bold text-green-600">
                ${Number(saldo?.total_pagado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Saldo Actual</p>
              <p className={`text-xl font-bold ${saldoActual > 0 ? 'text-destructive' : saldoActual < 0 ? 'text-green-600' : ''}`}>
                ${saldoActual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">
                {saldoActual > 0 ? 'Debe al comercio' : saldoActual < 0 ? 'A favor del cliente' : 'Sin saldo'}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="cuenta">
                Cuenta Corriente ({movimientosCuenta.length})
              </TabsTrigger>
              <TabsTrigger value="historial">
                Historial ({movimientosHistorial.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cuenta">
              <ScrollArea className="h-[400px]">
                {renderMovimientosTable(movimientosCuenta)}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="historial">
              <ScrollArea className="h-[400px]">
                {renderMovimientosTable(movimientosHistorial, false)}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <RegistrarPagoClienteDialog
        open={pagoDialogOpen}
        onOpenChange={setPagoDialogOpen}
        clienteId={cliente.id}
        onSuccess={handlePagoSuccess}
      />
    </>
  );
}
