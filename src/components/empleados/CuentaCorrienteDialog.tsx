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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, TrendingDown, TrendingUp, Award } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RegistrarMovimientoDialog } from './RegistrarMovimientoDialog';

interface Empleado {
  id: string;
  nombre: string;
  sueldo_base: number;
}

interface Movimiento {
  id: string;
  tipo: string;
  monto: number;
  concepto: string | null;
  fecha: string;
  created_at: string;
  venta_id: string | null;
}

interface Saldo {
  total_deuda: number;
  total_pagado: number;
  total_comisiones: number;
  saldo_actual: number;
}

interface CuentaCorrienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empleado: Empleado;
  onMovimientoRegistrado?: () => void;
}

const TIPO_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  compra: { label: 'Compra', color: 'destructive', icon: TrendingDown },
  adelanto: { label: 'Adelanto', color: 'destructive', icon: TrendingDown },
  devolucion: { label: 'Devolución', color: 'default', icon: TrendingUp },
  ajuste: { label: 'Ajuste', color: 'secondary', icon: null },
  liquidacion: { label: 'Liquidación', color: 'default', icon: TrendingUp },
  comision: { label: 'Comisión', color: 'default', icon: Award },
};

export function CuentaCorrienteDialog({ open, onOpenChange, empleado, onMovimientoRegistrado }: CuentaCorrienteDialogProps) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [loading, setLoading] = useState(true);
  const [movimientoDialogOpen, setMovimientoDialogOpen] = useState(false);

  useEffect(() => {
    if (open && empleado) {
      fetchData();
    }
  }, [open, empleado]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [movRes, saldoRes] = await Promise.all([
        supabase
          .from('empleado_movimientos')
          .select('*')
          .eq('empleado_id', empleado.id)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('empleado_saldos')
          .select('*')
          .eq('empleado_id', empleado.id)
          .maybeSingle(),
      ]);

      if (movRes.data) setMovimientos(movRes.data);
      if (saldoRes.data) setSaldo(saldoRes.data);
      else setSaldo({ total_deuda: 0, total_pagado: 0, total_comisiones: 0, saldo_actual: 0 });
    } catch (error) {
      console.error('Error fetching cuenta corriente:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMovimientoSuccess = () => {
    setMovimientoDialogOpen(false);
    fetchData();
    onMovimientoRegistrado?.();
  };

  const saldoActual = Number(saldo?.saldo_actual) || 0;
  const totalComisiones = Number(saldo?.total_comisiones) || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Cuenta Corriente - {empleado.nombre}</span>
              <Button size="sm" onClick={() => setMovimientoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Registrar Movimiento
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
              <p className="text-sm text-muted-foreground">Comisiones</p>
              <p className="text-xl font-bold text-green-600">
                ${totalComisiones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Saldo Actual</p>
              <p className={`text-xl font-bold ${saldoActual > 0 ? 'text-destructive' : saldoActual < 0 ? 'text-green-600' : ''}`}>
                ${saldoActual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">
                {saldoActual > 0 ? 'Debe al comercio' : saldoActual < 0 ? 'A favor del empleado' : 'Sin saldo'}
              </p>
            </div>
          </div>

          {/* Movimientos */}
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : movimientos.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No hay movimientos registrados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((mov) => {
                    const tipoInfo = TIPO_LABELS[mov.tipo] || { label: mov.tipo, color: 'secondary', icon: null };
                    const esDeuda = mov.tipo === 'compra' || mov.tipo === 'adelanto';
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
                        <TableCell className={`text-right font-medium ${esDeuda ? 'text-destructive' : 'text-green-600'}`}>
                          {esDeuda ? '+' : '-'}${Number(mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <RegistrarMovimientoDialog
        open={movimientoDialogOpen}
        onOpenChange={setMovimientoDialogOpen}
        empleadoId={empleado.id}
        onSuccess={handleMovimientoSuccess}
      />
    </>
  );
}
