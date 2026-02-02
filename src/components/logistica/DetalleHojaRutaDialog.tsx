import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { 
  useHojaRuta,
  useCambiarEstadoHojaRuta,
  useActualizarEstadoParada,
  useEliminarParada,
  type HojaRutaEstado,
  type ParadaEstado
} from '@/hooks/useLogistica';
import { 
  Truck, 
  User, 
  Calendar, 
  Clock, 
  MapPin,
  Play,
  CheckCircle,
  XCircle,
  Package,
  Phone,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const estadoHojaConfig: Record<HojaRutaEstado, { label: string; className: string }> = {
  planificada: { label: 'Planificada', className: 'bg-muted text-muted-foreground' },
  en_carga: { label: 'En Carga', className: 'bg-amber-100 text-amber-800' },
  en_ruta: { label: 'En Ruta', className: 'bg-blue-100 text-blue-800' },
  completada: { label: 'Completada', className: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
};

const estadoParadaConfig: Record<ParadaEstado, { label: string; className: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', className: 'text-muted-foreground', icon: Clock },
  en_camino: { label: 'En Camino', className: 'text-blue-600', icon: Truck },
  entregado: { label: 'Entregado', className: 'text-green-600', icon: CheckCircle },
  entrega_parcial: { label: 'Parcial', className: 'text-amber-600', icon: AlertTriangle },
  rechazado: { label: 'Rechazado', className: 'text-destructive', icon: XCircle },
  no_entregado: { label: 'No Entregado', className: 'text-destructive', icon: XCircle },
};

interface DetalleHojaRutaDialogProps {
  hojaRutaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetalleHojaRutaDialog({ hojaRutaId, open, onOpenChange }: DetalleHojaRutaDialogProps) {
  const { data: hojaRuta, isLoading } = useHojaRuta(hojaRutaId || undefined);
  const cambiarEstado = useCambiarEstadoHojaRuta();
  const actualizarParada = useActualizarEstadoParada();
  const eliminarParada = useEliminarParada();

  if (!hojaRutaId) return null;

  const getNextEstado = (current: HojaRutaEstado): HojaRutaEstado | null => {
    switch (current) {
      case 'planificada': return 'en_carga';
      case 'en_carga': return 'en_ruta';
      case 'en_ruta': return 'completada';
      default: return null;
    }
  };

  const handleCambiarEstadoHoja = async () => {
    if (!hojaRuta) return;
    const nextEstado = getNextEstado(hojaRuta.estado);
    if (nextEstado) {
      await cambiarEstado.mutateAsync({ id: hojaRuta.id, estado: nextEstado });
    }
  };

  const handleEstadoParada = async (paradaId: string, estado: ParadaEstado) => {
    await actualizarParada.mutateAsync({ id: paradaId, estado });
  };

  const handleEliminarParada = async (paradaId: string) => {
    if (confirm('¿Eliminar esta parada de la hoja de ruta?')) {
      await eliminarParada.mutateAsync(paradaId);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Hoja de Ruta #{hojaRuta?.numero_hoja || '...'}
          </SheetTitle>
          <SheetDescription>
            Detalle y gestión de entregas
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : hojaRuta ? (
          <div className="space-y-6 mt-6">
            {/* Estado badge */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoHojaConfig[hojaRuta.estado].className}`}>
                {estadoHojaConfig[hojaRuta.estado].label}
              </span>
              
              {hojaRuta.estado !== 'completada' && hojaRuta.estado !== 'cancelada' && (
                <Button 
                  size="sm"
                  onClick={handleCambiarEstadoHoja}
                  disabled={cambiarEstado.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {hojaRuta.estado === 'planificada' && 'Iniciar Carga'}
                  {hojaRuta.estado === 'en_carga' && 'Iniciar Ruta'}
                  {hojaRuta.estado === 'en_ruta' && 'Completar'}
                </Button>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {format(new Date(hojaRuta.fecha), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Vehículo</p>
                  <p className="font-medium">{hojaRuta.vehiculo?.patente || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Chofer</p>
                  <p className="font-medium">{hojaRuta.chofer?.nombre || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Salida Est.</p>
                  <p className="font-medium">{hojaRuta.hora_salida_estimada || '-'}</p>
                </div>
              </div>
            </div>

            {/* Paradas */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Paradas ({hojaRuta.paradas?.length || 0})
              </h3>
              
              <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                {!hojaRuta.paradas || hojaRuta.paradas.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No hay paradas asignadas
                  </div>
                ) : (
                  hojaRuta.paradas.map((parada, index) => {
                    const estadoConfig = estadoParadaConfig[parada.estado];
                    const IconEstado = estadoConfig.icon;
                    
                    return (
                      <div key={parada.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">
                            {index + 1}
                          </span>
                          
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold">
                                #{parada.pedido?.numero_pedido}
                              </span>
                              <IconEstado className={`h-4 w-4 ${estadoConfig.className}`} />
                              <span className={`text-sm ${estadoConfig.className}`}>
                                {estadoConfig.label}
                              </span>
                            </div>
                            
                            <p className="font-medium">
                              {parada.pedido?.cliente?.nombre}
                            </p>
                            
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {parada.pedido?.cliente?.direccion && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {parada.pedido.cliente.direccion}
                                </span>
                              )}
                              {parada.pedido?.cliente?.telefono && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {parada.pedido.cliente.telefono}
                                </span>
                              )}
                            </div>

                            {/* Actions for parada */}
                            {hojaRuta.estado === 'en_ruta' && parada.estado === 'pendiente' && (
                              <div className="flex gap-2 pt-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleEstadoParada(parada.id, 'entregado')}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Entregado
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleEstadoParada(parada.id, 'entrega_parcial')}
                                >
                                  <AlertTriangle className="h-4 w-4 mr-1" />
                                  Parcial
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleEstadoParada(parada.id, 'rechazado')}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Rechazado
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-semibold">
                              ${parada.pedido?.total?.toLocaleString('es-AR')}
                            </p>
                            {hojaRuta.estado === 'planificada' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive mt-2"
                                onClick={() => handleEliminarParada(parada.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
