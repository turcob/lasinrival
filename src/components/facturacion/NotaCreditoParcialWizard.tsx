import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConfiguracionComercio } from "@/hooks/useConfiguracionComercio";
import { imprimirTicketFactura } from "@/lib/imprimirTicketFactura";
import { format } from "date-fns";

interface FacturaOrigen {
  id: string;
  tipo_comprobante: number;
  punto_venta: number;
  numero_comprobante: number;
  importe_total: number;
  importe_neto: number;
  importe_iva: number;
  doc_tipo: number;
  doc_nro: number;
  cuit_emisor: string;
  fecha_emision: string;
  venta_id: string | null;
}

interface SaldoItem {
  venta_detalle_id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad_facturada: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  cantidad_acreditada: number;
  cantidad_disponible: number;
}

interface Saldo {
  factura_id: string;
  venta_id: string | null;
  total_factura: number;
  total_acreditado: number;
  monto_disponible: number;
  items: SaldoItem[];
}

interface VentaInfo {
  numero_comprobante: number | null;
  fecha: string | null;
  cliente: {
    id: string;
    nombre: string;
    dni_cuit: string | null;
    condicion_iva: number | null;
  } | null;
}

type Motivo = "devolucion" | "bonificacion" | "error_facturacion" | "otro";
type Modo = "items" | "bonificacion";
type Alcance = "parcial" | "total";
type ResolucionTipo = "caja" | "cuenta_corriente";

interface CajaAbierta {
  id: string;
  fecha_apertura: string | null;
  usuario_id: string;
  usuario_nombre?: string | null;
}

interface NcEmitidaState {
  comprobante_id: string;
  punto_venta: number;
  numero_comprobante: number;
  tipo_comprobante: number;
  total: number;
}

const NC_TIPO_MAP: Record<number, number> = { 1: 3, 6: 8, 11: 13 };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factura: FacturaOrigen | null;
  onEmitida: () => void;
}

