import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, RotateCcw, TrendingUp, Snowflake, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExcelImporter } from '@/components/shared/ExcelImporter';
import { ExcelImporterDesactivados } from '@/components/shared/ExcelImporterDesactivados';
import { ActualizadorPreciosDialog } from '@/components/productos/ActualizadorPreciosDialog';
import { ImportarFriosDialog } from '@/components/productos/ImportarFriosDialog';
import { ImprimirPreciosDialog } from '@/components/productos/ImprimirPreciosDialog';
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
  codigo_barra: string | null;
  activo: boolean;
  stock_actual: number;
  stock_minimo: number;
  precio_costo: number;
  desactivado_por: string | null;
  fecha_desactivacion: string | null;
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
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [activeTab, setActiveTab] = useState('activos');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [subcategoriaFilter, setSubcategoriaFilter] = useState('');

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
        supabase.from('subcategorias').select('id, nombre, categoria_id').eq('activo', true).order('nombre'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
      ]);

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
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedProducto(null);
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


  const columnsActivosFull = [
    { key: 'codigo_articulo', header: 'Código' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'unidad_medida', header: 'Unidad' },
    {
      key: 'categorias.nombre',
      header: (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">Categoría</span>
          <Select
            value={categoriaFilter}
            onValueChange={(value) => {
              setCategoriaFilter(value);
              setSubcategoriaFilter('all');
            }}
          >
            <SelectTrigger className="h-7 w-full min-w-[140px] text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
      render: (item: Producto) => item.categorias?.nombre || '-',
    },
    {
      key: 'subcategorias.nombre',
      header: (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">Subcategoría</span>
          <Select
            value={subcategoriaFilter}
            onValueChange={(value) => setSubcategoriaFilter(value)}
            disabled={!categoriaFilter || categoriaFilter === 'all'}
          >
            <SelectTrigger className="h-7 w-full min-w-[140px] text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {filteredSubcategoriasForFilter.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
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
      header: (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">Categoría</span>
          <Select
            value={categoriaFilter}
            onValueChange={(value) => {
              setCategoriaFilter(value);
              setSubcategoriaFilter('all');
            }}
          >
            <SelectTrigger className="h-7 w-full min-w-[140px] text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
      render: (item: Producto) => item.categorias?.nombre || '-',
    },
    {
      key: 'subcategorias.nombre',
      header: (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">Subcategoría</span>
          <Select
            value={subcategoriaFilter}
            onValueChange={(value) => setSubcategoriaFilter(value)}
            disabled={!categoriaFilter || categoriaFilter === 'all'}
          >
            <SelectTrigger className="h-7 w-full min-w-[140px] text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {filteredSubcategoriasForFilter.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
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
      header: (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">Categoría</span>
          <Select
            value={categoriaFilter}
            onValueChange={(value) => {
              setCategoriaFilter(value);
              setSubcategoriaFilter('all');
            }}
          >
            <SelectTrigger className="h-7 w-full min-w-[140px] text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
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
                  <Label htmlFor="codigo_articulo">Código *</Label>
                  <Input
                    id="codigo_articulo"
                    value={formData.codigo_articulo}
                    onChange={(e) =>
                      setFormData({ ...formData, codigo_articulo: e.target.value })
                    }
                    required
                  />
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

              <div className="grid gap-4 sm:grid-cols-3">
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
                    onValueChange={(value) =>
                      setFormData({ ...formData, subcategoria_id: value })
                    }
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

      <ImportarFriosDialog
        open={importarFriosOpen}
        onOpenChange={setImportarFriosOpen}
        onImportComplete={fetchData}
      />

      <ImprimirPreciosDialog
        open={imprimirPreciosOpen}
        onOpenChange={setImprimirPreciosOpen}
      />
    </MainLayout>
  );
}