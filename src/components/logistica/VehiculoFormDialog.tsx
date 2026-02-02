import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useVehiculos, useCrearVehiculo, useActualizarVehiculo } from '@/hooks/useLogistica';
import { Truck } from 'lucide-react';

const formSchema = z.object({
  patente: z.string().min(1, 'La patente es requerida'),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  capacidad_kg: z.string().optional(),
  capacidad_bultos: z.string().optional(),
  observaciones: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface VehiculoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehiculoId: string | null;
}

export function VehiculoFormDialog({ open, onOpenChange, vehiculoId }: VehiculoFormDialogProps) {
  const { data: vehiculos = [] } = useVehiculos();
  const crearVehiculo = useCrearVehiculo();
  const actualizarVehiculo = useActualizarVehiculo();

  const vehiculo = vehiculoId ? vehiculos.find(v => v.id === vehiculoId) : null;
  const isEditing = !!vehiculo;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patente: '',
      marca: '',
      modelo: '',
      capacidad_kg: '',
      capacidad_bultos: '',
      observaciones: '',
    },
  });

  useEffect(() => {
    if (vehiculo) {
      reset({
        patente: vehiculo.patente,
        marca: vehiculo.marca || '',
        modelo: vehiculo.modelo || '',
        capacidad_kg: vehiculo.capacidad_kg?.toString() || '',
        capacidad_bultos: vehiculo.capacidad_bultos?.toString() || '',
        observaciones: vehiculo.observaciones || '',
      });
    } else {
      reset({
        patente: '',
        marca: '',
        modelo: '',
        capacidad_kg: '',
        capacidad_bultos: '',
        observaciones: '',
      });
    }
  }, [vehiculo, reset]);

  const onSubmit = async (values: FormValues) => {
    const data = {
      patente: values.patente,
      marca: values.marca || null,
      modelo: values.modelo || null,
      capacidad_kg: values.capacidad_kg ? parseFloat(values.capacidad_kg) : null,
      capacidad_bultos: values.capacidad_bultos ? parseInt(values.capacidad_bultos) : null,
      observaciones: values.observaciones || null,
      activo: true,
    };

    if (isEditing && vehiculoId) {
      await actualizarVehiculo.mutateAsync({ id: vehiculoId, ...data });
    } else {
      await crearVehiculo.mutateAsync(data);
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {isEditing ? 'Editar Vehículo' : 'Nuevo Vehículo'}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? 'Modifique los datos del vehículo' : 'Complete los datos del nuevo vehículo'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="patente">Patente *</Label>
            <Input 
              id="patente" 
              {...register('patente')} 
              placeholder="ABC 123" 
              className="uppercase" 
            />
            {errors.patente && (
              <p className="text-sm text-destructive">{errors.patente.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input id="marca" {...register('marca')} placeholder="Ford" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" {...register('modelo')} placeholder="Transit" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacidad_kg">Capacidad (kg)</Label>
              <Input 
                id="capacidad_kg" 
                type="number" 
                {...register('capacidad_kg')} 
                placeholder="1500" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidad_bultos">Capacidad (bultos)</Label>
              <Input 
                id="capacidad_bultos" 
                type="number" 
                {...register('capacidad_bultos')} 
                placeholder="50" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea 
              id="observaciones" 
              {...register('observaciones')} 
              placeholder="Notas sobre el vehículo..." 
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={crearVehiculo.isPending || actualizarVehiculo.isPending}
            >
              {isEditing ? 'Guardar Cambios' : 'Crear Vehículo'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
