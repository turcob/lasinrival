import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Skeleton } from '@/components/ui/skeleton';
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
  GripVertical,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const estadoHojaConfig: Record<HojaRutaEstado, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planificada: { label: 'Planificada', variant: 'secondary' },
  en_carga: { label: 'En Carga', variant: 'outline' },
  en_ruta: { label: 'En Ruta', variant: 'default' },
  completada: { label: 'Completada', variant: 'secondary' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

const estadoParadaConfig: Record<ParadaEstado, { label: string; color: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'text-muted-foreground', icon: Clock },
  en_camino: { label: 'En Camino', color: 'text-blue-600', icon: Truck },
  entregado: { label: 'Entregado', color: 'text-green-600', icon: CheckCircle },
  entrega_parcial: { label: 'Parcial', color: 'text-amber-600', icon: AlertTriangle },
  rechazado: { label: 'Rechazado', color: 'text-destructive', icon: XCircle },
  no_entregado: { label: 'No Entregado', color: 'text-destructive', icon: XCircle },
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

  const [paradaAccion, setParadaAccion] = useState<string | null>(null);

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
    setParadaAccion(null);
  };

  const handleEliminarParada = async (paradaId: string) => {
    if (confirm('¿Eliminar esta parada de la hoja de ruta?')) {
      await eliminarParada.mutateAsync(paradaId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Hoja de Ruta #{hojaRuta?.numero_hoja || '...'}
            </span>
            {hojaRuta && (
              <Badge variant={estadoHojaConfig[hojaRuta.estado].variant}>
                {estadoHojaConfig[hojaRuta.estado].label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : hojaRuta ? (
          <div className="space-y-4">
            {/* Info header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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

            {/* Action buttons */}
            {hojaRuta.estado !== 'completada' && hojaRuta.estado !== 'cancelada' && (
              <div className="flex gap-2 mb-4">
                <Button 
                  onClick={handleCambiarEstadoHoja}
                  disabled={cambiarEstado.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {hojaRuta.estado === 'planificada' && 'Iniciar Carga'}
                  {hojaRuta.estado === 'en_carga' && 'Iniciar Ruta'}
                  {hojaRuta.estado === 'en_ruta' && 'Completar'}
                </Button>
              </div>
            )}

            {/* Paradas */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Paradas ({hojaRuta.paradas?.length || 0})
              </h3>
              
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                {!hojaRuta.paradas || hojaRuta.paradas.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No hay paradas asignadas
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {hojaRuta.paradas.map((parada, index) => {
                      const estadoConfig = estadoParadaConfig[parada.estado];
                      const IconEstado = estadoConfig.icon;
                      
                      return (
                        <Card key={parada.id} className="relative">
                          <CardHeader className="p-3 pb-2">
                            <div className="flex items-start gap-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                                  {index + 1}
                                </span>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono font-semibold">
                                    #{parada.pedido?.numero_pedido}
                                  </span>
                                  <IconEstado className={`h-4 w-4 ${estadoConfig.color}`} />
                                  <span className={`text-sm ${estadoConfig.color}`}>
                                    {estadoConfig.label}
                                  </span>
                                </div>
                                <CardTitle className="text-base truncate">
                                  {parada.pedido?.cliente?.nombre}
                                </CardTitle>
                              </div>

                              <div className="text-right">
                                <p className="font-semibold">
                                  ${parada.pedido?.total?.toLocaleString('es-AR')}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="p-3 pt-0">
                            <div className="flex items-start gap-4 text-sm text-muted-foreground">
                              {parada.pedido?.cliente?.direccion && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate max-w-[200px]">
                                    {parada.pedido.cliente.direccion}
                                  </span>
                                </div>
                              )}
                              {parada.pedido?.cliente?.telefono && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <span>{parada.pedido.cliente.telefono}</span>
                                </div>
                              )}
                              {parada.ventana_horaria_desde && parada.ventana_horaria_hasta && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {parada.ventana_horaria_desde} - {parada.ventana_horaria_hasta}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Actions for parada */}
                            {hojaRuta.estado === 'en_ruta' && parada.estado === 'pendiente' && (
                              <div className="flex gap-2 mt-3">
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

                            {hojaRuta.estado === 'planificada' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2 text-destructive"
                                onClick={() => handleEliminarParada(parada.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
