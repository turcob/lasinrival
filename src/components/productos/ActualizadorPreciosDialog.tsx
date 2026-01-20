import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface Producto {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  precio_costo: number;
  categoria_id: string | null;
  subcategoria_id: string | null;
  marca_id: string | null;
  tipo_producto_id: string | null;
  marcas?: { nombre: string } | null;
  tipos_producto?: { nombre: string } | null;
  categorias?: { nombre: string } | null;
}

interface Categoria {
  id: string;
  nombre: string;
}

interface Subcategoria {
  id: string;
  nombre: string;
  categoria_id: string;
}

interface Marca {
  id: string;
  nombre: string;
}

interface TipoProducto {
  id: string;
  nombre: string;
}

interface ProductoConNuevoPrecio extends Producto {
  nuevoPrecio: number;
  diferencia: number;
  diferenciaPorcentaje: number;
  selected: boolean;
}

interface ActualizadorPreciosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function ActualizadorPreciosDialog({ 
  open, 
  onOpenChange,
  onUpdate 
}: ActualizadorPreciosDialogProps) {
  const { user } = useAuth();
  
  // Datos base
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [tiposProducto, setTiposProducto] = useState<TipoProducto[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>('');
  const [filtroMarca, setFiltroMarca] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>('');
  
  // Configuración de actualización
  const [tipoActualizacion, setTipoActualizacion] = useState<'aumento' | 'descuento'>('aumento');
  const [porcentaje, setPorcentaje] = useState<number>(0);
  const [redondear, setRedondear] = useState<boolean>(true);
  const [decimalesRedondeo, setDecimalesRedondeo] = useState<number>(2);
  
  // Selección y confirmación
  const [productosPreview, setProductosPreview] = useState<ProductoConNuevoPrecio[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Cargar datos al abrir
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productosRes, categoriasRes, subcategoriasRes, marcasRes, tiposRes] = await Promise.all([
        supabase
          .from('productos')
          .select('id, codigo_articulo, descripcion, precio_costo, categoria_id, subcategoria_id, marca_id, tipo_producto_id, marcas(nombre), tipos_producto(nombre), categorias(nombre)')
          .eq('activo', true)
          .order('descripcion'),
        supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('subcategorias').select('id, nombre, categoria_id').eq('activo', true).order('nombre'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('tipos_producto').select('id, nombre').eq('activo', true).order('nombre'),
      ]);

      if (productosRes.data) setProductos(productosRes.data);
      if (categoriasRes.data) setCategorias(categoriasRes.data);
      if (subcategoriasRes.data) setSubcategorias(subcategoriasRes.data);
      if (marcasRes.data) setMarcas(marcasRes.data);
      if (tiposRes.data) setTiposProducto(tiposRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (filtroCategoria && p.categoria_id !== filtroCategoria) return false;
      if (filtroSubcategoria && p.subcategoria_id !== filtroSubcategoria) return false;
      if (filtroMarca && p.marca_id !== filtroMarca) return false;
      if (filtroTipo && p.tipo_producto_id !== filtroTipo) return false;
      if (filtroBusqueda) {
        const busqueda = filtroBusqueda.toLowerCase();
        if (
          !p.codigo_articulo.toLowerCase().includes(busqueda) &&
          !p.descripcion.toLowerCase().includes(busqueda)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [productos, filtroCategoria, filtroSubcategoria, filtroMarca, filtroTipo, filtroBusqueda]);

  // Subcategorías filtradas por categoría
  const subcategoriasFiltradas = useMemo(() => {
    if (!filtroCategoria) return subcategorias;
    return subcategorias.filter((s) => s.categoria_id === filtroCategoria);
  }, [subcategorias, filtroCategoria]);

  // Calcular preview con nuevos precios
  useEffect(() => {
    if (porcentaje === 0) {
      setProductosPreview(
        productosFiltrados.map((p) => ({
          ...p,
          nuevoPrecio: p.precio_costo,
          diferencia: 0,
          diferenciaPorcentaje: 0,
          selected: selectAll,
        }))
      );
      return;
    }

    const multiplicador = tipoActualizacion === 'aumento' 
      ? 1 + porcentaje / 100 
      : 1 - porcentaje / 100;

    setProductosPreview(
      productosFiltrados.map((p) => {
        let nuevoPrecio = p.precio_costo * multiplicador;
        
        if (redondear) {
          const factor = Math.pow(10, decimalesRedondeo);
          nuevoPrecio = Math.round(nuevoPrecio * factor) / factor;
        }
        
        const diferencia = nuevoPrecio - p.precio_costo;
        const diferenciaPorcentaje = p.precio_costo > 0 
          ? ((nuevoPrecio - p.precio_costo) / p.precio_costo) * 100 
          : 0;

        return {
          ...p,
          nuevoPrecio,
          diferencia,
          diferenciaPorcentaje,
          selected: selectAll,
        };
      })
    );
  }, [productosFiltrados, porcentaje, tipoActualizacion, redondear, decimalesRedondeo, selectAll]);

  // Toggle selección individual
  const toggleProductoSeleccion = (id: string) => {
    setProductosPreview((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  // Toggle seleccionar todos
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setProductosPreview((prev) =>
      prev.map((p) => ({ ...p, selected: checked }))
    );
  };

  // Productos seleccionados
  const productosSeleccionados = productosPreview.filter((p) => p.selected);

  // Aplicar actualización
  const handleAplicarActualizacion = async () => {
    if (productosSeleccionados.length === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }

    setUpdating(true);
    try {
      // Guardar datos anteriores para auditoría
      const datosAnteriores = productosSeleccionados.map((p) => ({
        id: p.id,
        precio_costo: p.precio_costo,
      }));

      // Actualizar productos uno por uno
      const updates = productosSeleccionados.map((p) =>
        supabase
          .from('productos')
          .update({ precio_costo: p.nuevoPrecio })
          .eq('id', p.id)
      );

      await Promise.all(updates);

      // Registrar en auditoría
      await supabase.from('auditoria').insert({
        usuario_id: user?.id,
        modulo: 'productos_precios',
        accion: 'actualizacion_masiva',
        datos_anteriores: { productos: datosAnteriores },
        datos_nuevos: {
          porcentaje: tipoActualizacion === 'aumento' ? porcentaje : -porcentaje,
          total_afectados: productosSeleccionados.length,
          filtros: {
            categoria: filtroCategoria || null,
            subcategoria: filtroSubcategoria || null,
            marca: filtroMarca || null,
            tipo_producto: filtroTipo || null,
            busqueda: filtroBusqueda || null,
          },
        },
      });

      toast.success(`${productosSeleccionados.length} productos actualizados correctamente`);
      setConfirmDialogOpen(false);
      onOpenChange(false);
      onUpdate();
      resetForm();
    } catch (error) {
      console.error('Error updating prices:', error);
      toast.error('Error al actualizar los precios');
    } finally {
      setUpdating(false);
    }
  };

  const resetForm = () => {
    setFiltroCategoria('');
    setFiltroSubcategoria('');
    setFiltroMarca('');
    setFiltroTipo('');
    setFiltroBusqueda('');
    setPorcentaje(0);
    setTipoActualizacion('aumento');
    setRedondear(true);
    setDecimalesRedondeo(2);
    setSelectAll(false);
  };

  // Resumen de cambios
  const resumen = useMemo(() => {
    if (productosSeleccionados.length === 0) return null;
    
    const totalActual = productosSeleccionados.reduce((acc, p) => acc + p.precio_costo, 0);
    const totalNuevo = productosSeleccionados.reduce((acc, p) => acc + p.nuevoPrecio, 0);
    const diferencia = totalNuevo - totalActual;
    
    return {
      cantidad: productosSeleccionados.length,
      promedioActual: totalActual / productosSeleccionados.length,
      promedioNuevo: totalNuevo / productosSeleccionados.length,
      diferencia,
      porcentajeReal: totalActual > 0 ? ((totalNuevo - totalActual) / totalActual) * 100 : 0,
    };
  }, [productosSeleccionados]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      minimumFractionDigits: 2 
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Actualizador de Precios de Costo
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              {/* Filtros */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-xs">Categoría</Label>
                  <Select
                    value={filtroCategoria}
                    onValueChange={(v) => {
                      setFiltroCategoria(v === 'all' ? '' : v);
                      setFiltroSubcategoria('');
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Subcategoría</Label>
                  <Select
                    value={filtroSubcategoria}
                    onValueChange={(v) => setFiltroSubcategoria(v === 'all' ? '' : v)}
                    disabled={!filtroCategoria}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {subcategoriasFiltradas.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Marca</Label>
                  <Select
                    value={filtroMarca}
                    onValueChange={(v) => setFiltroMarca(v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {marcas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Producto</Label>
                  <Select
                    value={filtroTipo}
                    onValueChange={(v) => setFiltroTipo(v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {tiposProducto.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={filtroBusqueda}
                      onChange={(e) => setFiltroBusqueda(e.target.value)}
                      placeholder="Código o descripción..."
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
              </div>

              {/* Configuración de actualización */}
              <div className="flex flex-wrap items-end gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={tipoActualizacion}
                    onValueChange={(v) => setTipoActualizacion(v as 'aumento' | 'descuento')}
                  >
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aumento">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          Aumento
                        </span>
                      </SelectItem>
                      <SelectItem value="descuento">
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-destructive" />
                          Descuento
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Porcentaje (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(Number(e.target.value))}
                    className="w-24 h-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="redondear"
                    checked={redondear}
                    onCheckedChange={(checked) => setRedondear(!!checked)}
                  />
                  <Label htmlFor="redondear" className="text-xs cursor-pointer">Redondear a</Label>
                  <Select
                    value={decimalesRedondeo.toString()}
                    onValueChange={(v) => setDecimalesRedondeo(Number(v))}
                    disabled={!redondear}
                  >
                    <SelectTrigger className="w-20 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Entero</SelectItem>
                      <SelectItem value="1">1 dec</SelectItem>
                      <SelectItem value="2">2 dec</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <Checkbox
                    id="selectAll"
                    checked={selectAll}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                  <Label htmlFor="selectAll" className="text-xs cursor-pointer">
                    Seleccionar todos ({productosFiltrados.length})
                  </Label>
                </div>
              </div>

              {/* Alerta si porcentaje es alto */}
              {porcentaje > 50 && (
                <div className="flex items-center gap-2 p-2 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Atención: El porcentaje de ajuste es superior al 50%</span>
                </div>
              )}

              {/* Tabla de preview */}
              <ScrollArea className="flex-1 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="w-10 p-2 text-left"></th>
                      <th className="p-2 text-left font-medium">Código</th>
                      <th className="p-2 text-left font-medium">Descripción</th>
                      <th className="p-2 text-left font-medium">Marca</th>
                      <th className="p-2 text-right font-medium">Precio Actual</th>
                      <th className="p-2 text-right font-medium">Precio Nuevo</th>
                      <th className="p-2 text-right font-medium">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosPreview.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-muted-foreground">
                          No hay productos que coincidan con los filtros
                        </td>
                      </tr>
                    ) : (
                      productosPreview.slice(0, 100).map((p) => (
                        <tr 
                          key={p.id} 
                          className={`border-b hover:bg-muted/30 ${p.selected ? 'bg-primary/5' : ''}`}
                        >
                          <td className="p-2">
                            <Checkbox
                              checked={p.selected}
                              onCheckedChange={() => toggleProductoSeleccion(p.id)}
                            />
                          </td>
                          <td className="p-2 font-mono text-xs">{p.codigo_articulo}</td>
                          <td className="p-2 max-w-[200px] truncate">{p.descripcion}</td>
                          <td className="p-2 text-muted-foreground">{p.marcas?.nombre || '-'}</td>
                          <td className="p-2 text-right font-mono">
                            {formatCurrency(p.precio_costo)}
                          </td>
                          <td className="p-2 text-right font-mono font-medium">
                            {formatCurrency(p.nuevoPrecio)}
                          </td>
                          <td className={`p-2 text-right font-mono ${
                            p.diferencia > 0 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : p.diferencia < 0 
                                ? 'text-destructive' 
                                : ''
                          }`}>
                            {p.diferencia > 0 ? '+' : ''}{formatCurrency(p.diferencia)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({p.diferenciaPorcentaje > 0 ? '+' : ''}{p.diferenciaPorcentaje.toFixed(1)}%)
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {productosPreview.length > 100 && (
                  <div className="p-2 text-center text-sm text-muted-foreground bg-muted/30">
                    Mostrando 100 de {productosPreview.length} productos
                  </div>
                )}
              </ScrollArea>

              {/* Resumen y acciones */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm text-muted-foreground">
                  {resumen ? (
                    <span>
                      <strong>{resumen.cantidad}</strong> productos seleccionados · 
                      Promedio actual: <strong>{formatCurrency(resumen.promedioActual)}</strong> → 
                      Nuevo: <strong>{formatCurrency(resumen.promedioNuevo)}</strong>
                      <span className={resumen.diferencia >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                        {' '}({resumen.diferencia >= 0 ? '+' : ''}{resumen.porcentajeReal.toFixed(1)}%)
                      </span>
                    </span>
                  ) : (
                    'Selecciona productos para actualizar'
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => setConfirmDialogOpen(true)}
                    disabled={productosSeleccionados.length === 0 || porcentaje === 0}
                  >
                    Aplicar Cambios
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar actualización de precios</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Estás por actualizar <strong>{productosSeleccionados.length}</strong> productos
                  con un {tipoActualizacion === 'aumento' ? 'aumento' : 'descuento'} del <strong>{porcentaje}%</strong>.
                </p>
                {resumen && (
                  <p>
                    Precio promedio: {formatCurrency(resumen.promedioActual)} → {formatCurrency(resumen.promedioNuevo)}
                  </p>
                )}
                <p className="text-amber-600 dark:text-amber-400">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAplicarActualizacion} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
