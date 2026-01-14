import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import forge from "https://esm.sh/node-forge@1.3.1?target=deno";

// Polyfill for node-forge's randomBytes in Deno
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AFIP Homologación URLs
const WSAA_URL = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";
const WSFE_URL = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";

interface FacturaRequest {
  tipo_comprobante: number;
  punto_venta: number;
  concepto: number;
  doc_tipo: number;
  doc_nro: number;
  importe_total: number;
  importe_neto: number;
  importe_iva: number;
  items: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    iva_id: number;
  }>;
}

// Generate LoginTicketRequest (TRA)
function generateTRA(service: string): string {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const expirationTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const uniqueId = Math.floor(Date.now() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

// Normalize PEM format - handle common issues
function normalizePem(pem: string, type: 'CERTIFICATE' | 'RSA PRIVATE KEY' | 'PRIVATE KEY'): string {
  // Remove any existing headers/footers (with variable number of dashes) and whitespace
  let content = pem
    .replace(/-+BEGIN [^-]+-+/gi, '')
    .replace(/-+END [^-]+-+/gi, '')
    .replace(/[\r\n\s]/g, '');
  
  // Re-add proper headers with correct line breaks (5 dashes)
  const header = `-----BEGIN ${type}-----`;
  const footer = `-----END ${type}-----`;
  
  // Split into 64-character lines
  const lines: string[] = [];
  for (let i = 0; i < content.length; i += 64) {
    lines.push(content.slice(i, i + 64));
  }
  
  return `${header}\n${lines.join('\n')}\n${footer}`;
}

// Sign TRA with certificate and private key using PKCS#7/CMS
function signTRA(tra: string, certPem: string, privateKeyPem: string): string {
  try {
    // Log raw input for debugging (first 100 chars)
    console.log("Raw cert input (first 100):", certPem.substring(0, 100));
    console.log("Raw key input (first 100):", privateKeyPem.substring(0, 100));
    
    // Normalize the PEM formats
    const normalizedCert = normalizePem(certPem, 'CERTIFICATE');
    console.log("Normalized cert (first 100):", normalizedCert.substring(0, 100));
    
    // Detect key type and normalize
    let normalizedKey: string;
    if (privateKeyPem.includes('RSA PRIVATE KEY') || !privateKeyPem.includes('PRIVATE KEY')) {
      normalizedKey = normalizePem(privateKeyPem, 'RSA PRIVATE KEY');
    } else {
      normalizedKey = normalizePem(privateKeyPem, 'PRIVATE KEY');
    }
    console.log("Normalized key (first 100):", normalizedKey.substring(0, 100));
    
    console.log("Parsing certificate...");
    const cert = forge.pki.certificateFromPem(normalizedCert);
    console.log("Certificate parsed successfully");
    
    console.log("Parsing private key...");
    const privateKey = forge.pki.privateKeyFromPem(normalizedKey);
    console.log("Private key parsed successfully");
    
    console.log("Creating PKCS#7 signed data...");
    
    // Create PKCS#7 signed data
    const p7 = forge.pkcs7.createSignedData();
    
    // Set the content
    p7.content = forge.util.createBuffer(tra, 'utf8');
    
    // Add the certificate
    p7.addCertificate(cert);
    
    // Add a signer
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest
        },
        {
          type: forge.pki.oids.signingTime,
          value: new Date()
        }
      ]
    });
    
    // Sign the data
    p7.sign();
    
    console.log("Converting to DER...");
    
    // Convert to DER format
    const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    
    // Convert to base64
    const base64 = forge.util.encode64(der);
    
    console.log("CMS signed successfully, length:", base64.length);
    
    return base64;
  } catch (error: unknown) {
    console.error("Error signing TRA:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al firmar TRA: ${message}`);
  }
}

// Call WSAA to get token and sign
async function authenticateWSAA(service: string): Promise<{ token: string; sign: string }> {
  const cert = Deno.env.get("AFIP_CERT") || "";
  const privateKey = Deno.env.get("AFIP_PRIVATE_KEY") || "";
  
  if (!cert || !privateKey) {
    throw new Error("Certificado o clave privada no configurados");
  }

  const tra = generateTRA(service);
  console.log("TRA generado:", tra);
  
  const signedTRA = await signTRA(tra, cert, privateKey);
  
  // Call WSAA
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${signedTRA}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  console.log("Calling WSAA...");
  
  const response = await fetch(WSAA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "",
    },
    body: soapEnvelope,
  });

  const responseText = await response.text();
  console.log("WSAA Response (first 500):", responseText.substring(0, 500));

  // Check for "already authenticated" error - this is actually a success
  if (responseText.includes("coe.alreadyAuthenticated")) {
    console.log("Already authenticated with AFIP - token is still valid");
    // Return a flag indicating we're already authenticated
    throw new Error("ALREADY_AUTHENTICATED");
  }

  if (!response.ok) {
    throw new Error(`Error WSAA: ${response.status} - ${responseText}`);
  }

  // Decode HTML entities in the response
  const decodedResponse = responseText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  console.log("Decoded response (first 500):", decodedResponse.substring(0, 500));

  // Parse response to extract token and sign
  const tokenMatch = decodedResponse.match(/<token>(.+?)<\/token>/s);
  const signMatch = decodedResponse.match(/<sign>(.+?)<\/sign>/s);

  if (!tokenMatch || !signMatch) {
    throw new Error("No se pudo obtener token/sign de WSAA: " + decodedResponse);
  }

  return {
    token: tokenMatch[1],
    sign: signMatch[1],
  };
}

