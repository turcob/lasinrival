import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LineaDetalle {
  codigo: string;
  descripcion: string;
  unidadMedida?: string;
  cantidad: number;
}

interface DatosDetallePedido {
  numeroPedido: number;
  fecha: Date;
  cliente: {
    nombre: string;
    codigoCliente?: string;
    direccion?: string;
    zona?: string;
  };
  vendedor?: string;
  lineas: LineaDetalle[];
}

export function imprimirDetallePedido(datos: DatosDetallePedido) {
  const ventana = window.open('', '_blank', 'width=800,height=600');
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
    return;
  }

  const fechaFormateada = format(datos.fecha, 'dd/MM/yyyy', { locale: es });

  const filasHTML = datos.lineas.map((l) => `
    <tr>
      <td style="padding:5px 8px; border-bottom:1px solid #d0d0d0; font-family:'Courier New',monospace; font-size:11px; font-weight:700;">${l.codigo}</td>
      <td style="padding:5px 8px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700;">${l.descripcion}</td>
      <td style="padding:5px 8px; border-bottom:1px solid #d0d0d0; text-align:right; font-size:12px; font-weight:800;">${l.cantidad} ${l.unidadMedida || 'UN'}</td>
      <td style="padding:5px 8px; border-bottom:1px solid #d0d0d0; text-align:center; width:35px;"><div style="width:18px;height:18px;border:1.5px solid #333;margin:auto;"></div></td>
    </tr>
  `).join('');

  const totalItems = datos.lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Detalle de Pedido #${datos.numeroPedido}</title>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          font-size: 12px;
          font-weight: 700;
          color: #1a1a1a;
          max-width: 780px;
          margin: 0 auto;
          padding: 8px;
        }
        .container {
          border: 2px solid #222;
          border-radius: 3px;
          overflow: hidden;
        }
        .header {
          display: flex;
          align-items: center;
          border-bottom: 2px solid #222;
          background: #f5f5f5;
          padding: 8px 12px;
        }
        .header-title {
          flex: 1;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .header-numero {
          font-size: 16px;
          font-weight: 800;
          font-family: 'Courier New', monospace;
        }
        .info-bar {
          display: flex;
          gap: 16px;
          padding: 6px 12px;
          border-bottom: 1px solid #ccc;
          font-size: 11px;
          flex-wrap: wrap;
        }
        .info-item label {
          font-size: 10px;
          color: #555;
          text-transform: uppercase;
          font-weight: 800;
        }
        .info-item span {
          font-weight: 800;
          color: #000;
          margin-left: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        thead th {
          background: #222;
          color: #fff;
          padding: 5px 8px;
          text-align: left;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        thead th.right { text-align: right; }
        thead th.center { text-align: center; }
        tr:nth-child(even) td { background: #f7f7f7; }
        .summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 2px solid #222;
          background: #eee;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
        }
        .summary-right {
          font-size: 14px;
          font-family: 'Courier New', monospace;
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-title">DETALLE DE PEDIDO</div>
          <div class="header-numero">N° ${datos.numeroPedido}</div>
        </div>
        <div class="info-bar">
          <div class="info-item"><label>Fecha:</label><span>${fechaFormateada}</span></div>
          <div class="info-item"><label>Cliente:</label><span>${datos.cliente.codigoCliente ? '[' + datos.cliente.codigoCliente + '] ' : ''}${datos.cliente.nombre}</span></div>
          ${datos.cliente.direccion ? `<div class="info-item"><label>Dir:</label><span>${datos.cliente.direccion}</span></div>` : ''}
          ${datos.cliente.zona ? `<div class="info-item"><label>Zona:</label><span>${datos.cliente.zona}</span></div>` : ''}
          ${datos.vendedor ? `<div class="info-item"><label>Vendedor:</label><span>${datos.vendedor}</span></div>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:100px;">Código</th>
              <th>Descripción</th>
              <th class="right" style="width:90px;">Cantidad</th>
              <th class="center" style="width:40px;">✓</th>
            </tr>
          </thead>
          <tbody>
            ${filasHTML}
          </tbody>
        </table>
        <div class="summary">
          <span>TOTAL DE ÍTEMS: ${datos.lineas.length}</span>
          <span class="summary-right">UNIDADES: ${totalItems}</span>
        </div>
      </div>
      <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}
