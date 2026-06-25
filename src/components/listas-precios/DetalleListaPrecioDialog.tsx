import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  obtenerPrecioVentaProducto,
  type PorcentajeMatriz,
  type ExcepcionProducto,
} from '@/lib/precioUtils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listaId: string | null;
  listaNombre: string;
}

interface ProductoRow {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  precio_costo: number;
  marca_id: string | null;
  tipo_producto_id: string | null;
  marca_nombre?: string;
  tipo_nombre?: string;
}

export function DetalleListaPrecioDialog({ open, onOpenChange, listaId, listaNombre }: Props) {
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState<ProductoRow[]>([]);
  const [porcentajes, setPorcentajes] = useState<PorcentajeMatriz[]>([]);
  const [excepciones, setExcepciones] = useState<ExcepcionProducto[]>([]);
  const [marcasMap, setMarcasMap] = useState<Record<string, string>>({});
  const [tiposMap, setTiposMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || !listaId) return;
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listaId]);

  const fetchAll = async () => {
    if (!listaId) return;
    setLoading(true);
    try {
      // Paginación para todos los productos activos
      const todos: ProductoRow[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('productos')
          .select('id, codigo_articulo, descripcion, precio_costo, marca_id, tipo_producto_id')
          .eq('activo', true)
          .order('descripcion')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const chunk = (data || []) as ProductoRow[];
        todos.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      const [porcRes, excRes, marcasRes, tiposRes] = await Promise.all([
        supabase.from('lista_precio_porcentajes').select('*'),
        supabase.from('lista_precio_excepciones').select('*'),
        supabase.from('marcas').select('id, nombre'),
        supabase.from('tipos_producto').select('id, nombre'),
      ]);

      setPorcentajes((porcRes.data || []) as PorcentajeMatriz[]);
      setExcepciones((excRes.data || []) as ExcepcionProducto[]);
      const mMap: Record<string, string> = {};
      (marcasRes.data || []).forEach((m: any) => { mMap[m.id] = m.nombre; });
      const tMap: Record<string, string> = {};
      (tiposRes.data || []).forEach((t: any) => { tMap[t.id] = t.nombre; });
      setMarcasMap(mMap);
      setTiposMap(tMap);
      setProductos(todos);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar el detalle');
    } finally {
      setLoading(false);
    }
  };

  const filas = useMemo(() => {
    if (!listaId) return [];
    return productos.map(p => {
      const r = obtenerPrecioVentaProducto(
        { id: p.id, precio_costo: Number(p.precio_costo) || 0, marca_id: p.marca_id, tipo_producto_id: p.tipo_producto_id },
        listaId,
        porcentajes,
        excepciones,
      );
      return {
        ...p,
        marca_nombre: p.marca_id ? marcasMap[p.marca_id] || '' : '',
        tipo_nombre: p.tipo_producto_id ? tiposMap[p.tipo_producto_id] || '' : '',
        porcentaje: r.porcentaje,
        origen: r.descripcion,
        precio_venta: r.precioVenta,
      };
    });
  }, [productos, porcentajes, excepciones, listaId, marcasMap, tiposMap]);

  const filtradas = useMemo(() => {
    if (!search.trim()) return filas;
    const q = search.toLowerCase();
    return filas.filter(f =>
      f.codigo_articulo?.toLowerCase().includes(q) ||
      f.descripcion?.toLowerCase().includes(q) ||
      f.marca_nombre?.toLowerCase().includes(q)
    );
  }, [filas, search]);

  const exportExcel = () => {
    const data = filas.map(f => ({
      'Código': f.codigo_articulo,
      'Descripción': f.descripcion,
      'Marca': f.marca_nombre,
      'Tipo': f.tipo_nombre,
      'Costo': Number(f.precio_costo) || 0,
      '% Aplicado': f.porcentaje,
      'Origen %': f.origen,
      'Precio Venta': Number(f.precio_venta.toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, listaNombre.slice(0, 28) || 'Lista');
    const safeName = listaNombre.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Lista';
    XLSX.writeFile(wb, `Lista_Precios_${safeName}.xlsx`);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalle de Lista: {listaNombre}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, descripción o marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={exportExcel} disabled={loading || filas.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        <div className="text-sm text-muted-foreground mb-2">
          {loading ? 'Cargando...' : `${filtradas.length} de ${filas.length} productos`}
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          {loading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-center">% / Origen</TableHead>
                  <TableHead className="text-right">Precio Venta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.codigo_articulo}</TableCell>
                    <TableCell>{f.descripcion}</TableCell>
                    <TableCell>{f.marca_nombre}</TableCell>
                    <TableCell>{f.tipo_nombre}</TableCell>
                    <TableCell className="text-right">{fmt(Number(f.precio_costo) || 0)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span>{f.porcentaje}%</span>
                        <Badge variant="outline" className="text-xs">{f.origen}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(f.precio_venta)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}