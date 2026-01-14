import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, Percent } from 'lucide-react';
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

interface ListaPrecio {
  id: string;
  nombre: string;
  porcentaje: number;
  activo: boolean;
  created_at: string;
}

export default function ListasPrecios() {
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLista, setSelectedLista] = useState<ListaPrecio | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    porcentaje: 0,
    activo: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('listas_precios')
        .select('*')
        .order('nombre');

      if (error) throw error;
      setListas(data || []);
    } catch (error) {
      console.error('Error fetching listas:', error);
      toast.error('Error al cargar las listas de precios');
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

    try {
      if (selectedLista) {
        const { error } = await supabase
          .from('listas_precios')
          .update(formData)
          .eq('id', selectedLista.id);

        if (error) throw error;
        toast.success('Lista de precios actualizada correctamente');
      } else {
        const { error } = await supabase.from('listas_precios').insert([formData]);
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
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedLista(null);
    setFormData({
      nombre: '',
      porcentaje: 0,
      activo: true,
    });
  };

  const columns = [
    { key: 'nombre', header: 'Nombre' },
    {
      key: 'porcentaje',
      header: 'Porcentaje',
      render: (item: ListaPrecio) => (
        <div className="flex items-center gap-1">
          <span className="font-medium">{item.porcentaje}%</span>
        </div>
      ),
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: ListaPrecio) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'created_at',
      header: 'Creado',
      render: (item: ListaPrecio) =>
        new Date(item.created_at).toLocaleDateString('es-AR'),
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
        description="Gestión de listas de precios con porcentaje de ganancia sobre el costo"
      >
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Lista
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                  placeholder="Ej: Minorista, Mayorista..."
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  required
                />
              </div>

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
                  El precio de venta será: Costo + (Costo × {formData.porcentaje}%)
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
