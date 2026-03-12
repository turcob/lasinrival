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

export function imprimirRemito(datos: DatosRemito) {
  const ventana = window.open('', '_blank', 'width=800,height=600');
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
    return;
  }

  const numeroRemito = datos.numeroPedido.toString().padStart(6, '0');
  const dia = format(datos.fecha, 'dd', { locale: es });
  const mes = format(datos.fecha, 'MM', { locale: es });

  const lineasHTML = datos.lineas.map(linea => `
    <tr>
      <td class="cell mono">${linea.codigo}</td>
      <td class="cell">${linea.descripcion}</td>
      <td class="cell center">${linea.unidadMedida || 'UNI'}</td>
      <td class="cell center">${linea.descuento > 0 ? linea.descuento.toFixed(0) : ''}</td>
      <td class="cell center">${linea.cantidad}</td>
      <td class="cell right">${formatCurrency(linea.precioUnitario)}</td>
      <td class="cell right bold">${formatCurrency(linea.subtotal)}</td>
    </tr>
  `).join('');

  // Rellenar filas vacías para mantener formato (mínimo 15 filas)
  const filasVacias = Math.max(0, 15 - datos.lineas.length);
  const filasVaciasHTML = Array(filasVacias).fill('').map(() => `
    <tr>
      <td class="cell">&nbsp;</td>
      <td class="cell"></td>
      <td class="cell"></td>
      <td class="cell"></td>
      <td class="cell"></td>
      <td class="cell"></td>
      <td class="cell"></td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Remito #${numeroRemito}</title>
      <style>
        @media print {
          body { margin: 0; padding: 10px; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
        * { box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.3;
          color: #000;
          max-width: 780px;
          margin: 0 auto;
          padding: 15px;
        }
        .remito-container {
          border: 2px solid #000;
          padding: 0;
        }
        .header-row {
          display: flex;
          align-items: stretch;
          border-bottom: 2px solid #000;
        }
        .logo-box {
          width: 80px;
          min-height: 70px;
          border-right: 2px solid #000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 5px;
        }
        .logo-box img {
          max-width: 65px;
          max-height: 60px;
          object-fit: contain;
        }
        .header-center {
          flex: 1;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .header-right {
          width: 120px;
          border-left: 2px solid #000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px;
        }
        .header-right .fecha-num {
          font-size: 20px;
          font-weight: bold;
        }
        .info-row {
          display: flex;
          border-bottom: 2px solid #000;
        }
        .info-cell {
          padding: 4px 10px;
          border-right: 2px solid #000;
          font-size: 11px;
        }
        .info-cell:last-child {
          border-right: none;
        }
        .info-cell.grow {
          flex: 1;
        }
        .bold {
          font-weight: bold;
        }
        .client-row {
          padding: 6px 10px;
          border-bottom: 2px solid #000;
          font-size: 12px;
        }
        .client-row .label {
          font-size: 10px;
          color: #444;
        }
        .client-row .value {
          font-weight: bold;
          font-size: 13px;
        }
        /* Table */
        .items-table {
          width: 100%;
          border-collapse: collapse;
        }
        .items-table th {
          background: #000;
          color: #fff;
          padding: 5px 6px;
          text-align: left;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          border-right: 1px solid #333;
        }
        .items-table th:last-child {
          border-right: none;
        }
        .cell {
          padding: 3px 6px;
          border-bottom: 1px solid #666;
          font-size: 11px;
          vertical-align: middle;
          min-height: 20px;
        }
        .cell.mono {
          font-family: 'Courier New', monospace;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        /* Total */
        .total-row {
          display: flex;
          justify-content: flex-end;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
        }
        .total-label {
          padding: 8px 15px;
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 3px;
        }
        .total-value {
          padding: 8px 15px;
          font-size: 16px;
          font-weight: bold;
          border-left: 2px solid #000;
          min-width: 140px;
          text-align: right;
        }
        /* Footer */
        .footer-section {
          padding: 10px;
        }
        .recibi-conforme {
          font-size: 11px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .firmas-row {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          padding-top: 5px;
        }
        .firma-block {
          width: 30%;
          text-align: center;
        }
        .firma-dots {
          border-bottom: 1px dotted #000;
          height: 40px;
          margin-bottom: 4px;
        }
        .firma-label {
          font-size: 10px;
        }
        .disclaimer {
          margin-top: 15px;
          font-size: 9px;
          text-align: center;
          font-weight: bold;
          letter-spacing: 0.5px;
          border-top: 1px solid #000;
          padding-top: 8px;
        }
        .print-button {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 24px;
          background: #1976d2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .print-button:hover { background: #1565c0; }
      </style>
    </head>
    <body>
      <div class="remito-container">
        <!-- Header -->
        <div class="header-row">
          <div class="logo-box">
            <img src="/favicon.ico" alt="Logo" />
          </div>
          <div class="header-center">
            <div style="font-size:16px;font-weight:bold;">${datos.empresa?.razonSocial || 'REMITO'}</div>
            ${datos.sucursal ? `<div style="font-size:11px;">SUCURSAL: ${datos.sucursal}</div>` : ''}
            ${datos.empresa ? `<div style="font-size:10px;color:#444;">${datos.empresa.direccion}${datos.empresa.telefono ? ' - Tel: ' + datos.empresa.telefono : ''}</div>` : ''}
          </div>
          <div class="header-right">
            <div class="fecha-num">${dia}&nbsp;&nbsp;${mes}</div>
            <div style="font-size:10px;margin-top:2px;">FECHA</div>
          </div>
        </div>

        <!-- Client info -->
        <div class="info-row">
          <div class="info-cell bold grow" style="font-size:13px;">
            <span class="value">${datos.cliente.codigoCliente || ''}</span>
          </div>
          <div class="info-cell" style="font-size:11px;">
            ${datos.condicionVenta || 'CUENTA CORRIENTE'}
          </div>
        </div>
        <div class="client-row">
          <span class="label">CLIENTE: </span>
          <span class="value">${datos.cliente.nombre}</span>
          ${datos.cliente.cuit ? `&nbsp;&nbsp;&nbsp;<span class="label">CUIT: </span><span class="value">${datos.cliente.cuit}</span>` : ''}
        </div>
        ${datos.cliente.direccion ? `
        <div class="client-row" style="border-bottom:2px solid #000;padding:4px 10px;">
          <span class="label">DIRECCIÓN: </span>
          <span class="value" style="font-size:12px;">${datos.cliente.direccion}</span>
        </div>
        ` : '<div style="border-bottom:2px solid #000;"></div>'}

        <!-- Info row: zona, vendedor, remito # -->
        <div class="info-row" style="border-bottom:2px solid #000;">
          ${datos.cliente.zona ? `<div class="info-cell">ZONA: <span class="bold">${datos.cliente.zona}</span></div>` : ''}
          ${datos.vendedor ? `<div class="info-cell">VENDEDOR: <span class="bold">${datos.vendedor}</span></div>` : ''}
          <div class="info-cell grow"></div>
          <div class="info-cell bold" style="font-size:13px;">R #<span class="value">${numeroRemito}</span></div>
        </div>

        <!-- Products table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:90px;">Código</th>
              <th>Descripción</th>
              <th style="width:45px;text-align:center;">U/M</th>
              <th style="width:45px;text-align:center;">%Bon</th>
              <th style="width:50px;text-align:center;">Cant</th>
              <th style="width:85px;text-align:right;">P.Unitario</th>
              <th style="width:95px;text-align:right;">Importe</th>
            </tr>
          </thead>
          <tbody>
            ${lineasHTML}
            ${filasVaciasHTML}
          </tbody>
        </table>

        <!-- Total -->
        <div class="total-row">
          <div class="total-label">TOTAL:</div>
          <div class="total-value">${formatCurrency(datos.total)}</div>
        </div>

        <!-- Footer: signature section -->
        <div class="footer-section">
          <div class="recibi-conforme">*** RECIBI CONFORME:</div>
          <div class="firmas-row">
            <div class="firma-block">
              <div class="firma-dots"></div>
              <div class="firma-label">Firma</div>
            </div>
            <div class="firma-block">
              <div class="firma-dots"></div>
              <div class="firma-label">Aclaración</div>
            </div>
            <div class="firma-block">
              <div class="firma-dots"></div>
              <div class="firma-label">DNI</div>
            </div>
          </div>
          <div class="disclaimer">
            *** POR FAVOR CONTROLE SU MERCADERÍA. UNA VEZ RECIBIDA, NO HAY DEVOLUCIÓN. ***
          </div>
        </div>
      </div>

      <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir Remito</button>
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}

/**
 * Generates the inner HTML for a single remito (used when printing multiple remitos in batch).
 * Each remito gets its own page via page-break-after.
 */
export function generarRemitoHTML(datos: DatosRemito, isLast: boolean = false): string {
  const numeroRemito = datos.numeroPedido.toString().padStart(6, '0');
  const dia = format(datos.fecha, 'dd', { locale: es });
  const mes = format(datos.fecha, 'MM', { locale: es });

  const lineasHTML = datos.lineas.map(linea => `
    <tr>
      <td class="cell mono">${linea.codigo}</td>
      <td class="cell">${linea.descripcion}</td>
      <td class="cell center">${linea.unidadMedida || 'UNI'}</td>
      <td class="cell center">${linea.descuento > 0 ? linea.descuento.toFixed(0) : ''}</td>
      <td class="cell center">${linea.cantidad}</td>
      <td class="cell right">${formatCurrency(linea.precioUnitario)}</td>
      <td class="cell right bold">${formatCurrency(linea.subtotal)}</td>
    </tr>
  `).join('');

  const filasVacias = Math.max(0, 12 - datos.lineas.length);
  const filasVaciasHTML = Array(filasVacias).fill('').map(() => `
    <tr><td class="cell">&nbsp;</td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td></tr>
  `).join('');

  const pageBreak = !isLast ? 'page-break-after:always;' : '';

  return `
    <div style="${pageBreak}" class="remito-container">
      <div class="header-row">
        <div class="logo-box"><img src="/favicon.ico" alt="Logo" /></div>
        <div class="header-center">
          <div style="font-size:16px;font-weight:bold;">${datos.empresa?.razonSocial || 'REMITO'}</div>
          ${datos.sucursal ? `<div style="font-size:11px;">SUCURSAL: ${datos.sucursal}</div>` : ''}
        </div>
        <div class="header-right">
          <div class="fecha-num">${dia}&nbsp;&nbsp;${mes}</div>
          <div style="font-size:10px;margin-top:2px;">FECHA</div>
        </div>
      </div>
      <div class="info-row">
        <div class="info-cell bold grow" style="font-size:13px;">${datos.cliente.codigoCliente || ''}</div>
        <div class="info-cell">${datos.condicionVenta || 'CUENTA CORRIENTE'}</div>
      </div>
      <div class="client-row">
        <span class="label">CLIENTE: </span><span class="value">${datos.cliente.nombre}</span>
        ${datos.cliente.cuit ? `&nbsp;&nbsp;<span class="label">CUIT: </span><span class="value">${datos.cliente.cuit}</span>` : ''}
      </div>
      <div style="border-bottom:2px solid #000;"></div>
      <div class="info-row" style="border-bottom:2px solid #000;">
        ${datos.cliente.zona ? `<div class="info-cell">ZONA: <span class="bold">${datos.cliente.zona}</span></div>` : ''}
        ${datos.vendedor ? `<div class="info-cell">VENDEDOR: <span class="bold">${datos.vendedor}</span></div>` : ''}
        <div class="info-cell grow"></div>
        <div class="info-cell bold" style="font-size:13px;">R #<span class="value">${numeroRemito}</span></div>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:90px;">Código</th>
            <th>Descripción</th>
            <th style="width:45px;text-align:center;">U/M</th>
            <th style="width:45px;text-align:center;">%Bon</th>
            <th style="width:50px;text-align:center;">Cant</th>
            <th style="width:85px;text-align:right;">P.Unitario</th>
            <th style="width:95px;text-align:right;">Importe</th>
          </tr>
        </thead>
        <tbody>${lineasHTML}${filasVaciasHTML}</tbody>
      </table>
      <div class="total-row">
        <div class="total-label">TOTAL:</div>
        <div class="total-value">${formatCurrency(datos.total)}</div>
      </div>
      <div class="footer-section">
        <div class="recibi-conforme">*** RECIBI CONFORME:</div>
        <div class="firmas-row">
          <div class="firma-block"><div class="firma-dots"></div><div class="firma-label">Firma</div></div>
          <div class="firma-block"><div class="firma-dots"></div><div class="firma-label">Aclaración</div></div>
          <div class="firma-block"><div class="firma-dots"></div><div class="firma-label">DNI</div></div>
        </div>
        <div class="disclaimer">*** POR FAVOR CONTROLE SU MERCADERÍA. UNA VEZ RECIBIDA, NO HAY DEVOLUCIÓN. ***</div>
      </div>
    </div>
  `;
}

/** Shared CSS styles for remitos (used in batch printing) */
export const REMITO_STYLES = `
  @media print {
    body { margin: 0; padding: 10px; }
    .no-print { display: none !important; }
    @page { size: A4; margin: 10mm; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.3;
    color: #000;
    max-width: 780px;
    margin: 0 auto;
    padding: 15px;
  }
  .remito-container {
    border: 2px solid #000;
    padding: 0;
    margin-bottom: 20px;
  }
  .header-row {
    display: flex;
    align-items: stretch;
    border-bottom: 2px solid #000;
  }
  .logo-box {
    width: 80px;
    min-height: 70px;
    border-right: 2px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px;
  }
  .logo-box img {
    max-width: 65px;
    max-height: 60px;
    object-fit: contain;
  }
  .header-center {
    flex: 1;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .header-right {
    width: 120px;
    border-left: 2px solid #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }
  .header-right .fecha-num {
    font-size: 20px;
    font-weight: bold;
  }
  .info-row {
    display: flex;
    border-bottom: 2px solid #000;
  }
  .info-cell {
    padding: 4px 10px;
    border-right: 2px solid #000;
    font-size: 11px;
  }
  .info-cell:last-child { border-right: none; }
  .info-cell.grow { flex: 1; }
  .bold { font-weight: bold; }
  .client-row {
    padding: 6px 10px;
    border-bottom: 2px solid #000;
    font-size: 12px;
  }
  .client-row .label { font-size: 10px; color: #444; }
  .client-row .value { font-weight: bold; font-size: 13px; }
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table th {
    background: #000;
    color: #fff;
    padding: 5px 6px;
    text-align: left;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    border-right: 1px solid #333;
  }
  .items-table th:last-child { border-right: none; }
  .cell {
    padding: 3px 6px;
    border-bottom: 1px solid #666;
    font-size: 11px;
    vertical-align: middle;
    min-height: 20px;
  }
  .cell.mono { font-family: 'Courier New', monospace; }
  .center { text-align: center; }
  .right { text-align: right; }
  .total-row {
    display: flex;
    justify-content: flex-end;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
  }
  .total-label {
    padding: 8px 15px;
    font-size: 14px;
    font-weight: bold;
    letter-spacing: 3px;
  }
  .total-value {
    padding: 8px 15px;
    font-size: 16px;
    font-weight: bold;
    border-left: 2px solid #000;
    min-width: 140px;
    text-align: right;
  }
  .footer-section { padding: 10px; }
  .recibi-conforme { font-size: 11px; font-weight: bold; margin-bottom: 10px; }
  .firmas-row {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 5px;
  }
  .firma-block { width: 30%; text-align: center; }
  .firma-dots { border-bottom: 1px dotted #000; height: 40px; margin-bottom: 4px; }
  .firma-label { font-size: 10px; }
  .disclaimer {
    margin-top: 15px;
    font-size: 9px;
    text-align: center;
    font-weight: bold;
    letter-spacing: 0.5px;
    border-top: 1px solid #000;
    padding-top: 8px;
  }
  .print-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .print-button:hover { background: #1565c0; }
`;
