import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';
import { Eye, XCircle, FileText, Download, Printer, Users, Calendar, Banknote, CreditCard, Landmark } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

interface ComprobanteAfip {
  id: string;
  tipo_comprobante: number;
  punto_venta: number;
  numero_comprobante: number;
  cae: string;
  cae_vencimiento: string;
  importe_total: number;
  importe_neto: number;
  importe_iva: number;
  doc_tipo: number;
  doc_nro: number;
  fecha_emision: string;
}

interface Venta {
  id: string;
  numero_comprobante: number;
  fecha: string;
  subtotal: number;
  descuento: number;
  total: number;
  anulada: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  usuario_id: string;
  cliente_id: string | null;
  caja_id: string | null;
  clientes?: { nombre: string; dni_cuit: string | null; condicion_iva?: number } | null;
  profiles?: { nombre: string } | null;
  comprobantes_afip?: ComprobanteAfip[] | null;
}

interface VentaDetalle {
  id: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  productos?: { codigo_articulo: string; descripcion: string } | null;
}

interface VentaPago {
  id: string;
  monto: number;
  formas_pago?: { nombre: string } | null;
}

const CONDICIONES_IVA: Record<number, string> = {
  1: "IVA Responsable Inscripto",
  4: "IVA Sujeto Exento",
  5: "Consumidor Final",
  6: "Responsable Monotributo",
};

const TIPOS_COMPROBANTE: Record<number, string> = {
  1: "A",
  6: "B",
  11: "C",
  3: "NCA",
  8: "NCB",
  13: "NCC",
};

