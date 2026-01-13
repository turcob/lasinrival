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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Categoria {
  id: string;
  codigo_familia: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({
    codigo_familia: '',
    nombre: '',
    activo: true,
  });

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre');

      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      console.error('Error fetching categorias:', error);
      toast.error('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (selectedCategoria) {
        const { error } = await supabase
          .from('categorias')
          .update(formData)
          .eq('id', selectedCategoria.id);
        
        if (error) throw error;
        toast.success('Categoría actualizada correctamente');
      } else {
        const { error } = await supabase.from('categorias').insert([formData]);
        if (error) throw error;
        toast.success('Categoría creada correctamente');
      }

      setDialogOpen(false);
      resetForm();
      fetchCategorias();
    } catch (error: any) {
      console.error('Error saving categoria:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una categoría con ese código');
      } else {
        toast.error('Error al guardar la categoría');
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedCategoria) return;

    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', selectedCategoria.id);

      if (error) throw error;
      toast.success('Categoría eliminada correctamente');
      setDeleteDialogOpen(false);
      setSelectedCategoria(null);
      fetchCategorias();
    } catch (error: any) {
      console.error('Error deleting categoria:', error);
      if (error.code === '23503') {
        toast.error('No se puede eliminar: la categoría tiene productos o subcategorías asociados');
      } else {
        toast.error('Error al eliminar la categoría');
      }
    }
  };

  const openEditDialog = (categoria: Categoria) => {
    setSelectedCategoria(categoria);
    setFormData({
      codigo_familia: categoria.codigo_familia,
      nombre: categoria.nombre,
      activo: categoria.activo,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedCategoria(null);
    setFormData({
      codigo_familia: '',
      nombre: '',
      activo: true,
    });
  };

  const columns = [
    { key: 'codigo_familia', header: 'Código' },
    { key: 'nombre', header: 'Nombre' },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: Categoria) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Categoria) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedCategoria(item);
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
      <PageHeader title="Categorías" description="Gestión de familias de productos">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Categoría
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo_familia">Código *</Label>
                <Input
                  id="codigo_familia"
                  value={formData.codigo_familia}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo_familia: e.target.value })
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
                <Label htmlFor="activo">Categoría activa</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedCategoria ? 'Guardar Cambios' : 'Crear Categoría'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        data={categorias}
        columns={columns}
        searchPlaceholder="Buscar categorías..."
        searchKeys={['codigo_familia', 'nombre']}
        loading={loading}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la categoría
              "{selectedCategoria?.nombre}".
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