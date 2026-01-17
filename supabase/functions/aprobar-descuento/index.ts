import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[aprobar-descuento] Request received:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[aprobar-descuento] Missing env vars');
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incorrecta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const authHeader = req.headers.get('Authorization');
    console.log('[aprobar-descuento] Auth header present:', !!authHeader);
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for all operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract and verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    console.log('[aprobar-descuento] User lookup result:', user?.id, userError?.message);
    
    if (userError || !user) {
      console.error('[aprobar-descuento] User auth failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    console.log('[aprobar-descuento] Role check:', userRole, roleError?.message);

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'No tiene permisos de administrador' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { solicitud_id, aprobar } = body;
    
    console.log('[aprobar-descuento] Request body:', { solicitud_id, aprobar });

    if (!solicitud_id) {
      return new Response(
        JSON.stringify({ error: 'solicitud_id requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the request
    const { data: solicitud, error: fetchError } = await supabaseAdmin
      .from('solicitudes_descuento')
      .select('*')
      .eq('id', solicitud_id)
      .maybeSingle();

    console.log('[aprobar-descuento] Solicitud fetch:', solicitud?.id, fetchError?.message);

    if (fetchError || !solicitud) {
      return new Response(
        JSON.stringify({ error: 'Solicitud no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (solicitud.estado !== 'pendiente') {
      return new Response(
        JSON.stringify({ error: 'Solicitud ya fue procesada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    const now = new Date();
    const expiraEn = new Date(solicitud.expira_en);
    if (now > expiraEn) {
      await supabaseAdmin
        .from('solicitudes_descuento')
        .update({ estado: 'expirada' })
        .eq('id', solicitud_id);

      return new Response(
        JSON.stringify({ error: 'Solicitud expirada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the request
    const nuevoEstado = aprobar ? 'aprobada' : 'rechazada';
    const { error: updateError } = await supabaseAdmin
      .from('solicitudes_descuento')
      .update({ 
        estado: nuevoEstado,
        aprobado_por: user.id
      })
      .eq('id', solicitud_id);

    if (updateError) {
      console.error('[aprobar-descuento] Error updating:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar solicitud' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[aprobar-descuento] Solicitud ${solicitud_id} ${nuevoEstado} por admin ${user.id}`);

    // If approved, return the token
    const response: Record<string, unknown> = {
      success: true,
      estado: nuevoEstado,
      mensaje: aprobar ? 'Solicitud aprobada' : 'Solicitud rechazada'
    };

    if (aprobar) {
      response.token = solicitud.token;
      response.expira_en = solicitud.expira_en;
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[aprobar-descuento] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});