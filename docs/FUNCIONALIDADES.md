# Inventario de funcionalidades del sistema

Documento de referencia para comparar contra la lista de tareas pendientes y detectar gaps, duplicados y ajustes. Refleja lo que **hoy** hace el sistema (no lo planificado).

> Convenciones: cada módulo lista **Qué hace**, **Pantallas/Componentes**, **Datos** (tablas/RPC/edge functions), **Reglas de negocio** y **Roles/permisos**. Al final hay un **checklist plano** con una línea por feature.

---

## 1. Autenticación y sesión

**Qué hace**
- Login por email + contraseña. No hay auto-registro público.
- Carga en paralelo `profiles` + `user_roles` al iniciar sesión.
- Guarda el nombre del usuario para metadatos de impresión.
- Ruteo protegido: cada ruta pasa por `ProtectedRoute` en `App.tsx`.
- Redirect configurable por query `?redirect=` (aislamiento PWA descuentos).
- Branding del login (`nombre_sistema`, `texto_login_footer`) cargado desde `configuracion_comercio`.

**Pantallas/Componentes**: `src/pages/Auth.tsx`, `src/contexts/AuthContext.tsx`, `ProtectedRoute` en `App.tsx`.

**Datos**: `auth.users`, `profiles`, `user_roles`, `roles`, `role_permissions`, RPC `has_permission`.

**Reglas**
- Roles en tabla separada (`user_roles`) — nunca en `profiles`.
- Checks de rol vía SECURITY DEFINER `has_role(user, role)`.
- Chequeo de permisos vía RPC `has_permission(_user_id, _modulo, _permiso)`.

**Roles**: cualquier usuario autenticado con `profile.estado = true`.

---

## 2. POS — Punto de Venta

**Qué hace**
- Búsqueda de productos por nombre/código, modal de cantidad con soporte pesables (KG con decimales).
- Carrito con edición de precio unitario y descuento por ítem.
- Selección de lista de precios (aplica porcentaje o excepción por producto).
- Selección de cliente (opcional) — activa modo Cuenta Corriente.
- Descuentos: manuales dentro del límite del rol + solicitud de descuento excedido vía PWA con token 6 chars.
- Cobro múltiple en una misma venta:
  - Efectivo
  - Tarjeta con `tarjeta_id` + `coeficiente` de cuotas → **recargo trasladado al cliente** (sube el Total a cobrar).
  - Transferencia (con `numero_operacion` + extractor AI opcional).
  - Cheque (alta en mismo flujo → estado inicial `pendiente_validacion` o `cartera`).
  - Clover (matching por `numero_terminal_clover`).
  - QR.
  - Cuenta Corriente (sin `venta_pagos`, crea `cliente_movimientos` tipo `compra`).
  - "Usar pendiente" del cliente (aplica saldo a favor / NC).
- Ventas a empleados: opción CC empleado o cobro directo.
- Facturación AFIP A/B/C según condición IVA del cliente y punto de venta configurado.
- Impresión de ticket térmico 80mm (con QR AFIP si hay factura).
- Persistencia atómica vía RPC `pos_registrar_venta` (ventas, detalles, pagos, stock, movs. caja, cheques/transferencias).

**Pantallas/Componentes**: `src/pages/POS.tsx`, `ProductSearchModal`, `ProductQuantityModal`, `SolicitarDescuentoModal`.

**Datos**: `ventas`, `venta_detalles`, `venta_pagos`, `movimientos_inventario`, `movimientos_caja`, `cheques`, `transferencias`, `clover_pagos`, `cliente_movimientos`, `comprobantes_afip`. RPCs: `pos_registrar_venta`. Edge functions: `afip-facturacion`, `solicitar-descuento`, `validar-token-descuento`, `extraer-numero-operacion`.

**Reglas**
- Recargo por cuotas se traslada al cliente: `totalConRecargo = total + Σ(monto − monto/coef)`.
- Vendedor no puede hacer Ingreso/Egreso manual en cajas (relación con módulo Cajas).
- Ticket muestra "Cond. Venta: Cuenta Corriente" cuando aplica.
- Descuento por rol/producto configurable en `descuentos_producto_rol` y `configuracion_descuentos`.

