import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface NcComprobante {
  id: string;
  tipo_comprobante: number;
  punto_venta: number;
  numero_comprobante: number;
  importe_total: number;
  venta_id?: string | null;
  factura_origen_id?: string | null;
}

interface CajaAbierta {
  id: string;
  fecha_apertura: string | null;
  usuario_id: string;
  usuario_nombre?: string | null;
}

type Tipo = "caja" | "cuenta_corriente";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nc: NcComprobante | null;
  onResuelto: () => void;
}

export function ResolverNcPendienteDialog({ open, onOpenChange, nc, onResuelto }: Props) {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("caja");
  const [tipoAuto, setTipoAuto] = useState<Tipo>("caja");
  const [motivoAuto, setMotivoAuto] = useState<string>("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNombre, setClienteNombre] = useState<string>("Consumidor Final");
  const [cajaPropia, setCajaPropia] = useState<CajaAbierta | null>(null);
  const [cajasAbiertas, setCajasAbiertas] = useState<CajaAbierta[]>([]);
  const [cajaSeleccionadaId, setCajaSeleccionadaId] = useState<string | null>(null);
  const [factOrigenLabel, setFactOrigenLabel] = useState<string>("");

  const ncLabel = nc
    ? `NC ${nc.tipo_comprobante === 3 ? "A" : nc.tipo_comprobante === 8 ? "B" : "C"} ${String(nc.punto_venta).padStart(4, "0")}-${String(nc.numero_comprobante).padStart(8, "0")}`
    : "";

  useEffect(() => {
    if (!open || !nc || !user) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nc?.id]);

  const cargar = async () => {
    if (!nc || !user) return;
    setLoading(true);
    try {
      // Factura origen
      if (nc.factura_origen_id) {
        const { data: f } = await supabase
          .from("comprobantes_afip")
          .select("tipo_comprobante, punto_venta, numero_comprobante")
          .eq("id", nc.factura_origen_id)
          .maybeSingle();
        if (f) {
          const letra = f.tipo_comprobante === 1 ? "A" : f.tipo_comprobante === 6 ? "B" : "C";
          setFactOrigenLabel(`Factura ${letra} ${String(f.punto_venta).padStart(4, "0")}-${String(f.numero_comprobante).padStart(8, "0")}`);
        }
      }

      let cId: string | null = null;
      let cNom = "Consumidor Final";
      let cIva: number | null = null;
      if (nc.venta_id) {
        const { data: v } = await supabase
          .from("ventas")
          .select("cliente_id, clientes(id, nombre, condicion_iva)")
          .eq("id", nc.venta_id)
          .maybeSingle();
        if (v && (v as any).clientes) {
          cId = (v as any).clientes.id;
          cNom = (v as any).clientes.nombre || cNom;
          cIva = (v as any).clientes.condicion_iva ?? null;
        }
      }
      setClienteId(cId);
      setClienteNombre(cNom);

      // Determinar resolución sugerida
      let t: Tipo = "caja";
      let motivo = "";
      const esCFinal = !cId || cIva === 5;
      if (esCFinal) {
        t = "caja";
        motivo = "Cliente Consumidor Final: el monto se descuenta de la caja.";
      } else if (nc.venta_id) {
        const { data: ccMov } = await supabase
          .from("cliente_movimientos")
          .select("id")
          .eq("venta_id", nc.venta_id)
          .eq("tipo", "compra")
          .limit(1)
          .maybeSingle();
        if (ccMov) {
          t = "cuenta_corriente";
          motivo = "Venta original cobrada en Cuenta Corriente: el crédito se imputa a la CC del cliente.";
        } else {
          t = "caja";
          motivo = "Venta original con pago directo: el monto se descuenta de la caja.";
        }
      } else {
        t = "caja";
        motivo = "NC sin venta vinculada: el monto se descuenta de la caja.";
      }
      setTipo(t);
      setTipoAuto(t);
      setMotivoAuto(motivo);

      // Cajas
      const { data: propia } = await supabase
        .from("cajas")
        .select("id, fecha_apertura, usuario_id")
        .eq("usuario_id", user.id)
        .eq("estado", "abierta")
        .order("fecha_apertura", { ascending: false })
        .limit(1)
        .maybeSingle();
      const propiaC = propia ? ({ ...(propia as any) } as CajaAbierta) : null;
      setCajaPropia(propiaC);
      setCajaSeleccionadaId(propiaC?.id ?? null);

      if (hasRole("admin")) {
        const { data: todas } = await supabase
          .from("cajas")
          .select("id, fecha_apertura, usuario_id")
          .eq("estado", "abierta")
          .order("fecha_apertura", { ascending: false });
        const ids = (todas || []).map((c: any) => c.usuario_id);
        const nombres: Record<string, string> = {};
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("id, nombre").in("id", ids);
          (profs || []).forEach((p: any) => { nombres[p.id] = p.nombre; });
        }
        const lista: CajaAbierta[] = (todas || []).map((c: any) => ({
          id: c.id, fecha_apertura: c.fecha_apertura, usuario_id: c.usuario_id,
          usuario_nombre: nombres[c.usuario_id] || "Sin nombre",
        }));
        setCajasAbiertas(lista);
      }
    } catch (e: any) {
      toast.error("Error al cargar: " + e.message);
    }
    setLoading(false);
  };

  const confirmar = async () => {
    if (!nc || !user) return;
    setSaving(true);
    try {
      if (tipo === "caja") {
        const cajaId = cajaSeleccionadaId;
        if (!cajaId) {
          toast.error("Seleccioná una caja abierta");
          setSaving(false);
          return;
        }
        const concepto = `Egreso por ${ncLabel}${factOrigenLabel ? ` correspondiente a ${factOrigenLabel}` : ""}`;
        const { data: mov, error: movErr } = await supabase
          .from("movimientos_caja")
          .insert({
            caja_id: cajaId,
            tipo: "egreso",
            monto: Number(nc.importe_total),
            concepto,
            usuario_id: user.id,
            venta_id: nc.venta_id ?? null,
          })
          .select("id")
          .single();
        if (movErr) throw movErr;
        const { error: updErr } = await supabase
          .from("comprobantes_afip")
          .update({
            resolucion_financiera: "caja",
            caja_movimiento_id: mov.id,
            resolucion_at: new Date().toISOString(),
            resolucion_por: user.id,
          } as any)
          .eq("id", nc.id);
        if (updErr) throw updErr;
        const { data: cajaActual } = await supabase
          .from("cajas").select("total_egresos").eq("id", cajaId).single();
        await supabase
          .from("cajas")
          .update({ total_egresos: Number(cajaActual?.total_egresos || 0) + Number(nc.importe_total) })
          .eq("id", cajaId);
        toast.success("Egreso registrado en caja");
      } else {
        if (!clienteId) {
          toast.error("La NC no tiene cliente con CC. Resolvé por caja.");
          setSaving(false);
          return;
        }
        const concepto = `${ncLabel}${factOrigenLabel ? ` sobre ${factOrigenLabel}` : ""}`;
        const { data: mov, error: movErr } = await supabase
          .from("cliente_movimientos")
          .insert({
            cliente_id: clienteId,
            tipo: "NCR",
            monto: Number(nc.importe_total),
            concepto,
            usuario_registro_id: user.id,
          } as any)
          .select("id")
          .single();
        if (movErr) throw movErr;
        const { error: updErr } = await supabase
          .from("comprobantes_afip")
          .update({
            resolucion_financiera: "cuenta_corriente",
            resolucion_cliente_movimiento_id: mov.id,
            resolucion_at: new Date().toISOString(),
            resolucion_por: user.id,
          } as any)
          .eq("id", nc.id);
        if (updErr) throw updErr;
        toast.success("Crédito imputado en la cuenta corriente del cliente");
      }
      onResuelto();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + (e?.message || e));
    }
    setSaving(false);
  };

  if (!nc) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolver financieramente — {ncLabel}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded border bg-muted/30 p-3 text-sm space-y-1">
              {factOrigenLabel && <p>Sobre <b>{factOrigenLabel}</b></p>}
              <p>Cliente: <b>{clienteNombre}</b></p>
              <p>Importe: <b>${Number(nc.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></p>
            </div>
            <div className="border rounded p-3 space-y-2 bg-primary/5">
              <p className="text-sm font-medium">Sugerencia automática</p>
              <p className="text-xs text-muted-foreground">{motivoAuto}</p>
            </div>
            <div>
              <Label className="mb-2 block">Tipo de resolución</Label>
              <RadioGroup
                value={tipo}
                onValueChange={(v) => {
                  if (v === "cuenta_corriente" && !clienteId) return;
                  setTipo(v as Tipo);
                }}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="caja" id="r-caja" />
                  <Label htmlFor="r-caja">Egreso en caja</Label>
                </div>
                {clienteId && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="cuenta_corriente" id="r-cc" />
                    <Label htmlFor="r-cc">Crédito en CC del cliente</Label>
                  </div>
                )}
              </RadioGroup>
              {!clienteId && (
                <p className="text-xs text-muted-foreground mt-1">
                  La NC corresponde a Consumidor Final, sólo puede resolverse por caja.
                </p>
              )}
            </div>
            {tipo === "caja" && (
              <div>
                <Label className="text-xs">Caja</Label>
                {hasRole("admin") ? (
                  <select
                    className="w-full border rounded px-2 py-1 text-sm bg-background"
                    value={cajaSeleccionadaId ?? ""}
                    onChange={(e) => setCajaSeleccionadaId(e.target.value || null)}
                  >
                    <option value="" disabled>Seleccionar caja abierta...</option>
                    {cajasAbiertas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.usuario_nombre}{c.id === cajaPropia?.id ? " (propia)" : ""}
                        {c.fecha_apertura ? ` — abierta ${format(new Date(c.fecha_apertura), "dd/MM HH:mm")}` : ""}
                      </option>
                    ))}
                  </select>
                ) : cajaPropia ? (
                  <p className="text-xs text-muted-foreground">
                    Caja propia abierta el {cajaPropia.fecha_apertura ? format(new Date(cajaPropia.fecha_apertura), "dd/MM/yyyy HH:mm") : "—"}.
                  </p>
                ) : (
                  <p className="text-xs text-destructive">No tenés caja abierta.</p>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            onClick={confirmar}
            disabled={
              saving ||
              loading ||
              (tipo === "caja" && !cajaSeleccionadaId) ||
              (tipo === "cuenta_corriente" && !clienteId)
            }
          >
            {saving ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}