// Get last authorized voucher number
async function getUltimoComprobante(
  token: string,
  sign: string,
  cuit: string,
  puntoVenta: number,
  tipoComprobante: number
): Promise<number> {
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${puntoVenta}</ar:PtoVta>
      <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(WSFE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
    },
    body: soapEnvelope,
  });

  const responseText = await response.text();
  console.log("FECompUltimoAutorizado Response:", responseText);

  const nroMatch = responseText.match(/<CbteNro>(\d+)<\/CbteNro>/);
  return nroMatch ? parseInt(nroMatch[1]) : 0;
}

// Authorize voucher (CAE)
async function autorizarComprobante(
  token: string,
  sign: string,
  cuit: string,
  factura: FacturaRequest
): Promise<{ cae: string; vencimiento: string; nroComprobante: number }> {
  const ultimoNro = await getUltimoComprobante(
    token,
    sign,
    cuit,
    factura.punto_venta,
    factura.tipo_comprobante
  );
  
  const nroComprobante = ultimoNro + 1;
  const fechaHoy = new Date().toISOString().split("T")[0].replace(/-/g, "");
  
  // Build IVA array
  const ivaItems = factura.items.reduce((acc, item) => {
    const baseImp = item.cantidad * item.precio_unitario;
    const alicuota = item.iva_id === 5 ? 21 : item.iva_id === 4 ? 10.5 : 0;
    const importe = baseImp * (alicuota / 100);
    
    const existing = acc.find(i => i.id === item.iva_id);
    if (existing) {
      existing.baseImp += baseImp;
      existing.importe += importe;
    } else {
      acc.push({ id: item.iva_id, baseImp, importe });
    }
    return acc;
  }, [] as Array<{ id: number; baseImp: number; importe: number }>);

  const ivaXml = ivaItems.map(iva => `
    <ar:AlicIva>
      <ar:Id>${iva.id}</ar:Id>
      <ar:BaseImp>${iva.baseImp.toFixed(2)}</ar:BaseImp>
      <ar:Importe>${iva.importe.toFixed(2)}</ar:Importe>
    </ar:AlicIva>
  `).join("");

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${factura.punto_venta}</ar:PtoVta>
          <ar:CbteTipo>${factura.tipo_comprobante}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${factura.concepto}</ar:Concepto>
            <ar:DocTipo>${factura.doc_tipo}</ar:DocTipo>
            <ar:DocNro>${factura.doc_nro}</ar:DocNro>
            <ar:CbteDesde>${nroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${nroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${fechaHoy}</ar:CbteFch>
            <ar:ImpTotal>${factura.importe_total.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>${factura.importe_neto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>0.00</ar:ImpOpEx>
            <ar:ImpIVA>${factura.importe_iva.toFixed(2)}</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>
            <ar:Iva>${ivaXml}</ar:Iva>
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

  console.log("Calling FECAESolicitar...");
  
  const response = await fetch(WSFE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
    },
    body: soapEnvelope,
  });

  const responseText = await response.text();
  console.log("FECAESolicitar Response:", responseText);

  // Check for errors
  const errorMatch = responseText.match(/<Err>.*?<Code>(\d+)<\/Code>.*?<Msg>(.+?)<\/Msg>.*?<\/Err>/s);
  if (errorMatch) {
    throw new Error(`Error AFIP ${errorMatch[1]}: ${errorMatch[2]}`);
  }

  // Extract CAE and expiration
  const caeMatch = responseText.match(/<CAE>(\d+)<\/CAE>/);
  const vencMatch = responseText.match(/<CAEFchVto>(\d+)<\/CAEFchVto>/);

  if (!caeMatch) {
    throw new Error("No se obtuvo CAE: " + responseText);
  }

  return {
    cae: caeMatch[1],
    vencimiento: vencMatch ? vencMatch[1] : "",
    nroComprobante,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();
    
    const cuit = Deno.env.get("AFIP_CUIT");
    if (!cuit) {
      throw new Error("CUIT no configurado");
    }

    console.log(`AFIP Action: ${action}, CUIT: ${cuit}`);

    if (action === "test-connection") {
      // Test WSAA connection
      try {
        const { token, sign } = await authenticateWSAA("wsfe");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Conexión exitosa con AFIP",
            hasToken: !!token,
            hasSign: !!sign
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        
        // Handle "already authenticated" as success
        if (message === "ALREADY_AUTHENTICATED") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Conexión exitosa con AFIP (sesión activa)",
              alreadyAuthenticated: true
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: message,
            hint: "Verificá que el certificado y clave privada estén correctamente configurados"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    if (action === "ultimo-comprobante") {
      const body = await req.json();
      const { punto_venta, tipo_comprobante } = body;
      
      const { token, sign } = await authenticateWSAA("wsfe");
      const ultimoNro = await getUltimoComprobante(token, sign, cuit, punto_venta, tipo_comprobante);
      
      return new Response(
        JSON.stringify({ ultimo_numero: ultimoNro }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "emitir") {
      const factura: FacturaRequest = await req.json();
      
      console.log("Emitiendo factura:", JSON.stringify(factura));
      
      // Authenticate with WSAA
      const { token, sign } = await authenticateWSAA("wsfe");
      
      // Authorize voucher
      const resultado = await autorizarComprobante(token, sign, cuit, factura);
      
      return new Response(
        JSON.stringify({
          success: true,
          cae: resultado.cae,
          cae_vencimiento: resultado.vencimiento,
          numero_comprobante: resultado.nroComprobante,
          punto_venta: factura.punto_venta,
          tipo_comprobante: factura.tipo_comprobante,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Acción no válida" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