**Roles**: `vendedor`, `cajero`, `encargado`, `admin` (según permisos de módulo `ventas`).

---

## 3. Pedidos

**Qué hace**
- Alta con selector de tipo: **web**, **reparto**, **mostrador**.
- Cliente + ítems con precio/descuento por línea (override manual).
- Estados simplificados: `pendiente → preparado → despachado` (+ `rechazado`).
- Preparación: ajuste de cantidades reales, parseo de decimales para pesables/KG, cálculo de excedentes.
- Consolidado por zona/hoja: agrupa por **Pesables**, **Frescos** (`es_frio=true`), **No pesables**.
- Bloqueo de nuevo pedido si el cliente tiene deuda > 30 días.
- Sugerencias de productos por histórico.
- Alerta al detectar múltiples pedidos del mismo cliente en el día.
- Historial y auditoría de cambios de estado (`pedido_historial`).
- Devoluciones asociadas al pedido (`pedido_devoluciones`).
- Edición posterior a `preparado` con reglas específicas.

**Pantallas/Componentes**: `src/pages/Pedidos.tsx`, `NuevoPedidoDialog`, `EditarPedidoDialog`, `PrepararPedidoDialog`, `CambiarEstadoDialog`, `DetallePedidoDialog`, `ConsolidadoPedidos`, `ConsolidadoFinalZona`, `RendirPedidoDialog`, `SelectorTipoPedidoDialog`, `TipoPedidoSelector`.

**Datos**: `pedidos`, `pedido_detalles`, `pedido_historial`, `pedido_devoluciones`.

**Reglas**
- Estado `despachado` **solo lo setea Logística**. Nunca manual desde Pedidos.
- Preparación admite decimales KG.
- Duplicado en el día muestra alerta pero permite continuar.

**Roles**: `vendedor`, `encargado`, `admin` (módulo `pedidos`).

---

## 4. Logística / Distribución

**Qué hace**
- Creación de hojas de ruta agrupando pedidos por zona/día/vehículo.
- ABM de vehículos.
- Carga del vehículo (encargado verifica ítems por hoja).
- Paradas del recorrido (cliente + pedido asignado).
- En cada parada: **cobrar**, **devolver**, **rechazar**.
- Rendición del chofer al volver (efectivo + valores).
- Refacturación por producto (`refacturar_hoja_ruta_producto`).
- Subsanación de cobros incorrectos.
- Transición automática de pedidos a `despachado` al confirmar la hoja.
- Agregación de datos legado (hojas históricas de sistemas previos).
- Detalle de entregas y pendientes por chofer.

**Pantallas/Componentes**: `src/pages/Logistica.tsx`, `DetalleEntregas.tsx`, `PendientesChofer.tsx`, `HorariosZona.tsx`, `NuevaHojaRutaDialog`, `HojaCargaDialog`, `DetalleHojaRutaDialog`, `RegistrarCobroDialog`, `RegistrarDevolucionDialog`, `RendicionHojaRutaDialog`, `RefacturarHojaRutaDialog`, `SubsanarCobroDialog`, `VehiculoFormDialog`.

**Datos**: `hojas_ruta`, `hoja_ruta_paradas`, `hoja_ruta_carga_items`, `hoja_ruta_cobros`, `hoja_ruta_devoluciones`, `hoja_ruta_devoluciones_vendedor`, `hoja_ruta_ventas_rechazados`, `hoja_ruta_rendiciones`, `hoja_ruta_refacturaciones`, `vehiculos`, `zona_horarios`, `chofer_pendientes`, `cobros`, `devoluciones`. Edge function: `api-logistica`.

**Reglas**
- Estado `despachado` de pedidos **exclusivo** de este módulo.
- Auto-completado de ruta al alcanzar estados terminales.
- Fetching desacoplado para no romper por FKs faltantes de datos legado.
- `origen=historico` excluido de balances actuales.

**Roles**: `encargado`, `admin`, `deposito` (según permisos).

---

## 5. Encargado (APK móvil)

