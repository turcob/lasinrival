import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVehiculos, useCrearVehiculo, useActualizarVehiculo } from '@/hooks/useLogistica';

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

  const form = useForm<FormValues>({
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
      form.reset({
        patente: vehiculo.patente,
        marca: vehiculo.marca || '',
        modelo: vehiculo.modelo || '',
        capacidad_kg: vehiculo.capacidad_kg?.toString() || '',
        capacidad_bultos: vehiculo.capacidad_bultos?.toString() || '',
        observaciones: vehiculo.observaciones || '',
      });
    } else {
      form.reset({
        patente: '',
        marca: '',
        modelo: '',
        capacidad_kg: '',
        capacidad_bultos: '',
        observaciones: '',
      });
    }
  }, [vehiculo, form]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Vehículo' : 'Nuevo Vehículo'}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulario para {isEditing ? 'editar' : 'crear'} un vehículo
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="patente"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patente *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="ABC 123" className="uppercase" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ford" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modelo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Transit" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacidad_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad (kg)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="1500" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capacidad_bultos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad (bultos)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Notas sobre el vehículo..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
