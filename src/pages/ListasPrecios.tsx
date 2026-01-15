import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, Percent, Info } from 'lucide-react';
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
import { toast } from 'sonner';
import { getPrioridadPorNivel } from '@/lib/precioUtils';

interface Marca {
  id: string;
  nombre: string;
}

interface TipoProducto {
  id: string;
  nombre: string;
}

interface ListaPrecio {
  id: string;
  nombre: string;
  porcentaje: number;
  activo: boolean;
  nivel: 'global' | 'marca' | 'tipo_producto';
  prioridad: number;
  marca_id: string | null;
  tipo_producto_id: string | null;
  created_at: string;
  marca?: Marca | null;
  tipo_producto?: TipoProducto | null;
}

const NIVELES = [
  { value: 'global', label: 'Global', description: 'Aplica a todos los productos', prioridad: 1 },
  { value: 'tipo_producto', label: 'Por Tipo de Producto', description: 'Aplica a productos de un tipo específico', prioridad: 2 },
  { value: 'marca', label: 'Por Marca', description: 'Aplica a productos de una marca específica (mayor prioridad)', prioridad: 3 },
];

export default function ListasPrecios() {
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [tiposProducto, setTiposProducto] = useState<TipoProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLista, setSelectedLista] = useState<ListaPrecio | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    porcentaje: 0,
    activo: true,
    nivel: 'global' as 'global' | 'marca' | 'tipo_producto',
    marca_id: null as string | null,
    tipo_producto_id: null as string | null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listasRes, marcasRes, tiposRes] = await Promise.all([
        supabase
          .from('listas_precios')
          .select('*, marca:marcas(id, nombre), tipo_producto:tipos_producto(id, nombre)')
          .order('prioridad', { ascending: false }),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('tipos_producto').select('id, nombre').eq('activo', true).order('nombre'),
      ]);

      if (listasRes.error) throw listasRes.error;
      setListas((listasRes.data || []) as ListaPrecio[]);
      setMarcas(marcasRes.data || []);
      setTiposProducto(tiposRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.porcentaje < 0) {
      toast.error('El porcentaje debe ser mayor o igual a 0');
      return;
    }

    if (formData.nivel === 'marca' && !formData.marca_id) {
      toast.error('Debe seleccionar una marca');
      return;
    }

    if (formData.nivel === 'tipo_producto' && !formData.tipo_producto_id) {
      toast.error('Debe seleccionar un tipo de producto');
      return;
    }

    const prioridad = getPrioridadPorNivel(formData.nivel);

    const dataToSave = {
      nombre: formData.nombre,
      porcentaje: formData.porcentaje,
      activo: formData.activo,
      nivel: formData.nivel,
      prioridad,
      marca_id: formData.nivel === 'marca' ? formData.marca_id : null,
      tipo_producto_id: formData.nivel === 'tipo_producto' ? formData.tipo_producto_id : null,
    };

    try {
      if (selectedLista) {
        const { error } = await supabase
          .from('listas_precios')
          .update(dataToSave)
          .eq('id', selectedLista.id);

        if (error) throw error;
        toast.success('Lista de precios actualizada correctamente');
      } else {
        const { error } = await supabase.from('listas_precios').insert([dataToSave]);
        if (error) throw error;
        toast.success('Lista de precios creada correctamente');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving lista:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una lista con ese nombre');
      } else {
        toast.error('Error al guardar la lista de precios');
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedLista) return;

    try {
      const { error } = await supabase
        .from('listas_precios')
        .delete()
        .eq('id', selectedLista.id);

      if (error) throw error;
      toast.success('Lista de precios eliminada correctamente');
      setDeleteDialogOpen(false);
      setSelectedLista(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting lista:', error);
      toast.error('Error al eliminar la lista de precios');
    }
  };

  const openEditDialog = (lista: ListaPrecio) => {
    setSelectedLista(lista);
    setFormData({
      nombre: lista.nombre,
      porcentaje: lista.porcentaje,
      activo: lista.activo,
      nivel: lista.nivel || 'global',
      marca_id: lista.marca_id,
      tipo_producto_id: lista.tipo_producto_id,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedLista(null);
    setFormData({
      nombre: '',
      porcentaje: 0,
      activo: true,
      nivel: 'global',
      marca_id: null,
      tipo_producto_id: null,
    });
  };

  const getNivelBadge = (lista: ListaPrecio) => {
    const nivel = NIVELES.find(n => n.value === lista.nivel) || NIVELES[0];
    let label = nivel.label;
    
    if (lista.nivel === 'marca' && lista.marca) {
      label = `Marca: ${lista.marca.nombre}`;
    } else if (lista.nivel === 'tipo_producto' && lista.tipo_producto) {
      label = `Tipo: ${lista.tipo_producto.nombre}`;
    }

    const variant = lista.nivel === 'marca' ? 'default' : 
                    lista.nivel === 'tipo_producto' ? 'secondary' : 
                    'outline';

    return <Badge variant={variant}>{label}</Badge>;
  };

  const columns = [
    { key: 'nombre', header: 'Nombre' },
    {
      key: 'nivel',
      header: 'Nivel / Aplica a',
      render: (item: ListaPrecio) => getNivelBadge(item),
    },
    {
      key: 'porcentaje',
      header: 'Porcentaje',
      render: (item: ListaPrecio) => (
        <div className="flex items-center gap-1">
          <span className="font-medium text-primary">{item.porcentaje}%</span>
        </div>
      ),
    },
    {
      key: 'prioridad',
      header: 'Prioridad',
      render: (item: ListaPrecio) => (
        <Badge variant="outline" className="font-mono">
          {item.prioridad}
        </Badge>
      ),
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: ListaPrecio) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: ListaPrecio) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedLista(item);
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
      <PageHeader
        title="Listas de Precios"
        description="Gestión de listas de precios con sistema de prioridad (Marca > Tipo > Global)"
      >
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Lista
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedLista ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Manfrey 18%, Quesos 20%..."
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nivel">Nivel de Aplicación *</Label>
                <Select
                  value={formData.nivel}
                  onValueChange={(value: 'global' | 'marca' | 'tipo_producto') => {
                    setFormData({
                      ...formData,
                      nivel: value,
                      marca_id: null,
                      tipo_producto_id: null,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NIVELES.map((nivel) => (
                      <SelectItem key={nivel.value} value={nivel.value}>
                        <div className="flex items-center gap-2">
                          <span>{nivel.label}</span>
                          <Badge variant="outline" className="text-xs">P{nivel.prioridad}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {NIVELES.find(n => n.value === formData.nivel)?.description}
                </p>
              </div>

              {formData.nivel === 'marca' && (
                <div className="space-y-2">
                  <Label htmlFor="marca">Marca *</Label>
                  <Select
                    value={formData.marca_id || ''}
                    onValueChange={(value) => setFormData({ ...formData, marca_id: value })}
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
              )}

              {formData.nivel === 'tipo_producto' && (
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Producto *</Label>
                  <Select
                    value={formData.tipo_producto_id || ''}
                    onValueChange={(value) => setFormData({ ...formData, tipo_producto_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposProducto.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.id}>
                          {tipo.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="porcentaje">Porcentaje de Ganancia *</Label>
                <div className="relative">
                  <Input
                    id="porcentaje"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej: 30 para 30%"
                    value={formData.porcentaje}
                    onChange={(e) =>
                      setFormData({ ...formData, porcentaje: Number(e.target.value) })
                    }
                    required
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Precio venta = Costo × (1 + {formData.porcentaje}%)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="activo"
                  checked={formData.activo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, activo: checked })
                  }
                />
                <Label htmlFor="activo">Lista activa</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedLista ? 'Guardar Cambios' : 'Crear Lista'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Info card */}
      <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Sistema de Prioridad
        </h4>
        <p className="text-sm text-muted-foreground">
          Al calcular el precio de un producto, se aplica la lista con <strong>mayor prioridad</strong>:
        </p>
        <div className="flex gap-4 mt-2">
          <Badge variant="default">Marca (P3) - Mayor prioridad</Badge>
          <Badge variant="secondary">Tipo Producto (P2)</Badge>
          <Badge variant="outline">Global (P1) - Menor prioridad</Badge>
        </div>
      </div>

      <DataTable
        data={listas}
        columns={columns}
        searchPlaceholder="Buscar listas..."
        searchKeys={['nombre']}
        loading={loading}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista de precios?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la lista
              "{selectedLista?.nombre}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