export default function Ventas() {
  const { user, hasPermission, hasRole } = useAuth();
  const { config: comercioConfig, formatCuit } = useConfiguracionComercio();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [pagosPorVenta, setPagosPorVenta] = useState<Record<string, VentaPago[]>>({});
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false);
  const [anularDialogOpen, setAnularDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [detalles, setDetalles] = useState<VentaDetalle[]>([]);
  const [pagos, setPagos] = useState<VentaPago[]>([]);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  
  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState<string>('todos');
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);

  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<ComprobanteAfip | null>(null);

  const canAnular = hasPermission('ventas', 'anular');
  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchVentas(isAdmin);
    if (isAdmin) {
      fetchUsuarios();
    }
  }, [isAdmin]);

  const fetchUsuarios = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre')
      .eq('estado', true)
      .order('nombre');
    setUsuarios(data || []);
  };

  const fetchVentas = async (adminAccess: boolean) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          clientes(nombre, dni_cuit, condicion_iva),
          comprobantes_afip(*)
        `)
        .order('fecha', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles for each venta if admin
      if (adminAccess && data && data.length > 0) {
        const userIds = [...new Set(data.map(v => v.usuario_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nombre')
          .in('id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const ventasWithProfiles = data.map(v => ({
          ...v,
          profiles: profilesMap.get(v.usuario_id) || null
        }));
        setVentas(ventasWithProfiles);
      } else {
        setVentas(data || []);
      }

      // Fetch all payments for these sales
      if (data && data.length > 0) {
        const ventaIds = data.map(v => v.id);
        const { data: pagosData } = await supabase
          .from('venta_pagos')
          .select('*, formas_pago(nombre)')
          .in('venta_id', ventaIds);

        if (pagosData) {
          const pagosByVenta: Record<string, VentaPago[]> = {};
          pagosData.forEach(pago => {
            if (!pagosByVenta[pago.venta_id]) {
              pagosByVenta[pago.venta_id] = [];
            }
            pagosByVenta[pago.venta_id].push(pago);
          });
          setPagosPorVenta(pagosByVenta);
        }
      }
    } catch (error) {
      console.error('Error fetching ventas:', error);
      toast.error('Error al cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar ventas según filtros aplicados
  const ventasFiltradas = useMemo(() => {
    return ventas.filter(v => {
      // Filtro por usuario
      if (filtroUsuario !== 'todos' && v.usuario_id !== filtroUsuario) {
        return false;
      }
      
      // Filtro por fecha
      if (fechaDesde || fechaHasta) {
        const ventaFecha = new Date(v.fecha);
        if (fechaDesde && ventaFecha < startOfDay(fechaDesde)) {
          return false;
        }
        if (fechaHasta && ventaFecha > endOfDay(fechaHasta)) {
          return false;
        }
      }
      
      return true;
    });
  }, [ventas, filtroUsuario, fechaDesde, fechaHasta]);

  // Calcular totales por medio de pago
  const totalesPorMedioPago = useMemo(() => {
    const totales: Record<string, number> = {};
    let totalGeneral = 0;
    
    ventasFiltradas.forEach(venta => {
      if (!venta.anulada) {
        totalGeneral += venta.total;
        const pagosVenta = pagosPorVenta[venta.id] || [];
        pagosVenta.forEach(pago => {
          const nombreMedio = pago.formas_pago?.nombre || 'Otro';
          totales[nombreMedio] = (totales[nombreMedio] || 0) + pago.monto;
        });
      }
    });
    
    return { totales, totalGeneral };
  }, [ventasFiltradas, pagosPorVenta]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getMedioPagoIcon = (nombre: string) => {
    const lower = nombre.toLowerCase();
    if (lower.includes('efectivo')) return <Banknote className="h-4 w-4" />;
    if (lower.includes('transfer')) return <Landmark className="h-4 w-4" />;
    if (lower.includes('tarjeta') || lower.includes('debito') || lower.includes('credito')) return <CreditCard className="h-4 w-4" />;
    return <Banknote className="h-4 w-4" />;
  };

  const openDetalleDialog = async (venta: Venta) => {
    setSelectedVenta(venta);
    
    try {
      const [detallesRes, pagosRes] = await Promise.all([
        supabase
          .from('venta_detalles')
          .select('*, productos(codigo_articulo, descripcion)')
          .eq('venta_id', venta.id),
        supabase
          .from('venta_pagos')
          .select('*, formas_pago(nombre)')
          .eq('venta_id', venta.id),
      ]);

      if (detallesRes.data) setDetalles(detallesRes.data);
      if (pagosRes.data) setPagos(pagosRes.data);
      setDetalleDialogOpen(true);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Error al cargar el detalle');
    }
  };

  const handleAnular = async () => {
    if (!selectedVenta || !user) return;

    if (!motivoAnulacion.trim()) {
      toast.error('Debe ingresar un motivo de anulación');
      return;
    }

    try {
      const { error } = await supabase
        .from('ventas')
        .update({
          anulada: true,
          motivo_anulacion: motivoAnulacion,
          fecha_anulacion: new Date().toISOString(),
          anulada_por: user.id,
        })
        .eq('id', selectedVenta.id);

      if (error) throw error;

      // Restore stock for each product
      const { data: detallesData } = await supabase
        .from('venta_detalles')
        .select('producto_id, cantidad')
        .eq('venta_id', selectedVenta.id);

      if (detallesData) {
        for (const detalle of detallesData) {
          const { data: producto } = await supabase
            .from('productos')
            .select('stock_actual')
            .eq('id', detalle.producto_id)
            .single();

          if (producto) {
            await supabase
              .from('productos')
              .update({ stock_actual: producto.stock_actual + detalle.cantidad })
              .eq('id', detalle.producto_id);

            // Register inventory movement
            await supabase.from('movimientos_inventario').insert([{
              producto_id: detalle.producto_id,
              tipo: 'entrada',
              cantidad: detalle.cantidad,
              stock_anterior: producto.stock_actual,
              stock_nuevo: producto.stock_actual + detalle.cantidad,
              motivo: `Anulación venta #${selectedVenta.numero_comprobante}`,
              usuario_id: user.id,
              venta_id: selectedVenta.id,
            }]);
          }
        }
      }

      // Register cash movement (negative)
      if (selectedVenta.caja_id) {
        await supabase.from('movimientos_caja').insert([{
          caja_id: selectedVenta.caja_id,
          usuario_id: user.id,
          tipo: 'egreso',
          concepto: `Anulación venta #${selectedVenta.numero_comprobante}`,
          monto: selectedVenta.total,
          venta_id: selectedVenta.id,
        }]);

        // Update caja totals
        const { data: caja } = await supabase
          .from('cajas')
          .select('total_egresos')
          .eq('id', selectedVenta.caja_id)
          .single();

        if (caja) {
          await supabase
            .from('cajas')
            .update({ total_egresos: (caja.total_egresos || 0) + selectedVenta.total })
            .eq('id', selectedVenta.caja_id);
        }
      }

      toast.success('Venta anulada correctamente');
      setAnularDialogOpen(false);
      setMotivoAnulacion('');
      setSelectedVenta(null);
      fetchVentas(isAdmin);
    } catch (error) {
      console.error('Error anulando venta:', error);
      toast.error('Error al anular la venta');
    }
  };

  const columns = [
    {
      key: 'numero_comprobante',
      header: 'Nº Comprobante',
      render: (item: Venta) => (
        <span className="font-mono font-medium">#{item.numero_comprobante.toString().padStart(8, '0')}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      render: (item: Venta) => format(new Date(item.fecha), 'dd/MM/yyyy HH:mm', { locale: es }),
    },
    ...(isAdmin ? [{
      key: 'vendedor',
      header: 'Vendedor',
      render: (item: Venta) => item.profiles?.nombre || 'Sin asignar',
    }] : []),
    {
      key: 'cliente',
      header: 'Cliente',
      render: (item: Venta) => item.clientes?.nombre || 'Consumidor Final',
    },
    {
      key: 'total',
      header: 'Total',
      render: (item: Venta) => (
        <span className="font-medium">
          ${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (item: Venta) => (
        <div className="flex items-center gap-2">
          <Badge variant={item.anulada ? 'destructive' : 'default'}>
            {item.anulada ? 'Anulada' : 'Válida'}
          </Badge>
          {item.comprobantes_afip && item.comprobantes_afip.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Fact. {TIPOS_COMPROBANTE[item.comprobantes_afip[0].tipo_comprobante] || '?'}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Venta) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openDetalleDialog(item)} title="Ver detalle">
            <Eye className="h-4 w-4" />
          </Button>
          {item.comprobantes_afip && item.comprobantes_afip.length > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                setSelectedVenta(item);
                setSelectedFactura(item.comprobantes_afip![0]);
                setFacturaDialogOpen(true);
              }}
              title="Reimprimir factura"
            >
              <Printer className="h-4 w-4 text-primary" />
            </Button>
          )}
          {!item.anulada && canAnular && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedVenta(item);
                setAnularDialogOpen(true);
              }}
              title="Anular venta"
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title="Ventas" description="Historial de ventas y comprobantes">
        <Button variant="outline" onClick={() => toast.info('Función de exportación próximamente')}>
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los usuarios</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                {fechaDesde ? format(fechaDesde, 'dd/MM/yyyy') : 'Desde'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={fechaDesde}
                onSelect={setFechaDesde}
                locale={es}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">-</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                {fechaHasta ? format(fechaHasta, 'dd/MM/yyyy') : 'Hasta'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={fechaHasta}
                onSelect={setFechaHasta}
                locale={es}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {(fechaDesde || fechaHasta) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setFechaDesde(undefined); setFechaHasta(undefined); }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Resumen de Totales */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Total Grande */}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Total Ventas</p>
              <p className="text-4xl font-bold text-primary">
                {formatCurrency(totalesPorMedioPago.totalGeneral)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {ventasFiltradas.filter(v => !v.anulada).length} ventas
                {(fechaDesde || fechaHasta) && ' en el período seleccionado'}
              </p>
            </div>

            {/* Desglose por Medio de Pago */}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">Desglose por Medio de Pago</p>
              <div className="flex flex-wrap gap-4">
                {Object.entries(totalesPorMedioPago.totales).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                ) : (
                  Object.entries(totalesPorMedioPago.totales)
                    .sort((a, b) => b[1] - a[1])
                    .map(([nombre, total]) => (
                      <div key={nombre} className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg">
                        {getMedioPagoIcon(nombre)}
                        <div>
                          <p className="text-xs text-muted-foreground">{nombre}</p>
                          <p className="font-semibold">{formatCurrency(total)}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        data={ventasFiltradas}
        columns={columns}
        searchPlaceholder="Buscar por Nº comprobante..."
        searchKeys={['numero_comprobante']}
        loading={loading}
      />

      {/* Detalle Dialog */}
      <Dialog open={detalleDialogOpen} onOpenChange={setDetalleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Comprobante #{selectedVenta?.numero_comprobante.toString().padStart(8, '0')}
            </DialogTitle>
          </DialogHeader>

          {selectedVenta && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Fecha</p>
                    <p className="font-medium">
                      {format(new Date(selectedVenta.fecha), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">
                      {selectedVenta.clientes?.nombre || 'Consumidor Final'}
                    </p>
                    {selectedVenta.clientes?.dni_cuit && (
                      <p className="text-sm text-muted-foreground">
                        {selectedVenta.clientes.dni_cuit}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {selectedVenta.anulada && (
                <Card className="border-destructive bg-destructive/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <XCircle className="h-4 w-4" />
                      <span className="font-medium">Venta Anulada</span>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Motivo: </span>
                      {selectedVenta.motivo_anulacion}
                    </p>
                    {selectedVenta.fecha_anulacion && (
                      <p className="text-sm text-muted-foreground">
                        Anulada el {format(new Date(selectedVenta.fecha_anulacion), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Products */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-48">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Producto</th>
                          <th className="text-right py-2">Cant.</th>
                          <th className="text-right py-2">P. Unit.</th>
                          <th className="text-right py-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalles.map((detalle) => (
                          <tr key={detalle.id} className="border-b last:border-0">
                            <td className="py-2">
                              <p className="font-medium">{detalle.productos?.descripcion}</p>
                              <p className="text-xs text-muted-foreground">
                                {detalle.productos?.codigo_articulo}
                              </p>
                            </td>
                            <td className="text-right py-2">{detalle.cantidad}</td>
                            <td className="text-right py-2">
                              ${detalle.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right py-2 font-medium">
                              ${detalle.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Totals & Payments */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Formas de Pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pagos.map((pago) => (
                      <div key={pago.id} className="flex justify-between py-1">
                        <span>{pago.formas_pago?.nombre}</span>
                        <span className="font-medium">
                          ${pago.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Totales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${selectedVenta.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {selectedVenta.descuento > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Descuento</span>
                        <span>-${selectedVenta.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>${selectedVenta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Anular Dialog */}
      <AlertDialog open={anularDialogOpen} onOpenChange={setAnularDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción anulará el comprobante #{selectedVenta?.numero_comprobante.toString().padStart(8, '0')} 
              y devolverá el stock de los productos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo de anulación *</Label>
            <Textarea
              id="motivo"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              placeholder="Ingrese el motivo de la anulación..."
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMotivoAnulacion('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAnular} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Anular Venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Factura Dialog for Reprint */}
      <Dialog open={facturaDialogOpen} onOpenChange={setFacturaDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factura Electrónica
            </DialogTitle>
          </DialogHeader>
          
          {selectedVenta && selectedFactura && (
            <div id="printable-invoice" className="space-y-4">
              <div className="border rounded-lg p-6 text-sm">
                {/* Header */}
                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                  <div>
                    <p className="font-bold text-lg">{comercioConfig?.nombre_fantasia || comercioConfig?.razon_social || 'EMPRESA'}</p>
                    <p className="text-muted-foreground">{comercioConfig?.razon_social || 'Razón Social'}</p>
                    <p className="text-muted-foreground text-xs mt-1">{comercioConfig?.direccion || 'Dirección'}</p>
                    <p className="text-xs text-muted-foreground">CUIT: {formatCuit(comercioConfig?.cuit || '')}</p>
                    <p className="text-xs text-muted-foreground">{comercioConfig?.condicion_iva || 'IVA Responsable Inscripto'}</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-block border-2 border-foreground px-4 py-2 mb-2">
                      <p className="font-bold text-2xl">
                        {TIPOS_COMPROBANTE[selectedFactura.tipo_comprobante] || '?'}
                      </p>
                    </div>
                    <p className="font-bold">
                      FACTURA {TIPOS_COMPROBANTE[selectedFactura.tipo_comprobante]}
                    </p>
                    <p className="text-lg font-mono">
                      Nº {String(selectedFactura.punto_venta).padStart(4, '0')}-
                      {String(selectedFactura.numero_comprobante).padStart(8, '0')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Fecha: {format(new Date(selectedFactura.fecha_emision), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="py-3 border-b">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Cliente:</p>
                      <p className="font-medium">{selectedVenta.clientes?.nombre || 'Consumidor Final'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CUIT/DNI:</p>
                      <p>{selectedFactura.doc_nro || 'S/D'}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Condición IVA:</p>
                    <p>{CONDICIONES_IVA[selectedVenta.clientes?.condicion_iva || 5]}</p>
                  </div>
                </div>

                {/* Items - Need to fetch from venta_detalles */}
                <div className="py-3 border-b">
                  <p className="text-xs text-muted-foreground mb-2">
                    (Ver detalle de productos en la venta)
                  </p>
                </div>

                {/* Totals */}
                <div className="py-3 border-b">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal Neto:</span>
                        <span>${selectedFactura.importe_neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {selectedFactura.importe_iva > 0 && (
                        <div className="flex justify-between">
                          <span>IVA 21%:</span>
                          <span>${selectedFactura.importe_iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg border-t pt-1">
                        <span>TOTAL:</span>
                        <span>${selectedFactura.importe_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CAE Info */}
                <div className="pt-3 bg-muted/50 rounded p-3 mt-3">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-bold">CAE Nº: {selectedFactura.cae}</p>
                      <p>Fecha Vto. CAE: {selectedFactura.cae_vencimiento}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Comprobante Autorizado</p>
                      <p className="text-muted-foreground">AFIP - Factura Electrónica</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button className="w-full" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Factura
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
