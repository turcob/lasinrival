import { useState, useEffect } from "react";
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
import { FileText, Plus, TestTube } from "lucide-react";
import { format } from "date-fns";
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
  doc_nro: number;
  fecha_emision: string;
  estado: string;
}

interface Cliente {
  id: string;
  nombre: string;
  dni_cuit: string | null;
}

const TIPOS_COMPROBANTE = [
  { value: 1, label: "Factura A" },
  { value: 6, label: "Factura B" },
  { value: 11, label: "Factura C" },
  { value: 3, label: "Nota de Crédito A" },
  { value: 8, label: "Nota de Crédito B" },
  { value: 13, label: "Nota de Crédito C" },
];

const TIPOS_DOCUMENTO = [
  { value: 80, label: "CUIT" },
  { value: 86, label: "CUIL" },
  { value: 96, label: "DNI" },
  { value: 99, label: "Consumidor Final" },
];

const ALICUOTAS_IVA = [
  { value: 5, label: "21%", porcentaje: 21 },
  { value: 4, label: "10.5%", porcentaje: 10.5 },
  { value: 3, label: "0%", porcentaje: 0 },
];

export default function Facturacion() {
  const { user } = useAuth();
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipo_comprobante: 6, // Factura B por defecto
    punto_venta: 1,
    concepto: 1,
    doc_tipo: 99,
    doc_nro: "0",
    cliente_id: "",
    items: [{ descripcion: "", cantidad: 1, precio_unitario: 0, iva_id: 5 }],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [comprobantesRes, clientesRes] = await Promise.all([
        supabase
          .from("comprobantes_afip")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nombre, dni_cuit")
          .eq("activo", true),
      ]);

      if (comprobantesRes.data) setComprobantes(comprobantesRes.data);
      if (clientesRes.data) setClientes(clientesRes.data);
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

  const resetForm = () => {
    setFormData({
      tipo_comprobante: 6,
      punto_venta: 1,
      concepto: 1,
      doc_tipo: 99,
      doc_nro: "0",
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

  const totales = calcularTotales();

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

      <Card>
        <CardHeader>
          <CardTitle>Comprobantes Emitidos</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <TableHead>Documento</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>CAE</TableHead>
                    <TableHead>Vto. CAE</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprobantes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No hay comprobantes emitidos
                      </TableCell>
                    </TableRow>
                  ) : (
                    comprobantes.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>
                          <Badge variant="outline">{getTipoComprobanteLabel(comp.tipo_comprobante)}</Badge>
                        </TableCell>
                        <TableCell>
                          {String(comp.punto_venta).padStart(4, "0")}-{String(comp.numero_comprobante).padStart(8, "0")}
                        </TableCell>
                        <TableCell>{format(new Date(comp.fecha_emision), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{comp.doc_nro}</TableCell>
                        <TableCell>${Number(comp.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-xs">{comp.cae}</TableCell>
                        <TableCell>{format(new Date(comp.cae_vencimiento), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={comp.estado === "emitido" ? "default" : "destructive"}>{comp.estado}</Badge>
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

            <div className="grid grid-cols-3 gap-4">
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
    </MainLayout>
  );
}
