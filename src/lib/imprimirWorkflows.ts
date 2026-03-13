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
        ${step('Confirmación del pedido', 'Estado: PENDIENTE. Se registra vendedor, fecha, zona y condición de venta')}
        ${arrow}
        ${decision('¿Cliente bloqueado?', 'Se verifica el estado del cliente antes de permitir la venta')}
        ${arrow}
        ${note('Cliente bloqueado: no se puede generar pedido', 'Debe regularizar su situación de cuenta corriente')}
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
      <p>Registro de pagos, imputación de facturas y sistema de bloqueo automático</p>
    </div>
    ${legend()}

    <div class="section">
      <div class="section-title">1. Registro de Pago</div>
      <div class="flow">
        ${step('Seleccionar cliente', 'Se busca el cliente en la lista y se accede a su cuenta corriente')}
        ${arrow}
        ${step('Ver saldo y movimientos', 'Se muestra el saldo actual, facturas pendientes y pagos anteriores')}
        ${arrow}
        ${step('Registrar nuevo pago', 'Se indica monto, forma de pago (efectivo, transferencia, cheque, tarjeta) y concepto')}
        ${arrow}
        ${decision('¿Pago con cheque?', 'Si el medio es cheque se registran datos adicionales: banco, número, vencimiento')}
        ${arrow}
        ${success('Pago registrado', 'Se crea movimiento tipo CREDITO (haber) en la cuenta corriente')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">2. Imputación de Pagos</div>
      <div class="flow">
        ${step('Acceder a módulo de Imputación', 'Se listan los pagos pendientes de imputar y las facturas adeudadas')}
        ${arrow}
        ${step('Seleccionar pago y facturas', 'Se vincula un pago con una o más facturas que cancela')}
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
        ${step('Sistema verifica facturas adeudadas', 'Se cuentan las facturas pendientes de pago de cada cliente')}
        ${arrow}
        ${decision('¿Supera el límite configurado?', 'Se compara contra el valor global o el override del cliente')}
        ${arrow}
        ${note('Cliente BLOQUEADO automáticamente', 'No se pueden generar nuevos pedidos hasta regularizar')}
        ${arrow}
        ${step('Regularización', 'El cliente paga las facturas adeudadas')}
        ${arrow}
        ${step('Desbloqueo manual o automático', 'Un administrador puede desbloquear o se desbloquea al imputar pagos')}
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
        ${decision('¿Hay pagos sin imputar?', 'Se identifican pagos que no fueron asociados a facturas')}
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
        ${step('Registrar cobro en parada', 'Se indica monto cobrado y forma de pago: efectivo, transferencia, QR, tarjeta')}
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
        ${step('Iniciar rendición', 'Se totaliza por forma de pago: efectivo, transferencias, QR, tarjeta')}
        ${arrow}
        ${decision('¿Hay diferencias?', 'Se compara lo cobrado vs lo que debía cobrarse')}
        ${arrow}
        ${note('Diferencia detectada', 'Se registra el monto de diferencia y observaciones')}
        ${arrow}
        ${step('Aprobación de rendición', 'Un supervisor revisa y aprueba la rendición')}
        ${arrow}
        ${success('Rendición aprobada', 'Se cierran los movimientos de la hoja de ruta')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">4. Impacto en Stock y Cuenta Corriente</div>
      <div class="flow">
        ${step('Devoluciones reingresan stock', 'Los productos devueltos se suman nuevamente al inventario')}
        ${arrow}
        ${step('Cobros impactan cuenta corriente', 'Los pagos registrados en ruta se reflejan como créditos del cliente')}
        ${arrow}
        ${step('Efectivo ingresa a caja', 'El efectivo cobrado se vincula al cierre de caja del día')}
        ${arrow}
        ${decision('¿Todo conciliado?', 'Se verifica que no haya diferencias sin resolver')}
        ${arrow}
        ${success('Proceso logístico completo', 'Hoja de ruta cerrada y conciliada')}
      </div>
    </div>

    <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-AR')} — Sistema de Gestión Comercial</div>
  </body></html>`;
  openPrintWindow(html);
}