**Qué hace**
- APK Capacitor que reusa el mismo Supabase + RLS.
- Vinculación `empleados.user_id` ↔ `auth.users` (RLS via `get_empleado_id()`).
- Tabs: **Carga**, **Paradas**, **Rendición**, **Resumen Cobros**, **Stock Rechazado**.
- Cobros y devoluciones en calle desde sheets móviles.
- Foto de comprobante con cámara nativa (`nativeCamera.ts`).

**Pantallas/Componentes**: `src/pages/Encargado.tsx`, `EncargadoHojaDetalle.tsx`, `CargaTab`, `ParadasTab`, `ParadaSheet`, `CobrarSheet`, `DevolucionSheet`, `RendicionTab`, `ResumenCobrosTab`, `StockRechazadoTab`.

**Datos**: mismas tablas de Logística + `push_subscriptions` para notificaciones.

**Roles**: `encargado`.

---

## 6. Facturación AFIP

**Qué hace**
- Emisión WSFE en producción (certificados en secrets `AFIP_CERT_PROD` / `AFIP_PRIVATE_KEY_PROD`).
- Ambiente auto según `configuracion_comercio.afip_ambiente`.
- Nota de crédito **total** (anula + compensa CC).
- Nota de crédito **parcial** vía wizard (elige ítems/cantidades).
- Resoluciones pendientes: si factura era contado y se anula → resolución en dinero, cheque o transferencia.
- Registro de comprobantes con CAE, QR, importes desagregados.
- Manejo de tokens AFIP cacheados (`afip_tokens`).

**Pantallas/Componentes**: `src/pages/Facturacion.tsx`, `NotaCreditoParcialWizard`, `ResolucionesPendientes`.

**Datos**: `comprobantes_afip`, `notas_credito_pendientes`, `nota_credito_items`, `afip_tokens`, `configuracion_comercio`. Edge function: `afip-facturacion`.

**Reglas**
- Tipo de comprobante según condición IVA (A/B/C).
- NC parcial nunca se guarda como `NCR` — siempre `nota_credito`.
- Vendedor tiene permisos RLS acotados sobre `comprobantes_afip`.

**Roles**: `admin`, `cajero`, `vendedor` (parcial).

---

## 7. Ventas (consulta)

**Qué hace**
- Vista unificada ventas + pedidos vía RPC `get_ventas_lista` (para escalar sobre 1K filas).
- Filtros por fecha, cliente, vendedor, forma de pago, sucursal.
- Detalle por venta con acceso a comprobante AFIP.

**Pantallas/Componentes**: `src/pages/Ventas.tsx`.

**Datos**: RPC `get_ventas_lista`.

**Roles**: módulo `ventas`.

---

## 8. Cajas

**Qué hace**
- Apertura con saldo inicial por sucursal.
- Movimientos: `ingreso`, `egreso`, ventas automáticas.
- Detalle de arqueo por denominación (`arqueo_detalles`) + otros medios (`arqueo_otros_medios`).
- Cierre con **arqueo en 2 pasos**: cálculo `diferencia = arqueo − esperado`, confirmación vía `confirmar_arqueo_con_ajuste`.
- Si el admin imputa la diferencia → crea `empleado_movimientos` (ajuste faltante o devolución sobrante).
- Edición de arqueo posterior.

**Pantallas/Componentes**: `src/pages/Cajas.tsx`, `ConfirmarArqueoDialog`, `EditarArqueoDialog`.

**Datos**: `cajas`, `movimientos_caja`, `arqueo_detalles`, `arqueo_otros_medios`, `empleado_movimientos`. RPC: `confirmar_arqueo_con_ajuste`.

**Reglas**
- **Vendedor NO puede** hacer Ingreso/Egreso manuales.
- Ventas contado generan movimiento automático al cerrar la venta.

**Roles**: `cajero`, `encargado`, `admin`.

---

## 9. Clientes

