import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  useVehiculos, 
  useCrearHojaRuta,
  usePedidosDisponiblesParaRuta
} from '@/hooks/useLogistica';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, User, Truck, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const formSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  vehiculo_id: z.string().optional(),
  chofer_id: z.string().optional(),
  responsable_id: z.string().optional(),
  hora_salida_estimada: z.string().optional(),
  observaciones: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface NuevaHojaRutaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NuevaHojaRutaDialog({ open, onOpenChange }: NuevaHojaRutaDialogProps) {
  const [selectedPedidos, setSelectedPedidos] = useState<string[]>([]);
  
  const { data: vehiculos = [] } = useVehiculos();
  const { data: pedidosDisponibles = [] } = usePedidosDisponiblesParaRuta();
  const crearHojaRuta = useCrearHojaRuta();

  // Get empleados for chofer/responsable selection
  const { data: empleados = [] } = useQuery({
    queryKey: ['empleados-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empleados')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fecha: format(new Date(), 'yyyy-MM-dd'),
      vehiculo_id: '',
      chofer_id: '',
      responsable_id: '',
      hora_salida_estimada: '',
      observaciones: '',
    },
  });

  const togglePedido = (pedidoId: string) => {
    setSelectedPedidos(prev => 
      prev.includes(pedidoId) 
        ? prev.filter(id => id !== pedidoId)
        : [...prev, pedidoId]
    );
  };

  const onSubmit = async (values: FormValues) => {
    await crearHojaRuta.mutateAsync({
      fecha: values.fecha,
      vehiculo_id: values.vehiculo_id || undefined,
      chofer_id: values.chofer_id || undefined,
      responsable_id: values.responsable_id || undefined,
      hora_salida_estimada: values.hora_salida_estimada || undefined,
      observaciones: values.observaciones || undefined,
      pedido_ids: selectedPedidos,
    });
    form.reset();
    setSelectedPedidos([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Nueva Hoja de Ruta
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Fecha *
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hora_salida_estimada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora Salida Estimada</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehiculo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Vehículo
                    </FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar vehículo</option>
                        {vehiculos.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.patente} - {v.marca} {v.modelo}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chofer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Chofer
                    </FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar chofer</option>
                        {empleados.map(e => (
                          <option key={e.id} value={e.id}>{e.nombre}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsable_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsable</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar responsable</option>
                        {empleados.map(e => (
                          <option key={e.id} value={e.id}>{e.nombre}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Notas adicionales..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pedidos selection */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Pedidos Disponibles</h3>
                <Badge variant="secondary">
                  {selectedPedidos.length} seleccionados
                </Badge>
              </div>
              
              <div className="border rounded-md max-h-[250px] overflow-y-auto">
                {pedidosDisponibles.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No hay pedidos disponibles para asignar
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {pedidosDisponibles.map((pedido) => (
                      <div 
                        key={pedido.id}
                        className={`
                          p-3 rounded-lg border cursor-pointer transition-colors
                          ${selectedPedidos.includes(pedido.id) 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-muted'
                          }
                        `}
                        onClick={() => togglePedido(pedido.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={selectedPedidos.includes(pedido.id)}
                            onCheckedChange={() => togglePedido(pedido.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold">
                                #{pedido.numero_pedido}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {pedido.estado}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate">
                              {pedido.cliente?.nombre}
                            </p>
                            {pedido.cliente?.direccion && (
                              <p className="text-xs text-muted-foreground truncate">
                                {pedido.cliente.direccion}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${pedido.total.toLocaleString('es-AR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={crearHojaRuta.isPending}>
                Crear Hoja de Ruta
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
