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

    // Find the request by token (case insensitive)
    let query = supabaseAdmin
      .from('solicitudes_descuento')
      .select('*')
      .ilike('token', token.toUpperCase())
      .eq('vendedor_id', user.id);
    
    if (solicitud_id) {
      query = query.eq('id', solicitud_id);
    }

    const { data: solicitud, error: fetchError } = await query.single();

    if (fetchError || !solicitud) {
      console.log('Token no encontrado:', token);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Token inválido o no encontrado' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token was already used
    if (solicitud.token_usado) {
      console.log('Token ya usado:', token);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Este token ya fue utilizado' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token expired
    const now = new Date();
    const expiraEn = new Date(solicitud.expira_en);
    if (now > expiraEn) {
      console.log('Token expirado:', token, 'Expiró:', expiraEn);
      
      // Mark as expired
      await supabaseAdmin
        .from('solicitudes_descuento')
        .update({ estado: 'expirada' })
        .eq('id', solicitud.id);

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Token expirado. Solicite uno nuevo.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if request was approved
    if (solicitud.estado !== 'aprobada') {
      if (solicitud.estado === 'pendiente') {
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: 'Solicitud aún pendiente de aprobación' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (solicitud.estado === 'rechazada') {
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: 'Solicitud rechazada por el administrador' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Mark token as used
    const { error: updateError } = await supabaseAdmin
      .from('solicitudes_descuento')
      .update({ 
        token_usado: true,
        estado: 'usada'
      })
      .eq('id', solicitud.id);

    if (updateError) {
      console.error('Error marking token as used:', updateError);
    }

    console.log('Token válido y usado:', token, 'Solicitud:', solicitud.id);

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
    console.error('Error en validar-token-descuento:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});