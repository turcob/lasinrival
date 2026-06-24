import { toast } from 'sonner';

const CONDICIONES_IVA_MAP: { [key: number]: string } = {
  1: 'IVA Resp. Inscripto',
  4: 'Exento',
  5: 'Consumidor Final',
  6: 'Monotributista',
};

function formatCuit(cuit: string) {
  if (!cuit) return '';
  const clean = cuit.replace(/\D/g, '');
  if (clean.length === 11) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
  }
  return cuit;
}

export interface TicketComercio {
  nombre_fantasia?: string | null;
  razon_social?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  cuit?: string | null;
  condicion_iva?: string | null;
  telefono?: string | null;
}

export interface TicketDetalleItem {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
  descuento_porcentaje?: number;
}

export interface TicketFacturaData {
  tipo_comprobante: number; // 1 A, 6 B, 11 C
  punto_venta: number;
  numero_comprobante: number;
  cae: string;
  cae_vencimiento: string;
  importe_total: number;
  importe_neto: number;
  importe_iva: number;
  doc_nro?: string | number | null;
}

export interface TicketCliente {
  nombre?: string | null;
  dni_cuit?: string | null;
  condicion_iva?: number | null;
}

export interface TicketEmpleado {
  nombre: string;
  dni?: string | null;
}

export interface ImprimirTicketArgs {
  comercio: TicketComercio | null;
  fecha: string | Date;
  total: number;
  descuento?: number;
  numero_comprobante?: number | string | null;
  detalles: TicketDetalleItem[];
  cliente?: TicketCliente | null;
  empleado?: TicketEmpleado | null;
  factura?: TicketFacturaData | null;
}

