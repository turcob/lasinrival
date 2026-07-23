import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Se requiere imageBase64 y mimeType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Sos un asistente especializado en analizar comprobantes de transferencias bancarias argentinas.
Extraé los siguientes campos del comprobante SOLO si están claramente visibles y legibles.

REGLA CRÍTICA: si un campo no aparece, es ambiguo, está tachado, borroso o tenés cualquier duda, devolvé null.
Nunca inventes, adivines ni completes datos faltantes. Es preferible null antes que un valor incorrecto.

Campos a extraer:
- numero_operacion: buscá "Nro. de Operación", "Número de transferencia", "Nro. Transacción", "ID de operación", "Comprobante Nro", "Código de transferencia", "Referencia".
- monto: importe transferido, como string sin símbolo de moneda ni separadores de miles (usar punto como decimal). Ej: "15000.50".
- fecha: fecha de la operación en formato ESTRICTO YYYY-MM-DD. Si en el comprobante figura DD/MM/YYYY, convertila. Si el año no es claro o falta, devolvé null.
- cuil_titular: CUIL/CUIT del titular ordenante o destinatario, EXACTAMENTE 11 dígitos, sin guiones ni espacios. Si ves menos o más de 11 dígitos, devolvé null.
- titular: nombre del titular ordenante o destinatario tal como figura, en mayúsculas.
- banco: nombre del banco emisor (ej: "Banco Galicia", "Santander", "BBVA", "Mercado Pago").

Además, para cada campo NUEVO (fecha, cuil_titular, titular, banco) indicá tu nivel de confianza como "alta", "media" o "baja". Si el valor es null, la confianza debe ser "baja".
También devolvé una confianza GLOBAL "alta"|"media"|"baja" sobre la extracción del numero_operacion (para compatibilidad).

Respondé SOLO con un JSON válido con este formato EXACTO, sin markdown ni texto extra:
{
  "numero_operacion": string|null,
  "monto": string|null,
  "fecha": string|null,
  "cuil_titular": string|null,
  "titular": string|null,
  "banco": string|null,
  "confianza": "alta"|"media"|"baja",
  "confianza_campos": {
    "fecha": "alta"|"media"|"baja",
    "cuil_titular": "alta"|"media"|"baja",
    "titular": "alta"|"media"|"baja",
    "banco": "alta"|"media"|"baja"
  }
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analizá este comprobante de transferencia y extraé los campos solicitados. Recordá: ante cualquier duda, devolvé null en lugar de arriesgar un valor."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes, intente nuevamente en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    const emptyConfCampos = {
      fecha: "baja" as const,
      cuil_titular: "baja" as const,
      titular: "baja" as const,
      banco: "baja" as const,
    };
    const emptyResult = {
      numero_operacion: null as string | null,
      monto: null as string | null,
      fecha: null as string | null,
      cuil_titular: null as string | null,
      titular: null as string | null,
      banco: null as string | null,
      confianza: "baja" as "alta" | "media" | "baja",
      confianza_campos: { ...emptyConfCampos },
    };

    // Parse the JSON response from the AI
    let parsed: any = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", content);
    }

    const resultado = { ...emptyResult };

    if (parsed && typeof parsed === "object") {
      const normalizeConf = (v: any): "alta" | "media" | "baja" =>
        v === "alta" || v === "media" || v === "baja" ? v : "baja";
      const strOrNull = (v: any): string | null => {
        if (typeof v !== "string") return null;
        const t = v.trim();
        return t.length > 0 ? t : null;
      };

      resultado.numero_operacion = strOrNull(parsed.numero_operacion);
      resultado.monto = strOrNull(parsed.monto);
      resultado.titular = strOrNull(parsed.titular);
      resultado.banco = strOrNull(parsed.banco);

      // fecha: strict YYYY-MM-DD
      const fechaRaw = strOrNull(parsed.fecha);
      if (fechaRaw && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) && !isNaN(Date.parse(fechaRaw))) {
        resultado.fecha = fechaRaw;
      }

      // cuil_titular: exactly 11 digits
      const cuilRaw = strOrNull(parsed.cuil_titular);
      if (cuilRaw) {
        const digits = cuilRaw.replace(/\D/g, "");
        if (digits.length === 11) resultado.cuil_titular = digits;
      }

      resultado.confianza = normalizeConf(parsed.confianza);

      const cc = parsed.confianza_campos && typeof parsed.confianza_campos === "object"
        ? parsed.confianza_campos
        : {};
      resultado.confianza_campos = {
        fecha: normalizeConf(cc.fecha),
        cuil_titular: normalizeConf(cc.cuil_titular),
        titular: normalizeConf(cc.titular),
        banco: normalizeConf(cc.banco),
      };

      // Coherence: null value => confianza "baja"
      if (!resultado.fecha) resultado.confianza_campos.fecha = "baja";
      if (!resultado.cuil_titular) resultado.confianza_campos.cuil_titular = "baja";
      if (!resultado.titular) resultado.confianza_campos.titular = "baja";
      if (!resultado.banco) resultado.confianza_campos.banco = "baja";
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
