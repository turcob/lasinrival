import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  obtenerPrecioVentaPorCantidad,
  calcularCoherenciaEmpaque,
  type ListaPrecio,
  type PorcentajeMatriz,
  type ExcepcionProducto,
  type EscalaCantidad,
} from '@/lib/precioUtils';

export interface ProductoEscala {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  precio_costo: number;
  marca_id: string | null;
  tipo_producto_id?: string | null;
  unidades_por_empaque?: number | null;
  empaque_de_producto_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: ProductoEscala[];
  productosTodos: ProductoEscala[];
  listas: ListaPrecio[];
  porcentajes: PorcentajeMatriz[];
  excepciones: ExcepcionProducto[];
  listaIdInicial: string;
  toleranciaPorcentaje?: number;
  onSaved: () => void;
}

interface TramoForm {
  key: string;
  cantidad_desde: string;
  modo: 'precio' | 'porcentaje';
  valor: string;
  descripcion: string;
}

const fmt = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const nuevoTramo = (): TramoForm => ({
  key: crypto.randomUUID(),
  cantidad_desde: '',
  modo: 'precio',
  valor: '',
  descripcion: '',
});

export function EscalasCantidadDialog({
  open,
  onOpenChange,
  productos,
  productosTodos,
  listas,
  porcentajes,
  excepciones,
  listaIdInicial,
  toleranciaPorcentaje = 1,
  onSaved,
}: Props) {
  const [listaId, setListaId] = useState(listaIdInicial || 'todas');
  const [tramos, setTramos] = useState<TramoForm[]>([nuevoTramo()]);
  const [existentes, setExistentes] = useState<EscalaCantidad[]>([]);
  const [saving, setSaving] = useState(false);

  const esIndividual = productos.length === 1;
  const producto = productos[0];

  useEffect(() => {
    if (!open) return;
    setListaId(listaIdInicial || 'todas');
    setTramos([nuevoTramo()]);
  }, [open, listaIdInicial]);

  const cargarExistentes = async () => {
    if (!open || productos.length === 0) return;
    const { data } = await supabase
      .from('lista_precio_escalas')
      .select('*')
      .in('producto_id', productos.map((p) => p.id))
      .order('cantidad_desde');
    setExistentes((data || []) as unknown as EscalaCantidad[]);
  };

  useEffect(() => {
    cargarExistentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productos.map((p) => p.id).join(',')]);

  const listaCalculo = listaId === 'todas' ? listaIdInicial : listaId;

  const precioBase = useMemo(() => {
    if (!esIndividual || !listaCalculo) return 0;
    return obtenerPrecioVentaPorCantidad(
      {
        id: producto.id,
        precio_costo: producto.precio_costo || 0,
        marca_id: producto.marca_id,
        tipo_producto_id: producto.tipo_producto_id ?? null,
      },
      listaCalculo,
      porcentajes,
      excepciones,
      [],
      1,
    ).precioVenta;
  }, [esIndividual, producto, listaCalculo, porcentajes, excepciones]);

  // Coherencia caja vs unidad (solo informativa)
  const coherencia = useMemo(() => {
    if (!esIndividual || !producto?.empaque_de_producto_id || !producto?.unidades_por_empaque) return null;
    const unidad = productosTodos.find((p) => p.id === producto.empaque_de_producto_id);
    if (!unidad || !listaCalculo) return null;
    const escalasUnidad = existentes.filter((e) => e.producto_id === unidad.id);
    const precioUnidadEnTramo = obtenerPrecioVentaPorCantidad(
      {
        id: unidad.id,
        precio_costo: unidad.precio_costo || 0,
        marca_id: unidad.marca_id,
        tipo_producto_id: unidad.tipo_producto_id ?? null,
      },
      listaCalculo,
      porcentajes,
      excepciones,
      escalasUnidad,
      Number(producto.unidades_por_empaque),
    ).precioVenta;
    const r = calcularCoherenciaEmpaque(
      precioBase,
      Number(producto.unidades_por_empaque),
      precioUnidadEnTramo,
      toleranciaPorcentaje,
    );
    return { ...r, unidadDescripcion: unidad.descripcion };
  }, [esIndividual, producto, productosTodos, existentes, listaCalculo, porcentajes, excepciones, precioBase, toleranciaPorcentaje]);

  const eliminarExistente = async (id: string) => {
    const { error } = await supabase.from('lista_precio_escalas').delete().eq('id', id);
    if (error) {
      toast.error('No se pudo eliminar el tramo');
      return;
    }
    toast.success('Tramo eliminado');
    cargarExistentes();
    onSaved();
  };

  const guardar = async () => {
    const validos = tramos.filter((t) => t.cantidad_desde.trim() && t.valor.trim());
    if (validos.length === 0) {
      toast.error('Completá al menos un tramo con cantidad y valor');
      return;
    }
    for (const t of validos) {
      const cant = Number(t.cantidad_desde);
      if (!Number.isInteger(cant) || cant < 2) {
        toast.error('La cantidad desde debe ser un entero mayor o igual a 2');
        return;
      }
      if (Number(t.valor) <= 0) {
        toast.error('El valor del tramo debe ser mayor a 0');
        return;
      }
    }

    setSaving(true);
    try {
      const rows = productos.flatMap((p) =>
        validos.map((t) => ({
          lista_precio_id: listaId === 'todas' ? null : listaId,
          producto_id: p.id,
          cantidad_desde: Number(t.cantidad_desde),
          precio_unitario: t.modo === 'precio' ? Number(t.valor) : null,
          porcentaje: t.modo === 'porcentaje' ? Number(t.valor) : null,
          descripcion: t.descripcion.trim() || null,
        })),
      );

      // Reemplazamos los tramos con la misma clave (lista + producto + cantidad)
      for (const row of rows) {
        let q = supabase
          .from('lista_precio_escalas')
          .delete()
          .eq('producto_id', row.producto_id)
          .eq('cantidad_desde', row.cantidad_desde);
        q = row.lista_precio_id === null
          ? q.is('lista_precio_id', null)
          : q.eq('lista_precio_id', row.lista_precio_id);
        await q;
      }

      const { error } = await supabase.from('lista_precio_escalas').insert(rows);
      if (error) throw error;

      toast.success(`Tramos guardados (${rows.length})`);
      setTramos([nuevoTramo()]);
      await cargarExistentes();
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al guardar los tramos');
    } finally {
      setSaving(false);
    }
  };

  const nombreLista = (id: string | null) =>
    id === null ? 'Todas las listas' : listas.find((l) => l.id === id)?.nombre || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Precios por cantidad</DialogTitle>
          <DialogDescription>
            {esIndividual
              ? `${producto?.codigo_articulo} — ${producto?.descripcion}`
              : `${productos.length} productos seleccionados`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Lista de precios</Label>
              <Select value={listaId} onValueChange={setListaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las listas</SelectItem>
                  {listas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {esIndividual && (
              <div>
                <Label>Precio unitario actual (1 unidad)</Label>
                <div className="h-10 flex items-center font-medium">{fmt(precioBase)}</div>
              </div>
            )}
          </div>

          {coherencia && (
            <div
              className={`rounded-md border p-3 text-sm flex items-start gap-2 ${
                coherencia.ok ? 'border-border' : 'border-destructive'
              }`}
            >
              {coherencia.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
              )}
              <div>
                <div className="font-medium">Comparación con {coherencia.unidadDescripcion}</div>
                <div className="text-muted-foreground">
                  Caja por unidad {fmt(coherencia.precioCajaUnitario)} vs. equivalente por unidad{' '}
                  {fmt(coherencia.precioEquivalenteUnidad)} — {coherencia.mensaje}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Nuevos tramos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTramos((prev) => [...prev, nuevoTramo()])}
              >
                <Plus className="h-4 w-4 mr-1" /> Agregar tramo
              </Button>
            </div>

            {tramos.map((t, idx) => (
              <div key={t.key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  <Label className="text-xs">Desde cantidad</Label>
                  <Input
                    type="number"
                    min={2}
                    value={t.cantidad_desde}
                    onChange={(e) =>
                      setTramos((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, cantidad_desde: e.target.value } : x)),
                      )
                    }
                    placeholder="4"
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={t.modo}
                    onValueChange={(v) =>
                      setTramos((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, modo: v as 'precio' | 'porcentaje' } : x)),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="precio">Precio unitario</SelectItem>
                      <SelectItem value="porcentaje">% sobre costo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={t.valor}
                    onChange={(e) =>
                      setTramos((prev) => prev.map((x, i) => (i === idx ? { ...x, valor: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Descripción</Label>
                  <Input
                    value={t.descripcion}
                    onChange={(e) =>
                      setTramos((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, descripcion: e.target.value } : x)),
                      )
                    }
                    placeholder="Opcional"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setTramos((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={tramos.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {existentes.length > 0 && (
            <div className="space-y-2">
              <Label>Tramos vigentes</Label>
              <ScrollArea className="max-h-48 rounded-md border">
                <div className="divide-y">
                  {existentes.map((e) => {
                    const prod = productos.find((p) => p.id === e.producto_id);
                    return (
                      <div key={e.id} className="flex items-center justify-between p-2 text-sm">
                        <div>
                          <div className="font-medium">
                            Desde {e.cantidad_desde} u.{' '}
                            {e.precio_unitario !== null
                              ? fmt(Number(e.precio_unitario))
                              : `${e.porcentaje}% sobre costo`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {!esIndividual && prod ? `${prod.codigo_articulo} · ` : ''}
                            <Badge variant="secondary" className="mr-1">
                              {nombreLista(e.lista_precio_id)}
                            </Badge>
                            {e.descripcion || ''}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => eliminarExistente(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar tramos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
