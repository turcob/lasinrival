import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RegistrarPagoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  onSuccess: () => void;
}

interface FormaPago {
  id: string;
  nombre: string;
}

interface CompraCliente {
  id: string;
  venta_id: string;
  monto: number;
  fecha: string;
  numero_comprobante: number;
}

interface ProductoVenta {
  id: string;
  producto_id: string | null;
  descripcion: string;
  codigo: string;
  cantidad_original: number;
  precio_unitario: number;
  subtotal: number;
}

interface ProductoNotaCredito {
  detalle_id: string;
  cantidad_seleccionada: number;
  cantidad_max: number;
  precio_unitario: number;
  descripcion: string;
}

interface ChequeData {
  numero_cheque: string;
  banco: string;
  emisor: string;
  fecha_emision: Date | undefined;
  fecha_vencimiento: Date | undefined;
  cuit_emisor: string;
  observaciones: string;
}

interface MedioPagoLinea {
  id: string; // internal key
  forma_pago_id: string;
  monto: string;
  chequeData?: ChequeData;
}

const TIPOS_MOVIMIENTO = [
  { value: 'pago', label: 'Pago' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'nota_debito', label: 'Nota de Débito' },
  { value: 'nota_credito', label: 'Nota de Crédito' },
  { value: 'anulacion', label: 'Anulación de Compra' },
];

const TIPOS_CON_FORMA_PAGO = ['pago'];
const FORMAS_PAGO_PENDIENTES_IMPUTACION = ['cheque', 'transferencia'];

let lineaIdCounter = 0;
const nuevaLinea = (): MedioPagoLinea => ({
  id: `linea-${++lineaIdCounter}`,
  forma_pago_id: '',
  monto: '',
});

