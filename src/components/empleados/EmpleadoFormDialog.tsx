import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  fecha_ingreso: string | null;
  sueldo_base: number;
  cargo: string | null;
  estado_civil: string | null;
  cbu_cuenta: string | null;
  activo: boolean;
}

interface EmpleadoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empleado: Empleado | null;
  onSuccess: () => void;
}

const CARGOS = [
  'Vendedor',
  'Cajero',
  'Encargado',
  'Repositor',
  'Administrativo',
  'Depósito',
  'Limpieza',
  'Otro',
];

const ESTADOS_CIVILES = [
  'Soltero/a',
  'Casado/a',
  'Divorciado/a',
  'Viudo/a',
  'Unión de hecho',
];

export function EmpleadoFormDialog({ open, onOpenChange, empleado, onSuccess }: EmpleadoFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    dni: '',
    telefono: '',
    email: '',
    direccion: '',
    fecha_ingreso: '',
    sueldo_base: '',
    cargo: '',
    estado_civil: '',
    cbu_cuenta: '',
    activo: true,
  });

  useEffect(() => {
    if (empleado) {
      setFormData({
        nombre: empleado.nombre,
        dni: empleado.dni || '',
        telefono: empleado.telefono || '',
        email: empleado.email || '',
        direccion: empleado.direccion || '',
        fecha_ingreso: empleado.fecha_ingreso || '',
        sueldo_base: empleado.sueldo_base?.toString() || '',
        cargo: empleado.cargo || '',
        estado_civil: empleado.estado_civil || '',
        cbu_cuenta: empleado.cbu_cuenta || '',
        activo: empleado.activo,
      });
    } else {
      setFormData({
        nombre: '',
        dni: '',
        telefono: '',
        email: '',
        direccion: '',
        fecha_ingreso: '',
        sueldo_base: '',
        cargo: '',
        estado_civil: '',
        cbu_cuenta: '',
        activo: true,
      });
    }
  }, [empleado, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        nombre: formData.nombre,
        dni: formData.dni || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
        direccion: formData.direccion || null,
        fecha_ingreso: formData.fecha_ingreso || null,
        sueldo_base: parseFloat(formData.sueldo_base) || 0,
        cargo: formData.cargo || null,
        estado_civil: formData.estado_civil || null,
        cbu_cuenta: formData.cbu_cuenta || null,
        activo: formData.activo,
      };

      if (empleado) {
        const { error } = await supabase
          .from('empleados')
          .update(data)
          .eq('id', empleado.id);

        if (error) throw error;
        toast.success('Empleado actualizado correctamente');
      } else {
        const { error } = await supabase.from('empleados').insert([data]);
        if (error) throw error;
        toast.success('Empleado creado correctamente');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving empleado:', error);
      if (error.code === '23505') {
        toast.error('Ya existe un empleado con ese DNI');
      } else {
        toast.error('Error al guardar el empleado');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {empleado ? 'Editar Empleado' : 'Nuevo Empleado'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre Completo *</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                value={formData.dni}
                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                placeholder="12345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_ingreso">Fecha de Ingreso</Label>
              <Input
                id="fecha_ingreso"
                type="date"
                value={formData.fecha_ingreso}
                onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Select
                value={formData.cargo}
                onValueChange={(value) => setFormData({ ...formData, cargo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cargo" />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS.map((cargo) => (
                    <SelectItem key={cargo} value={cargo}>
                      {cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado_civil">Estado Civil</Label>
              <Select
                value={formData.estado_civil}
                onValueChange={(value) => setFormData({ ...formData, estado_civil: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_CIVILES.map((estado) => (
                    <SelectItem key={estado} value={estado}>
                      {estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sueldo_base">Sueldo Base</Label>
              <Input
                id="sueldo_base"
                type="number"
                step="0.01"
                min="0"
                value={formData.sueldo_base}
                onChange={(e) => setFormData({ ...formData, sueldo_base: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cbu_cuenta">CBU / Cuenta Bancaria</Label>
              <Input
                id="cbu_cuenta"
                value={formData.cbu_cuenta}
                onChange={(e) => setFormData({ ...formData, cbu_cuenta: e.target.value })}
                placeholder="CBU o número de cuenta"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="activo"
              checked={formData.activo}
              onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
            />
            <Label htmlFor="activo">Empleado activo</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : empleado ? 'Guardar Cambios' : 'Crear Empleado'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
