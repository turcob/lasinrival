import type { ProductoConsolidadoItem } from '@/hooks/useConsolidadoPedidos';
import { getPrintMetaHTML } from './printMeta';

interface ConsolidadoPrintData {
  noPesables: ProductoConsolidadoItem[];
  frios: ProductoConsolidadoItem[];
  pesables: ProductoConsolidadoItem[];
  vendedorNombre?: string;
  zonaNombre?: string;
  totalPedidos: number;
  comercioNombre?: string;
}

function renderSeccion(titulo: string, items: ProductoConsolidadoItem[], esUltima: boolean = false): string {
  if (items.length === 0) return '';
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-family:monospace;font-size:14px;">${i.codigo_articulo}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:14px;">${i.descripcion}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;font-size:14px;">${i.cantidad_total}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:14px;">${i.unidad_medida || '-'}</td>
      </tr>`
    )
    .join('');

  const pageBreak = !esUltima ? 'page-break-after:always;' : '';
  
  return `
    <div style="${pageBreak}">
      <h3 style="margin:16px 0 8px;font-size:16px;border-bottom:2px solid #333;padding-bottom:4px;">${titulo} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:4px 8px;text-align:left;font-size:13px;">Código</th>
            <th style="padding:4px 8px;text-align:left;font-size:13px;">Descripción</th>
            <th style="padding:4px 8px;text-align:right;font-size:13px;">Cantidad</th>
            <th style="padding:4px 8px;text-align:left;font-size:13px;">Unidad</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function imprimirConsolidado(data: ConsolidadoPrintData) {
  const fecha = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const filtros = [
    data.vendedorNombre ? `Vendedor: ${data.vendedorNombre}` : null,
    data.zonaNombre ? `Zona: ${data.zonaNombre}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Consolidado de Pedidos</title>
      <style>
        @media print {
          body { margin: 0; padding: 10mm; }
          .no-print { display: none; }
        }
        body { font-family: Arial, sans-serif; font-size: 14px; color: #111; }
        @page { size: A4; margin: 10mm; }
      </style>
    </head>
    <body>
      <div style="text-align:center;margin-bottom:16px;">
        <h1 style="font-size:20px;margin:0;">${data.comercioNombre || 'Consolidado de Pedidos'}</h1>
        <h2 style="font-size:16px;margin:4px 0;font-weight:normal;">Consolidado de Pedidos</h2>
        <p style="margin:4px 0;font-size:13px;color:#555;">Fecha: ${fecha} | Pedidos: ${data.totalPedidos}</p>
        ${filtros ? `<p style="margin:4px 0;font-size:13px;color:#555;">${filtros}</p>` : ''}
      </div>
      ${renderSeccion('📦 No Pesables', data.noPesables)}
      ${renderSeccion('❄️ Frescos / Fríos', data.frios)}
      ${renderSeccion('⚖️ Pesables (KG)', data.pesables, true)}
      ${getPrintMetaHTML()}
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
