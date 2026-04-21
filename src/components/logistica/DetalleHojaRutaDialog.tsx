import { useState } from 'react';
import { imprimirDevolucionesHojaRuta } from '@/lib/imprimirWorkflows';
import { Button } from '@/components/ui/button';
import { 
  useHojaRuta,
  useCambiarEstadoHojaRuta,
  useActualizarEstadoParada,
  useEliminarParada,
  useCobrosHojaRuta,
  useDevolucionesHojaRuta,
  useRendicionHojaRuta,
  useHojaCarga,
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
  RotateCcw,
  X
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
  const { data: rendicionExistente } = useRendicionHojaRuta(hojaRutaId || undefined);
  const { data: productosCarga = [] } = useHojaCarga(hojaRutaId || undefined);
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
        return true;
      })
      .reduce((sum: number, c: any) => sum + (c.monto || 0), 0);
  };

  const getCobradoPorParada = (paradaId: string): number => {
    if (!cobros) return 0;
    return cobros
      .filter((c: any) => c.parada?.id === paradaId)
      .reduce((sum: number, c: any) => sum + (c.monto || 0), 0);
  };

  // Calcular monto de devoluciones por parada
  const getDevolucionesPorParada = (paradaId: string): number => {
    if (!devoluciones) return 0;
    return devoluciones
      .filter((d: any) => d.parada_id === paradaId || d.parada?.id === paradaId)
      .reduce((sum: number, d: any) => {
        const precio = d.pedido_detalle?.precio_unitario || 0;
        const descuento = d.pedido_detalle?.descuento_porcentaje || 0;
        const precioNeto = precio * (1 - descuento / 100);
        return sum + (d.cantidad * precioNeto);
      }, 0);
  };

  // Total neto del pedido (total - devoluciones)
  const getTotalNeto = (paradaId: string, totalPedido: number): number => {
    return totalPedido - getDevolucionesPorParada(paradaId);
  };

  // Total neto considerando el estado de la parada:
  // - Si está rechazado, el total esperado es 0 (no se cobra nada)
  // - Si está entregado/parcial, se descuentan las devoluciones registradas
  const getTotalEsperadoParada = (paradaId: string, paradaEstado: string, totalPedido: number): number => {
    if (paradaEstado === 'rechazado' || paradaEstado === 'no_entregado') return 0;
    return getTotalNeto(paradaId, totalPedido);
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

    const paradas = (hoja.paradas || []).filter((p: any) => p.pedido);
    const FILAS_POR_PAGINA = 50;

    const generarFilas = (items: any[], startIndex: number) => items.map((parada: any, i: number) => {
      const pedido = parada.pedido;
      const cliente = pedido.cliente;
      const idx = startIndex + i;
      const fechaRemito = format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy', { locale: es });
      const nroRemito = formatNumero(pedido.numero_pedido);
      const codCliente = cliente?.codigo_cliente || '-';
      const razonSocial = cliente?.nombre || '-';
      const vendedor = pedido.vendedor?.nombre || '-';
      const zona = cliente?.zona?.nombre || '-';
      const importe = formatCurrency(pedido.total || 0);

      return `
        <tr${idx % 2 === 1 ? ' style="background:#f7f7f7;"' : ''}>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700; text-align:center;">${idx + 1}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700;">${fechaRemito}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700; font-family:'Courier New',monospace;">${nroRemito}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700; font-family:'Courier New',monospace;">${codCliente}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700;">${razonSocial}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700;">${vendedor}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:700;">${zona}</td>
          <td style="padding:3px 4px; border-bottom:1px solid #d0d0d0; font-size:10px; font-weight:800; text-align:right; font-family:'Courier New',monospace;">$ ${importe}</td>
        </tr>
      `;
    }).join('');

    const totalGeneral = paradas.reduce((sum: number, p: any) => sum + (p.pedido?.total || 0), 0);

    // Dividir en páginas de 50 filas
    const paginas: any[][] = [];
    for (let i = 0; i < paradas.length; i += FILAS_POR_PAGINA) {
      paginas.push(paradas.slice(i, i + FILAS_POR_PAGINA));
    }

    const theadHTML = `
      <thead>
        <tr>
          <th class="center" style="width:25px;">#</th>
          <th style="width:70px;">Fecha</th>
          <th style="width:120px;">Nº Remito</th>
          <th style="width:60px;">Cód. Cli.</th>
          <th>Razón Social</th>
          <th style="width:100px;">Vendedor</th>
          <th style="width:80px;">Zona</th>
          <th class="right" style="width:90px;">Importe</th>
        </tr>
      </thead>`;

    const headerHTML = `
      <div class="header">
        <div class="header-title">LISTADO DE PARADAS</div>
        <div class="header-info">
          <span>Hoja de Ruta #${hoja.numero_hoja}</span>
          <span>Fecha: ${fechaHoja}</span>
          <span>Chofer: ${hoja.chofer?.nombre || '-'} | Vehículo: ${hoja.vehiculo?.patente || '-'}</span>
        </div>
      </div>`;

    const paginasHTML = paginas.map((pagina, pIdx) => {
      const isLast = pIdx === paginas.length - 1;
      return `
        <div class="page-container${!isLast ? ' page-break' : ''}">
          <div class="container">
            ${headerHTML}
            ${paginas.length > 1 ? `<div style="text-align:right;padding:2px 8px;font-size:9px;color:#666;">Página ${pIdx + 1} de ${paginas.length}</div>` : ''}
            <table>
              ${theadHTML}
              <tbody>
                ${generarFilas(pagina, pIdx * FILAS_POR_PAGINA)}
              </tbody>
            </table>
            ${isLast ? `
              <div class="total-row">
                <span>TOTAL:</span>
                <span>$ ${formatCurrency(totalGeneral)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Listado Paradas - Ruta #${hoja.numero_hoja}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4 portrait; margin: 8mm; }
            .page-break { page-break-after: always; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            font-size: 11px;
            font-weight: 700;
            color: #1a1a1a;
            max-width: 800px;
            margin: 0 auto;
            padding: 8px;
          }
          .page-container { margin-bottom: 16px; }
          .container { border: 2px solid #222; border-radius: 3px; overflow: hidden; }
          .header {
            display: flex; align-items: center; justify-content: space-between;
            border-bottom: 2px solid #222; background: #f5f5f5; padding: 6px 10px;
          }
          .header-title { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
          .header-info { font-size: 11px; font-weight: 800; text-align: right; }
          .header-info span { display: block; }
          table { width: 100%; border-collapse: collapse; }
          thead th {
            background: #222; color: #fff; padding: 3px 4px; text-align: left;
            font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
          }
          thead th.right { text-align: right; }
          thead th.center { text-align: center; }
          .total-row {
            display: flex; justify-content: flex-end; align-items: center;
            border-top: 2px solid #222; background: #eee; padding: 6px 10px;
          }
          .total-row span:first-child { font-size: 13px; font-weight: 900; letter-spacing: 2px; }
          .total-row span:last-child {
            margin-left: 16px; font-size: 14px; font-weight: 900;
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
        ${paginasHTML}
        <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
      </body>
      </html>
    `;

    ventana.document.write(html);
    ventana.document.close();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Hoja de Ruta #{hojaRuta?.numero_hoja || '...'}
              </h2>
              <p className="text-sm text-muted-foreground">Detalle y gestión de entregas</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Cerrar">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="w-full px-6 py-6">

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
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

            {/* Hoja de Carga - visible en planificada/en_carga */}
            {(hojaRuta.estado === 'planificada' || hojaRuta.estado === 'en_carga') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Hoja de Carga ({productosCarga.length} productos)
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {hojaRuta.paradas?.length || 0} paradas asignadas
                  </Badge>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Código</th>
                        <th className="px-3 py-2 text-left font-medium">Descripción</th>
                        <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y max-h-[400px]">
                      {productosCarga.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                            No hay productos para cargar
                          </td>
                        </tr>
                      ) : (
                        productosCarga.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 font-mono text-xs">{p.codigo}</td>
                            <td className="px-3 py-2">{p.descripcion}</td>
                            <td className="px-3 py-2 text-right font-semibold">{p.cantidad_total}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Los pedidos individuales estarán disponibles para gestionar cuando se inicie la ruta.
                </p>
              </div>
            )}

            {/* Paradas - visible solo cuando la ruta está en curso o terminada */}
            {(hojaRuta.estado === 'en_ruta' || hojaRuta.estado === 'completada' || hojaRuta.estado === 'cancelada') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3 lg:col-span-2">
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
                             ['entregado', 'entrega_parcial', 'rechazado'].includes(parada.estado) && parada.pedido && (() => {
                              const totalNeto = getTotalEsperadoParada(parada.id, parada.estado, parada.pedido!.total);
                              const cobrado = getCobradoPorParada(parada.id);
                              const pedidoCobradoCompleto = cobrado >= totalNeto && totalNeto > 0;
                              
                              return (
                              <div className="pt-2 flex flex-wrap items-center gap-2">
                                {cobrado > 0 && (
                                  <Badge variant={pedidoCobradoCompleto ? "default" : "secondary"} className={`text-xs ${pedidoCobradoCompleto ? 'bg-green-600' : ''}`}>
                                    <Banknote className="h-3 w-3 mr-1" />
                                    {pedidoCobradoCompleto ? 'Cobrado ✓' : `Cobrado: $${cobrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                  </Badge>
                                )}
                                
                                {/* Botón Cobrar - oculto si ya está cobrado completo */}
                                {!pedidoCobradoCompleto && ['entregado', 'entrega_parcial'].includes(parada.estado) && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => setCobroDialog({
                                      open: true,
                                      paradaId: parada.id,
                                      pedidoId: parada.pedido!.id,
                                      totalPedido: totalNeto,
                                      montoCobrado: cobrado,
                                    })}
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    {cobrado > 0 ? 'Agregar Cobro' : 'Cobrar'}
                                  </Button>
                                )}

                                {/* Botón Devoluciones - oculto si ya está cobrado completo */}
                                {!pedidoCobradoCompleto && (
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
                                )}
                              </div>
                              );
                            })()}
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-semibold">
                              ${parada.pedido?.total?.toLocaleString('es-AR')}
                            </p>
                            {parada.estado === 'rechazado' && parada.pedido && (
                              <div className="mt-1">
                                <p className="text-xs text-destructive line-through">
                                  ${parada.pedido.total?.toLocaleString('es-AR')}
                                </p>
                                <p className="text-sm font-bold text-destructive">
                                  $0,00
                                </p>
                                <p className="text-xs text-destructive">
                                  Pedido rechazado
                                </p>
                              </div>
                            )}
                            {parada.estado !== 'rechazado' && getDevolucionesPorParada(parada.id) > 0 && (
                              <div className="mt-1">
                                <p className="text-xs text-destructive line-through">
                                  ${parada.pedido?.total?.toLocaleString('es-AR')}
                                </p>
                                <p className="text-sm font-bold text-primary">
                                  ${getTotalNeto(parada.id, parada.pedido?.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-amber-600">
                                  -${getDevolucionesPorParada(parada.id).toLocaleString('es-AR', { minimumFractionDigits: 2 })} dev.
                                </p>
                              </div>
                            )}
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
            )}

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
                  {devoluciones.map((devolucion: any) => {
                    const precio = devolucion.pedido_detalle?.precio_unitario || 0;
                    const descuento = devolucion.pedido_detalle?.descuento_porcentaje || 0;
                    const precioNeto = precio * (1 - descuento / 100);
                    const valorDevolucion = devolucion.cantidad * precioNeto;
                    
                    return (
                      <div key={devolucion.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {devolucion.pedido_detalle?.producto?.descripcion || 'Producto'}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {devolucion.cantidad} un.
                            </Badge>
                            {valorDevolucion > 0 && (
                              <span className="text-sm font-semibold text-destructive">
                                -${valorDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
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
                    );
                  })}
                </div>
                
                {/* Total devoluciones */}
                <div className="flex justify-end px-3">
                  <span className="text-sm font-bold text-destructive">
                    {'Total devoluciones: -$'}
                    {devoluciones.reduce((sum: number, d: any) => {
                      const precio = d.pedido_detalle?.precio_unitario || 0;
                      const descuento = d.pedido_detalle?.descuento_porcentaje || 0;
                      return sum + (d.cantidad * precio * (1 - descuento / 100));
                    }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
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
                {rendicionExistente ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-600">Rendición registrada</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setRendicionOpen(true)}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Ver / Imprimir Rendición
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full"
                    onClick={() => setRendicionOpen(true)}
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    Rendición de Cobranza
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : null}
          </div>
        </div>
      )}

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
    </>
  );
}