**Qué hace**
- ABM cliente con datos fiscales, zona, vendedor asignado, lista de precios, condición IVA.
- Cuenta Corriente: movimientos `compra`, `pago`, `nota_credito`, `ajuste`.
- Balance excluye `origen=historico` (esos son informativos).
- Imputación de pagos FIFO (REC y NC contra FAC más antigua).
- Efectivo: imputa inmediato. Cheque/Transferencia: imputa cuando el valor se valida.
- Pagos multi-método y parciales.
- Bloqueo por deuda: cantidad de facturas impagas + monto umbral configurables.
- NC pendientes por aplicar.
- Importadores Excel:
  - Alta masiva de clientes (lista Mayorista por defecto).
  - Cuenta corriente (movimientos actuales).
  - Deudas granulares (auto-provisiona clientes/zonas faltantes).
  - Banco (pagos bancarios).
  - Historial legacy (tag `origen=historico`).
- Normalización dual de código cliente (legacy + nuevo).

**Pantallas/Componentes**: `src/pages/Clientes.tsx`, `CuentaCorrienteClienteDialog`, `RegistrarPagoClienteDialog`, `NCPendientesTab`, `ExcelImporterClientes`, `ExcelImporterCuentaCorriente`, `ImportarBancoDialog`, `ImportarDeudasDialog`, `ImportarHistorialDialog`.

**Datos**: `clientes`, `cliente_movimientos`, `cliente_movimiento_imputaciones`, `notas_credito_pendientes`, `zonas`, `vendedores`, `vendedor_zonas`, `provincias`, `listas_precios`.

**Reglas**
- Movimientos `origen=historico` **fuera** del balance actual.
- Importador batching de 5k filas, insertando de a 100.
- Bypass límite 1K con `.range()`.

**Roles**: módulo `clientes`.

---

## 10. Empleados

**Qué hace**
- ABM empleados con vinculación a `auth.users` (para APK).
- Cuenta Corriente empleado (`compra`, `sueldo`, `ajuste`, `devolución`).
- Liquidaciones (`empleado_liquidaciones`) con pago total/parcial.
- Pago en efectivo genera automáticamente `egreso` en caja abierta.
- Recibo imprimible.

**Pantallas/Componentes**: `src/pages/Empleados.tsx`, `EmpleadoFormDialog`, `CuentaCorrienteDialog`, `LiquidacionSection`, `PagarLiquidacionDialog`, `RegistrarMovimientoDialog`.

**Datos**: `empleados`, `empleado_movimientos`, `empleado_liquidaciones`.

**Roles**: `admin`, `encargado`.

---

## 11. Proveedores

**Qué hace**
- ABM proveedores.
- Cuenta Corriente con 4 medios de pago: efectivo, transferencia, cheque de terceros (endoso), cheque propio.
- Órdenes de compra con detalles.
- Importadores Excel (alta masiva, cuenta corriente).

**Pantallas/Componentes**: `src/pages/Proveedores.tsx`, `ProveedorFormDialog`, `CuentaCorrienteProveedorDialog`, `RegistrarMovimientoProveedorDialog`, `NuevaOrdenCompraDialog`, `ImportarProveedoresDialog`, `ImportarCuentaCorrienteDialog`.

**Datos**: `proveedores`, `proveedor_movimientos`, `ordenes_compra`, `orden_compra_detalles`.

**Roles**: módulo `proveedores`.

---

## 12. Cheques

**Qué hace**
- 7 estados: `pendiente_validacion → cartera → depositado → acreditado / rechazado`, más `endosado` y `entregado_a_proveedor`.
- Alta manual y desde POS/cobros.
- Cambio de estado con historial completo (`cheque_historial`).
- Detalles ampliados (`cheque_detalles`).

**Pantallas/Componentes**: `src/pages/Cheques.tsx`, `NuevoChequeDialog`, `CambiarEstadoChequeDialog`, `HistorialChequeDialog`.

**Datos**: `cheques`, `cheque_detalles`, `cheque_historial`.

**Roles**: `admin`, `encargado`, `cajero`.

---

## 13. Transferencias

**Qué hace**
- Registro de transferencias con validación de `numero_operacion` único (anti-duplicado).
- Extracción de datos desde comprobante con **AI Gemini Vision** (edge function `extraer-numero-operacion`).
- Estados sincronizados con imputación en CC cliente.

**Datos**: `transferencias`. Edge function: `extraer-numero-operacion`.

---

## 14. Clover (terminales)

