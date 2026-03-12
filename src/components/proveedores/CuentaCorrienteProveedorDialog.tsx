import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProveedorMovimientos, type Proveedor } from '@/hooks/useProveedores';
import RegistrarMovimientoProveedorDialog from './RegistrarMovimientoProveedorDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedor: Proveedor | null;
}

const tipoColors: Record<string, string> = {
  factura: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  pago: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  nota_credito: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  nota_debito: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  ajuste: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const tipoLabels: Record<string, string> = {
  factura: 'Factura',
  pago: 'Pago',
  nota_credito: 'Nota Crédito',
  nota_debito: 'Nota Débito',
  ajuste: 'Ajuste',
};

export default function CuentaCorrienteProveedorDialog({ open, onOpenChange, proveedor }: Props) {
  const { movimientos, loading, fetchMovimientos, crearMovimiento, saldoTotal } = useProveedorMovimientos(proveedor?.id);
  const [showNuevoMov, setShowNuevoMov] = useState(false);

  const formatMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
  const formatDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '-';

  const vencidos = movimientos.filter(m =>
    m.tipo === 'factura' && m.saldo_pendiente > 0 && m.fecha_vencimiento && new Date(m.fecha_vencimiento) < new Date()
  );

  const porVencer = movimientos.filter(m => {
    if (m.tipo !== 'factura' || m.saldo_pendiente <= 0 || !m.fecha_vencimiento) return false;
    const diff = (new Date(m.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Cuenta Corriente - {proveedor?.razon_social}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Saldo Total</p>
              <p className={`text-xl font-bold ${saldoTotal > 0 ? 'text-destructive' : 'text-green-600'}`}>
                {formatMoney(saldoTotal)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-destructive" /> Vencido
              </p>
              <p className="text-xl font-bold text-destructive">
                {formatMoney(vencidos.reduce((a, m) => a + m.saldo_pendiente, 0))}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Por vencer (7 días)</p>
              <p className="text-xl font-bold text-amber-600">
                {formatMoney(porVencer.reduce((a, m) => a + m.saldo_pendiente, 0))}
              </p>
            </div>
          </div>

          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => setShowNuevoMov(true)}>
              <Plus className="h-4 w-4 mr-1" /> Registrar Movimiento
            </Button>
          </div>

          <Tabs defaultValue="todos">
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="facturas">Facturas</TabsTrigger>
              <TabsTrigger value="pagos">Pagos</TabsTrigger>
              <TabsTrigger value="notas">Notas C/D</TabsTrigger>
            </TabsList>

            {['todos', 'facturas', 'pagos', 'notas'].map(tab => (
              <TabsContent key={tab} value={tab}>
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Comprobante</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientos
                        .filter(m => {
                          if (tab === 'todos') return true;
                          if (tab === 'facturas') return m.tipo === 'factura';
                          if (tab === 'pagos') return m.tipo === 'pago';
                          if (tab === 'notas') return m.tipo === 'nota_credito' || m.tipo === 'nota_debito';
                          return true;
                        })
                        .map(m => {
                          const isVencido = m.tipo === 'factura' && m.saldo_pendiente > 0 && m.fecha_vencimiento && new Date(m.fecha_vencimiento) < new Date();
                          return (
                            <TableRow key={m.id} className={isVencido ? 'bg-destructive/5' : ''}>
                              <TableCell>{formatDate(m.fecha_emision)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={tipoColors[m.tipo] || ''}>
                                  {tipoLabels[m.tipo] || m.tipo}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{m.numero_comprobante || '-'}</TableCell>
                              <TableCell>
                                {formatDate(m.fecha_vencimiento)}
                                {isVencido && <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />}
                              </TableCell>
                              <TableCell className="text-right">{formatMoney(m.monto)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {m.tipo === 'factura' ? formatMoney(m.saldo_pendiente) : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      {proveedor && (
        <RegistrarMovimientoProveedorDialog
          open={showNuevoMov}
          onOpenChange={setShowNuevoMov}
          proveedorId={proveedor.id}
          onSave={crearMovimiento}
        />
      )}
    </>
  );
}
