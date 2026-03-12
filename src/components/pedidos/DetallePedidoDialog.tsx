import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Package, 
  User, 
  Calendar, 
  Clock, 
  MapPin,
  Phone,
  FileText,
  AlertTriangle,
  CheckCircle,
  Truck,
  XCircle,
  RotateCcw
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  usePedido, 
  usePedidoHistorial, 
  type PedidoEstado 
} from '@/hooks/usePedidos';
import { CambiarEstadoDialog } from './CambiarEstadoDialog';

interface DetallePedidoDialogProps {
  pedidoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrepararPedido?: (pedidoId: string) => void;
  onEditarPedido?: (pedidoId: string) => void;
}

// Configuración visual de estados (incluye legacy para historial)
const estadoConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  preparado: { label: 'Preparado', color: 'bg-blue-100 text-blue-800', icon: Package },
  despachado: { label: 'Despachado', color: 'bg-green-100 text-green-800', icon: Truck },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle },
  // Legacy para visualización de historial
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  devuelto: { label: 'Devuelto', color: 'bg-red-100 text-red-800', icon: RotateCcw },
  anulado: { label: 'Anulado', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

// Nuevo flujo simplificado: 
// - pendiente -> preparado o rechazado
// - preparado -> rechazado (despachado solo se hace automáticamente desde logística)
// - despachado -> sin acciones desde pedidos (se gestiona en logística)
// - rechazado -> estado final
const flujoEstados: Record<string, PedidoEstado[]> = {
  pendiente: ['preparado', 'rechazado'],
  preparado: ['rechazado'],
  despachado: [],  // Solo se gestiona desde logística
  rechazado: [],
  // Legacy states - sin transiciones permitidas
  confirmado: [],
  entregado: [],
  parcial: [],
  devuelto: [],
  anulado: [],
};

export function DetallePedidoDialog({ pedidoId, open, onOpenChange, onPrepararPedido }: DetallePedidoDialogProps) {
  const [cambiarEstadoDialog, setCambiarEstadoDialog] = useState<PedidoEstado | null>(null);

  const { data: pedido, isLoading } = usePedido(pedidoId || undefined);
  const { data: historial } = usePedidoHistorial(pedidoId || undefined);

  if (!pedidoId) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const estadoActual = pedido?.estado as PedidoEstado;
  const siguientesEstados = flujoEstados[estadoActual] || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <span className="font-mono">Pedido #{pedido?.numero_pedido?.toString().padStart(6, '0')}</span>
                {pedido && (
                  <Badge className={`${estadoConfig[estadoActual]?.color} border-0`}>
                    {estadoConfig[estadoActual]?.label}
                  </Badge>
                )}
              </DialogTitle>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : pedido ? (
            <Tabs defaultValue="detalle" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="detalle">Detalle</TabsTrigger>
                <TabsTrigger value="productos">Productos ({pedido.detalles?.length || 0})</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <TabsContent value="detalle" className="m-0 p-4 space-y-4">
                  {/* Info del cliente */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Cliente
                      </h4>
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{pedido.cliente?.nombre}</p>
                        {pedido.cliente?.codigo_cliente && (
                          <p className="text-muted-foreground">Código: {pedido.cliente.codigo_cliente}</p>
                        )}
                        {pedido.cliente?.dni_cuit && (
                          <p className="text-muted-foreground">CUIT/DNI: {pedido.cliente.dni_cuit}</p>
                        )}
                        {pedido.cliente?.direccion && (
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {pedido.cliente.direccion}
                          </p>
                        )}
                        {pedido.cliente?.telefono && (
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {pedido.cliente.telefono}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Fechas
                      </h4>
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">Creado: </span>
                          {format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </p>
                        {pedido.fecha_entrega_estimada && (
                          <p>
                            <span className="text-muted-foreground">Entrega est.: </span>
                            {format(new Date(pedido.fecha_entrega_estimada), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        )}
                        {pedido.fecha_entrega_real && (
                          <p>
                            <span className="text-muted-foreground">Entrega real: </span>
                            {format(new Date(pedido.fecha_entrega_real), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </p>
                        )}
                        {pedido.vendedor && (
                          <p>
                            <span className="text-muted-foreground">Vendedor: </span>
                            [{pedido.vendedor.codigo}] {pedido.vendedor.nombre}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Totales */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Subtotal</p>
                        <p className="text-lg font-semibold">{formatCurrency(pedido.subtotal)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Descuento</p>
                        <p className="text-lg font-semibold">{formatCurrency(pedido.descuento || 0)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(pedido.total)}</p>
                      </div>
                    </div>
                  </div>

                  {pedido.observaciones && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4" />
                          Observaciones
                        </h4>
                        <p className="text-sm text-muted-foreground">{pedido.observaciones}</p>
                      </div>
                    </>
                  )}

                  {pedido.rendido && pedido.venta_id && (
                    <>
                      <Separator />
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Pedido rendido</span>
                        </div>
                        <p className="text-sm text-green-600 mt-1">
                          Venta generada el {format(new Date(pedido.fecha_rendicion!), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </p>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="productos" className="m-0 p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-center">Pedido</TableHead>
                        <TableHead className="text-center">Entregado</TableHead>
                        <TableHead className="text-center">Devuelto</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedido.detalles?.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono text-sm">
                            {d.producto?.codigo_articulo}
                          </TableCell>
                          <TableCell>{d.producto?.descripcion}</TableCell>
                          <TableCell className="text-center">{d.cantidad_pedida}</TableCell>
                          <TableCell className="text-center">
                            {d.cantidad_entregada > 0 ? d.cantidad_entregada : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {d.cantidad_devuelta > 0 ? (
                              <span className="text-destructive">{d.cantidad_devuelta}</span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(d.precio_unitario)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(d.subtotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="historial" className="m-0 p-4">
                  <div className="space-y-3">
                    {historial?.map(h => (
                      <div key={h.id} className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 w-32 text-muted-foreground">
                          {format(new Date(h.created_at), 'dd/MM HH:mm', { locale: es })}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {h.estado_anterior && (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  {estadoConfig[h.estado_anterior]?.label}
                                </Badge>
                                <span>→</span>
                              </>
                            )}
                            <Badge className={`${estadoConfig[h.estado_nuevo]?.color} border-0 text-xs`}>
                              {estadoConfig[h.estado_nuevo]?.label}
                            </Badge>
                          </div>
                          {h.observaciones && (
                            <p className="text-muted-foreground mt-1">{h.observaciones}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Por: {h.usuario?.nombre}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </ScrollArea>

              {/* Acciones */}
              {siguientesEstados.length > 0 && (
                <div className="border-t p-4">
                  <div className="flex flex-wrap gap-2">
                    {/* Botón editar preparación para pedidos ya preparados */}
                    {estadoActual === 'preparado' && onPrepararPedido && pedido && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPrepararPedido(pedido.id)}
                      >
                        <Package className="h-4 w-4 mr-1" />
                        Editar Preparación
                      </Button>
                    )}
                    {siguientesEstados.map(estado => {
                      if (estado === 'rechazado') {
                        return (
                          <Button
                            key={estado}
                            variant="destructive"
                            size="sm"
                            onClick={() => setCambiarEstadoDialog('rechazado')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rechazar
                          </Button>
                        );
                      }
                      if (estado === 'preparado') {
                        return (
                          <Button
                            key={estado}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (onPrepararPedido && pedido) {
                                onPrepararPedido(pedido.id);
                              }
                            }}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Preparar Pedido
                          </Button>
                        );
                      }
                      const config = estadoConfig[estado];
                      const Icon = config?.icon || Package;
                      return (
                        <Button
                          key={estado}
                          variant="outline"
                          size="sm"
                          onClick={() => setCambiarEstadoDialog(estado)}
                        >
                          <Icon className="h-4 w-4 mr-1" />
                          {config?.label || estado}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      {pedido && (
        <CambiarEstadoDialog
          pedidoId={pedido.id}
          estadoActual={estadoActual}
          nuevoEstado={cambiarEstadoDialog}
          open={!!cambiarEstadoDialog}
          onOpenChange={(open) => !open && setCambiarEstadoDialog(null)}
        />
      )}
    </>
  );
}
