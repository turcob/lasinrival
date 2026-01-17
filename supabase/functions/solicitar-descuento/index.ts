import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

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

    const { porcentaje_solicitado, monto_venta, caja_id, producto_id, descripcion_producto } = await req.json();

    if (!porcentaje_solicitado || porcentaje_solicitado <= 0) {
      return new Response(
        JSON.stringify({ error: 'Porcentaje de descuento inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to create the request
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique token
    const token = generateToken();
    
    // Set expiration to 5 minutes from now
    const expiraEn = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Get vendedor profile for notification
    const { data: vendedorProfile } = await supabaseAdmin
      .from('profiles')
      .select('nombre')
      .eq('id', user.id)
      .single();

    // Create the request
    const { data: solicitud, error: insertError } = await supabaseAdmin
      .from('solicitudes_descuento')
      .insert({
        vendedor_id: user.id,
        caja_id: caja_id || null,
        producto_id: producto_id || null,
        porcentaje_solicitado,
        monto_venta: monto_venta || 0,
        estado: 'pendiente',
        token,
        expira_en: expiraEn
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating solicitud:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error al crear solicitud', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Solicitud creada: ${solicitud.id} por vendedor ${vendedorProfile?.nombre || user.id}`);
    console.log(`Token generado: ${token}, expira: ${expiraEn}`);

    // Return success (token is NOT returned to vendedor - only admins can see it)
    return new Response(
      JSON.stringify({
        success: true,
        solicitud_id: solicitud.id,
        expira_en: expiraEn,
        mensaje: 'Solicitud enviada. Espere autorización del administrador.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en solicitar-descuento:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});