import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PALADINI_URL = "https://gckylwfsyjdpyfwaasfk.supabase.co/functions/v1/manage-clients";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PRICE_LISTS_API_KEY = Deno.env.get("PRICE_LISTS_API_KEY");
    if (!PRICE_LISTS_API_KEY) {
      throw new Error("PRICE_LISTS_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { cliente_id } = await req.json();

    if (!cliente_id) {
      return new Response(JSON.stringify({ error: "cliente_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client data from local DB
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("*, listas_precios(nombre)")
      .eq("id", cliente_id)
      .single();

    if (clienteError || !cliente) {
      return new Response(JSON.stringify({ error: "Cliente no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cliente.codigo_cliente) {
      return new Response(JSON.stringify({ error: "El cliente debe tener un código de cliente asignado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      Authorization: `Bearer ${PRICE_LISTS_API_KEY}`,
      "Content-Type": "application/json",
    };

    // Check if client already exists in Paladini by client_code
    const checkRes = await fetch(`${PALADINI_URL}?client_code=${encodeURIComponent(cliente.codigo_cliente)}`, {
      headers,
    });

    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing && existing.client_code) {
        return new Response(JSON.stringify({ 
          error: "El cliente ya existe en Paladini Pedidos",
          existing: { client_code: existing.client_code, company: existing.company }
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // If 406/404 it means not found, which is what we want
      const errText = await checkRes.text();
      // Only throw if it's not a "not found" type error
      if (checkRes.status !== 406 && checkRes.status !== 404) {
        console.log(`Check response status: ${checkRes.status}, body: ${errText}`);
      }
    }

    // Build email from codigo_cliente
    const email = `${cliente.codigo_cliente.toLowerCase().replace(/\s+/g, "")}@sinrival.com`;

    // Create client in Paladini
    const createRes = await fetch(PALADINI_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        client_code: cliente.codigo_cliente,
        email: email,
        first_name: cliente.nombre,
        last_name: "",
        company: cliente.nombre,
        phone: cliente.telefono || "",
        price_list: cliente.listas_precios?.nombre || "",
        address: cliente.direccion || "",
        tax_condition: "",
        cuit: cliente.dni_cuit || "",
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw new Error(`Error al crear cliente en Paladini [${createRes.status}]: ${errBody}`);
    }

    const created = await createRes.json();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Cliente replicado exitosamente en Paladini Pedidos",
      data: created 
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in sync-cliente-paladini:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
