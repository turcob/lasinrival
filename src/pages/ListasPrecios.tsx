import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, Info, Save, X, Search, Package, CalendarDays } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface Marca {
  id: string;
  nombre: string;
}

interface TipoProducto {
  id: string;
  nombre: string;
}

interface Producto {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  marca_id?: string | null;
  tipo_producto_id?: string | null;
}

interface ListaPrecio {
  id: string;
  nombre: string;
  codigo: string | null;
  orden: number;
  activo: boolean;
}

interface Porcentaje {
  id?: string;
  lista_precio_id: string;
  marca_id: string | null;
  tipo_producto_id: string | null;
  es_general: boolean;
  porcentaje: number;
}

interface Excepcion {
  id?: string;
  lista_precio_id: string | null;
  producto_id: string;
  porcentaje: number;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  producto?: Producto;
}

// Columna en la matriz (marca o tipo)
interface ColumnaMatriz {
  id: string;
  nombre: string;
  tipo: 'general' | 'marca' | 'tipo_producto';
  referencia_id: string | null;
}

export default function ListasPrecios() {
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [tiposProducto, setTiposProducto] = useState<TipoProducto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [porcentajes, setPorcentajes] = useState<Porcentaje[]>([]);
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Columnas activas en la matriz
  const [columnasActivas, setColumnasActivas] = useState<ColumnaMatriz[]>([
    { id: 'general', nombre: 'MERCADERÍA', tipo: 'general', referencia_id: null }
  ]);
  
  // Dialogs
  const [listaDialogOpen, setListaDialogOpen] = useState(false);
  const [deleteListaDialogOpen, setDeleteListaDialogOpen] = useState(false);
  const [columnaDialogOpen, setColumnaDialogOpen] = useState(false);
  const [excepcionDialogOpen, setExcepcionDialogOpen] = useState(false);
  const [deleteExcepcionDialogOpen, setDeleteExcepcionDialogOpen] = useState(false);
  
  // Selected items
  const [selectedLista, setSelectedLista] = useState<ListaPrecio | null>(null);
  const [selectedExcepcion, setSelectedExcepcion] = useState<Excepcion | null>(null);
  
  // Form data
  const [listaFormData, setListaFormData] = useState({ nombre: '', codigo: '', orden: 0, activo: true });
  const [columnaFormData, setColumnaFormData] = useState<{ tipo: 'marca' | 'tipo_producto', id: string }>({ tipo: 'marca', id: '' });
  const [excepcionFormData, setExcepcionFormData] = useState({ producto_id: '', lista_precio_id: '', porcentaje: 0, descripcion: '', fecha_inicio: '', fecha_fin: '' });
  const [productoSearch, setProductoSearch] = useState('');
  
  // Matriz de porcentajes editables (temporal antes de guardar)
  const [matrizTemp, setMatrizTemp] = useState<Record<string, Record<string, number>>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listasRes, marcasRes, tiposRes, porcentajesRes, excepcionesRes, productosRes] = await Promise.all([
        supabase.from('listas_precios').select('*').order('orden'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('tipos_producto').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('lista_precio_porcentajes').select('*'),
        supabase.from('lista_precio_excepciones').select('*, producto:productos(id, codigo_articulo, descripcion, marca_id, tipo_producto_id)'),
        supabase.from('productos').select('id, codigo_articulo, descripcion, marca_id, tipo_producto_id').eq('activo', true).order('descripcion'),
      ]);

      if (listasRes.error) throw listasRes.error;
      
      const listasData = listasRes.data || [];
      const porcentajesData = porcentajesRes.data || [];
      
      setListas(listasData);
      setMarcas(marcasRes.data || []);
      setTiposProducto(tiposRes.data || []);
      setPorcentajes(porcentajesData);
      setExcepciones((excepcionesRes.data || []) as Excepcion[]);
      setProductos(productosRes.data || []);
      
      // Construir columnas desde los porcentajes existentes
      const columnas: ColumnaMatriz[] = [
        { id: 'general', nombre: 'MERCADERÍA', tipo: 'general', referencia_id: null }
      ];
      
      const marcasEnUso = new Set<string>();
      const tiposEnUso = new Set<string>();
      
      porcentajesData.forEach(p => {
        if (p.marca_id) marcasEnUso.add(p.marca_id);
        if (p.tipo_producto_id) tiposEnUso.add(p.tipo_producto_id);
      });
      
      marcasEnUso.forEach(marcaId => {
        const marca = marcasRes.data?.find(m => m.id === marcaId);
        if (marca) {
          columnas.push({ id: `marca_${marcaId}`, nombre: marca.nombre, tipo: 'marca', referencia_id: marcaId });
        }
      });
      
      tiposEnUso.forEach(tipoId => {
        const tipo = tiposRes.data?.find(t => t.id === tipoId);
        if (tipo) {
          columnas.push({ id: `tipo_${tipoId}`, nombre: tipo.nombre, tipo: 'tipo_producto', referencia_id: tipoId });
        }
      });
      
      setColumnasActivas(columnas);
      
      // Construir matriz temporal
      const matriz: Record<string, Record<string, number>> = {};
      listasData.forEach(lista => {
        matriz[lista.id] = {};
        columnas.forEach(col => {
          const porcentaje = porcentajesData.find(p => {
            if (p.lista_precio_id !== lista.id) return false;
            if (col.tipo === 'general') return p.es_general;
            if (col.tipo === 'marca') return p.marca_id === col.referencia_id;
            if (col.tipo === 'tipo_producto') return p.tipo_producto_id === col.referencia_id;
            return false;
          });
          matriz[lista.id][col.id] = porcentaje?.porcentaje ?? 0;
        });
      });
      setMatrizTemp(matriz);
      setHasChanges(false);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar productos para búsqueda
  const filteredProductos = useMemo(() => {
    if (!productoSearch) return [];
    const term = productoSearch.toLowerCase();
    return productos.filter(p => 
      p.codigo_articulo.toLowerCase().includes(term) ||
      p.descripcion.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [productos, productoSearch]);

  // Actualizar celda de la matriz
  const updateMatrizCell = (listaId: string, columnaId: string, value: number) => {
    setMatrizTemp(prev => ({
      ...prev,
      [listaId]: {
        ...prev[listaId],
        [columnaId]: value
      }
    }));
    setHasChanges(true);
  };

  // Guardar toda la matriz
  const handleSaveMatriz = async () => {
    setSaving(true);
    try {
      // Primero obtener los IDs de las listas activas para borrar sus porcentajes
      const listaIds = listas.map(l => l.id);
      
      if (listaIds.length === 0) {
        toast.error('No hay listas para guardar');
        setSaving(false);
        return;
      }
      
      // Eliminar porcentajes existentes de las listas que estamos editando
      const { error: deleteError } = await supabase
        .from('lista_precio_porcentajes')
        .delete()
        .in('lista_precio_id', listaIds);
      
      if (deleteError) {
        console.error('Error deleting:', deleteError);
        throw deleteError;
      }
      
      // Usar Map para deduplicar por clave única
      const porcentajesMap = new Map<string, Omit<Porcentaje, 'id'>>();
      
      listas.forEach(lista => {
        columnasActivas.forEach(columna => {
          const porcentaje = matrizTemp[lista.id]?.[columna.id] || 0;
          
          // Crear clave única basada en el tipo de columna
          let key: string;
          if (columna.tipo === 'general') {
            key = `${lista.id}_general`;
          } else if (columna.tipo === 'marca') {
            key = `${lista.id}_marca_${columna.referencia_id}`;
          } else {
            key = `${lista.id}_tipo_${columna.referencia_id}`;
          }
          
          porcentajesMap.set(key, {
            lista_precio_id: lista.id,
            marca_id: columna.tipo === 'marca' ? columna.referencia_id : null,
            tipo_producto_id: columna.tipo === 'tipo_producto' ? columna.referencia_id : null,
            es_general: columna.tipo === 'general',
            porcentaje: porcentaje,
          });
        });
      });
      
      const nuevoPorcentajes = Array.from(porcentajesMap.values());
      
      console.log('Columnas activas:', columnasActivas);
      console.log('Listas:', listas);
      console.log('Datos a insertar:', nuevoPorcentajes);
      
      if (nuevoPorcentajes.length > 0) {
        const { error } = await supabase.from('lista_precio_porcentajes').insert(nuevoPorcentajes);
        if (error) throw error;
      }
      
      toast.success('Matriz de precios guardada correctamente');
      setHasChanges(false);
      fetchData();
    } catch (error) {
      console.error('Error saving matriz:', error);
      toast.error('Error al guardar la matriz');
    } finally {
      setSaving(false);
    }
  };

  // CRUD Listas
  const handleSubmitLista = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dataToSave = {
        nombre: listaFormData.nombre,
        codigo: listaFormData.codigo || null,
        orden: listaFormData.orden,
        activo: listaFormData.activo,
      };
      
      if (selectedLista) {
        const { error } = await supabase.from('listas_precios').update(dataToSave).eq('id', selectedLista.id);
        if (error) throw error;
        toast.success('Lista actualizada');
      } else {
        const { error } = await supabase.from('listas_precios').insert([dataToSave]);
        if (error) throw error;
        toast.success('Lista creada');
      }
      
      setListaDialogOpen(false);
      resetListaForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving lista:', error);
      toast.error('Error al guardar');
    }
  };

  const handleDeleteLista = async () => {
    if (!selectedLista) return;
    try {
      const { error } = await supabase.from('listas_precios').delete().eq('id', selectedLista.id);
      if (error) throw error;
      toast.success('Lista eliminada');
      setDeleteListaDialogOpen(false);
      setSelectedLista(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting lista:', error);
      toast.error('Error al eliminar');
    }
  };

  const openEditListaDialog = (lista: ListaPrecio) => {
    setSelectedLista(lista);
    setListaFormData({ nombre: lista.nombre, codigo: lista.codigo || '', orden: lista.orden, activo: lista.activo });
    setListaDialogOpen(true);
  };

  const resetListaForm = () => {
    setSelectedLista(null);
    setListaFormData({ nombre: '', codigo: '', orden: listas.length, activo: true });
  };

  // Agregar columna
  const handleAddColumna = () => {
    const { tipo, id } = columnaFormData;
    if (!id) {
      toast.error('Seleccione un elemento');
      return;
    }
    
    const exists = columnasActivas.some(c => 
      (tipo === 'marca' && c.referencia_id === id && c.tipo === 'marca') ||
      (tipo === 'tipo_producto' && c.referencia_id === id && c.tipo === 'tipo_producto')
    );
    
    if (exists) {
      toast.error('Esta columna ya existe');
      return;
    }
    
    let nombre = '';
    if (tipo === 'marca') {
      nombre = marcas.find(m => m.id === id)?.nombre || '';
    } else {
      nombre = tiposProducto.find(t => t.id === id)?.nombre || '';
    }
    
    const nuevaColumna: ColumnaMatriz = {
      id: `${tipo}_${id}`,
      nombre,
      tipo,
      referencia_id: id
    };
    
    setColumnasActivas(prev => [...prev, nuevaColumna]);
    
    // Inicializar celdas en 0
    setMatrizTemp(prev => {
      const nuevo = { ...prev };
      Object.keys(nuevo).forEach(listaId => {
        nuevo[listaId][nuevaColumna.id] = 0;
      });
      return nuevo;
    });
    
    setHasChanges(true);
    setColumnaDialogOpen(false);
    setColumnaFormData({ tipo: 'marca', id: '' });
  };

  const handleRemoveColumna = (columnaId: string) => {
    if (columnaId === 'general') {
      toast.error('No se puede eliminar la columna general');
      return;
    }
    
    setColumnasActivas(prev => prev.filter(c => c.id !== columnaId));
    setMatrizTemp(prev => {
      const nuevo = { ...prev };
      Object.keys(nuevo).forEach(listaId => {
        delete nuevo[listaId][columnaId];
      });
      return nuevo;
    });
    setHasChanges(true);
  };

  // CRUD Excepciones
  const handleSubmitExcepcion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dataToSave = {
        producto_id: excepcionFormData.producto_id,
        lista_precio_id: excepcionFormData.lista_precio_id || null,
        porcentaje: excepcionFormData.porcentaje,
        descripcion: excepcionFormData.descripcion || null,
        fecha_inicio: excepcionFormData.fecha_inicio || null,
        fecha_fin: excepcionFormData.fecha_fin || null,
      };
      
      if (selectedExcepcion?.id) {
        const { error } = await supabase.from('lista_precio_excepciones').update(dataToSave).eq('id', selectedExcepcion.id);
        if (error) throw error;
        toast.success('Excepción actualizada');
      } else {
        const { error } = await supabase.from('lista_precio_excepciones').insert([dataToSave]);
        if (error) throw error;
        toast.success('Excepción creada');
      }
      
      setExcepcionDialogOpen(false);
      resetExcepcionForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving excepcion:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una excepción para este producto en esta lista');
      } else {
        toast.error('Error al guardar');
      }
    }
  };

  const handleDeleteExcepcion = async () => {
    if (!selectedExcepcion?.id) return;
    try {
      const { error } = await supabase.from('lista_precio_excepciones').delete().eq('id', selectedExcepcion.id);
      if (error) throw error;
      toast.success('Excepción eliminada');
      setDeleteExcepcionDialogOpen(false);
      setSelectedExcepcion(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting excepcion:', error);
      toast.error('Error al eliminar');
    }
  };

  const openEditExcepcionDialog = (exc: Excepcion) => {
    setSelectedExcepcion(exc);
    setExcepcionFormData({
      producto_id: exc.producto_id,
      lista_precio_id: exc.lista_precio_id || '',
      porcentaje: exc.porcentaje,
      descripcion: exc.descripcion || '',
      fecha_inicio: exc.fecha_inicio || '',
      fecha_fin: exc.fecha_fin || '',
    });
    setExcepcionDialogOpen(true);
  };

  const resetExcepcionForm = () => {
    setSelectedExcepcion(null);
    setExcepcionFormData({ producto_id: '', lista_precio_id: '', porcentaje: 0, descripcion: '', fecha_inicio: '', fecha_fin: '' });
    setProductoSearch('');
  };

  if (loading) {
    return (
      <MainLayout>
        <PageHeader title="Listas de Precios" description="Cargando..." />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Listas de Precios"
        description="Gestión matricial de precios por marca/tipo con excepciones"
      >
        <div className="flex gap-2">
          {hasChanges && (
            <Button onClick={handleSaveMatriz} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          )}
          <Dialog open={listaDialogOpen} onOpenChange={setListaDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetListaForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Lista
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedLista ? 'Editar Lista' : 'Nueva Lista'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitLista} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input
                      value={listaFormData.nombre}
                      onChange={(e) => setListaFormData({ ...listaFormData, nombre: e.target.value })}
                      placeholder="Ej: MINORISTA"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Código</Label>
                    <Input
                      value={listaFormData.codigo}
                      onChange={(e) => setListaFormData({ ...listaFormData, codigo: e.target.value })}
                      placeholder="Ej: 1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Orden</Label>
                    <Input
                      type="number"
                      value={listaFormData.orden}
                      onChange={(e) => setListaFormData({ ...listaFormData, orden: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={listaFormData.activo}
                      onCheckedChange={(checked) => setListaFormData({ ...listaFormData, activo: checked })}
                    />
                    <Label>Activa</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setListaDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">{selectedLista ? 'Guardar' : 'Crear'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <Tabs defaultValue="matriz" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matriz">Matriz de Precios</TabsTrigger>
          <TabsTrigger value="excepciones">Excepciones por Producto</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz">
          {/* Info card */}
          <Card className="mb-4 bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  <p><strong>Prioridad de cálculo:</strong> Excepción &gt; Marca &gt; Tipo de Producto &gt; General (MERCADERÍA)</p>
                  <p className="mt-1">Ejemplo: Si un producto es "Paladini" tipo "Queso", se usa el % de Paladini (marca tiene prioridad).</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botón agregar columna */}
          <div className="flex justify-end mb-4">
            <Dialog open={columnaDialogOpen} onOpenChange={setColumnaDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Columna
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Columna</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={columnaFormData.tipo}
                      onValueChange={(v: 'marca' | 'tipo_producto') => setColumnaFormData({ tipo: v, id: '' })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marca">Marca</SelectItem>
                        <SelectItem value="tipo_producto">Tipo de Producto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{columnaFormData.tipo === 'marca' ? 'Marca' : 'Tipo de Producto'}</Label>
                    <Select value={columnaFormData.id} onValueChange={(v) => setColumnaFormData({ ...columnaFormData, id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {columnaFormData.tipo === 'marca' 
                          ? marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)
                          : tiposProducto.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setColumnaDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleAddColumna}>Agregar</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Matriz */}
          <Card>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px] sticky left-0 bg-background z-10">Lista</TableHead>
                    {columnasActivas.map(col => (
                      <TableHead key={col.id} className="min-w-[120px] text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-medium">{col.nombre}</span>
                          <Badge variant={col.tipo === 'marca' ? 'default' : col.tipo === 'tipo_producto' ? 'secondary' : 'outline'} className="text-xs">
                            {col.tipo === 'marca' ? 'Marca' : col.tipo === 'tipo_producto' ? 'Tipo' : 'General'}
                          </Badge>
                          {col.tipo !== 'general' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleRemoveColumna(col.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columnasActivas.length + 2} className="text-center py-8 text-muted-foreground">
                        No hay listas de precios. Cree una nueva para comenzar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    listas.map(lista => (
                      <TableRow key={lista.id}>
                        <TableCell className="font-medium sticky left-0 bg-background">
                          <div className="flex items-center gap-2">
                            {lista.codigo && <Badge variant="outline" className="font-mono">{lista.codigo}</Badge>}
                            <span>{lista.nombre}</span>
                            {!lista.activo && <Badge variant="secondary">Inactiva</Badge>}
                          </div>
                        </TableCell>
                        {columnasActivas.map(col => (
                          <TableCell key={col.id} className="text-center">
                            <div className="flex items-center justify-center">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-20 text-center"
                                value={matrizTemp[lista.id]?.[col.id] ?? 0}
                                onChange={(e) => updateMatrizCell(lista.id, col.id, parseFloat(e.target.value) || 0)}
                              />
                              <span className="ml-1 text-muted-foreground">%</span>
                            </div>
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditListaDialog(lista)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedLista(lista); setDeleteListaDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="excepciones">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Excepciones por Producto
              </CardTitle>
              <Dialog open={excepcionDialogOpen} onOpenChange={setExcepcionDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetExcepcionForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Excepción
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{selectedExcepcion ? 'Editar Excepción' : 'Nueva Excepción'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmitExcepcion} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Producto *</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar producto..."
                          value={productoSearch}
                          onChange={(e) => setProductoSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {filteredProductos.length > 0 && (
                        <ScrollArea className="h-32 border rounded-md">
                          {filteredProductos.map(p => (
                            <div
                              key={p.id}
                              className="p-2 hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setExcepcionFormData({ ...excepcionFormData, producto_id: p.id });
                                setProductoSearch(p.descripcion);
                              }}
                            >
                              <span className="font-mono text-xs">{p.codigo_articulo}</span> - {p.descripcion}
                            </div>
                          ))}
                        </ScrollArea>
                      )}
                      {excepcionFormData.producto_id && (
                        <p className="text-sm text-muted-foreground">
                          Seleccionado: {productos.find(p => p.id === excepcionFormData.producto_id)?.descripcion}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Aplica a Lista</Label>
                      <Select
                        value={excepcionFormData.lista_precio_id || 'todas'}
                        onValueChange={(v) => setExcepcionFormData({ ...excepcionFormData, lista_precio_id: v === 'todas' ? '' : v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas las listas</SelectItem>
                          {listas.map(l => <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Porcentaje *</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={excepcionFormData.porcentaje}
                            onChange={(e) => setExcepcionFormData({ ...excepcionFormData, porcentaje: parseFloat(e.target.value) || 0 })}
                            required
                          />
                          <span>%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Input
                          value={excepcionFormData.descripcion}
                          onChange={(e) => setExcepcionFormData({ ...excepcionFormData, descripcion: e.target.value })}
                          placeholder="Ej: Producto especial"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fecha Inicio</Label>
                        <Input
                          type="date"
                          value={excepcionFormData.fecha_inicio}
                          onChange={(e) => setExcepcionFormData({ ...excepcionFormData, fecha_inicio: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Vacío = sin límite de inicio</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha Fin</Label>
                        <Input
                          type="date"
                          value={excepcionFormData.fecha_fin}
                          onChange={(e) => setExcepcionFormData({ ...excepcionFormData, fecha_fin: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Vacío = sin límite de fin</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setExcepcionDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" disabled={!excepcionFormData.producto_id}>
                        {selectedExcepcion ? 'Guardar' : 'Crear'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {excepciones.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No hay excepciones definidas. Las excepciones permiten asignar un % específico a productos individuales.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Lista</TableHead>
                      <TableHead className="text-center">Porcentaje</TableHead>
                      <TableHead>Vigencia</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excepciones.map(exc => {
                      const hoy = new Date().toISOString().split('T')[0];
                      const vigente = (!exc.fecha_inicio || exc.fecha_inicio <= hoy) && 
                                     (!exc.fecha_fin || exc.fecha_fin >= hoy);
                      return (
                      <TableRow key={exc.id} className={!vigente ? 'opacity-50' : ''}>
                        <TableCell>
                          <div>
                            <span className="font-mono text-xs">{exc.producto?.codigo_articulo}</span>
                            <p className="text-sm">{exc.producto?.descripcion}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {exc.lista_precio_id 
                            ? listas.find(l => l.id === exc.lista_precio_id)?.nombre 
                            : <Badge variant="outline">Todas las listas</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-center font-medium">{exc.porcentaje}%</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <CalendarDays className="h-3 w-3 text-muted-foreground" />
                            {exc.fecha_inicio || exc.fecha_fin ? (
                              <span className={vigente ? 'text-green-600' : 'text-muted-foreground'}>
                                {exc.fecha_inicio || '∞'} → {exc.fecha_fin || '∞'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Permanente</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{exc.descripcion || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditExcepcionDialog(exc)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedExcepcion(exc); setDeleteExcepcionDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Lista Dialog */}
      <AlertDialog open={deleteListaDialogOpen} onOpenChange={setDeleteListaDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista de precios?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la lista "{selectedLista?.nombre}" y todos sus porcentajes asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLista} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Excepcion Dialog */}
      <AlertDialog open={deleteExcepcionDialogOpen} onOpenChange={setDeleteExcepcionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar excepción?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la excepción para el producto "{selectedExcepcion?.producto?.descripcion}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExcepcion} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
