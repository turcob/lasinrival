import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Link2, MapPin, X } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Empleado {
  id: string;
  nombre: string;
  activo: boolean;
}

interface Zona {
  id: string;
  codigo: string;
  nombre: string;
}

interface VendedorZona {
  id: string;
  zona_id: string;
  zonas: { codigo: string; nombre: string } | null;
}

interface Vendedor {
  id: string;
  codigo: string;
  nombre: string;
  empleado_id: string | null;
  activo: boolean;
  created_at: string;
  empleados?: {
    nombre: string;
  } | null;
  vendedor_zonas?: VendedorZona[];
}

export default function Vendedores() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [zonasDialogOpen, setZonasDialogOpen] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
  const [selectedZonaId, setSelectedZonaId] = useState('');
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    empleado_id: '',
    activo: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vendedoresRes, empleadosRes, zonasRes] = await Promise.all([
        supabase
          .from('vendedores')
          .select('*, empleados(nombre), vendedor_zonas(id, zona_id, zonas(codigo, nombre))')
          .order('codigo'),
        supabase
          .from('empleados')
          .select('id, nombre, activo')
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('zonas')
          .select('id, codigo, nombre')
          .eq('activo', true)
          .order('nombre'),
      ]);

      if (vendedoresRes.data) setVendedores(vendedoresRes.data as unknown as Vendedor[]);
      if (empleadosRes.data) setEmpleados(empleadosRes.data);
      if (zonasRes.data) setZonas(zonasRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
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
        empleado_id: formData.empleado_id || null,
        activo: formData.activo,
      };

      if (selectedVendedor) {
        const { error } = await supabase
          .from('vendedores')
          .update(dataToSave)
          .eq('id', selectedVendedor.id);
        
        if (error) throw error;
        toast.success('Vendedor actualizado correctamente');
      } else {
        const { error } = await supabase.from('vendedores').insert([dataToSave]);
        if (error) throw error;
        toast.success('Vendedor creado correctamente');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving vendedor:', error);
      if (error.code === '23505') {
        toast.error('Ya existe un vendedor con ese código');
      } else {
        toast.error('Error al guardar el vendedor');
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedVendedor) return;

    try {
      const { error } = await supabase
        .from('vendedores')
        .delete()
        .eq('id', selectedVendedor.id);

      if (error) throw error;
      toast.success('Vendedor eliminado correctamente');
      setDeleteDialogOpen(false);
      setSelectedVendedor(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting vendedor:', error);
      if (error.code === '23503') {
        toast.error('No se puede eliminar: el vendedor tiene clientes asociados');
      } else {
        toast.error('Error al eliminar el vendedor');
      }
    }
  };

  const handleAddZona = async () => {
    if (!selectedVendedor || !selectedZonaId) return;

    try {
      const { error } = await supabase
        .from('vendedor_zonas')
        .insert({ vendedor_id: selectedVendedor.id, zona_id: selectedZonaId });

      if (error) {
        if (error.code === '23505') {
          toast.error('Esta zona ya está asignada');
        } else {
          throw error;
        }
        return;
      }
      toast.success('Zona asignada correctamente');
      setSelectedZonaId('');
      fetchData();
      // Refresh selectedVendedor
      const updated = vendedores.find(v => v.id === selectedVendedor.id);
      if (updated) {
        const res = await supabase
          .from('vendedores')
          .select('*, empleados(nombre), vendedor_zonas(id, zona_id, zonas(codigo, nombre))')
          .eq('id', selectedVendedor.id)
          .single();
        if (res.data) setSelectedVendedor(res.data as unknown as Vendedor);
      }
    } catch (error) {
      console.error('Error adding zona:', error);
      toast.error('Error al asignar zona');
    }
  };

  const handleRemoveZona = async (vendedorZonaId: string) => {
    try {
      const { error } = await supabase
        .from('vendedor_zonas')
        .delete()
        .eq('id', vendedorZonaId);

      if (error) throw error;
      toast.success('Zona desvinculada correctamente');
      // Refresh
      if (selectedVendedor) {
        const res = await supabase
          .from('vendedores')
          .select('*, empleados(nombre), vendedor_zonas(id, zona_id, zonas(codigo, nombre))')
          .eq('id', selectedVendedor.id)
          .single();
        if (res.data) setSelectedVendedor(res.data as unknown as Vendedor);
      }
      fetchData();
    } catch (error) {
      console.error('Error removing zona:', error);
      toast.error('Error al desvincular zona');
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      empleado_id: '',
      activo: true,
    });
    setSelectedVendedor(null);
  };

  const openEditDialog = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor);
    setFormData({
      codigo: vendedor.codigo,
      nombre: vendedor.nombre,
      empleado_id: vendedor.empleado_id || '',
      activo: vendedor.activo ?? true,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openZonasDialog = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor);
    setSelectedZonaId('');
    setZonasDialogOpen(true);
  };

  const columns = [
    { key: 'codigo', header: 'Código' },
    { key: 'nombre', header: 'Nombre' },
    {
      key: 'empleado',
      header: 'Empleado Vinculado',
      render: (item: Vendedor) => (
        item.empleados?.nombre ? (
          <Badge variant="outline" className="gap-1">
            <Link2 className="h-3 w-3" />
            {item.empleados.nombre}
          </Badge>
        ) : (
          <span className="text-muted-foreground">Sin vincular</span>
        )
      ),
    },
    {
      key: 'zonas',
      header: 'Zonas',
      render: (item: Vendedor) => (
        <div className="flex flex-wrap gap-1">
          {item.vendedor_zonas && item.vendedor_zonas.length > 0 ? (
            item.vendedor_zonas.map(vz => (
              <Badge key={vz.id} variant="secondary" className="gap-1 text-xs">
                <MapPin className="h-3 w-3" />
                {vz.zonas?.nombre || 'N/A'}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">Sin zonas</span>
          )}
        </div>
      ),
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: Vendedor) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Vendedor) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openZonasDialog(item)} title="Gestionar zonas">
            <MapPin className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedVendedor(item);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const zonasAsignadas = selectedVendedor?.vendedor_zonas?.map(vz => vz.zona_id) || [];
  const zonasDisponibles = zonas.filter(z => !zonasAsignadas.includes(z.id));

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Vendedores"
          description="Administra los vendedores y vincúlalos con empleados y zonas"
        >
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Vendedor
          </Button>
        </PageHeader>

        <DataTable
          data={vendedores}
          columns={columns}
          searchPlaceholder="Buscar vendedores..."
          searchKeys={['codigo', 'nombre']}
          loading={loading}
        />

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedVendedor ? 'Editar Vendedor' : 'Nuevo Vendedor'}
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
                  placeholder="Ej: V001"
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
                  placeholder="Nombre del vendedor"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="empleado_id">Vincular con Empleado</Label>
                <Select
                  value={formData.empleado_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, empleado_id: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empleado..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vincular</SelectItem>
                    {empleados.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Opcional: vincule este vendedor con un empleado existente
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
                <Label htmlFor="activo">Activo</Label>
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
                  {selectedVendedor ? 'Guardar Cambios' : 'Crear Vendedor'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Zonas Dialog */}
        <Dialog open={zonasDialogOpen} onOpenChange={setZonasDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Zonas de {selectedVendedor?.nombre}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Zonas asignadas */}
              <div className="space-y-2">
                <Label>Zonas asignadas</Label>
                {selectedVendedor?.vendedor_zonas && selectedVendedor.vendedor_zonas.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedVendedor.vendedor_zonas.map(vz => (
                      <Badge key={vz.id} variant="secondary" className="gap-1 pr-1">
                        <MapPin className="h-3 w-3" />
                        {vz.zonas?.nombre || 'N/A'}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 ml-1 hover:bg-destructive/20"
                          onClick={() => handleRemoveZona(vz.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tiene zonas asignadas</p>
                )}
              </div>

              {/* Agregar zona */}
              {zonasDisponibles.length > 0 && (
                <div className="space-y-2">
                  <Label>Agregar zona</Label>
                  <div className="flex gap-2">
                    <Select value={selectedZonaId} onValueChange={setSelectedZonaId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar zona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {zonasDisponibles.map(z => (
                          <SelectItem key={z.id} value={z.id}>
                            {z.codigo} - {z.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddZona} disabled={!selectedZonaId}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar vendedor?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el
                vendedor "{selectedVendedor?.nombre}".
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
      </div>
    </MainLayout>
  );
}
