import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AFIP Homologación URLs
const WSAA_URL = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";
const WSFE_URL = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";

interface FacturaRequest {
  tipo_comprobante: number; // 1=Factura A, 6=Factura B, 11=Factura C, 3=Nota Crédito A, 8=Nota Crédito B
  punto_venta: number;
  concepto: number; // 1=Productos, 2=Servicios, 3=Productos y Servicios
  doc_tipo: number; // 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final
  doc_nro: number;
  importe_total: number;
  importe_neto: number;
  importe_iva: number;
  items: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    iva_id: number; // 5=21%, 4=10.5%, 3=0%
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

// Sign TRA with certificate and private key using Web Crypto API
async function signTRA(tra: string, cert: string, privateKey: string): Promise<string> {
  try {
    // For Deno, we need to use the native crypto API
    // This is a simplified implementation - in production, you'd use a proper PKCS#7 signing library
    
    // Convert PEM to raw key
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    let pemContents = privateKey.replace(pemHeader, "").replace(pemFooter, "");
    pemContents = pemContents.replace(/\s/g, "");
    
    // For RSA PRIVATE KEY format
    const rsaPemHeader = "-----BEGIN RSA PRIVATE KEY-----";
    const rsaPemFooter = "-----END RSA PRIVATE KEY-----";
    pemContents = pemContents.replace(rsaPemHeader, "").replace(rsaPemFooter, "");
    pemContents = pemContents.replace(/\s/g, "");
    
    // Encode TRA as base64 for the CMS
    const traBase64 = btoa(tra);
    
    // Note: This is a placeholder. Real CMS/PKCS#7 signing requires a proper library
    // In production, you would use a library like 'pkijs' or call an external signing service
    console.log("TRA generated, attempting to sign...");
    console.log("Certificate loaded:", cert.substring(0, 50) + "...");
    
    // For now, return the base64 encoded TRA
    // You will need to implement proper CMS signing or use an external service
    return traBase64;
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
  console.log("WSAA Response:", responseText.substring(0, 500));

  if (!response.ok) {
    throw new Error(`Error WSAA: ${response.status} - ${responseText}`);
  }

  // Parse response to extract token and sign
  const tokenMatch = responseText.match(/<token>(.+?)<\/token>/s);
  const signMatch = responseText.match(/<sign>(.+?)<\/sign>/s);

  if (!tokenMatch || !signMatch) {
    throw new Error("No se pudo obtener token/sign de WSAA: " + responseText);
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
