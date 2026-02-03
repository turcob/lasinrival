import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LineaRemito {
  codigo: string;
  descripcion: string;
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
    direccion: string;
    cuit: string;
  };
  lineas: LineaRemito[];
  total: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

export function imprimirRemito(datos: DatosRemito) {
  const ventana = window.open('', '_blank', 'width=800,height=600');
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
    return;
  }

  const numeroRemito = datos.numeroPedido.toString().padStart(6, '0');
  const fechaFormateada = format(datos.fecha, "dd 'de' MMMM 'de' yyyy", { locale: es });

  const lineasHTML = datos.lineas.map(linea => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${linea.codigo}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${linea.descripcion}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${linea.cantidad}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(linea.precioUnitario)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${linea.descuento > 0 ? linea.descuento + '%' : '-'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${formatCurrency(linea.subtotal)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Remito #${numeroRemito}</title>
      <style>
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none !important; }
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .logo-section h1 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        .logo-section p {
          margin: 5px 0 0;
          color: #666;
        }
        .remito-info {
          text-align: right;
        }
        .remito-info h2 {
          margin: 0;
          font-size: 18px;
          color: #d32f2f;
        }
        .remito-info p {
          margin: 5px 0 0;
        }
        .cliente-section {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .cliente-section h3 {
          margin: 0 0 10px;
          font-size: 14px;
          color: #666;
        }
        .cliente-section p {
          margin: 3px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #333;
          color: white;
          padding: 10px 8px;
          text-align: left;
          font-weight: 500;
        }
        th:nth-child(3), th:nth-child(5) { text-align: center; }
        th:nth-child(4), th:nth-child(6) { text-align: right; }
        .total-section {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .total-box {
          background: #333;
          color: white;
          padding: 15px 25px;
          border-radius: 4px;
        }
        .total-box span {
          font-size: 14px;
        }
        .total-box strong {
          font-size: 20px;
          margin-left: 15px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
        }
        .firma {
          width: 200px;
          text-align: center;
        }
        .firma-linea {
          border-top: 1px solid #333;
          margin-top: 60px;
          padding-top: 5px;
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
        .print-button:hover {
          background: #1565c0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          <h1>REMITO</h1>
          <p>Documento no válido como factura</p>
        </div>
        <div class="remito-info">
          <h2>R #${numeroRemito}</h2>
          <p><strong>Fecha:</strong> ${fechaFormateada}</p>
        </div>
      </div>

      <div class="cliente-section">
        <h3>DATOS DEL CLIENTE</h3>
        <p><strong>Razón Social:</strong> ${datos.cliente.nombre}</p>
        ${datos.cliente.cuit ? `<p><strong>CUIT/DNI:</strong> ${datos.cliente.cuit}</p>` : ''}
        ${datos.cliente.direccion ? `<p><strong>Dirección:</strong> ${datos.cliente.direccion}</p>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 100px;">Código</th>
            <th>Descripción</th>
            <th style="width: 80px;">Cant.</th>
            <th style="width: 100px;">P. Unit.</th>
            <th style="width: 60px;">Dto.</th>
            <th style="width: 100px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${lineasHTML}
        </tbody>
      </table>

      <div class="total-section">
        <div class="total-box">
          <span>TOTAL:</span>
          <strong>${formatCurrency(datos.total)}</strong>
        </div>
      </div>

      <div class="footer">
        <div class="firma">
          <div class="firma-linea">Firma del Cliente</div>
        </div>
        <div class="firma">
          <div class="firma-linea">Aclaración</div>
        </div>
        <div class="firma">
          <div class="firma-linea">DNI</div>
        </div>
      </div>

      <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir Remito</button>
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}
