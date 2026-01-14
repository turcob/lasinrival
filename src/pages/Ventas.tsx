import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, XCircle, FileText, Download } from 'lucide-react';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  clientes?: { nombre: string; dni_cuit: string | null } | null;
  profiles?: { nombre: string } | null;
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

export default function Ventas() {
  const { user, hasPermission } = useAuth();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false);
  const [anularDialogOpen, setAnularDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [detalles, setDetalles] = useState<VentaDetalle[]>([]);
  const [pagos, setPagos] = useState<VentaPago[]>([]);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  const canAnular = hasPermission('ventas', 'anular');

  useEffect(() => {
    fetchVentas();
  }, []);

  const fetchVentas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          clientes(nombre, dni_cuit)
        `)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setVentas(data || []);
    } catch (error) {
      console.error('Error fetching ventas:', error);
      toast.error('Error al cargar las ventas');
    } finally {
      setLoading(false);
    }
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
      fetchVentas();
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
        <Badge variant={item.anulada ? 'destructive' : 'default'}>
          {item.anulada ? 'Anulada' : 'Válida'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: Venta) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openDetalleDialog(item)}>
            <Eye className="h-4 w-4" />
          </Button>
          {!item.anulada && canAnular && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedVenta(item);
                setAnularDialogOpen(true);
              }}
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

      <DataTable
        data={ventas}
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
    </MainLayout>
  );
}
