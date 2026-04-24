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

const REMITO_PAGE_SIZE = '148mm 210mm';
const REMITO_BODY_MAX_WIDTH = '780px';

/** Common styles shared by single and batch printing */
function getStyles(useA5: boolean) {
  const pageSize = useA5 ? `size: ${REMITO_PAGE_SIZE};` : `size: ${REMITO_PAGE_SIZE};`;
  const pageMargin = useA5 ? 'margin: 4mm;' : 'margin: 4mm;';
  return `
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      @page { ${pageSize} ${pageMargin} }
      .factura-page {
        width: 202mm;
        min-height: 140mm;
        page-break-after: always;
        break-after: page;
      }
      .factura-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .factura-container { min-height: 140mm; display: flex; flex-direction: column; }
      .items-table-wrapper { flex: 1; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.35;
      color: #1a1a1a;
      max-width: ${REMITO_BODY_MAX_WIDTH};
      margin: 0 auto;
      padding: 4mm;
      background: #fff;
    }
    .factura-page {
      width: 100%;
      max-width: ${REMITO_BODY_MAX_WIDTH};
      margin: 0 auto 0;
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
      width: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      border-right: 1px solid #bbb;
    }
    .header-logo img {
      max-width: 44px;
      max-height: 44px;
      object-fit: contain;
    }
    .header-center {
      flex: 1;
      padding: 5px 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .header-center .empresa-nombre {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #000;
    }
    .header-center .empresa-detalle {
      font-size: 10px;
      color: #333;
      font-weight: 700;
      margin-top: 1px;
    }
    .header-right {
      width: 125px;
      border-left: 2px solid #222;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 5px;
    }
    .header-right .doc-tipo {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #000;
    }
    .header-right .doc-numero {
      font-size: 17px;
      font-weight: 800;
      color: #222;
      margin-top: 2px;
      font-family: 'Courier New', monospace;
    }
    .header-right .doc-fecha {
      font-size: 11px;
      color: #333;
      font-weight: 700;
      margin-top: 2px;
    }
    /* Client info bar */
    .client-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 5px 8px;
      border-bottom: 1px solid #ccc;
      background: #fff;
      font-size: 12px;
      flex-wrap: wrap;
    }
    .client-bar .cb-item {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .cb-label {
      font-size: 10px;
      color: #555;
      text-transform: uppercase;
      font-weight: 800;
    }
    .cb-value {
      font-weight: 800;
      color: #000;
      font-size: 13px;
    }
    .client-bar .cb-separator {
      width: 1px;
      height: 14px;
      background: #bbb;
    }
    /* Secondary info row */
    .info-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-bottom: 2px solid #222;
      font-size: 11px;
      color: #333;
      background: #fafafa;
    }
    .info-bar .ib-item {
      display: flex;
      gap: 3px;
    }
    .info-bar .ib-label {
      font-weight: 800;
      color: #555;
      text-transform: uppercase;
      font-size: 10px;
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
      padding: 5px 6px;
      text-align: left;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table thead th.center { text-align: center; }
    .items-table thead th.right { text-align: right; }
    .cell {
      padding: 4px 6px;
      border-bottom: 1px solid #d0d0d0;
      font-size: 11px;
      font-weight: 700;
      vertical-align: middle;
    }
    .cell.mono {
      font-family: 'Courier New', monospace;
      font-size: 11px;
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
      padding: 7px 12px;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #222;
    }
    .total-value {
      padding: 7px 12px;
      font-size: 16px;
      font-weight: 900;
      border-left: 2px solid #222;
      min-width: 120px;
      text-align: right;
      color: #000;
      font-family: 'Courier New', monospace;
    }
    /* Footer */
    .footer-section {
      padding: 8px 8px 6px;
      border-top: 1px solid #ccc;
    }
    .recibi-conforme {
      font-size: 12px;
      font-weight: 800;
      color: #222;
      margin-bottom: 4px;
    }
    .firmas-row {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
    }
    .firma-block {
      width: 28%;
      text-align: center;
    }
    .firma-dots {
      border-bottom: 1px dotted #666;
      height: 28px;
      margin-bottom: 3px;
    }
    .firma-label {
      font-size: 10px;
      color: #555;
      font-weight: 700;
      text-transform: uppercase;
    }
    .disclaimer {
      margin-top: 8px;
      font-size: 11px;
      text-align: center;
      font-weight: 800;
      color: #333;
      letter-spacing: 0.3px;
      border-top: 1px solid #ccc;
      padding-top: 6px;
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
      <td class="cell center">${linea.descuento > 0 ? linea.descuento.toFixed(0) + '%' : ''}</td>
      <td class="cell center bold">${linea.cantidad}</td>
      <td class="cell right">${formatCurrency(linea.precioUnitario)}</td>
      <td class="cell right bold">${formatCurrency(linea.subtotal)}</td>
    </tr>
  `).join('');

  const filasVacias = Math.max(0, 10 - datos.lineas.length);
  const filasVaciasHTML = Array(filasVacias).fill('').map(() =>
    `<tr><td class="cell">&nbsp;</td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td></tr>`
  ).join('');

  // Client info items
  const clientItems: string[] = [];
  if (datos.cliente.codigoCliente) {
    clientItems.push(`<div class="cb-item"><span class="cb-label">Cód:</span><span class="cb-value">${datos.cliente.codigoCliente}</span></div>`);
  }
  clientItems.push(`<div class="cb-item"><span class="cb-label">Cliente:</span><span class="cb-value">${datos.cliente.nombre}</span></div>`);
  if (datos.cliente.zona) {
    clientItems.push(`<div class="cb-item"><span class="cb-label">Zona:</span><span class="cb-value">${datos.cliente.zona}</span></div>`);
  }
  if (datos.cliente.cuit) {
    clientItems.push(`<div class="cb-item"><span class="cb-label">CUIT:</span><span class="cb-value">${datos.cliente.cuit}</span></div>`);
  }

  const clientBarHTML = clientItems.join('<div class="cb-separator"></div>');

  // Secondary info items
  const infoItems: string[] = [];
  if (datos.cliente.direccion) {
    infoItems.push(`<div class="ib-item"><span class="ib-label">Dir:</span><span class="ib-value">${datos.cliente.direccion}</span></div>`);
  }
  if (datos.vendedor) {
    infoItems.push(`<div class="ib-item"><span class="ib-label">Vendedor:</span><span class="ib-value">${datos.vendedor}</span></div>`);
  }
  if (datos.condicionVenta) {
    infoItems.push(`<div class="ib-item"><span class="ib-label">Cond. Venta:</span><span class="ib-value">${datos.condicionVenta}</span></div>`);
  }

  return `
    <div class="factura-container">
      <div class="header">
        <div class="header-logo">
          <img src="/logo-empresa.jpg" alt="Logo" />
        </div>
        <div class="header-center">
          <div class="empresa-nombre">${datos.empresa?.razonSocial || 'FACTURA'}</div>
          ${datos.sucursal ? `<div class="empresa-detalle">Sucursal: ${datos.sucursal}</div>` : ''}
          ${datos.empresa ? `<div class="empresa-detalle">${datos.empresa.direccion}${datos.empresa.telefono ? ' · Tel: ' + datos.empresa.telefono : ''}</div>` : ''}
          ${datos.empresa ? `<div class="empresa-detalle">CUIT: ${datos.empresa.cuit}</div>` : ''}
        </div>
        <div class="header-right">
          <div class="doc-tipo">Factura</div>
          <div class="doc-numero">${numeroFactura}</div>
          <div class="doc-fecha">${fechaFormateada}</div>
        </div>
      </div>

      <div class="client-bar">${clientBarHTML}</div>

      ${infoItems.length > 0 ? `<div class="info-bar">${infoItems.join('')}<div class="spacer"></div></div>` : ''}

      <div class="items-table-wrapper">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:80px;">Código</th>
            <th>Descripción</th>
            <th class="center" style="width:40px;">U/M</th>
            <th class="center" style="width:40px;">Bon.</th>
            <th class="center" style="width:45px;">Cant</th>
            <th class="right" style="width:80px;">P.Unit.</th>
            <th class="right" style="width:85px;">Importe</th>
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

export function imprimirRemito(datos: DatosRemito) {
  const ventana = window.open('', '_blank', 'width=800,height=600');
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
    return;
  }

  const useA5 = true; // Always A5 horizontal

  const facturaHTML = buildFacturaHTML(datos);
  const copiasHTML = [facturaHTML, facturaHTML]
    .map((html, index) => `<div class="factura-page" data-copy="${index + 1}">${html}</div>`)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Factura ${formatNumeroFactura(datos.numeroPedido)}</title>
      <style>${getStyles(useA5)}</style>
    </head>
    <body>
      ${copiasHTML}
      <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}

/**
 * Generates the inner HTML for a single factura (used when printing multiple in batch).
 * Each factura gets its own page via page-break-after.
 */
export function generarRemitoHTML(datos: DatosRemito, isLast: boolean = false): string {
  const copiaUno = `<div class="factura-page">${buildFacturaHTML(datos)}</div>`;
  const copiaDos = `<div class="factura-page">${buildFacturaHTML(datos)}</div>`;
  const pageBreak = !isLast ? '<div class="remito-batch-separator"></div>' : '';

  return `${copiaUno}${copiaDos}${pageBreak}`;
}

/** Shared CSS styles for facturas (used in batch printing) */
export const REMITO_STYLES = `${getStyles(true)}
  .remito-batch-separator {
    page-break-after: auto;
    break-after: auto;
  }
`;
