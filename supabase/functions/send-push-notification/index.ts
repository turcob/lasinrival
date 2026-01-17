import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert base64url to Uint8Array
function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binaryString = atob(base64 + padding);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to convert Uint8Array to base64url
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert Uint8Array to a fresh ArrayBuffer (avoiding SharedArrayBuffer issues)
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(arr.length);
  const view = new Uint8Array(ab);
  view.set(arr);
  return ab;
}

// Create ECDH shared secret for Web Push encryption
async function createECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

// Export public key as raw bytes (uncompressed)
async function exportPublicKeyRaw(publicKey: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', publicKey);
  return new Uint8Array(exported);
}

// Generate random bytes
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

// HMAC-based Key Derivation Function
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  // Step 1: Extract
  const saltBuffer = salt.length > 0 ? toArrayBuffer(salt) : new ArrayBuffer(32);
  const saltKey = await crypto.subtle.importKey(
    'raw',
    saltBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const ikmBuffer = toArrayBuffer(ikm);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikmBuffer));

  // Step 2: Expand
  const prkBuffer = toArrayBuffer(prk);
  const prkKey = await crypto.subtle.importKey(
    'raw',
    prkBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const outputs: Uint8Array[] = [];
  let previousBlock = new Uint8Array(0);
  let counter = 1;
  let outputLength = 0;

  while (outputLength < length) {
    const input = new Uint8Array(previousBlock.length + info.length + 1);
    input.set(previousBlock);
    input.set(info, previousBlock.length);
    input[previousBlock.length + info.length] = counter;

    const inputBuffer = toArrayBuffer(input);
    previousBlock = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, inputBuffer));
    outputs.push(previousBlock);
    outputLength += previousBlock.length;
    counter++;
  }

  const result = new Uint8Array(length);
  let offset = 0;
  for (const output of outputs) {
    const toCopy = Math.min(output.length, length - offset);
    result.set(output.slice(0, toCopy), offset);
    offset += toCopy;
  }

  return result;
}

// AES-GCM encryption
async function encryptAesGcm(
  key: Uint8Array,
  nonce: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const keyBuffer = toArrayBuffer(key);
  const aesKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const nonceBuffer = toArrayBuffer(nonce);
  const dataBuffer = toArrayBuffer(data);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBuffer },
    aesKey,
    dataBuffer
  );

  return new Uint8Array(encrypted);
}

// Create info string for key derivation
function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const info = new Uint8Array(typeBytes.length + 1 + 5 + 1 + 2 + clientPublicKey.length + 2 + serverPublicKey.length);
  
  let offset = 0;
  info.set(typeBytes, offset);
  offset += typeBytes.length;
  info[offset++] = 0; // null terminator
  
  info.set(new TextEncoder().encode('P-256'), offset);
  offset += 5;
  info[offset++] = 0; // null terminator
  
  // Client public key length (big endian)
  info[offset++] = 0;
  info[offset++] = clientPublicKey.length;
  info.set(clientPublicKey, offset);
  offset += clientPublicKey.length;
  
  // Server public key length (big endian)
  info[offset++] = 0;
  info[offset++] = serverPublicKey.length;
  info.set(serverPublicKey, offset);
  
  return info;
}

// Encrypt the push payload using Web Push encryption (aes128gcm)
async function encryptPayload(
  payload: string,
  clientPublicKeyBase64: string,
  authSecretBase64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlToUint8Array(clientPublicKeyBase64);
  const authSecret = base64UrlToUint8Array(authSecretBase64);
  
  // Generate server ECDH key pair
  const serverKeyPair = await createECDHKeyPair();
  const serverPublicKey = await exportPublicKeyRaw(serverKeyPair.publicKey);
  
  // Import client's public key
  const clientKeyBuffer = toArrayBuffer(clientPublicKeyBytes);
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientKeyBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
  
  // Derive shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);
  
  // Generate salt
  const salt = randomBytes(16);
  
  // Derive IKM using HKDF with auth secret
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const ikm = await hkdf(sharedSecret, authSecret, authInfo, 32);
  
  // Create key info and nonce info
  const keyInfo = createInfo('Content-Encoding: aes128gcm', clientPublicKeyBytes, serverPublicKey);
  const nonceInfo = createInfo('Content-Encoding: nonce', clientPublicKeyBytes, serverPublicKey);
  
  // Derive content encryption key and nonce
  const prk = await hkdf(ikm, salt, new Uint8Array(0), 32);
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const nonceInfoBytes = new TextEncoder().encode('Content-Encoding: nonce\0');
  
  const cek = await hkdf(prk, new Uint8Array(0), cekInfo, 16);
  const nonce = await hkdf(prk, new Uint8Array(0), nonceInfoBytes, 12);
  
  // Pad the payload (add 0x02 delimiter for single record)
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 0x02; // Delimiter
  
  // Encrypt
  const ciphertext = await encryptAesGcm(cek, nonce, paddedPayload);
  
  return { ciphertext, salt, serverPublicKey };
}

