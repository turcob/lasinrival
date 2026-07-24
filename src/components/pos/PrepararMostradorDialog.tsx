import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Scale, Package, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DetalleFila {
  producto_id: string | null;
  descripcion: string;
  codigo?: string | null;
  unidad_medida?: string | null;
  es_temporal: boolean;
  cantidad_pedida: number;
  precio_pedido: number;
  descuento_porcentaje: number;
  producto_temporal_nombre?: string | null;
  producto_temporal_precio?: number | null;
  // ajuste en curso
  cantidad_real: string;
  precio_real: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: any | null;
  onConfirmado: () => void;
}

function esPeso(unidad?: string | null) {
  if (!unidad) return false;
  const u = unidad.toLowerCase().trim();
  return u === 'kg' || u === 'kilo' || u === 'kilos' || u === 'kilogramo' || u === 'kilogramos';
}

function parseNumeroLocal(v: string): number {
  if (!v) return 0;
  const s = v.replace(/\./g, '').replace(',', '.').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function PrepararMostradorDialog({ open, onOpenChange, pedido, onConfirmado }: Props) {
  const [filas, setFilas] = useState<DetalleFila[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open || !pedido) {
      setFilas([]);
      return;
    }
    const detalles = pedido.venta_detalles || [];
    setFilas(
      detalles.map((d: any) => {
        const esTemp = !!d.producto_temporal_nombre;
        const desc = esTemp
          ? d.producto_temporal_nombre
          : d.productos?.descripcion || 'Producto';
        const precio = Number(d.precio_unitario ?? d.producto_temporal_precio ?? 0);
        const cantidad = Number(d.cantidad ?? 0);
        return {
          producto_id: d.producto_id ?? null,
          descripcion: desc,
          codigo: d.productos?.codigo_articulo ?? null,
          unidad_medida: d.productos?.unidad_medida ?? (esTemp ? 'u' : 'u'),
          es_temporal: esTemp,
          cantidad_pedida: cantidad,
          precio_pedido: precio,
          descuento_porcentaje: Number(d.descuento_porcentaje ?? 0),
          producto_temporal_nombre: d.producto_temporal_nombre ?? null,
          producto_temporal_precio: d.producto_temporal_precio ?? null,
          cantidad_real: cantidad.toString().replace('.', ','),
          precio_real: precio.toString().replace('.', ','),
        } as DetalleFila;
      })
    );
  }, [open, pedido]);

  const totales = useMemo(() => {
    let subtotal = 0;
    let desc = 0;
    let total = 0;
    for (const f of filas) {
      const c = parseNumeroLocal(f.cantidad_real);
      const p = parseNumeroLocal(f.precio_real);
      const bruto = c * p;
      const descLinea = f.descuento_porcentaje > 0 ? bruto * (f.descuento_porcentaje / 100) : 0;
      subtotal += bruto;
      desc += descLinea;
      total += bruto - descLinea;
    }
    return { subtotal, desc, total };
  }, [filas]);

  const actualizar = (idx: number, campo: 'cantidad_real' | 'precio_real', valor: string) => {
    setFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
  };

  const quitarFila = (idx: number) => {
    setFilas((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmar = async () => {
    if (!pedido) return;

    // Validar
    for (const f of filas) {
      const c = parseNumeroLocal(f.cantidad_real);
      const p = parseNumeroLocal(f.precio_real);
      if (c <= 0) {
        toast.error(`Cantidad inválida en "${f.descripcion}"`);
        return;
      }
      if (p <= 0) {
        toast.error(`Precio inválido en "${f.descripcion}"`);
        return;
      }
    }

    if (filas.length === 0) {
      toast.error('El pedido no puede quedar vacío. Cancele el pedido en su lugar.');
      return;
    }

    setGuardando(true);
    try {
      const detallesPayload = filas.map((f) => {
        const c = parseNumeroLocal(f.cantidad_real);
        const p = parseNumeroLocal(f.precio_real);
        const bruto = c * p;
        const descLinea = f.descuento_porcentaje > 0 ? bruto * (f.descuento_porcentaje / 100) : 0;
        return {
          producto_id: f.producto_id || null,
          cantidad: c,
          precio_unitario: p,
          descuento: descLinea,
          descuento_porcentaje: f.descuento_porcentaje,
          subtotal: bruto - descLinea,
          producto_temporal_nombre: f.es_temporal ? f.producto_temporal_nombre : null,
          producto_temporal_precio: f.es_temporal ? p : null,
        };
      });

      const { error } = await supabase.rpc('pos_actualizar_pedido_estado', {
        p_venta_id: pedido.id,
        p_nuevo_estado: 'preparado',
        p_detalles: detallesPayload as any,
      } as any);

      if (error) throw error;

      onConfirmado();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo confirmar la preparación');
    } finally {
      setGuardando(false);
    }
  };

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Confirmar preparación
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cliente: <strong>{pedido.clientes?.nombre || pedido.empleados?.nombre || 'Consumidor Final'}</strong>
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh]">
          <div className="border rounded overflow-hidden">
            <div className="grid grid-cols-[minmax(0,3fr)_70px_90px_110px_110px_110px_36px] gap-1 px-2 py-1.5 bg-muted text-[11px] font-semibold uppercase text-muted-foreground">
              <div>Producto</div>
              <div className="text-center">Unidad</div>
              <div className="text-right">Pedido</div>
              <div className="text-right">Cant. real</div>
              <div className="text-right">Precio</div>
              <div className="text-right">Subtotal</div>
              <div></div>
            </div>
            <div className="divide-y">
              {filas.map((f, idx) => {
                const pesable = esPeso(f.unidad_medida);
                const c = parseNumeroLocal(f.cantidad_real);
                const p = parseNumeroLocal(f.precio_real);
                const bruto = c * p;
                const descLinea = f.descuento_porcentaje > 0 ? bruto * (f.descuento_porcentaje / 100) : 0;
                const sub = bruto - descLinea;
                const cambio = pesable
                  ? Math.abs(p - f.precio_pedido) > 0.001
                  : Math.abs(c - f.cantidad_pedida) > 0.001;
                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-[minmax(0,3fr)_70px_90px_110px_110px_110px_36px] gap-1 px-2 py-1.5 items-center text-sm ${
                      cambio ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-1">
                        {pesable && <Scale className="h-3 w-3 text-orange-500 shrink-0" />}
                        <span className="truncate">{f.descripcion}</span>
                      </div>
                      {f.codigo && (
                        <div className="text-[10px] text-muted-foreground font-mono">{f.codigo}</div>
                      )}
                    </div>
                    <div className="text-center">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {f.unidad_medida || 'u'}
                      </Badge>
                    </div>
                    <div className="text-right text-xs text-muted-foreground tabular-nums">
                      {f.cantidad_pedida.toLocaleString('es-AR', { maximumFractionDigits: 3 })}
                    </div>
                    <div>
                      <Input
                        value={f.cantidad_real}
                        onChange={(e) => actualizar(idx, 'cantidad_real', e.target.value)}
                        className="h-8 text-right text-sm tabular-nums"
                        inputMode="decimal"
                      />
                    </div>
                    <div>
                      <Input
                        value={f.precio_real}
                        onChange={(e) => actualizar(idx, 'precio_real', e.target.value)}
                        className={`h-8 text-right text-sm tabular-nums ${pesable ? '' : 'bg-muted/40'}`}
                        inputMode="decimal"
                        disabled={!pesable && !f.es_temporal}
                      />
                    </div>
                    <div className="text-right text-sm font-medium tabular-nums">
                      ${sub.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        className="h-6 w-6 rounded hover:bg-destructive/10 text-destructive text-lg leading-none"
                        onClick={() => quitarFila(idx)}
                        title="Quitar del pedido"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
              {filas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Sin items</p>
              )}
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <div className="text-right space-y-0.5 text-sm">
              <div className="text-muted-foreground">
                Subtotal: <span className="tabular-nums">${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              {totales.desc > 0 && (
                <div className="text-muted-foreground">
                  Descuentos: <span className="tabular-nums">-${totales.desc.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="text-lg font-bold">
                Total: <span className="tabular-nums">${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={guardando || filas.length === 0}>
            <Check className="h-4 w-4 mr-1" />
            {guardando ? 'Confirmando...' : 'Confirmar preparado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
