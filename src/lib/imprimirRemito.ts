import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LineaRemito {
  codigo: string;
  descripcion: string;
  unidadMedida?: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
}

interface DatosRemito {
  numeroPedido: number;
  fecha: Date;
  cliente: {
    nombre: string;
    codigoCliente?: string;
    direccion: string;
    localidad?: string;
    cuit: string;
    zona?: string;
  };
  vendedor?: string;
  sucursal?: string;
  condicionVenta?: string;
  lineas: LineaRemito[];
  total: number;
  empresa?: {
    razonSocial: string;
    cuit: string;
    direccion: string;
    telefono?: string;
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

/** Format invoice number as B XXXXX-XXXXXXXX */
const formatNumeroFactura = (numero: number) => {
  const puntoVenta = '00001';
  const nroComprobante = numero.toString().padStart(8, '0');
  return `B ${puntoVenta}-${nroComprobante}`;
};

type RemitoOrientation = 'landscape' | 'portrait' | 'a4-portrait';

function getPageDims(orientation: RemitoOrientation) {
  // landscape: A5 estándar 210x148
  // portrait (alimentación vertical del usuario): 200x140 personalizado
  // a4-portrait: hoja A4 210x297, contenido limitado a 200x140 anclado arriba a la izquierda
  if (orientation === 'a4-portrait') {
    return {
      width: '200mm',
      height: '140mm',
      size: 'A4 portrait',
    };
  }
  const width = orientation === 'landscape' ? '210mm' : '200mm';
  const height = orientation === 'landscape' ? '148mm' : '140mm';
  return { width, height, size: `${width} ${height}` };
}

/** Common styles shared by single and batch printing */
function getStyles(orientation: RemitoOrientation = 'landscape') {
  const { width: REMITO_PAGE_WIDTH, height: REMITO_PAGE_HEIGHT, size: REMITO_PAGE_SIZE } = getPageDims(orientation);
  const REMITO_BODY_MAX_WIDTH = REMITO_PAGE_WIDTH;
  const pageSize = `size: ${REMITO_PAGE_SIZE};`;
  const pageMargin = 'margin: 0;';
  const isA4Portrait = orientation === 'a4-portrait';
  // En A4 vertical anclamos el contenido arriba a la izquierda y NO usamos padding lateral
  // para que la impresión no supere los 14cm de alto ni se centre en la hoja.
  const bodyPrintPadding = isA4Portrait ? '0' : '0 5mm';
  const widthCalc = isA4Portrait ? REMITO_PAGE_WIDTH : `calc(${REMITO_PAGE_WIDTH} - 10mm)`;
  const maxWidthCalc = isA4Portrait ? REMITO_PAGE_WIDTH : `calc(${REMITO_BODY_MAX_WIDTH} - 10mm)`;
  return `
    @media print {
      body { margin: 0; padding: ${bodyPrintPadding}; }
      .no-print { display: none !important; }
      @page { ${pageSize} ${pageMargin} }
      .factura-page {
        width: ${widthCalc};
        height: ${REMITO_PAGE_HEIGHT};
        max-height: ${REMITO_PAGE_HEIGHT};
        min-height: ${REMITO_PAGE_HEIGHT};
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
        overflow: hidden;
      }
      .factura-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .factura-container {
        min-height: ${REMITO_PAGE_HEIGHT};
        height: ${REMITO_PAGE_HEIGHT};
        max-height: ${REMITO_PAGE_HEIGHT};
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .items-table-wrapper { flex: 1; }
      .remito-batch-separator { display: none; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.25;
      color: #1a1a1a;
      width: ${REMITO_BODY_MAX_WIDTH};
      max-width: ${REMITO_BODY_MAX_WIDTH};
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .factura-page {
      width: 100%;
      max-width: ${maxWidthCalc};
      margin: 0;
    }
    .factura-container {
      border: 2px solid #222;
      border-radius: 3px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    /* Header */
    .header {
      display: flex;
      align-items: stretch;
      border-bottom: 2px solid #222;
      background: #f5f5f5;
    }
    .header-logo {
      width: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3px;
      border-right: 1px solid #bbb;
    }
    .header-logo img {
      max-width: 36px;
      max-height: 36px;
      object-fit: contain;
    }
    .header-center {
      flex: 1;
      padding: 3px 6px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .header-center .empresa-nombre {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #000;
    }
    .header-center .empresa-detalle {
      font-size: 8.5px;
      color: #333;
      font-weight: 700;
      margin-top: 1px;
    }
    .header-right {
      width: 130px;
      border-left: 2px solid #222;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      padding: 4px 6px;
    }
    .header-right .doc-tipo {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #000;
      text-align: center;
      border-bottom: 1px solid #bbb;
      padding-bottom: 2px;
      margin-bottom: 3px;
    }
    .header-right .empresa-info {
      font-size: 8px;
      color: #222;
      font-weight: 700;
      line-height: 1.25;
    }
    .header-right .empresa-info .empresa-nombre-right {
      font-size: 9.5px;
      font-weight: 900;
      color: #000;
      margin-bottom: 1px;
    }
    /* Doc number / date band */
    .doc-band {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 4px 8px;
      border-bottom: 2px solid #222;
      background: #fff;
    }
    .doc-band .doc-numero {
      font-size: 14px;
      font-weight: 900;
      color: #000;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
    }
    .doc-band .doc-fecha {
      font-size: 13px;
      font-weight: 900;
      color: #000;
      font-family: 'Courier New', monospace;
    }
    .doc-band .doc-fecha-label {
      font-size: 9px;
      font-weight: 800;
      color: #555;
      text-transform: uppercase;
      margin-right: 4px;
    }
    /* Client info bar */
    .client-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 6px;
      border-bottom: 1px solid #ccc;
      background: #fff;
      font-size: 10px;
      flex-wrap: wrap;
    }
    .client-bar .cb-item {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .cb-label {
      font-size: 8.5px;
      color: #555;
      text-transform: uppercase;
      font-weight: 800;
    }
    .cb-value {
      font-weight: 800;
      color: #000;
      font-size: 10.5px;
    }
    .client-bar .cb-separator {
      width: 1px;
      height: 11px;
      background: #bbb;
    }
    /* Secondary info row */
    .info-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 6px;
      border-bottom: 2px solid #222;
      font-size: 9.5px;
      color: #333;
      background: #fafafa;
    }
    .info-bar .ib-item {
      display: flex;
      gap: 2px;
    }
    .info-bar .ib-label {
      font-weight: 800;
      color: #555;
      text-transform: uppercase;
      font-size: 8.5px;
    }
    .info-bar .ib-value {
      font-weight: 700;
      color: #222;
    }
    .info-bar .spacer { flex: 1; }
    /* Table */
    .items-table-wrapper { flex: 1; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table thead th {
      background: #222;
      color: #fff;
      padding: 3px 4px;
      text-align: left;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table thead th.center { text-align: center; }
    .items-table thead th.right { text-align: right; }
    .cell {
      padding: 2px 4px;
      border-bottom: 1px solid #d0d0d0;
      font-size: 9.5px;
      font-weight: 700;
      vertical-align: middle;
    }
    .cell.mono {
      font-family: 'Courier New', monospace;
      font-size: 9.5px;
      font-weight: 700;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 800; }
    tr:nth-child(even) .cell {
      background: #f7f7f7;
    }
    /* Total */
    .total-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      border-top: 2px solid #222;
      background: #eee;
    }
    .total-label {
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #222;
    }
    .total-value {
      padding: 5px 10px;
      font-size: 13px;
      font-weight: 900;
      border-left: 2px solid #222;
      min-width: 100px;
      text-align: right;
      color: #000;
      font-family: 'Courier New', monospace;
    }
    /* Footer */
    .footer-section {
      padding: 5px 6px 4px;
      border-top: 1px solid #ccc;
    }
    .recibi-conforme {
      font-size: 10px;
      font-weight: 800;
      color: #222;
      margin-bottom: 3px;
    }
    .firmas-row {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
    }
    .firma-block {
      width: 28%;
      text-align: center;
    }
    .firma-dots {
      border-bottom: 1px dotted #666;
      height: 20px;
      margin-bottom: 2px;
    }
    .firma-label {
      font-size: 8.5px;
      color: #555;
      font-weight: 700;
      text-transform: uppercase;
    }
    .disclaimer {
      margin-top: 5px;
      font-size: 9px;
      text-align: center;
      font-weight: 800;
      color: #333;
      letter-spacing: 0.3px;
      border-top: 1px solid #ccc;
      padding-top: 4px;
    }
    .print-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .print-button:hover { background: #1d4ed8; }
  `;
}

/** Build the inner HTML for a single factura document */
function buildFacturaHTML(datos: DatosRemito): string {
  const numeroFactura = formatNumeroFactura(datos.numeroPedido);
  const fechaFormateada = format(datos.fecha, "dd/MM/yyyy", { locale: es });

  const lineasHTML = datos.lineas.map(linea => `
    <tr>
      <td class="cell mono">${linea.codigo}</td>
      <td class="cell">${linea.descripcion}</td>
      <td class="cell center">${linea.unidadMedida || 'UNI'}</td>
      <td class="cell center">${linea.descuento > 0 ? (Math.round(linea.descuento * 100) / 100).toString() + '%' : ''}</td>
      <td class="cell center bold">${linea.cantidad}</td>
      <td class="cell right">${formatCurrency(linea.precioUnitario)}</td>
      <td class="cell right bold">${formatCurrency(linea.subtotal)}</td>
    </tr>
  `).join('');

  const filasVacias = Math.max(0, 6 - datos.lineas.length);
  const filasVaciasHTML = Array(filasVacias).fill('').map(() =>
    `<tr><td class="cell">&nbsp;</td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td></tr>`
  ).join('');

  // Client info items
  const clientItems: string[] = [];
  if (datos.cliente.codigoCliente) {
    clientItems.push(`<div class="cb-item"><span class="cb-label">Cód:</span><span class="cb-value">${datos.cliente.codigoCliente}</span></div>`);
  }
  clientItems.push(`<div class="cb-item"><span class="cb-label">Cliente:</span><span class="cb-value">${datos.cliente.nombre}</span></div>`);
  if (datos.cliente.direccion) {
    clientItems.push(`<div class="cb-item"><span class="cb-label">Dir:</span><span class="cb-value">${datos.cliente.direccion}</span></div>`);
  }
  if (datos.cliente.localidad) {
    clientItems.push(`<div class="cb-item"><span class="cb-label">Loc:</span><span class="cb-value">${datos.cliente.localidad}</span></div>`);
  }
  if (datos.cliente.zona) {
    clientItems.push(`<div class="cb-item"><span class="cb-label">Zona:</span><span class="cb-value">${datos.cliente.zona}</span></div>`);
  }
  if (datos.cliente.cuit) {
    clientItems.push(`<div class="cb-item"><span class="cb-label">CUIT:</span><span class="cb-value">${datos.cliente.cuit}</span></div>`);
  }

  const clientBarHTML = clientItems.join('<div class="cb-separator"></div>');

  // Secondary info items
  const infoItems: string[] = [];
  if (datos.vendedor) {
    infoItems.push(`<div class="ib-item"><span class="ib-label">Vendedor:</span><span class="ib-value">${datos.vendedor}</span></div>`);
  }
  infoItems.push(`<div class="ib-item"><span class="ib-label">Cond. Venta:</span><span class="ib-value">${datos.condicionVenta || 'Cuenta Corriente'}</span></div>`);

  return `
    <div class="factura-container">
      <div class="header">
        <div class="header-logo">
          <img src="/logo-empresa.jpg" alt="Logo" />
        </div>
        <div class="header-center">
          <div class="doc-tipo" style="font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#000;">FACTURA</div>
          <div class="doc-numero" style="font-size:20px;font-weight:900;color:#000;font-family:'Courier New',monospace;letter-spacing:1px;margin-top:4px;">${numeroFactura}</div>
          ${datos.sucursal ? `<div class="empresa-detalle" style="margin-top:4px;">Sucursal: ${datos.sucursal}</div>` : ''}
        </div>
        <div class="header-right">
          <div class="empresa-info">
            <div class="empresa-nombre-right">${datos.empresa?.razonSocial || ''}</div>
            ${datos.empresa ? `<div>${datos.empresa.direccion}</div>` : ''}
            ${datos.empresa?.telefono ? `<div>Tel: ${datos.empresa.telefono}</div>` : ''}
            ${datos.empresa ? `<div>CUIT: ${datos.empresa.cuit}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="doc-band">
        <div><span class="doc-fecha-label">Fecha:</span><span class="doc-fecha">${fechaFormateada}</span></div>
      </div>

      <div class="client-bar">${clientBarHTML}</div>

      ${infoItems.length > 0 ? `<div class="info-bar">${infoItems.join('')}<div class="spacer"></div></div>` : ''}

      <div class="items-table-wrapper">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:55px;">Código</th>
            <th>Descripción</th>
            <th class="center" style="width:30px;">U/M</th>
            <th class="center" style="width:30px;">Bon.</th>
            <th class="center" style="width:32px;">Cant</th>
            <th class="right" style="width:55px;">P.Unit.</th>
            <th class="right" style="width:60px;">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${lineasHTML}
          ${filasVaciasHTML}
        </tbody>
      </table>
      </div>

      <div class="total-row">
        <div class="total-label">TOTAL</div>
        <div class="total-value">$ ${formatCurrency(datos.total)}</div>
      </div>

      <div class="footer-section">
        <div class="recibi-conforme">RECIBI CONFORME:</div>
        <div class="firmas-row">
          <div class="firma-block"><div class="firma-dots"></div><div class="firma-label">Firma</div></div>
          <div class="firma-block"><div class="firma-dots"></div><div class="firma-label">Aclaración</div></div>
          <div class="firma-block"><div class="firma-dots"></div><div class="firma-label">DNI</div></div>
        </div>
        <div class="disclaimer">Controle su mercadería al momento de la recepción. No se aceptan reclamos posteriores.</div>
      </div>
    </div>
  `;
}

export function imprimirRemito(datos: DatosRemito, orientation: RemitoOrientation = 'a4-portrait') {
  const ventana = window.open('', '_blank', 'width=800,height=600');
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
    return;
  }

  const facturaHTML = buildFacturaHTML(datos);
  const copiasHTML = `
    <div class="factura-page" data-copy="1">${facturaHTML}</div>
    <div class="factura-page" data-copy="2">${facturaHTML}</div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Factura ${formatNumeroFactura(datos.numeroPedido)}</title>
      <style id="remito-styles">${getStyles(orientation)}</style>
    </head>
    <body>
      <div id="remito-content">${copiasHTML}</div>
      ${buildOrientationToolbar(orientation)}
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}

/** Toolbar with fixed A4 sheet + print button injected into the print window */
function buildOrientationToolbar(initial: RemitoOrientation): string {
  const stylesA4Portrait = getStyles('a4-portrait').replace(/<\/script>/g, '<\\/script>');
  return `
    <div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px;align-items:center;background:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,0.18);font-family:'Segoe UI',Arial,sans-serif;font-size:13px;z-index:9999;">
      <span style="font-weight:600;color:#222;">Hoja: A4 Vertical</span>
      <button id="remito-print-btn" style="padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">🖨️ Imprimir</button>
    </div>
    <script>
      (function(){
        var styleEl = document.getElementById('remito-styles');
        if (styleEl) styleEl.textContent = ${JSON.stringify(stylesA4Portrait)};
        var btn = document.getElementById('remito-print-btn');
        if (btn) btn.addEventListener('click', function(){ window.print(); });
      })();
    </script>
  `;
}

/**
 * Generates the inner HTML for a single factura (used when printing multiple in batch).
 * Each factura gets its own page via page-break-after.
 */
export function generarRemitoHTML(datos: DatosRemito, isLast: boolean = false): string {
  const facturaHTML = buildFacturaHTML(datos);
  const copiaUno = `<div class="factura-page" data-copy="1">${facturaHTML}</div>`;
  const copiaDos = `<div class="factura-page" data-copy="2">${facturaHTML}</div>`;
  const pageBreak = !isLast ? '<div class="remito-batch-separator"></div>' : '';

  return `${copiaUno}${copiaDos}${pageBreak}`;
}

/** Shared CSS styles for facturas (used in batch printing). Fixed A4 portrait. */
export const REMITO_STYLES = `${getStyles('a4-portrait')}
  .remito-batch-separator {
    page-break-after: auto;
    break-after: auto;
  }
`;

/** Builds the orientation toolbar for batch print windows. Exposed for external callers. */
export function buildRemitoOrientationToolbar(initial: RemitoOrientation = 'a4-portrait'): string {
  return buildOrientationToolbar(initial);
}

/** Returns the styles for a given orientation. Useful for batch print windows. */
export function getRemitoStyles(orientation: RemitoOrientation = 'a4-portrait'): string {
  return `${getStyles(orientation)}
  .remito-batch-separator {
    page-break-after: auto;
    break-after: auto;
  }
  `;
}