**Qué hace**
- Importación de pagos Clover.
- Matching por `numero_terminal_clover` a la venta correspondiente.

**Pantallas/Componentes**: `src/pages/Clover.tsx`, `ImportarCloverDialog`.

**Datos**: `clover_pagos`.

---

## 15. Descuentos PWA (autorización remota)

**Qué hace**
- PWA aislada en `/admin-descuentos` con login independiente.
- Token rotativo de 6 caracteres (`admin_tokens`).
- Flujo: POS solicita → `solicitar-descuento` → admin recibe → aprueba/rechaza con `aprobar-descuento` → POS valida con `validar-token-descuento`.
- Configuración de límites por producto/rol (`descuentos_producto_rol`, `configuracion_descuentos`).
- Nunca guarda credenciales en localStorage.

**Pantallas/Componentes**: `src/pages/AdminDescuentos.tsx`, `AdminTokenDisplay`, `TokenDisplay`, `SolicitudCard`, `SolicitarDescuentoModal`.

**Datos**: `admin_tokens`, `solicitudes_descuento`, `configuracion_descuentos`, `descuentos_producto_rol`. Edge functions: `solicitar-descuento`, `validar-token-descuento`, `aprobar-descuento`, `generar-token-admin`.

---

## 16. Productos y catálogo

**Qué hace**
- ABM productos con marca, tipo, categoría, subcategoría, unidad, flag `es_frio`, stock.
- Actualizador masivo de precios (`ActualizadorPreciosDialog`).
- Importador de fríos (`ImportarFriosDialog`).
- Impresión de etiquetas de precios (`ImprimirPreciosDialog`).
- Movimientos de inventario (`movimientos_inventario`) por venta/devolución/ajuste.
- ABM auxiliares: Marcas, Tipos, Categorías, Subcategorías.

**Pantallas/Componentes**: `Productos.tsx`, `Marcas.tsx`, `TiposProducto.tsx`, `Categorias.tsx`, `Subcategorias.tsx`.

**Datos**: `productos`, `marcas`, `tipos_producto`, `categorias`, `subcategorias`, `movimientos_inventario`.

---

## 17. Listas de precios

**Qué hace**
- N listas con porcentaje sobre base.
- Excepciones por producto (`lista_precio_excepciones`).
- Detalle de lista por producto.
- Sync con proveedor Paladini (edge function `sync-lista-precios-paladini`).

**Pantallas/Componentes**: `ListasPrecios.tsx`, `DetalleListaPrecioDialog`.

**Datos**: `listas_precios`, `lista_precio_porcentajes`, `lista_precio_excepciones`.

---

## 18. Tarjetas y cuotas

**Qué hace**
- ABM tarjetas + planes de cuotas con `coeficiente`.
- El coeficiente > 1 dispara **recargo trasladado al cliente** en el POS.

**Pantallas/Componentes**: `Tarjetas.tsx`.

**Datos**: `tarjetas`, `tarjeta_cuotas`.

---

## 19. Configuración del comercio

**Qué hace**
- Datos fiscales (razón social, CUIT, condición IVA, dirección, PV).
- Ambiente AFIP (producción / homologación).
- Branding: nombre sistema, footer login.
- Parámetros de bloqueo por deuda, límites de descuento por rol, condiciones de venta, formas de pago.
- Sucursales.

**Pantallas/Componentes**: `Configuracion.tsx`.

**Datos**: `configuracion_comercio`, `sucursales`, `formas_pago`, `condiciones_venta`, `configuracion_descuentos`.

---

## 20. Roles y permisos

**Qué hace**
- Roles dinámicos en tabla `roles` (no ENUM).
- Roles de sistema protegidos de borrado: `admin`, `encargado`, `cajero`, `vendedor`, `deposito`.
- Permisos granulares por módulo × acción (`ver`, `crear`, `editar`, `eliminar`, `anular`, `exportar`).
- Editor de matriz de permisos.

**Pantallas/Componentes**: `Roles.tsx`, `Usuarios.tsx`.

**Datos**: `roles`, `role_permissions`, `user_roles`.

---

## 21. Visitas / Objetivos / Productos foco

