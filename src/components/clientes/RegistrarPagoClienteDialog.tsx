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
import { CalendarIcon } from 'lucide-react';
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

const TIPOS_MOVIMIENTO = [
  { value: 'pago', label: 'Pago' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'nota_debito', label: 'Nota de Débito' },
  { value: 'nota_credito', label: 'Nota de Crédito' },
  { value: 'anulacion', label: 'Anulación de Compra' },
];

// Tipos que requieren forma de pago
const TIPOS_CON_FORMA_PAGO = ['pago'];

// Formas de pago que requieren imputación
const FORMAS_PAGO_PENDIENTES_IMPUTACION = ['cheque', 'transferencia'];

export function RegistrarPagoClienteDialog({ open, onOpenChange, clienteId, onSuccess }: RegistrarPagoClienteDialogProps) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState('pago');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [formaPagoId, setFormaPagoId] = useState('');
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados para datos de cheque
  const [chequeData, setChequeData] = useState<ChequeData>({
    numero_cheque: '',
    banco: '',
    emisor: '',
    fecha_emision: undefined,
    fecha_vencimiento: undefined,
    cuit_emisor: '',
    observaciones: '',
  });

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

  // Cargar compras cuando se selecciona nota_credito
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

  // Cargar productos cuando se selecciona una compra
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
        .select(`
          id,
          venta_id,
          monto,
          fecha,
          ventas!inner(numero_comprobante)
        `)
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
        .select(`
          id,
          producto_id,
          cantidad,
          precio_unitario,
          subtotal,
          producto_temporal_nombre,
          productos(descripcion, codigo_articulo)
        `)
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

      // Inicializar nota de credito con cantidad 0
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
  
  // Determinar si la forma de pago seleccionada es cheque
  const formaPagoSeleccionada = formasPago.find(fp => fp.id === formaPagoId);
  const esCheque = formaPagoSeleccionada?.nombre.toLowerCase().includes('cheque');
  const esTransferencia = formaPagoSeleccionada?.nombre.toLowerCase().includes('transferencia');
  const requiereImputacion = esCheque || esTransferencia;

  // Calcular total de nota de crédito
  const totalNotaCredito = useMemo(() => {
    return productosNotaCredito.reduce((sum, p) => 
      sum + (p.cantidad_seleccionada * p.precio_unitario), 0);
  }, [productosNotaCredito]);

  const handleCantidadChange = (detalleId: string, cantidad: number) => {
    setProductosNotaCredito(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        const cantidadValida = Math.max(0, Math.min(cantidad, p.cantidad_max));
        return { ...p, cantidad_seleccionada: cantidadValida };
      }
      return p;
    }));
  };

  const handleCheckboxChange = (detalleId: string, checked: boolean) => {
    setProductosNotaCredito(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        return { 
          ...p, 
          cantidad_seleccionada: checked ? p.cantidad_max : 0 
        };
      }
      return p;
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let montoFinal: number;
    let conceptoFinal: string | null = concepto || null;
    let ventaIdRef: string | null = null;

    if (esNotaCredito) {
      // Validaciones para nota de crédito
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
      
      // Generar concepto automático
      const productosSeleccionados = productosNotaCredito
        .filter(p => p.cantidad_seleccionada > 0)
        .map(p => `${p.descripcion} (${p.cantidad_seleccionada})`)
        .join(', ');
      
      conceptoFinal = `NC - Venta #${compra?.numero_comprobante || ''} - ${productosSeleccionados}`;
    } else {
      // Validación para otros tipos
      montoFinal = parseFloat(monto.replace(',', '.'));
      if (isNaN(montoFinal) || montoFinal <= 0) {
        toast.error('Ingrese un monto válido');
        return;
      }

      if (requiereFormaPago && !formaPagoId) {
        toast.error('Seleccione una forma de pago');
        return;
      }

      // Validaciones para cheque
      if (esCheque) {
        if (!chequeData.numero_cheque.trim()) {
          toast.error('Ingrese el número de cheque');
          return;
        }
        if (!chequeData.banco.trim()) {
          toast.error('Ingrese el banco del cheque');
          return;
        }
        if (!chequeData.emisor.trim()) {
          toast.error('Ingrese el emisor del cheque');
          return;
        }
        if (!chequeData.fecha_emision) {
          toast.error('Seleccione la fecha de emisión del cheque');
          return;
        }
        if (!chequeData.fecha_vencimiento) {
          toast.error('Seleccione la fecha de vencimiento del cheque');
          return;
        }
      }
    }

    setLoading(true);
    try {
      // Determinar estado de imputación
      const estadoImputacion = requiereImputacion ? 'pendiente' : 'confirmado';

      // Insertar movimiento
      const { data: movimientoData, error: movError } = await supabase
        .from('cliente_movimientos')
        .insert([{
          cliente_id: clienteId,
          tipo,
          monto: montoFinal,
          concepto: conceptoFinal,
          usuario_registro_id: user.id,
          forma_pago_id: requiereFormaPago ? formaPagoId : null,
          venta_id: ventaIdRef,
          estado_imputacion: estadoImputacion,
        }])
        .select('id')
        .single();

      if (movError) throw movError;

      // Si es cheque, guardar los detalles del cheque
      if (esCheque && movimientoData) {
        const { error: chequeError } = await supabase
          .from('cheque_detalles')
          .insert([{
            cliente_movimiento_id: movimientoData.id,
            numero_cheque: chequeData.numero_cheque.trim(),
            banco: chequeData.banco.trim(),
            emisor: chequeData.emisor.trim(),
            fecha_emision: chequeData.fecha_emision!.toISOString().split('T')[0],
            fecha_vencimiento: chequeData.fecha_vencimiento!.toISOString().split('T')[0],
            cuit_emisor: chequeData.cuit_emisor.trim() || null,
            observaciones: chequeData.observaciones.trim() || null,
          }]);

        if (chequeError) throw chequeError;
      }

      const mensaje = requiereImputacion 
        ? 'Movimiento registrado (pendiente de imputación)'
        : 'Movimiento registrado correctamente';
      toast.success(mensaje);
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
    setFormaPagoId('');
    setCompraSeleccionada(null);
    setProductosVenta([]);
    setProductosNotaCredito([]);
    setChequeData({
      numero_cheque: '',
      banco: '',
      emisor: '',
      fecha_emision: undefined,
      fecha_vencimiento: undefined,
      cuit_emisor: '',
      observaciones: '',
    });
  };

  const handleTipoChange = (value: string) => {
    setTipo(value);
    setFormaPagoId('');
    setCompraSeleccionada(null);
    setProductosVenta([]);
    setProductosNotaCredito([]);
  };

  const handleFormaPagoChange = (value: string) => {
    setFormaPagoId(value);
    // Reset cheque data when changing payment method
    setChequeData({
      numero_cheque: '',
      banco: '',
      emisor: '',
      fecha_emision: undefined,
      fecha_vencimiento: undefined,
      cuit_emisor: '',
      observaciones: '',
    });
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

          {/* UI específica para Nota de Crédito */}
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
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({producto.codigo})
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {formatCurrency(producto.precio_unitario)} c/u
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {producto.cantidad_original}
                                </TableCell>
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

          {/* UI para otros tipos de movimiento */}
          {!esNotaCredito && (
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          )}

          {requiereFormaPago && (
            <div className="space-y-2">
              <Label>Forma de Pago</Label>
              <Select value={formaPagoId} onValueChange={handleFormaPagoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  {formasPago.map((fp) => (
                    <SelectItem key={fp.id} value={fp.id}>
                      {fp.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {requiereImputacion && (
                <p className="text-xs text-warning">
                  ⚠️ Este pago quedará pendiente de imputación hasta ser confirmado
                </p>
              )}
            </div>
          )}

          {/* Campos adicionales para Cheque */}
          {esCheque && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium text-sm">Datos del Cheque</h4>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Número de Cheque *</Label>
                  <Input
                    value={chequeData.numero_cheque}
                    onChange={(e) => setChequeData({ ...chequeData, numero_cheque: e.target.value })}
                    placeholder="Ej: 12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Banco *</Label>
                  <Input
                    value={chequeData.banco}
                    onChange={(e) => setChequeData({ ...chequeData, banco: e.target.value })}
                    placeholder="Ej: Banco Nación"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Emisor / Librador *</Label>
                  <Input
                    value={chequeData.emisor}
                    onChange={(e) => setChequeData({ ...chequeData, emisor: e.target.value })}
                    placeholder="Nombre del emisor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CUIT del Emisor</Label>
                  <Input
                    value={chequeData.cuit_emisor}
                    onChange={(e) => setChequeData({ ...chequeData, cuit_emisor: e.target.value })}
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha de Emisión *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !chequeData.fecha_emision && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {chequeData.fecha_emision 
                          ? format(chequeData.fecha_emision, "dd/MM/yyyy", { locale: es })
                          : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={chequeData.fecha_emision}
                        onSelect={(date) => setChequeData({ ...chequeData, fecha_emision: date })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Vencimiento *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !chequeData.fecha_vencimiento && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {chequeData.fecha_vencimiento 
                          ? format(chequeData.fecha_vencimiento, "dd/MM/yyyy", { locale: es })
                          : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={chequeData.fecha_vencimiento}
                        onSelect={(date) => setChequeData({ ...chequeData, fecha_vencimiento: date })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea
                  value={chequeData.observaciones}
                  onChange={(e) => setChequeData({ ...chequeData, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  rows={2}
                />
              </div>
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
              disabled={loading || (esNotaCredito && totalNotaCredito <= 0)}
            >
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