// Create the aes128gcm content encoding header
function createAes128GcmHeader(salt: Uint8Array, serverPublicKey: Uint8Array, recordSize: number): Uint8Array {
  // Format: salt (16 bytes) + rs (4 bytes big endian) + idlen (1 byte) + keyid (idlen bytes)
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length);
  header.set(salt, 0);
  
  // Record size as big endian 4 bytes
  const rsBytes = new Uint8Array(4);
  rsBytes[0] = (recordSize >> 24) & 0xff;
  rsBytes[1] = (recordSize >> 16) & 0xff;
  rsBytes[2] = (recordSize >> 8) & 0xff;
  rsBytes[3] = recordSize & 0xff;
  header.set(rsBytes, 16);
  
  // Key ID length and key ID (server public key)
  header[20] = serverPublicKey.length;
  header.set(serverPublicKey, 21);
  
  return header;
}

// Create VAPID authorization header
async function createVapidAuth(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiration = Math.floor(Date.now() / 1000) + (12 * 60 * 60); // 12 hours

  // Create JWT header and payload
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: expiration, sub: subject };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the VAPID private key
  const publicKeyBytes = base64UrlToUint8Array(vapidPublicKey);

  // Create JWK from private key - need to derive x and y from public key
  // The public key is 65 bytes: 0x04 + x (32 bytes) + y (32 bytes)
  const x = uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33));
  const y = uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65));

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: vapidPrivateKey,
    x: x,
    y: y
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert signature from DER to raw r||s format if needed
  const signatureBytes = new Uint8Array(signature);
  const signatureB64 = uint8ArrayToBase64Url(signatureBytes);

  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    cryptoKey: `p256ecdsa=${vapidPublicKey}`
  };
}

// Send a push notification to a subscription
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  try {
    const payloadString = JSON.stringify(payload);
    
    // Encrypt the payload
    const { ciphertext, salt, serverPublicKey } = await encryptPayload(
      payloadString,
      subscription.p256dh,
      subscription.auth
    );
    
    // Create the aes128gcm body
    const recordSize = 4096;
    const header = createAes128GcmHeader(salt, serverPublicKey, recordSize);
    const body = new Uint8Array(header.length + ciphertext.length);
    body.set(header, 0);
    body.set(ciphertext, header.length);
    
    // Create VAPID authorization
    const vapidAuth = await createVapidAuth(
      subscription.endpoint,
      vapidPublicKey,
      vapidPrivateKey,
      subject
    );
    
    // Send the request
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'high',
        'Authorization': vapidAuth.authorization,
      },
      body: body
    });
    
    if (response.ok || response.status === 201) {
      return { success: true, statusCode: response.status };
    } else {
      const errorText = await response.text();
      console.error(`Push failed with status ${response.status}: ${errorText}`);
      return { success: false, error: errorText, statusCode: response.status };
    }
  } catch (error) {
    console.error('Error sending push:', error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { title, body, data, target_role } = await req.json();

    console.log(`Sending push notification: "${title}" to role: ${target_role || 'admin'}`);

    // Get all admin users
    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', target_role || 'admin');

    if (rolesError) {
      console.error('Error fetching admin roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Error fetching admins' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminIds = adminRoles?.map(r => r.user_id) || [];
    console.log(`Found ${adminIds.length} admins`);

    if (adminIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No admins found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push subscriptions for admins
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', adminIds);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Error fetching subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions?.length || 0} push subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // iOS Safari requires a MINIMAL payload - only title and body
    // Complex payloads can cause the push to be silently dropped
    const notificationPayload = {
      title: title || 'Nueva Solicitud de Descuento',
      body: body || 'Tienes una nueva solicitud pendiente'
    };
    
    console.log('Sending minimal iOS-compatible payload:', JSON.stringify(notificationPayload));

    let sent = 0;
    const failed: string[] = [];
    const errors: string[] = [];

    for (const sub of subscriptions) {
      console.log(`Attempting push to ${sub.endpoint}`);
      
      const result = await sendPushNotification(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth
        },
        notificationPayload,
        vapidPublicKey,
        vapidPrivateKey,
        'mailto:admin@lasinrival.com'
      );

      if (result.success) {
        console.log(`Push successful to ${sub.endpoint}, status: ${result.statusCode}`);
        sent++;
      } else {
        console.error(`Push failed to ${sub.endpoint}: ${result.error}`);
        failed.push(sub.id);
        errors.push(result.error || 'Unknown error');
        
        // If subscription is gone (410) or not found (404), we should delete it
        if (result.statusCode === 410 || result.statusCode === 404) {
          console.log(`Removing invalid subscription ${sub.id}`);
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    console.log(`Processed ${subscriptions.length} subscriptions: ${sent} sent, ${failed.length} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent, 
        failed: failed.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Sent ${sent} notifications`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