export function NotaCreditoParcialWizard({ open, onOpenChange, factura, onEmitida }: Props) {
  const { user } = useAuth();
  const { hasRole } = useAuth();
  const { config: comercioConfig } = useConfiguracionComercio();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [venta, setVenta] = useState<VentaInfo | null>(null);

  const [motivo, setMotivo] = useState<Motivo>("devolucion");
  const [observaciones, setObservaciones] = useState("");
  const [modo, setModo] = useState<Modo>("items");
  const [alcance, setAlcance] = useState<Alcance>("parcial");
  const [anularVenta, setAnularVenta] = useState<"si" | "no">("no");

  // items mode
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [reingresarStock, setReingresarStock] = useState<"si" | "no">("si");

  // bonificacion mode
  const [tipoBonif, setTipoBonif] = useState<"importe" | "porcentaje">("importe");
  const [valorBonif, setValorBonif] = useState<number>(0);

  // Resolución financiera (post-emisión, obligatoria)
  const [ncEmitida, setNcEmitida] = useState<NcEmitidaState | null>(null);
  const [tipoResolucionAuto, setTipoResolucionAuto] = useState<ResolucionTipo | null>(null);
  const [motivoResolucion, setMotivoResolucion] = useState<string>("");
  const [cajaPropia, setCajaPropia] = useState<CajaAbierta | null>(null);
  const [cajasAbiertas, setCajasAbiertas] = useState<CajaAbierta[]>([]);
  const [cajaSeleccionadaId, setCajaSeleccionadaId] = useState<string | null>(null);
  const [ventaEnCC, setVentaEnCC] = useState<boolean>(false);
  const [resolviendo, setResolviendo] = useState(false);

  useEffect(() => {
    if (!open || !factura) return;
    setStep(1);
    setMotivo("devolucion");
    setObservaciones("");
    setModo("items");
    setAlcance("parcial");
    setAnularVenta("no");
    setCantidades({});
    setReingresarStock("si");
    setTipoBonif("importe");
    setValorBonif(0);
    setNcEmitida(null);
    setTipoResolucionAuto(null);
    setMotivoResolucion("");
    setCajaPropia(null);
    setCajasAbiertas([]);
    setCajaSeleccionadaId(null);
    setVentaEnCC(false);
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, factura?.id]);

  const cargarDatos = async () => {
    if (!factura || !user) return;
    setLoading(true);
    try {
      const { data: saldoData, error: saldoErr } = await supabase
        .rpc("get_factura_saldo_disponible", { p_factura_id: factura.id });
      if (saldoErr) throw saldoErr;
      setSaldo(saldoData as unknown as Saldo);

      let clienteIdLocal: string | null = null;
      let condicionIvaLocal: number | null = null;
      if (factura.venta_id) {
        const { data: v } = await supabase
          .from("ventas")
          .select("numero_comprobante, fecha, cliente_id, clientes(id, nombre, dni_cuit, condicion_iva)")
          .eq("id", factura.venta_id)
          .maybeSingle();
        if (v) {
          setVenta({
            numero_comprobante: v.numero_comprobante,
            fecha: v.fecha,
            cliente: (v as any).clientes || null,
          });
          clienteIdLocal = (v as any).clientes?.id ?? null;
          condicionIvaLocal = (v as any).clientes?.condicion_iva ?? null;
        }
      } else {
        setVenta(null);
      }

      // Determinar resolución automática
      let tipo: ResolucionTipo = "caja";
      let motivoRes = "";
      const esCFinal = !clienteIdLocal || condicionIvaLocal === 5;
      if (esCFinal) {
        tipo = "caja";
        motivoRes = "Cliente Consumidor Final: el monto se descuenta de la caja.";
      } else if (factura.venta_id) {
        // Detectar si la venta fue a Cuenta Corriente (existe movimiento 'compra' del cliente)
        const { data: ccMov } = await supabase
          .from("cliente_movimientos")
          .select("id")
          .eq("venta_id", factura.venta_id)
          .eq("tipo", "compra")
          .limit(1)
          .maybeSingle();
        if (ccMov) {
          tipo = "cuenta_corriente";
          motivoRes = "Venta original cobrada en Cuenta Corriente: el crédito se imputa a la CC del cliente.";
        } else {
          tipo = "caja";
          motivoRes = "Venta original con pago directo: el monto se descuenta de la caja.";
        }
      } else {
        tipo = "caja";
        motivoRes = "Comprobante sin venta vinculada: el monto se descuenta de la caja.";
      }
      setTipoResolucionAuto(tipo);
      setMotivoResolucion(motivoRes);

      if (tipo === "caja") {
        // Caja propia del usuario actual
        const { data: propia } = await supabase
          .from("cajas")
          .select("id, fecha_apertura, usuario_id")
          .eq("usuario_id", user.id)
          .eq("estado", "abierta")
          .order("fecha_apertura", { ascending: false })
          .limit(1)
          .maybeSingle();
        const propiaC = propia ? { ...(propia as any) } as CajaAbierta : null;
        setCajaPropia(propiaC);
        setCajaSeleccionadaId(propiaC?.id ?? null);

        if (hasRole("admin")) {
          const { data: todas } = await supabase
            .from("cajas")
            .select("id, fecha_apertura, usuario_id")
            .eq("estado", "abierta")
            .order("fecha_apertura", { ascending: false });
          const ids = (todas || []).map((c: any) => c.usuario_id);
          let nombres: Record<string, string> = {};
          if (ids.length) {
            const { data: profs } = await supabase
              .from("profiles").select("id, nombre").in("id", ids);
            (profs || []).forEach((p: any) => { nombres[p.id] = p.nombre; });
          }
          const lista: CajaAbierta[] = (todas || []).map((c: any) => ({
            id: c.id, fecha_apertura: c.fecha_apertura, usuario_id: c.usuario_id,
            usuario_nombre: nombres[c.usuario_id] || "Sin nombre",
          }));
          setCajasAbiertas(lista);
        }
      }
    } catch (e: any) {
      toast.error("Error al cargar datos de la factura: " + e.message);
    }
    setLoading(false);
  };

  // Auto-set modo según motivo
  useEffect(() => {
    if (motivo === "devolucion") setModo("items");
    else if (motivo === "bonificacion") setModo("bonificacion");
  }, [motivo]);

  // Al elegir "total", forzar modo items y precargar cantidades disponibles
  useEffect(() => {
    if (alcance === "total" && saldo) {
      setModo("items");
      const next: Record<string, number> = {};
      saldo.items.forEach((it) => {
        if (it.cantidad_disponible > 0) next[it.venta_detalle_id] = it.cantidad_disponible;
      });
      setCantidades(next);
    }
  }, [alcance, saldo]);

  const itemsSeleccionados = useMemo(() => {
    if (!saldo) return [] as Array<SaldoItem & { cantidad: number; importe: number }>;
    return saldo.items
      .map((it) => {
        const cant = Number(cantidades[it.venta_detalle_id] || 0);
        const precioFinal = Number(it.precio_unitario) * (1 - (Number(it.descuento_porcentaje) || 0) / 100);
        return { ...it, cantidad: cant, importe: cant * precioFinal };
      })
      .filter((x) => x.cantidad > 0);
  }, [cantidades, saldo]);

  const totalNc = useMemo(() => {
    if (modo === "items") {
      return itemsSeleccionados.reduce((s, it) => s + it.importe, 0);
    }
    if (!saldo) return 0;
    if (tipoBonif === "importe") return Math.max(0, Number(valorBonif) || 0);
    return Math.max(0, ((Number(valorBonif) || 0) / 100) * saldo.monto_disponible);
  }, [modo, itemsSeleccionados, tipoBonif, valorBonif, saldo]);

  const netoNc = totalNc / 1.21;
  const ivaNc = totalNc - netoNc;

  const motivoLabel = {
    devolucion: "Devolución de mercadería",
    bonificacion: "Bonificación comercial",
    error_facturacion: "Error de facturación",
    otro: "Otro",
  }[motivo];

  const puedeAvanzar = () => {
    if (step === 1) return !!saldo && saldo.monto_disponible > 0;
    if (step === 2) {
      if (motivo === "otro" && !observaciones.trim()) return false;
      return true;
    }
    if (step === 3) {
      if (modo === "items") return itemsSeleccionados.length > 0;
      return totalNc > 0 && saldo != null && totalNc <= saldo.monto_disponible + 0.01;
    }
    return true;
  };

  const updateCantidad = (id: string, val: string, max: number) => {
    let v = Number(val.replace(",", "."));
    if (isNaN(v) || v < 0) v = 0;
    if (v > max) v = max;
    setCantidades((c) => ({ ...c, [id]: v }));
  };

  const formatFechaAfip = (fecha: string): string => {
    if (fecha && fecha.length === 8) return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
    return fecha || new Date().toISOString().split("T")[0];
  };

  const handleEmitir = async () => {
    if (!factura || !user || !saldo) return;
    if (totalNc <= 0) {
      toast.error("El importe de la NC debe ser mayor a 0");
      return;
    }
    if (totalNc > saldo.monto_disponible + 0.01) {
      toast.error("El importe excede el saldo disponible de la factura");
      return;
    }
    const ncTipo = NC_TIPO_MAP[factura.tipo_comprobante];
    if (!ncTipo) {
      toast.error("Tipo de comprobante no soportado para NC");
      return;
    }

    setEmitiendo(true);
    try {
      // Armar items AFIP
      let itemsAfip: Array<{ descripcion: string; cantidad: number; precio_unitario: number; iva_id: number }>;
      if (modo === "items") {
        itemsAfip = itemsSeleccionados.map((it) => {
          const precioFinal = Number(it.precio_unitario) * (1 - (Number(it.descuento_porcentaje) || 0) / 100);
          return {
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio_unitario: precioFinal / 1.21,
            iva_id: 5,
          };
        });
      } else {
        itemsAfip = [{
          descripcion: `Bonificación - ${motivoLabel}`,
          cantidad: 1,
          precio_unitario: totalNc / 1.21,
          iva_id: 5,
        }];
      }

      const fechaAsoc = factura.fecha_emision
        ? String(factura.fecha_emision).replace(/-/g, "").slice(0, 8)
        : undefined;

      const { data: ncResult, error: ncErr } = await supabase.functions.invoke(
        "afip-facturacion/emitir",
        {
          body: {
            tipo_comprobante: ncTipo,
            punto_venta: comercioConfig?.punto_venta || factura.punto_venta || 1,
            concepto: 1,
            doc_tipo: factura.doc_tipo,
            doc_nro: Number(factura.doc_nro) || 0,
            condicion_iva_receptor: venta?.cliente?.condicion_iva ?? 5,
            importe_total: Number(totalNc.toFixed(2)),
            importe_neto: Number(netoNc.toFixed(2)),
            importe_iva: Number(ivaNc.toFixed(2)),
            items: itemsAfip,
            venta_id: factura.venta_id,
            cbtes_asoc: [{
              tipo: factura.tipo_comprobante,
              punto_venta: factura.punto_venta,
              numero: factura.numero_comprobante,
              cuit: factura.cuit_emisor,
              fecha: fechaAsoc,
            }],
          },
        }
      );

      if (ncErr || (ncResult as any)?.error) {
        const msg = ncErr?.message || (ncResult as any)?.error || "Error desconocido";
        toast.error("ARCA rechazó la NC: " + msg);
        setEmitiendo(false);
        return;
      }

      // Guardar comprobante AFIP NC
      const tipoNc = modo === "items" ? "parcial_items" : "parcial_bonificacion";
      const { data: compNc, error: insertNcErr } = await supabase
        .from("comprobantes_afip")
        .insert({
          tipo_comprobante: ncTipo,
          punto_venta: (ncResult as any).punto_venta,
          numero_comprobante: (ncResult as any).numero_comprobante,
          cae: (ncResult as any).cae,
          cae_vencimiento: formatFechaAfip((ncResult as any).cae_vencimiento),
          cuit_emisor: comercioConfig?.cuit?.replace(/\D/g, "") || factura.cuit_emisor || "",
          doc_tipo: factura.doc_tipo,
          doc_nro: Number(factura.doc_nro) || 0,
          importe_total: Number(totalNc.toFixed(2)),
          importe_neto: Number(netoNc.toFixed(2)),
          importe_iva: Number(ivaNc.toFixed(2)),
          usuario_id: user.id,
          venta_id: factura.venta_id,
          factura_origen_id: factura.id,
          tipo_nc: tipoNc,
          motivo_nc: motivo,
          observaciones: observaciones || null,
        } as any)
        .select("id")
        .single();

      if (insertNcErr) {
        toast.warning(`NC autorizada (CAE: ${(ncResult as any).cae}) pero hubo error al guardarla: ${insertNcErr.message}`);
      }

      // Insertar nota_credito_items
      if (compNc?.id) {
        if (modo === "items") {
          const rows = itemsSeleccionados.map((it) => {
            const precioFinal = Number(it.precio_unitario) * (1 - (Number(it.descuento_porcentaje) || 0) / 100);
            return {
              comprobante_nc_id: compNc.id,
              comprobante_factura_id: factura.id,
              venta_detalle_id: it.venta_detalle_id,
              producto_id: it.producto_id,
              descripcion: it.descripcion,
              cantidad: it.cantidad,
              precio_unitario: precioFinal,
              importe: it.importe,
              reingresado_stock: reingresarStock === "si",
            };
          });
          await supabase.from("nota_credito_items").insert(rows);
        } else {
          await supabase.from("nota_credito_items").insert({
            comprobante_nc_id: compNc.id,
            comprobante_factura_id: factura.id,
            descripcion: `Bonificación - ${motivoLabel}`,
            cantidad: 0,
            precio_unitario: 0,
            importe: totalNc,
            reingresado_stock: false,
          });
        }
      }

      // Reingresar stock si corresponde
      if (modo === "items" && reingresarStock === "si") {
        for (const it of itemsSeleccionados) {
          if (!it.producto_id) continue;
          const { data: prod } = await supabase
            .from("productos").select("stock_actual").eq("id", it.producto_id).single();
          if (prod) {
            const stockAnt = Number(prod.stock_actual) || 0;
            const stockNuevo = stockAnt + Number(it.cantidad);
            await supabase.from("productos").update({ stock_actual: stockNuevo }).eq("id", it.producto_id);
            await supabase.from("movimientos_inventario").insert({
              producto_id: it.producto_id,
              tipo: "entrada",
              cantidad: it.cantidad,
              stock_anterior: stockAnt,
              stock_nuevo: stockNuevo,
              motivo: `NC parcial #${(ncResult as any).numero_comprobante} - ${motivoLabel}`,
              usuario_id: user.id,
              venta_id: factura.venta_id,
            });
          }
        }
      }

      // Actualizar venta: monto_acreditado y flag
      if (factura.venta_id) {
        const nuevoMonto = Number((saldo.total_acreditado + totalNc).toFixed(2));
        const totalmenteAcreditada = nuevoMonto >= Number(factura.importe_total) - 0.01;
        const update: any = {
          monto_acreditado: nuevoMonto,
          acreditada_parcial: true,
        };
        // Solo anular la venta si:
        // - es una NC total y el usuario optó por anular, o
        // - se acreditó el total acumulado y no es alcance="total" con anularVenta="no"
        const debeAnular =
          (alcance === "total" && anularVenta === "si") ||
          (alcance !== "total" && totalmenteAcreditada);
        if (debeAnular) {
          update.anulada = true;
          update.motivo_anulacion = `NC total acumulada por ${motivoLabel}`;
          update.fecha_anulacion = new Date().toISOString();
          update.anulada_por = user.id;
        }
        await supabase.from("ventas").update(update).eq("id", factura.venta_id);
      }

      toast.success(`Nota de Crédito emitida — CAE: ${(ncResult as any).cae}`);

      // Imprimir ticket NC
      try {
        const detallesTicket = modo === "items"
          ? itemsSeleccionados.map((it) => {
              const precioFinal = Number(it.precio_unitario) * (1 - (Number(it.descuento_porcentaje) || 0) / 100);
              return {
                nombre: it.descripcion,
                cantidad: it.cantidad,
                precio: precioFinal,
                subtotal: precioFinal * it.cantidad,
                descuento_porcentaje: Number(it.descuento_porcentaje) || 0,
              };
            })
          : [{
              nombre: `Bonificación - ${motivoLabel}`,
              cantidad: 1,
              precio: totalNc,
              subtotal: totalNc,
            }];

        imprimirTicketFactura({
          comercio: comercioConfig ? {
            nombre_fantasia: comercioConfig.nombre_fantasia,
            razon_social: comercioConfig.razon_social,
            direccion: comercioConfig.direccion,
            localidad: comercioConfig.localidad,
            provincia: comercioConfig.provincia,
            cuit: comercioConfig.cuit,
            condicion_iva: "IVA Resp. Inscripto",
            telefono: (comercioConfig as any).telefono,
          } : null,
          fecha: new Date(),
          total: totalNc,
          detalles: detallesTicket,
          cliente: venta?.cliente ? {
            nombre: venta.cliente.nombre,
            dni_cuit: venta.cliente.dni_cuit,
            condicion_iva: venta.cliente.condicion_iva,
          } : null,
          factura: {
            tipo_comprobante: ncTipo,
            punto_venta: (ncResult as any).punto_venta,
            numero_comprobante: (ncResult as any).numero_comprobante,
            cae: (ncResult as any).cae,
            cae_vencimiento: formatFechaAfip((ncResult as any).cae_vencimiento),
            importe_total: totalNc,
            importe_neto: Number(netoNc.toFixed(2)),
            importe_iva: Number(ivaNc.toFixed(2)),
            doc_nro: factura.doc_nro,
            comprobante_asociado: {
              tipo_comprobante: factura.tipo_comprobante,
              punto_venta: factura.punto_venta,
              numero_comprobante: factura.numero_comprobante,
            },
          },
        });
      } catch (e) {
        console.error("Error imprimiendo ticket NC:", e);
      }

      // Bloquear el wizard hasta resolver financieramente la NC
      if (compNc?.id) {
        setNcEmitida({
          comprobante_id: compNc.id,
          punto_venta: (ncResult as any).punto_venta,
          numero_comprobante: (ncResult as any).numero_comprobante,
          tipo_comprobante: ncTipo,
          total: Number(totalNc.toFixed(2)),
        });
        onEmitida();
      } else {
        // Sin id de comprobante guardado, no podemos vincular la resolución
        onEmitida();
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error("Error al emitir NC: " + (e?.message || e));
    }
    setEmitiendo(false);
  };

  const esConsumidorFinal = !venta?.cliente?.id || venta?.cliente?.condicion_iva === 5;

  const ncLabel = ncEmitida
    ? `NC ${ncEmitida.tipo_comprobante === 3 ? "A" : ncEmitida.tipo_comprobante === 8 ? "B" : "C"} ${String(ncEmitida.punto_venta).padStart(4, "0")}-${String(ncEmitida.numero_comprobante).padStart(8, "0")}`
    : "";
  const facturaLabel = factura
    ? `Factura ${factura.tipo_comprobante === 1 ? "A" : factura.tipo_comprobante === 6 ? "B" : "C"} ${String(factura.punto_venta).padStart(4, "0")}-${String(factura.numero_comprobante).padStart(8, "0")}`
    : "";

  const confirmarResolucion = async () => {
    if (!ncEmitida || !user || !factura || !tipoResolucionAuto) return;
    setResolviendo(true);
    try {
      if (tipoResolucionAuto === "caja") {
        const cajaId = cajaSeleccionadaId;
        if (!cajaId) {
          toast.error("No hay una caja abierta para registrar el egreso");
          setResolviendo(false);
          return;
        }
        const concepto = `Egreso por ${ncLabel} correspondiente a ${facturaLabel}`;
        const { data: mov, error: movErr } = await supabase
          .from("movimientos_caja")
          .insert({
            caja_id: cajaId,
            tipo: "egreso",
            monto: ncEmitida.total,
            concepto,
            usuario_id: user.id,
            venta_id: factura.venta_id,
          })
          .select("id")
          .single();
        if (movErr) throw movErr;
        await supabase
          .from("comprobantes_afip")
          .update({
            resolucion_financiera: "caja",
            caja_movimiento_id: mov.id,
            resolucion_at: new Date().toISOString(),
            resolucion_por: user.id,
          } as any)
          .eq("id", ncEmitida.comprobante_id);
        // Actualizar total_egresos de la caja para que el esperado refleje el egreso
        const { data: cajaActual } = await supabase
          .from("cajas")
          .select("total_egresos")
          .eq("id", cajaId)
          .single();
        await supabase
          .from("cajas")
          .update({ total_egresos: Number(cajaActual?.total_egresos || 0) + Number(ncEmitida.total) })
          .eq("id", cajaId);
        toast.success("Egreso registrado en caja");
      } else {
        if (!venta?.cliente?.id) {
          toast.error("No es posible registrar un crédito en Cuenta Corriente porque el comprobante corresponde a un cliente Consumidor Final.");
          setResolviendo(false);
          return;
        }
        const concepto = `${ncLabel} sobre ${facturaLabel} - ${motivoLabel}`;
        const { data: mov, error: movErr } = await supabase
          .from("cliente_movimientos")
          .insert({
            cliente_id: venta.cliente.id,
            tipo: "NCR",
            monto: ncEmitida.total,
            concepto,
            usuario_registro_id: user.id,
          } as any)
          .select("id")
          .single();
        if (movErr) throw movErr;
        await supabase
          .from("comprobantes_afip")
          .update({
            resolucion_financiera: "cuenta_corriente",
            resolucion_cliente_movimiento_id: mov.id,
            resolucion_at: new Date().toISOString(),
            resolucion_por: user.id,
          } as any)
          .eq("id", ncEmitida.comprobante_id);
        toast.success("Crédito registrado en la cuenta corriente del cliente");
      }
      onEmitida();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error al registrar la resolución: " + (e?.message || e));
    }
    setResolviendo(false);
  };

  if (!factura) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !emitiendo && !ncEmitida && !resolviendo && onOpenChange(o)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ncEmitida
              ? `Resolución financiera — ${ncLabel}`
              : `Generar Nota de Crédito — Factura ${String(factura.punto_venta).padStart(4, "0")}-${String(factura.numero_comprobante).padStart(8, "0")}`}
          </DialogTitle>
        </DialogHeader>

        {ncEmitida ? (
          <div className="space-y-4 mt-2">
            <div className="rounded border bg-muted/30 p-3 text-sm space-y-1">
              <p><b>{ncLabel}</b> emitida correctamente sobre <b>{facturaLabel}</b>.</p>
              <p>Importe total: <b>${ncEmitida.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></p>
              <p>Cliente: <b>{venta?.cliente?.nombre || "Consumidor Final"}</b></p>
            </div>
            <div className="border rounded p-3 space-y-2 bg-primary/5">
              <p className="text-sm font-medium">Resolución financiera automática</p>
              <p className="text-xs text-muted-foreground">{motivoResolucion}</p>
              {tipoResolucionAuto === "caja" ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Se registrará un <b>egreso de ${ncEmitida.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b>
                    {" "}en la caja{hasRole("admin") ? " seleccionada" : " del usuario"}.
                  </p>
                  {hasRole("admin") ? (
                    <div>
                      <Label className="text-xs">Caja</Label>
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
                      {cajasAbiertas.length === 0 && (
                        <p className="text-xs text-destructive mt-1">No hay cajas abiertas. Abrí una caja para continuar.</p>
                      )}
                    </div>
                  ) : (
                    cajaPropia ? (
                      <p className="text-xs text-muted-foreground">
                        Caja propia abierta el {cajaPropia.fecha_apertura ? format(new Date(cajaPropia.fecha_apertura), "dd/MM/yyyy HH:mm") : "—"}.
                      </p>
                    ) : (
                      <p className="text-xs text-destructive">
                        No tenés una caja abierta. Pedile a un administrador que registre la resolución o abrí tu caja.
                      </p>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm">
                  Se sumarán <b>${ncEmitida.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b> como crédito a la cuenta corriente de <b>{venta?.cliente?.nombre}</b>.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={confirmarResolucion}
                disabled={resolviendo || (tipoResolucionAuto === "caja" && !cajaSeleccionadaId)}
              >
                {resolviendo ? "Registrando..." : hasRole("admin") && tipoResolucionAuto === "caja" ? "Confirmar" : "Aceptar"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <>
        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3, 4].map((n) => (
            <Badge key={n} variant={step === n ? "default" : step > n ? "secondary" : "outline"}>
              {n}. {["Factura", "Motivo", "Detalle", "Confirmar"][n - 1]}
            </Badge>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {step === 1 && saldo && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Factura</p>
                    <p className="font-medium">{String(factura.punto_venta).padStart(4, "0")}-{String(factura.numero_comprobante).padStart(8, "0")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fecha</p>
                    <p className="font-medium">{format(new Date(factura.fecha_emision), "dd/MM/yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cliente</p>
                    <p className="font-medium">{venta?.cliente?.nombre || "Consumidor Final"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total factura</p>
                    <p className="font-medium">${Number(factura.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ya acreditado</p>
                    <p className="font-medium">${Number(saldo.total_acreditado).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Disponible para acreditar</p>
                    <p className="font-bold text-primary">${Number(saldo.monto_disponible).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {saldo.monto_disponible <= 0 && (
                  <p className="text-sm text-destructive">Esta factura ya fue totalmente acreditada.</p>
                )}

                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Facturada</TableHead>
                        <TableHead className="text-right">Acreditada</TableHead>
                        <TableHead className="text-right">Disponible</TableHead>
                        <TableHead className="text-right">P. Unit.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saldo.items.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin items</TableCell></TableRow>
                      ) : saldo.items.map((it) => (
                        <TableRow key={it.venta_detalle_id}>
                          <TableCell>{it.descripcion}</TableCell>
                          <TableCell className="text-right">{it.cantidad_facturada}</TableCell>
                          <TableCell className="text-right">{it.cantidad_acreditada}</TableCell>
                          <TableCell className="text-right font-medium">{it.cantidad_disponible}</TableCell>
                          <TableCell className="text-right">${Number(it.precio_unitario).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Alcance de la Nota de Crédito</Label>
                  <RadioGroup value={alcance} onValueChange={(v) => setAlcance(v as Alcance)}>
                    <div className="flex items-center gap-2"><RadioGroupItem value="parcial" id="a1" /><Label htmlFor="a1">Parcial (seleccionar ítems o importe)</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="total" id="a2" /><Label htmlFor="a2">Por el total de la factura</Label></div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="mb-2 block">Motivo de la Nota de Crédito</Label>
                  <RadioGroup value={motivo} onValueChange={(v) => setMotivo(v as Motivo)}>
                    <div className="flex items-center gap-2"><RadioGroupItem value="devolucion" id="m1" /><Label htmlFor="m1">Devolución de mercadería</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="bonificacion" id="m2" /><Label htmlFor="m2">Bonificación comercial</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="error_facturacion" id="m3" /><Label htmlFor="m3">Error de facturación</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="otro" id="m4" /><Label htmlFor="m4">Otro</Label></div>
                  </RadioGroup>
                </div>

                {alcance === "parcial" && (motivo === "error_facturacion" || motivo === "otro") && (
                  <div>
                    <Label className="mb-2 block">Modalidad</Label>
                    <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)}>
                      <div className="flex items-center gap-2"><RadioGroupItem value="items" id="md1" /><Label htmlFor="md1">Por ítems facturados</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="bonificacion" id="md2" /><Label htmlFor="md2">Por importe / porcentaje</Label></div>
                    </RadioGroup>
                  </div>
                )}

                {alcance === "total" && factura.venta_id && (
                  <div className="border rounded p-3 bg-muted/30">
                    <Label className="mb-2 block">¿Anular también la venta original?</Label>
                    <RadioGroup value={anularVenta} onValueChange={(v) => setAnularVenta(v as "si" | "no")} className="flex gap-6">
                      <div className="flex items-center gap-2"><RadioGroupItem value="si" id="an1" /><Label htmlFor="an1">Sí, anular la venta</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="no" id="an2" /><Label htmlFor="an2">No, solo emitir la NC</Label></div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground mt-2">
                      Si elegís "No", la venta original permanecerá vigente y solo se registrará la NC en AFIP y en la cuenta corriente del cliente.
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="obs">
                    Observaciones {motivo === "otro" && <span className="text-destructive">*</span>}
                  </Label>
                  <Textarea id="obs" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} />
                </div>
              </div>
            )}

            {step === 3 && saldo && (
              <div className="space-y-4">
                {modo === "items" ? (
                  <>
                    <div className="border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Disponible</TableHead>
                            <TableHead className="text-right">A devolver</TableHead>
                            <TableHead className="text-right">P. Unit.</TableHead>
                            <TableHead className="text-right">Desc.</TableHead>
                            <TableHead className="text-right">Importe</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saldo.items.filter((it) => it.cantidad_disponible > 0).map((it) => {
                            const precioFinal = Number(it.precio_unitario) * (1 - (Number(it.descuento_porcentaje) || 0) / 100);
                            const cant = Number(cantidades[it.venta_detalle_id] || 0);
                            return (
                              <TableRow key={it.venta_detalle_id}>
                                <TableCell>{it.descripcion}</TableCell>
                                <TableCell className="text-right">{it.cantidad_disponible}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={it.cantidad_disponible}
                                    step="0.01"
                                    value={cant || ""}
                                    onChange={(e) => updateCantidad(it.venta_detalle_id, e.target.value, it.cantidad_disponible)}
                                    className="w-24 ml-auto text-right"
                                  />
                                </TableCell>
                                <TableCell className="text-right">${Number(it.precio_unitario).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">{Number(it.descuento_porcentaje) || 0}%</TableCell>
                                <TableCell className="text-right font-medium">${(cant * precioFinal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <Label className="mb-2 block">¿La mercadería vuelve al stock?</Label>
                      <RadioGroup value={reingresarStock} onValueChange={(v) => setReingresarStock(v as any)} className="flex gap-6">
                        <div className="flex items-center gap-2"><RadioGroupItem value="si" id="s1" /><Label htmlFor="s1">Sí, reingresar al inventario</Label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="no" id="s2" /><Label htmlFor="s2">No</Label></div>
                      </RadioGroup>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <RadioGroup value={tipoBonif} onValueChange={(v) => setTipoBonif(v as any)} className="flex gap-6">
                      <div className="flex items-center gap-2"><RadioGroupItem value="importe" id="b1" /><Label htmlFor="b1">Importe fijo</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="porcentaje" id="b2" /><Label htmlFor="b2">Porcentaje</Label></div>
                    </RadioGroup>
                    <div>
                      <Label>{tipoBonif === "importe" ? "Importe a acreditar ($)" : "Porcentaje (%)"}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={valorBonif || ""}
                        onChange={(e) => setValorBonif(Number(e.target.value) || 0)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Saldo disponible: ${Number(saldo.monto_disponible).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3 text-right">
                  <p className="text-xs text-muted-foreground">Neto ${netoNc.toLocaleString("es-AR", { minimumFractionDigits: 2 })} + IVA ${ivaNc.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xl font-bold text-primary">Total NC: ${totalNc.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            )}

            {step === 4 && saldo && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Factura origen: </span><b>{String(factura.punto_venta).padStart(4, "0")}-{String(factura.numero_comprobante).padStart(8, "0")}</b></div>
                  <div><span className="text-muted-foreground">Cliente: </span><b>{venta?.cliente?.nombre || "Consumidor Final"}</b></div>
                  <div><span className="text-muted-foreground">Motivo: </span><b>{motivoLabel}</b></div>
                  <div><span className="text-muted-foreground">Alcance: </span><b>{alcance === "total" ? "Total de la factura" : (modo === "items" ? "Parcial por ítems" : "Parcial por importe")}</b></div>
                  {alcance === "total" && factura.venta_id && (
                    <div><span className="text-muted-foreground">Anular venta: </span><b className={anularVenta === "si" ? "text-destructive" : ""}>{anularVenta === "si" ? "Sí" : "No"}</b></div>
                  )}
                </div>
                {observaciones && (
                  <div><span className="text-muted-foreground">Observaciones: </span>{observaciones}</div>
                )}
                {modo === "items" && (
                  <div className="border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsSeleccionados.map((it) => (
                          <TableRow key={it.venta_detalle_id}>
                            <TableCell>{it.descripcion}</TableCell>
                            <TableCell className="text-right">{it.cantidad}</TableCell>
                            <TableCell className="text-right">${it.importe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-3 py-2 text-xs">
                      Reingreso al stock: <b>{reingresarStock === "si" ? "Sí" : "No"}</b>
                    </div>
                  </div>
                )}
                <div className="border-t pt-3 text-right space-y-1">
                  <p>Neto: <b>${netoNc.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></p>
                  <p>IVA 21%: <b>${ivaNc.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></p>
                  <p className="text-xl font-bold text-primary">TOTAL NC: ${totalNc.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={emitiendo}>Atrás</Button>
          )}
          {step === 1 && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!puedeAvanzar()}>Continuar</Button>
            </>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!puedeAvanzar()}>Continuar</Button>
          )}
          {step === 3 && (
            <Button onClick={() => setStep(4)} disabled={!puedeAvanzar()}>Revisar</Button>
          )}
          {step === 4 && (
            <>
              <Button variant="outline" onClick={() => setStep(3)} disabled={emitiendo}>Atrás</Button>
              <Button onClick={handleEmitir} disabled={emitiendo}>
                {emitiendo ? "Emitiendo..." : "Emitir Nota de Crédito"}
              </Button>
            </>
          )}
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}