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

/** Determine if the document is short enough for A5 */
const isShortDocument = (lineas: LineaRemito[]) => lineas.length <= 8;

/** Common styles shared by single and batch printing */
function getStyles(useA5: boolean) {
  const pageSize = useA5 ? 'size: 148mm 210mm;' : 'size: A4;';
  return `
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      @page { ${pageSize} margin: 6mm; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #1a1a1a;
      max-width: ${useA5 ? '520px' : '780px'};
      margin: 0 auto;
      padding: 10px;
    }
    .factura-container {
      border: 1.5px solid #333;
      border-radius: 4px;
      overflow: hidden;
    }
    /* Header */
    .header {
      display: flex;
      align-items: stretch;
      border-bottom: 1.5px solid #333;
      background: #f8f8f8;
    }
    .header-logo {
      width: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-right: 1px solid #ccc;
    }
    .header-logo img {
      max-width: 48px;
      max-height: 48px;
      object-fit: contain;
    }
    .header-center {
      flex: 1;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .header-center .empresa-nombre {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #111;
    }
    .header-center .empresa-detalle {
      font-size: 9px;
      color: #555;
      margin-top: 2px;
    }
    .header-right {
      width: 130px;
      border-left: 1.5px solid #333;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px;
    }
    .header-right .doc-tipo {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #111;
    }
    .header-right .doc-numero {
      font-size: 16px;
      font-weight: 700;
      color: #333;
      margin-top: 2px;
      font-family: 'Courier New', monospace;
    }
    .header-right .doc-fecha {
      font-size: 10px;
      color: #666;
      margin-top: 3px;
    }
    /* Client info bar */
    .client-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 5px 10px;
      border-bottom: 1px solid #ddd;
      background: #fff;
      font-size: 11px;
      flex-wrap: wrap;
    }
    .client-bar .cb-item {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .cb-label {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      font-weight: 600;
    }
    .cb-value {
      font-weight: 700;
      color: #111;
      font-size: 12px;
    }
    .client-bar .cb-separator {
      width: 1px;
      height: 14px;
      background: #ccc;
    }
    /* Secondary info row */
    .info-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 10px;
      border-bottom: 1.5px solid #333;
      font-size: 10px;
      color: #555;
      background: #fafafa;
    }
    .info-bar .ib-item {
      display: flex;
      gap: 3px;
    }
    .info-bar .ib-label {
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      font-size: 9px;
    }
    .info-bar .ib-value {
      font-weight: 600;
      color: #333;
    }
    .info-bar .spacer { flex: 1; }
    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table thead th {
      background: #2c2c2c;
      color: #fff;
      padding: 4px 6px;
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table thead th.center { text-align: center; }
    .items-table thead th.right { text-align: right; }
    .cell {
      padding: 3px 6px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 10px;
      vertical-align: middle;
    }
    .cell.mono {
      font-family: 'Courier New', monospace;
      font-size: 10px;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    tr:nth-child(even) .cell {
      background: #fafafa;
    }
    /* Total */
    .total-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      border-top: 1.5px solid #333;
      background: #f0f0f0;
    }
    .total-label {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #333;
    }
    .total-value {
      padding: 6px 12px;
      font-size: 15px;
      font-weight: 800;
      border-left: 1.5px solid #333;
      min-width: 120px;
      text-align: right;
      color: #111;
      font-family: 'Courier New', monospace;
    }
    /* Footer */
    .footer-section {
      padding: 8px 10px 6px;
      border-top: 1px solid #ddd;
    }
    .recibi-conforme {
      font-size: 10px;
      font-weight: 700;
      color: #333;
      margin-bottom: 6px;
    }
    .firmas-row {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
    }
    .firma-block {
      width: 28%;
      text-align: center;
    }
    .firma-dots {
      border-bottom: 1px dotted #999;
      height: 30px;
      margin-bottom: 3px;
    }
    .firma-label {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
    }
    .disclaimer {
      margin-top: 10px;
      font-size: 8px;
      text-align: center;
      font-weight: 600;
      color: #666;
      letter-spacing: 0.3px;
      border-top: 1px solid #ddd;
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
  const numeroFactura = datos.numeroPedido.toString().padStart(6, '0');
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

  const minFilas = isShortDocument(datos.lineas) ? 6 : 12;
  const filasVacias = Math.max(0, minFilas - datos.lineas.length);
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
          <img src="/favicon.ico" alt="Logo" />
        </div>
        <div class="header-center">
          <div class="empresa-nombre">${datos.empresa?.razonSocial || 'FACTURA'}</div>
          ${datos.sucursal ? `<div class="empresa-detalle">Sucursal: ${datos.sucursal}</div>` : ''}
          ${datos.empresa ? `<div class="empresa-detalle">${datos.empresa.direccion}${datos.empresa.telefono ? ' · Tel: ' + datos.empresa.telefono : ''}</div>` : ''}
          ${datos.empresa ? `<div class="empresa-detalle">CUIT: ${datos.empresa.cuit}</div>` : ''}
        </div>
        <div class="header-right">
          <div class="doc-tipo">Factura</div>
          <div class="doc-numero">#${numeroFactura}</div>
          <div class="doc-fecha">${fechaFormateada}</div>
        </div>
      </div>

      <div class="client-bar">${clientBarHTML}</div>

      ${infoItems.length > 0 ? `<div class="info-bar">${infoItems.join('')}<div class="spacer"></div></div>` : ''}

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

  const useA5 = isShortDocument(datos.lineas);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Factura #${datos.numeroPedido.toString().padStart(6, '0')}</title>
      <style>${getStyles(useA5)}</style>
    </head>
    <body>
      ${buildFacturaHTML(datos)}
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
  const pageBreak = !isLast ? ' style="page-break-after:always;"' : '';
  return `<div${pageBreak}>${buildFacturaHTML(datos)}</div>`;
}

/** Shared CSS styles for facturas (used in batch printing) */
export const REMITO_STYLES = getStyles(false);
