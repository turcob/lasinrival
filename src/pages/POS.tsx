import { useEffect, useState, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  User,
  CreditCard,
  Printer,
  X,
  FileText,
  ClipboardList,
  Edit,
  Check,
  Scale,
  Percent,
  ChevronDown,
  Package,
  UserCheck,
  Wallet,
  CreditCard as CreditCardIcon
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ProductSearchModal } from '@/components/pos/ProductSearchModal';
import { ProductQuantityModal } from '@/components/pos/ProductQuantityModal';
import { SolicitarDescuentoModal } from '@/components/pos/SolicitarDescuentoModal';

interface Producto {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  stock_actual: number;
  unidad_medida: string;
  precio_costo: number;
  marca_id?: string | null;
  tipo_producto_id?: string | null;
}

interface ListaPrecio {
  id: string;
  nombre: string;
  codigo?: string | null;
  orden?: number;
  activo?: boolean;
}

interface PorcentajeMatriz {
  id: string;
  lista_precio_id: string;
  marca_id: string | null;
  tipo_producto_id: string | null;
  es_general: boolean;
  porcentaje: number;
}

interface ExcepcionProducto {
  id: string;
  lista_precio_id: string | null;
  producto_id: string;
  porcentaje: number;
}

interface Cliente {
  id: string;
  nombre: string;
  dni_cuit: string | null;
  condicion_iva?: number;
  permite_cuenta_corriente?: boolean;
}

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  activo: boolean;
}

interface FormaPago {
  id: string;
  nombre: string;
}

interface Tarjeta {
  id: string;
  nombre: string;
  tipo: 'credito' | 'debito';
  activo: boolean;
}

interface TarjetaCuota {
  id: string;
  tarjeta_id: string;
  cuotas: number;
  coeficiente: number;
}

interface CartItem {
  id: string; // unique ID for cart item
  producto?: Producto;
  cantidad: number;
  precio: number;
  subtotal: number;
  descuento_porcentaje: number;
  // Producto temporal
  es_temporal?: boolean;
  nombre_temporal?: string;
}

interface Pago {
  forma_pago_id: string;
  monto: number;
  tarjeta_id?: string;
  cuotas?: number;
  coeficiente?: number;
  efectivo_entregado?: number;
  vuelto?: number;
}

const TIPOS_COMPROBANTE = [
  { value: 1, label: "Factura A", descripcion: "Para Resp. Inscriptos" },
  { value: 6, label: "Factura B", descripcion: "Para Cons. Final / Monotrib." },
];

const TIPOS_DOCUMENTO = [
  { value: 80, label: "CUIT" },
  { value: 86, label: "CUIL" },
  { value: 96, label: "DNI" },
  { value: 99, label: "Consumidor Final" },
];

const CONDICIONES_IVA = [
  { value: 1, label: "IVA Responsable Inscripto" },
  { value: 4, label: "IVA Sujeto Exento" },
  { value: 5, label: "Consumidor Final" },
  { value: 6, label: "Responsable Monotributo" },
];

