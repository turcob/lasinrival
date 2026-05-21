import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { PackageSearch, ShoppingCart, Loader2, Trash2 } from 'lucide-react';
import {
  useStockRechazadoHojaRuta,
  useVentasRechazadosHojaRuta,
  useRegistrarVentaRechazado,
  useFormasPago,
} from '@/hooks/useEncargado';
import { useHojaRuta } from '@/hooks/useLogistica';
import { useToast } from '@/hooks/use-toast';

export function StockRechazadoTab({ hojaRutaId }: { hojaRutaId: string }) {
  const { data: stock = [], isLoading } = useStockRechazadoHojaRuta(hojaRutaId);
  const { data: ventas = [] } = useVentasRechazadosHojaRuta(hojaRutaId);
  const { data: hoja } = useHojaRuta(hojaRutaId);
  const { data: formasPago = [] } = useFormasPago();
  const registrar = useRegistrarVentaRechazado();
  const { toast } = useToast();

  const paradas: any[] = (hoja as any)?.paradas ?? [];
  // Solo clientes que están en la hoja
  const clientes = useMemo(
    () => paradas
      .filter(p => p.pedido?.cliente)
      .map(p => ({
        parada_id: p.id,
        cliente_id: p.pedido.cliente.id,
        nombre: p.pedido.cliente.nombre,
      })),
    [paradas]
  );

  const [openVender, setOpenVender] = useState(false);
  const [productoSel, setProductoSel] = useState<typeof stock[number] | null>(null);
  const [paradaSel, setParadaSel] = useState<string>('');
  const [cantidad, setCantidad] = useState<string>('');
  const [precio, setPrecio] = useState<string>('');
  const [formaPagoId, setFormaPagoId] = useState<string>('');
  const [obs, setObs] = useState('');

  const abrirVender = (p: typeof stock[number]) => {
    setProductoSel(p);
    setParadaSel('');
    setCantidad('');
    setPrecio(p.precio_sugerido > 0 ? p.precio_sugerido.toFixed(2) : '');
    setFormaPagoId('');
    setObs('');
    setOpenVender(true);
  };

  const cantidadNum = parseFloat((cantidad || '').replace(',', '.')) || 0;
  const precioNum = parseFloat((precio || '').replace(',', '.')) || 0;
  const total = cantidadNum * precioNum;

  const handleVender = async () => {
    if (!productoSel) return;
    if (!paradaSel) return toast({ title: 'Elegí un cliente', variant: 'destructive' });
    if (cantidadNum <= 0) return toast({ title: 'Cantidad inválida', variant: 'destructive' });
    if (cantidadNum > productoSel.disponible + 0.001)
      return toast({ title: `Disponible: ${productoSel.disponible}`, variant: 'destructive' });
    if (precioNum <= 0) return toast({ title: 'Precio inválido', variant: 'destructive' });
    if (!formaPagoId) return toast({ title: 'Elegí forma de pago', variant: 'destructive' });
    const cli = clientes.find(c => c.parada_id === paradaSel);
    if (!cli) return;
    try {
      await registrar.mutateAsync({
        hoja_ruta_id: hojaRutaId,
        parada_id: cli.parada_id,
        cliente_id: cli.cliente_id,
        producto_id: productoSel.producto_id,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
        forma_pago_id: formaPagoId,
        observaciones: obs || undefined,
      });
      setOpenVender(false);
    } catch {}
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Productos rechazados por clientes durante el reparto. Podés venderlos a otro cliente de la hoja y se suma a la rendición.
      </p>

      {isLoading ? (
        <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : stock.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          <PackageSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No hay productos rechazados aún.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {stock.map((p) => (
            <Card key={p.producto_id} className={p.disponible <= 0 ? 'opacity-60' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-muted-foreground">{p.codigo}</p>
                    <p className="text-sm font-medium leading-tight">{p.descripcion}</p>
                    <div className="flex gap-2 mt-1 text-[11px]">
                      <Badge variant="outline">Rechazado: {p.rechazado}</Badge>
                      {p.vendido > 0 && <Badge variant="secondary">Vendido: {p.vendido}</Badge>}
                      <Badge variant={p.disponible > 0 ? 'default' : 'outline'}>
                        Disp.: {p.disponible} {p.unidad}
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" disabled={p.disponible <= 0} onClick={() => abrirVender(p)}>
                    <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Vender
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {ventas.length > 0 && (
        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            VENTAS REALIZADAS ({ventas.length})
          </p>
          <Card>
            <CardContent className="p-0 divide-y">
              {(ventas as any[]).map((v) => (
                <div key={v.id} className="p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium truncate">{v.cliente?.nombre ?? 'Cliente'}</p>
                    <span className="font-semibold">
                      ${Number(v.monto_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {v.producto?.codigo_articulo} · {v.producto?.descripcion} · {Number(v.cantidad)} ud × $
                    {Number(v.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{v.forma_pago?.nombre}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Sheet open={openVender} onOpenChange={setOpenVender}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Vender producto rechazado</SheetTitle>
            <SheetDescription>
              {productoSel && (
                <>
                  <span className="font-medium">{productoSel.descripcion}</span> · disp.:{' '}
                  {productoSel.disponible} {productoSel.unidad}
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">CLIENTE</p>
              <div className="grid gap-1 max-h-44 overflow-y-auto">
                {clientes.map(c => (
                  <Button
                    key={c.parada_id}
                    type="button"
                    variant={paradaSel === c.parada_id ? 'default' : 'outline'}
                    className="justify-start h-10"
                    onClick={() => setParadaSel(c.parada_id)}
                  >
                    {c.nombre}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">CANTIDAD</p>
                <Input
                  type="number" inputMode="decimal" step="0.001" min={0}
                  max={productoSel?.disponible}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">PRECIO UNIT.</p>
                <Input
                  type="number" inputMode="decimal" step="0.01" min={0}
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">FORMA DE PAGO</p>
              <div className="grid grid-cols-2 gap-2">
                {formasPago.map(fp => (
                  <Button
                    key={fp.id}
                    type="button"
                    variant={formaPagoId === fp.id ? 'default' : 'outline'}
                    className="h-10 text-sm"
                    onClick={() => setFormaPagoId(fp.id)}
                  >
                    {fp.nombre}
                  </Button>
                ))}
              </div>
            </div>

            <Textarea
              rows={2}
              placeholder="Observaciones (opcional)"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />

            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-3 flex justify-between items-center">
                <span className="text-sm">Total</span>
                <span className="text-xl font-bold">
                  ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </CardContent>
            </Card>

            <Button
              size="lg" className="w-full h-12"
              disabled={registrar.isPending}
              onClick={handleVender}
            >
              {registrar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar venta
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}