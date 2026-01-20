import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Users, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Cliente {
  id: string;
  codigo_cliente: string | null;
  nombre: string;
  telefono: string | null;
  email: string | null;
  vendedores?: {
    codigo: string;
    nombre: string;
  } | null;
}

interface Zona {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  clientes_count?: number;
}

export default function Zonas() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientesSheetOpen, setClientesSheetOpen] = useState(false);
  const [selectedZona, setSelectedZona] = useState<Zona | null>(null);
  const [clientesZona, setClientesZona] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    activo: true,
  });

  useEffect(() => {
    fetchZonas();
  }, []);

  const fetchZonas = async () => {
    setLoading(true);
    try {
      // Get zonas with client count
      const { data: zonasData, error: zonasError } = await supabase
        .from('zonas')
        .select('*')
        .order('codigo');

      if (zonasError) throw zonasError;

      // Get client counts per zone
      const { data: countData, error: countError } = await supabase
        .from('clientes')
        .select('zona_id')
        .not('zona_id', 'is', null);

      if (countError) throw countError;

      // Calculate counts
      const countMap: Record<string, number> = {};
      countData?.forEach((client) => {
        if (client.zona_id) {
          countMap[client.zona_id] = (countMap[client.zona_id] || 0) + 1;
        }
      });

      // Merge counts into zonas
      const zonasWithCounts = zonasData?.map((zona) => ({
        ...zona,
        clientes_count: countMap[zona.id] || 0,
      })) || [];

      setZonas(zonasWithCounts);
    } catch (error) {
      console.error('Error fetching zonas:', error);
      toast.error('Error al cargar las zonas');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientesZona = async (zona: Zona) => {
    setLoadingClientes(true);
    setSelectedZona(zona);
    setClientesSheetOpen(true);

    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, codigo_cliente, nombre, telefono, email, vendedores(codigo, nombre)')
        .eq('zona_id', zona.id)
        .order('nombre');

      if (error) throw error;
      setClientesZona(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Error al cargar los clientes de la zona');
    } finally {
      setLoadingClientes(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      toast.error('El código y nombre son requeridos');
      return;
    }

    try {
      const dataToSave = {
        codigo: formData.codigo.trim(),
        nombre: formData.nombre.trim(),
        activo: formData.activo,
      };

      if (selectedZona) {
        const { error } = await supabase
          .from('zonas')
          .update(dataToSave)
          .eq('id', selectedZona.id);
        
        if (error) throw error;
        toast.success('Zona actualizada correctamente');
      } else {
        const { error } = await supabase.from('zonas').insert([dataToSave]);
        if (error) throw error;
        toast.success('Zona creada correctamente');
      }

      setDialogOpen(false);
      resetForm();
      fetchZonas();
    } catch (error: any) {
      console.error('Error saving zona:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una zona con ese código');
      } else {
        toast.error('Error al guardar la zona');
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedZona) return;

    try {
      const { error } = await supabase
        .from('zonas')
        .delete()
        .eq('id', selectedZona.id);

      if (error) throw error;
      toast.success('Zona eliminada correctamente');
      setDeleteDialogOpen(false);
      setSelectedZona(null);
      fetchZonas();
    } catch (error: any) {
      console.error('Error deleting zona:', error);
      if (error.code === '23503') {
        toast.error('No se puede eliminar: la zona tiene clientes asociados');
      } else {
        toast.error('Error al eliminar la zona');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      activo: true,
    });
    setSelectedZona(null);
  };

  const openEditDialog = (zona: Zona) => {
    setSelectedZona(zona);
    setFormData({
      codigo: zona.codigo,
      nombre: zona.nombre,
      activo: zona.activo ?? true,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const columns = [
    { key: 'codigo', header: 'Código' },
    { key: 'nombre', header: 'Nombre' },
    {
      key: 'clientes_count',
      header: 'Clientes',
      render: (item: Zona) => (
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => fetchClientesZona(item)}
        >
          <Users className="h-4 w-4" />
          <Badge variant="secondary">{item.clientes_count || 0}</Badge>
        </Button>
      ),
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: Zona) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Zona) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedZona(item);
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
      <div className="space-y-6">
        <PageHeader
          title="Zonas"
          description="Administra las zonas geográficas y visualiza sus clientes"
        >
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Zona
          </Button>
        </PageHeader>

        <DataTable
          data={zonas}
          columns={columns}
          searchPlaceholder="Buscar zonas..."
          searchKeys={['codigo', 'nombre']}
          loading={loading}
        />

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedZona ? 'Editar Zona' : 'Nueva Zona'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value })
                  }
                  placeholder="Ej: Z01"
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
                  placeholder="Nombre de la zona"
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
                <Label htmlFor="activo">Activa</Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedZona ? 'Guardar Cambios' : 'Crear Zona'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar zona?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente la
                zona "{selectedZona?.nombre}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clients Sheet */}
        <Sheet open={clientesSheetOpen} onOpenChange={setClientesSheetOpen}>
          <SheetContent className="sm:max-w-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Clientes de {selectedZona?.nombre}
              </SheetTitle>
              <SheetDescription>
                Zona {selectedZona?.codigo} · {clientesZona.length} cliente(s)
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              {loadingClientes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : clientesZona.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No hay clientes en esta zona</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vendedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesZona.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-mono text-sm">
                            {cliente.codigo_cliente || '-'}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cliente.nombre}</p>
                              {cliente.telefono && (
                                <p className="text-xs text-muted-foreground">
                                  {cliente.telefono}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {cliente.vendedores ? (
                              <Badge variant="outline" className="text-xs">
                                {cliente.vendedores.codigo} - {cliente.vendedores.nombre}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
}
