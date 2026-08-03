import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { ListaPrecio } from '@/lib/precioUtils';

export interface ProductoSeleccionado {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  precio_costo: number;
  precioActual?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: ProductoSeleccionado[];
  listas: ListaPrecio[];
  listaIdInicial: string;
  onSaved: () => void;
}

const fmt = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FijarPrecioVentaDialog({
  open,
  onOpenChange,
  productos,
  listas,
  listaIdInicial,
  onSaved,
}: Props) {
  const [listaId, setListaId] = useState(listaIdInicial || 'todas');
  const [modo, setModo] = useState<'fijo' | 'porcentaje'>('fijo');
  const [valorGlobal, setValorGlobal] = useState('');
  const [preciosPorProducto, setPreciosPorProducto] = useState<Record<string, string>>({});
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setListaId(listaIdInicial || 'todas');
      setModo('fijo');
      setValorGlobal('');
      setPreciosPorProducto({});
      setDescripcion('');
      setFechaInicio('');
      setFechaFin('');
    }
  }, [open, listaIdInicial]);

  const valorGlobalNum = parseFloat(valorGlobal.replace(',', '.'));

  const filas = useMemo(
    () =>
      productos.map((p) => {
        const individual = preciosPorProducto[p.id];
        const individualNum = individual ? parseFloat(individual.replace(',', '.')) : NaN;
        const base = !isNaN(individualNum)
          ? individualNum
          : !isNaN(valorGlobalNum)
            ? valorGlobalNum
            : NaN;
        const nuevo =
          isNaN(base)
            ? null
            : modo === 'fijo'
              ? base
              : (p.precio_costo || 0) * (1 + base / 100);
        return { ...p, valorInput: individual ?? '', nuevo };
      }),
    [productos, preciosPorProducto, valorGlobalNum, modo],
  );

  const validos = filas.filter((f) => f.nuevo !== null && f.nuevo >= 0);

  const handleGuardar = async () => {
    if (validos.length === 0) {
      toast.error('Ingresá un valor para al menos un producto');
      return;
    }

    setSaving(true);
    try {
      const listasDestino = listaId === 'todas' ? listas.map((l) => l.id) : [listaId];

      const rows = listasDestino.flatMap((lid) =>
        validos.map((f) => {
          const base = f.valorInput
            ? parseFloat(f.valorInput.replace(',', '.'))
            : valorGlobalNum;
          return {
            lista_precio_id: lid,
            producto_id: f.id,
            porcentaje: modo === 'porcentaje' ? base : null,
            precio_fijo: modo === 'fijo' ? base : null,
            descripcion: descripcion || (modo === 'fijo' ? 'Precio fijo' : 'Margen manual'),
            fecha_inicio: fechaInicio || null,
            fecha_fin: fechaFin || null,
          };
        }),
      );

      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await supabase
          .from('lista_precio_excepciones')
          .upsert(rows.slice(i, i + chunkSize), {
            onConflict: 'lista_precio_id,producto_id',
          });
        if (error) throw error;
      }

      toast.success(
        `Precio aplicado a ${validos.length} producto(s)${
          listaId === 'todas' ? ' en todas las listas' : ''
        }`,
      );
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error('Error guardando precios', error);
      toast.error('No se pudo guardar el precio de venta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fijar precio de venta</DialogTitle>
          <DialogDescription>
            Se crea una excepción por producto, que tiene prioridad sobre los márgenes por marca,
            tipo o generales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Lista de precios</Label>
              <Select value={listaId} onValueChange={setListaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {listas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                  <SelectItem value="todas">Todas las listas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modo</Label>
              <Tabs value={modo} onValueChange={(v) => setModo(v as 'fijo' | 'porcentaje')}>
                <TabsList className="w-full">
                  <TabsTrigger className="flex-1" value="fijo">
                    Precio fijo ($)
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="porcentaje">
                    Porcentaje (%)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{modo === 'fijo' ? 'Precio para todos' : 'Margen para todos (%)'}</Label>
              <Input
                inputMode="decimal"
                value={valorGlobal}
                onChange={(e) => setValorGlobal(e.target.value)}
                placeholder={modo === 'fijo' ? 'Ej: 6840' : 'Ej: 35'}
              />
            </div>
            <div className="space-y-2">
              <Label>Vigencia desde (opcional)</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vigencia hasta (opcional)</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Promo agosto"
            />
          </div>

          <ScrollArea className="h-64 rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="p-2 text-left">Producto</th>
                  <th className="p-2 text-right">Costo</th>
                  <th className="p-2 text-right">Precio actual</th>
                  <th className="p-2 text-right w-32">
                    {modo === 'fijo' ? 'Precio nuevo' : 'Margen %'}
                  </th>
                  <th className="p-2 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{f.descripcion}</div>
                      <div className="text-xs text-muted-foreground">{f.codigo_articulo}</div>
                    </td>
                    <td className="p-2 text-right">{fmt(f.precio_costo || 0)}</td>
                    <td className="p-2 text-right text-muted-foreground">
                      {f.precioActual ? fmt(f.precioActual) : '-'}
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        className="h-8 text-right"
                        inputMode="decimal"
                        value={f.valorInput}
                        placeholder={valorGlobal || '—'}
                        onChange={(e) =>
                          setPreciosPorProducto((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="p-2 text-right font-medium">
                      {f.nuevo !== null ? fmt(f.nuevo) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving || validos.length === 0}>
            {saving ? 'Guardando...' : `Aplicar a ${validos.length} producto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}