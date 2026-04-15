import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PALADINI_URL = "https://gckylwfsyjdpyfwaasfk.supabase.co/functions/v1/price-lists";

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

    const { lista_id, action, nombre, porcentaje_general } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      Authorization: `Bearer ${PRICE_LISTS_API_KEY}`,
      "Content-Type": "application/json",
    };

    if (action === "upsert") {
      if (!nombre) {
        return new Response(JSON.stringify({ error: "nombre is required for upsert" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if list already exists in Paladini by name
      const listRes = await fetch(PALADINI_URL, { headers });
      if (!listRes.ok) {
        const errBody = await listRes.text();
        throw new Error(`Failed to fetch Paladini lists [${listRes.status}]: ${errBody}`);
      }
      const allLists = await listRes.json();
      const existing = allLists.find((l: any) => l.name === nombre);

      if (existing) {
        // Update
        const updateRes = await fetch(`${PALADINI_URL}?id=${existing.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            name: nombre,
            surcharge_percentage: porcentaje_general ?? 0,
          }),
        });
        if (!updateRes.ok) {
          const errBody = await updateRes.text();
          throw new Error(`Failed to update Paladini list [${updateRes.status}]: ${errBody}`);
        }
        const updated = await updateRes.json();
        return new Response(JSON.stringify({ success: true, action: "updated", data: updated }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Create
        const createRes = await fetch(PALADINI_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: nombre,
            surcharge_percentage: porcentaje_general ?? 0,
          }),
        });
        if (!createRes.ok) {
          const errBody = await createRes.text();
          throw new Error(`Failed to create Paladini list [${createRes.status}]: ${errBody}`);
        }
        const created = await createRes.json();
        return new Response(JSON.stringify({ success: true, action: "created", data: created }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "delete") {
      if (!nombre) {
        return new Response(JSON.stringify({ error: "nombre is required for delete" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find by name
      const listRes = await fetch(PALADINI_URL, { headers });
      if (!listRes.ok) {
        const errBody = await listRes.text();
        throw new Error(`Failed to fetch Paladini lists [${listRes.status}]: ${errBody}`);
      }
      const allLists = await listRes.json();
      const existing = allLists.find((l: any) => l.name === nombre);

      if (!existing) {
        return new Response(JSON.stringify({ success: true, action: "not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const deleteRes = await fetch(`${PALADINI_URL}?id=${existing.id}`, {
        method: "DELETE",
        headers,
      });
      if (!deleteRes.ok) {
        const errBody = await deleteRes.text();
        throw new Error(`Failed to delete Paladini list [${deleteRes.status}]: ${errBody}`);
      }
      await deleteRes.text();
      return new Response(JSON.stringify({ success: true, action: "deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'upsert' or 'delete'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in sync-lista-precios-paladini:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
