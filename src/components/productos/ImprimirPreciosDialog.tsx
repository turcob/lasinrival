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
  codigo_barra: string | null;
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
  copias: number;
}

const LAYOUTS: Record<number, { cols: number; rows: number; label: string }> = {
  1: { cols: 1, rows: 1, label: '1 por hoja (gigante)' },
  2: { cols: 1, rows: 2, label: '2 por hoja' },
  4: { cols: 2, rows: 2, label: '4 por hoja' },
  6: { cols: 2, rows: 3, label: '6 por hoja' },
  8: { cols: 2, rows: 4, label: '8 por hoja' },
  9: { cols: 3, rows: 3, label: '9 por hoja' },
};

// Área imprimible A4 con márgenes de 8mm y gap de 3mm
const AREA_W = 210 - 16;
const AREA_H = 297 - 16 - 1;
const GAP_MM = 3;

function tamanoEtiqueta(cols: number, rows: number) {
  const w = (AREA_W - GAP_MM * (cols - 1)) / cols;
  const h = (AREA_H - GAP_MM * (rows - 1)) / rows;
  return `${Math.round(w)} × ${Math.round(h)} mm`;
}

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
          .select('id, codigo_articulo, codigo_barra, descripcion, precio_costo, marca_id, tipo_producto_id, unidad_medida')
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
            p.codigo_barra?.toLowerCase().includes(q) ||
            p.descripcion?.toLowerCase().includes(q),
        )
      : productos;
    if (q) {
      const exactos = base.filter(p => p.codigo_barra?.toLowerCase() === q);
      if (exactos.length) {
        const restantes = base.filter(p => p.codigo_barra?.toLowerCase() !== q);
        return [...exactos, ...restantes].slice(0, 200);
      }
    }
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
          copias: 1,
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

  const totalEtiquetas = useMemo(
    () => seleccionados.reduce((acc, c) => acc + Math.max(1, Math.floor(Number(c.copias) || 1)), 0),
    [seleccionados],
  );

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

    // Área imprimible A4 con márgenes de 8mm
    const PAGE_W = 210 - 16;
    const PAGE_H = 297 - 16 - 1; // 1mm de holgura para evitar salto de página
    const GAP = 3;
    const PAD = 4;
    const cellW = (PAGE_W - GAP * (layout.cols - 1)) / layout.cols;
    const cellH = (PAGE_H - GAP * (layout.rows - 1)) / layout.rows;
    const innerW = cellW - PAD * 2 - 2; // menos bordes
    const innerH = cellH - PAD * 2 - 2;

    const logoMm = Math.min(innerH * 0.18, 22);
    const nombreBaseMm = Math.max(3, Math.min(innerH * 0.09, 12));

    const cells = seleccionados
      .flatMap(c => {
        const enteroTxt = formatMiles(c.precioEntero);
        const decTxt = (c.precioDecimal || '').slice(0, 2);
        // Ancho aproximado en "em" del bloque de precio (Arial bold ≈ 0.62em por dígito)
        const emWidth =
          0.62 * enteroTxt.length + 0.45 * 0.62 + 0.12 + (decTxt ? 0.42 * 0.62 * decTxt.length + 0.08 : 0);
        const byWidth = (innerW * 0.96) / emWidth;
        const byHeight = innerH * 0.42;
        const enteroMm = Math.max(4, Math.min(byWidth, byHeight));
        // El nombre se achica y usa hasta 3 renglones para entrar completo
        const nombre = c.nombre || '';
        const LINEAS = 3;
        // caracteres que entran por renglón a tamaño base (Arial bold ≈ 0.55em por caracter)
        const capBase = (innerW / (nombreBaseMm * 0.55)) * LINEAS;
        const factor = nombre.length > capBase ? Math.sqrt(capBase / nombre.length) : 1;
        const nombreMm = Math.max(2.2, nombreBaseMm * factor);
        const html = `
      <div class="cartel">
        <div class="logo"><img src="/logo-empresa.jpg" alt="Logo" /></div>
        <div class="nombre" style="font-size:${nombreMm.toFixed(2)}mm">${escapeHtml(nombre)}</div>
        <div class="precio-row" style="font-size:${enteroMm.toFixed(2)}mm">
          <span class="signo">$</span><span class="entero">${escapeHtml(enteroTxt)}</span>${
            decTxt ? `<span class="decimal">${escapeHtml(decTxt)}</span>` : ''
          }
        </div>
        ${c.unidad ? `<div class="unidad" style="font-size:${(nombreMm * 0.8).toFixed(2)}mm">${escapeHtml(c.unidad)}</div>` : '<div class="unidad"></div>'}
      </div>`;
        const copias = Math.max(1, Math.min(100, Math.floor(Number(c.copias) || 1)));
        return Array.from({ length: copias }, () => html);
      });

    const pagesHtml: string[] = [];
    for (let i = 0; i < cells.length; i += porHoja) {
      const pageCells = cells.slice(i, i + porHoja);
      // Filas realmente usadas en esta hoja (la última puede estar incompleta)
      const rowsUsadas = Math.max(1, Math.ceil(pageCells.length / layout.cols));
      pagesHtml.push(
        `<div class="sheet" style="grid-template-rows: repeat(${rowsUsadas}, ${cellH.toFixed(2)}mm)">${pageCells.join('')}</div>`
      );
    }

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Carteles de Precios</title>
      <style>
        @page { size: A4; margin: 8mm; }
        * { box-sizing: border-box; }
        html, body { margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; }
        body { display:flex; flex-direction:column; align-items:center; }
        .sheet {
          width: ${PAGE_W}mm;
          height: ${PAGE_H.toFixed(2)}mm;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(${layout.cols}, ${cellW.toFixed(2)}mm);
          grid-template-rows: repeat(${layout.rows}, ${cellH.toFixed(2)}mm);
          gap: ${GAP}mm;
          align-content: center;
          justify-content: center;
          justify-items: center;
          overflow: hidden;
          page-break-after: always;
          break-after: page;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .sheet:last-child { page-break-after: auto; break-after: auto; }
        .cartel {
          border: 1mm solid #4ade80;
          padding: ${PAD}mm;
          display:flex; flex-direction:column; justify-content:space-between; align-items:center;
          text-align:center; overflow:hidden;
          page-break-inside:avoid; break-inside:avoid;
        }
        .logo { width:100%; height:${logoMm.toFixed(2)}mm; display:flex; align-items:center; justify-content:center; }
        .logo img { max-height:100%; max-width: 70%; object-fit:contain; }
        .nombre {
          font-weight: 800; line-height:1.12;
          width:100%; overflow:hidden; word-break:break-word;
          display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;
        }
        .precio-row { display:flex; align-items:flex-start; justify-content:center; line-height:1; width:100%; }
        .signo { font-weight:900; font-size:0.45em; margin-right:0.06em; margin-top:0.12em; }
        .entero { font-weight:900; font-size:1em; letter-spacing:-0.02em; line-height:1; }
        .decimal { font-weight:900; font-size:0.42em; margin-left:0.04em; margin-top:0.08em; line-height:1; }
        .unidad { font-weight:700; font-size:${(nombreBaseMm * 0.8).toFixed(2)}mm; min-height:${(nombreBaseMm * 0.9).toFixed(2)}mm; }
      </style></head><body>
      ${pagesHtml.join('')}
      <script>window.onload=()=>{setTimeout(()=>{window.focus();window.print();},400);}<\/script>
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
                        <SelectItem key={k} value={k}>
                          {v.label} · {tamanoEtiqueta(v.cols, v.rows)}
                        </SelectItem>
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
              <div className="text-sm font-medium">
                Carteles ({seleccionados.length})
                {totalEtiquetas !== seleccionados.length && ` · ${totalEtiquetas} etiquetas`}
              </div>
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
                      <div className="grid grid-cols-4 gap-2">
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
                        <div>
                          <Label className="text-xs">Copias</Label>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={c.copias}
                            onChange={e => {
                              const n = Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1)));
                              updateCartel(c.id, { copias: n });
                            }}
                          />
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

function formatMiles(s: string) {
  const neg = s.startsWith('-');
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return s;
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? '-' + withSep : withSep;
}