**Qué hace**
- Agenda de visitas comerciales.
- Incidencias durante visita (formulario).
- Objetivos por vendedor y por zona.
- Productos foco por vendedor.

**Pantallas/Componentes**: `AgendaVisitas.tsx`, `VisitaCard`, `IncidenciaForm`, `ObjetivosVendedorTab`, `ObjetivosZonaTab`, `ProductosFocoTab`.

**Datos**: `visitas`, `visita_incidencias`, `objetivos_vendedor`, `objetivos_zona`, `productos_foco`, `productos_foco_vendedor`.

---

## 22. Datos maestros de territorio

**Qué hace**: ABM Zonas, Horarios por zona, Sucursales, Provincias, Vendedores + asignación de zonas al vendedor.

**Pantallas/Componentes**: `Zonas.tsx`, `HorariosZona.tsx`, `Vendedores.tsx`.

**Datos**: `zonas`, `zona_horarios`, `sucursales`, `provincias`, `vendedores`, `vendedor_zonas`.

---

## 23. Imputación y reporte de pagos

**Qué hace**
- Pantalla de Imputación manual REC ↔ FAC.
- Pantalla de Asociación de pagos (matching sugerido).
- Reporte de pagos por período/cliente/vendedor.

**Pantallas/Componentes**: `Imputacion.tsx`, `AsociacionPagos.tsx`, `ReportePagos.tsx`.

**Datos**: `cliente_movimientos`, `cliente_movimiento_imputaciones`.

---

## 24. Devoluciones

**Qué hace**
- Devoluciones manuales (fuera de reparto).
- Devoluciones desde pedido.
- Reversal de inventario automático.
- Diferencia entre **anulación total** (revierte todo) y **devolución parcial** (por ítem/cantidad).

**Pantallas/Componentes**: `Devoluciones.tsx`.

**Datos**: `devoluciones`, `devoluciones_manuales`, `pedido_devoluciones`, `movimientos_inventario`.

---

## 25. Impresiones

**Qué hace**: sistema de impresión con múltiples formatos.
- **Ticket térmico 80mm** — POS contado y CC.
- **Factura A4** — impresión estándar.
- **Factura A5 10 filas fijas** — layout fijo con segmentación:
  - ≤ 10 ítems → 1 hoja corta.
  - > 10 ítems → hoja larga.
- **Remito ORO** — layout, dimensiones, duplicado y estilos **BLOQUEADOS**, solo se cambia data.
- Consolidado de pedidos.
- Recibo de liquidación de empleado.
- Detalle de pedido.
- Workflows encadenados (`imprimirWorkflows.ts`).

**Archivos**: `src/lib/imprimirRemito.ts`, `imprimirTicketFactura.ts`, `imprimirConsolidado.ts`, `imprimirDetallePedido.ts`, `imprimirReciboLiquidacion.ts`, `imprimirWorkflows.ts`, `printMeta.ts`.

---

## 26. APIs externas / Edge Functions

| Function | Verify JWT | Propósito |
|---|---|---|
| `afip-facturacion` | no | Emisión WSFE + NC |
| `api-productos` | no | API pública productos (x-api-key) |
| `api-logistica` | no | API pública logística |
| `chat-asistente` | no | Chat AI interno |
| `solicitar-descuento` | no | POS pide autorización |
| `validar-token-descuento` | no | POS valida token PWA |
| `aprobar-descuento` | no | PWA aprueba solicitud |
| `generar-token-admin` | no | Rota token PWA 6 chars |
| `manage-push-subscription` | no | Alta/baja push |
| `send-push-notification` | no | Envío push |
| `extraer-numero-operacion` | sí (default) | AI Gemini Vision para comprobantes |
| `admin-users` | sí | ABM usuarios auth |
| `sync-cliente-paladini` | sí | Sync clientes Paladini |
| `sync-lista-precios-paladini` | sí | Sync precios Paladini |

---

## 27. Features transversales

