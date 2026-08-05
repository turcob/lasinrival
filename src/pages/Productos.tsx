import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, RotateCcw, TrendingUp, Snowflake, Download, Printer, Barcode, Layers, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { ExcelImporter } from '@/components/shared/ExcelImporter';
import { ExcelImporterDesactivados } from '@/components/shared/ExcelImporterDesactivados';
import { ActualizadorPreciosDialog } from '@/components/productos/ActualizadorPreciosDialog';
import { ImportarFriosDialog } from '@/components/productos/ImportarFriosDialog';
import { ImprimirPreciosDialog } from '@/components/productos/ImprimirPreciosDialog';
import { CargaCodigosBarraDialog } from '@/components/productos/CargaCodigosBarraDialog';
import { FijarPrecioVentaDialog } from '@/components/productos/FijarPrecioVentaDialog';
import { EscalasCantidadDialog } from '@/components/productos/EscalasCantidadDialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  obtenerPrecioVentaProducto,
  escalasVigentes,
  obtenerPrecioVentaPorCantidad,
  calcularCoherenciaEmpaque,
  type ListaPrecio,
  type PorcentajeMatriz,
  type ExcepcionProducto,
  type EscalaCantidad,
} from '@/lib/precioUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface Producto {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  unidad_medida: string;
  categoria_id: string | null;
  subcategoria_id: string | null;
  marca_id: string | null;
  tipo_producto_id?: string | null;
  codigo_barra: string | null;
  activo: boolean;
  stock_actual: number;
  stock_minimo: number;
  precio_costo: number;
  desactivado_por: string | null;
  fecha_desactivacion: string | null;
  unidades_por_empaque?: number | null;
  empaque_de_producto_id?: string | null;
  categorias?: { nombre: string } | null;
  subcategorias?: { nombre: string } | null;
  marcas?: { nombre: string } | null;
  desactivado_por_profile?: { nombre: string; email: string } | null;
}

interface Categoria {
  id: string;
  nombre: string;
}

interface Subcategoria {
  id: string;
  nombre: string;
  categoria_id: string;
  codigo_grupo?: string | null;
}

interface Marca {
  id: string;
  nombre: string;
}