export function RegistrarPagoClienteDialog({ open, onOpenChange, clienteId, onSuccess }: RegistrarPagoClienteDialogProps) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState('pago');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [loading, setLoading] = useState(false);

  // Multi-payment lines
  const [lineasPago, setLineasPago] = useState<MedioPagoLinea[]>([nuevaLinea()]);

  // Estados para Nota de Crédito
  const [comprasCliente, setComprasCliente] = useState<CompraCliente[]>([]);
  const [compraSeleccionada, setCompraSeleccionada] = useState<string | null>(null);
  const [productosVenta, setProductosVenta] = useState<ProductoVenta[]>([]);
  const [productosNotaCredito, setProductosNotaCredito] = useState<ProductoNotaCredito[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [loadingProductos, setLoadingProductos] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFormasPago();
    }
  }, [open]);

  useEffect(() => {
    if (tipo === 'nota_credito' && open) {
      fetchComprasCliente();
    } else {
      setComprasCliente([]);
      setCompraSeleccionada(null);
      setProductosVenta([]);
      setProductosNotaCredito([]);
    }
  }, [tipo, open, clienteId]);

  useEffect(() => {
    if (compraSeleccionada) {
      const compra = comprasCliente.find(c => c.id === compraSeleccionada);
      if (compra) {
        fetchProductosVenta(compra.venta_id);
      }
    } else {
      setProductosVenta([]);
      setProductosNotaCredito([]);
    }
  }, [compraSeleccionada]);

  const fetchFormasPago = async () => {
    const { data } = await supabase
      .from('formas_pago')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');
    if (data) setFormasPago(data);
  };

  const fetchComprasCliente = async () => {
    setLoadingCompras(true);
    try {
      const { data, error } = await supabase
        .from('cliente_movimientos')
        .select(`id, venta_id, monto, fecha, ventas!inner(numero_comprobante)`)
        .eq('cliente_id', clienteId)
        .eq('tipo', 'compra')
        .not('venta_id', 'is', null)
        .order('fecha', { ascending: false });
      if (error) throw error;
      const compras: CompraCliente[] = (data || []).map((item: any) => ({
        id: item.id,
        venta_id: item.venta_id,
        monto: item.monto,
        fecha: item.fecha,
        numero_comprobante: item.ventas?.numero_comprobante || 0,
      }));
      setComprasCliente(compras);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Error al cargar las compras del cliente');
    } finally {
      setLoadingCompras(false);
    }
  };

  const fetchProductosVenta = async (ventaId: string) => {
    setLoadingProductos(true);
    try {
      const { data, error } = await supabase
        .from('venta_detalles')
        .select(`id, producto_id, cantidad, precio_unitario, subtotal, producto_temporal_nombre, productos(descripcion, codigo_articulo)`)
        .eq('venta_id', ventaId);
      if (error) throw error;
      const productos: ProductoVenta[] = (data || []).map((d: any) => ({
        id: d.id,
        producto_id: d.producto_id,
        descripcion: d.productos?.descripcion || d.producto_temporal_nombre || 'Producto',
        codigo: d.productos?.codigo_articulo || '',
        cantidad_original: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal,
      }));
      setProductosVenta(productos);
      setProductosNotaCredito(productos.map(p => ({
        detalle_id: p.id,
        cantidad_seleccionada: 0,
        cantidad_max: p.cantidad_original,
        precio_unitario: p.precio_unitario,
        descripcion: p.descripcion,
      })));
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error al cargar los productos de la venta');
    } finally {
      setLoadingProductos(false);
    }
  };

  const requiereFormaPago = TIPOS_CON_FORMA_PAGO.includes(tipo);
  const esNotaCredito = tipo === 'nota_credito';

  const totalNotaCredito = useMemo(() => {
    return productosNotaCredito.reduce((sum, p) =>
      sum + (p.cantidad_seleccionada * p.precio_unitario), 0);
  }, [productosNotaCredito]);

  // Helpers for multi-payment
  const getFormaPagoNombre = (formaPagoId: string) => {
    return formasPago.find(fp => fp.id === formaPagoId)?.nombre?.toLowerCase() || '';
  };

  const esChequeFP = (formaPagoId: string) => getFormaPagoNombre(formaPagoId).includes('cheque');
  const esTransferenciaFP = (formaPagoId: string) => getFormaPagoNombre(formaPagoId).includes('transferencia');

  const totalLineas = useMemo(() => {
    return lineasPago.reduce((sum, l) => {
      const val = parseFloat(l.monto.replace(',', '.'));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [lineasPago]);

  const montoTotal = parseFloat(monto.replace(',', '.')) || 0;
  const restanteEnCuenta = requiereFormaPago ? Math.max(0, montoTotal - totalLineas) : 0;

  const agregarLinea = () => {
    setLineasPago([...lineasPago, nuevaLinea()]);
  };

  const eliminarLinea = (id: string) => {
    if (lineasPago.length <= 1) return;
    setLineasPago(lineasPago.filter(l => l.id !== id));
  };

  const actualizarLinea = (id: string, campo: keyof MedioPagoLinea, valor: any) => {
    setLineasPago(lineasPago.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [campo]: valor };
      // Reset cheque data if forma_pago changed
      if (campo === 'forma_pago_id') {
        if (!esChequeFP(valor)) {
          updated.chequeData = undefined;
        } else if (!updated.chequeData) {
          updated.chequeData = {
            numero_cheque: '', banco: '', emisor: '',
            fecha_emision: undefined, fecha_vencimiento: undefined,
            cuit_emisor: '', observaciones: '',
          };
        }
      }
      return updated;
    }));
  };

  const actualizarChequeLinea = (lineaId: string, chequeUpdate: Partial<ChequeData>) => {
    setLineasPago(lineasPago.map(l => {
      if (l.id !== lineaId || !l.chequeData) return l;
      return { ...l, chequeData: { ...l.chequeData, ...chequeUpdate } };
    }));
  };

  const handleCantidadChange = (detalleId: string, cantidad: number) => {
    setProductosNotaCredito(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        return { ...p, cantidad_seleccionada: Math.max(0, Math.min(cantidad, p.cantidad_max)) };
      }
      return p;
    }));
  };

  const handleCheckboxChange = (detalleId: string, checked: boolean) => {
    setProductosNotaCredito(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        return { ...p, cantidad_seleccionada: checked ? p.cantidad_max : 0 };
      }
      return p;
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let montoFinal: number;
    let conceptoFinal: string | null = concepto || null;
    let ventaIdRef: string | null = null;

    if (esNotaCredito) {
      if (!compraSeleccionada) {
        toast.error('Seleccione una compra para la nota de crédito');
        return;
      }
      if (totalNotaCredito <= 0) {
        toast.error('Seleccione al menos un producto con cantidad mayor a 0');
        return;
      }
      montoFinal = totalNotaCredito;
      const compra = comprasCliente.find(c => c.id === compraSeleccionada);
      ventaIdRef = compra?.venta_id || null;
      const productosSeleccionados = productosNotaCredito
        .filter(p => p.cantidad_seleccionada > 0)
        .map(p => `${p.descripcion} (${p.cantidad_seleccionada})`)
        .join(', ');
      conceptoFinal = `NC - Venta #${compra?.numero_comprobante || ''} - ${productosSeleccionados}`;
    } else if (requiereFormaPago) {
      // Pago con múltiples medios
      montoFinal = montoTotal;
      if (isNaN(montoFinal) || montoFinal <= 0) {
        toast.error('Ingrese un monto total válido');
        return;
      }

      // Validate each line
      for (const linea of lineasPago) {
        if (!linea.forma_pago_id) {
          toast.error('Seleccione la forma de pago en todas las líneas');
          return;
        }
        const lineaMonto = parseFloat(linea.monto.replace(',', '.'));
        if (isNaN(lineaMonto) || lineaMonto <= 0) {
          toast.error('Ingrese un monto válido en todas las líneas de pago');
          return;
        }
        if (esChequeFP(linea.forma_pago_id) && linea.chequeData) {
          const cd = linea.chequeData;
          if (!cd.numero_cheque.trim() || !cd.banco.trim() || !cd.emisor.trim() || !cd.fecha_emision || !cd.fecha_vencimiento) {
            toast.error('Complete todos los datos obligatorios del cheque');
            return;
          }
        }
      }

      if (totalLineas > montoFinal) {
        toast.error('La suma de los pagos no puede superar el monto total');
        return;
      }
    } else {
      montoFinal = parseFloat(monto.replace(',', '.'));
      if (isNaN(montoFinal) || montoFinal <= 0) {
        toast.error('Ingrese un monto válido');
        return;
      }
    }

    setLoading(true);
    try {
      if (requiereFormaPago && !esNotaCredito) {
        // Insert one movement per payment line
        for (const linea of lineasPago) {
          const lineaMonto = parseFloat(linea.monto.replace(',', '.'));
          const esChequeLinea = esChequeFP(linea.forma_pago_id);
          const esTransferenciaLinea = esTransferenciaFP(linea.forma_pago_id);
          const requiereImputacionLinea = esChequeLinea || esTransferenciaLinea;
          const estadoImputacion = requiereImputacionLinea ? 'pendiente' : 'confirmado';

          const fpNombre = getFormaPagoNombre(linea.forma_pago_id);
          const conceptoLinea = lineasPago.length > 1
            ? `${concepto ? concepto + ' - ' : ''}Pago parcial (${fpNombre})`
            : conceptoFinal;

          const { data: movimientoData, error: movError } = await supabase
            .from('cliente_movimientos')
            .insert([{
              cliente_id: clienteId,
              tipo: 'pago',
              monto: lineaMonto,
              concepto: conceptoLinea,
              usuario_registro_id: user.id,
              forma_pago_id: linea.forma_pago_id,
              venta_id: null,
              estado_imputacion: estadoImputacion,
            }])
            .select('id')
            .single();

          if (movError) throw movError;

          // Save cheque details if applicable
          if (esChequeLinea && linea.chequeData && movimientoData) {
            const cd = linea.chequeData;
            const { error: chequeError } = await supabase
              .from('cheque_detalles')
              .insert([{
                cliente_movimiento_id: movimientoData.id,
                numero_cheque: cd.numero_cheque.trim(),
                banco: cd.banco.trim(),
                emisor: cd.emisor.trim(),
                fecha_emision: cd.fecha_emision!.toISOString().split('T')[0],
                fecha_vencimiento: cd.fecha_vencimiento!.toISOString().split('T')[0],
                cuit_emisor: cd.cuit_emisor.trim() || null,
                observaciones: cd.observaciones.trim() || null,
              }]);
            if (chequeError) throw chequeError;
          }
        }

        const hasPendientes = lineasPago.some(l => esChequeFP(l.forma_pago_id) || esTransferenciaFP(l.forma_pago_id));
        const mensaje = hasPendientes
          ? 'Pago registrado (algunos medios pendientes de imputación)'
          : 'Pago registrado correctamente';

        if (restanteEnCuenta > 0) {
          toast.success(`${mensaje}. Queda ${formatCurrency(restanteEnCuenta)} pendiente en cuenta corriente.`);
        } else {
          toast.success(mensaje);
        }
      } else {
        // Non-payment or nota de crédito: single movement
        const { data: movimientoData, error: movError } = await supabase
          .from('cliente_movimientos')
          .insert([{
            cliente_id: clienteId,
            tipo,
            monto: montoFinal,
            concepto: conceptoFinal,
            usuario_registro_id: user.id,
            forma_pago_id: null,
            venta_id: ventaIdRef,
            estado_imputacion: 'confirmado',
          }])
          .select('id')
          .single();

        if (movError) throw movError;
        toast.success('Movimiento registrado correctamente');
      }

      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Error registering movement:', error);
      toast.error('Error al registrar el movimiento');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTipo('pago');
    setMonto('');
    setConcepto('');
    setLineasPago([nuevaLinea()]);
    setCompraSeleccionada(null);
    setProductosVenta([]);
    setProductosNotaCredito([]);
  };

  const handleTipoChange = (value: string) => {
    setTipo(value);
    setLineasPago([nuevaLinea()]);
    setCompraSeleccionada(null);
    setProductosVenta([]);
    setProductosNotaCredito([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de movimiento</Label>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_MOVIMIENTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nota de Crédito UI */}
          {esNotaCredito && (
            <>
              <div className="space-y-2">
                <Label>Seleccionar compra a acreditar</Label>
                <Select
                  value={compraSeleccionada || ''}
                  onValueChange={setCompraSeleccionada}
                  disabled={loadingCompras}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCompras ? "Cargando..." : "Seleccionar compra"} />
                  </SelectTrigger>
                  <SelectContent>
                    {comprasCliente.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No hay compras registradas
                      </SelectItem>
                    ) : (
                      comprasCliente.map((compra) => (
                        <SelectItem key={compra.id} value={compra.id}>
                          Venta #{compra.numero_comprobante} - {format(new Date(compra.fecha), 'dd/MM/yyyy', { locale: es })} - {formatCurrency(compra.monto)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {compraSeleccionada && (
                <div className="space-y-2">
                  <Label>Productos de la compra</Label>
                  {loadingProductos ? (
                    <p className="text-sm text-muted-foreground">Cargando productos...</p>
                  ) : productosVenta.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay productos en esta venta</p>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="w-24 text-center">Cant. Orig.</TableHead>
                            <TableHead className="w-28 text-center">Cantidad NC</TableHead>
                            <TableHead className="w-28 text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productosVenta.map((producto) => {
                            const productoNC = productosNotaCredito.find(p => p.detalle_id === producto.id);
                            const subtotal = (productoNC?.cantidad_seleccionada || 0) * producto.precio_unitario;
                            const isSelected = (productoNC?.cantidad_seleccionada || 0) > 0;
                            return (
                              <TableRow key={producto.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                      handleCheckboxChange(producto.id, checked as boolean)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <span className="font-medium">{producto.descripcion}</span>
                                    {producto.codigo && (
                                      <span className="text-xs text-muted-foreground ml-2">({producto.codigo})</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {formatCurrency(producto.precio_unitario)} c/u
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">{producto.cantidad_original}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    min="0"
                                    max={producto.cantidad_original}
                                    value={productoNC?.cantidad_seleccionada || 0}
                                    onChange={(e) =>
                                      handleCantidadChange(producto.id, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-20 text-center"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(subtotal)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {productosVenta.length > 0 && (
                    <div className="flex justify-end pt-2">
                      <div className="bg-muted px-4 py-2 rounded-md">
                        <span className="text-sm text-muted-foreground mr-2">Total Nota de Crédito:</span>
                        <span className="text-lg font-bold">{formatCurrency(totalNotaCredito)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Monto total */}
          {!esNotaCredito && (
            <div className="space-y-2">
              <Label>{requiereFormaPago ? 'Monto total a pagar' : 'Monto'}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                required
              />
              {requiereFormaPago && (
                <p className="text-xs text-muted-foreground">
                  Ingresá el monto total. Podés dividirlo en varios medios de pago abajo. Si la suma es menor, el resto queda en cuenta corriente.
                </p>
              )}
            </div>
          )}

          {/* Multi-payment lines */}
          {requiereFormaPago && !esNotaCredito && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Medios de pago</Label>
                <Button type="button" variant="outline" size="sm" onClick={agregarLinea}>
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar medio
                </Button>
              </div>

              {lineasPago.map((linea, idx) => {
                const esChequeL = esChequeFP(linea.forma_pago_id);
                return (
                  <div key={linea.id} className="space-y-3 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Forma de pago {lineasPago.length > 1 ? `#${idx + 1}` : ''}</Label>
                        <Select
                          value={linea.forma_pago_id}
                          onValueChange={(v) => actualizarLinea(linea.id, 'forma_pago_id', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {formasPago.map((fp) => (
                              <SelectItem key={fp.id} value={fp.id}>{fp.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-36 space-y-1">
                        <Label className="text-xs">Monto</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={linea.monto}
                          onChange={(e) => actualizarLinea(linea.id, 'monto', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      {lineasPago.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          onClick={() => eliminarLinea(linea.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {(esChequeFP(linea.forma_pago_id) || esTransferenciaFP(linea.forma_pago_id)) && (
                      <p className="text-xs text-amber-600">
                        ⚠️ Este pago quedará pendiente de imputación hasta ser confirmado
                      </p>
                    )}

                    {/* Cheque details inline */}
                    {esChequeL && linea.chequeData && (
                      <div className="space-y-3 pt-2 border-t">
                        <h4 className="font-medium text-xs">Datos del Cheque</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Número de Cheque *</Label>
                            <Input
                              value={linea.chequeData.numero_cheque}
                              onChange={(e) => actualizarChequeLinea(linea.id, { numero_cheque: e.target.value })}
                              placeholder="12345678"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Banco *</Label>
                            <Input
                              value={linea.chequeData.banco}
                              onChange={(e) => actualizarChequeLinea(linea.id, { banco: e.target.value })}
                              placeholder="Banco Nación"
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Emisor *</Label>
                            <Input
                              value={linea.chequeData.emisor}
                              onChange={(e) => actualizarChequeLinea(linea.id, { emisor: e.target.value })}
                              placeholder="Nombre del emisor"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">CUIT Emisor</Label>
                            <Input
                              value={linea.chequeData.cuit_emisor}
                              onChange={(e) => actualizarChequeLinea(linea.id, { cuit_emisor: e.target.value })}
                              placeholder="XX-XXXXXXXX-X"
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Fecha Emisión *</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn("w-full justify-start text-left font-normal text-sm",
                                    !linea.chequeData.fecha_emision && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-3 w-3" />
                                  {linea.chequeData.fecha_emision
                                    ? format(linea.chequeData.fecha_emision, "dd/MM/yyyy", { locale: es })
                                    : "Seleccionar"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={linea.chequeData.fecha_emision}
                                  onSelect={(date) => actualizarChequeLinea(linea.id, { fecha_emision: date })}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Fecha Vencimiento *</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn("w-full justify-start text-left font-normal text-sm",
                                    !linea.chequeData.fecha_vencimiento && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-3 w-3" />
                                  {linea.chequeData.fecha_vencimiento
                                    ? format(linea.chequeData.fecha_vencimiento, "dd/MM/yyyy", { locale: es })
                                    : "Seleccionar"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={linea.chequeData.fecha_vencimiento}
                                  onSelect={(date) => actualizarChequeLinea(linea.id, { fecha_vencimiento: date })}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Observaciones</Label>
                          <Textarea
                            value={linea.chequeData.observaciones}
                            onChange={(e) => actualizarChequeLinea(linea.id, { observaciones: e.target.value })}
                            placeholder="Observaciones..."
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Summary */}
              {montoTotal > 0 && (
                <div className="bg-muted rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Monto total:</span>
                    <span className="font-medium">{formatCurrency(montoTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Suma de medios de pago:</span>
                    <span className={cn("font-medium", totalLineas > montoTotal && "text-destructive")}>
                      {formatCurrency(totalLineas)}
                    </span>
                  </div>
                  {restanteEnCuenta > 0 && (
                    <div className="flex justify-between text-sm border-t pt-1 mt-1">
                      <span className="text-amber-600 font-medium">Queda en cuenta corriente:</span>
                      <span className="text-amber-600 font-bold">{formatCurrency(restanteEnCuenta)}</span>
                    </div>
                  )}
                  {totalLineas > montoTotal && (
                    <p className="text-xs text-destructive mt-1">
                      ⚠️ La suma de pagos supera el monto total
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!esNotaCredito && (
            <div className="space-y-2">
              <Label>Concepto (opcional)</Label>
              <Textarea
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del movimiento"
                rows={2}
              />
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || (esNotaCredito && totalNotaCredito <= 0) || (requiereFormaPago && totalLineas > montoTotal)}
            >
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
