import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2 } from 'lucide-react';
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
import { toast } from 'sonner';

interface Subcategoria {
  id: string;
  codigo_grupo: string;
  nombre: string;
  categoria_id: string;
  activo: boolean;
  created_at: string;
  categorias?: { nombre: string; codigo_familia: string } | null;
}

interface Categoria {
  id: string;
  codigo_familia: string;
  nombre: string;
}

export default function Subcategorias() {
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubcategoria, setSelectedSubcategoria] = useState<Subcategoria | null>(null);
  const [formData, setFormData] = useState({
    codigo_grupo: '',
    nombre: '',
    categoria_id: '',
    activo: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subcategoriasRes, categoriasRes] = await Promise.all([
        supabase
          .from('subcategorias')
          .select('*, categorias(nombre, codigo_familia)')
          .order('nombre'),
        supabase.from('categorias').select('id, codigo_familia, nombre').eq('activo', true).order('nombre'),
      ]);

      if (subcategoriasRes.data) setSubcategorias(subcategoriasRes.data);
      if (categoriasRes.data) setCategorias(categoriasRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.categoria_id) {
      toast.error('Debe seleccionar una categoría');
      return;
    }

    try {
      if (selectedSubcategoria) {
        const { error } = await supabase
          .from('subcategorias')
          .update(formData)
          .eq('id', selectedSubcategoria.id);
        
        if (error) throw error;
        toast.success('Subcategoría actualizada correctamente');
      } else {
        const { error } = await supabase.from('subcategorias').insert([formData]);
        if (error) throw error;
        toast.success('Subcategoría creada correctamente');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving subcategoria:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una subcategoría con ese código');
      } else {
        toast.error('Error al guardar la subcategoría');
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedSubcategoria) return;

    try {
      const { error } = await supabase
        .from('subcategorias')
        .delete()
        .eq('id', selectedSubcategoria.id);

      if (error) throw error;
      toast.success('Subcategoría eliminada correctamente');
      setDeleteDialogOpen(false);
      setSelectedSubcategoria(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting subcategoria:', error);
      if (error.code === '23503') {
        toast.error('No se puede eliminar: la subcategoría tiene productos asociados');
      } else {
        toast.error('Error al eliminar la subcategoría');
      }
    }
  };

  const openEditDialog = (subcategoria: Subcategoria) => {
    setSelectedSubcategoria(subcategoria);
    setFormData({
      codigo_grupo: subcategoria.codigo_grupo,
      nombre: subcategoria.nombre,
      categoria_id: subcategoria.categoria_id,
      activo: subcategoria.activo,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedSubcategoria(null);
    setFormData({
      codigo_grupo: '',
      nombre: '',
      categoria_id: '',
      activo: true,
    });
  };

  const columns = [
    { key: 'codigo_grupo', header: 'Código' },
    { key: 'nombre', header: 'Nombre' },
    {
      key: 'categoria',
      header: 'Categoría',
      render: (item: Subcategoria) => (
        <span>
          {item.categorias?.codigo_familia} - {item.categorias?.nombre}
        </span>
      ),
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: Subcategoria) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Subcategoria) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedSubcategoria(item);
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
      <PageHeader title="Subcategorías" description="Gestión de grupos de productos">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Subcategoría
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedSubcategoria ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="categoria_id">Categoría *</Label>
                <Select
                  value={formData.categoria_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, categoria_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.codigo_familia} - {cat.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo_grupo">Código *</Label>
                <Input
                  id="codigo_grupo"
                  value={formData.codigo_grupo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo_grupo: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  required
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
                <Label htmlFor="activo">Subcategoría activa</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedSubcategoria ? 'Guardar Cambios' : 'Crear Subcategoría'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        data={subcategorias}
        columns={columns}
        searchPlaceholder="Buscar subcategorías..."
        searchKeys={['codigo_grupo', 'nombre']}
        loading={loading}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar subcategoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la subcategoría
              "{selectedSubcategoria?.nombre}".
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
    </MainLayout>
  );
}
