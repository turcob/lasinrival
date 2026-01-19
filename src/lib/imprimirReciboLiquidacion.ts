interface ReciboData {
  empleadoNombre: string;
  mes: number;
  anio: number;
  sueldoBase: number;
  totalComisiones: number;
  totalDescuentos: number;
  netoAPagar: number;
  formaPago?: string;
  fechaPago?: string;
  observaciones?: string;
  comercio?: {
    razonSocial?: string;
    nombreFantasia?: string | null;
    cuit?: string;
    direccion?: string;
    localidad?: string | null;
    provincia?: string | null;
    telefono?: string | null;
  };
}

const MESES_LABELS: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
};

export function formatCuit(cuit: string): string {
  if (!cuit) return '';
  const clean = cuit.replace(/\D/g, '');
  if (clean.length === 11) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
  }
  return cuit;
}

export function imprimirReciboLiquidacion(data: ReciboData) {
  const fechaPago = data.fechaPago || new Date().toLocaleDateString('es-AR');
  const formaPagoNombre = data.formaPago || 'No especificada';
  const comercio = data.comercio;
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Recibo de Pago - ${data.empleadoNombre}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px; 
          max-width: 800px; 
          margin: 0 auto;
          color: #333;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #333; 
          padding-bottom: 15px; 
          margin-bottom: 20px; 
        }
        .header h1 { font-size: 22px; margin-bottom: 5px; text-transform: uppercase; }
        .header h2 { font-size: 16px; font-weight: normal; color: #555; }
        .empresa-info { 
          text-align: center; 
          font-size: 12px; 
          color: #666; 
          margin-bottom: 15px; 
        }
        .recibo-numero { 
          text-align: right; 
          font-size: 14px; 
          margin-bottom: 20px;
        }
        .recibo-numero strong { color: #333; }
        .section { 
          margin-bottom: 20px; 
          padding: 15px; 
          border: 1px solid #ddd; 
          border-radius: 5px;
        }
        .section-title { 
          font-weight: bold; 
          font-size: 14px; 
          margin-bottom: 10px; 
          color: #333;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
        }
        .row { 
          display: flex; 
          justify-content: space-between; 
          margin: 8px 0; 
          font-size: 13px; 
        }
        .row.highlight { 
          font-weight: bold; 
          font-size: 14px;
          background: #f5f5f5;
          padding: 8px;
          margin: 10px -15px;
          border-radius: 3px;
        }
        .row.total { 
          font-weight: bold; 
          font-size: 16px; 
          border-top: 2px solid #333;
          padding-top: 10px;
          margin-top: 15px;
        }
        .row .label { color: #555; }
        .row .value { font-weight: 500; }
        .row.total .value { font-size: 18px; }
        .negative { color: #c62828; }
        .positive { color: #2e7d32; }
        .firma-section { 
          margin-top: 50px; 
          display: flex; 
          justify-content: space-between; 
        }
        .firma-box { 
          width: 45%; 
          text-align: center; 
        }
        .firma-linea { 
          border-top: 1px solid #333; 
          padding-top: 10px; 
          margin-top: 60px;
          font-size: 12px;
        }
        .footer { 
          text-align: center; 
          margin-top: 40px; 
          font-size: 10px; 
          color: #888; 
          border-top: 1px solid #eee;
          padding-top: 15px;
        }
        .observaciones { 
          background: #f9f9f9; 
          padding: 10px; 
          font-size: 12px; 
          font-style: italic;
          margin-top: 10px;
          border-radius: 3px;
        }
        @media print { 
          body { padding: 10px; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Recibo de Pago de Haberes</h1>
        <h2>${comercio?.nombreFantasia || comercio?.razonSocial || 'Empresa'}</h2>
      </div>
      
      <div class="empresa-info">
        ${comercio?.direccion ? `${comercio.direccion}` : ''}
        ${comercio?.localidad ? ` - ${comercio.localidad}` : ''}
        ${comercio?.provincia ? `, ${comercio.provincia}` : ''}<br>
        ${comercio?.cuit ? `CUIT: ${formatCuit(comercio.cuit)}` : ''}
        ${comercio?.telefono ? ` | Tel: ${comercio.telefono}` : ''}
      </div>

      <div class="recibo-numero">
        <strong>Fecha de Pago:</strong> ${fechaPago}
      </div>

      <div class="section">
        <div class="section-title">Datos del Empleado</div>
        <div class="row">
          <span class="label">Nombre:</span>
          <span class="value">${data.empleadoNombre}</span>
        </div>
        <div class="row">
          <span class="label">Período:</span>
          <span class="value">${MESES_LABELS[data.mes]} ${data.anio}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Detalle de la Liquidación</div>
        <div class="row">
          <span class="label">Sueldo Base:</span>
          <span class="value">$${data.sueldoBase.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        ${data.totalComisiones > 0 ? `
        <div class="row positive">
          <span class="label">Comisiones:</span>
          <span class="value">+$${data.totalComisiones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        ` : ''}
        ${data.totalDescuentos > 0 ? `
        <div class="row negative">
          <span class="label">Descuentos/Adelantos:</span>
          <span class="value">-$${data.totalDescuentos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        ` : ''}
        <div class="row total">
          <span class="label">NETO A PAGAR:</span>
          <span class="value">$${data.netoAPagar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Datos del Pago</div>
        <div class="row">
          <span class="label">Forma de Pago:</span>
          <span class="value">${formaPagoNombre}</span>
        </div>
        <div class="row">
          <span class="label">Fecha:</span>
          <span class="value">${fechaPago}</span>
        </div>
        ${data.observaciones ? `
        <div class="observaciones">
          <strong>Observaciones:</strong> ${data.observaciones}
        </div>
        ` : ''}
      </div>

      <div class="firma-section">
        <div class="firma-box">
          <div class="firma-linea">Firma del Empleador</div>
        </div>
        <div class="firma-box">
          <div class="firma-linea">Firma del Empleado<br><small>Aclaración: ${data.empleadoNombre}</small></div>
        </div>
      </div>

      <div class="footer">
        <p>Este recibo es comprobante de pago válido. Conserve este documento.</p>
        <p>Emitido el ${new Date().toLocaleString('es-AR')}</p>
      </div>

      <div class="no-print" style="text-align: center; margin-top: 30px;">
        <button onclick="window.print()" style="padding: 10px 30px; font-size: 14px; cursor: pointer; background: #333; color: white; border: none; border-radius: 5px;">
          Imprimir Recibo
        </button>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