- **Sugerencias**: `Sugerencias.tsx` — buzón interno para el equipo.
- **Chat asistente**: `ChatAssistant` widget con `chat-asistente`.
- **Update banner**: `UpdateBanner` + `useVersionCheck` — notifica nueva versión desplegada.
- **Push notifications**: `usePushNotifications` + service worker `public/sw.js` + `manifest.json` (PWA).
- **PWA aislada** para descuentos.
- **APK Capacitor** para encargados.
- **DataTable / KPICard / StatusBadge** shared.
- **ExcelImporter** genérico + variantes específicas.

---

## 28. Reglas críticas cross-módulo

- **Límite 1K Supabase** → siempre `.range()` recursivo para datasets grandes; evitar `.in()` con listas largas.
- **`origen=historico`** excluido de balances actuales (clientes, empleados, proveedores).
- **Radix UI**: usar `Sheet` sobre `Dialog` en formularios complejos; `forwardRef` obligatorio para evitar loops.
- **Remito ORO**: layout inmutable en `imprimirRemito.ts` — solo data, jamás formato.
- **Estado `despachado`**: solo desde Logística, nunca manual.
- **Vendedor sin Ingreso/Egreso manual** en cajas.
- **Roles fuera de `profiles`** — siempre en `user_roles` (evita escalación de privilegios).
- **Tokens/credenciales** nunca en localStorage (PWA descuentos usa tokens rotativos).
- **RLS + GRANT** obligatorio en toda tabla `public.*`.

---

# Checklist plano (para comparar con tus pendientes)

Marcá al costado las tareas que faltan agregar/ajustar.

## Auth
- [x] Login email/contraseña
- [x] Roles dinámicos + permisos por módulo × acción
- [x] `ProtectedRoute` global
- [x] Branding login desde `configuracion_comercio`
- [x] Redirect por query `?redirect=`

## POS
- [x] Búsqueda producto + cantidad pesable (KG decimales)
- [x] Edición precio/descuento por línea
- [x] Selección de lista de precios con excepciones
- [x] Descuento manual dentro del límite del rol
- [x] Solicitud de descuento excedido vía PWA (token 6 chars)
- [x] Pago efectivo
- [x] Pago tarjeta con coeficiente — recargo al cliente
- [x] Pago transferencia con anti-duplicado + AI Gemini
- [x] Pago cheque (integrado al alta)
- [x] Pago Clover
- [x] Pago QR
- [x] Pago Cuenta Corriente
- [x] Usar saldo/NC pendiente
- [x] Ventas a empleado (CC o directo)
- [x] Facturación AFIP A/B/C
- [x] Ticket 80mm con QR AFIP
- [x] RPC `pos_registrar_venta` transaccional

## Pedidos
- [x] Tipos: web / reparto / mostrador
- [x] Estados: pendiente → preparado → despachado (+ rechazado)
- [x] Preparación con excedentes y KG
- [x] Consolidado por Pesables / Frescos / No pesables
- [x] Bloqueo por deuda > 30 días
- [x] Sugerencias por histórico
- [x] Alerta duplicado en el día
- [x] Historial de estados
- [x] Edición post-preparado
- [x] Devoluciones desde pedido

## Logística
- [x] Hojas de ruta + vehículos
- [x] Carga verificada
- [x] Paradas con cobro/devolución/rechazo
- [x] Rendición chofer
- [x] Refacturación por producto
- [x] Subsanación de cobros
- [x] Transición automática a `despachado`
- [x] Agregación datos legado
- [x] Detalle entregas + Pendientes chofer
- [x] Horarios por zona

## Encargado APK
- [x] Login Supabase + RLS
- [x] Tabs Carga / Paradas / Rendición / Resumen / Rechazado
- [x] Cobros y devoluciones móviles
- [x] Cámara nativa comprobante
- [x] Push notifications

## Facturación AFIP
- [x] Emisión WSFE producción
- [x] NC total
- [x] NC parcial (wizard)
- [x] Resoluciones pendientes (dinero/cheque/transf)
- [x] Cache de tokens AFIP

## Ventas / Reportes
- [x] Vista unificada `get_ventas_lista`
- [x] Filtros multi-criterio
- [x] Detalle con acceso a comprobante

