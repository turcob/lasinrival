const baseStyles = `
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
    .header h1 { font-size: 22px; color: #1e40af; margin-bottom: 4px; }
    .header p { font-size: 12px; color: #64748b; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-title { font-size: 15px; font-weight: 700; color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 4px; margin-bottom: 12px; }
    .flow { display: flex; flex-direction: column; gap: 0; align-items: center; }
    .step { background: #f0f9ff; border: 1.5px solid #93c5fd; border-radius: 8px; padding: 10px 16px; width: 90%; text-align: center; }
    .step-title { font-weight: 700; font-size: 13px; color: #1e40af; }
    .step-desc { font-size: 11px; color: #475569; margin-top: 2px; }
    .arrow { text-align: center; font-size: 20px; color: #3b82f6; line-height: 1; padding: 2px 0; }
    .decision { background: #fef9c3; border: 1.5px solid #facc15; border-radius: 8px; padding: 10px 16px; width: 90%; text-align: center; }
    .decision .step-title { color: #854d0e; }
    .decision .step-desc { color: #713f12; }
    .note { background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 8px; padding: 10px 16px; width: 90%; text-align: center; }
    .note .step-title { color: #991b1b; }
    .note .step-desc { color: #7f1d1d; }
    .success { background: #f0fdf4; border: 1.5px solid #86efac; }
    .success .step-title { color: #166534; }
    .legend { display: flex; gap: 16px; justify-content: center; margin-bottom: 16px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; }
    .legend-box { width: 16px; height: 16px; border-radius: 4px; border: 1px solid; }
    .footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
`;

function step(title: string, desc?: string) {
  return `<div class="step"><div class="step-title">${title}</div>${desc ? `<div class="step-desc">${desc}</div>` : ''}</div>`;
}
function decision(title: string, desc?: string) {
  return `<div class="decision"><div class="step-title">⟐ ${title}</div>${desc ? `<div class="step-desc">${desc}</div>` : ''}</div>`;
}
function note(title: string, desc?: string) {
  return `<div class="note"><div class="step-title">${title}</div>${desc ? `<div class="step-desc">${desc}</div>` : ''}</div>`;
}
function success(title: string, desc?: string) {
  return `<div class="step success"><div class="step-title">${title}</div>${desc ? `<div class="step-desc">${desc}</div>` : ''}</div>`;
}
const arrow = '<div class="arrow">↓</div>';

