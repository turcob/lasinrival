import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, PackageX, Loader2, XCircle, Package } from 'lucide-react';
import { useActualizarEstadoParada, useRegistrarDevolucion, type HojaRutaParada } from '@/hooks/useLogistica';
import { useCobrosParada, useDevolucionesParada } from '@/hooks/useLogistica';
import { useDevolucionesVendedorParada, useVentasRechazadosParada } from '@/hooks/useEncargado';
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
  const registrarDevolucion = useRegistrarDevolucion();
  const { data: cobros = [] } = useCobrosParada(parada?.id);
  const { data: devoluciones = [] } = useDevolucionesParada(parada?.id);
  const { data: devolucionesVendedor = [] } = useDevolucionesVendedorParada(parada?.id);
  const { data: ventasExtra = [] } = useVentasRechazadosParada(parada?.id);
  const [tipoEntregaOpen, setTipoEntregaOpen] = useState(false);
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [continuarACobro, setContinuarACobro] = useState(false);
  const [rechazadoOpen, setRechazadoOpen] = useState(false);
  const [obs, setObs] = useState('');
  const [rechazoPendiente, setRechazoPendiente] = useState(0);

  if (!parada) return null;

  const totalPedidoOriginal = Number(parada.pedido?.total ?? 0);
  const montoRechazadoQuery = (devoluciones as any[]).reduce((s, d) => {
    const precio = Number(d.pedido_detalle?.precio_unitario ?? 0);
    const desc = Number(d.pedido_detalle?.descuento_porcentaje ?? 0);
    const neto = precio * (1 - desc / 100);
    return s + neto * Number(d.cantidad ?? 0);
  }, 0);
  // Usamos el máximo entre lo que devuelve la query y lo recién rechazado
  // para evitar que un refetch tardío muestre el total sin descuento.
  const montoRechazado = Math.max(montoRechazadoQuery, rechazoPendiente);
  const totalPedido = Math.max(0, totalPedidoOriginal - montoRechazado);
  const totalDevVendedor = (devolucionesVendedor as any[]).reduce((s, d) => s + Number(d.monto ?? 0), 0);
  const totalVentasExtra = (ventasExtra as any[]).reduce((s, v) => s + Number(v.monto_total ?? 0), 0);
  const montoCobrado = cobros.reduce((s, c: any) => s + Number(c.monto), 0) + totalDevVendedor + totalVentasExtra;
  const totalConExtras = totalPedido + totalVentasExtra;
  const saldo = totalConExtras - montoCobrado;
  const yaEntregado = ['entregado', 'entrega_parcial', 'rechazado', 'no_entregado'].includes(parada.estado);

  const handleEntregaSinCobro = async () => {
    await cambiarEstado.mutateAsync({ id: parada.id, estado: 'entregado' });
    onOpenChange(false);
  };

  const handleRechazado = async () => {
    try {
      // Registrar devolución por cada producto del pedido para que el stock
      // quede disponible para revender y se generen NCs pendientes (igual
      // que el flujo de rechazo parcial).
      const detalles = (parada.pedido?.detalles ?? []) as any[];
      const yaRechazadosPorDetalle = new Map<string, number>();
      for (const d of devoluciones as any[]) {
        const did = d.pedido_detalle_id as string;
        yaRechazadosPorDetalle.set(did, (yaRechazadosPorDetalle.get(did) ?? 0) + Number(d.cantidad ?? 0));
      }
      for (const det of detalles) {
        const cantPedida = Number(det.cantidad_pedida ?? 0);
        const yaRech = yaRechazadosPorDetalle.get(det.id) ?? 0;
        const restante = cantPedida - yaRech;
        if (restante <= 0) continue;
        await registrarDevolucion.mutateAsync({
          hoja_ruta_id: hojaRutaId,
          parada_id: parada.id,
          pedido_detalle_id: det.id,
          cantidad: restante,
          motivo: 'rechazo_cliente',
          detalle_motivo: obs || undefined,
          reingresarStock: true,
        });
      }
      await cambiarEstado.mutateAsync({ id: parada.id, estado: 'no_entregado', observaciones: obs });
      setRechazadoOpen(false);
      onOpenChange(false);
    } catch (e) {
      // El hook de devolución ya muestra toast con el error; no cerramos el sheet.
    }
  };

  return (
    <>
      <Sheet open={open && !tipoEntregaOpen && !cobrarOpen && !devolverOpen && !rechazadoOpen} onOpenChange={onOpenChange}>
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
                {totalVentasExtra > 0 && (
                  <div className="flex justify-between text-blue-700">
                    <span>Adicional vendido (stock rechazado):</span>
                    <span>+${totalVentasExtra.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
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

            {ventasExtra.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/40">
                <CardContent className="p-3 space-y-1">
                  <p className="text-xs font-medium text-blue-900 mb-1 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    PRODUCTOS EXTRA VENDIDOS ({ventasExtra.length})
                  </p>
                  <ul className="space-y-1">
                    {(ventasExtra as any[]).map((v) => (
                      <li key={v.id} className="flex justify-between gap-2 text-[11px]">
                        <span className="min-w-0 flex-1 text-foreground/80">
                          <span className="font-mono">{v.producto?.codigo_articulo ?? '-'}</span> · {v.producto?.descripcion ?? 'Producto'}
                          <span className="text-muted-foreground"> — {Number(v.cantidad)} ud × ${Number(v.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })} · {v.forma_pago?.nombre ?? ''}</span>
                        </span>
                        <span className="font-medium text-blue-800 whitespace-nowrap">
                          ${Number(v.monto_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {yaEntregado ? (
              <div className="text-center text-sm text-muted-foreground py-2">
                Esta parada ya está en estado: <strong className="capitalize">{parada.estado.replace('_', ' ')}</strong>
              </div>
            ) : (
              <div className="space-y-2">
                {saldo > 0 ? (
                  <Button size="lg" className="w-full h-14 bg-green-600 hover:bg-green-700 text-base" onClick={() => setTipoEntregaOpen(true)}>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Cobrar y entregar
                  </Button>
                ) : (
                  <Button size="lg" className="w-full h-14 bg-green-600 hover:bg-green-700 text-base" onClick={handleEntregaSinCobro}>
                    {cambiarEstado.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Marcar entregado
                  </Button>
                )}

                <Button size="lg" variant="outline" className="w-full h-12 border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => setRechazadoOpen(true)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazado
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Selector parcial / total */}
      <Sheet open={tipoEntregaOpen} onOpenChange={setTipoEntregaOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader className="text-left">
            <SheetTitle>¿Cómo es la entrega?</SheetTitle>
            <SheetDescription>Elegí si el cliente acepta todo el pedido o rechaza algunos productos.</SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-2">
            <Button
              size="lg"
              className="w-full h-16 bg-green-600 hover:bg-green-700 text-base justify-start"
              onClick={() => {
                setTipoEntregaOpen(false);
                setCobrarOpen(true);
              }}
            >
              <CheckCircle2 className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Entrega completa</div>
                <div className="text-xs opacity-90">El cliente acepta todo el pedido</div>
              </div>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full h-16 border-amber-500 text-amber-700 hover:bg-amber-50 justify-start"
              onClick={() => {
                setTipoEntregaOpen(false);
                setContinuarACobro(true);
                setDevolverOpen(true);
              }}
            >
              <PackageX className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Entrega parcial</div>
                <div className="text-xs opacity-80">El cliente rechaza algunos productos</div>
              </div>
            </Button>
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
        totalOriginal={totalPedidoOriginal}
        montoRechazado={montoRechazado}
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
        onSuccess={(montoRechazadoAhora) => {
          if (!continuarACobro) {
            onOpenChange(false);
            return;
          }
          setContinuarACobro(false);
          // Sumar al rechazo previo (de la query) lo recién rechazado.
          const totalRechazadoNuevo = montoRechazadoQuery + montoRechazadoAhora;
          setRechazoPendiente(totalRechazadoNuevo);
          const nuevoTotal = Math.max(0, totalPedidoOriginal - totalRechazadoNuevo);
          const nuevoSaldo = Math.max(0, nuevoTotal - montoCobrado);
          if (nuevoSaldo <= 0.01) {
            // Rechazo total (o no queda saldo): marcar parada como rechazada, no abrir cobro.
            cambiarEstado
              .mutateAsync({
                id: parada.id,
                estado: 'no_entregado',
                observaciones: 'Rechazo total de la mercadería',
              })
              .finally(() => onOpenChange(false));
          } else {
            // El total se recalcula automáticamente al refrescar devoluciones
            setTimeout(() => setCobrarOpen(true), 250);
          }
        }}
      />

      <Sheet open={rechazadoOpen} onOpenChange={setRechazadoOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Marcar como rechazado</SheetTitle>
            <SheetDescription>Indicá el motivo (cliente cerrado, ausente, rechazó el pedido completo, dirección errónea, etc.)</SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-3">
            <Textarea
              placeholder="Motivo..."
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
            <Button className="w-full h-12" variant="destructive" onClick={handleRechazado} disabled={cambiarEstado.isPending || registrarDevolucion.isPending}>
              {(cambiarEstado.isPending || registrarDevolucion.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <XCircle className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}