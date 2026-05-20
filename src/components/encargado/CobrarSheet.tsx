import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useFormasPago, useRegistrarCobrosEncargado, clasificarMedioPago } from '@/hooks/useEncargado';
import { useActualizarEstadoParada } from '@/hooks/useLogistica';
import { Banknote, CreditCard, Smartphone, DollarSign, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CobrarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hojaRutaId: string;
  paradaId: string;
  pedidoId: string;
  totalPedido: number;
  montoCobradoPrevio: number;
  clienteNombre: string;
  onSuccess: () => void;
  totalOriginal?: number;
  montoRechazado?: number;
}

interface Renglon {
  forma_pago_id: string;
  monto: number;
  referencia: string;
}

const iconoFP = (nombre: string) => {
  const t = clasificarMedioPago(nombre);
  if (t === 'efectivo') return <Banknote className="h-4 w-4" />;
  if (t === 'tarjeta') return <CreditCard className="h-4 w-4" />;
  if (t === 'transferencias' || t === 'qr') return <Smartphone className="h-4 w-4" />;
  return <DollarSign className="h-4 w-4" />;
};

export function CobrarSheet({
  open, onOpenChange, hojaRutaId, paradaId, pedidoId,
  totalPedido, montoCobradoPrevio, clienteNombre, onSuccess,
  totalOriginal, montoRechazado = 0,
}: CobrarSheetProps) {
  const { data: formasPago = [] } = useFormasPago();
  const registrar = useRegistrarCobrosEncargado();
  const cambiarEstado = useActualizarEstadoParada();
  const { toast } = useToast();

  const saldo = Math.max(0, totalPedido - montoCobradoPrevio);
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (open) {
      setRenglones([]);
      setObservaciones('');
    }
  }, [open]);

  const totalCobros = renglones.reduce((s, r) => s + (Number(r.monto) || 0), 0);
  const saldoFinal = saldo - totalCobros;

  const agregarMedio = (formaPagoId: string) => {
    // Si ya existe, sumar al primero con ese medio el saldo pendiente
    const restante = Math.max(0, saldo - totalCobros);
    setRenglones([...renglones, { forma_pago_id: formaPagoId, monto: restante, referencia: '' }]);
  };

  const eliminar = (idx: number) => setRenglones(renglones.filter((_, i) => i !== idx));

  const actualizar = (idx: number, patch: Partial<Renglon>) => {
    setRenglones(renglones.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const handleConfirmar = async () => {
    if (renglones.length === 0 || totalCobros <= 0) {
      toast({ title: 'Ingresá al menos un cobro', variant: 'destructive' });
      return;
    }
    if (saldoFinal > 0.01) {
      toast({ title: 'Falta cobrar el saldo total', description: `Faltan $${saldoFinal.toFixed(2)}`, variant: 'destructive' });
      return;
    }
    try {
      await registrar.mutateAsync({
        hojaRutaId, paradaId, pedidoId, totalPedido,
        montoCobradoPrevio,
        cobros: renglones.map(r => ({ forma_pago_id: r.forma_pago_id, monto: r.monto, referencia: r.referencia })),
      });
      await cambiarEstado.mutateAsync({
        id: paradaId,
        estado: 'entregado',
        observaciones: observaciones || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      // toast ya manejado por el hook
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background border-b p-4">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg">Cobrar a {clienteNombre}</SheetTitle>
            <SheetDescription>
              Total: <span className="font-semibold text-foreground">${totalPedido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              {montoCobradoPrevio > 0 && (
                <> · Ya cobrado: <span className="text-green-600 font-medium">${montoCobradoPrevio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></>
              )}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="p-4 space-y-4 pb-32">
          {montoRechazado > 0.01 && totalOriginal != null && (
            <Card className="bg-amber-500/5 border-amber-500/30">
              <CardContent className="p-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total pedido:</span>
                  <span className="line-through">${totalOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Rechazado:</span>
                  <span>-${montoRechazado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-1 border-t font-semibold">
                  <span>Total final:</span>
                  <span>${totalPedido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saldo a cobrar */}
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="p-3 flex justify-between items-center">
              <span className="text-sm">Saldo a cobrar:</span>
              <span className="text-2xl font-bold">${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>

          {/* Botones de medios de pago */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">AGREGAR MEDIO DE PAGO</p>
            <div className="grid grid-cols-2 gap-2">
              {formasPago.map((fp) => (
                <Button
                  key={fp.id}
                  variant="outline"
                  className="h-14 justify-start gap-2"
                  onClick={() => agregarMedio(fp.id)}
                >
                  {iconoFP(fp.nombre)}
                  <span className="text-sm">{fp.nombre}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Renglones agregados */}
          {renglones.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">COBROS</p>
              {renglones.map((r, i) => {
                const fp = formasPago.find(f => f.id === r.forma_pago_id);
                return (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="gap-1">
                          {iconoFP(fp?.nombre ?? '')}
                          {fp?.nombre}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => eliminar(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        type="number" inputMode="decimal" step="0.01" min={0}
                        className="h-12 text-lg font-semibold text-right"
                        value={r.monto || ''}
                        onChange={(e) => actualizar(i, { monto: Number(e.target.value) })}
                        placeholder="0.00"
                      />
                      <Input
                        className="h-10"
                        placeholder="Referencia (opcional)"
                        value={r.referencia}
                        onChange={(e) => actualizar(i, { referencia: e.target.value })}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Observaciones */}
          <Textarea
            placeholder="Observaciones (opcional)"
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />

          {/* Resumen */}
          {renglones.length > 0 && (
            <Card className={saldoFinal <= 0.01 ? 'border-green-500 bg-green-500/5' : 'border-amber-500 bg-amber-500/5'}>
              <CardContent className="p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total a cobrar ahora:</span>
                  <span className="font-bold">${totalCobros.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className={`flex justify-between ${saldoFinal <= 0.01 ? 'text-green-700' : 'text-amber-700'}`}>
                  <span>{saldoFinal <= 0.01 ? '✓ Pedido completo' : 'Saldo pendiente:'}</span>
                  <span className="font-semibold">{saldoFinal > 0.01 ? `$${saldoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer sticky con acciones */}
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background p-3 shadow-lg">
          <div className="max-w-md mx-auto">
            <Button
              size="lg" className="w-full h-14"
              disabled={registrar.isPending || cambiarEstado.isPending || saldoFinal > 0.01 || totalCobros <= 0}
              onClick={handleConfirmar}
            >
              {(registrar.isPending || cambiarEstado.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar cobro
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}