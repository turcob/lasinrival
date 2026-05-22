import { useEffect, useState, useMemo } from 'react';
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

import { 
  useVehiculos, 
  useCrearHojaRuta,
  usePedidosDisponiblesParaRuta
} from '@/hooks/useLogistica';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, User, Truck, Calendar, Check, Filter, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { generarRemitoHTML, REMITO_STYLES, buildRemitoOrientationToolbar, getRemitoStyles } from '@/lib/imprimirRemito';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';

const formSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  vehiculo_id: z.string().optional(),
  chofer_id: z.string().optional(),
  responsable_id: z.string().min(1, 'El encargado es requerido'),
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
  const [filtroZona, setFiltroZona] = useState<string>('');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('');
  const [filtroOrigen, setFiltroOrigen] = useState<'sin_web' | 'solo_web' | 'todos'>('sin_web');
  const [remitosImpresos, setRemitosImpresos] = useState<Set<string>>(new Set());
  
  const { data: vehiculos = [] } = useVehiculos();
  const { data: pedidosDisponibles = [] } = usePedidosDisponiblesParaRuta();
  const crearHojaRuta = useCrearHojaRuta();
  const { config: empresaConfig } = useConfiguracionComercio();

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

  // Empleados que además tienen el rol "responsable" (vía user_roles)
  const { data: responsables = [] } = useQuery({
    queryKey: ['empleados-rol-responsable'],
    queryFn: async () => {
      const { data: rolesUsuarios, error: errRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'responsable' as any);
      if (errRoles) throw errRoles;
      const userIds = (rolesUsuarios || []).map((r: any) => r.user_id).filter(Boolean);
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('empleados')
        .select('id, nombre, user_id')
        .eq('activo', true)
        .in('user_id', userIds)
        .order('nombre');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas-lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zonas')
        .select('id, nombre')
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ['vendedores-lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const pedidosFiltrados = useMemo(() => {
    return pedidosDisponibles.filter((pedido: any) => {
      const tipoPedidoNormalizado = typeof pedido.tipo_pedido === 'string'
        ? pedido.tipo_pedido.trim().toLowerCase()
        : 'reparto';

      if (filtroZona && pedido.cliente?.zona_id !== filtroZona) return false;
      if (filtroVendedor && pedido.cliente?.vendedor_id !== filtroVendedor) return false;
      if (filtroOrigen === 'solo_web' && tipoPedidoNormalizado !== 'web') return false;
      if (filtroOrigen === 'sin_web' && tipoPedidoNormalizado === 'web') return false;
      return true;
    });
  }, [pedidosDisponibles, filtroZona, filtroVendedor, filtroOrigen]);

  useEffect(() => {
    const filteredIds = new Set(pedidosFiltrados.map((pedido: any) => pedido.id));

    setSelectedPedidos((prev) => {
      const visibles = prev.filter((id) => filteredIds.has(id));
      return visibles.length === prev.length ? prev : visibles;
    });
  }, [pedidosFiltrados]);

  const allFilteredSelected = pedidosFiltrados.length > 0 && pedidosFiltrados.every((p: any) => selectedPedidos.includes(p.id));

  const pedidosSeleccionadosData = useMemo(() => {
    return pedidosFiltrados.filter((p: any) => selectedPedidos.includes(p.id));
  }, [pedidosFiltrados, selectedPedidos]);

  const selectedPedidosIdsVisibles = useMemo(() => {
    return pedidosSeleccionadosData.map((pedido: any) => pedido.id);
  }, [pedidosSeleccionadosData]);

  const pedidosCortos = useMemo(
    () => pedidosSeleccionadosData.filter((p: any) => (p.detalles?.length || 0) <= 10),
    [pedidosSeleccionadosData]
  );
  const pedidosLargos = useMemo(
    () => pedidosSeleccionadosData.filter((p: any) => (p.detalles?.length || 0) > 10),
    [pedidosSeleccionadosData]
  );

  const handleImprimirRemitos = (pedidos: any[]) => {
    if (pedidos.length === 0) return;
    const ventana = window.open('', '_blank', 'width=800,height=600');
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
      return;
    }

    const remitosHTML = pedidos.map((pedido: any, index: number) => {
      const isLast = index === pedidos.length - 1;
      const zonaNombre = zonas.find(z => z.id === pedido.cliente?.zona_id)?.nombre;
      return generarRemitoHTML({
        numeroPedido: pedido.numero_pedido,
        fecha: new Date(pedido.fecha_pedido),
        cliente: {
          nombre: pedido.cliente?.nombre || '-',
          codigoCliente: pedido.cliente?.codigo_cliente || undefined,
          direccion: pedido.cliente?.direccion || '',
          cuit: pedido.cliente?.dni_cuit || '',
          zona: zonaNombre || undefined,
        },
        vendedor: undefined,
        empresa: empresaConfig ? {
          razonSocial: empresaConfig.nombre_fantasia || empresaConfig.razon_social,
          cuit: empresaConfig.cuit,
          direccion: [empresaConfig.direccion, empresaConfig.localidad, empresaConfig.provincia].filter(Boolean).join(', '),
          telefono: empresaConfig.telefono || undefined,
        } : undefined,
        lineas: (pedido.detalles || [])
          .filter((d: any) => d.producto)
          .map((d: any) => ({
            codigo: d.producto.codigo_articulo,
            descripcion: d.producto.descripcion,
            unidadMedida: d.producto.unidad_medida || 'UNI',
            cantidad: d.cantidad_pedida,
            precioUnitario: d.precio_unitario,
            descuento: d.descuento_porcentaje ?? 0,
            subtotal: d.subtotal,
          })),
        total: pedido.total,
      }, isLast);
    }).join('');

    ventana.document.write(`
      <!DOCTYPE html>
      <html><head><title>Remitos</title>
      <style id="remito-styles">${REMITO_STYLES}</style>
      </head><body>
        ${remitosHTML}
        ${buildRemitoOrientationToolbar()}
      </body></html>
    `);
    ventana.document.close();
    setRemitosImpresos((prev) => {
      const next = new Set(prev);
      pedidos.forEach((p: any) => next.add(p.id));
      return next;
    });
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
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

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = pedidosFiltrados.map((p: any) => p.id);
      setSelectedPedidos(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = pedidosFiltrados.map((p: any) => p.id);
      setSelectedPedidos(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const faltantes = selectedPedidosIdsVisibles.filter((id) => !remitosImpresos.has(id));
    if (faltantes.length > 0) {
      alert(`Debés imprimir los remitos antes de crear la hoja de ruta. Faltan ${faltantes.length} remito(s) por imprimir.`);
      return;
    }
    await crearHojaRuta.mutateAsync({
      fecha: values.fecha,
      vehiculo_id: values.vehiculo_id || undefined,
      chofer_id: values.chofer_id || undefined,
      responsable_id: values.responsable_id || undefined,
      hora_salida_estimada: values.hora_salida_estimada || undefined,
      observaciones: values.observaciones || undefined,
        pedido_ids: selectedPedidosIdsVisibles,
    });
    reset();
    setSelectedPedidos([]);
    setRemitosImpresos(new Set());
    setFiltroZona('');
    setFiltroVendedor('');
    setFiltroOrigen('sin_web');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Nueva Hoja de Ruta
          </SheetTitle>
          <SheetDescription>
            Complete los datos y seleccione los pedidos a incluir
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha *
              </Label>
              <Input id="fecha" type="date" {...register('fecha')} />
              {errors.fecha && (
                <p className="text-sm text-destructive">{errors.fecha.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora_salida_estimada">Hora Salida Estimada</Label>
              <Input id="hora_salida_estimada" type="time" {...register('hora_salida_estimada')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehiculo_id" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Vehículo
              </Label>
              <select
                id="vehiculo_id"
                {...register('vehiculo_id')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccionar vehículo</option>
                {vehiculos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.patente} - {v.marca} {v.modelo}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chofer_id" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Chofer
              </Label>
              <select
                id="chofer_id"
                {...register('chofer_id')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccionar chofer</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="responsable_id">Responsable *</Label>
              <select
                id="responsable_id"
                {...register('responsable_id')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccionar responsable</option>
                {responsables.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              {errors.responsable_id && (
                <p className="text-sm text-destructive">{errors.responsable_id.message}</p>
              )}
              {responsables.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay empleados con rol "Responsable". Asigná el rol desde Usuarios.
                </p>
              )}
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea id="observaciones" {...register('observaciones')} placeholder="Notas adicionales..." />
            </div>
          </div>

          {/* Pedidos selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Pedidos Disponibles
              </Label>
              <span className="text-sm text-muted-foreground">
                {selectedPedidosIdsVisibles.length} seleccionados
              </span>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filtroZona}
                onChange={e => setFiltroZona(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Todas las zonas</option>
                {zonas.map(z => (
                  <option key={z.id} value={z.id}>{z.nombre}</option>
                ))}
              </select>
              <select
                value={filtroVendedor}
                onChange={e => setFiltroVendedor(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Todos los vendedores</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={filtroOrigen === 'sin_web' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroOrigen('sin_web')}
              >
                Reparto
              </Button>
              <Button
                type="button"
                variant={filtroOrigen === 'solo_web' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroOrigen('solo_web')}
                className={filtroOrigen === 'solo_web' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 border-red-300 hover:bg-red-50'}
              >
                🌐 Solo Web
              </Button>
              <Button
                type="button"
                variant={filtroOrigen === 'todos' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroOrigen('todos')}
              >
                Todos
              </Button>
            </div>

            {/* Botones imprimir remitos de seleccionados */}
            {selectedPedidosIdsVisibles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleImprimirRemitos(pedidosCortos)}
                  disabled={pedidosCortos.length === 0}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Remitos Cortos
                  {pedidosCortos.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pedidosCortos.length}</Badge>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleImprimirRemitos(pedidosLargos)}
                  disabled={pedidosLargos.length === 0}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Remitos Largos
                  {pedidosLargos.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pedidosLargos.length}</Badge>
                  )}
                </Button>
              </div>
            )}
            
            <div className="border rounded-md">
              {/* Select all header */}
              {pedidosFiltrados.length > 0 && (
                <div
                  className="p-2 border-b bg-muted/50 flex items-center gap-3 cursor-pointer hover:bg-muted"
                  onClick={toggleSelectAll}
                >
                  <input type="checkbox" checked={allFilteredSelected} readOnly className="h-4 w-4 rounded border-input accent-primary" />
                  <span className="text-sm font-medium">
                    Seleccionar todos ({pedidosFiltrados.length})
                  </span>
                </div>
              )}

              <div className="max-h-[200px] overflow-y-auto">
                {pedidosFiltrados.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No hay pedidos disponibles para asignar
                  </div>
                ) : (
                  <div className="divide-y">
                    {pedidosFiltrados.map((pedido: any) => {
                      const isSelected = selectedPedidos.includes(pedido.id);
                      return (
                        <div 
                          key={pedido.id}
                          className={`p-3 cursor-pointer transition-colors hover:bg-muted ${isSelected ? 'bg-primary/5' : ''}`}
                          onClick={() => togglePedido(pedido.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-sm">
                                  #{pedido.numero_pedido}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                  {pedido.estado}
                                </span>
                              </div>
                              <p className="text-sm truncate">
                                {pedido.cliente?.nombre}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">
                                ${pedido.total.toLocaleString('es-AR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            {selectedPedidosIdsVisibles.length > 0 && selectedPedidosIdsVisibles.some((id) => !remitosImpresos.has(id)) && (
              <p className="text-xs text-destructive mr-auto self-center">
                Imprimí los remitos antes de crear la hoja de ruta.
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                crearHojaRuta.isPending ||
                selectedPedidosIdsVisibles.length === 0 ||
                selectedPedidosIdsVisibles.some((id) => !remitosImpresos.has(id))
              }
            >
              {crearHojaRuta.isPending ? 'Creando...' : 'Crear Hoja de Ruta'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
