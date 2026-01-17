import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[validar-token-descuento] Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to get their ID
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token, solicitud_id } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for validation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // NEW FLOW: Find admin token that matches (case insensitive)
    const { data: adminToken, error: adminTokenError } = await supabaseAdmin
      .from('admin_tokens')
      .select('*')
      .ilike('token', token.toUpperCase())
      .eq('usado', false)
      .maybeSingle();

    if (adminTokenError) {
      console.error('[validar-token-descuento] Error buscando admin token:', adminTokenError);
    }

    if (!adminToken) {
      console.log('[validar-token-descuento] Token no encontrado o ya usado:', token);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Token inválido o ya utilizado' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if admin token expired
    const now = new Date();
    const expiraEn = new Date(adminToken.expira_en);
    if (now > expiraEn) {
      console.log('[validar-token-descuento] Token expirado:', token, 'Expiró:', expiraEn);
      
      // Mark as used
      await supabaseAdmin
        .from('admin_tokens')
        .update({ usado: true })
        .eq('id', adminToken.id);

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Token expirado. Pida un nuevo token al administrador.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the pending request for this seller
    let query = supabaseAdmin
      .from('solicitudes_descuento')
      .select('*')
      .eq('vendedor_id', user.id)
      .eq('estado', 'pendiente');
    
    if (solicitud_id) {
      query = query.eq('id', solicitud_id);
    }

    const { data: solicitud, error: fetchError } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (fetchError || !solicitud) {
      console.log('[validar-token-descuento] No hay solicitud pendiente para el vendedor:', user.id);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'No hay solicitud de descuento pendiente' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the seller's request expired
    const solicitudExpira = new Date(solicitud.expira_en);
    if (now > solicitudExpira) {
      console.log('[validar-token-descuento] Solicitud expirada:', solicitud.id);
      
      await supabaseAdmin
        .from('solicitudes_descuento')
        .update({ estado: 'expirada' })
        .eq('id', solicitud.id);

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Su solicitud de descuento ha expirado. Solicite uno nuevo.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark admin token as used
    const { error: updateTokenError } = await supabaseAdmin
      .from('admin_tokens')
      .update({ usado: true })
      .eq('id', adminToken.id);

    if (updateTokenError) {
      console.error('[validar-token-descuento] Error marking admin token as used:', updateTokenError);
    }

    // Mark solicitud as approved and used
    const { error: updateSolicitudError } = await supabaseAdmin
      .from('solicitudes_descuento')
      .update({ 
        token_usado: true,
        estado: 'usada',
        aprobado_por: adminToken.admin_id
      })
      .eq('id', solicitud.id);

    if (updateSolicitudError) {
      console.error('[validar-token-descuento] Error updating solicitud:', updateSolicitudError);
    }

    console.log('[validar-token-descuento] Token válido y usado:', token, 'Solicitud:', solicitud.id, 'Admin:', adminToken.admin_id);

    return new Response(
      JSON.stringify({ 
        valid: true,
        solicitud_id: solicitud.id,
        porcentaje_autorizado: solicitud.porcentaje_solicitado,
        mensaje: 'Descuento autorizado'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validar-token-descuento] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
