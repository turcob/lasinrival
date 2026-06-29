import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";

interface NCPendiente {
  id: string;
  tipo_comprobante: number;
  punto_venta: number;
  numero_comprobante: number;
  importe_total: number;
  fecha_emision: string;
  venta_id: string | null;
  factura_origen_id: string | null;
  motivo_nc: string | null;
  cliente_nombre?: string | null;
  cliente_id?: string | null;
  factura_label?: string | null;
}

interface CajaAbierta {
  id: string;
  fecha_apertura: string | null;
  usuario_id: string;
  usuario_nombre?: string | null;
}

const tipoLabel = (t: number) => t === 3 ? "NC A" : t === 8 ? "NC B" : t === 13 ? "NC C" : `NC ${t}`;

export function ResolucionesPendientes({ refreshKey, onResolved }: { refreshKey?: number; onResolved?: () => void }) {
  const { user, hasRole } = useAuth();
  const [items, setItems] = useState<NCPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NCPendiente | null>(null);
  const [tipoRes, setTipoRes] = useState<"caja" | "cuenta_corriente">("caja");
  const [cajas, setCajas] = useState<CajaAbierta[]>([]);
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("comprobantes_afip")
        .select("id, tipo_comprobante, punto_venta, numero_comprobante, importe_total, fecha_emision, venta_id, factura_origen_id, motivo_nc")
        .in("tipo_comprobante", [3, 8, 13])
        .is("resolucion_financiera", null)
        .order("fecha_emision", { ascending: false })
        .limit(200);
      const rows = (data || []) as NCPendiente[];
      // enriquecer con cliente + factura origen
      const ventaIds = Array.from(new Set(rows.map(r => r.venta_id).filter(Boolean))) as string[];
      const factIds = Array.from(new Set(rows.map(r => r.factura_origen_id).filter(Boolean))) as string[];
      let ventas: Record<string, any> = {};
      let facts: Record<string, any> = {};
      if (ventaIds.length) {
        const { data: vs } = await supabase
          .from("ventas")
          .select("id, cliente_id, clientes(nombre)")
          .in("id", ventaIds);
        (vs || []).forEach((v: any) => { ventas[v.id] = v; });
      }
      if (factIds.length) {
        const { data: fs } = await supabase
          .from("comprobantes_afip")
          .select("id, tipo_comprobante, punto_venta, numero_comprobante")
          .in("id", factIds);
        (fs || []).forEach((f: any) => {
          facts[f.id] = `${f.tipo_comprobante === 1 ? "FC A" : f.tipo_comprobante === 6 ? "FC B" : "FC C"} ${String(f.punto_venta).padStart(4, "0")}-${String(f.numero_comprobante).padStart(8, "0")}`;
        });
      }
      setItems(rows.map(r => ({
        ...r,
        cliente_id: r.venta_id ? ventas[r.venta_id]?.cliente_id ?? null : null,
        cliente_nombre: r.venta_id ? ventas[r.venta_id]?.clientes?.nombre ?? null : null,
        factura_label: r.factura_origen_id ? facts[r.factura_origen_id] ?? null : null,
      })));
    } catch (e: any) {
      toast.error("Error al cargar pendientes: " + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [refreshKey]);

  const abrir = async (nc: NCPendiente) => {
    setSelected(nc);
    setTipoRes(nc.cliente_id ? "cuenta_corriente" : "caja");
    setCajaId(null);
    // cargar cajas abiertas
    const { data: propia } = await supabase
      .from("cajas")
      .select("id, fecha_apertura, usuario_id")
      .eq("usuario_id", user!.id)
      .eq("estado", "abierta")
      .order("fecha_apertura", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hasRole("admin")) {
      const { data: todas } = await supabase
        .from("cajas").select("id, fecha_apertura, usuario_id")
        .eq("estado", "abierta").order("fecha_apertura", { ascending: false });
      const ids = (todas || []).map((c: any) => c.usuario_id);
      let nombres: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nombre").in("id", ids);
        (profs || []).forEach((p: any) => { nombres[p.id] = p.nombre; });
      }
      setCajas((todas || []).map((c: any) => ({ ...c, usuario_nombre: nombres[c.usuario_id] || "Sin nombre" })));
      setCajaId(propia?.id || (todas?.[0]?.id ?? null));
    } else {
      setCajas(propia ? [{ ...(propia as any) }] : []);
      setCajaId(propia?.id || null);
    }
  };

  const aplicar = async () => {
    if (!selected || !user) return;
    setAplicando(true);
    try {
      const ncLabel = `${tipoLabel(selected.tipo_comprobante)} ${String(selected.punto_venta).padStart(4, "0")}-${String(selected.numero_comprobante).padStart(8, "0")}`;
      if (tipoRes === "caja") {
        if (!cajaId) { toast.error("Seleccioná una caja"); setAplicando(false); return; }
        const concepto = `Egreso por ${ncLabel}${selected.factura_label ? ` correspondiente a ${selected.factura_label}` : ""} (regularización)`;
        const { data: mov, error } = await supabase.from("movimientos_caja").insert({
          caja_id: cajaId, tipo: "egreso", monto: Number(selected.importe_total),
          concepto, usuario_id: user.id, venta_id: selected.venta_id,
        }).select("id").single();
        if (error) throw error;
        await supabase.from("comprobantes_afip").update({
          resolucion_financiera: "caja", caja_movimiento_id: mov.id,
          resolucion_at: new Date().toISOString(), resolucion_por: user.id,
        } as any).eq("id", selected.id);
        const { data: cajaAct } = await supabase.from("cajas").select("total_egresos").eq("id", cajaId).single();
        await supabase.from("cajas").update({
          total_egresos: Number(cajaAct?.total_egresos || 0) + Number(selected.importe_total),
        }).eq("id", cajaId);
        toast.success("Egreso registrado en caja");
      } else {
        if (!selected.cliente_id) { toast.error("La NC no tiene cliente asociado"); setAplicando(false); return; }
        const concepto = `${ncLabel}${selected.factura_label ? ` sobre ${selected.factura_label}` : ""} (regularización)`;
        const { data: mov, error } = await supabase.from("cliente_movimientos").insert({
          cliente_id: selected.cliente_id, tipo: "NCR",
          monto: Number(selected.importe_total), concepto, usuario_registro_id: user.id,
        } as any).select("id").single();
        if (error) throw error;
        await supabase.from("comprobantes_afip").update({
          resolucion_financiera: "cuenta_corriente", resolucion_cliente_movimiento_id: mov.id,
          resolucion_at: new Date().toISOString(), resolucion_por: user.id,
        } as any).eq("id", selected.id);
        toast.success("Crédito imputado a la cuenta corriente");
      }
      setSelected(null);
      await fetch();
      onResolved?.();
    } catch (e: any) {
      toast.error("Error al aplicar: " + e.message);
    }
    setAplicando(false);
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <>
      <Card className="border-yellow-500/40 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Notas de Crédito con resolución financiera pendiente
            <Badge variant="secondary">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>NC</TableHead>
                <TableHead>Factura origen</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(nc => (
                <TableRow key={nc.id}>
                  <TableCell className="text-sm">{nc.fecha_emision ? format(new Date(nc.fecha_emision + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className="font-medium">{tipoLabel(nc.tipo_comprobante)} {String(nc.punto_venta).padStart(4, "0")}-{String(nc.numero_comprobante).padStart(8, "0")}</TableCell>
                  <TableCell className="text-sm">{nc.factura_label || "-"}</TableCell>
                  <TableCell className="text-sm">{nc.cliente_nombre || "Consumidor Final"}</TableCell>
                  <TableCell className="text-right font-medium">${Number(nc.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => abrir(nc)}>Aplicar resolución</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !aplicando && !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver financieramente NC</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm space-y-1 rounded border bg-muted/30 p-3">
                <p><b>{tipoLabel(selected.tipo_comprobante)} {String(selected.punto_venta).padStart(4, "0")}-{String(selected.numero_comprobante).padStart(8, "0")}</b></p>
                <p>Importe: <b>${Number(selected.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></p>
                <p>Cliente: <b>{selected.cliente_nombre || "Consumidor Final"}</b></p>
              </div>
              <div>
                <Label className="mb-2 block">Tipo de resolución</Label>
                <RadioGroup value={tipoRes} onValueChange={(v) => setTipoRes(v as any)}>
                  <div className="flex items-center gap-2"><RadioGroupItem value="caja" id="r1" /><Label htmlFor="r1">Egreso en Caja</Label></div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="cuenta_corriente" id="r2" disabled={!selected.cliente_id} />
                    <Label htmlFor="r2" className={!selected.cliente_id ? "text-muted-foreground" : ""}>
                      Crédito en Cuenta Corriente{!selected.cliente_id ? " (no disponible: sin cliente)" : ""}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              {tipoRes === "caja" && (
                <div>
                  <Label className="mb-1 block">Caja</Label>
                  <select className="w-full border rounded px-2 py-1 text-sm bg-background"
                    value={cajaId ?? ""} onChange={(e) => setCajaId(e.target.value || null)}>
                    <option value="" disabled>Seleccionar...</option>
                    {cajas.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.usuario_nombre || "Caja"}{c.fecha_apertura ? ` — abierta ${format(new Date(c.fecha_apertura), "dd/MM HH:mm")}` : ""}
                      </option>
                    ))}
                  </select>
                  {cajas.length === 0 && <p className="text-xs text-destructive mt-1">No hay cajas abiertas.</p>}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)} disabled={aplicando}>Cancelar</Button>
                <Button onClick={aplicar} disabled={aplicando || (tipoRes === "caja" && !cajaId)}>
                  {aplicando ? "Aplicando..." : "Aplicar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}