export function imprimirTicketFactura(args: ImprimirTicketArgs) {
  const { comercio, fecha, total, descuento = 0, numero_comprobante, detalles, cliente, empleado, factura } = args;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('No se pudo abrir la ventana de impresión');
    return;
  }

  let detallesHtml = '';
  detalles.forEach((item) => {
    detallesHtml += `
      <div class="item">
        <span class="item-name">${item.nombre}</span>
        <div class="item-details">
          <span>${item.cantidad} x $${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          <span>$${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        ${item.descuento_porcentaje && item.descuento_porcentaje > 0 ? `<div class="item-discount">Desc: ${item.descuento_porcentaje}%</div>` : ''}
      </div>
    `;
  });

  let html = '';

  if (factura) {
    const tipoLetra = factura.tipo_comprobante === 1 ? 'A' : factura.tipo_comprobante === 6 ? 'B' : 'C';
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Factura ${tipoLetra} ${String(factura.punto_venta).padStart(4, '0')}-${String(factura.numero_comprobante).padStart(8, '0')}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 16px;
            line-height: 1.3;
            width: 72mm;
            margin: 0 auto;
            padding: 2mm;
          }
          .header { text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
          .header h2 { margin: 0 0 4px 0; font-size: 18px; }
          .header p { margin: 1px 0; font-size: 14px; }
          .tipo-box { border: 1px solid #000; display: inline-block; padding: 4px 12px; margin: 4px 0; font-size: 20px; font-weight: bold; }
          .section { border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 4px; font-size: 14px; }
          .item { margin: 4px 0; padding-bottom: 4px; }
          .item-name { display: block; word-wrap: break-word; font-weight: bold; }
          .item-details { display: flex; justify-content: space-between; font-size: 14px; }
          .item-discount { text-align: right; font-size: 12px; }
          .totals { text-align: right; font-size: 16px; margin-top: 4px; }
          .total { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
          .footer { text-align: center; margin-top: 8px; font-size: 12px; }
          .cae { font-weight: bold; }
          @media print { body { margin: 0; } html, body { width: 80mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${comercio?.nombre_fantasia || comercio?.razon_social || 'EMPRESA'}</h2>
          <p>${comercio?.razon_social || ''}</p>
          <p>${comercio?.direccion || ''}</p>
          ${comercio?.localidad ? `<p>${comercio.localidad}${comercio.provincia ? `, ${comercio.provincia}` : ''}</p>` : ''}
          <p>CUIT: ${formatCuit(comercio?.cuit || '')}</p>
          <p>${comercio?.condicion_iva || 'IVA Resp. Inscripto'}</p>
          <div class="tipo-box">${tipoLetra}</div>
          <p style="font-weight: bold; font-size: 11px;">FACTURA ${tipoLetra}</p>
          <p style="font-weight: bold;">Nº ${String(factura.punto_venta).padStart(4, '0')}-${String(factura.numero_comprobante).padStart(8, '0')}</p>
          <p>Fecha: ${new Date(fecha).toLocaleString('es-AR')}</p>
        </div>
        <div class="section">
          ${empleado ? `
            <p><strong>Empleado:</strong> ${empleado.nombre}</p>
            ${empleado.dni ? `<p><strong>DNI:</strong> ${empleado.dni}</p>` : ''}
            <p style="font-size: 8px;">(Cuenta Corriente)</p>
          ` : `
            <p><strong>Cliente:</strong> ${cliente?.nombre || 'Consumidor Final'}</p>
            <p><strong>CUIT/DNI:</strong> ${cliente?.dni_cuit || factura.doc_nro || 'Sin identificar'}</p>
            <p><strong>IVA:</strong> ${cliente?.condicion_iva ? (CONDICIONES_IVA_MAP[cliente.condicion_iva] || 'Cons. Final') : 'Cons. Final'}</p>
          `}
          <p><strong>Cond. Venta:</strong> ${empleado ? 'Cuenta Corriente' : 'Contado'}</p>
        </div>
        <div class="section">
          <p style="font-weight: bold; text-align: center;">DETALLE</p>
          ${detallesHtml}
        </div>
        <div class="totals">
          <p>Neto Gravado: $${(factura.importe_neto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          <p>IVA 21%: $${(factura.importe_iva || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          <p class="total">TOTAL: $${(factura.importe_total || total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div class="footer">
          <p class="cae">CAE: ${factura.cae}</p>
          <p>Vto. CAE: ${factura.cae_vencimiento}</p>
          <p style="margin-top: 4px;">Comprobante Autorizado - AFIP</p>
          <p>www.afip.gob.ar/fe/qr/</p>
          <p style="margin-top: 8px;">¡Gracias por su compra!</p>
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},300);};</script>
      </body>
      </html>
    `;
  } else {
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket #${numero_comprobante || ''}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 16px;
            line-height: 1.3;
            width: 72mm;
            margin: 0 auto;
            padding: 2mm;
          }
          .header { text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
          .header h2 { margin: 0 0 4px 0; font-size: 18px; }
          .header p { margin: 1px 0; font-size: 14px; }
          .section { border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 4px; font-size: 14px; }
          .item { margin: 4px 0; padding-bottom: 4px; }
          .item-name { display: block; word-wrap: break-word; }
          .item-details { display: flex; justify-content: space-between; font-size: 14px; }
          .item-discount { text-align: right; font-size: 12px; }
          .total { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; text-align: center; }
          .footer { text-align: center; margin-top: 8px; font-size: 14px; }
          @media print { body { margin: 0; } html, body { width: 80mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${comercio?.nombre_fantasia || comercio?.razon_social || 'TICKET'}</h2>
          ${comercio?.direccion ? `<p>${comercio.direccion}</p>` : ''}
          ${comercio?.telefono ? `<p>Tel: ${comercio.telefono}</p>` : ''}
          <p style="font-weight: bold; font-size: 11px;">TICKET #${numero_comprobante || ''}</p>
          <p>${new Date(fecha).toLocaleString('es-AR')}</p>
        </div>
        <div class="section">
          ${empleado ? `
            <p><strong>Empleado:</strong> ${empleado.nombre}</p>
            ${empleado.dni ? `<p><strong>DNI:</strong> ${empleado.dni}</p>` : ''}
            <p style="font-size: 8px;">(Cuenta Corriente)</p>
          ` : `
            <p><strong>Cliente:</strong> ${cliente?.nombre || 'Consumidor Final'}</p>
          `}
        </div>
        <div class="section">
          ${detallesHtml}
        </div>
        ${descuento > 0 ? `<p style="text-align: right; font-size: 9px;">Descuento: -$${descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>` : ''}
        <div class="total">
          TOTAL: $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </div>
        <div class="footer">
          <p>¡Gracias por su compra!</p>
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},300);};</script>
      </body>
      </html>
    `;
  }

  printWindow.document.write(html);
  printWindow.document.close();
}