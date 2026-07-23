import { useState, useEffect } from "react";
import { useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConfiguracionComercio } from "@/hooks/useConfiguracionComercio";
import { FileText, Plus, TestTube, Eye, Printer } from "lucide-react";
import { format } from "date-fns";
import { imprimirTicketFactura, TicketDetalleItem } from "@/lib/imprimirTicketFactura";
import { FileMinus } from "lucide-react";
import { NotaCreditoParcialWizard } from "@/components/facturacion/NotaCreditoParcialWizard";
import { ResolucionesPendientes } from "@/components/facturacion/ResolucionesPendientes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Comprobante {
  id: string;
  tipo_comprobante: number;
  punto_venta: number;
  numero_comprobante: number;
  cae: string;
  cae_vencimiento: string;
  importe_total: number;
  importe_neto: number;
  importe_iva: number;
  doc_nro: number;
  fecha_emision: string;
  estado: string;
  venta_id?: string | null;
  doc_tipo?: number;
  cuit_emisor?: string;
  factura_origen_id?: string | null;
  tipo_nc?: string | null;
  motivo_nc?: string | null;
  observaciones?: string | null;
  usuario_id?: string | null;
  resolucion_por?: string | null;
}

interface Cliente {
  id: string;
  nombre: string;
  dni_cuit: string | null;
}

const TIPOS_COMPROBANTE = [
  { value: 1, label: "Factura A" },
  { value: 6, label: "Factura B" },
  { value: 3, label: "Nota de Crédito A" },
  { value: 8, label: "Nota de Crédito B" },
];

const FACTURA_TIPOS = [1, 6, 11];
const NC_TIPOS = [3, 8, 13];

const MOTIVO_LABEL: Record<string, string> = {
  devolucion: "Devolución",
  bonificacion: "Bonificación",
  error_facturacion: "Error de facturación",
  otro: "Otro",
};

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

const ALICUOTAS_IVA = [
  { value: 5, label: "21%", porcentaje: 21 },
  { value: 4, label: "10.5%", porcentaje: 10.5 },
  { value: 3, label: "0%", porcentaje: 0 },
];

