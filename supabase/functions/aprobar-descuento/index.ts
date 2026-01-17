import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'No tiene permisos de administrador' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { solicitud_id, aprobar } = await req.json();

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
      .single();

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
      console.error('Error updating solicitud:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar solicitud' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Solicitud ${solicitud_id} ${nuevoEstado} por admin ${user.id}`);

    // If approved, return the token
    const response: any = {
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
    console.error('Error en aprobar-descuento:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});