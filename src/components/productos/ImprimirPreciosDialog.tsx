import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  obtenerPrecioVentaProducto,
  type PorcentajeMatriz,
  type ExcepcionProducto,
  type ListaPrecio,
} from '@/lib/precioUtils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface ProductoRow {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  precio_costo: number;
  marca_id: string | null;
  tipo_producto_id: string | null;
  unidad_medida: string | null;
}

interface Cartel {
  id: string;
  nombre: string;
  precioEntero: string;
  precioDecimal: string;
  unidad: string;
}

const LAYOUTS: Record<number, { cols: number; rows: number; label: string }> = {
  1: { cols: 1, rows: 1, label: '1 por hoja (gigante)' },
  2: { cols: 1, rows: 2, label: '2 por hoja' },
  4: { cols: 2, rows: 2, label: '4 por hoja' },
  6: { cols: 2, rows: 3, label: '6 por hoja' },
  8: { cols: 2, rows: 4, label: '8 por hoja' },
  9: { cols: 3, rows: 3, label: '9 por hoja' },
};

export function ImprimirPreciosDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState<ProductoRow[]>([]);
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [porcentajes, setPorcentajes] = useState<PorcentajeMatriz[]>([]);
  const [excepciones, setExcepciones] = useState<ExcepcionProducto[]>([]);
  const [listaId, setListaId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [seleccionados, setSeleccionados] = useState<Cartel[]>([]);
  const [porHoja, setPorHoja] = useState<number>(4);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void fetchAll();
  }, [open]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const all: ProductoRow[] = [];
      const size = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('productos')
          .select('id, codigo_articulo, descripcion, precio_costo, marca_id, tipo_producto_id, unidad_medida')
          .eq('activo', true)
          .order('descripcion')
          .range(from, from + size - 1);
        if (error) throw error;
        const chunk = (data || []) as ProductoRow[];
        all.push(...chunk);
        if (chunk.length < size) break;
        from += size;
      }

      const [listasRes, porcRes, excRes] = await Promise.all([
        supabase.from('listas_precios').select('*').eq('activo', true).order('orden'),
        supabase.from('lista_precio_porcentajes').select('*'),
        supabase.from('lista_precio_excepciones').select('*'),
      ]);
      const ls = (listasRes.data || []) as ListaPrecio[];
      setListas(ls);
      setPorcentajes((porcRes.data || []) as PorcentajeMatriz[]);
      setExcepciones((excRes.data || []) as ExcepcionProducto[]);
      setProductos(all);
      if (ls.length && !listaId) setListaId(ls[0].id);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? productos.filter(
          p =>
            p.codigo_articulo?.toLowerCase().includes(q) ||
            p.descripcion?.toLowerCase().includes(q),
        )
      : productos;
    return base.slice(0, 200);
  }, [productos, search]);

  const calcPrecio = (p: ProductoRow): number => {
    if (!listaId) return 0;
    const r = obtenerPrecioVentaProducto(
      { id: p.id, precio_costo: Number(p.precio_costo) || 0, marca_id: p.marca_id, tipo_producto_id: p.tipo_producto_id },
      listaId,
      porcentajes,
      excepciones,
    );
    return r.precioVenta;
  };

  const splitPrecio = (v: number) => {
    const entero = Math.trunc(v).toString();
    const dec = Math.round((v - Math.trunc(v)) * 100).toString().padStart(2, '0');
    return { entero, dec };
  };

  const toggleProducto = (p: ProductoRow, checked: boolean) => {
    if (checked) {
      const precio = calcPrecio(p);
      const { entero, dec } = splitPrecio(precio);
      setSeleccionados(prev => [
        ...prev,
        {
          id: p.id + '-' + Date.now(),
          nombre: p.descripcion,
          precioEntero: entero,
          precioDecimal: dec,
          unidad: p.unidad_medida === 'KG' ? 'x 1 KG' : '',
        },
      ]);
    } else {
      setSeleccionados(prev => prev.filter(c => !c.id.startsWith(p.id + '-')));
    }
  };

  const isSelected = (id: string) => seleccionados.some(c => c.id.startsWith(id + '-'));

  const updateCartel = (id: string, patch: Partial<Cartel>) => {
    setSeleccionados(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCartel = (id: string) => {
    setSeleccionados(prev => prev.filter(c => c.id !== id));
  };

  const recalcular = () => {
    setSeleccionados(prev =>
      prev.map(c => {
        const baseId = c.id.split('-')[0];
        const p = productos.find(x => x.id === baseId);
        if (!p) return c;
        const { entero, dec } = splitPrecio(calcPrecio(p));
        return { ...c, precioEntero: entero, precioDecimal: dec };
      }),
    );
  };

  useEffect(() => {
    if (seleccionados.length === 0) return;
    recalcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaId]);

  const layout = LAYOUTS[porHoja] || LAYOUTS[4];

  const imprimir = () => {
    if (seleccionados.length === 0) {
      toast.error('No hay carteles para imprimir');
      return;
    }
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
    const cells = seleccionados
      .map(
        c => `
      <div class="cartel">
        <div class="logo"><img src="/logo-empresa.jpg" alt="Logo" /></div>
        <div class="nombre">${escapeHtml(c.nombre)}</div>
        <div class="precio-row">
          <span class="signo">$</span>
          <span class="entero">${escapeHtml(formatMiles(c.precioEntero))}</span><sup class="decimal">${escapeHtml(c.precioDecimal)}</sup>
        </div>
      </div>`,
      )
      .join('');

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Carteles de Precios</title>
      <style>
        @page { size: A4; margin: 8mm; }
        * { box-sizing: border-box; }
        body { margin:0; font-family: Arial, Helvetica, sans-serif; }
        .sheet { display:grid; grid-template-columns: repeat(${layout.cols}, 1fr); grid-auto-rows: ${(277 / layout.rows).toFixed(2)}mm; gap: 3mm; }
        .cartel { border: 3px solid #4ade80; padding: 6mm; display:flex; flex-direction:column; justify-content:space-between; align-items:center; text-align:center; overflow:hidden; page-break-inside:avoid; }
        .logo { width:100%; display:flex; justify-content:center; }
        .logo img { max-height: ${logoH(porHoja)}; max-width: 80%; object-fit:contain; }
        .nombre { font-weight: 800; font-size: ${nombreFs(porHoja)}; line-height:1.1; word-wrap:break-word; }
        .precio-row { display:flex; align-items:flex-start; justify-content:center; line-height:1; margin: 2mm 0; }
        .signo { font-weight:900; font-size: ${signoFs(porHoja)}; margin-right: 4mm; }
        .entero { font-weight:900; font-size: ${enteroFs(porHoja)}; letter-spacing:-2px; line-height:1; }
        .decimal { font-weight:900; font-size: ${decimalFs(porHoja)}; margin-left:3mm; line-height:1; align-self:flex-start; }
        .sheet { page-break-after: always; }
      </style></head><body>
      ${chunkPages(cells, porHoja)}
      <script>window.onload=()=>{setTimeout(()=>{window.focus();window.print();},300);}<\/script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Impresión de Precios</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Selector de productos */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="p-3 border-b space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Lista de precios</Label>
                  <Select value={listaId} onValueChange={setListaId}>
                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {listas.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Label className="text-xs">Carteles por hoja</Label>
                  <Select value={String(porHoja)} onValueChange={v => setPorHoja(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LAYOUTS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                <ul className="divide-y">
                  {filtrados.map(p => {
                    const checked = isSelected(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-2 p-2 hover:bg-muted/40">
                        <Checkbox checked={checked} onCheckedChange={c => toggleProducto(p, !!c)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{p.descripcion}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p.codigo_articulo}</div>
                        </div>
                        <div className="text-sm font-semibold">${calcPrecio(p).toFixed(2)}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Carteles seleccionados (editables) */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-sm font-medium">Carteles ({seleccionados.length})</div>
              <Button size="sm" onClick={imprimir} disabled={seleccionados.length === 0}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {seleccionados.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  Seleccione productos de la izquierda para crear carteles.
                </div>
              ) : (
                <ul className="divide-y">
                  {seleccionados.map(c => (
                    <li key={c.id} className="p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={c.nombre}
                          onChange={e => updateCartel(c.id, { nombre: e.target.value })}
                          className="font-semibold"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeCartel(c.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">$ Entero</Label>
                          <Input value={c.precioEntero} onChange={e => updateCartel(c.id, { precioEntero: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Decimales</Label>
                          <Input value={c.precioDecimal} onChange={e => updateCartel(c.id, { precioDecimal: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Unidad</Label>
                          <Input value={c.unidad} placeholder="x 1 KG" onChange={e => updateCartel(c.id, { unidad: e.target.value })} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>
        <div ref={previewRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function chunkPages(cellsHtml: string, perPage: number) {
  // split cellsHtml by occurrences of <div class="cartel">
  const parts = cellsHtml.split(/(?=<div class="cartel">)/g).filter(Boolean);
  const pages: string[] = [];
  for (let i = 0; i < parts.length; i += perPage) {
    pages.push(`<div class="sheet">${parts.slice(i, i + perPage).join('')}</div>`);
  }
  return pages.join('');
}

function nombreFs(n: number) {
  return ({ 1: '60pt', 2: '40pt', 4: '24pt', 6: '18pt', 8: '14pt', 9: '14pt' } as Record<number, string>)[n] || '20pt';
}
function signoFs(n: number) {
  return ({ 1: '120pt', 2: '90pt', 4: '60pt', 6: '46pt', 8: '36pt', 9: '32pt' } as Record<number, string>)[n] || '50pt';
}
function enteroFs(n: number) {
  return ({ 1: '220pt', 2: '160pt', 4: '110pt', 6: '80pt', 8: '64pt', 9: '56pt' } as Record<number, string>)[n] || '90pt';
}
function decimalFs(n: number) {
  return ({ 1: '90pt', 2: '60pt', 4: '40pt', 6: '32pt', 8: '24pt', 9: '22pt' } as Record<number, string>)[n] || '36pt';
}
function unidadFs(n: number) {
  return ({ 1: '40pt', 2: '28pt', 4: '20pt', 6: '16pt', 8: '12pt', 9: '12pt' } as Record<number, string>)[n] || '16pt';
}
function logoH(n: number) {
  return ({ 1: '60mm', 2: '40mm', 4: '25mm', 6: '20mm', 8: '16mm', 9: '14mm' } as Record<number, string>)[n] || '20mm';
}
function formatMiles(s: string) {
  const neg = s.startsWith('-');
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return s;
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? '-' + withSep : withSep;
}