export default function POS() {
  const { user, hasRole } = useAuth();
  const { config: comercioConfig, formatCuit } = useConfiguracionComercio();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([]);
  const [matrizPorcentajes, setMatrizPorcentajes] = useState<PorcentajeMatriz[]>([]);
  const [excepciones, setExcepciones] = useState<ExcepcionProducto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [tarjetaCuotas, setTarjetaCuotas] = useState<TarjetaCuota[]>([]);
  const [configDescuentos, setConfigDescuentos] = useState<{role: string; descuento_maximo_global: number}[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllResults, setShowAllResults] = useState(false);
  const [selectedLista, setSelectedLista] = useState<ListaPrecio | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [isVentaEmpleado, setIsVentaEmpleado] = useState(false);
  const [empleadoModalidadPago, setEmpleadoModalidadPago] = useState<'cuenta_corriente' | 'pago_directo'>('cuenta_corriente');
  const [clienteModalidadPago, setClienteModalidadPago] = useState<'pago_directo' | 'cuenta_corriente'>('pago_directo');
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [clienteSearchResults, setClienteSearchResults] = useState<Cliente[]>([]);
  const [clienteSearchLoading, setClienteSearchLoading] = useState(false);
  const [empleadoDialogOpen, setEmpleadoDialogOpen] = useState(false);
  const [empleadoSearchTerm, setEmpleadoSearchTerm] = useState('');
  const [empleadoSearchResults, setEmpleadoSearchResults] = useState<Empleado[]>([]);
  const [empleadoSearchLoading, setEmpleadoSearchLoading] = useState(false);
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [lastVenta, setLastVenta] = useState<any>(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  
  // Facturación
  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const [emitirFactura, setEmitirFactura] = useState(true);
  const [facturaData, setFacturaData] = useState({
    tipo_comprobante: 6,
    doc_tipo: 99,
    doc_nro: "",
    condicion_iva_receptor: 5,
  });
  const [emitiendo, setEmitiendo] = useState(false);
  
  // Pedidos
  const [pedidosDialogOpen, setPedidosDialogOpen] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  
  // Peso para productos por KG
  const [pesoDialogOpen, setPesoDialogOpen] = useState(false);
  const [editingPesoItem, setEditingPesoItem] = useState<string | null>(null);
  const [pesoInput, setPesoInput] = useState('');
  
  // Edición manual de cantidad
  const [editingCantidadItem, setEditingCantidadItem] = useState<string | null>(null);
  const [cantidadInput, setCantidadInput] = useState('');
  
  // Descuento por item
  const [descuentoDialogOpen, setDescuentoDialogOpen] = useState(false);
  const [editingDescuentoItem, setEditingDescuentoItem] = useState<string | null>(null);
  const [descuentoInput, setDescuentoInput] = useState('');
  
  // Descuento global
  const [descuentoGlobal, setDescuentoGlobal] = useState<number>(0);
  const [editingDescuentoGlobal, setEditingDescuentoGlobal] = useState(false);
  const [descuentoGlobalInput, setDescuentoGlobalInput] = useState('');
  
  // Producto temporal
  const [productoTemporalDialogOpen, setProductoTemporalDialogOpen] = useState(false);
  const [productoTemporal, setProductoTemporal] = useState({ nombre: '', precio: '', cantidad: '1' });
  
  // Pago con tarjeta
  const [tarjetaDialogOpen, setTarjetaDialogOpen] = useState(false);
  const [selectedFormaPago, setSelectedFormaPago] = useState<string | null>(null);
  const [selectedTarjeta, setSelectedTarjeta] = useState<string | null>(null);
  const [selectedCuotas, setSelectedCuotas] = useState<number>(1);
  const [montoTarjeta, setMontoTarjeta] = useState('');
  const [tipoTarjetaFiltro, setTipoTarjetaFiltro] = useState<'credito' | 'debito' | null>(null);
  
  // Pago efectivo
  const [efectivoDialogOpen, setEfectivoDialogOpen] = useState(false);
  const [efectivoEntregado, setEfectivoEntregado] = useState('');

  // Pago Transferencia (datos del comprobante)
  const [transferenciaDialogOpen, setTransferenciaDialogOpen] = useState(false);
  const [transferenciaData, setTransferenciaData] = useState<{
    fecha: string;
    titular: string;
    cuil: string;
    importe: string;
    numero_operacion: string;
    archivo: File | null;
  } | null>(null);

  // Pago genérico (otros métodos): pedir importe antes de agregar
  const [montoGenericoDialogOpen, setMontoGenericoDialogOpen] = useState(false);
  const [montoGenericoData, setMontoGenericoData] = useState<{
    formaPagoId: string;
    formaPagoNombre: string;
    monto: string;
  } | null>(null);

  // Pago Cheque (datos del cheque a registrar como pendiente de validación)
  const [chequeDialogOpen, setChequeDialogOpen] = useState(false);
  const [chequeFormaPagoId, setChequeFormaPagoId] = useState<string | null>(null);
  const [chequeData, setChequeData] = useState<{
    tipo: 'propio' | 'terceros';
    numero_cheque: string;
    banco: string;
    sucursal_banco: string;
    emisor: string;
    cuit_emisor: string;
    monto: string;
    fecha_emision: string;
    fecha_vencimiento: string;
    observaciones: string;
  } | null>(null);

  // Modal de búsqueda de productos
  const [productSearchModalOpen, setProductSearchModalOpen] = useState(false);
  const [productQuantityModalOpen, setProductQuantityModalOpen] = useState(false);
  const [selectedProductForQuantity, setSelectedProductForQuantity] = useState<Producto | null>(null);

  // Modal de autorización de descuento
  const [descuentoAuthModalOpen, setDescuentoAuthModalOpen] = useState(false);
  const [pendingDescuento, setPendingDescuento] = useState<{
    type: 'item' | 'global';
    itemId?: string;
    porcentaje: number;
    descripcion?: string;
    productoId?: string;
  } | null>(null);

  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchData();
  }, [user]);

  // Server-side search for clients with debounce
  useEffect(() => {
    if (!clienteSearchTerm || clienteSearchTerm.length < 2) {
      setClienteSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setClienteSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nombre, dni_cuit, condicion_iva, lista_precio_id, permite_cuenta_corriente')
          .eq('activo', true)
          .or(`nombre.ilike.%${clienteSearchTerm}%,dni_cuit.ilike.%${clienteSearchTerm}%`)
          .order('nombre')
          .limit(50);

        if (error) throw error;
        setClienteSearchResults(data as Cliente[]);
      } catch (error) {
        console.error('Error searching clients:', error);
      } finally {
        setClienteSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [clienteSearchTerm]);

  // Forzar pago directo cuando el cliente no permite cuenta corriente
  useEffect(() => {
    if (selectedCliente && selectedCliente.permite_cuenta_corriente === false && clienteModalidadPago === 'cuenta_corriente') {
      setClienteModalidadPago('pago_directo');
    }
  }, [selectedCliente, clienteModalidadPago]);

  // Server-side search for employees with debounce
  useEffect(() => {
    if (!empleadoSearchTerm || empleadoSearchTerm.length < 2) {
      setEmpleadoSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setEmpleadoSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from('empleados')
          .select('id, nombre, dni, activo')
          .eq('activo', true)
          .or(`nombre.ilike.%${empleadoSearchTerm}%,dni.ilike.%${empleadoSearchTerm}%`)
          .order('nombre')
          .limit(50);

        if (error) throw error;
        setEmpleadoSearchResults(data as Empleado[]);
      } catch (error) {
        console.error('Error searching employees:', error);
      } finally {
        setEmpleadoSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [empleadoSearchTerm]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [productosRes, clientesRes, empleadosRes, formasPagoRes, listasRes, porcentajesRes, excepcionesRes, cajasRes, tarjetasRes, cuotasRes, descuentosRes] = await Promise.all([
        supabase.from('productos').select('id, codigo_articulo, descripcion, stock_actual, unidad_medida, precio_costo, marca_id, tipo_producto_id').eq('activo', true).order('descripcion'),
        supabase.from('clientes').select('id, nombre, dni_cuit, condicion_iva, lista_precio_id, permite_cuenta_corriente').eq('activo', true).order('nombre'),
        supabase.from('empleados').select('id, nombre, dni, activo').eq('activo', true).order('nombre'),
        supabase.from('formas_pago').select('id, nombre').eq('activo', true),
        supabase.from('listas_precios').select('id, nombre, codigo, orden, activo').eq('activo', true).neq('destino', 'paladini').order('orden'),
        supabase.from('lista_precio_porcentajes').select('*'),
        supabase.from('lista_precio_excepciones').select('id, lista_precio_id, producto_id, porcentaje'),
        supabase.from('cajas').select('id').eq('usuario_id', user.id).eq('estado', 'abierta').maybeSingle(),
        supabase.from('tarjetas').select('*').eq('activo', true).order('tipo').order('nombre'),
        supabase.from('tarjeta_cuotas').select('*').eq('activo', true).order('cuotas'),
        supabase.from('configuracion_descuentos').select('role, descuento_maximo_global'),
      ]);

      if (productosRes.data) setProductos(productosRes.data);
      if (clientesRes.data) setClientes(clientesRes.data as Cliente[]);
      if (empleadosRes.data) setEmpleados(empleadosRes.data as Empleado[]);
      if (formasPagoRes.data) setFormasPago(formasPagoRes.data);
      if (tarjetasRes.data) setTarjetas(tarjetasRes.data as Tarjeta[]);
      if (cuotasRes.data) setTarjetaCuotas(cuotasRes.data as TarjetaCuota[]);
      if (descuentosRes.data) setConfigDescuentos(descuentosRes.data);
      if (porcentajesRes.data) setMatrizPorcentajes(porcentajesRes.data as PorcentajeMatriz[]);
      if (excepcionesRes.data) setExcepciones(excepcionesRes.data as ExcepcionProducto[]);
      if (listasRes.data) {
        setListasPrecios(listasRes.data);
        if (listasRes.data.length > 0 && !selectedLista) {
          setSelectedLista(listasRes.data[0]);
        }
      }
      setCajaAbierta(!!cajasRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Obtener descuento máximo permitido para el usuario actual
  const getDescuentoMaximo = (): number => {
    if (isAdmin) return 100;
    // Por ahora usamos el rol más alto del usuario
    const roles = ['encargado', 'cajero', 'vendedor', 'deposito'];
    for (const rol of roles) {
      if (hasRole(rol as any)) {
        const config = configDescuentos.find(c => c.role === rol);
        if (config) return config.descuento_maximo_global;
      }
    }
    return 0;
  };

  const filteredProductos = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const results = productos.filter(
      (p) =>
        p.codigo_articulo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
    );
    return showAllResults ? results : results.slice(0, 8);
  }, [productos, searchTerm, showAllResults]);

  const totalResults = useMemo(() => {
    if (!searchTerm) return 0;
    const term = searchTerm.toLowerCase();
    return productos.filter(
      (p) =>
        p.codigo_articulo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
    ).length;
  }, [productos, searchTerm]);

  const getProductoPrice = (producto: Producto): number => {
    if (!selectedLista) return 0;
    const costo = producto.precio_costo || 0;
    
    const excepcion = excepciones.find(e => 
      e.producto_id === producto.id && 
      (e.lista_precio_id === selectedLista.id || e.lista_precio_id === null)
    );
    if (excepcion) {
      return costo * (1 + excepcion.porcentaje / 100);
    }
    
    if (producto.marca_id) {
      const porMarca = matrizPorcentajes.find(p => 
        p.lista_precio_id === selectedLista.id && 
        p.marca_id === producto.marca_id
      );
      if (porMarca) {
        return costo * (1 + porMarca.porcentaje / 100);
      }
    }
    
    if (producto.tipo_producto_id) {
      const porTipo = matrizPorcentajes.find(p => 
        p.lista_precio_id === selectedLista.id && 
        p.tipo_producto_id === producto.tipo_producto_id
      );
      if (porTipo) {
        return costo * (1 + porTipo.porcentaje / 100);
      }
    }
    
    const general = matrizPorcentajes.find(p => 
      p.lista_precio_id === selectedLista.id && 
      p.es_general === true
    );
    if (general) {
      return costo * (1 + general.porcentaje / 100);
    }
    
    return costo;
  };

  const isProductoPorPeso = (producto: Producto) => {
    const unidad = (producto.unidad_medida || '').toUpperCase().replace('.', '').trim();
    return unidad === 'KG' || unidad === 'KILO' || unidad === 'KILOS';
  };

  const addToCart = (producto: Producto) => {
    const precio = getProductoPrice(producto);

    if (!precio || precio <= 0) {
      toast.error('Este producto no tiene precio definido en la lista del cliente');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.producto?.id === producto.id && !item.es_temporal);
      if (existing) {
        if (isProductoPorPeso(producto)) {
          setEditingPesoItem(existing.id);
          setPesoInput(existing.cantidad.toString().replace('.', ','));
          setPesoDialogOpen(true);
          return prev;
        }
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, cantidad: item.cantidad + 1, subtotal: calcSubtotal(item.cantidad + 1, item.precio, item.descuento_porcentaje) }
            : item
        );
      }
      const newId = crypto.randomUUID();
      if (isProductoPorPeso(producto)) {
        const newCart = [...prev, { id: newId, producto, cantidad: 1, precio, subtotal: precio, descuento_porcentaje: 0 }];
        setTimeout(() => {
          setEditingPesoItem(newId);
          setPesoInput('1');
          setPesoDialogOpen(true);
        }, 0);
        return newCart;
      }
      return [...prev, { id: newId, producto, cantidad: 1, precio, subtotal: precio, descuento_porcentaje: 0 }];
    });
    setSearchTerm('');
    setShowAllResults(false);
  };

  // Handler para selección de producto desde el modal de búsqueda
  const handleProductSelectedFromModal = (producto: Producto) => {
    const precioCalc = getProductoPrice(producto);
    if (!precioCalc || precioCalc <= 0) {
      toast.error('Este producto no tiene precio definido en la lista del cliente');
      return;
    }
    setSelectedProductForQuantity(producto);
    setProductQuantityModalOpen(true);
  };

  // Handler para confirmar cantidad desde el modal
  const handleConfirmProductQuantity = (producto: Producto, cantidad: number) => {
    const precio = getProductoPrice(producto);
    
    setCart((prev) => {
      const existing = prev.find((item) => item.producto?.id === producto.id && !item.es_temporal);
      if (existing) {
        const nuevaCantidad = existing.cantidad + cantidad;
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, cantidad: nuevaCantidad, subtotal: calcSubtotal(nuevaCantidad, item.precio, item.descuento_porcentaje) }
            : item
        );
      }
      const newId = crypto.randomUUID();
      return [...prev, { id: newId, producto, cantidad, precio, subtotal: calcSubtotal(cantidad, precio, 0), descuento_porcentaje: 0 }];
    });
    
    toast.success(`${producto.descripcion} agregado al pedido`);
  };

  const calcSubtotal = (cantidad: number, precio: number, descuentoPorcentaje: number): number => {
    const subtotalBruto = cantidad * precio;
    return subtotalBruto * (1 - descuentoPorcentaje / 100);
  };

  const updateCantidadDirecta = (itemId: string, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, cantidad: nuevaCantidad, subtotal: calcSubtotal(nuevaCantidad, item.precio, item.descuento_porcentaje) };
        }
        return item;
      })
    );
  };

  const updateDescuento = (itemId: string, descuento: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, descuento_porcentaje: descuento, subtotal: calcSubtotal(item.cantidad, item.precio, descuento) };
        }
        return item;
      })
    );
  };

  // Función para solicitar autorización de descuento
  const solicitarAutorizacionDescuento = (
    type: 'item' | 'global',
    porcentaje: number,
    itemId?: string,
    descripcion?: string,
    productoId?: string
  ) => {
    setPendingDescuento({
      type,
      itemId,
      porcentaje,
      descripcion,
      productoId,
    });
    setDescuentoAuthModalOpen(true);
  };

  // Cuando el descuento es autorizado
  const handleDescuentoAutorizado = (porcentajeAutorizado: number) => {
    if (!pendingDescuento) return;

    if (pendingDescuento.type === 'item' && pendingDescuento.itemId) {
      updateDescuento(pendingDescuento.itemId, porcentajeAutorizado);
      toast.success(`Descuento del ${porcentajeAutorizado}% aplicado al producto`);
    } else if (pendingDescuento.type === 'global') {
      setDescuentoGlobal(porcentajeAutorizado);
      toast.success(`Descuento global del ${porcentajeAutorizado}% aplicado`);
    }

    setDescuentoAuthModalOpen(false);
    setPendingDescuento(null);
  };

  // Intentar aplicar descuento (verifica si necesita autorización)
  const tryApplyDescuentoItem = (itemId: string, descuento: number) => {
    const maxDescuento = getDescuentoMaximo();
    const item = cart.find(i => i.id === itemId);
    
    if (descuento <= maxDescuento) {
      // Dentro del límite permitido, aplicar directamente
      updateDescuento(itemId, descuento);
      toast.success(`Descuento del ${descuento}% aplicado`);
    } else {
      // Excede el límite, solicitar autorización
      const nombreProducto = item?.es_temporal 
        ? item.nombre_temporal 
        : item?.producto?.descripcion;
      solicitarAutorizacionDescuento(
        'item',
        descuento,
        itemId,
        nombreProducto,
        item?.producto?.id
      );
    }
  };

  // Intentar aplicar descuento global (verifica si necesita autorización)
  const tryApplyDescuentoGlobal = (descuento: number) => {
    const maxDescuento = getDescuentoMaximo();
    
    if (descuento <= maxDescuento) {
      // Dentro del límite permitido, aplicar directamente
      setDescuentoGlobal(descuento);
      if (descuento > 0) toast.success(`Descuento global del ${descuento}% aplicado`);
    } else {
      // Excede el límite, solicitar autorización
      solicitarAutorizacionDescuento('global', descuento);
    }
  };

  const handleGuardarPeso = () => {
    if (!editingPesoItem) return;
    
    const pesoNormalizado = pesoInput.replace(',', '.');
    const peso = parseFloat(pesoNormalizado);
    
    if (isNaN(peso) || peso <= 0) {
      toast.error('Ingrese un peso válido');
      return;
    }
    
    updateCantidadDirecta(editingPesoItem, peso);
    setPesoDialogOpen(false);
    setEditingPesoItem(null);
    setPesoInput('');
  };

  const handleGuardarCantidad = () => {
    if (!editingCantidadItem) return;
    const cantidad = parseInt(cantidadInput);
    if (isNaN(cantidad) || cantidad < 1) {
      toast.error('Ingrese una cantidad válida');
      return;
    }
    updateCantidadDirecta(editingCantidadItem, cantidad);
    setEditingCantidadItem(null);
    setCantidadInput('');
  };

  const handleGuardarDescuento = () => {
    if (!editingDescuentoItem) return;
    const descuento = parseFloat(descuentoInput.replace(',', '.'));
    const maxDescuento = getDescuentoMaximo();
    
    if (isNaN(descuento) || descuento < 0) {
      toast.error('Ingrese un descuento válido');
      return;
    }
    if (descuento > maxDescuento) {
      toast.error(`El descuento máximo permitido es ${maxDescuento}%`);
      return;
    }
    
    updateDescuento(editingDescuentoItem, descuento);
    setDescuentoDialogOpen(false);
    setEditingDescuentoItem(null);
    setDescuentoInput('');
    toast.success(`Descuento del ${descuento}% aplicado`);
  };

  const handleAgregarProductoTemporal = () => {
    if (!productoTemporal.nombre.trim()) {
      toast.error('Ingrese un nombre para el producto');
      return;
    }
    const precio = parseFloat(productoTemporal.precio.replace(',', '.'));
    if (isNaN(precio) || precio <= 0) {
      toast.error('Ingrese un precio válido');
      return;
    }
    const cantidad = parseInt(productoTemporal.cantidad) || 1;
    
    const newItem: CartItem = {
      id: crypto.randomUUID(),
      cantidad,
      precio,
      subtotal: precio * cantidad,
      descuento_porcentaje: 0,
      es_temporal: true,
      nombre_temporal: productoTemporal.nombre.trim(),
    };
    
    setCart(prev => [...prev, newItem]);
    setProductoTemporalDialogOpen(false);
    setProductoTemporal({ nombre: '', precio: '', cantidad: '1' });
    toast.success('Producto agregado al carrito');
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newCantidad = item.cantidad + delta;
            if (newCantidad <= 0) return null;
            return { ...item, cantidad: newCantidad, subtotal: calcSubtotal(newCantidad, item.precio, item.descuento_porcentaje) };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.cantidad * item.precio), 0), [cart]);
  const totalDescuentosProductos = useMemo(() => cart.reduce((sum, item) => sum + (item.cantidad * item.precio * item.descuento_porcentaje / 100), 0), [cart]);
  const subtotalConDescuentosProductos = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
  const montoDescuentoGlobal = useMemo(() => subtotalConDescuentosProductos * (descuentoGlobal / 100), [subtotalConDescuentosProductos, descuentoGlobal]);
  const totalDescuentos = useMemo(() => totalDescuentosProductos + montoDescuentoGlobal, [totalDescuentosProductos, montoDescuentoGlobal]);
  const total = useMemo(() => subtotalConDescuentosProductos - montoDescuentoGlobal, [subtotalConDescuentosProductos, montoDescuentoGlobal]);
  const totalPagado = useMemo(() => pagos.reduce((sum, p) => sum + p.monto, 0), [pagos]);
  // Total a facturar: si hay pagos con intereses, usar totalPagado; sino usar total de productos
  const totalFacturar = useMemo(() => totalPagado > 0 ? totalPagado : total, [totalPagado, total]);

  const handleOpenFacturaDialog = () => {
    if (selectedCliente) {
      const docTipo = selectedCliente.dni_cuit?.length === 11 ? 80 : 96;
      setFacturaData({
        tipo_comprobante: 6,
        doc_tipo: docTipo,
        doc_nro: selectedCliente.dni_cuit || "",
        condicion_iva_receptor: selectedCliente.condicion_iva || 5,
      });
    } else {
      setFacturaData({
        tipo_comprobante: 6,
        doc_tipo: 99,
        doc_nro: "0",
        condicion_iva_receptor: 5,
      });
    }
    setEmitirFactura(false);
    setFacturaDialogOpen(true);
  };

  // Detecta si hay un pago con Transferencia entre los pagos del carrito
  const getPagoTransferencia = () => {
    const fpTransf = formasPago.find(fp => fp.nombre.toLowerCase().includes('transfer'));
    if (!fpTransf) return null;
    const pago = pagos.find(p => p.forma_pago_id === fpTransf.id);
    return pago ? { pago, formaPagoId: fpTransf.id } : null;
  };

  // Handler del botón "Continuar" del diálogo de pago.
  // Sólo se habilita cuando la suma de medios de pago coincide con el total.
  const handleContinuarPago = () => {
    if (Math.abs(totalPagado - total) > 0.009) {
      toast.error('La suma de los medios de pago debe ser igual al total de la venta');
      return;
    }
    const t = getPagoTransferencia();
    if (t && !transferenciaData) {
      toast.error('Complete los datos de la transferencia');
      setTransferenciaData({
        fecha: new Date().toISOString().slice(0, 10),
        titular: '',
        cuil: '',
        importe: t.pago.monto.toFixed(2),
        numero_operacion: '',
        archivo: null,
      });
      setTransferenciaDialogOpen(true);
      return;
    }
    handleOpenFacturaDialog();
  };

  const handleConfirmarTransferencia = () => {
    if (!transferenciaData) return;
    if (!transferenciaData.fecha) return toast.error('Ingrese la fecha del comprobante');
    if (!transferenciaData.titular.trim()) return toast.error('Ingrese el titular de la cuenta');
    const cuilLimpio = transferenciaData.cuil.replace(/\D/g, '');
    if (!cuilLimpio || cuilLimpio.length < 7) return toast.error('Ingrese un CUIL/CUIT válido');
    const importeNum = parseFloat(transferenciaData.importe.replace(',', '.'));
    if (isNaN(importeNum) || importeNum <= 0) return toast.error('Ingrese un importe válido');
    if (!transferenciaData.numero_operacion.trim()) return toast.error('Ingrese el número de comprobante / operación');

    // Validar que el importe no exceda el pendiente
    const fpTransf = formasPago.find(fp => fp.nombre.toLowerCase().includes('transfer'));
    if (!fpTransf) return toast.error('No se encontró la forma de pago Transferencia');

    const existing = pagos.find(p => p.forma_pago_id === fpTransf.id);
    const pendienteSinTransf = total - totalPagado + (existing?.monto || 0);
    if (importeNum > pendienteSinTransf + 0.009) {
      return toast.error(`El importe excede el pendiente ($${pendienteSinTransf.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`);
    }

    // Agregar o actualizar el pago de transferencia con el importe ingresado
    setPagos(prev => {
      const idx = prev.findIndex(p => p.forma_pago_id === fpTransf.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], monto: importeNum };
        return next;
      }
      return [...prev, { forma_pago_id: fpTransf.id, monto: importeNum }];
    });

    setTransferenciaData({ ...transferenciaData, cuil: cuilLimpio, importe: importeNum.toFixed(2) });
    setTransferenciaDialogOpen(false);
    toast.success('Transferencia agregada');
  };

  // Agregar pago con tarjeta
  const handleAddPagoTarjeta = () => {
    if (!selectedTarjeta || !selectedFormaPago) return;
    
    const monto = parseFloat(montoTarjeta.replace(',', '.'));
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }
    
    const tarjeta = tarjetas.find(t => t.id === selectedTarjeta);
    
    // Para débito, buscar cualquier coeficiente configurado (no depende de cuotas)
    // Para crédito, buscar por cuotas seleccionadas
    let cuotaConfig;
    let cuotasUsadas = selectedCuotas;
    
    if (tarjeta?.tipo === 'debito') {
      // Para débito, tomar el primer (y único) coeficiente configurado
      cuotaConfig = tarjetaCuotas.find(c => c.tarjeta_id === selectedTarjeta);
      cuotasUsadas = 1; // Débito siempre es 1 cuota
    } else {
      cuotaConfig = tarjetaCuotas.find(c => c.tarjeta_id === selectedTarjeta && c.cuotas === selectedCuotas);
    }
    
    const coeficiente = cuotaConfig?.coeficiente || 1;
    const montoConInteres = monto * coeficiente;
    
    setPagos(prev => [...prev, {
      forma_pago_id: selectedFormaPago,
      monto: montoConInteres,
      tarjeta_id: selectedTarjeta,
      cuotas: cuotasUsadas,
      coeficiente,
    }]);
    
    setTarjetaDialogOpen(false);
    setSelectedTarjeta(null);
    setSelectedCuotas(1);
    setMontoTarjeta('');
    
    if (coeficiente > 1) {
      toast.success(`Pago agregado con ${((coeficiente - 1) * 100).toFixed(1)}% de interés`);
    } else {
      toast.success('Pago con tarjeta agregado');
    }
  };

  // Agregar pago en efectivo
  const handleAddPagoEfectivo = () => {
    const entregado = parseFloat(efectivoEntregado.replace(',', '.'));
    const pendiente = total - totalPagado;
    
    if (isNaN(entregado) || entregado <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }
    
    const montoAplicado = Math.min(entregado, pendiente);
    const vuelto = entregado > pendiente ? entregado - pendiente : 0;
    
    const efectivoFP = formasPago.find(fp => fp.nombre.toLowerCase().includes('efectivo'));
    if (!efectivoFP) {
      toast.error('No se encontró la forma de pago Efectivo');
      return;
    }
    
    setPagos(prev => [...prev, {
      forma_pago_id: efectivoFP.id,
      monto: montoAplicado,
      efectivo_entregado: entregado,
      vuelto,
    }]);
    
    setEfectivoDialogOpen(false);
    setEfectivoEntregado('');
    
    if (vuelto > 0) {
      toast.success(`Vuelto: $${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    }
  };

  const addPago = (formaPagoId: string) => {
    const fp = formasPago.find(f => f.id === formaPagoId);
    const fpNombre = fp?.nombre.toLowerCase() || '';
    
    // Si es efectivo, abrir diálogo de efectivo
    if (fpNombre.includes('efectivo')) {
      setEfectivoDialogOpen(true);
      return;
    }
    
    // Si es débito, abrir diálogo de tarjeta con filtro débito
    if (fpNombre.includes('débito') || fpNombre.includes('debito')) {
      setSelectedFormaPago(formaPagoId);
      setTipoTarjetaFiltro('debito');
      setSelectedTarjeta(null);
      setSelectedCuotas(1);
      const pendiente = total - totalPagado;
      setMontoTarjeta(pendiente.toString());
      setTarjetaDialogOpen(true);
      return;
    }
    
    // Si es crédito, abrir diálogo de tarjeta con filtro crédito
    if (fpNombre.includes('crédito') || fpNombre.includes('credito')) {
      setSelectedFormaPago(formaPagoId);
      setTipoTarjetaFiltro('credito');
      setSelectedTarjeta(null);
      setSelectedCuotas(1);
      const pendiente = total - totalPagado;
      setMontoTarjeta(pendiente.toString());
      setTarjetaDialogOpen(true);
      return;
    }
    
    // Si es tarjeta genérica, mostrar todas
    if (fpNombre.includes('tarjeta')) {
      setSelectedFormaPago(formaPagoId);
      setTipoTarjetaFiltro(null);
      setSelectedTarjeta(null);
      setSelectedCuotas(1);
      const pendiente = total - totalPagado;
      setMontoTarjeta(pendiente.toString());
      setTarjetaDialogOpen(true);
      return;
    }

    const pendiente = total - totalPagado;
    if (pendiente <= 0.009) {
      toast.error('No hay saldo pendiente para asignar');
      return;
    }

    // Si es Transferencia, abrir directamente el diálogo de datos (incluye importe)
    if (fpNombre.includes('transfer')) {
      // Si ya existe un pago de transferencia, no duplicar
      if (pagos.some(p => p.forma_pago_id === formaPagoId)) {
        toast.error('Ya hay un pago con Transferencia agregado');
        return;
      }
      setTransferenciaData({
        fecha: new Date().toISOString().slice(0, 10),
        titular: '',
        cuil: '',
        importe: pendiente.toFixed(2),
        numero_operacion: '',
        archivo: null,
      });
      setTransferenciaDialogOpen(true);
      return;
    }

    // Si es Cheque, abrir diálogo con datos del cheque
    if (fpNombre.includes('cheque')) {
      if (pagos.some(p => p.forma_pago_id === formaPagoId)) {
        toast.error('Ya hay un pago con Cheque agregado');
        return;
      }
      setChequeFormaPagoId(formaPagoId);
      setChequeData({
        tipo: 'terceros',
        numero_cheque: '',
        banco: '',
        sucursal_banco: '',
        emisor: selectedCliente?.nombre || '',
        cuit_emisor: selectedCliente?.dni_cuit || '',
        monto: pendiente.toFixed(2),
        fecha_emision: new Date().toISOString().slice(0, 10),
        fecha_vencimiento: '',
        observaciones: '',
      });
      setChequeDialogOpen(true);
      return;
    }

    // Resto de métodos de pago: pedir importe en un diálogo genérico
    setMontoGenericoData({
      formaPagoId,
      formaPagoNombre: fp?.nombre || 'Pago',
      monto: pendiente.toFixed(2),
    });
    setMontoGenericoDialogOpen(true);
  };

  const handleAddPagoGenerico = () => {
    if (!montoGenericoData) return;
    const monto = parseFloat(montoGenericoData.monto.replace(',', '.'));
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingrese un importe válido');
      return;
    }
    const existing = pagos.find(p => p.forma_pago_id === montoGenericoData.formaPagoId);
    const pendienteDisponible = total - totalPagado + (existing?.monto || 0);
    if (monto > pendienteDisponible + 0.009) {
      toast.error(`El importe excede el pendiente ($${pendienteDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`);
      return;
    }
    setPagos(prev => {
      const idx = prev.findIndex(p => p.forma_pago_id === montoGenericoData.formaPagoId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], monto };
        return next;
      }
      return [...prev, { forma_pago_id: montoGenericoData.formaPagoId, monto }];
    });
    setMontoGenericoDialogOpen(false);
    setMontoGenericoData(null);
  };

  const handleAddPagoCheque = () => {
    if (!chequeData || !chequeFormaPagoId) return;
    if (!chequeData.numero_cheque.trim() || !chequeData.banco.trim() || !chequeData.emisor.trim()) {
      toast.error('Completá número de cheque, banco y emisor');
      return;
    }
    if (!chequeData.fecha_emision || !chequeData.fecha_vencimiento) {
      toast.error('Completá las fechas de emisión y vencimiento');
      return;
    }
    const monto = parseFloat(chequeData.monto.replace(',', '.'));
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingrese un importe válido');
      return;
    }
    const existing = pagos.find(p => p.forma_pago_id === chequeFormaPagoId);
    const pendienteDisponible = total - totalPagado + (existing?.monto || 0);
    if (monto > pendienteDisponible + 0.009) {
      toast.error(`El importe excede el pendiente ($${pendienteDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`);
      return;
    }
    setPagos(prev => {
      const idx = prev.findIndex(p => p.forma_pago_id === chequeFormaPagoId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], monto };
        return next;
      }
      return [...prev, { forma_pago_id: chequeFormaPagoId, monto }];
    });
    setChequeDialogOpen(false);
  };

  const removePago = (index: number) => {
    setPagos((prev) => {
      const removed = prev[index];
      // Si se quita la transferencia, limpiar los datos del comprobante
      const fpTransf = formasPago.find(fp => fp.nombre.toLowerCase().includes('transfer'));
      if (removed && fpTransf && removed.forma_pago_id === fpTransf.id) {
        setTransferenciaData(null);
      }
      // Si se quita el cheque, limpiar los datos del cheque
      if (removed && chequeFormaPagoId && removed.forma_pago_id === chequeFormaPagoId) {
        setChequeData(null);
        setChequeFormaPagoId(null);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Nueva función para procesar venta a empleado directo a cuenta corriente
  const handleProcesarVentaEmpleado = async () => {
    if (!user) return;

    if (!cajaAbierta) {
      toast.error('Debe abrir una caja antes de realizar ventas');
      return;
    }

    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    if (!selectedEmpleado) {
      toast.error('Seleccione un empleado para la venta');
      return;
    }

    setEmitiendo(true);

    try {
      const { data: caja } = await supabase
        .from('cajas')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('estado', 'abierta')
        .single();

      if (!caja) {
        toast.error('No tiene una caja abierta');
        setEmitiendo(false);
        return;
      }

      let venta: any;

      if (editingPedidoId) {
        // Actualizar pedido existente
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            cliente_id: null,
            empleado_id: selectedEmpleado.id,
            caja_id: caja.id,
            subtotal: subtotal,
            descuento: totalDescuentos,
            total: total,
            estado: 'confirmada',
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;
        
        const { data: updatedVenta, error: fetchError } = await supabase
          .from('ventas')
          .select('*')
          .eq('id', editingPedidoId)
          .single();
          
        if (fetchError) throw fetchError;
        venta = updatedVenta;

        await supabase
          .from('venta_detalles')
          .delete()
          .eq('venta_id', editingPedidoId);

        const detalles = cart.map((item) => ({
          venta_id: venta.id,
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));

        const { error: detallesError } = await supabase
          .from('venta_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;
      } else {
        // Crear nueva venta
        const detallesPayload = cart.map((item) => ({
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('crear_venta_completa', {
          p_venta: {
            usuario_id: user.id,
            empleado_id: selectedEmpleado.id,
            caja_id: caja.id,
            subtotal,
            descuento: totalDescuentos,
            total,
            estado: 'confirmada',
          } as any,
          p_detalles: detallesPayload as any,
        });
        if (rpcErr) throw rpcErr;
        const created: any = rpcRes;
        const { data: newVenta } = await supabase
          .from('ventas').select('*').eq('id', created.id).single();
        venta = newVenta;
      }

      // NO crear venta_pagos - no hay pago

      // Actualizar stock (solo para productos reales)
      for (const item of cart) {
        if (item.producto && !item.es_temporal) {
          await supabase
            .from('productos')
            .update({ stock_actual: item.producto.stock_actual - item.cantidad })
            .eq('id', item.producto.id);

          await supabase.from('movimientos_inventario').insert([{
            producto_id: item.producto.id,
            tipo: 'salida',
            cantidad: item.cantidad,
            stock_anterior: item.producto.stock_actual,
            stock_nuevo: item.producto.stock_actual - item.cantidad,
            motivo: 'Venta a Empleado',
            usuario_id: user.id,
            venta_id: venta.id,
          }]);
        }
      }

      // Registrar movimiento en cuenta corriente del empleado
      const { error: movimientoError } = await supabase.from('empleado_movimientos').insert([{
        empleado_id: selectedEmpleado.id,
        tipo: 'compra',
        monto: total,
        concepto: `Compra - Venta #${venta.numero_comprobante}`,
        venta_id: venta.id,
        usuario_registro_id: user.id,
      }]);

      if (movimientoError) {
        console.error('Error registrando movimiento en cuenta corriente:', movimientoError);
        toast.error('Error al registrar en cuenta corriente del empleado');
        throw movimientoError;
      }

      // NO registrar movimiento de caja - no entra dinero

      // Guardar venta para el ticket
      setLastVenta({
        ...venta,
        detalles: cart.map(item => ({
          cantidad: item.cantidad,
          precio: item.precio,
          subtotal: item.subtotal,
          descuento_porcentaje: item.descuento_porcentaje,
          producto: item.producto,
          es_temporal: item.es_temporal,
          nombre_temporal: item.nombre_temporal,
        })),
        pagos: [], // Sin pagos
        cliente: null,
        empleado: selectedEmpleado,
        descuento_global: descuentoGlobal,
      });

      toast.success(`Venta #${venta.numero_comprobante} cargada a cuenta corriente de ${selectedEmpleado.nombre}`);
      
      // Limpiar todo
      setCart([]);
      setSelectedCliente(null);
      setSelectedEmpleado(null);
      setIsVentaEmpleado(false);
      setDescuentoGlobal(0);
      setEditingPedidoId(null);
      
      // Mostrar ticket
      setTicketDialogOpen(true);

      fetchData();
    } catch (error) {
      console.error('Error al procesar venta a empleado:', error);
      toast.error('Error al procesar la venta');
    } finally {
      setEmitiendo(false);
    }
  };

  // Nueva función para procesar venta a cliente directo a cuenta corriente
  const handleProcesarVentaClienteCC = async () => {
    if (!user) return;

    if (!cajaAbierta) {
      toast.error('Debe abrir una caja antes de realizar ventas');
      return;
    }

    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    if (!selectedCliente) {
      toast.error('Seleccione un cliente para la venta a cuenta corriente');
      return;
    }

    setEmitiendo(true);

    try {
      const { data: caja } = await supabase
        .from('cajas')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('estado', 'abierta')
        .single();

      if (!caja) {
        toast.error('No tiene una caja abierta');
        setEmitiendo(false);
        return;
      }

      let venta: any;

      if (editingPedidoId) {
        // Actualizar pedido existente
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            cliente_id: selectedCliente.id,
            empleado_id: null,
            caja_id: caja.id,
            subtotal: subtotal,
            descuento: totalDescuentos,
            total: total,
            estado: 'confirmada',
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;
        
        const { data: updatedVenta, error: fetchError } = await supabase
          .from('ventas')
          .select('*')
          .eq('id', editingPedidoId)
          .single();
          
        if (fetchError) throw fetchError;
        venta = updatedVenta;

        await supabase
          .from('venta_detalles')
          .delete()
          .eq('venta_id', editingPedidoId);

        const detalles = cart.map((item) => ({
          venta_id: venta.id,
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));

        const { error: detallesError } = await supabase
          .from('venta_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;
      } else {
        // Crear nueva venta
        const detallesPayload = cart.map((item) => ({
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('crear_venta_completa', {
          p_venta: {
            usuario_id: user.id,
            cliente_id: selectedCliente.id,
            caja_id: caja.id,
            subtotal,
            descuento: totalDescuentos,
            total,
            estado: 'confirmada',
          } as any,
          p_detalles: detallesPayload as any,
        });
        if (rpcErr) throw rpcErr;
        const created: any = rpcRes;
        const { data: newVenta } = await supabase
          .from('ventas').select('*').eq('id', created.id).single();
        venta = newVenta;
      }

      // NO crear venta_pagos - no hay pago

      // Actualizar stock (solo para productos reales)
      for (const item of cart) {
        if (item.producto && !item.es_temporal) {
          await supabase
            .from('productos')
            .update({ stock_actual: item.producto.stock_actual - item.cantidad })
            .eq('id', item.producto.id);

          await supabase.from('movimientos_inventario').insert([{
            producto_id: item.producto.id,
            tipo: 'salida',
            cantidad: item.cantidad,
            stock_anterior: item.producto.stock_actual,
            stock_nuevo: item.producto.stock_actual - item.cantidad,
            motivo: 'Venta a Cliente (CC)',
            usuario_id: user.id,
            venta_id: venta.id,
          }]);
        }
      }

      // Registrar movimiento en cuenta corriente del cliente
      await supabase.from('cliente_movimientos').insert([{
        cliente_id: selectedCliente.id,
        tipo: 'compra',
        monto: total,
        concepto: `Compra - Venta #${venta.numero_comprobante}`,
        venta_id: venta.id,
        usuario_registro_id: user.id,
      }]);

      // NO registrar movimiento de caja - no entra dinero

      // Guardar venta para el ticket
      setLastVenta({
        ...venta,
        detalles: cart.map(item => ({
          cantidad: item.cantidad,
          precio: item.precio,
          subtotal: item.subtotal,
          descuento_porcentaje: item.descuento_porcentaje,
          producto: item.producto,
          es_temporal: item.es_temporal,
          nombre_temporal: item.nombre_temporal,
        })),
        pagos: [], // Sin pagos
        cliente: selectedCliente,
        clienteCuentaCorriente: true,
        empleado: null,
        descuento_global: descuentoGlobal,
      });

      toast.success(`Venta #${venta.numero_comprobante} cargada a cuenta corriente de ${selectedCliente.nombre}`);
      
      // Limpiar todo
      setCart([]);
      setSelectedCliente(null);
      setClienteModalidadPago('pago_directo');
      setSelectedEmpleado(null);
      setIsVentaEmpleado(false);
      setDescuentoGlobal(0);
      setEditingPedidoId(null);
      
      // Mostrar ticket
      setTicketDialogOpen(true);

      fetchData();
    } catch (error) {
      console.error('Error al procesar venta a cliente CC:', error);
      toast.error('Error al procesar la venta');
    } finally {
      setEmitiendo(false);
    }
  };

  const handleProcesarVenta = async () => {
    if (!user) return;

    if (!cajaAbierta) {
      toast.error('Debe abrir una caja antes de realizar ventas');
      return;
    }

    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    if (totalPagado < total) {
      toast.error('El monto pagado es insuficiente');
      return;
    }

    setEmitiendo(true);

    try {
      const { data: caja } = await supabase
        .from('cajas')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('estado', 'abierta')
        .single();

      if (!caja) {
        toast.error('No tiene una caja abierta');
        setEmitiendo(false);
        return;
      }

      let venta: any;

      if (editingPedidoId) {
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            cliente_id: isVentaEmpleado ? null : (selectedCliente?.id || null),
            empleado_id: isVentaEmpleado ? (selectedEmpleado?.id || null) : null,
            caja_id: caja.id,
            subtotal: subtotal,
            descuento: totalDescuentos,
            total: totalFacturar,
            estado: 'confirmada',
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;
        
        const { data: updatedVenta, error: fetchError } = await supabase
          .from('ventas')
          .select('*')
          .eq('id', editingPedidoId)
          .single();
          
        if (fetchError) throw fetchError;
        venta = updatedVenta;

        await supabase
          .from('venta_detalles')
          .delete()
          .eq('venta_id', editingPedidoId);

        const detalles = cart.map((item) => ({
          venta_id: venta.id,
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));

        const { error: detallesError } = await supabase
          .from('venta_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;
      } else {
        const detallesPayload = cart.map((item) => ({
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));
        const pagosPayload = pagos.map((p) => ({
          forma_pago_id: p.forma_pago_id,
          monto: p.monto,
          tarjeta_id: p.tarjeta_id || null,
          cuotas: p.cuotas || null,
          coeficiente: p.coeficiente || null,
          efectivo_entregado: p.efectivo_entregado || null,
          vuelto: p.vuelto || null,
        }));
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('crear_venta_completa', {
          p_venta: {
            usuario_id: user.id,
            cliente_id: isVentaEmpleado ? null : (selectedCliente?.id || null),
            empleado_id: isVentaEmpleado ? (selectedEmpleado?.id || null) : null,
            caja_id: caja.id,
            subtotal,
            descuento: totalDescuentos,
            total: totalFacturar,
            estado: 'confirmada',
          } as any,
          p_detalles: detallesPayload as any,
          p_pagos: pagosPayload as any,
        });
        if (rpcErr) throw rpcErr;
        const created: any = rpcRes;
        const { data: newVenta } = await supabase
          .from('ventas').select('*').eq('id', created.id).single();
        venta = newVenta;
      }

      // venta_pagos: cuando es venta nueva, ya fueron insertados por la RPC.
      // Para el caso de edición de pedido existente, registramos aquí los pagos.
      if (editingPedidoId) {
        const ventaPagos = pagos.map((p) => ({
          venta_id: venta.id,
          forma_pago_id: p.forma_pago_id,
          monto: p.monto,
          tarjeta_id: p.tarjeta_id || null,
          cuotas: p.cuotas || null,
          coeficiente: p.coeficiente || null,
          efectivo_entregado: p.efectivo_entregado || null,
          vuelto: p.vuelto || null,
        }));
        const { error: pagosError } = await supabase
          .from('venta_pagos')
          .insert(ventaPagos);
        if (pagosError) throw pagosError;
      }

      // Si en la venta hay un pago con Transferencia, registrar el comprobante
      // en la tabla `transferencias` con estado 'pendiente'.
      if (transferenciaData) {
        let fotoPath: string | null = null;
        let fotoNombre: string | null = null;

        if (transferenciaData.archivo) {
          try {
            const ext = transferenciaData.archivo.name.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `transferencias/${venta.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('comprobantes-cobros')
              .upload(fileName, transferenciaData.archivo, {
                cacheControl: '3600',
                upsert: false,
                contentType: transferenciaData.archivo.type || 'image/jpeg',
              });
            if (upErr) throw upErr;
            fotoPath = fileName;
            fotoNombre = transferenciaData.archivo.name;
          } catch (upErr: any) {
            console.error('Error subiendo comprobante de transferencia:', upErr);
            toast.warning('No se pudo adjuntar el comprobante. Podés cargarlo luego desde Transferencias.');
          }
        }

        const { error: transfError } = await supabase.from('transferencias').insert([{
          fecha_transferencia: transferenciaData.fecha,
          cliente_id: selectedCliente?.id || null,
          titular_nombre: transferenciaData.titular.trim(),
          titular_cuil: transferenciaData.cuil,
          numero_operacion: transferenciaData.numero_operacion.trim(),
          importe: parseFloat(transferenciaData.importe),
          estado: 'pendiente',
          origen: 'venta',
          venta_id: venta.id,
          creado_por: user.id,
          foto_comprobante_path: fotoPath,
          foto_comprobante_nombre: fotoNombre,
        }]);

        if (transfError) {
          console.error('Error registrando transferencia:', transfError);
          toast.error('Error al registrar la transferencia: ' + transfError.message);
        } else {
          toast.success('Transferencia registrada correctamente. Quedó pendiente de validación.');
        }
      }

      // Si en la venta hay un pago con Cheque, registrar el cheque
      // en la tabla `cheques` con estado 'pendiente_validacion'.
      if (chequeData && chequeFormaPagoId) {
        const pagoCheque = pagos.find(p => p.forma_pago_id === chequeFormaPagoId);
        const montoCheque = pagoCheque?.monto ?? parseFloat(chequeData.monto.replace(',', '.'));
        const { error: chequeError } = await supabase.from('cheques').insert([{
          tipo: chequeData.tipo,
          estado: 'pendiente_validacion' as any,
          numero_cheque: chequeData.numero_cheque.trim(),
          banco: chequeData.banco.trim(),
          sucursal_banco: chequeData.sucursal_banco.trim() || null,
          emisor: chequeData.emisor.trim(),
          cuit_emisor: chequeData.cuit_emisor.trim() || null,
          cliente_id: selectedCliente?.id || null,
          monto: montoCheque,
          fecha_emision: chequeData.fecha_emision,
          fecha_vencimiento: chequeData.fecha_vencimiento,
          observaciones: chequeData.observaciones.trim() || null,
          venta_id: venta.id,
          usuario_registro_id: user.id,
        } as any]);

        if (chequeError) {
          console.error('Error registrando cheque:', chequeError);
          toast.error('Error al registrar el cheque: ' + chequeError.message);
        } else {
          toast.success('Cheque registrado. Quedó pendiente de validación.');
        }
      }

      // Update stock (only for real products)
      for (const item of cart) {
        if (item.producto && !item.es_temporal) {
          await supabase
            .from('productos')
            .update({ stock_actual: item.producto.stock_actual - item.cantidad })
            .eq('id', item.producto.id);

          await supabase.from('movimientos_inventario').insert([{
            producto_id: item.producto.id,
            tipo: 'salida',
            cantidad: item.cantidad,
            stock_anterior: item.producto.stock_actual,
            stock_nuevo: item.producto.stock_actual - item.cantidad,
            motivo: 'Venta',
            usuario_id: user.id,
            venta_id: venta.id,
          }]);
        }
      }

      // If this is an employee sale with cuenta corriente, register the movement in their account
      // For pago_directo, we do NOT create a debt movement
      if (isVentaEmpleado && selectedEmpleado && empleadoModalidadPago === 'cuenta_corriente') {
        const { error: movimientoEmpleadoError } = await supabase.from('empleado_movimientos').insert([{
          empleado_id: selectedEmpleado.id,
          tipo: 'compra',
          monto: totalFacturar,
          concepto: `Compra - Venta #${venta.numero_comprobante}`,
          venta_id: venta.id,
          usuario_registro_id: user.id,
        }]);

        if (movimientoEmpleadoError) {
          console.error('Error registrando movimiento en cuenta corriente:', movimientoEmpleadoError);
          toast.error('Error al registrar en cuenta corriente del empleado');
          throw movimientoEmpleadoError;
        }
      }

      await supabase.from('movimientos_caja').insert([{
        caja_id: caja.id,
        usuario_id: user.id,
        tipo: 'ingreso',
        concepto: `Venta #${venta.numero_comprobante}`,
        monto: totalFacturar,
        venta_id: venta.id,
      }]);

      const { data: cajaData } = await supabase
        .from('cajas')
        .select('total_ventas')
        .eq('id', caja.id)
        .maybeSingle();

      await supabase
        .from('cajas')
        .update({ total_ventas: (cajaData?.total_ventas || 0) + totalFacturar })
        .eq('id', caja.id);

      let facturaInfo = null;
      if (emitirFactura) {
        try {
          const netoSinIva = totalFacturar / 1.21;
          const ivaAmount = totalFacturar - netoSinIva;

          const { data: facturaResult, error: facturaError } = await supabase.functions.invoke(
            'afip-facturacion/emitir',
            {
              body: {
                tipo_comprobante: facturaData.tipo_comprobante,
                punto_venta: comercioConfig?.punto_venta || 1,
                concepto: 1,
                doc_tipo: facturaData.doc_tipo,
                doc_nro: parseInt(facturaData.doc_nro) || 0,
                condicion_iva_receptor: facturaData.condicion_iva_receptor,
                importe_total: totalFacturar,
                importe_neto: parseFloat(netoSinIva.toFixed(2)),
                importe_iva: parseFloat(ivaAmount.toFixed(2)),
                items: cart.map(item => ({
                  descripcion: item.es_temporal ? item.nombre_temporal : item.producto?.descripcion,
                  cantidad: item.cantidad,
                  precio_unitario: item.precio / 1.21,
                  iva_id: 5,
                })),
                venta_id: venta.id,
              },
            }
          );

          if (facturaError) {
            toast.error('Error al emitir factura AFIP: ' + facturaError.message);
          } else if (facturaResult?.error) {
            toast.error('Error AFIP: ' + facturaResult.error);
          } else {
            const formatFechaAfip = (fecha: string): string => {
              if (fecha && fecha.length === 8) {
                return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
              }
              return fecha || new Date().toISOString().split('T')[0];
            };
            
            // Combinar datos de AFIP con los importes calculados
            facturaInfo = {
              ...facturaResult,
              cae_vencimiento: formatFechaAfip(facturaResult.cae_vencimiento),
              importe_total: totalFacturar,
              importe_neto: parseFloat(netoSinIva.toFixed(2)),
              importe_iva: parseFloat(ivaAmount.toFixed(2)),
            };
            
            const { error: insertCompError } = await supabase
              .from('comprobantes_afip')
              .insert({
                tipo_comprobante: facturaData.tipo_comprobante,
                punto_venta: facturaInfo.punto_venta,
                numero_comprobante: facturaInfo.numero_comprobante,
                cae: facturaInfo.cae,
                cae_vencimiento: facturaInfo.cae_vencimiento,
                cuit_emisor: comercioConfig?.cuit?.replace(/\D/g, '') || '',
                doc_tipo: facturaData.doc_tipo,
                doc_nro: parseInt(facturaData.doc_nro) || 0,
                importe_total: facturaInfo.importe_total,
                importe_neto: facturaInfo.importe_neto,
                importe_iva: facturaInfo.importe_iva,
                usuario_id: user.id,
                venta_id: venta.id,
              });
            
            if (insertCompError) {
              console.error('Error guardando comprobante en DB:', insertCompError);
              toast.warning(`Factura emitida (CAE: ${facturaResult.cae}) pero hubo error al guardar en base de datos: ${insertCompError.message}`);
            } else {
              toast.success(`Factura emitida - CAE: ${facturaResult.cae}`);
            }
          }
        } catch (facturaErr: any) {
          toast.error('Error al emitir factura: ' + facturaErr.message);
        }
      }

      setLastVenta({ 
        ...venta, 
        detalles: cart, 
        pagos, 
        cliente: isVentaEmpleado ? null : selectedCliente, 
        empleado: isVentaEmpleado ? selectedEmpleado : null,
        empleadoPagoDirecto: isVentaEmpleado && empleadoModalidadPago === 'pago_directo',
        factura: facturaInfo 
      });
      
      setCart([]);
      setPagos([]);
      setSelectedCliente(null);
      setSelectedEmpleado(null);
      setIsVentaEmpleado(false);
      setEmpleadoModalidadPago('cuenta_corriente');
      setEditingPedidoId(null);
      setDescuentoGlobal(0);
      setPagoDialogOpen(false);
      setFacturaDialogOpen(false);
      setTicketDialogOpen(true);
      setTransferenciaData(null);
      
      toast.success('Venta procesada correctamente');
      fetchData();
      fetchPedidos();
    } catch (error) {
      console.error('Error processing sale:', error);
      toast.error('Error al procesar la venta');
    } finally {
      setEmitiendo(false);
    }
  };

  const fetchPedidos = async () => {
    if (!user) return;
    setLoadingPedidos(true);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          clientes(id, nombre, dni_cuit, condicion_iva),
          empleados(id, nombre, dni),
          venta_detalles(*, productos(id, codigo_articulo, descripcion, stock_actual, unidad_medida, precio_costo))
        `)
        .eq('estado', 'pedido')
        .eq('anulada', false)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      toast.error('Error al cargar los pedidos');
    } finally {
      setLoadingPedidos(false);
    }
  };

  const handleGuardarPedido = async () => {
    if (!user) return;
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setGuardandoPedido(true);

    try {
      if (editingPedidoId) {
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            cliente_id: isVentaEmpleado ? null : (selectedCliente?.id || null),
            empleado_id: isVentaEmpleado ? (selectedEmpleado?.id || null) : null,
            subtotal: subtotal,
            descuento: totalDescuentos,
            total: total,
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;

        await supabase
          .from('venta_detalles')
          .delete()
          .eq('venta_id', editingPedidoId);

        const detalles = cart.map((item) => ({
          venta_id: editingPedidoId,
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));

        const { error: detallesError } = await supabase
          .from('venta_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;

        toast.success('Pedido actualizado correctamente');
        setEditingPedidoId(null);
      } else {
        const detallesPayload = cart.map((item) => ({
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('crear_venta_completa', {
          p_venta: {
            usuario_id: user.id,
            cliente_id: isVentaEmpleado ? null : (selectedCliente?.id || null),
            empleado_id: isVentaEmpleado ? (selectedEmpleado?.id || null) : null,
            subtotal,
            descuento: totalDescuentos,
            total,
            estado: 'pedido',
          } as any,
          p_detalles: detallesPayload as any,
        });
        if (rpcErr) throw rpcErr;
        const created: any = rpcRes;
        toast.success(`Pedido #${created.numero_comprobante} guardado correctamente`);
      }

      setCart([]);
      setSelectedCliente(null);
      setSelectedEmpleado(null);
      setIsVentaEmpleado(false);
      setDescuentoGlobal(0);
    } catch (error) {
      toast.error('Error al guardar el pedido');
    } finally {
      setGuardandoPedido(false);
    }
  };

  const handleCargarPedido = (pedido: any) => {
    // Handle employee or client
    if (pedido.empleados) {
      setSelectedEmpleado({
        id: pedido.empleados.id,
        nombre: pedido.empleados.nombre,
        dni: pedido.empleados.dni,
        activo: true,
      });
      setSelectedCliente(null);
      setIsVentaEmpleado(true);
    } else if (pedido.clientes) {
      setSelectedCliente({
        id: pedido.clientes.id,
        nombre: pedido.clientes.nombre,
        dni_cuit: pedido.clientes.dni_cuit,
        condicion_iva: pedido.clientes.condicion_iva,
      });
      setSelectedEmpleado(null);
      setIsVentaEmpleado(false);
    } else {
      setSelectedCliente(null);
      setSelectedEmpleado(null);
      setIsVentaEmpleado(false);
    }

    const cartItems: CartItem[] = pedido.venta_detalles.map((detalle: any) => {
      if (detalle.producto_temporal_nombre) {
        return {
          id: crypto.randomUUID(),
          cantidad: detalle.cantidad,
          precio: detalle.producto_temporal_precio || detalle.precio_unitario,
          subtotal: detalle.subtotal,
          descuento_porcentaje: detalle.descuento_porcentaje || 0,
          es_temporal: true,
          nombre_temporal: detalle.producto_temporal_nombre,
        };
      }
      return {
        id: crypto.randomUUID(),
        producto: {
          id: detalle.productos.id,
          codigo_articulo: detalle.productos.codigo_articulo,
          descripcion: detalle.productos.descripcion,
          stock_actual: detalle.productos.stock_actual,
          unidad_medida: detalle.productos.unidad_medida,
          precio_costo: detalle.productos.precio_costo,
        },
        cantidad: detalle.cantidad,
        precio: detalle.precio_unitario,
        subtotal: detalle.subtotal,
        descuento_porcentaje: detalle.descuento_porcentaje || 0,
      };
    });

    setCart(cartItems);
    setEditingPedidoId(pedido.id);
    setPedidosDialogOpen(false);
    toast.info(`Pedido #${pedido.numero_comprobante} cargado para edición`);
  };

  const handleEliminarPedido = async (pedidoId: string) => {
    try {
      await supabase
        .from('venta_detalles')
        .delete()
        .eq('venta_id', pedidoId);

      await supabase
        .from('ventas')
        .update({ anulada: true, motivo_anulacion: 'Pedido cancelado' })
        .eq('id', pedidoId);

      toast.success('Pedido eliminado');
      fetchPedidos();
    } catch (error) {
      toast.error('Error al eliminar el pedido');
    }
  };

  const handleImprimirPedido = (pedido: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pedido #${pedido.numero_comprobante}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 16px;
            line-height: 1.3;
            width: 72mm; 
            margin: 0 auto; 
            padding: 2mm;
          }
          .header { text-align: center; margin-bottom: 8px; }
          .header h2 { margin: 0; font-size: 14px; }
          .header p { margin: 2px 0; }
          .section { border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 4px; }
          .item { 
            margin: 4px 0; 
            border-bottom: 1px dotted #ccc;
            padding-bottom: 4px;
          }
          .item-name { 
            word-wrap: break-word; 
            display: block;
          }
          .item-price { 
            text-align: right; 
            display: block;
          }
          .total { 
            font-weight: bold; 
            margin-top: 8px; 
            border-top: 1px dashed #000; 
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
          }
          .footer { text-align: center; margin-top: 8px; font-size: 11px; }
          @media print { 
            body { margin: 0; } 
            html, body { width: 80mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PEDIDO</h2>
          <p>#${String(pedido.numero_comprobante).padStart(8, '0')}</p>
          <p>${new Date(pedido.fecha).toLocaleString('es-AR')}</p>
        </div>
        <div class="section">
          <strong>Cliente:</strong> ${pedido.clientes?.nombre || 'Consumidor Final'}
        </div>
        ${pedido.venta_detalles.map((d: any) => `
          <div class="item">
            <span class="item-name">${d.cantidad}x ${d.producto_temporal_nombre || d.productos?.descripcion || 'Producto'}</span>
            <span class="item-price">$${d.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
        `).join('')}
        <div class="total">
          <span>TOTAL</span>
          <span>$${pedido.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="footer">
          <p>*** PEDIDO PENDIENTE ***</p>
        </div>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleImprimirTicket = () => {
    if (!lastVenta) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }

    const CONDICIONES_IVA_MAP: { [key: number]: string } = {
      1: 'IVA Resp. Inscripto',
      4: 'Exento',
      5: 'Consumidor Final',
      6: 'Monotributista'
    };

    const formatCuit = (cuit: string) => {
      if (!cuit) return '';
      const clean = cuit.replace(/\D/g, '');
      if (clean.length === 11) {
        return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
      }
      return cuit;
    };

    let detallesHtml = '';
    lastVenta.detalles.forEach((item: CartItem) => {
      const nombre = item.es_temporal ? item.nombre_temporal : item.producto?.descripcion;
      detallesHtml += `
        <div class="item">
          <span class="item-name">${nombre}</span>
          <div class="item-details">
            <span>${item.cantidad} x $${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            <span>$${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          ${item.descuento_porcentaje > 0 ? `<div class="item-discount">Desc: ${item.descuento_porcentaje}%</div>` : ''}
        </div>
      `;
    });

    let html = '';

    if (lastVenta.factura) {
      // Factura electrónica
      const tipoLetra = lastVenta.factura.tipo_comprobante === 1 ? 'A' : lastVenta.factura.tipo_comprobante === 6 ? 'B' : 'C';
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Factura ${tipoLetra} ${String(lastVenta.factura.punto_venta).padStart(4, '0')}-${String(lastVenta.factura.numero_comprobante).padStart(8, '0')}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 16px;
              line-height: 1.3;
              width: 72mm; 
              margin: 0 auto; 
              padding: 2mm;
            }
            .header { text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .header h2 { margin: 0 0 4px 0; font-size: 18px; }
            .header p { margin: 1px 0; font-size: 14px; }
            .tipo-box { border: 1px solid #000; display: inline-block; padding: 4px 12px; margin: 4px 0; font-size: 20px; font-weight: bold; }
            .section { border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 4px; font-size: 14px; }
            .item { margin: 4px 0; padding-bottom: 4px; }
            .item-name { display: block; word-wrap: break-word; font-weight: bold; }
            .item-details { display: flex; justify-content: space-between; font-size: 14px; }
            .item-discount { text-align: right; font-size: 12px; }
            .totals { text-align: right; font-size: 16px; margin-top: 4px; }
            .total { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
            .footer { text-align: center; margin-top: 8px; font-size: 12px; }
            .cae { font-weight: bold; }
            @media print { body { margin: 0; } html, body { width: 80mm; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${comercioConfig?.nombre_fantasia || comercioConfig?.razon_social || 'EMPRESA'}</h2>
            <p>${comercioConfig?.razon_social || ''}</p>
            <p>${comercioConfig?.direccion || ''}</p>
            ${comercioConfig?.localidad ? `<p>${comercioConfig.localidad}${comercioConfig.provincia ? `, ${comercioConfig.provincia}` : ''}</p>` : ''}
            <p>CUIT: ${formatCuit(comercioConfig?.cuit || '')}</p>
            <p>${comercioConfig?.condicion_iva || 'IVA Resp. Inscripto'}</p>
            <div class="tipo-box">${tipoLetra}</div>
            <p style="font-weight: bold; font-size: 11px;">FACTURA ${tipoLetra}</p>
            <p style="font-weight: bold;">Nº ${String(lastVenta.factura.punto_venta).padStart(4, '0')}-${String(lastVenta.factura.numero_comprobante).padStart(8, '0')}</p>
            <p>Fecha: ${new Date(lastVenta.fecha).toLocaleString('es-AR')}</p>
          </div>
          <div class="section">
            ${lastVenta.empleado ? `
              <p><strong>Empleado:</strong> ${lastVenta.empleado.nombre}</p>
              ${lastVenta.empleado.dni ? `<p><strong>DNI:</strong> ${lastVenta.empleado.dni}</p>` : ''}
              <p style="font-size: 8px;">(Cuenta Corriente)</p>
            ` : `
              <p><strong>Cliente:</strong> ${lastVenta.cliente?.nombre || 'Consumidor Final'}</p>
              <p><strong>CUIT/DNI:</strong> ${lastVenta.cliente?.dni_cuit || lastVenta.factura?.doc_nro || 'Sin identificar'}</p>
              <p><strong>IVA:</strong> ${lastVenta.cliente ? (CONDICIONES_IVA_MAP[lastVenta.cliente.condicion_iva] || 'Cons. Final') : 'Cons. Final'}</p>
            `}
            <p><strong>Cond. Venta:</strong> ${lastVenta.empleado ? 'Cuenta Corriente' : 'Contado'}</p>
          </div>
          <div class="section">
            <p style="font-weight: bold; text-align: center;">DETALLE</p>
            ${detallesHtml}
          </div>
          <div class="totals">
            <p>Neto Gravado: $${lastVenta.factura.importe_neto?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}</p>
            <p>IVA 21%: $${lastVenta.factura.importe_iva?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}</p>
            <p class="total">TOTAL: $${lastVenta.factura.importe_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || lastVenta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div class="footer">
            <p class="cae">CAE: ${lastVenta.factura.cae}</p>
            <p>Vto. CAE: ${lastVenta.factura.cae_vencimiento}</p>
            <p style="margin-top: 4px;">Comprobante Autorizado - AFIP</p>
            <p>www.afip.gob.ar/fe/qr/</p>
            <p style="margin-top: 8px;">¡Gracias por su compra!</p>
          </div>
          <script>window.print(); window.close();</script>
        </body>
        </html>
      `;
    } else {
      // Ticket simple
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ticket #${lastVenta.numero_comprobante}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 16px;
              line-height: 1.3;
              width: 72mm; 
              margin: 0 auto; 
              padding: 2mm;
            }
            .header { text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .header h2 { margin: 0 0 4px 0; font-size: 18px; }
            .header p { margin: 1px 0; font-size: 14px; }
            .section { border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 4px; font-size: 14px; }
            .item { margin: 4px 0; padding-bottom: 4px; }
            .item-name { display: block; word-wrap: break-word; }
            .item-details { display: flex; justify-content: space-between; font-size: 14px; }
            .item-discount { text-align: right; font-size: 12px; }
            .total { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; text-align: center; }
            .footer { text-align: center; margin-top: 8px; font-size: 14px; }
            @media print { body { margin: 0; } html, body { width: 80mm; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${comercioConfig?.nombre_fantasia || comercioConfig?.razon_social || 'TICKET'}</h2>
            ${comercioConfig?.direccion ? `<p>${comercioConfig.direccion}</p>` : ''}
            ${comercioConfig?.telefono ? `<p>Tel: ${comercioConfig.telefono}</p>` : ''}
            <p style="font-weight: bold; font-size: 11px;">TICKET #${lastVenta.numero_comprobante}</p>
            <p>${new Date(lastVenta.fecha).toLocaleString('es-AR')}</p>
          </div>
          <div class="section">
            ${lastVenta.empleado ? `
              <p><strong>Empleado:</strong> ${lastVenta.empleado.nombre}</p>
              ${lastVenta.empleado.dni ? `<p><strong>DNI:</strong> ${lastVenta.empleado.dni}</p>` : ''}
              <p style="font-size: 8px;">(Cuenta Corriente)</p>
            ` : `
              <p><strong>Cliente:</strong> ${lastVenta.cliente?.nombre || 'Consumidor Final'}</p>
            `}
          </div>
          <div class="section">
            ${detallesHtml}
          </div>
          ${lastVenta.descuento > 0 ? `<p style="text-align: right; font-size: 9px;">Descuento: -$${lastVenta.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>` : ''}
          <div class="total">
            TOTAL: $${lastVenta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div class="footer">
            <p>¡Gracias por su compra!</p>
          </div>
          <script>window.print(); window.close();</script>
        </body>
        </html>
      `;
    }

    printWindow.document.write(html);
    printWindow.document.close();
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-[calc(100vh-2rem)] flex gap-4">
        {/* Left Panel - Product Search */}
        <div className="flex-1 flex flex-col">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Punto de Venta</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProductoTemporalDialogOpen(true)}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    Producto Libre
                  </Button>
                  <Select 
                    value={selectedLista?.id || ''} 
                    onValueChange={(id) => {
                      const lista = listasPrecios.find(l => l.id === id);
                      setSelectedLista(lista || null);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Lista de precios" />
                    </SelectTrigger>
                    <SelectContent>
                      {listasPrecios.map((lista) => (
                        <SelectItem key={lista.id} value={lista.id}>
                          {lista.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Buscar producto por código o descripción..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowAllResults(false);
                    }}
                  />
                </div>
                <Button 
                  variant="default"
                  onClick={() => setProductSearchModalOpen(true)}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
              
              {/* Quick Search Results - mantener para búsqueda rápida inline */}
              {filteredProductos.length > 0 && searchTerm && (
                <Card className="absolute z-10 mt-1 w-full max-w-xl shadow-lg bg-background">
                  <ScrollArea className="max-h-60">
                    {filteredProductos.slice(0, 4).map((producto) => (
                      <div
                        key={producto.id}
                        className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                        onClick={() => addToCart(producto)}
                      >
                        <div>
                          <p className="font-medium">{producto.descripcion}</p>
                          <p className="text-sm text-muted-foreground">
                            {producto.codigo_articulo} | Stock: {producto.stock_actual} {producto.unidad_medida}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            ${getProductoPrice(producto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                          <Button size="sm" variant="ghost">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {totalResults > 4 && (
                      <div 
                        className="p-3 text-center text-primary hover:bg-muted cursor-pointer font-medium"
                        onClick={() => {
                          setProductSearchModalOpen(true);
                          setSearchTerm('');
                        }}
                      >
                        <Search className="h-4 w-4 inline mr-1" />
                        Ver todos los {totalResults} resultados
                      </div>
                    )}
                  </ScrollArea>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Cart Items */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito ({cart.length} items)
                </CardTitle>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => { setCart([]); setDescuentoGlobal(0); }}>
                    Vaciar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mb-2" />
                    <p>El carrito está vacío</p>
                    <p className="text-sm">Busque productos para agregar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => {
                      const esPorPeso = item.producto && isProductoPorPeso(item.producto);
                      const nombreProducto = item.es_temporal ? item.nombre_temporal : item.producto?.descripcion;
                      const totalSinDescuento = item.cantidad * item.precio;
                      const montoDescuento = totalSinDescuento * (item.descuento_porcentaje / 100);
                      const maxDescuento = getDescuentoMaximo();
                      
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-muted/50 rounded-lg border"
                        >
                          {/* Header: Nombre y badges */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                              <p className="font-medium truncate">{nombreProducto}</p>
                              {item.es_temporal && (
                                <Badge variant="secondary" className="text-xs shrink-0">Libre</Badge>
                              )}
                              {esPorPeso && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  <Scale className="h-3 w-3 mr-1" />
                                  KG
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive shrink-0 ml-2"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {/* Tabla de columnas */}
                          <div className="grid grid-cols-6 gap-1 text-xs">
                            {/* Headers */}
                            <div className="text-muted-foreground font-medium text-center">P.Unit</div>
                            <div className="text-muted-foreground font-medium text-center">Cant.</div>
                            <div className="text-muted-foreground font-medium text-center">Subtotal</div>
                            <div className="text-muted-foreground font-medium text-center">Desc.%</div>
                            <div className="text-muted-foreground font-medium text-center">Desc.$</div>
                            <div className="text-muted-foreground font-medium text-center">Total</div>
                            
                            {/* Values */}
                            <div className="text-center py-1">
                              ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-center py-1">
                              <Input
                                type="text"
                                inputMode={esPorPeso ? "decimal" : "numeric"}
                                className="h-6 w-full text-center text-xs p-1 text-foreground"
                                value={editingCantidadItem === item.id ? cantidadInput : (esPorPeso ? item.cantidad.toLocaleString('es-AR', { minimumFractionDigits: 3 }) : item.cantidad.toString())}
                                onFocus={() => {
                                  setEditingCantidadItem(item.id);
                                  setCantidadInput(esPorPeso ? item.cantidad.toString().replace('.', ',') : item.cantidad.toString());
                                }}
                                onChange={(e) => setCantidadInput(e.target.value)}
                                onBlur={() => {
                                  if (editingCantidadItem === item.id) {
                                    const cantidadNormalizada = cantidadInput.replace(',', '.');
                                    const cantidad = parseFloat(cantidadNormalizada);
                                    if (!isNaN(cantidad) && cantidad > 0) {
                                      updateCantidadDirecta(item.id, cantidad);
                                    }
                                    setEditingCantidadItem(null);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const cantidadNormalizada = cantidadInput.replace(',', '.');
                                    const cantidad = parseFloat(cantidadNormalizada);
                                    if (!isNaN(cantidad) && cantidad > 0) {
                                      updateCantidadDirecta(item.id, cantidad);
                                    }
                                    setEditingCantidadItem(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingCantidadItem(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                            </div>
                            <div className="text-center py-1">
                              ${totalSinDescuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-center py-1">
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="h-6 w-full text-center text-xs p-1 text-foreground"
                                value={editingDescuentoItem === item.id ? descuentoInput : item.descuento_porcentaje.toString()}
                                onFocus={() => {
                                  setEditingDescuentoItem(item.id);
                                  setDescuentoInput(item.descuento_porcentaje.toString());
                                }}
                                onChange={(e) => setDescuentoInput(e.target.value)}
                                onBlur={() => {
                                  if (editingDescuentoItem === item.id) {
                                    const descuento = parseFloat(descuentoInput.replace(',', '.'));
                                    if (!isNaN(descuento) && descuento >= 0) {
                                      tryApplyDescuentoItem(item.id, descuento);
                                    }
                                    setEditingDescuentoItem(null);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const descuento = parseFloat(descuentoInput.replace(',', '.'));
                                    if (!isNaN(descuento) && descuento >= 0) {
                                      tryApplyDescuentoItem(item.id, descuento);
                                    }
                                    setEditingDescuentoItem(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingDescuentoItem(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                            </div>
                            <div className="text-center py-1 text-destructive">
                              {montoDescuento > 0 ? `-$${montoDescuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                            </div>
                            <div className="text-center py-1 font-bold text-primary text-sm">
                              ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Summary & Payment */}
        <div className="w-80 flex flex-col gap-4">
          {/* Client/Employee Selection */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              {/* Toggle between client and employee sale */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch 
                    id="venta-empleado" 
                    checked={isVentaEmpleado}
                    onCheckedChange={(checked) => {
                      setIsVentaEmpleado(checked);
                      if (checked) {
                        setSelectedCliente(null);
                        setEmpleadoModalidadPago('cuenta_corriente'); // Reset to default
                      } else {
                        setSelectedEmpleado(null);
                        setEmpleadoModalidadPago('cuenta_corriente'); // Reset to default
                      }
                    }}
                  />
                  <Label htmlFor="venta-empleado" className="text-sm font-medium cursor-pointer">
                    Venta a Empleado
                  </Label>
                </div>
                {isVentaEmpleado && selectedEmpleado && (
                  <Badge 
                    variant={empleadoModalidadPago === 'cuenta_corriente' ? 'secondary' : 'default'} 
                    className="text-xs"
                  >
                    {empleadoModalidadPago === 'cuenta_corriente' ? (
                      <>
                        <Wallet className="h-3 w-3 mr-1" />
                        CC
                      </>
                    ) : (
                      <>
                        <CreditCardIcon className="h-3 w-3 mr-1" />
                        Pago
                      </>
                    )}
                  </Badge>
                )}
              </div>

              {isVentaEmpleado ? (
                // Employee selection
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      <span className="text-sm font-medium">Empleado</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEmpleadoDialogOpen(true)}>
                      {selectedEmpleado ? 'Cambiar' : 'Seleccionar'}
                    </Button>
                  </div>
                  {selectedEmpleado ? (
                    <div className="p-2 bg-primary/10 border border-primary/30 rounded space-y-2">
                      <div>
                        <p className="font-medium">{selectedEmpleado.nombre}</p>
                        {selectedEmpleado.dni && (
                          <p className="text-sm text-muted-foreground">DNI: {selectedEmpleado.dni}</p>
                        )}
                      </div>
                      <RadioGroup 
                        value={empleadoModalidadPago} 
                        onValueChange={(value: 'cuenta_corriente' | 'pago_directo') => setEmpleadoModalidadPago(value)}
                        className="space-y-2"
                      >
                        <div className="flex items-start space-x-2 p-2 rounded border border-muted hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem value="cuenta_corriente" id="modalidad-cc" className="mt-0.5" />
                          <Label htmlFor="modalidad-cc" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-primary" />
                              <span className="font-medium">Cuenta Corriente</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Carga el total como deuda</p>
                          </Label>
                        </div>
                        <div className="flex items-start space-x-2 p-2 rounded border border-muted hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem value="pago_directo" id="modalidad-pago" className="mt-0.5" />
                          <Label htmlFor="modalidad-pago" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <CreditCardIcon className="h-4 w-4 text-success" />
                              <span className="font-medium">Pago Directo</span>
                            </div>
                            <p className="text-xs text-muted-foreground">El empleado paga ahora</p>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ) : (
                    <p className="text-sm text-destructive">Seleccione un empleado</p>
                  )}
                </>
              ) : (
                // Client selection
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="text-sm font-medium">Cliente</span>
                    </div>
                    {selectedCliente && (
                      <Badge 
                        variant={clienteModalidadPago === 'pago_directo' ? 'default' : 'secondary'} 
                        className="text-xs"
                      >
                        {clienteModalidadPago === 'pago_directo' ? (
                          <>
                            <CreditCardIcon className="h-3 w-3 mr-1" />
                            Pago
                          </>
                        ) : (
                          <>
                            <Wallet className="h-3 w-3 mr-1" />
                            CC
                          </>
                        )}
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setClienteDialogOpen(true)}>
                      {selectedCliente ? 'Cambiar' : 'Seleccionar'}
                    </Button>
                  </div>
                  {selectedCliente ? (
                    <div className="p-2 bg-muted border rounded space-y-2">
                      <div>
                        <p className="font-medium">{selectedCliente.nombre}</p>
                        {selectedCliente.dni_cuit && (
                          <p className="text-sm text-muted-foreground">{selectedCliente.dni_cuit}</p>
                        )}
                      </div>
                      <RadioGroup 
                        value={clienteModalidadPago} 
                        onValueChange={(value: 'pago_directo' | 'cuenta_corriente') => setClienteModalidadPago(value)}
                        className="space-y-2"
                      >
                        <div className="flex items-start space-x-2 p-2 rounded border border-muted hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem value="pago_directo" id="cliente-modalidad-pago" className="mt-0.5" />
                          <Label htmlFor="cliente-modalidad-pago" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <CreditCardIcon className="h-4 w-4 text-primary" />
                              <span className="font-medium">Pago Directo</span>
                            </div>
                            <p className="text-xs text-muted-foreground">El cliente paga ahora</p>
                          </Label>
                        </div>
                        <div className="flex items-start space-x-2 p-2 rounded border border-muted hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem
                            value="cuenta_corriente"
                            id="cliente-modalidad-cc"
                            className="mt-0.5"
                            disabled={selectedCliente?.permite_cuenta_corriente === false}
                          />
                          <Label htmlFor="cliente-modalidad-cc" className={`flex-1 cursor-pointer ${selectedCliente?.permite_cuenta_corriente === false ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-secondary-foreground" />
                              <span className="font-medium">Cuenta Corriente</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {selectedCliente?.permite_cuenta_corriente === false
                                ? 'Cliente sin habilitación de CC'
                                : 'Carga el total como deuda'}
                            </p>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Consumidor Final</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                {totalDescuentosProductos > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desc. productos</span>
                    <span>-${totalDescuentosProductos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                
                {/* Descuento Global */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Desc. global %</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-7 w-16 text-center text-xs p-1"
                      value={editingDescuentoGlobal ? descuentoGlobalInput : descuentoGlobal.toString()}
                      onFocus={() => {
                        setEditingDescuentoGlobal(true);
                        setDescuentoGlobalInput(descuentoGlobal.toString());
                      }}
                      onChange={(e) => setDescuentoGlobalInput(e.target.value)}
                      onBlur={() => {
                        const descuento = parseFloat(descuentoGlobalInput.replace(',', '.'));
                        if (!isNaN(descuento) && descuento >= 0) {
                          tryApplyDescuentoGlobal(descuento);
                        }
                        setEditingDescuentoGlobal(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const descuento = parseFloat(descuentoGlobalInput.replace(',', '.'));
                          if (!isNaN(descuento) && descuento >= 0) {
                            tryApplyDescuentoGlobal(descuento);
                          }
                          setEditingDescuentoGlobal(false);
                          (e.target as HTMLInputElement).blur();
                        }
                        if (e.key === 'Escape') {
                          setEditingDescuentoGlobal(false);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                    <span>%</span>
                  </div>
                </div>
                
                {montoDescuentoGlobal > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desc. global</span>
                    <span>-${montoDescuentoGlobal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL</span>
                  <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Button */}
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full"
              disabled={cart.length === 0 || !cajaAbierta || (isVentaEmpleado && !selectedEmpleado) || (!isVentaEmpleado && selectedCliente && clienteModalidadPago === 'cuenta_corriente' && !selectedCliente) || emitiendo}
              onClick={() => {
                if (isVentaEmpleado) {
                  if (!selectedEmpleado) {
                    toast.error('Seleccione un empleado para la venta');
                    return;
                  }
                  if (empleadoModalidadPago === 'cuenta_corriente') {
                    // Procesar directo a cuenta corriente
                    handleProcesarVentaEmpleado();
                  } else {
                    // Pago directo: abrir diálogo de pagos normal
                    setPagos([]);
                    setPagoDialogOpen(true);
                  }
                } else if (selectedCliente && clienteModalidadPago === 'cuenta_corriente') {
                  // Cliente con cuenta corriente
                  handleProcesarVentaClienteCC();
                } else {
                  // Flujo normal de pago
                  setPagos([]);
                  setPagoDialogOpen(true);
                }
              }}
            >
              {isVentaEmpleado ? (
                empleadoModalidadPago === 'cuenta_corriente' ? (
                  <>
                    <Wallet className="mr-2 h-5 w-5" />
                    {emitiendo ? 'Procesando...' : `Cargar a CC $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    {emitiendo ? 'Procesando...' : `Cobrar $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                  </>
                )
              ) : selectedCliente && clienteModalidadPago === 'cuenta_corriente' ? (
                <>
                  <Wallet className="mr-2 h-5 w-5" />
                  {emitiendo ? 'Procesando...' : `Cargar a CC $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-5 w-5" />
                  Cobrar ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </>
              )}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={cart.length === 0}
                onClick={handleGuardarPedido}
              >
                {guardandoPedido ? (
                  'Guardando...'
                ) : editingPedidoId ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Actualizar
                  </>
                ) : (
                  <>
                    <ClipboardList className="mr-1 h-4 w-4" />
                    Pedido
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  fetchPedidos();
                  setPedidosDialogOpen(true);
                }}
              >
                <Edit className="mr-1 h-4 w-4" />
                Ver Pedidos
              </Button>
            </div>

            {editingPedidoId && (
              <div className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/30 rounded text-sm">
                <span className="text-amber-600 dark:text-amber-400">Editando pedido</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => {
                    setEditingPedidoId(null);
                    setCart([]);
                    setSelectedCliente(null);
                    setSelectedEmpleado(null);
                    setIsVentaEmpleado(false);
                    setEmpleadoModalidadPago('cuenta_corriente');
                    setClienteModalidadPago('pago_directo');
                    setDescuentoGlobal(0);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {!cajaAbierta && (
            <p className="text-sm text-destructive text-center">
              Debe abrir una caja para realizar ventas
            </p>
          )}
        </div>
      </div>

      {/* Client Selection Dialog */}
      <Dialog open={clienteDialogOpen} onOpenChange={(open) => {
        setClienteDialogOpen(open);
        if (!open) {
          setClienteSearchTerm('');
          setClienteSearchResults([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar Cliente</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o DNI/CUIT (mín. 2 caracteres)..."
              value={clienteSearchTerm}
              onChange={(e) => setClienteSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-80">
            {!clienteSearchTerm && (
              <div
                className="p-3 hover:bg-muted cursor-pointer rounded"
                onClick={() => {
                  setSelectedCliente(null);
                  setClienteDialogOpen(false);
                  setClienteSearchTerm('');
                }}
              >
                <p className="font-medium">Consumidor Final</p>
              </div>
            )}
            {clienteSearchLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Buscando...
              </p>
            )}
            {!clienteSearchLoading && clienteSearchTerm && clienteSearchTerm.length >= 2 && clienteSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No se encontraron clientes
              </p>
            )}
            {!clienteSearchLoading && clienteSearchTerm && clienteSearchTerm.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ingrese al menos 2 caracteres para buscar
              </p>
            )}
            {clienteSearchResults.map((cliente) => (
              <div
                key={cliente.id}
                className="p-3 hover:bg-muted cursor-pointer rounded border-t"
                onClick={() => {
                  setSelectedCliente(cliente);
                  setClienteDialogOpen(false);
                  setClienteSearchTerm('');
                  setClienteSearchResults([]);
                }}
              >
                <p className="font-medium">{cliente.nombre}</p>
                {cliente.dni_cuit && (
                  <p className="text-sm text-muted-foreground">{cliente.dni_cuit}</p>
                )}
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Employee Selection Dialog */}
      <Dialog open={empleadoDialogOpen} onOpenChange={(open) => {
        setEmpleadoDialogOpen(open);
        if (!open) {
          setEmpleadoSearchTerm('');
          setEmpleadoSearchResults([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Seleccionar Empleado
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o DNI (mín. 2 caracteres)..."
              value={empleadoSearchTerm}
              onChange={(e) => setEmpleadoSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-80">
            {empleadoSearchLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Buscando...
              </p>
            )}
            {!empleadoSearchLoading && empleadoSearchTerm && empleadoSearchTerm.length >= 2 && empleadoSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No se encontraron empleados
              </p>
            )}
            {!empleadoSearchLoading && empleadoSearchTerm && empleadoSearchTerm.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ingrese al menos 2 caracteres para buscar
              </p>
            )}
            {!empleadoSearchTerm && empleados.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                <p>No hay empleados registrados</p>
                <p className="text-sm">Agregue empleados desde el módulo de Empleados</p>
              </div>
            )}
            {!empleadoSearchTerm && empleados.slice(0, 10).map((empleado) => (
              <div
                key={empleado.id}
                className="p-3 hover:bg-muted cursor-pointer rounded border-b last:border-0"
                onClick={() => {
                  setSelectedEmpleado(empleado);
                  setEmpleadoDialogOpen(false);
                  setEmpleadoSearchTerm('');
                }}
              >
                <p className="font-medium">{empleado.nombre}</p>
                {empleado.dni && (
                  <p className="text-sm text-muted-foreground">DNI: {empleado.dni}</p>
                )}
              </div>
            ))}
            {!empleadoSearchTerm && empleados.length > 10 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Mostrando primeros 10. Use el buscador para encontrar más.
              </p>
            )}
            {empleadoSearchResults.map((empleado) => (
              <div
                key={empleado.id}
                className="p-3 hover:bg-muted cursor-pointer rounded border-t"
                onClick={() => {
                  setSelectedEmpleado(empleado);
                  setEmpleadoDialogOpen(false);
                  setEmpleadoSearchTerm('');
                  setEmpleadoSearchResults([]);
                }}
              >
                <p className="font-medium">{empleado.nombre}</p>
                {empleado.dni && (
                  <p className="text-sm text-muted-foreground">DNI: {empleado.dni}</p>
                )}
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Forma de Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Total a cobrar:</span>
              <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {formasPago.map((fp) => (
                <Button
                  key={fp.id}
                  variant="outline"
                  onClick={() => addPago(fp.id)}
                  disabled={totalPagado >= total}
                >
                  {fp.nombre}
                </Button>
              ))}
            </div>

            {pagos.length > 0 && (
              <div className="space-y-2">
                <Separator />
                {pagos.map((pago, index) => {
                  const fp = formasPago.find((f) => f.id === pago.forma_pago_id);
                  const tarjeta = tarjetas.find(t => t.id === pago.tarjeta_id);
                  return (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <span className="font-medium">{fp?.nombre}</span>
                        {tarjeta && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({tarjeta.nombre}
                            {pago.cuotas && pago.cuotas > 1 && ` - ${pago.cuotas} cuotas`}
                            )
                          </span>
                        )}
                        {pago.vuelto && pago.vuelto > 0 && (
                          <p className="text-sm text-success">
                            Entregó: ${pago.efectivo_entregado?.toLocaleString('es-AR')} | Vuelto: ${pago.vuelto.toLocaleString('es-AR')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          ${pago.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removePago(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total pagado:</span>
                  <span>${totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                {totalPagado < total && (
                  <div className="flex justify-between text-destructive">
                    <span>Pendiente:</span>
                    <span>${(total - totalPagado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {totalPagado > total + 0.009 && (
                  <div className="flex justify-between text-destructive">
                    <span>Excedente:</span>
                    <span>${(totalPagado - total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPagoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleContinuarPago} disabled={Math.abs(totalPagado - total) > 0.009}>
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transferencia: datos del comprobante */}
      <Dialog open={transferenciaDialogOpen} onOpenChange={(open) => {
        setTransferenciaDialogOpen(open);
        // Si se cierra sin confirmar y aún no se agregó el pago de transferencia,
        // limpiar los datos para no dejar estado huérfano.
        if (!open) {
          const fpTransf = formasPago.find(fp => fp.nombre.toLowerCase().includes('transfer'));
          const tieneTransfPago = fpTransf ? pagos.some(p => p.forma_pago_id === fpTransf.id) : false;
          if (!tieneTransfPago) setTransferenciaData(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Datos de la Transferencia</DialogTitle>
          </DialogHeader>
          {transferenciaData && (
            <div className="space-y-3">
              <div>
                <Label>Fecha del comprobante *</Label>
                <Input
                  type="date"
                  value={transferenciaData.fecha}
                  onChange={(e) => setTransferenciaData({ ...transferenciaData, fecha: e.target.value })}
                />
              </div>
              <div>
                <Label>Titular de la cuenta *</Label>
                <Input
                  value={transferenciaData.titular}
                  onChange={(e) => setTransferenciaData({ ...transferenciaData, titular: e.target.value })}
                  placeholder="Nombre y apellido / Razón social"
                  maxLength={150}
                />
              </div>
              <div>
                <Label>CUIL / CUIT *</Label>
                <Input
                  inputMode="numeric"
                  value={transferenciaData.cuil}
                  onChange={(e) => setTransferenciaData({ ...transferenciaData, cuil: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  placeholder="11 dígitos"
                />
              </div>
              <div>
                <Label>Importe *</Label>
                <Input
                  inputMode="decimal"
                  value={transferenciaData.importe}
                  onChange={(e) => setTransferenciaData({ ...transferenciaData, importe: e.target.value })}
                />
              </div>
              <div>
                <Label>Número de comprobante / operación *</Label>
                <Input
                  value={transferenciaData.numero_operacion}
                  onChange={(e) => setTransferenciaData({ ...transferenciaData, numero_operacion: e.target.value })}
                  maxLength={100}
                />
              </div>
              <div>
                <Label>Foto del comprobante (opcional)</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={(e) => setTransferenciaData({ ...transferenciaData, archivo: e.target.files?.[0] || null })}
                />
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG o PDF. Puede cargarse luego desde Transferencias.</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setTransferenciaDialogOpen(false); setTransferenciaData(null); }}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmarTransferencia}>
                  Confirmar y agregar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Importe genérico para otros medios de pago */}
      <Dialog open={montoGenericoDialogOpen} onOpenChange={(open) => {
        setMontoGenericoDialogOpen(open);
        if (!open) setMontoGenericoData(null);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Importe — {montoGenericoData?.formaPagoNombre}</DialogTitle>
          </DialogHeader>
          {montoGenericoData && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total venta:</span>
                <span className="font-semibold">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pendiente:</span>
                <span className="font-semibold">${(total - totalPagado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <Label>Importe *</Label>
                <Input
                  autoFocus
                  inputMode="decimal"
                  value={montoGenericoData.monto}
                  onChange={(e) => setMontoGenericoData({ ...montoGenericoData, monto: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddPagoGenerico(); }}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setMontoGenericoDialogOpen(false); setMontoGenericoData(null); }}>
                  Cancelar
                </Button>
                <Button onClick={handleAddPagoGenerico}>
                  Agregar pago
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pago con Cheque: datos del cheque */}
      <Dialog open={chequeDialogOpen} onOpenChange={(open) => {
        setChequeDialogOpen(open);
        if (!open && !pagos.some(p => p.forma_pago_id === chequeFormaPagoId)) {
          setChequeData(null);
          setChequeFormaPagoId(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Cheque</DialogTitle>
          </DialogHeader>
          {chequeData && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo *</Label>
                  <Select
                    value={chequeData.tipo}
                    onValueChange={(v) => setChequeData({ ...chequeData, tipo: v as 'propio' | 'terceros' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terceros">De Terceros</SelectItem>
                      <SelectItem value="propio">Propio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Nº Cheque *</Label>
                  <Input
                    value={chequeData.numero_cheque}
                    onChange={(e) => setChequeData({ ...chequeData, numero_cheque: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Banco *</Label>
                  <Input
                    value={chequeData.banco}
                    onChange={(e) => setChequeData({ ...chequeData, banco: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Sucursal Banco</Label>
                  <Input
                    value={chequeData.sucursal_banco}
                    onChange={(e) => setChequeData({ ...chequeData, sucursal_banco: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Emisor *</Label>
                  <Input
                    value={chequeData.emisor}
                    onChange={(e) => setChequeData({ ...chequeData, emisor: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>CUIT Emisor</Label>
                  <Input
                    value={chequeData.cuit_emisor}
                    onChange={(e) => setChequeData({ ...chequeData, cuit_emisor: e.target.value })}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Cliente</Label>
                  <Input value={selectedCliente?.nombre || 'Sin cliente'} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Monto *</Label>
                  <Input
                    inputMode="decimal"
                    value={chequeData.monto}
                    onChange={(e) => setChequeData({ ...chequeData, monto: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pendiente: ${(total - totalPagado + (pagos.find(p => p.forma_pago_id === chequeFormaPagoId)?.monto || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Fecha Emisión *</Label>
                  <Input
                    type="date"
                    value={chequeData.fecha_emision}
                    onChange={(e) => setChequeData({ ...chequeData, fecha_emision: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fecha Vencimiento *</Label>
                  <Input
                    type="date"
                    value={chequeData.fecha_vencimiento}
                    onChange={(e) => setChequeData({ ...chequeData, fecha_vencimiento: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea
                  rows={2}
                  value={chequeData.observaciones}
                  onChange={(e) => setChequeData({ ...chequeData, observaciones: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => {
                  setChequeDialogOpen(false);
                  if (!pagos.some(p => p.forma_pago_id === chequeFormaPagoId)) {
                    setChequeData(null);
                    setChequeFormaPagoId(null);
                  }
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleAddPagoCheque}>
                  Agregar cheque
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tarjeta Dialog */}
      <Dialog open={tarjetaDialogOpen} onOpenChange={setTarjetaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pago con Tarjeta {tipoTarjetaFiltro === 'debito' ? 'de Débito' : tipoTarjetaFiltro === 'credito' ? 'de Crédito' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Seleccionar Tarjeta</Label>
              <Select value={selectedTarjeta || ''} onValueChange={setSelectedTarjeta}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {tarjetas
                    .filter((t) => !tipoTarjetaFiltro || t.tipo === tipoTarjetaFiltro)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTarjeta && (() => {
              const tarjetaSeleccionada = tarjetas.find(t => t.id === selectedTarjeta);
              const cuotasDisponibles = tarjetaCuotas.filter(c => c.tarjeta_id === selectedTarjeta);
              
              if (cuotasDisponibles.length === 0) return null;
              
              // Para débito, mostrar solo el coeficiente si existe
              if (tarjetaSeleccionada?.tipo === 'debito') {
                const cuotaConfig = cuotasDisponibles[0];
                if (cuotaConfig && cuotaConfig.coeficiente > 1) {
                  const monto = parseFloat(montoTarjeta.replace(',', '.')) || 0;
                  return (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">
                        Interés: <span className="font-medium">+{((cuotaConfig.coeficiente - 1) * 100).toFixed(1)}%</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total a cobrar: ${(monto * cuotaConfig.coeficiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                }
                return null;
              }
              
              // Para crédito, mostrar selector de cuotas
              return (
                <div>
                  <Label>Cuotas</Label>
                  <Select value={selectedCuotas.toString()} onValueChange={(v) => setSelectedCuotas(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cuotasDisponibles.map((c) => (
                        <SelectItem key={c.cuotas} value={c.cuotas.toString()}>
                          {c.cuotas} cuota{c.cuotas > 1 ? 's' : ''} 
                          {c.coeficiente > 1 && ` (+${((c.coeficiente - 1) * 100).toFixed(1)}%)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}

            <div>
              <Label>Monto</Label>
              <Input
                type="text"
                value={montoTarjeta}
                onChange={(e) => setMontoTarjeta(e.target.value)}
                placeholder="0.00"
              />
              {selectedTarjeta && tarjetas.find(t => t.id === selectedTarjeta)?.tipo === 'credito' && selectedCuotas > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {(() => {
                    const cuotaConfig = tarjetaCuotas.find(c => c.tarjeta_id === selectedTarjeta && c.cuotas === selectedCuotas);
                    const monto = parseFloat(montoTarjeta.replace(',', '.')) || 0;
                    if (cuotaConfig && cuotaConfig.coeficiente > 1) {
                      return `Total con interés: $${(monto * cuotaConfig.coeficiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                    }
                    return null;
                  })()}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setTarjetaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddPagoTarjeta} disabled={!selectedTarjeta}>
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Efectivo Dialog */}
      <Dialog open={efectivoDialogOpen} onOpenChange={setEfectivoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pago en Efectivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span>Pendiente de cobro:</span>
                <span className="font-bold">${(total - totalPagado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div>
              <Label>Monto entregado por el cliente</Label>
              <Input
                type="text"
                value={efectivoEntregado}
                onChange={(e) => setEfectivoEntregado(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>

            {efectivoEntregado && (
              <div className="p-3 bg-muted rounded-lg">
                {(() => {
                  const entregado = parseFloat(efectivoEntregado.replace(',', '.')) || 0;
                  const pendiente = total - totalPagado;
                  const vuelto = entregado > pendiente ? entregado - pendiente : 0;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Entregado:</span>
                        <span>${entregado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {vuelto > 0 && (
                        <div className="flex justify-between font-bold text-lg text-success mt-2">
                          <span>Vuelto:</span>
                          <span>${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEfectivoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddPagoEfectivo}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Descuento Dialog */}
      <Dialog open={descuentoDialogOpen} onOpenChange={setDescuentoDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Aplicar Descuento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingDescuentoItem && (
              <p className="text-sm text-muted-foreground">
                {cart.find(i => i.id === editingDescuentoItem)?.producto?.descripcion || 
                 cart.find(i => i.id === editingDescuentoItem)?.nombre_temporal}
              </p>
            )}
            <div>
              <Label>Porcentaje de descuento</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={descuentoInput}
                  onChange={(e) => setDescuentoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGuardarDescuento();
                  }}
                  autoFocus
                />
                <span className="text-muted-foreground font-medium">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Máximo permitido: {getDescuentoMaximo()}%
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDescuentoDialogOpen(false);
                  setEditingDescuentoItem(null);
                  setDescuentoInput('');
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleGuardarDescuento}>
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Producto Temporal Dialog */}
      <Dialog open={productoTemporalDialogOpen} onOpenChange={setProductoTemporalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Producto Libre
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Agregue un producto que no está en el inventario. No se guardará en la base de datos.
            </p>
            <div>
              <Label>Nombre / Descripción</Label>
              <Input
                value={productoTemporal.nombre}
                onChange={(e) => setProductoTemporal({ ...productoTemporal, nombre: e.target.value })}
                placeholder="Ej: Producto especial"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={productoTemporal.precio}
                  onChange={(e) => setProductoTemporal({ ...productoTemporal, precio: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min={1}
                  value={productoTemporal.cantidad}
                  onChange={(e) => setProductoTemporal({ ...productoTemporal, cantidad: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setProductoTemporalDialogOpen(false);
                  setProductoTemporal({ nombre: '', precio: '', cantidad: '1' });
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleAgregarProductoTemporal}>
                Agregar al Carrito
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket/Factura Dialog - Optimizado para impresora térmica 80mm */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2">
              {lastVenta?.factura ? <FileText className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
              {lastVenta?.factura ? 'Factura Electrónica' : 'Ticket de Venta'}
            </DialogTitle>
          </DialogHeader>
          {lastVenta && (
            <div className="space-y-4">
              {/* Preview del comprobante */}
              <div id="printable-invoice" className="font-mono text-xs border rounded-lg p-4 bg-white text-black max-h-[60vh] overflow-y-auto">
                {lastVenta.factura ? (
                  // Factura electrónica formato térmico
                  <>
                    <div className="thermal-header text-center border-b border-dashed border-black pb-2 mb-2">
                      <p className="font-bold text-sm">{comercioConfig?.nombre_fantasia || comercioConfig?.razon_social || 'EMPRESA'}</p>
                      <p className="text-[10px]">{comercioConfig?.razon_social}</p>
                      <p className="text-[9px]">{comercioConfig?.direccion}</p>
                      {comercioConfig?.localidad && (
                        <p className="text-[9px]">{comercioConfig.localidad}{comercioConfig.provincia ? `, ${comercioConfig.provincia}` : ''}</p>
                      )}
                      <p className="text-[9px]">CUIT: {formatCuit(comercioConfig?.cuit || '')}</p>
                      <p className="text-[9px]">{comercioConfig?.condicion_iva || 'IVA Resp. Inscripto'}</p>
                      
                      <div className="my-2 py-1 border border-black inline-block px-4">
                        <span className="font-bold text-lg">
                          {lastVenta.factura.tipo_comprobante === 1 ? 'A' : lastVenta.factura.tipo_comprobante === 6 ? 'B' : 'C'}
                        </span>
                      </div>
                      
                      <p className="font-bold">FACTURA {lastVenta.factura.tipo_comprobante === 1 ? 'A' : lastVenta.factura.tipo_comprobante === 6 ? 'B' : 'C'}</p>
                      <p className="font-bold">Nº {String(lastVenta.factura.punto_venta).padStart(4, '0')}-{String(lastVenta.factura.numero_comprobante).padStart(8, '0')}</p>
                      <p className="text-[9px]">Fecha: {new Date(lastVenta.fecha).toLocaleString('es-AR')}</p>
                    </div>

                    <div className="thermal-section border-b border-dashed border-black pb-2 mb-2 text-[9px]">
                      {lastVenta.empleado ? (
                        <>
                          <p><strong>Empleado:</strong> {lastVenta.empleado.nombre}</p>
                          {lastVenta.empleado.dni && <p><strong>DNI:</strong> {lastVenta.empleado.dni}</p>}
                          {lastVenta.empleadoPagoDirecto ? (
                            <p className="font-medium text-[8px]">(Pago Directo)</p>
                          ) : (
                            <p className="font-medium text-[8px]">(Cuenta Corriente)</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p><strong>Cliente:</strong> {lastVenta.cliente?.nombre || (lastVenta.factura?.tipo_comprobante === 1 && lastVenta.factura?.doc_nro ? lastVenta.factura.doc_nro : 'Consumidor Final')}</p>
                          <p><strong>CUIT/DNI:</strong> {lastVenta.cliente?.dni_cuit || (lastVenta.factura?.doc_nro ? lastVenta.factura.doc_nro : 'Sin identificar')}</p>
                          <p><strong>IVA:</strong> {lastVenta.cliente ? (CONDICIONES_IVA.find(c => c.value === lastVenta.cliente.condicion_iva)?.label || 'Cons. Final') : (lastVenta.factura?.tipo_comprobante === 1 ? 'Responsable Inscripto' : 'Cons. Final')}</p>
                          {lastVenta.cliente?.direccion && <p><strong>Dom.:</strong> {lastVenta.cliente.direccion}</p>}
                        </>
                      )}
                      <p><strong>Cond. Venta:</strong> {lastVenta.empleado ? (lastVenta.empleadoPagoDirecto ? 'Contado' : 'Cuenta Corriente') : 'Contado'}</p>
                    </div>

                    <div className="thermal-section border-b border-dashed border-black pb-2 mb-2">
                      <p className="font-bold text-center mb-1">DETALLE</p>
                      {lastVenta.detalles.map((item: CartItem, idx: number) => (
                        <div key={idx} className="thermal-item mb-2">
                          <p className="thermal-item-name font-medium break-words">
                            {item.es_temporal ? item.nombre_temporal : item.producto?.descripcion}
                          </p>
                          <div className="thermal-item-details flex justify-between text-[9px]">
                            <span>{item.cantidad} x ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            <span>${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          {item.descuento_porcentaje > 0 && (
                            <p className="text-[8px] text-right">Desc: {item.descuento_porcentaje}%</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="thermal-section border-b border-dashed border-black pb-2 mb-2 text-right text-[10px]">
                      <p>Neto Gravado: ${lastVenta.factura.importe_neto?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}</p>
                      <p>IVA 21%: ${lastVenta.factura.importe_iva?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}</p>
                      <p className="thermal-total font-bold text-sm border-t border-black pt-1 mt-1">
                        TOTAL: ${lastVenta.factura.importe_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || lastVenta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="thermal-footer text-center text-[8px]">
                      <p className="font-bold">CAE: {lastVenta.factura.cae}</p>
                      <p>Vto. CAE: {lastVenta.factura.cae_vencimiento}</p>
                      <p className="mt-1">Comprobante Autorizado - AFIP</p>
                      <p>www.afip.gob.ar/fe/qr/</p>
                      <p className="mt-2">¡Gracias por su compra!</p>
                    </div>
                  </>
                ) : (
                  // Ticket simple formato térmico
                  <>
                    <div className="thermal-header text-center border-b border-dashed border-black pb-2 mb-2">
                      <p className="font-bold text-sm">{comercioConfig?.nombre_fantasia || comercioConfig?.razon_social || 'TICKET'}</p>
                      {comercioConfig?.direccion && <p className="text-[9px]">{comercioConfig.direccion}</p>}
                      {comercioConfig?.telefono && <p className="text-[9px]">Tel: {comercioConfig.telefono}</p>}
                      <p className="font-bold mt-1">TICKET #{lastVenta.numero_comprobante}</p>
                      <p className="text-[9px]">{new Date(lastVenta.fecha).toLocaleString('es-AR')}</p>
                    </div>

                    <div className="thermal-section border-b border-dashed border-black pb-2 mb-2 text-[9px]">
                      {lastVenta.empleado ? (
                        <>
                          <p><strong>Empleado:</strong> {lastVenta.empleado.nombre}</p>
                          {lastVenta.empleado.dni && <p><strong>DNI:</strong> {lastVenta.empleado.dni}</p>}
                          {lastVenta.empleadoPagoDirecto ? (
                            <p className="font-medium text-[8px]">(Pago Directo)</p>
                          ) : (
                            <p className="font-medium text-[8px]">(Cuenta Corriente)</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p><strong>Cliente:</strong> {lastVenta.cliente?.nombre || 'Consumidor Final'}</p>
                          {lastVenta.cliente?.dni_cuit && <p><strong>CUIT/DNI:</strong> {lastVenta.cliente.dni_cuit}</p>}
                          {lastVenta.clienteCuentaCorriente && (
                            <>
                              <p className="font-medium text-[8px]">(Cuenta Corriente)</p>
                              <p className="text-[8px]">Cond. Venta: Fiado</p>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    <div className="thermal-section border-b border-dashed border-black pb-2 mb-2">
                      {lastVenta.detalles.map((item: CartItem, idx: number) => (
                        <div key={idx} className="thermal-item mb-2">
                          <p className="thermal-item-name break-words">
                            {item.es_temporal ? item.nombre_temporal : item.producto?.descripcion}
                          </p>
                          <div className="thermal-item-details flex justify-between text-[9px]">
                            <span>{item.cantidad} x ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            <span>${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          {item.descuento_porcentaje > 0 && (
                            <p className="text-[8px] text-right">Desc: {item.descuento_porcentaje}%</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {lastVenta.descuento > 0 && (
                      <div className="text-right text-[9px] mb-1">
                        <p>Descuento: -${lastVenta.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    )}

                    <div className="thermal-total text-center font-bold text-sm border-t-2 border-black pt-2">
                      <p>TOTAL: ${lastVenta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <div className="thermal-footer text-center text-[8px] mt-2">
                      <p>¡Gracias por su compra!</p>
                    </div>
                  </>
                )}
              </div>

              <Button className="w-full no-print" onClick={handleImprimirTicket}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Factura Dialog */}
      <Dialog open={facturaDialogOpen} onOpenChange={setFacturaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Confirmar Venta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                <div>
                  <p className="font-medium">Emitir Factura AFIP</p>
                  <p className="text-sm text-muted-foreground">Generar comprobante electrónico</p>
                </div>
              </div>
              <Switch
                checked={emitirFactura}
                onCheckedChange={setEmitirFactura}
              />
            </div>

            {emitirFactura && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo Comprobante</Label>
                    <Select
                      value={facturaData.tipo_comprobante.toString()}
                      onValueChange={(v) => {
                        const tipoComp = parseInt(v);
                        // Si es Factura A, forzar Responsable Inscripto y CUIT
                        if (tipoComp === 1) {
                          setFacturaData({ 
                            ...facturaData, 
                            tipo_comprobante: tipoComp,
                            condicion_iva_receptor: 1, // IVA Responsable Inscripto
                            doc_tipo: 80 // CUIT
                          });
                        } else {
                          setFacturaData({ ...facturaData, tipo_comprobante: tipoComp });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_COMPROBANTE.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value.toString()}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Condición IVA</Label>
                    <Select
                      value={facturaData.condicion_iva_receptor.toString()}
                      onValueChange={(v) => setFacturaData({ ...facturaData, condicion_iva_receptor: parseInt(v) })}
                      disabled={facturaData.tipo_comprobante === 1}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDICIONES_IVA
                          .filter(cond => facturaData.tipo_comprobante === 1 ? cond.value === 1 : true)
                          .map((cond) => (
                            <SelectItem key={cond.value} value={cond.value.toString()}>
                              {cond.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {facturaData.tipo_comprobante === 1 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Factura A requiere Resp. Inscripto
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo Documento</Label>
                    <Select
                      value={facturaData.doc_tipo.toString()}
                      onValueChange={(v) => setFacturaData({ ...facturaData, doc_tipo: parseInt(v) })}
                      disabled={facturaData.tipo_comprobante === 1}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO
                          .filter(doc => facturaData.tipo_comprobante === 1 ? doc.value === 80 : true)
                          .map((doc) => (
                            <SelectItem key={doc.value} value={doc.value.toString()}>
                              {doc.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {facturaData.tipo_comprobante === 1 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Factura A requiere CUIT
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Nro Documento {facturaData.tipo_comprobante === 1 && <span className="text-destructive">*</span>}</Label>
                    <Input
                      value={facturaData.doc_nro}
                      onChange={(e) => setFacturaData({ ...facturaData, doc_nro: e.target.value })}
                      placeholder={facturaData.tipo_comprobante === 1 ? "20123456789 (11 dígitos)" : "20123456789"}
                    />
                    {facturaData.tipo_comprobante === 1 && facturaData.doc_nro.length > 0 && facturaData.doc_nro.length !== 11 && (
                      <p className="text-xs text-destructive mt-1">
                        El CUIT debe tener 11 dígitos
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Mostrar desglose si hay intereses */}
            {totalPagado > total && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal productos:</span>
                  <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Intereses tarjeta:</span>
                  <span>+${(totalPagado - total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold">
              <span>Total a facturar:</span>
              <span>${(totalPagado > 0 ? totalPagado : total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setFacturaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleProcesarVenta} disabled={emitiendo}>
                {emitiendo ? 'Procesando...' : emitirFactura ? 'Confirmar y Facturar' : 'Confirmar Venta'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pedidos Pendientes Dialog */}
      <Dialog open={pedidosDialogOpen} onOpenChange={setPedidosDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Pedidos Pendientes
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {loadingPedidos ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Cargando pedidos...</p>
              </div>
            ) : pedidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mb-2" />
                <p>No hay pedidos pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pedidos.map((pedido) => (
                  <Card key={pedido.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-medium">
                              {pedido.numero_comprobante
                                ? `#${String(pedido.numero_comprobante).padStart(8, '0')}`
                                : 'Sin Nº (pendiente de cobro)'}
                            </span>
                            <Badge variant="secondary">Pedido</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(pedido.fecha).toLocaleString('es-AR')}
                          </p>
                          <p className="text-sm mt-1">
                            Cliente: {pedido.clientes?.nombre || 'Consumidor Final'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            ${pedido.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex gap-1 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImprimirPedido(pedido)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCargarPedido(pedido)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleEliminarPedido(pedido.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog para ingresar peso */}
      <Dialog open={pesoDialogOpen} onOpenChange={setPesoDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Ingresar Peso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingPesoItem && (
              <p className="text-sm text-muted-foreground">
                {cart.find(i => i.id === editingPesoItem)?.producto?.descripcion}
              </p>
            )}
            <div>
              <Label htmlFor="peso">Peso en kilogramos</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="peso"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 2,345"
                  value={pesoInput}
                  onChange={(e) => setPesoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGuardarPeso();
                  }}
                  autoFocus
                  className="text-lg"
                />
                <span className="text-muted-foreground font-medium">kg</span>
              </div>
            </div>
            {editingPesoItem && pesoInput && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Precio por kg:</span>
                  <span>${cart.find(i => i.id === editingPesoItem)?.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold mt-1">
                  <span>Subtotal:</span>
                  <span>
                    ${(
                      (cart.find(i => i.id === editingPesoItem)?.precio || 0) * 
                      parseFloat(pesoInput.replace(',', '.') || '0')
                    ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPesoDialogOpen(false);
                  setEditingPesoItem(null);
                  setPesoInput('');
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleGuardarPeso}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Búsqueda de Productos */}
      <ProductSearchModal
        open={productSearchModalOpen}
        onOpenChange={setProductSearchModalOpen}
        productos={productos}
        getProductoPrice={getProductoPrice}
        onSelectProduct={handleProductSelectedFromModal}
      />

      {/* Modal de Selección de Cantidad */}
      <ProductQuantityModal
        open={productQuantityModalOpen}
        onOpenChange={setProductQuantityModalOpen}
        producto={selectedProductForQuantity}
        precio={selectedProductForQuantity ? getProductoPrice(selectedProductForQuantity) : 0}
        onConfirm={handleConfirmProductQuantity}
      />

      {/* Modal de Autorización de Descuento */}
      <SolicitarDescuentoModal
        open={descuentoAuthModalOpen}
        onClose={() => {
          setDescuentoAuthModalOpen(false);
          setPendingDescuento(null);
        }}
        onAuthorized={handleDescuentoAutorizado}
        porcentajeSolicitado={pendingDescuento?.porcentaje || 0}
        montoVenta={total}
        productoId={pendingDescuento?.productoId}
        descripcionProducto={pendingDescuento?.descripcion}
      />
    </MainLayout>
  );
}