export default function Facturacion() {
  const { user, hasRole, hasPermission } = useAuth();
  const isPriv = hasRole("admin") || hasRole("encargado") || hasRole("administracion");
  const [puedeAnular, setPuedeAnular] = useState(false);
  const { config: comercioConfig } = useConfiguracionComercio();
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [selectedComp, setSelectedComp] = useState<Comprobante | null>(null);
  const [detalleVenta, setDetalleVenta] = useState<any>(null);
  const [detalleItems, setDetalleItems] = useState<TicketDetalleItem[]>([]);
  const [detalleCliente, setDetalleCliente] = useState<any>(null);
  const [detalleUsuario, setDetalleUsuario] = useState<any>(null);
  const [ncsAsociadas, setNcsAsociadas] = useState<Comprobante[]>([]);
  const [ncDialogOpen, setNcDialogOpen] = useState(false);
  const [facturaParaNc, setFacturaParaNc] = useState<Comprobante | null>(null);
  const [saldosFacturas, setSaldosFacturas] = useState<Record<string, number>>({});
  // Filtros
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroNumero, setFiltroNumero] = useState("");
  const [formData, setFormData] = useState({
    tipo_comprobante: 6, // Factura B por defecto
    punto_venta: 1, // Se actualiza con useEffect cuando carga comercioConfig
    concepto: 1,
    doc_tipo: 99,
    doc_nro: "0",
    condicion_iva_receptor: 5, // Consumidor Final por defecto
    cliente_id: "",
    items: [{ descripcion: "", cantidad: 1, precio_unitario: 0, iva_id: 5 }],
  });
  
  // Actualizar punto_venta cuando cargue la configuración
  useEffect(() => {
    if (comercioConfig?.punto_venta) {
      setFormData(prev => ({ ...prev, punto_venta: comercioConfig.punto_venta }));
    }
  }, [comercioConfig]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await hasPermission("facturacion", "anular");
        if (!cancelled) setPuedeAnular(!!ok);
      } catch {
        if (!cancelled) setPuedeAnular(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Privilegiado: ve todo, incluidos comprobantes con venta_id NULL.
      // No privilegiado: inner join a ventas filtrando por usuario_id.
      const comprobantesPromise = isPriv
        ? supabase
            .from("comprobantes_afip")
            .select("*")
            .order("created_at", { ascending: false })
        : supabase
            .from("comprobantes_afip")
            .select("*, ventas!inner(usuario_id)")
            .eq("ventas.usuario_id", user!.id)
            .order("created_at", { ascending: false });

      const [comprobantesRes, clientesRes] = await Promise.all([
        comprobantesPromise,
        supabase
          .from("clientes")
          .select("id, nombre, dni_cuit")
          .eq("activo", true),
      ]);

      if (comprobantesRes.data) setComprobantes(comprobantesRes.data);
      if (clientesRes.data) setClientes(clientesRes.data);

      // Pre-cargar saldo disponible de facturas para mostrar el botón "Generar NC"
      const facturas = (comprobantesRes.data || []).filter((c: any) => FACTURA_TIPOS.includes(c.tipo_comprobante));
      const saldos: Record<string, number> = {};
      await Promise.all(facturas.map(async (f: any) => {
        const acreditado = (comprobantesRes.data || [])
          .filter((x: any) => x.factura_origen_id === f.id && NC_TIPOS.includes(x.tipo_comprobante))
          .reduce((s: number, x: any) => s + Number(x.importe_total || 0), 0);
        saldos[f.id] = Math.max(0, Number(f.importe_total) - acreditado);
      }));
      setSaldosFacturas(saldos);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos");
    }
    setLoading(false);
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("afip-facturacion/test-connection", {
        method: "POST",
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Conexión exitosa con AFIP");
      } else {
        toast.error(data.error || "Error de conexión");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error(`Error: ${message}`);
    }
    setTestingConnection(false);
  };

  const calcularTotales = () => {
    let neto = 0;
    let iva = 0;

    formData.items.forEach((item) => {
      const subtotal = item.cantidad * item.precio_unitario;
      const alicuota = ALICUOTAS_IVA.find((a) => a.value === item.iva_id);
      const ivaItem = subtotal * ((alicuota?.porcentaje || 0) / 100);
      neto += subtotal;
      iva += ivaItem;
    });

    return { neto, iva, total: neto + iva };
  };

  const handleEmitir = async () => {
    if (!user) return;

    const totales = calcularTotales();
    if (totales.total <= 0) {
      toast.error("El importe debe ser mayor a 0");
      return;
    }

    setEmitiendo(true);
    try {
      const { data, error } = await supabase.functions.invoke("afip-facturacion/emitir", {
        body: {
          tipo_comprobante: formData.tipo_comprobante,
          punto_venta: formData.punto_venta,
          concepto: formData.concepto,
          doc_tipo: formData.doc_tipo,
          doc_nro: parseInt(formData.doc_nro) || 0,
          condicion_iva_receptor: formData.condicion_iva_receptor,
          importe_total: totales.total,
          importe_neto: totales.neto,
          importe_iva: totales.iva,
          items: formData.items,
        },
      });

      if (error) throw error;

      if (data.success) {
        // Guardar en base de datos
        const { error: insertError } = await supabase.from("comprobantes_afip").insert({
          tipo_comprobante: formData.tipo_comprobante,
          punto_venta: data.punto_venta,
          numero_comprobante: data.numero_comprobante,
          cae: data.cae,
          cae_vencimiento: formatFechaAfip(data.cae_vencimiento),
          cuit_emisor: "", // Se obtiene del secret
          doc_tipo: formData.doc_tipo,
          doc_nro: parseInt(formData.doc_nro) || 0,
          importe_total: totales.total,
          importe_neto: totales.neto,
          importe_iva: totales.iva,
          usuario_id: user.id,
        });

        if (insertError) throw insertError;

        toast.success(`Comprobante emitido - CAE: ${data.cae}`);
        setDialogOpen(false);
        fetchData();
        resetForm();
      } else {
        toast.error(data.error || "Error al emitir comprobante");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error(`Error: ${message}`);
    }
    setEmitiendo(false);
  };

  const formatFechaAfip = (fecha: string): string => {
    // Formato AFIP: YYYYMMDD -> YYYY-MM-DD
    if (fecha.length === 8) {
      return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
    }
    return fecha;
  };

  // Parsea 'YYYY-MM-DD' como fecha local (evita desfase de zona horaria por UTC)
  const parseFechaLocal = (fecha: string): Date => {
    if (!fecha) return new Date();
    const soloFecha = fecha.slice(0, 10);
    const [y, m, d] = soloFecha.split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
    return new Date(fecha);
  };

  const resetForm = () => {
    setFormData({
      tipo_comprobante: 6,
      punto_venta: comercioConfig?.punto_venta || 1,
      concepto: 1,
      doc_tipo: 99,
      doc_nro: "0",
      condicion_iva_receptor: 5,
      cliente_id: "",
      items: [{ descripcion: "", cantidad: 1, precio_unitario: 0, iva_id: 5 }],
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { descripcion: "", cantidad: 1, precio_unitario: 0, iva_id: 5 }],
    });
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find((c) => c.id === clienteId);
    if (cliente) {
      setFormData({
        ...formData,
        cliente_id: clienteId,
        doc_nro: cliente.dni_cuit?.replace(/\D/g, "") || "0",
        doc_tipo: cliente.dni_cuit?.length === 11 ? 80 : 96,
      });
    }
  };

  const getTipoComprobanteLabel = (tipo: number) => {
    return TIPOS_COMPROBANTE.find((t) => t.value === tipo)?.label || tipo.toString();
  };

  const verDetalle = async (comp: Comprobante) => {
    setSelectedComp(comp);
    setDetalleOpen(true);
    setDetalleLoading(true);
    setDetalleVenta(null);
    setDetalleItems([]);
    setDetalleCliente(null);
    setDetalleUsuario(null);
    setNcsAsociadas([]);
    try {
      // Cargar usuario que registró el comprobante
      if (comp.usuario_id) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('id, nombre, email')
          .eq('id', comp.usuario_id)
          .maybeSingle();
        setDetalleUsuario(perfil || null);
      }

      if (!comp.venta_id) {
        setDetalleLoading(false);
        return;
      }
      const { data: venta } = await supabase
        .from('ventas')
        .select('id, fecha, total, descuento, numero_comprobante, cliente_id, clientes(nombre, dni_cuit, condicion_iva)')
        .eq('id', comp.venta_id)
        .maybeSingle();
      const { data: detalles } = await supabase
        .from('venta_detalles')
        .select('cantidad, precio_unitario, subtotal, descuento_porcentaje, producto_temporal_nombre, productos(descripcion)')
        .eq('venta_id', comp.venta_id);
      setDetalleVenta(venta);
      setDetalleCliente((venta as any)?.clientes || null);
      setDetalleItems(
        (detalles || []).map((d: any) => ({
          nombre: d.productos?.descripcion || d.producto_temporal_nombre || 'Producto',
          cantidad: Number(d.cantidad) || 0,
          precio: Number(d.precio_unitario) || 0,
          subtotal: Number(d.subtotal) || 0,
          descuento_porcentaje: Number(d.descuento_porcentaje) || 0,
        }))
      );

      // Cargar comprobantes asociados (NCs sobre esta factura)
      if (FACTURA_TIPOS.includes(comp.tipo_comprobante)) {
        const { data: ncs } = await supabase
          .from('comprobantes_afip')
          .select('*')
          .eq('factura_origen_id', comp.id)
          .order('created_at', { ascending: true });
        setNcsAsociadas((ncs as any[] | null) || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar el detalle');
    }
    setDetalleLoading(false);
  };

  const reimprimir = () => {
    if (!selectedComp) return;
    imprimirTicketFactura({
      comercio: comercioConfig,
      fecha: detalleVenta?.fecha || selectedComp.fecha_emision,
      total: Number(detalleVenta?.total ?? selectedComp.importe_total),
      descuento: Number(detalleVenta?.descuento || 0),
      numero_comprobante: detalleVenta?.numero_comprobante,
      detalles: detalleItems,
      cliente: detalleCliente,
      factura: {
        tipo_comprobante: selectedComp.tipo_comprobante,
        punto_venta: selectedComp.punto_venta,
        numero_comprobante: selectedComp.numero_comprobante,
        cae: selectedComp.cae,
        cae_vencimiento: selectedComp.cae_vencimiento,
        importe_total: Number(selectedComp.importe_total),
        importe_neto: Number(selectedComp.importe_neto),
        importe_iva: Number(selectedComp.importe_iva),
        doc_nro: selectedComp.doc_nro,
      },
    });
  };

  const totales = calcularTotales();

  const abrirNcDialog = (comp: Comprobante) => {
    if (!puedeAnular) {
      toast.error("No tenés permiso para emitir notas de crédito");
      return;
    }
    setFacturaParaNc(comp);
    setNcDialogOpen(true);
  };

  const comprobantesFiltrados = useMemo(() => {
    return comprobantes.filter((c) => {
      if (filtroTipo !== "all" && String(c.tipo_comprobante) !== filtroTipo) return false;
      if (filtroNumero.trim()) {
        const q = filtroNumero.replace(/\D/g, "");
        const num = String(c.numero_comprobante);
        const full = `${String(c.punto_venta).padStart(4, "0")}${String(c.numero_comprobante).padStart(8, "0")}`;
        if (q && !num.includes(q) && !full.includes(q)) return false;
      }
      if (filtroFechaDesde) {
        if ((c.fecha_emision || "").slice(0, 10) < filtroFechaDesde) return false;
      }
      if (filtroFechaHasta) {
        if ((c.fecha_emision || "").slice(0, 10) > filtroFechaHasta) return false;
      }
      return true;
    });
  }, [comprobantes, filtroTipo, filtroNumero, filtroFechaDesde, filtroFechaHasta]);

  return (
    <MainLayout>
      <PageHeader
        title="Facturación Electrónica"
        description="Gestión de comprobantes AFIP"
      >
        <Button variant="outline" onClick={testConnection} disabled={testingConnection}>
          <TestTube className="mr-2 h-4 w-4" />
          {testingConnection ? "Probando..." : "Probar Conexión"}
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Comprobante
        </Button>
      </PageHeader>

      <ResolucionesPendientes refreshKey={comprobantes.length} onResolved={fetchData} />

      <Card>
        <CardHeader>
          <CardTitle>Comprobantes Emitidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {TIPOS_COMPROBANTE.map((t) => (
                    <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Buscar N° comprobante</Label>
              <Input placeholder="Ej: 5840 o 00010000005840" value={filtroNumero} onChange={(e) => setFiltroNumero(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>CAE</TableHead>
                    <TableHead>Vto. CAE</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprobantesFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No hay comprobantes emitidos
                      </TableCell>
                    </TableRow>
                  ) : (
                    comprobantesFiltrados.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>
                          <Badge variant="outline">{getTipoComprobanteLabel(comp.tipo_comprobante)}</Badge>
                        </TableCell>
                        <TableCell>
                          {String(comp.punto_venta).padStart(4, "0")}-{String(comp.numero_comprobante).padStart(8, "0")}
                        </TableCell>
                        <TableCell>{format(parseFechaLocal(comp.fecha_emision), "dd/MM/yyyy")}</TableCell>
                        <TableCell>${Number(comp.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-xs">{comp.cae}</TableCell>
                        <TableCell>{format(parseFechaLocal(comp.cae_vencimiento), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={comp.estado === "emitido" ? "default" : "destructive"}>{comp.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => verDetalle(comp)} title="Ver detalle">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {FACTURA_TIPOS.includes(comp.tipo_comprobante)
                              && comp.estado === 'emitido'
                              && puedeAnular
                              && (saldosFacturas[comp.id] ?? 0) > 0 && (
                              <Button variant="ghost" size="icon" onClick={() => abrirNcDialog(comp)} title="Generar Nota de Crédito">
                                <FileMinus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Emitir Comprobante</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Tipo de Comprobante</Label>
                <Select
                  value={formData.tipo_comprobante.toString()}
                  onValueChange={(v) => setFormData({ ...formData, tipo_comprobante: parseInt(v) })}
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
                <Label>Punto de Venta</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.punto_venta}
                  onChange={(e) => setFormData({ ...formData, punto_venta: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div>
                <Label>Concepto</Label>
                <Select
                  value={formData.concepto.toString()}
                  onValueChange={(v) => setFormData({ ...formData, concepto: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Productos</SelectItem>
                    <SelectItem value="2">Servicios</SelectItem>
                    <SelectItem value="3">Productos y Servicios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Cliente</Label>
                <Select value={formData.cliente_id} onValueChange={handleClienteChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Condición IVA</Label>
                <Select
                  value={formData.condicion_iva_receptor.toString()}
                  onValueChange={(v) => setFormData({ ...formData, condicion_iva_receptor: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDICIONES_IVA.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value.toString()}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo Documento</Label>
                <Select
                  value={formData.doc_tipo.toString()}
                  onValueChange={(v) => setFormData({ ...formData, doc_tipo: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value.toString()}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nro. Documento</Label>
                <Input
                  value={formData.doc_nro}
                  onChange={(e) => setFormData({ ...formData, doc_nro: e.target.value })}
                  placeholder="CUIT/CUIL/DNI"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Items</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar Item
                </Button>
              </div>

              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end">
                  <div className="col-span-4">
                    <Input
                      placeholder="Descripción"
                      value={item.descripcion}
                      onChange={(e) => updateItem(index, "descripcion", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Cantidad"
                      min={1}
                      value={item.cantidad}
                      onChange={(e) => updateItem(index, "cantidad", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Precio"
                      step="0.01"
                      value={item.precio_unitario}
                      onChange={(e) => updateItem(index, "precio_unitario", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={item.iva_id.toString()}
                      onValueChange={(v) => updateItem(index, "iva_id", parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALICUOTAS_IVA.map((alicuota) => (
                          <SelectItem key={alicuota.value} value={alicuota.value.toString()}>
                            IVA {alicuota.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-3 gap-4 text-right">
                <div>
                  <p className="text-sm text-muted-foreground">Neto</p>
                  <p className="text-lg font-semibold">
                    ${totales.neto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IVA</p>
                  <p className="text-lg font-semibold">
                    ${totales.iva.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold text-primary">
                    ${totales.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEmitir} disabled={emitiendo}>
              {emitiendo ? "Emitiendo..." : "Emitir Comprobante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalle del Comprobante
              {selectedComp && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {getTipoComprobanteLabel(selectedComp.tipo_comprobante)} {String(selectedComp.punto_venta).padStart(4, '0')}-{String(selectedComp.numero_comprobante).padStart(8, '0')}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {detalleLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : selectedComp ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium">{format(new Date(detalleVenta?.fecha || selectedComp.fecha_emision), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Nº Venta</p>
                  <p className="font-medium">
                    {detalleVenta?.numero_comprobante
                      ? `#${String(detalleVenta.numero_comprobante).padStart(8, '0')}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{detalleCliente?.nombre || 'Consumidor Final'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CUIT/DNI</p>
                  <p className="font-medium">{detalleCliente?.dni_cuit || selectedComp.doc_nro || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario que registró</p>
                  <p className="font-medium">
                    {detalleUsuario?.nombre || detalleUsuario?.email || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">CAE</p>
                  <p className="font-mono text-xs">{selectedComp.cae}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vto. CAE</p>
                  <p className="font-medium">{format(new Date(selectedComp.cae_vencimiento), 'dd/MM/yyyy')}</p>
                </div>
              </div>

              {selectedComp && NC_TIPOS.includes(selectedComp.tipo_comprobante) && selectedComp.factura_origen_id && (
                (() => {
                  const facturaOrigen = comprobantes.find(c => c.id === selectedComp.factura_origen_id);
                  return facturaOrigen ? (
                    <div className="border rounded-lg p-3 bg-amber-50/50 border-amber-200">
                      <p className="text-sm font-semibold text-amber-800 mb-1">Factura de Origen</p>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-amber-900">
                          {getTipoComprobanteLabel(facturaOrigen.tipo_comprobante)} {String(facturaOrigen.punto_venta).padStart(4, '0')}-{String(facturaOrigen.numero_comprobante).padStart(8, '0')}
                          <span className="text-muted-foreground ml-2">{format(new Date(facturaOrigen.fecha_emision), 'dd/MM/yyyy')}</span>
                        </span>
                        <span className="font-medium text-amber-900">${Number(facturaOrigen.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-3 bg-amber-50/50 border-amber-200">
                      <p className="text-sm font-semibold text-amber-800 mb-1">Factura de Origen</p>
                      <p className="text-sm text-amber-900">Factura ID: {selectedComp.factura_origen_id}</p>
                    </div>
                  );
                })()
              )}

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">P. Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                          {selectedComp.venta_id ? 'Sin items' : 'Este comprobante no está asociado a una venta'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      detalleItems.map((it, i) => (
                        <TableRow key={i}>
                          <TableCell>{it.nombre}</TableCell>
                          <TableCell className="text-right">{it.cantidad}</TableCell>
                          <TableCell className="text-right">${it.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">${it.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t pt-3 text-right space-y-1 text-sm">
                <p>Neto Gravado: <span className="font-medium">${Number(selectedComp.importe_neto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></p>
                <p>IVA: <span className="font-medium">${Number(selectedComp.importe_iva || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></p>
                <p className="text-lg font-bold">TOTAL: ${Number(selectedComp.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>

              {ncsAsociadas.length > 0 && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="font-semibold mb-2 text-sm">Notas de Crédito asociadas</p>
                  <div className="space-y-1 text-sm">
                    {ncsAsociadas.map((nc) => (
                      <div key={nc.id} className="flex justify-between items-center">
                        <span>
                          {getTipoComprobanteLabel(nc.tipo_comprobante)} {String(nc.punto_venta).padStart(4, '0')}-{String(nc.numero_comprobante).padStart(8, '0')}
                          {nc.motivo_nc && <span className="text-muted-foreground ml-2">({MOTIVO_LABEL[nc.motivo_nc] || nc.motivo_nc})</span>}
                          <span className="text-muted-foreground ml-2">{format(new Date(nc.fecha_emision), 'dd/MM/yyyy')}</span>
                        </span>
                        <span className="font-medium">${Number(nc.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalleOpen(false)}>Cerrar</Button>
            <Button onClick={reimprimir} disabled={!selectedComp}>
              <Printer className="mr-2 h-4 w-4" />
              Reimprimir Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NotaCreditoParcialWizard
        open={ncDialogOpen}
        onOpenChange={setNcDialogOpen}
        factura={facturaParaNc as any}
        onEmitida={() => { fetchData(); }}
      />
    </MainLayout>
  );
}
