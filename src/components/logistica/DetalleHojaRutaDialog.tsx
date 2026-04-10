import { useState } from 'react';
import { imprimirDevolucionesHojaRuta } from '@/lib/imprimirWorkflows';
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
  useCobrosHojaRuta,
  useDevolucionesHojaRuta,
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
  Loader2,
  DollarSign,
  FileCheck,
  Banknote,
  PackageX,
  Printer,
  RotateCcw
} from 'lucide-react';
import { RegistrarCobroDialog } from './RegistrarCobroDialog';
import { RendicionHojaRutaDialog } from './RendicionHojaRutaDialog';
import { RegistrarDevolucionDialog } from './RegistrarDevolucionDialog';
import { Badge } from '@/components/ui/badge';
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
  const { data: hojaRuta, isLoading, refetch } = useHojaRuta(hojaRutaId || undefined);
  const { data: cobros } = useCobrosHojaRuta(hojaRutaId || undefined);
  const { data: devoluciones } = useDevolucionesHojaRuta(hojaRutaId || undefined);
  const cambiarEstado = useCambiarEstadoHojaRuta();
  const actualizarParada = useActualizarEstadoParada();
  const eliminarParada = useEliminarParada();
  // Estados para diálogos de cobro, rendición y devoluciones
  const [cobroDialog, setCobroDialog] = useState<{
    open: boolean;
    paradaId: string;
    pedidoId: string;
    totalPedido: number;
    montoCobrado: number;
  }>({ open: false, paradaId: '', pedidoId: '', totalPedido: 0, montoCobrado: 0 });
  const [rendicionOpen, setRendicionOpen] = useState(false);
  const [devolucionDialog, setDevolucionDialog] = useState<{
    open: boolean;
    paradaId: string;
    pedidoDetalles: Array<{
      id: string;
      producto_id: string | null;
      cantidad_pedida: number;
      cantidad_entregada: number | null;
      producto?: { descripcion: string; codigo_articulo: string };
    }>;
  }>({ open: false, paradaId: '', pedidoDetalles: [] });

  // Calcular monto cobrado por pedido
  const getCobradoPorPedido = (pedidoId: string): number => {
    if (!cobros) return 0;
    return cobros
      .filter((c: any) => c.pedido?.numero_pedido && c.pedido)
      .filter((c: any) => {
        // Filtrar por pedido_id real, necesitamos agregarlo al query
        return true; // Por ahora retornar todos
      })
      .reduce((sum: number, c: any) => sum + (c.monto || 0), 0);
  };

  const getCobradoPorParada = (paradaId: string): number => {
    if (!cobros) return 0;
    return cobros
      .filter((c: any) => c.parada?.id === paradaId)
      .reduce((sum: number, c: any) => sum + (c.monto || 0), 0);
  };

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

  const imprimirListadoParadas = (hoja: any) => {
    const ventana = window.open('', '_blank', 'width=900,height=600');
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
      return;
    }

    const fechaHoja = format(new Date(hoja.fecha), 'dd/MM/yyyy', { locale: es });

    const formatNumero = (num: number) => {
      const pv = '00001';
      const nro = num.toString().padStart(8, '0');
      return `B ${pv}-${nro}`;
    };

    const formatCurrency = (v: number) =>
      new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

    const filasHTML = (hoja.paradas || []).map((parada: any, i: number) => {
      const pedido = parada.pedido;
      if (!pedido) return '';
      const cliente = pedido.cliente;
      const fechaRemito = format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy', { locale: es });
      const nroRemito = formatNumero(pedido.numero_pedido);
      const codCliente = cliente?.codigo_cliente || '-';
      const razonSocial = cliente?.nombre || '-';
      const vendedor = pedido.vendedor?.nombre || '-';
      const zona = cliente?.zona?.nombre || '-';
      const importe = formatCurrency(pedido.total || 0);

      return `
        <tr${i % 2 === 1 ? ' style="background:#f7f7f7;"' : ''}>
          <td style="padding:5px 6px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700; text-align:center;">${i + 1}</td>
          <td style="padding:5px 6px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700;">${fechaRemito}</td>
          <td style="padding:5px 6px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700; font-family:'Courier New',monospace;">${nroRemito}</td>
          <td style="padding:5px 6px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700; font-family:'Courier New',monospace;">${codCliente}</td>
          <td style="padding:5px 6px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700;">${razonSocial}</td>
          <td style="padding:5px 6px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700;">${vendedor}</td>
          <td style="padding:5px 6px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700;">${zona}</td>
          <td style="padding:5px 6px; border-bottom:1px solid #d0d0d0; font-size:12px; font-weight:800; text-align:right; font-family:'Courier New',monospace;">$ ${importe}</td>
        </tr>
      `;
    }).join('');

    const totalGeneral = (hoja.paradas || []).reduce((sum: number, p: any) => sum + (p.pedido?.total || 0), 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Listado Paradas - Ruta #${hoja.numero_hoja}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4 landscape; margin: 8mm; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            font-weight: 700;
            color: #1a1a1a;
            max-width: 1100px;
            margin: 0 auto;
            padding: 8px;
          }
          .container { border: 2px solid #222; border-radius: 3px; overflow: hidden; }
          .header {
            display: flex; align-items: center; justify-content: space-between;
            border-bottom: 2px solid #222; background: #f5f5f5; padding: 8px 12px;
          }
          .header-title { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
          .header-info { font-size: 12px; font-weight: 800; text-align: right; }
          .header-info span { display: block; }
          table { width: 100%; border-collapse: collapse; }
          thead th {
            background: #222; color: #fff; padding: 5px 6px; text-align: left;
            font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
          }
          thead th.right { text-align: right; }
          thead th.center { text-align: center; }
          .total-row {
            display: flex; justify-content: flex-end; align-items: center;
            border-top: 2px solid #222; background: #eee; padding: 8px 12px;
          }
          .total-row span:first-child { font-size: 14px; font-weight: 900; letter-spacing: 2px; }
          .total-row span:last-child {
            margin-left: 16px; font-size: 16px; font-weight: 900;
            font-family: 'Courier New', monospace;
          }
          .print-button {
            position: fixed; bottom: 20px; right: 20px; padding: 10px 20px;
            background: #2563eb; color: white; border: none; border-radius: 6px;
            cursor: pointer; font-size: 13px; font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          .print-button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-title">LISTADO DE PARADAS</div>
            <div class="header-info">
              <span>Hoja de Ruta #${hoja.numero_hoja}</span>
              <span>Fecha: ${fechaHoja}</span>
              <span>Chofer: ${hoja.chofer?.nombre || '-'} | Vehículo: ${hoja.vehiculo?.patente || '-'}</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th class="center" style="width:30px;">#</th>
                <th style="width:80px;">Fecha</th>
                <th style="width:140px;">Nº Remito</th>
                <th style="width:70px;">Cód. Cliente</th>
                <th>Razón Social</th>
                <th style="width:110px;">Vendedor</th>
                <th style="width:90px;">Zona</th>
                <th class="right" style="width:100px;">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${filasHTML}
            </tbody>
          </table>
          <div class="total-row">
            <span>TOTAL:</span>
            <span>$ ${formatCurrency(totalGeneral)}</span>
          </div>
        </div>
        <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
      </body>
      </html>
    `;

    ventana.document.write(html);
    ventana.document.close();
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Paradas ({hojaRuta.paradas?.length || 0})
                </h3>
                {hojaRuta.paradas && hojaRuta.paradas.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => imprimirListadoParadas(hojaRuta)}
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir Listado
                  </Button>
                )}
              </div>
              
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
                              <div className="flex flex-wrap gap-2 pt-2">
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

                            {/* Botones de cobro y devolución - visible cuando está en ruta o entregado */}
                            {(hojaRuta.estado === 'en_ruta' || hojaRuta.estado === 'completada') && 
                             ['entregado', 'entrega_parcial', 'rechazado'].includes(parada.estado) && parada.pedido && (
                              <div className="pt-2 flex flex-wrap items-center gap-2">
                                {getCobradoPorParada(parada.id) > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Banknote className="h-3 w-3 mr-1" />
                                    Cobrado: ${getCobradoPorParada(parada.id).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </Badge>
                                )}
                                
                                {/* Botón Cobrar */}
                                {['entregado', 'entrega_parcial'].includes(parada.estado) && (
                                  <Button
                                    size="sm"
                                    variant={getCobradoPorParada(parada.id) >= parada.pedido.total ? "outline" : "default"}
                                    onClick={() => setCobroDialog({
                                      open: true,
                                      paradaId: parada.id,
                                      pedidoId: parada.pedido!.id,
                                      totalPedido: parada.pedido!.total,
                                      montoCobrado: getCobradoPorParada(parada.id),
                                    })}
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    {getCobradoPorParada(parada.id) > 0 ? 'Agregar Cobro' : 'Cobrar'}
                                  </Button>
                                )}

                                {/* Botón Devoluciones */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDevolucionDialog({
                                    open: true,
                                    paradaId: parada.id,
                                    pedidoDetalles: parada.pedido?.detalles || [],
                                  })}
                                >
                                  <PackageX className="h-4 w-4 mr-1" />
                                  Devoluciones
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

            {/* Sección de Devoluciones Registradas */}
            {devoluciones && devoluciones.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                    Devoluciones Registradas ({devoluciones.length})
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => imprimirDevolucionesHojaRuta(hojaRuta, devoluciones)}
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir
                  </Button>
                </div>
                
                <div className="border border-amber-200 rounded-lg divide-y bg-amber-50/50 max-h-[200px] overflow-y-auto">
                  {devoluciones.map((devolucion: any) => (
                    <div key={devolucion.id} className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {devolucion.pedido_detalle?.producto?.descripcion || 'Producto'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {devolucion.cantidad} un.
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="capitalize">
                          {devolucion.motivo?.replace(/_/g, ' ') || 'Sin motivo'}
                        </span>
                        <span>
                          {format(new Date(devolucion.created_at), 'dd/MM HH:mm', { locale: es })}
                        </span>
                      </div>
                      {devolucion.detalle_motivo && (
                        <p className="text-xs text-muted-foreground italic">
                          {devolucion.detalle_motivo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sección de Cobros Registrados */}
            {cobros && cobros.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  Cobros Registrados ({cobros.length})
                </h3>
                
                <div className="border border-green-200 rounded-lg divide-y bg-green-50/50 max-h-[200px] overflow-y-auto">
                  {cobros.map((cobro: any) => (
                    <div key={cobro.id} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">
                          ${cobro.monto?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {cobro.forma_pago?.nombre || cobro.medio_pago || 'Efectivo'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(cobro.created_at), 'dd/MM HH:mm', { locale: es })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón de Rendición - visible cuando la ruta está en curso o completada */}
            {(hojaRuta.estado === 'en_ruta' || hojaRuta.estado === 'completada') && (
              <div className="pt-4 border-t">
                <Button 
                  className="w-full"
                  onClick={() => setRendicionOpen(true)}
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Rendición de Cobranza
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>

      {/* Diálogo de Cobro */}
      <RegistrarCobroDialog
        open={cobroDialog.open}
        onOpenChange={(open) => setCobroDialog({ ...cobroDialog, open })}
        hojaRutaId={hojaRutaId}
        paradaId={cobroDialog.paradaId}
        pedidoId={cobroDialog.pedidoId}
        totalPedido={cobroDialog.totalPedido}
        montoCobrado={cobroDialog.montoCobrado}
        onSuccess={() => refetch()}
      />

      {/* Diálogo de Rendición */}
      {hojaRuta && (
        <RendicionHojaRutaDialog
          open={rendicionOpen}
          onOpenChange={setRendicionOpen}
          hojaRutaId={hojaRutaId}
          numeroHoja={hojaRuta.numero_hoja}
          onSuccess={() => refetch()}
        />
      )}

      {/* Diálogo de Devoluciones */}
      {hojaRutaId && (
        <RegistrarDevolucionDialog
          open={devolucionDialog.open}
          onOpenChange={(open) => setDevolucionDialog({ ...devolucionDialog, open })}
          hojaRutaId={hojaRutaId}
          paradaId={devolucionDialog.paradaId}
          pedidoDetalles={devolucionDialog.pedidoDetalles}
          onSuccess={() => refetch()}
        />
      )}
    </Sheet>
  );
}
