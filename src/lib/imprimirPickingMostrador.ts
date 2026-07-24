/**
 * Imprime un ticket de picking para preparación de un pedido de mostrador.
 * Sin precios ni totales. Con espacio manuscrito para cantidad real y precio
 * en items pesables.
 */
export interface PickingItem {
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  unidad_medida?: string | null;
  es_temporal?: boolean;
}

export interface PickingPedido {
  numero: string; // ej. "P-a1b2c3" o "#123"
  fecha: Date;
  cliente?: string | null;
  operador?: string | null;
  items: PickingItem[];
}

function esPeso(unidad?: string | null) {
  if (!unidad) return false;
  const u = unidad.toLowerCase().trim();
  return u === 'kg' || u === 'kilo' || u === 'kilos' || u === 'kilogramo' || u === 'kilogramos';
}

export function imprimirPickingMostrador(pedido: PickingPedido) {
  const w = window.open('', '_blank');
  if (!w) return;

  const rows = pedido.items
    .map((it) => {
      const pesable = esPeso(it.unidad_medida);
      const unidad = it.unidad_medida || 'u';
      const cant = Number(it.cantidad).toLocaleString('es-AR', {
        minimumFractionDigits: pesable ? 3 : 0,
        maximumFractionDigits: 3,
      });
      const codigo = it.codigo || (it.es_temporal ? 'TEMP' : '—');
      return `
        <tr>
          <td class="check">☐</td>
          <td class="cod">${escapeHtml(codigo)}</td>
          <td class="desc">${escapeHtml(it.descripcion)}</td>
          <td class="cant">${cant} ${escapeHtml(unidad)}</td>
          <td class="real">${pesable ? '____ kg' : '____ u'}</td>
          <td class="precio">${pesable ? '$ __________' : '—'}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Picking ${escapeHtml(pedido.numero)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 3mm; color: #000; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 4px; letter-spacing: 1px; }
  .meta { text-align: center; margin-bottom: 6px; font-size: 11px; }
  .meta p { margin: 1px 0; }
  .cliente { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { text-align: left; padding: 3px 2px; vertical-align: top; }
  thead th { border-bottom: 1px solid #000; font-size: 10px; text-transform: uppercase; }
  tbody tr { border-bottom: 1px dotted #999; }
  td.check { font-size: 14px; width: 6mm; }
  td.cod { font-size: 10px; color: #333; width: 12mm; }
  td.desc { word-break: break-word; }
  td.cant { white-space: nowrap; text-align: right; }
  td.real { white-space: nowrap; font-size: 10px; }
  td.precio { white-space: nowrap; font-size: 10px; }
  .firma { margin-top: 12px; font-size: 10px; }
  .firma .line { border-top: 1px solid #000; margin-top: 20px; padding-top: 2px; text-align: center; }
  .aviso { margin-top: 8px; text-align: center; font-weight: bold; font-size: 11px; letter-spacing: 1px; }
  @media print { body { margin: 0; } html, body { width: 80mm; } }
</style></head>
<body>
  <h1>PICKING</h1>
  <div class="meta">
    <p><strong>${escapeHtml(pedido.numero)}</strong></p>
    <p>${pedido.fecha.toLocaleString('es-AR')}</p>
    ${pedido.operador ? `<p>Operador: ${escapeHtml(pedido.operador)}</p>` : ''}
  </div>
  <div class="cliente">
    <strong>Cliente:</strong> ${escapeHtml(pedido.cliente || 'Consumidor Final')}
  </div>
  <table>
    <thead>
      <tr><th></th><th>Cód.</th><th>Descripción</th><th>Cant.</th><th>Real</th><th>Precio</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="aviso">*** PREPARACIÓN ***</div>
  <div class="firma">
    <div class="line">Firma preparador</div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},250);};</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
