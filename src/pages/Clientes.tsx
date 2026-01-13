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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Cliente {
  id: string;
  nombre: string;
  dni_cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  lista_precio_id: string | null;
  activo: boolean;
  listas_precios?: { nombre: string } | null;
}

interface ListaPrecio {
  id: string;
  nombre: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    dni_cuit: '',
    telefono: '',
    email: '',
    direccion: '',
    lista_precio_id: '',
    activo: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientesRes, listasRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('*, listas_precios(nombre)')
          .order('nombre'),
        supabase.from('listas_precios').select('id, nombre').eq('activo', true),
      ]);

      if (clientesRes.data) setClientes(clientesRes.data);
      if (listasRes.data) setListasPrecios(listasRes.data);
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
      const data = {
        ...formData,
        dni_cuit: formData.dni_cuit || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
        direccion: formData.direccion || null,
        lista_precio_id: formData.lista_precio_id || null,
      };

      if (selectedCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(data)
          .eq('id', selectedCliente.id);
        
        if (error) throw error;
        toast.success('Cliente actualizado correctamente');
      } else {
        const { error } = await supabase.from('clientes').insert([data]);
        if (error) throw error;
        toast.success('Cliente creado correctamente');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving cliente:', error);
      toast.error('Error al guardar el cliente');
    }
  };

  const handleDelete = async () => {
    if (!selectedCliente) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', selectedCliente.id);

      if (error) throw error;
      toast.success('Cliente eliminado correctamente');
      setDeleteDialogOpen(false);
      setSelectedCliente(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting cliente:', error);
      toast.error('Error al eliminar el cliente');
    }
  };

  const openEditDialog = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setFormData({
      nombre: cliente.nombre,
      dni_cuit: cliente.dni_cuit || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      lista_precio_id: cliente.lista_precio_id || '',
      activo: cliente.activo,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedCliente(null);
    setFormData({
      nombre: '',
      dni_cuit: '',
      telefono: '',
      email: '',
      direccion: '',
      lista_precio_id: '',
      activo: true,
    });
  };

  const columns = [
    { key: 'nombre', header: 'Nombre / Razón Social' },
    { key: 'dni_cuit', header: 'DNI/CUIT', render: (item: Cliente) => item.dni_cuit || '-' },
    { key: 'telefono', header: 'Teléfono', render: (item: Cliente) => item.telefono || '-' },
    { key: 'email', header: 'Email', render: (item: Cliente) => item.email || '-' },
    {
      key: 'listas_precios.nombre',
      header: 'Lista de Precio',
      render: (item: Cliente) => item.listas_precios?.nombre || 'Por defecto',
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: Cliente) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Cliente) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedCliente(item);
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
      <PageHeader title="Clientes" description="Gestión de clientes">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre / Razón Social *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dni_cuit">DNI/CUIT</Label>
                  <Input
                    id="dni_cuit"
                    value={formData.dni_cuit}
                    onChange={(e) =>
                      setFormData({ ...formData, dni_cuit: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lista_precio">Lista de Precio</Label>
                  <Select
                    value={formData.lista_precio_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, lista_precio_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Por defecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {listasPrecios.map((lista) => (
                        <SelectItem key={lista.id} value={lista.id}>
                          {lista.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) =>
                    setFormData({ ...formData, direccion: e.target.value })
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
                <Label htmlFor="activo">Cliente activo</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedCliente ? 'Guardar Cambios' : 'Crear Cliente'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        data={clientes}
        columns={columns}
        searchPlaceholder="Buscar clientes..."
        searchKeys={['nombre', 'dni_cuit', 'email', 'telefono']}
        loading={loading}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el cliente
              "{selectedCliente?.nombre}".
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