export default function Productos() {
  const { user, hasRole } = useAuth();
  const isVendedor = hasRole('vendedor') && !hasRole('admin') && !hasRole('encargado');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actualizadorOpen, setActualizadorOpen] = useState(false);
  const [importarFriosOpen, setImportarFriosOpen] = useState(false);
  const [imprimirPreciosOpen, setImprimirPreciosOpen] = useState(false);
  const [cargaCodBarraOpen, setCargaCodBarraOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [activeTab, setActiveTab] = useState('activos');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [subcategoriaFilter, setSubcategoriaFilter] = useState('');
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [porcentajes, setPorcentajes] = useState<PorcentajeMatriz[]>([]);
  const [excepciones, setExcepciones] = useState<ExcepcionProducto[]>([]);
  const [escalas, setEscalas] = useState<EscalaCantidad[]>([]);
  const [toleranciaEmpaque, setToleranciaEmpaque] = useState<number>(1);
  const [escalasOpen, setEscalasOpen] = useState(false);
  const [escalasProductoId, setEscalasProductoId] = useState<string | null>(null);
  const [listaSeleccionada, setListaSeleccionada] = useState<string>(
    () => localStorage.getItem('productos_lista_precio') || '',
  );
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [fijarPrecioOpen, setFijarPrecioOpen] = useState(false);
  const [codigoSugerido, setCodigoSugerido] = useState<string>('');
  const [codigoManual, setCodigoManual] = useState(false);
  const [sugiriendoCodigo, setSugiriendoCodigo] = useState(false);

  const [formData, setFormData] = useState({
    codigo_articulo: '',
    descripcion: '',
    unidad_medida: 'UN',
    categoria_id: '',
    subcategoria_id: '',
    marca_id: '',
    codigo_barra: '',
    activo: true,
    stock_actual: 0,
    stock_minimo: 0,
    precio_costo: 0,
    empaque_de_producto_id: '',
    unidades_por_empaque: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all products in batches to overcome 1000 row limit
      const fetchAllProductos = async () => {
        let allProductos: any[] = [];
        let from = 0;
        const batchSize = 1000;
        
        while (true) {
          const { data, error } = await supabase
            .from('productos')
            .select('*, categorias(nombre), subcategorias(nombre), marcas(nombre)')
            .order('descripcion')
            .range(from, from + batchSize - 1);
          
          if (error) throw error;
          if (!data || data.length === 0) break;
          
          allProductos = [...allProductos, ...data];
          if (data.length < batchSize) break;
          from += batchSize;
        }
        
        return allProductos;
      };

      const [productosData, categoriasRes, subcategoriasRes, marcasRes] = await Promise.all([
        fetchAllProductos(),
        supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('subcategorias').select('id, nombre, categoria_id, codigo_grupo').eq('activo', true).order('nombre'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
      ]);

      const [listasRes, porcentajesRes, excepcionesRes, escalasRes, configRes] = await Promise.all([
        supabase.from('listas_precios').select('*').eq('activo', true).order('orden'),
        supabase.from('lista_precio_porcentajes').select('*'),
        supabase.from('lista_precio_excepciones').select('*'),
        supabase.from('lista_precio_escalas').select('*').order('cantidad_desde'),
        supabase.from('configuracion_comercio').select('tolerancia_precio_empaque').maybeSingle(),
      ]);

      if (listasRes.data) {
        setListas(listasRes.data as ListaPrecio[]);
        setListaSeleccionada((prev) =>
          prev && listasRes.data.some((l) => l.id === prev) ? prev : (listasRes.data[0]?.id || ''),
        );
      }
      if (porcentajesRes.data) setPorcentajes(porcentajesRes.data as PorcentajeMatriz[]);
      if (excepcionesRes.data) setExcepciones(excepcionesRes.data as ExcepcionProducto[]);
      if (escalasRes.data) setEscalas(escalasRes.data as unknown as EscalaCantidad[]);
      if (configRes.data?.tolerancia_precio_empaque != null) {
        setToleranciaEmpaque(Number(configRes.data.tolerancia_precio_empaque));
      }

      if (productosData && productosData.length > 0) {
        // Obtener IDs únicos de usuarios que desactivaron productos
        const desactivadosPorIds = [...new Set(
          productosData
            .filter(p => p.desactivado_por)
            .map(p => p.desactivado_por)
        )];
        
        // Fetch all profiles in one query
        let profilesMap: Record<string, { nombre: string; email: string }> = {};
        if (desactivadosPorIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, nombre, email')
            .in('id', desactivadosPorIds);
          
          if (profilesData) {
            profilesMap = profilesData.reduce((acc, p) => {
              acc[p.id] = { nombre: p.nombre, email: p.email };
              return acc;
            }, {} as Record<string, { nombre: string; email: string }>);
          }
        }
        
        const productosConUsuarios = productosData.map((producto) => ({
          ...producto,
          desactivado_por_profile: producto.desactivado_por 
            ? profilesMap[producto.desactivado_por] || null 
            : null
        }));
        
        setProductos(productosConUsuarios);
      }
      if (categoriasRes.data) setCategorias(categoriasRes.data);
      if (subcategoriasRes.data) setSubcategorias(subcategoriasRes.data);
      if (marcasRes.data) setMarcas(marcasRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const wasActive = selectedProducto?.activo ?? true;
      const isNowActive = formData.activo;
      
      const data: any = {
        codigo_articulo: formData.codigo_articulo,
        descripcion: formData.descripcion,
        unidad_medida: formData.unidad_medida,
        categoria_id: formData.categoria_id || null,
        subcategoria_id: formData.subcategoria_id || null,
        marca_id: formData.marca_id || null,
        codigo_barra: formData.codigo_barra || null,
        activo: formData.activo,
        stock_actual: formData.stock_actual,
        stock_minimo: formData.stock_minimo,
        precio_costo: formData.precio_costo,
        empaque_de_producto_id: formData.empaque_de_producto_id || null,
        unidades_por_empaque: formData.unidades_por_empaque
          ? Number(formData.unidades_por_empaque)
          : null,
      };

      // Si se está desactivando el producto, registrar quién y cuándo
      if (wasActive && !isNowActive && user) {
        data.desactivado_por = user.id;
        data.fecha_desactivacion = new Date().toISOString();
      }
      
      // Si se está reactivando, limpiar los campos de desactivación
      if (!wasActive && isNowActive) {
        data.desactivado_por = null;
        data.fecha_desactivacion = null;
      }

      if (selectedProducto) {
        const { error } = await supabase
          .from('productos')
          .update(data)
          .eq('id', selectedProducto.id);
        
        if (error) throw error;
        toast.success('Producto actualizado correctamente');
      } else {
        const { error } = await supabase.from('productos').insert([data]);
        if (error) throw error;
        toast.success('Producto creado correctamente');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving producto:', error);
      if (error.code === '23505') {
        toast.error('Ya existe un producto con ese código');
      } else {
        toast.error('Error al guardar el producto');
      }
    }
  };

  const handleReactivar = async (producto: Producto) => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({
          activo: true,
          desactivado_por: null,
          fecha_desactivacion: null,
        })
        .eq('id', producto.id);

      if (error) throw error;
      toast.success('Producto reactivado correctamente');
      fetchData();
    } catch (error) {
      console.error('Error reactivating producto:', error);
      toast.error('Error al reactivar el producto');
    }
  };

  const handleDelete = async () => {
    if (!selectedProducto) return;

    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', selectedProducto.id);

      if (error) throw error;
      toast.success('Producto eliminado correctamente');
      setDeleteDialogOpen(false);
      setSelectedProducto(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting producto:', error);
      toast.error('Error al eliminar el producto');
    }
  };

  const openEditDialog = (producto: Producto) => {
    setSelectedProducto(producto);
    setCodigoSugerido('');
    setCodigoManual(true);
    setFormData({
      codigo_articulo: producto.codigo_articulo,
      descripcion: producto.descripcion,
      unidad_medida: producto.unidad_medida,
      categoria_id: producto.categoria_id || '',
      subcategoria_id: producto.subcategoria_id || '',
      marca_id: producto.marca_id || '',
      codigo_barra: producto.codigo_barra || '',
      activo: producto.activo,
      stock_actual: producto.stock_actual,
      stock_minimo: producto.stock_minimo,
      precio_costo: producto.precio_costo || 0,
      empaque_de_producto_id: producto.empaque_de_producto_id || '',
      unidades_por_empaque:
        producto.unidades_por_empaque != null ? String(producto.unidades_por_empaque) : '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedProducto(null);
    setCodigoSugerido('');
    setCodigoManual(false);
    setFormData({
      codigo_articulo: '',
      descripcion: '',
      unidad_medida: 'UN',
      categoria_id: '',
      subcategoria_id: '',
      marca_id: '',
      codigo_barra: '',
      activo: true,
      stock_actual: 0,
      stock_minimo: 0,
      precio_costo: 0,
      empaque_de_producto_id: '',
      unidades_por_empaque: '',
    });
  };
  
  const exportarExcel = () => {
    if (productos.length === 0) {
      toast.error('No hay productos para exportar');
      return;
    }

    const data = productos.map(p => ({
      'Código': p.codigo_articulo,
      'Descripción': p.descripcion,
      'Unidad de Medida': p.unidad_medida,
      'Categoría': p.categorias?.nombre || '-',
      'Subcategoría': p.subcategorias?.nombre || '-',
      'Marca': p.marcas?.nombre || '-',
      'Precio de Costo': p.precio_costo || 0,
      'Stock Actual': p.stock_actual || 0,
      'Stock Mínimo': p.stock_minimo || 0,
      'Activo': p.activo ? 'Sí' : 'No',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'Productos_y_Costos.xlsx');
    toast.success('Archivo exportado correctamente');
  };

  const filteredSubcategorias = subcategorias.filter(
    (sub) => !formData.categoria_id || sub.categoria_id === formData.categoria_id
  );

  // Sugerencia de código: código de grupo de la subcategoría + 3 dígitos secuenciales
  const calcularSugerencia = async (subcategoriaId: string): Promise<string> => {
    const sub = subcategorias.find((s) => s.id === subcategoriaId);
    const grupo = (sub?.codigo_grupo || '').trim();
    if (!grupo) return '';

    const { data, error } = await supabase
      .from('productos')
      .select('codigo_articulo')
      .like('codigo_articulo', `${grupo}%`);

    if (error) return '';

    const existentes = new Set((data || []).map((p) => (p.codigo_articulo || '').trim()));
    let maxSeq = 0;
    existentes.forEach((cod) => {
      const sufijo = cod.slice(grupo.length);
      if (/^\d+$/.test(sufijo)) {
        const n = parseInt(sufijo, 10);
        if (n > maxSeq) maxSeq = n;
      }
    });

    let next = maxSeq + 1;
    let candidato = `${grupo}${String(next).padStart(3, '0')}`;
    while (existentes.has(candidato) && next < 100000) {
      next += 1;
      candidato = `${grupo}${String(next).padStart(3, '0')}`;
    }
    return candidato;
  };

  const handleSubcategoriaChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, subcategoria_id: value }));
    if (selectedProducto) return;

    setSugiriendoCodigo(true);
    const sugerido = await calcularSugerencia(value);
    setSugiriendoCodigo(false);
    setCodigoSugerido(sugerido);
    if (sugerido && !codigoManual) {
      setFormData((prev) => ({ ...prev, subcategoria_id: value, codigo_articulo: sugerido }));
    }
  };

  const filteredSubcategoriasForFilter = subcategorias.filter(
    (sub) => !categoriaFilter || categoriaFilter === 'all' || sub.categoria_id === categoriaFilter
  );

  const productosFiltrados = productos.filter((p) => {
    if (categoriaFilter && categoriaFilter !== 'all' && p.categoria_id !== categoriaFilter) return false;
    if (subcategoriaFilter && subcategoriaFilter !== 'all' && p.subcategoria_id !== subcategoriaFilter) return false;
    return true;
  });

  const productosActivos = productosFiltrados.filter((p) => p.activo);
  const productosDesactivados = productosFiltrados.filter((p) => !p.activo);

  useEffect(() => {
    if (listaSeleccionada) localStorage.setItem('productos_lista_precio', listaSeleccionada);
  }, [listaSeleccionada]);

  const preciosVenta = useMemo(() => {
    if (!listaSeleccionada) return {} as Record<string, { precio: number; origen: string }>;
    const map: Record<string, { precio: number; origen: string }> = {};
    productos.forEach((p) => {
      const r = obtenerPrecioVentaProducto(
        {
          id: p.id,
          precio_costo: p.precio_costo || 0,
          marca_id: p.marca_id,
          tipo_producto_id: p.tipo_producto_id ?? null,
        },
        listaSeleccionada,
        porcentajes,
        excepciones,
      );
      map[p.id] = { precio: r.precioVenta, origen: r.origen };
    });
    return map;
  }, [productos, listaSeleccionada, porcentajes, excepciones]);

  const origenLabel: Record<string, string> = {
    fijo: 'Precio fijo',
    excepcion: 'Excepción',
    marca: 'Por marca',
    tipo: 'Por tipo',
    general: 'General',
    ninguno: 'Sin precio',
  };

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const todosVisiblesSeleccionados =
    productosActivos.length > 0 && productosActivos.every((p) => seleccionados.has(p.id));

  const toggleTodosVisibles = () => {
    setSeleccionados(
      todosVisiblesSeleccionados ? new Set() : new Set(productosActivos.map((p) => p.id)),
    );
  };

  const productosSeleccionados = productos
    .filter((p) => seleccionados.has(p.id))
    .map((p) => ({
      id: p.id,
      codigo_articulo: p.codigo_articulo,
      descripcion: p.descripcion,
      precio_costo: p.precio_costo || 0,
      precioActual: preciosVenta[p.id]?.precio ?? null,
    }));

  const columnaSeleccion = {
    key: 'seleccion',
    header: (
      <Checkbox
        checked={todosVisiblesSeleccionados}
        onCheckedChange={toggleTodosVisibles}
        aria-label="Seleccionar todos"
      />
    ) as unknown as string,
    render: (item: Producto) => (
      <Checkbox
        checked={seleccionados.has(item.id)}
        onCheckedChange={() => toggleSeleccion(item.id)}
        aria-label={`Seleccionar ${item.descripcion}`}
      />
    ),
  };

  const columnaPrecioVenta = {
    key: 'precio_venta',
    header: 'Precio venta',
    render: (item: Producto) => {
      const info = preciosVenta[item.id];
      if (!info || info.origen === 'ninguno') {
        return <span className="text-muted-foreground text-xs">Sin precio</span>;
      }
      return (
        <div className="leading-tight">
          <span className="font-medium">
            ${info.precio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="text-[10px] text-muted-foreground">{origenLabel[info.origen]}</div>
        </div>
      );
    },
  };


  const columnsActivosFull = [
    columnaSeleccion,
    { key: 'codigo_articulo', header: 'Código' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'unidad_medida', header: 'Unidad' },
    {
      key: 'categorias.nombre',
      header: 'Categoría',
      render: (item: Producto) => item.categorias?.nombre || '-',
    },
    {
      key: 'subcategorias.nombre',
      header: 'Subcategoría',
      render: (item: Producto) => item.subcategorias?.nombre || '-',
    },
    {
      key: 'precio_costo',
      header: 'Costo',
      render: (item: Producto) => (
        <span className="font-medium">
          ${item.precio_costo?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}
        </span>
      ),
    },
    columnaPrecioVenta,
    {
      key: 'stock_actual',
      header: 'Stock',
      render: (item: Producto) => (
        <span className={item.stock_actual <= item.stock_minimo ? 'text-destructive font-medium' : ''}>
          {item.stock_actual}
        </span>
      ),
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: Producto) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Producto) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedProducto(item);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const columnsActivosVendedor = [
    { key: 'codigo_articulo', header: 'Código' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'unidad_medida', header: 'Unidad' },
    {
      key: 'categorias.nombre',
      header: 'Categoría',
      render: (item: Producto) => item.categorias?.nombre || '-',
    },
    {
      key: 'subcategorias.nombre',
      header: 'Subcategoría',
      render: (item: Producto) => item.subcategorias?.nombre || '-',
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: Producto) => <StatusBadge status={item.activo} />,
    },
  ];

  const columnsActivos = isVendedor ? columnsActivosVendedor : columnsActivosFull;

  const columnsDesactivados = [
    { key: 'codigo_articulo', header: 'Código' },
    { key: 'descripcion', header: 'Descripción' },
    {
      key: 'categorias.nombre',
      header: 'Categoría',
      render: (item: Producto) => item.categorias?.nombre || '-',
    },
    {
      key: 'precio_costo',
      header: 'Costo',
      render: (item: Producto) => (
        <span className="font-medium">
          ${item.precio_costo?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}
        </span>
      ),
    },
    {
      key: 'desactivado_por',
      header: 'Desactivado por',
      render: (item: Producto) => (
        <div className="text-sm">
          {item.desactivado_por_profile ? (
            <div>
              <span className="font-medium">{item.desactivado_por_profile.nombre}</span>
              <br />
              <span className="text-muted-foreground text-xs">{item.desactivado_por_profile.email}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'fecha_desactivacion',
      header: 'Fecha',
      render: (item: Producto) => (
        <span className="text-sm text-muted-foreground">
          {item.fecha_desactivacion
            ? format(new Date(item.fecha_desactivacion), 'dd/MM/yyyy HH:mm', { locale: es })
            : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Producto) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleReactivar(item)}
            title="Reactivar producto"
          >
            <RotateCcw className="h-4 w-4 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedProducto(item);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title="Productos" description="Gestión del catálogo de productos">
        {!isVendedor && <ExcelImporter />}
        {!isVendedor && <ExcelImporterDesactivados onImportComplete={fetchData} />}
        {!isVendedor && (
          <Button variant="outline" onClick={exportarExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        )}
        <Button variant="outline" onClick={() => setImprimirPreciosOpen(true)}>
          <Printer className="mr-2 h-4 w-4" />
          Impresión de Precios
        </Button>
        {!isVendedor && (
          <Button variant="outline" onClick={() => setCargaCodBarraOpen(true)}>
            <Barcode className="mr-2 h-4 w-4" />
            Cargar códigos de barra
          </Button>
        )}
        {!isVendedor && (
          <Button variant="outline" onClick={() => setImportarFriosOpen(true)}>
            <Snowflake className="mr-2 h-4 w-4" />
            Importar Fríos
          </Button>
        )}
        {!isVendedor && (
          <Button variant="outline" onClick={() => setActualizadorOpen(true)}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Actualizar Precios
          </Button>
        )}
        {!isVendedor && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedProducto ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Select
                    value={formData.categoria_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, categoria_id: value, subcategoria_id: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcategoria">Subcategoría</Label>
                  <Select
                    value={formData.subcategoria_id}
                    onValueChange={handleSubcategoriaChange}
                    disabled={!formData.categoria_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubcategorias.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="codigo_articulo">Código *</Label>
                  <Input
                    id="codigo_articulo"
                    value={formData.codigo_articulo}
                    onChange={(e) => {
                      setCodigoManual(true);
                      setFormData({ ...formData, codigo_articulo: e.target.value });
                    }}
                    required
                  />
                  {!selectedProducto && (
                    <p className="text-xs text-muted-foreground">
                      {sugiriendoCodigo
                        ? 'Calculando código sugerido...'
                        : codigoSugerido
                          ? (
                            <>
                              Sugerido: {codigoSugerido}
                              {formData.codigo_articulo !== codigoSugerido && (
                                <button
                                  type="button"
                                  className="ml-2 underline"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, codigo_articulo: codigoSugerido }));
                                    setCodigoManual(false);
                                  }}
                                >
                                  usar sugerido
                                </button>
                              )}
                            </>
                          )
                          : 'Elegí categoría y subcategoría para sugerir un código.'}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_barra">Código de Barras</Label>
                  <Input
                    id="codigo_barra"
                    value={formData.codigo_barra}
                    onChange={(e) =>
                      setFormData({ ...formData, codigo_barra: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción *</Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="unidad_medida">Unidad de Medida</Label>
                  <Select
                    value={formData.unidad_medida}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unidad_medida: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UN">Unidad</SelectItem>
                      <SelectItem value="KG">Kilogramo</SelectItem>
                      <SelectItem value="LT">Litro</SelectItem>
                      <SelectItem value="MT">Metro</SelectItem>
                      <SelectItem value="CJ">Caja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="marca">Marca</Label>
                <Select
                  value={formData.marca_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, marca_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar marca..." />
                  </SelectTrigger>
                  <SelectContent>
                    {marcas.map((marca) => (
                      <SelectItem key={marca.id} value={marca.id}>
                        {marca.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stock_actual">Stock Actual</Label>
                  <Input
                    id="stock_actual"
                    type="number"
                    value={formData.stock_actual}
                    onChange={(e) =>
                      setFormData({ ...formData, stock_actual: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock_minimo">Stock Mínimo</Label>
                  <Input
                    id="stock_minimo"
                    type="number"
                    value={formData.stock_minimo}
                    onChange={(e) =>
                      setFormData({ ...formData, stock_minimo: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="precio_costo">Precio de Costo</Label>
                <Input
                  id="precio_costo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.precio_costo}
                  onChange={(e) =>
                    setFormData({ ...formData, precio_costo: Number(e.target.value) })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="activo"
                  checked={formData.activo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, activo: checked })
                  }
                />
                <Label htmlFor="activo">Producto activo</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedProducto ? 'Guardar Cambios' : 'Crear Producto'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="activos">
            Activos ({productosActivos.length})
          </TabsTrigger>
          {!isVendedor && (
            <TabsTrigger value="desactivados">
              Desactivados ({productosDesactivados.length})
            </TabsTrigger>
          )}
        </TabsList>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end mb-4">
          <div className="space-y-2 sm:flex-1">
            <Label htmlFor="categoria-filter">Filtrar por Categoría</Label>
            <Select
              value={categoriaFilter}
              onValueChange={(value) => {
                setCategoriaFilter(value);
                setSubcategoriaFilter('all');
              }}
            >
              <SelectTrigger id="categoria-filter">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:flex-1">
            <Label htmlFor="subcategoria-filter">Filtrar por Subcategoría</Label>
            <Select
              value={subcategoriaFilter}
              onValueChange={(value) => setSubcategoriaFilter(value)}
              disabled={!categoriaFilter || categoriaFilter === 'all'}
            >
              <SelectTrigger id="subcategoria-filter">
                <SelectValue placeholder={categoriaFilter && categoriaFilter !== 'all' ? 'Todas las subcategorías' : 'Seleccione una categoría'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las subcategorías</SelectItem>
                {filteredSubcategoriasForFilter.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isVendedor && (
            <div className="space-y-2 sm:flex-1">
              <Label htmlFor="lista-precio-filter">Lista de precios</Label>
              <Select value={listaSeleccionada} onValueChange={setListaSeleccionada}>
                <SelectTrigger id="lista-precio-filter">
                  <SelectValue placeholder="Seleccione una lista" />
                </SelectTrigger>
                <SelectContent>
                  {listas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {!isVendedor && seleccionados.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <span className="text-sm font-medium">{seleccionados.size} seleccionados</span>
            <Button size="sm" onClick={() => setFijarPrecioOpen(true)}>
              Fijar precio de venta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSeleccionados(new Set())}>
              Limpiar selección
            </Button>
          </div>
        )}

        <TabsContent value="activos">
          <DataTable
            data={productosActivos}
            columns={columnsActivos}
            searchPlaceholder="Buscar productos..."
            searchKeys={['codigo_articulo', 'descripcion', 'codigo_barra']}
            loading={loading}
          />
        </TabsContent>
        
        <TabsContent value="desactivados">
          <DataTable
            data={productosDesactivados}
            columns={columnsDesactivados}
            searchPlaceholder="Buscar productos desactivados..."
            searchKeys={['codigo_articulo', 'descripcion', 'codigo_barra']}
            loading={loading}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el producto
              "{selectedProducto?.descripcion}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ActualizadorPreciosDialog
        open={actualizadorOpen}
        onOpenChange={setActualizadorOpen}
        onUpdate={fetchData}
      />

      <FijarPrecioVentaDialog
        open={fijarPrecioOpen}
        onOpenChange={setFijarPrecioOpen}
        productos={productosSeleccionados}
        listas={listas}
        listaIdInicial={listaSeleccionada}
        onSaved={() => {
          setSeleccionados(new Set());
          fetchData();
        }}
      />

      <ImportarFriosDialog
        open={importarFriosOpen}
        onOpenChange={setImportarFriosOpen}
        onImportComplete={fetchData}
      />

      <ImprimirPreciosDialog
        open={imprimirPreciosOpen}
        onOpenChange={setImprimirPreciosOpen}
      />

      <CargaCodigosBarraDialog
        open={cargaCodBarraOpen}
        onOpenChange={setCargaCodBarraOpen}
        productos={productos.map((p) => ({
          id: p.id,
          codigo_articulo: p.codigo_articulo,
          descripcion: p.descripcion,
          codigo_barra: p.codigo_barra,
        }))}
        onUpdated={fetchData}
      />
    </MainLayout>
  );
}