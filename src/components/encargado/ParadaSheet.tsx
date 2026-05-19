import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, PackageX, Clock, Loader2, MinusCircle } from 'lucide-react';
import { useActualizarEstadoParada, type HojaRutaParada } from '@/hooks/useLogistica';
import { useCobrosParada, useDevolucionesParada } from '@/hooks/useLogistica';
import { CobrarSheet } from './CobrarSheet';
import { DevolucionSheet } from './DevolucionSheet';
import { Card, CardContent } from '@/components/ui/card';

interface ParadaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hojaRutaId: string;
  parada: HojaRutaParada | null;
}

export function ParadaSheet({ open, onOpenChange, hojaRutaId, parada }: ParadaSheetProps) {
  const cambiarEstado = useActualizarEstadoParada();
  const { data: cobros = [] } = useCobrosParada(parada?.id);
  const { data: devoluciones = [] } = useDevolucionesParada(parada?.id);
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [noEntregadoOpen, setNoEntregadoOpen] = useState(false);
  const [obs, setObs] = useState('');

  if (!parada) return null;

  const totalPedidoOriginal = Number(parada.pedido?.total ?? 0);
  const montoRechazado = (devoluciones as any[]).reduce((s, d) => {
    const precio = Number(d.pedido_detalle?.precio_unitario ?? 0);
    const desc = Number(d.pedido_detalle?.descuento_porcentaje ?? 0);
    const neto = precio * (1 - desc / 100);
    return s + neto * Number(d.cantidad ?? 0);
  }, 0);
  const totalPedido = Math.max(0, totalPedidoOriginal - montoRechazado);
  const montoCobrado = cobros.reduce((s, c: any) => s + Number(c.monto), 0);
  const saldo = totalPedido - montoCobrado;
  const yaEntregado = ['entregado', 'entrega_parcial', 'rechazado', 'no_entregado'].includes(parada.estado);

  const handleEntregaSinCobro = async () => {
    await cambiarEstado.mutateAsync({ id: parada.id, estado: 'entregado' });
    onOpenChange(false);
  };

  const handleNoEntregado = async () => {
    await cambiarEstado.mutateAsync({ id: parada.id, estado: 'no_entregado', observaciones: obs });
    setNoEntregadoOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open && !cobrarOpen && !devolverOpen && !noEntregadoOpen} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg">{parada.pedido?.cliente?.nombre}</SheetTitle>
            <SheetDescription>
              Pedido #{parada.pedido?.numero_pedido}
              {parada.pedido?.cliente?.direccion && (
                <> · {parada.pedido.cliente.direccion}</>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <Card>
              <CardContent className="p-3 space-y-1 text-sm">
                {montoRechazado > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pedido original:</span>
                      <span className="line-through">${totalPedidoOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-amber-700">
                      <span>Rechazado:</span>
                      <span>-${montoRechazado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total a cobrar:</span>
                  <span className="font-semibold">${totalPedido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                {montoCobrado > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Cobrado:</span>
                    <span className="font-semibold">${montoCobrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t">
                  <span className="font-medium">Saldo:</span>
                  <span className="font-bold">${Math.max(0, saldo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {yaEntregado ? (
              <div className="text-center text-sm text-muted-foreground py-2">
                Esta parada ya está en estado: <strong className="capitalize">{parada.estado.replace('_', ' ')}</strong>
              </div>
            ) : (
              <div className="space-y-2">
                {saldo > 0 ? (
                  <>
                    <Button size="lg" className="w-full h-14 bg-green-600 hover:bg-green-700 text-base" onClick={() => setCobrarOpen(true)}>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Cobrar y entregar
                    </Button>
                  </>
                ) : (
                  <Button size="lg" className="w-full h-14 bg-green-600 hover:bg-green-700 text-base" onClick={handleEntregaSinCobro}>
                    {cambiarEstado.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Marcar entregado
                  </Button>
                )}

                <Button size="lg" variant="outline" className="w-full h-12 border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => setDevolverOpen(true)}>
                  <PackageX className="h-4 w-4 mr-2" />
                  Rechazó mercadería
                </Button>

                <Button size="lg" variant="outline" className="w-full h-12" onClick={() => setNoEntregadoOpen(true)}>
                  <Clock className="h-4 w-4 mr-2" />
                  No se pudo entregar
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CobrarSheet
        open={cobrarOpen}
        onOpenChange={setCobrarOpen}
        hojaRutaId={hojaRutaId}
        paradaId={parada.id}
        pedidoId={parada.pedido_id}
        totalPedido={totalPedido}
        montoCobradoPrevio={montoCobrado}
        clienteNombre={parada.pedido?.cliente?.nombre ?? 'Cliente'}
        onSuccess={() => { onOpenChange(false); }}
      />

      <DevolucionSheet
        open={devolverOpen}
        onOpenChange={setDevolverOpen}
        hojaRutaId={hojaRutaId}
        paradaId={parada.id}
        pedidoDetalles={(parada.pedido?.detalles ?? []) as any}
        clienteNombre={parada.pedido?.cliente?.nombre ?? 'Cliente'}
        onSuccess={() => { onOpenChange(false); }}
      />

      <Sheet open={noEntregadoOpen} onOpenChange={setNoEntregadoOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Marcar como no entregado</SheetTitle>
            <SheetDescription>Indicá el motivo (cliente cerrado, ausente, dirección errónea, etc.)</SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-3">
            <Textarea
              placeholder="Motivo..."
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
            <Button className="w-full h-12" onClick={handleNoEntregado} disabled={cambiarEstado.isPending}>
              <MinusCircle className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}