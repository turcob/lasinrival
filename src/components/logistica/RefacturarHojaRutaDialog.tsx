import { useMemo, useState } from 'react';
import { Loader2, Printer, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';
import { useRefacturarHojaRuta } from '@/hooks/useLogistica';
import { generarRemitoHTML, REMITO_STYLES, buildRemitoOrientationToolbar } from '@/lib/imprimirRemito';

interface RefacturarHojaRutaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hojaRuta: any;
  productosCarga: Array<{ id: string; codigo: string; descripcion: string; cantidad_total: number }>;
  onSuccess?: () => Promise<void> | void;
}

const parseCantidad = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const formatCantidad = (value: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(value || 0);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

export function RefacturarHojaRutaDialog({
  open,
  onOpenChange,
  hojaRuta,
  productosCarga,
  onSuccess,
}: RefacturarHojaRutaDialogProps) {
  const [productoId, setProductoId] = useState('');
  const [nuevaCantidad, setNuevaCantidad] = useState('');
  const [resultado, setResultado] = useState<any | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const refacturar = useRefacturarHojaRuta();
  const { config: empresaConfig } = useConfiguracionComercio();

  const productoSeleccionado = productosCarga.find((p) => p.id === productoId) || null;
  const cantidadActual = productoSeleccionado?.cantidad_total || 0;
  const nuevaCantidadNumero = parseCantidad(nuevaCantidad);
  const cantidadADescontar = cantidadActual - (Number.isFinite(nuevaCantidadNumero) ? nuevaCantidadNumero : 0);

  const lineasAfectadas = useMemo(() => {
    if (!hojaRuta || !productoId) return [];

    return (hojaRuta.paradas || [])
      .flatMap((parada: any) =>
        (parada.pedido?.detalles || [])
          .filter((detalle: any) => detalle.producto_id === productoId && Number(detalle.cantidad_pedida) > 0)
          .map((detalle: any) => ({
            paradaId: parada.id,
            pedidoId: parada.pedido.id,
            numeroPedido: parada.pedido.numero_pedido,
            cliente: parada.pedido.cliente?.nombre || '-',
            cantidad: Number(detalle.cantidad_pedida || 0),
          }))
      )
      .sort((a: any, b: any) => a.cantidad - b.cantidad || a.numeroPedido - b.numeroPedido);
  }, [hojaRuta, productoId]);

  const vistaPrevia = useMemo(() => {
    let restante = Math.max(0, cantidadADescontar);
    return lineasAfectadas
      .map((linea: any) => {
        const quitar = Math.min(restante, linea.cantidad);
        restante -= quitar;
        return {
          ...linea,
          quitar,
          cantidadNueva: linea.cantidad - quitar,
        };
      })
      .filter((linea: any) => linea.quitar > 0);
  }, [lineasAfectadas, cantidadADescontar]);

  const errorValidacion = (() => {
    if (!productoId) return 'Seleccioná un producto.';
    if (!nuevaCantidad.trim() || !Number.isFinite(nuevaCantidadNumero)) return 'Ingresá una cantidad válida.';
    if (nuevaCantidadNumero < 0) return 'La nueva cantidad no puede ser negativa.';
    if (nuevaCantidadNumero >= cantidadActual) return 'La nueva cantidad debe ser menor que la actual.';
    return '';
  })();

  const handleConfirmar = async () => {
    if (!hojaRuta || errorValidacion) return;
    const data = await refacturar.mutateAsync({
      hojaRutaId: hojaRuta.id,
      productoId,
      nuevaCantidad: nuevaCantidadNumero,
    });
    setResultado(data);
    await onSuccess?.();
  };

  const handleImprimirAfectados = async () => {
    const pedidosAfectados = resultado?.pedidos_afectados || [];
    if (!pedidosAfectados.length) return;

    setImprimiendo(true);
    try {
      const ids = pedidosAfectados.map((p: any) => p.pedido_id);
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select(`
          id, numero_pedido, fecha_pedido, total,
          cliente:clientes(id, nombre, codigo_cliente, dni_cuit, direccion, zona:zonas(nombre)),
          vendedor:vendedores(id, nombre),
          detalles:pedido_detalles(
            id, producto_id, cantidad_pedida, precio_unitario, descuento_porcentaje, subtotal,
            producto:productos(id, descripcion, codigo_articulo, unidad_medida)
          )
        `)
        .in('id', ids);

      if (error) throw error;

      const orden = new Map<string, number>(ids.map((id: string, index: number) => [id, index]));
      const pedidosOrdenados = [...(pedidos || [])].sort(
        (a: any, b: any) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0)
      );

      const remitosHTML = pedidosOrdenados.map((pedido: any, index: number) =>
        generarRemitoHTML({
          numeroPedido: pedido.numero_pedido,
          fecha: new Date(pedido.fecha_pedido),
          cliente: {
            nombre: pedido.cliente?.nombre || '-',
            codigoCliente: pedido.cliente?.codigo_cliente || undefined,
            direccion: pedido.cliente?.direccion || '',
            cuit: pedido.cliente?.dni_cuit || '',
            zona: pedido.cliente?.zona?.nombre || undefined,
          },
          vendedor: pedido.vendedor?.nombre || undefined,
          empresa: empresaConfig ? {
            razonSocial: empresaConfig.nombre_fantasia || empresaConfig.razon_social,
            cuit: empresaConfig.cuit,
            direccion: [empresaConfig.direccion, empresaConfig.localidad, empresaConfig.provincia].filter(Boolean).join(', '),
            telefono: empresaConfig.telefono || undefined,
          } : undefined,
          lineas: (pedido.detalles || [])
            .filter((d: any) => d.producto && Number(d.cantidad_pedida) > 0)
            .map((d: any) => ({
              codigo: d.producto.codigo_articulo,
              descripcion: d.producto.descripcion,
              unidadMedida: d.producto.unidad_medida || 'UNI',
              cantidad: d.cantidad_pedida,
              precioUnitario: d.precio_unitario,
              descuento: d.descuento_porcentaje ?? 0,
              subtotal: d.subtotal,
            })),
          total: pedido.total,
        }, index === pedidosOrdenados.length - 1)
      ).join('');

      const ventana = window.open('', '_blank', 'width=800,height=600');
      if (!ventana) {
        alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
        return;
      }

      ventana.document.write(`
        <!DOCTYPE html>
        <html><head><title>Remitos refacturados</title>
        <style id="remito-styles">${REMITO_STYLES}</style>
        </head><body>
          ${remitosHTML}
          ${buildRemitoOrientationToolbar()}
        </body></html>
      `);
      ventana.document.close();
    } finally {
      setImprimiendo(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setProductoId('');
      setNuevaCantidad('');
      setResultado(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" />
            Refacturar hoja #{hojaRuta?.numero_hoja || ''}
          </SheetTitle>
          <SheetDescription>
            Bajá la cantidad consolidada de un producto y regenerá los remitos afectados.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="producto-refacturar">Producto</Label>
            <select
              id="producto-refacturar"
              value={productoId}
              onChange={(e) => {
                setProductoId(e.target.value);
                setNuevaCantidad('');
                setResultado(null);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Seleccionar producto</option>
              {productosCarga.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.codigo} - {producto.descripcion} ({formatCantidad(producto.cantidad_total)})
                </option>
              ))}
            </select>
          </div>

          {productoSeleccionado && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
              <div>
                <p className="text-muted-foreground">Cantidad actual</p>
                <p className="text-xl font-semibold">{formatCantidad(cantidadActual)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">A descontar</p>
                <p className="text-xl font-semibold">{nuevaCantidad ? formatCantidad(Math.max(0, cantidadADescontar)) : '-'}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nueva-cantidad-refacturar">Nueva cantidad total</Label>
            <Input
              id="nueva-cantidad-refacturar"
              inputMode="decimal"
              value={nuevaCantidad}
              onChange={(e) => {
                setNuevaCantidad(e.target.value);
                setResultado(null);
              }}
              placeholder="Ej: 10"
            />
            {errorValidacion && productoId && nuevaCantidad && (
              <p className="text-sm text-destructive">{errorValidacion}</p>
            )}
          </div>

          {vistaPrevia.length > 0 && !resultado && (
            <div className="space-y-2">
              <h4 className="font-medium">Vista previa de descuento</h4>
              <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
                {vistaPrevia.map((linea: any) => (
                  <div key={linea.detalle_id || `${linea.pedidoId}-${linea.cantidad}`} className="p-3 text-sm flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Pedido #{linea.numeroPedido} · {linea.cliente}</p>
                      <p className="text-muted-foreground">{formatCantidad(linea.cantidad)} → {formatCantidad(linea.cantidadNueva)}</p>
                    </div>
                    <span className="font-semibold">-{formatCantidad(linea.quitar)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultado && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="font-semibold">Refacturación aplicada</p>
                <p className="text-sm text-muted-foreground">
                  {formatCantidad(resultado.cantidad_anterior)} → {formatCantidad(resultado.cantidad_nueva)} · Descontado: {formatCantidad(resultado.cantidad_descontada)}
                </p>
              </div>
              <div className="rounded-md border bg-background divide-y">
                {(resultado.pedidos_afectados || []).map((pedido: any) => (
                  <div key={pedido.detalle_id} className="p-3 text-sm flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Pedido #{pedido.numero_pedido}</p>
                      <p className="text-muted-foreground">{formatCantidad(pedido.cantidad_anterior)} → {formatCantidad(pedido.cantidad_nueva)}</p>
                    </div>
                    <p className="font-semibold">${formatCurrency(pedido.total_nuevo)}</p>
                  </div>
                ))}
              </div>
              <Button onClick={handleImprimirAfectados} disabled={imprimiendo} className="w-full">
                {imprimiendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                Imprimir remitos nuevos
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cerrar
            </Button>
            {!resultado && (
              <Button onClick={handleConfirmar} disabled={!!errorValidacion || refacturar.isPending}>
                {refacturar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                Confirmar refacturación
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Se descuenta empezando por el pedido con menor cantidad del producto. El remito anterior queda registrado como anulado operativamente en el historial.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
