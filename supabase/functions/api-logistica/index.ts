// API REST para el módulo de Logística
// Auth: JWT del usuario (header Authorization: Bearer <access_token>)
// Las RLS se encargan de filtrar "solo las hojas/paradas del chofer o responsable".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ESTADOS_HOJA = [
  "planificada",
  "en_carga",
  "carga_confirmada",
  "en_ruta",
  "completada",
  "cancelada",
];
const ESTADOS_PARADA = [
  "pendiente",
  "entregado",
  "entrega_parcial",
  "rechazado",
  "no_entregado",
];
const ESTADOS_CARGA_ITEM = ["pendiente", "cargado", "faltante", "parcial"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Falta header Authorization Bearer <token>" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Token inválido o expirado" }, 401);
  }

  const url = new URL(req.url);
  // Path después de /functions/v1/api-logistica
  const fullPath = url.pathname.replace(/^.*\/api-logistica/, "") || "/";
  const parts = fullPath.split("/").filter(Boolean);
  const method = req.method.toUpperCase();

  try {
    // GET / -> info
    if (parts.length === 0 && method === "GET") {
      return json({
        name: "api-logistica",
        version: "1.0.0",
        endpoints: [
          "GET    /hojas-ruta",
          "GET    /hojas-ruta/:id",
          "PATCH  /hojas-ruta/:id        { estado }",
          "PATCH  /paradas/:id           { estado, observaciones? }",
          "POST   /cobros                { parada_id, pedido_id, forma_pago_id, monto, referencia?, observaciones? }",
          "POST   /devoluciones          { parada_id, pedido_detalle_id, cantidad, motivo, detalle_motivo? }",
          "GET    /hojas-ruta/:id/rendicion",
          "POST   /rendiciones           { hoja_ruta_id, total_efectivo, total_transferencias, total_qr, total_tarjeta, total_general, diferencia?, observaciones?, caja_id? }",
          "PATCH  /rendiciones/:id       { ...mismos campos (solo si estado='pendiente') }",
          "GET    /hojas-ruta/:id/carga-items",
          "PATCH  /carga-items/:id       { cantidad_cargada?, estado?, observaciones? }",
          "POST   /hojas-ruta/:id/confirmar-carga  { forzar?: boolean, observaciones? }",
        ],
      });
    }

    // ===== /hojas-ruta =====
    if (parts[0] === "hojas-ruta") {
      // GET /hojas-ruta?estado=&fecha_desde=&fecha_hasta=&limit=
      if (parts.length === 1 && method === "GET") {
        const estado = url.searchParams.get("estado");
        const fechaDesde = url.searchParams.get("fecha_desde");
        const fechaHasta = url.searchParams.get("fecha_hasta");
        const limit = Math.min(
          Number(url.searchParams.get("limit") ?? 50),
          200,
        );

        let q = supabase
          .from("hojas_ruta")
          .select(
            "id, numero_hoja, fecha, estado, hora_salida_estimada, hora_salida_real, hora_regreso, km_inicial, km_final, monto_esperado, observaciones, vehiculo_id, chofer_id, responsable_id, created_at",
          )
          .order("fecha", { ascending: false })
          .order("numero_hoja", { ascending: false })
          .limit(limit);

        if (estado) q = q.eq("estado", estado);
        if (fechaDesde) q = q.gte("fecha", fechaDesde);
        if (fechaHasta) q = q.lte("fecha", fechaHasta);

        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ items: data ?? [] });
      }

      // GET /hojas-ruta/:id -> detalle completo
      if (parts.length === 2 && method === "GET") {
        const id = parts[1];

        const { data: hoja, error: e1 } = await supabase
          .from("hojas_ruta")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (e1) return json({ error: e1.message }, 400);
        if (!hoja) return json({ error: "Hoja de ruta no encontrada" }, 404);

        const { data: paradas, error: e2 } = await supabase
          .from("hoja_ruta_paradas")
          .select(
            "id, pedido_id, orden, estado, hora_llegada, hora_salida, ventana_horaria_desde, ventana_horaria_hasta, observaciones",
          )
          .eq("hoja_ruta_id", id)
          .order("orden", { ascending: true });
        if (e2) return json({ error: e2.message }, 400);

        const { data: cobros, error: e3 } = await supabase
          .from("hoja_ruta_cobros")
          .select(
            "id, parada_id, pedido_id, forma_pago_id, monto, referencia, observaciones, created_at",
          )
          .eq("hoja_ruta_id", id);
        if (e3) return json({ error: e3.message }, 400);

        const { data: devoluciones, error: e4 } = await supabase
          .from("hoja_ruta_devoluciones")
          .select(
            "id, parada_id, pedido_detalle_id, cantidad, motivo, detalle_motivo, reingresado_stock, created_at",
          )
          .eq("hoja_ruta_id", id);
        if (e4) return json({ error: e4.message }, 400);

        return json({
          hoja_ruta: hoja,
          paradas: paradas ?? [],
          cobros: cobros ?? [],
          devoluciones: devoluciones ?? [],
        });
      }

      // GET /hojas-ruta/:id/rendicion
      if (parts.length === 3 && parts[2] === "rendicion" && method === "GET") {
        const id = parts[1];
        const { data, error } = await supabase
          .from("hoja_ruta_rendiciones")
          .select("*")
          .eq("hoja_ruta_id", id)
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);
        return json({ rendicion: data });
      }

      // GET /hojas-ruta/:id/carga-items
      if (parts.length === 3 && parts[2] === "carga-items" && method === "GET") {
        const id = parts[1];
        const { data, error } = await supabase
          .from("hoja_ruta_carga_items")
          .select(
            "id, hoja_ruta_id, pedido_id, producto_id, cantidad_esperada, cantidad_cargada, estado, observaciones, verificado_por, verificado_at",
          )
          .eq("hoja_ruta_id", id)
          .order("pedido_id");
        if (error) return json({ error: error.message }, 400);
        return json({ items: data ?? [] });
      }

      // POST /hojas-ruta/:id/confirmar-carga
      // Cierra la carga manualmente y pasa la hoja a 'carga_confirmada'.
      // Si todos los items ya están no-pendientes, el trigger del backend
      // ya lo hace automáticamente, pero este endpoint permite forzar el cierre.
      if (
        parts.length === 3 &&
        parts[2] === "confirmar-carga" &&
        method === "POST"
      ) {
        const id = parts[1];
        const body = await req.json().catch(() => ({}));
        const forzar = Boolean(body?.forzar ?? false);

        // Verificar estado actual
        const { data: hoja, error: eh } = await supabase
          .from("hojas_ruta")
          .select("id, estado")
          .eq("id", id)
          .maybeSingle();
        if (eh) return json({ error: eh.message }, 400);
        if (!hoja) return json({ error: "Hoja no encontrada o sin permisos" }, 404);
        if (hoja.estado !== "en_carga") {
          return json(
            { error: `La hoja no está 'en_carga' (estado actual: ${hoja.estado})` },
            400,
          );
        }

        // Chequear items pendientes
        const { data: items, error: ei } = await supabase
          .from("hoja_ruta_carga_items")
          .select("id, estado")
          .eq("hoja_ruta_id", id);
        if (ei) return json({ error: ei.message }, 400);

        const pendientes = (items ?? []).filter((i) => i.estado === "pendiente");
        if (pendientes.length > 0 && !forzar) {
          return json(
            {
              error:
                "Hay items pendientes de verificar. Marcalos como cargado/faltante/parcial, o enviá { forzar: true }.",
              items_pendientes: pendientes.length,
            },
            400,
          );
        }

        const patch: Record<string, unknown> = {
          estado: "carga_confirmada",
          carga_confirmada_at: new Date().toISOString(),
          carga_confirmada_por: userData.user.id,
          carga_forzada: forzar && pendientes.length > 0,
        };
        if (typeof body?.observaciones === "string") {
          patch.observaciones = body.observaciones;
        }

        const { data, error } = await supabase
          .from("hojas_ruta")
          .update(patch)
          .eq("id", id)
          .eq("estado", "en_carga")
          .select()
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);
        if (!data) return json({ error: "No se pudo confirmar la carga" }, 400);
        return json({ hoja_ruta: data });
      }

      // PATCH /hojas-ruta/:id  { estado }
      if (parts.length === 2 && method === "PATCH") {
        const id = parts[1];
        const body = await req.json().catch(() => ({}));
        const estado = String(body?.estado ?? "");
        if (!ESTADOS_HOJA.includes(estado)) {
          return json(
            { error: `Estado inválido. Permitidos: ${ESTADOS_HOJA.join(", ")}` },
            400,
          );
        }
        const patch: Record<string, unknown> = { estado };
        if (estado === "en_ruta") patch.hora_salida_real = new Date().toISOString();
        if (estado === "completada") patch.hora_regreso = new Date().toISOString();

        const { data, error } = await supabase
          .from("hojas_ruta")
          .update(patch)
          .eq("id", id)
          .select()
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);
        if (!data) return json({ error: "No encontrada o sin permisos" }, 404);
        return json({ hoja_ruta: data });
      }
    }

    // ===== /paradas/:id  PATCH =====
    if (parts[0] === "paradas" && parts.length === 2 && method === "PATCH") {
      const id = parts[1];
      const body = await req.json().catch(() => ({}));
      const estado = String(body?.estado ?? "");
      if (!ESTADOS_PARADA.includes(estado)) {
        return json(
          { error: `Estado inválido. Permitidos: ${ESTADOS_PARADA.join(", ")}` },
          400,
        );
      }
      const patch: Record<string, unknown> = { estado };
      if (estado !== "pendiente" && !body?.skipHora) {
        patch.hora_salida = new Date().toISOString();
      }
      if (typeof body?.observaciones === "string") {
        patch.observaciones = body.observaciones;
      }
      const { data, error } = await supabase
        .from("hoja_ruta_paradas")
        .update(patch)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "No encontrada o sin permisos" }, 404);
      return json({ parada: data });
    }

    // ===== /cobros  POST =====
    if (parts[0] === "cobros" && parts.length === 1 && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const requeridos = ["parada_id", "pedido_id", "forma_pago_id", "monto"];
      for (const k of requeridos) {
        if (!body?.[k]) return json({ error: `Falta campo: ${k}` }, 400);
      }
      const monto = Number(body.monto);
      if (!Number.isFinite(monto) || monto <= 0) {
        return json({ error: "Monto inválido" }, 400);
      }

      // Obtener hoja_ruta_id desde la parada (respeta RLS)
      const { data: parada, error: ep } = await supabase
        .from("hoja_ruta_paradas")
        .select("hoja_ruta_id")
        .eq("id", body.parada_id)
        .maybeSingle();
      if (ep) return json({ error: ep.message }, 400);
      if (!parada) return json({ error: "Parada no encontrada o sin permisos" }, 404);

      const { data, error } = await supabase
        .from("hoja_ruta_cobros")
        .insert({
          hoja_ruta_id: parada.hoja_ruta_id,
          parada_id: body.parada_id,
          pedido_id: body.pedido_id,
          forma_pago_id: body.forma_pago_id,
          monto,
          referencia: body.referencia ?? null,
          observaciones: body.observaciones ?? null,
          usuario_id: userData.user.id,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ cobro: data }, 201);
    }

    // ===== /devoluciones  POST =====
    if (parts[0] === "devoluciones" && parts.length === 1 && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const requeridos = ["parada_id", "pedido_detalle_id", "cantidad", "motivo"];
      for (const k of requeridos) {
        if (body?.[k] === undefined || body?.[k] === null || body?.[k] === "") {
          return json({ error: `Falta campo: ${k}` }, 400);
        }
      }
      const cantidad = Number(body.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        return json({ error: "Cantidad inválida" }, 400);
      }

      const { data: parada, error: ep } = await supabase
        .from("hoja_ruta_paradas")
        .select("hoja_ruta_id")
        .eq("id", body.parada_id)
        .maybeSingle();
      if (ep) return json({ error: ep.message }, 400);
      if (!parada) return json({ error: "Parada no encontrada o sin permisos" }, 404);

      const { data, error } = await supabase
        .from("hoja_ruta_devoluciones")
        .insert({
          hoja_ruta_id: parada.hoja_ruta_id,
          parada_id: body.parada_id,
          pedido_detalle_id: body.pedido_detalle_id,
          cantidad,
          motivo: String(body.motivo),
          detalle_motivo: body.detalle_motivo ?? null,
          reingresado_stock: Boolean(body.reingresado_stock ?? false),
          usuario_id: userData.user.id,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ devolucion: data }, 201);
    }

    // ===== /carga-items/:id  PATCH =====
    // Marca un item de carga como cargado/faltante/parcial.
    // Cuando todos los items quedan en estado != 'pendiente', el trigger
    // `auto_confirmar_carga_hoja_ruta` cambia la hoja a 'carga_confirmada' solo.
    if (parts[0] === "carga-items" && parts.length === 2 && method === "PATCH") {
      const id = parts[1];
      const body = await req.json().catch(() => ({}));
      const patch: Record<string, unknown> = {
        verificado_por: userData.user.id,
        verificado_at: new Date().toISOString(),
      };
      if (body?.estado !== undefined) {
        const est = String(body.estado);
        if (!ESTADOS_CARGA_ITEM.includes(est)) {
          return json(
            {
              error: `Estado inválido. Permitidos: ${ESTADOS_CARGA_ITEM.join(", ")}`,
            },
            400,
          );
        }
        patch.estado = est;
      }
      if (body?.cantidad_cargada !== undefined && body?.cantidad_cargada !== null) {
        const n = Number(body.cantidad_cargada);
        if (!Number.isFinite(n) || n < 0) {
          return json({ error: "cantidad_cargada inválida" }, 400);
        }
        patch.cantidad_cargada = n;
      }
      if (typeof body?.observaciones === "string") {
        patch.observaciones = body.observaciones;
      }

      const { data, error } = await supabase
        .from("hoja_ruta_carga_items")
        .update(patch)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) {
        return json(
          {
            error:
              "Item no encontrado o sin permisos (la hoja debe estar 'en_carga' y vos ser responsable)",
          },
          404,
        );
      }
      return json({ item: data });
    }

    // ===== /rendiciones =====
    if (parts[0] === "rendiciones") {
      // POST /rendiciones
      if (parts.length === 1 && method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (!body?.hoja_ruta_id) return json({ error: "Falta hoja_ruta_id" }, 400);

        const totEf = Number(body.total_efectivo ?? 0);
        const totTr = Number(body.total_transferencias ?? 0);
        const totQr = Number(body.total_qr ?? 0);
        const totTa = Number(body.total_tarjeta ?? 0);
        const totGen = Number(body.total_general ?? (totEf + totTr + totQr + totTa));
        const dif = Number(body.diferencia ?? 0);

        const { data, error } = await supabase
          .from("hoja_ruta_rendiciones")
          .insert({
            hoja_ruta_id: body.hoja_ruta_id,
            usuario_id: userData.user.id,
            total_efectivo: totEf,
            total_transferencias: totTr,
            total_qr: totQr,
            total_tarjeta: totTa,
            total_general: totGen,
            diferencia: dif,
            caja_id: body.caja_id ?? null,
            observaciones: body.observaciones ?? null,
            estado: "pendiente",
          })
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ rendicion: data }, 201);
      }

      // PATCH /rendiciones/:id (solo si pendiente — lo valida la RLS)
      if (parts.length === 2 && method === "PATCH") {
        const id = parts[1];
        const body = await req.json().catch(() => ({}));
        const patch: Record<string, unknown> = {};
        const num = (k: string) => {
          if (body?.[k] !== undefined && body?.[k] !== null) {
            const n = Number(body[k]);
            if (Number.isFinite(n)) patch[k] = n;
          }
        };
        num("total_efectivo");
        num("total_transferencias");
        num("total_qr");
        num("total_tarjeta");
        num("total_general");
        num("diferencia");
        if (body?.caja_id !== undefined) patch.caja_id = body.caja_id;
        if (typeof body?.observaciones === "string") patch.observaciones = body.observaciones;

        if (Object.keys(patch).length === 0) {
          return json({ error: "Nada para actualizar" }, 400);
        }

        const { data, error } = await supabase
          .from("hoja_ruta_rendiciones")
          .update(patch)
          .eq("id", id)
          .select()
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);
        if (!data) {
          return json(
            { error: "Rendición no encontrada, sin permisos, o ya aprobada/rechazada" },
            404,
          );
        }
        return json({ rendicion: data });
      }
    }

    return json({ error: "Ruta no encontrada", path: fullPath, method }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});