## Cajas
- [x] Apertura con saldo inicial
- [x] Ingreso/Egreso manuales (restricción a vendedor)
- [x] Movimientos automáticos por venta
- [x] Arqueo 2 pasos con `confirmar_arqueo_con_ajuste`
- [x] Otros medios en arqueo
- [x] Imputación diferencia a empleado
- [x] Edición arqueo posterior

## Clientes
- [x] ABM completo + datos fiscales
- [x] CC con compra/pago/NC/ajuste
- [x] Imputación FIFO
- [x] Cheque/Transf imputan al validarse
- [x] Bloqueo por deuda (facturas + monto)
- [x] NC pendientes
- [x] Importadores: clientes / CC / deudas granulares / banco / historial
- [x] Normalización dual código cliente
- [x] `origen=historico` fuera de balance

## Empleados
- [x] ABM + link a `auth.users`
- [x] CC empleado
- [x] Liquidaciones + pago parcial
- [x] Pago efectivo genera egreso caja
- [x] Recibo imprimible

## Proveedores
- [x] ABM + CC
- [x] 4 medios de pago
- [x] Órdenes de compra
- [x] Importadores

## Valores
- [x] Cheques 7 estados + historial + endoso + entrega proveedor
- [x] Transferencias con anti-duplicado + AI
- [x] Clover por terminal

## Descuentos PWA
- [x] PWA aislada `/admin-descuentos`
- [x] Token 6 chars rotativo
- [x] Solicitud → aprobación → validación
- [x] Config descuento por producto/rol

## Catálogo
- [x] Productos con `es_frio`
- [x] Marcas / Tipos / Categorías / Subcategorías
- [x] Actualizador masivo de precios
- [x] Importador fríos
- [x] Impresión etiquetas

## Precios
- [x] Listas con porcentaje
- [x] Excepciones por producto
- [x] Sync Paladini

## Tarjetas
- [x] ABM tarjetas + planes de cuotas
- [x] Coeficiente > 1 traslada recargo al cliente

## Config
- [x] Datos fiscales + AFIP ambiente
- [x] Sucursales
- [x] Formas de pago + condiciones de venta
- [x] Branding login

## Roles/Permisos
- [x] Roles dinámicos protegidos
- [x] Matriz permisos por módulo × acción
- [x] `has_role` / `has_permission` SECURITY DEFINER

## Visitas
- [x] Agenda
- [x] Incidencias
- [x] Objetivos vendedor / zona
- [x] Productos foco

## Territorio
- [x] Zonas / Horarios / Sucursales / Provincias / Vendedores / Zonas del vendedor

## Imputación
- [x] Imputación manual
- [x] Asociación de pagos
- [x] Reporte pagos

## Devoluciones
- [x] Manuales
- [x] Desde pedido
- [x] Reversal inventario
- [x] Anulación total vs parcial

## Impresiones
- [x] Ticket 80mm
- [x] Factura A4
- [x] Factura A5 10 filas + segmentación corta/larga
- [x] Remito ORO (layout bloqueado)
- [x] Consolidado pedidos
- [x] Recibo liquidación
- [x] Detalle pedido
- [x] Workflows encadenados

## APIs / Edge
- [x] `api-productos` (x-api-key)
- [x] `api-logistica`
- [x] `chat-asistente`
- [x] `afip-facturacion`
- [x] Descuentos (solicitar/validar/aprobar/generar-token)
- [x] Push (manage + send)
- [x] `extraer-numero-operacion` (AI Gemini)
- [x] `admin-users`
- [x] Sync Paladini (clientes + precios)

## Transversales
- [x] Sugerencias
- [x] Chat asistente
- [x] Update banner + version check
- [x] Push notifications + service worker + manifest PWA
- [x] APK Capacitor encargados
- [x] DataTable / KPICard / StatusBadge / ExcelImporter shared

## Reglas críticas
- [x] `.range()` para > 1K filas
- [x] `origen=historico` fuera de balances
- [x] Radix Sheet + forwardRef
- [x] Remito ORO layout inmutable
- [x] `despachado` solo desde Logística
- [x] Vendedor sin Ingreso/Egreso caja
- [x] Roles en tabla separada
- [x] Sin credenciales en localStorage
- [x] RLS + GRANT en toda tabla pública

---

_Última actualización: 07/07/2026._