function openPrintWindow(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function legend() {
  return `
    <div class="legend">
      <div class="legend-item"><div class="legend-box" style="background:#f0f9ff;border-color:#93c5fd;"></div> Paso / Acción</div>
      <div class="legend-item"><div class="legend-box" style="background:#fef9c3;border-color:#facc15;"></div> Decisión / Condición</div>
      <div class="legend-item"><div class="legend-box" style="background:#f0fdf4;border-color:#86efac;"></div> Resultado exitoso</div>
      <div class="legend-item"><div class="legend-box" style="background:#fef2f2;border-color:#fca5a5;"></div> Alerta / Importante</div>
    </div>
  `;
}

export function imprimirWorkflowVentas() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Workflow - Venta a Clientes</title>${baseStyles}</head><body>
    <div class="header">
      <h1>Workflow: Venta a Clientes por Vendedores</h1>
      <p>Proceso completo desde la carga del pedido hasta la entrega y ajuste de cuenta corriente</p>
    </div>
    ${legend()}

    <div class="section">
      <div class="section-title">1. Carga del Pedido</div>
      <div class="flow">
        ${step('Vendedor crea nuevo pedido', 'Selecciona cliente, agrega productos con cantidades y precios')}
        ${arrow}
        ${decision('¿Pedido duplicado?', 'El sistema detecta si ya existe un pedido similar del mismo día para el cliente')}
        ${arrow}
        ${decision('¿Cliente bloqueado?', 'Se verifica si el cliente está bloqueado por facturas adeudadas o monto de deuda')}
        ${arrow}
        ${note('Cliente bloqueado: no se puede generar pedido', 'Debe regularizar su situación de cuenta corriente (facturas o monto adeudado)')}
        ${arrow}
        ${step('Confirmación del pedido', 'Estado: PENDIENTE. Se registra vendedor, fecha, zona y condición de venta')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">2. Preparación del Pedido</div>
      <div class="flow">
        ${step('Pedido pasa a estado PREPARANDO', 'El preparador abre el pedido y comienza a armar')}
        ${arrow}
        ${step('Ajuste de cantidades preparadas', 'Se indica la cantidad real preparada por producto (puede diferir de la pedida)')}
        ${arrow}
        ${decision('¿Hay faltantes?', 'Si algún producto no tiene stock suficiente se ajusta la cantidad')}
        ${arrow}
        ${step('Impresión de remito', 'Se genera el remito con las cantidades efectivamente preparadas')}
        ${arrow}
        ${success('Pedido preparado', 'Estado: PREPARADO. Listo para despacho')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">3. Despacho y Hoja de Ruta</div>
      <div class="flow">
        ${step('Crear Hoja de Ruta', 'Se asigna vehículo, chofer y se agregan los pedidos preparados como paradas')}
        ${arrow}
        ${step('Generar Hoja de Carga', 'Consolidado de todos los productos a cargar en el vehículo')}
        ${arrow}
        ${step('Iniciar recorrido', 'Se registra km inicial y hora de salida')}
        ${arrow}
        ${success('Hoja de ruta en tránsito', 'Estado: EN_TRANSITO')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">4. Entrega y Ajustes</div>
      <div class="flow">
        ${step('Llegar a parada del cliente', 'Se registra hora de llegada')}
        ${arrow}
        ${decision('¿Entrega completa?', 'El cliente puede rechazar productos parcial o totalmente')}
        ${arrow}
        ${step('Registrar devoluciones', 'Se indica motivo: producto dañado, no solicitado, vencido, etc.')}
        ${arrow}
        ${step('Registrar cobro', 'Se registra el pago: efectivo, transferencia, cheque, QR')}
        ${arrow}
        ${success('Parada completada', 'Se marca como entregada y se registra hora de salida')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">5. Impacto en Cuenta Corriente</div>
      <div class="flow">
        ${step('Generación automática de factura', 'Se genera comprobante AFIP (si está configurado) con el monto entregado')}
        ${arrow}
        ${step('Movimiento DEBITO en cuenta corriente', 'Se registra la factura como deuda del cliente')}
        ${arrow}
        ${decision('¿Hay devoluciones?', 'Si hubo productos devueltos se ajusta el monto')}
        ${arrow}
        ${step('Nota de crédito / ajuste', 'Se genera movimiento de ajuste por los productos devueltos')}
      </div>
    </div>

    <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-AR')} — Sistema de Gestión Comercial</div>
  </body></html>`;
  openPrintWindow(html);
}

export function imprimirWorkflowCobros() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Workflow - Cobros y Cuenta Corriente</title>${baseStyles}</head><body>
    <div class="header">
      <h1>Workflow: Cobros y Cuenta Corriente</h1>
      <p>Registro de pagos diferenciado por medio de pago, imputación y sistema de bloqueo automático</p>
    </div>
    ${legend()}

    <div class="section">
      <div class="section-title">1. Registro de Pago en Ruta</div>
      <div class="flow">
        ${step('Chofer registra cobro en parada', 'Se indica monto cobrado y forma de pago: efectivo, transferencia, cheque, QR')}
        ${arrow}
        ${decision('¿Qué medio de pago?', 'El flujo de imputación depende del medio de pago utilizado')}
        ${arrow}
        ${note('IMPORTANTE: Flujo diferenciado por medio de pago', 'Efectivo → se imputa con la rendición. Transferencias y cheques → se imputan desde el módulo Imputación')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">2A. Flujo Efectivo → Rendición</div>
      <div class="flow">
        ${step('Efectivo cobrado en ruta', 'El chofer recauda el efectivo durante las entregas')}
        ${arrow}
        ${step('Rendición de la hoja de ruta', 'Al finalizar el recorrido, el chofer rinde el dinero recaudado')}
        ${arrow}
        ${decision('¿Rendición aprobada?', 'Un supervisor revisa montos y aprueba la rendición')}
        ${arrow}
        ${success('Efectivo imputado automáticamente', 'Al aprobarse la rendición, los cobros en efectivo se imputan a las facturas correspondientes')}
        ${arrow}
        ${step('Efectivo ingresa a caja', 'El dinero rendido se vincula al cierre de caja del día')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">2B. Flujo Transferencias y Cheques → Imputación Manual</div>
      <div class="flow">
        ${step('Transferencia o cheque registrado', 'Se registra el pago con estado "pendiente de imputación"')}
        ${arrow}
        ${step('Acceder al módulo Imputación', 'Se listan los pagos pendientes de imputar y las facturas adeudadas del cliente')}
        ${arrow}
        ${step('Seleccionar pago y facturas', 'Se vincula el pago (transferencia o cheque) con una o más facturas que cancela')}
        ${arrow}
        ${decision('¿Pago cubre toda la factura?', 'Si el pago es parcial, la factura queda con saldo pendiente')}
        ${arrow}
        ${step('Imputación parcial o total', 'Se registra el monto imputado a cada factura')}
        ${arrow}
        ${success('Imputación confirmada', 'Las facturas quedan marcadas como pagadas (total o parcialmente)')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">3. Bloqueo Automático de Clientes</div>
      <div class="flow">
        ${step('Sistema verifica criterios de bloqueo', 'Se evalúan dos criterios independientes para cada cliente')}
        ${arrow}
        ${decision('¿Supera facturas adeudadas?', 'Se compara cantidad de facturas impagas contra el límite configurado (global o particular del cliente)')}
        ${arrow}
        ${decision('¿Supera monto adeudado?', 'Se compara el saldo deudor total contra el monto máximo permitido (global o particular del cliente)')}
        ${arrow}
        ${note('Cliente BLOQUEADO automáticamente', 'Se activa si se cumple CUALQUIERA de los dos criterios. No se pueden generar nuevos pedidos')}
        ${arrow}
        ${step('Regularización', 'El cliente paga las facturas adeudadas o reduce su saldo por debajo del límite')}
        ${arrow}
        ${step('Desbloqueo automático', 'Al imputar pagos y quedar dentro de los límites, el sistema desbloquea al cliente')}
        ${arrow}
        ${success('Cliente habilitado', 'Puede volver a recibir pedidos')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">4. Seguimiento de Cuenta Corriente</div>
      <div class="flow">
        ${step('Consulta de estado de cuenta', 'Se puede ver el detalle completo de movimientos del cliente')}
        ${arrow}
        ${step('Filtros por fecha y tipo', 'Facturas, pagos, notas de crédito, ajustes')}
        ${arrow}
        ${step('Exportación', 'Se puede imprimir o exportar el estado de cuenta')}
        ${arrow}
        ${decision('¿Hay pagos sin imputar?', 'Se identifican pagos (transferencias/cheques) que no fueron asociados a facturas')}
        ${arrow}
        ${note('Pagos pendientes de imputación', 'Requieren asociación manual desde el módulo de Imputación')}
      </div>
    </div>

    <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-AR')} — Sistema de Gestión Comercial</div>
  </body></html>`;
  openPrintWindow(html);
}

export function imprimirWorkflowLogistica() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Workflow - Rendición Logística</title>${baseStyles}</head><body>
    <div class="header">
      <h1>Workflow: Rendición Logística</h1>
      <p>Gestión de hojas de ruta, cobros en ruta, devoluciones y rendición final</p>
    </div>
    ${legend()}

    <div class="section">
      <div class="section-title">1. Creación de Hoja de Ruta</div>
      <div class="flow">
        ${step('Seleccionar pedidos preparados', 'Se eligen los pedidos listos para despacho')}
        ${arrow}
        ${step('Asignar vehículo y chofer', 'Se selecciona el vehículo disponible y el chofer asignado')}
        ${arrow}
        ${step('Ordenar paradas', 'Se define el orden de entrega de los pedidos')}
        ${arrow}
        ${step('Generar hoja de carga', 'Consolidado de productos a cargar, agrupados por categoría')}
        ${arrow}
        ${success('Hoja de ruta creada', 'Estado: PLANIFICADA')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">2. Ejecución del Recorrido</div>
      <div class="flow">
        ${step('Iniciar recorrido', 'Se registra km inicial, hora de salida real')}
        ${arrow}
        ${step('Llegar a cada parada', 'Se registra hora de llegada por cliente')}
        ${arrow}
        ${decision('¿Entrega exitosa?', 'El cliente puede aceptar, rechazar parcial o totalmente')}
        ${arrow}
        ${step('Registrar cobro en parada', 'Se indica monto cobrado y forma de pago: efectivo, transferencia, QR, cheque')}
        ${arrow}
        ${step('Registrar devoluciones', 'Productos rechazados con motivo: dañado, vencido, no solicitado, sobrante')}
        ${arrow}
        ${step('Completar parada', 'Se registra hora de salida y se pasa a la siguiente')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">3. Rendición de la Hoja de Ruta</div>
      <div class="flow">
        ${step('Finalizar recorrido', 'Se registra km final, hora de regreso')}
        ${arrow}
        ${step('Iniciar rendición', 'Se totaliza por forma de pago: efectivo, transferencias, QR, cheque')}
        ${arrow}
        ${decision('¿Hay diferencias en efectivo?', 'Se compara el efectivo recaudado vs lo que debía cobrarse en efectivo')}
        ${arrow}
        ${note('Diferencia detectada', 'Se registra el monto de diferencia y observaciones')}
        ${arrow}
        ${step('Aprobación de rendición', 'Un supervisor revisa y aprueba la rendición')}
        ${arrow}
        ${success('Rendición aprobada', 'El efectivo se imputa a las facturas correspondientes de los clientes')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">4. Impacto en Stock, Cta. Cte. y Caja</div>
      <div class="flow">
        ${step('Devoluciones reingresan stock', 'Los productos devueltos se suman nuevamente al inventario')}
        ${arrow}
        ${step('Efectivo: imputado con la rendición', 'Los cobros en efectivo se imputan automáticamente al aprobarse la rendición')}
        ${arrow}
        ${step('Transferencias y cheques: módulo Imputación', 'Los cobros por transferencia o cheque quedan pendientes para imputación manual')}
        ${arrow}
        ${step('Efectivo ingresa a caja', 'El efectivo cobrado se vincula al cierre de caja del día')}
        ${arrow}
        ${decision('¿Todo conciliado?', 'Se verifica que no haya diferencias sin resolver ni pagos sin imputar')}
        ${arrow}
        ${success('Proceso logístico completo', 'Hoja de ruta cerrada y conciliada')}
      </div>
    </div>

    <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-AR')} — Sistema de Gestión Comercial</div>
  </body></html>`;
  openPrintWindow(html);
}

export function imprimirDevolucionesHojaRuta(hojaRuta: any, devoluciones: any[]) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Devoluciones - HR #${hojaRuta.numero_hoja}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 12px; }
    .header { text-align: center; border-bottom: 3px solid #d97706; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 20px; font-weight: 800; color: #92400e; }
    .header p { font-size: 11px; color: #78716c; margin-top: 4px; }
    .info-bar { display: flex; gap: 24px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 10px 16px; margin-bottom: 16px; font-size: 12px; font-weight: 600; }
    .info-bar span { color: #78716c; font-weight: 400; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f59e0b; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #fffbeb; }
    .motivo { color: #92400e; font-weight: 600; }
    .detalle { color: #78716c; font-style: italic; }
    .total-row { background: #fef3c7 !important; font-weight: 700; }
    .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
    .firma-section { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px; }
    .firma-box { text-align: center; width: 200px; }
    .firma-line { border-top: 1px solid #1a1a1a; margin-bottom: 4px; }
    .firma-label { font-size: 10px; color: #6b7280; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>
    <div class="header">
      <h1>DEVOLUCIONES — Hoja de Ruta #${hojaRuta.numero_hoja}</h1>
      <p>Fecha: ${new Date(hojaRuta.fecha).toLocaleDateString('es-AR')} | Chofer: ${hojaRuta.chofer?.nombre || '-'} | Vehículo: ${hojaRuta.vehiculo?.patente || '-'}</p>
    </div>

    <div class="info-bar">
      <div>Total ítems: <span>${devoluciones.length}</span></div>
      <div>Total unidades: <span>${devoluciones.reduce((s: number, d: any) => s + (d.cantidad || 0), 0)}</span></div>
      <div>Importe total: <span>$${devoluciones.reduce((s: number, d: any) => {
        const precio = d.pedido_detalle?.precio_unitario || 0;
        const desc = d.pedido_detalle?.descuento_porcentaje || 0;
        return s + (Number(d.cantidad) || 0) * precio * (1 - desc / 100);
      }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>P. Unit.</th>
          <th>Importe</th>
          <th>Motivo</th>
          <th>Detalle</th>
          <th>Fecha/Hora</th>
        </tr>
      </thead>
      <tbody>
        ${devoluciones.map((d: any, i: number) => {
          const precio = d.pedido_detalle?.precio_unitario || 0;
          const desc = d.pedido_detalle?.descuento_porcentaje || 0;
          const precioNeto = precio * (1 - desc / 100);
          const importe = (Number(d.cantidad) || 0) * precioNeto;
          return `
          <tr>
            <td>${i + 1}</td>
            <td>${d.pedido_detalle?.producto?.descripcion || 'Producto'}</td>
            <td style="text-align:center;font-weight:700;">${d.cantidad}</td>
            <td style="text-align:right;">$${precioNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td style="text-align:right;font-weight:700;">$${importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td class="motivo">${(d.motivo || 'Sin motivo').replace(/_/g, ' ')}</td>
            <td class="detalle">${d.detalle_motivo || '-'}</td>
            <td>${new Date(d.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
          </tr>`;
        }).join('')}
        <tr class="total-row">
          <td colspan="2" style="text-align:right;">TOTAL</td>
          <td style="text-align:center;">${devoluciones.reduce((s: number, d: any) => s + (d.cantidad || 0), 0)}</td>
          <td></td>
          <td style="text-align:right;">$${devoluciones.reduce((s: number, d: any) => {
            const precio = d.pedido_detalle?.precio_unitario || 0;
            const desc = d.pedido_detalle?.descuento_porcentaje || 0;
            return s + (Number(d.cantidad) || 0) * precio * (1 - desc / 100);
          }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          <td colspan="3"></td>
        </tr>
      </tbody>
    </table>

    <div class="firma-section">
      <div class="firma-box"><div class="firma-line"></div><div class="firma-label">Chofer</div></div>
      <div class="firma-box"><div class="firma-line"></div><div class="firma-label">Responsable</div></div>
    </div>

    <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-AR')} — Sistema de Gestión Comercial</div>
  </body></html>`;
  openPrintWindow(html);
}
