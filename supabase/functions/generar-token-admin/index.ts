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
  console.log('[generar-token-admin] Request received:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[generar-token-admin] Missing env vars');
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incorrecta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract and verify the JWT token
    const jwtToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwtToken);
    
    if (userError || !user) {
      console.error('[generar-token-admin] User auth failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'No tiene permisos de administrador' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a unique token (try up to 5 times)
    let token = '';
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      token = generateToken();
      
      // Check if token already exists and is not used
      const { data: existingToken } = await supabaseAdmin
        .from('admin_tokens')
        .select('id')
        .eq('token', token)
        .eq('usado', false)
        .maybeSingle();
      
      if (!existingToken) {
        break; // Token is unique
      }
      
      attempts++;
      console.log(`[generar-token-admin] Token collision, attempt ${attempts}`);
    }

    if (attempts >= maxAttempts) {
      return new Response(
        JSON.stringify({ error: 'Error generando token único' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set expiration to 1 minute from now
    const expiraEn = new Date(Date.now() + 60 * 1000).toISOString();

    // Mark any existing token for this admin as used
    await supabaseAdmin
      .from('admin_tokens')
      .update({ usado: true })
      .eq('admin_id', user.id)
      .eq('usado', false);

    // Insert new token
    const { data: newToken, error: insertError } = await supabaseAdmin
      .from('admin_tokens')
      .insert({
        admin_id: user.id,
        token: token,
        expira_en: expiraEn,
        usado: false
      })
      .select()
      .single();

    if (insertError) {
      // If unique constraint error, try upsert
      if (insertError.code === '23505') {
        const { data: upsertedToken, error: upsertError } = await supabaseAdmin
          .from('admin_tokens')
          .upsert({
            admin_id: user.id,
            token: token,
            expira_en: expiraEn,
            usado: false,
            created_at: new Date().toISOString()
          }, { onConflict: 'admin_id' })
          .select()
          .single();

        if (upsertError) {
          console.error('[generar-token-admin] Upsert error:', upsertError);
          return new Response(
            JSON.stringify({ error: 'Error guardando token' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[generar-token-admin] Token generado (upsert): ${token} para admin ${user.id}`);
        return new Response(
          JSON.stringify({ 
            success: true,
            token: upsertedToken.token,
            expira_en: upsertedToken.expira_en
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error('[generar-token-admin] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error guardando token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generar-token-admin] Token generado: ${token} para admin ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        token: newToken.token,
        expira_en: newToken.expira_en
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generar-token-admin] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
