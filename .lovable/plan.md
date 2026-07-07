# Documento: Inventario completo de funcionalidades del sistema

## Objetivo
Generar un documento de referencia (`docs/FUNCIONALIDADES.md`) que liste **todo lo que hace hoy el sistema**, módulo por módulo, para que puedas cotejarlo contra tu lista de tareas pendientes y detectar gaps, duplicados y ajustes.

## Formato
- Markdown, estructurado por módulo (mismos módulos que `ONBOARDING.md` pero mucho más granular).
- Por cada módulo: **Qué hace** · **Pantallas/Componentes** · **Datos que toca (tablas/RPC/Edge Functions)** · **Reglas de negocio activas** · **Roles/permisos que aplican**.
- Al final: **Checklist plano** (una línea por feature con `[x]` marcando lo ya implementado) — pensado para que pegues al lado tu lista de pendientes y marques diferencias rápido.

## Contenido a cubrir
1. **Autenticación y sesión** — login, perfiles, roles, permisos por módulo, PWA aislada, redirects.
2. **POS (mostrador)** — carrito, búsqueda producto, cantidades, listas de precio, descuentos (con y sin token PWA), pagos (efectivo, tarjeta con coeficiente y recargo al cliente, transferencia, cheque, Clover, QR, cuenta corriente), factura AFIP A/B/C, impresión ticket 80mm, ventas a empleados.
3. **Pedidos** — tipos (web/reparto/mostrador), alta, edición, preparación con pesables/KG, consolidado (Pesables/Frescos/No Pesables), bloqueo por deuda 30 días, sugerencias, duplicados, estados simplificados.
4. **Logística** — hojas de ruta, vehículos, carga, paradas, cobros/devoluciones/rechazos en calle, rendición chofer, refacturación, subsanación, transición automática a `despachado`, agregación de datos legado.
5. **Encargado (APK móvil)** — vinculación `empleados.user_id`, tabs Carga/Paradas/Rendición/Resumen/Stock rechazado, cobros, devoluciones.
6. **Facturación AFIP** — emisión WSFE prod, comprobantes, NC total y parcial (wizard), resoluciones pendientes, tokens AFIP.
7. **Ventas** — vista unificada ventas+pedidos, RPC `get_ventas_lista`, reportes.
8. **Cajas** — apertura, movimientos (ingreso/egreso con restricción vendedor), ventas automáticas, arqueo 2 pasos, otros medios, ajustes a empleado.
9. **Clientes** — alta, CC (compra/pago/NC/ajuste), imputación FIFO, importadores (clientes, CC, deudas granulares, banco, historial `origen=historico`), bloqueo por deuda, pagos multi-método, NC pendientes.
10. **Empleados** — alta, CC, liquidaciones, pago en efectivo genera egreso caja.
11. **Proveedores** — alta, CC, movimientos con 4 medios (efectivo/transf/cheque terceros/cheque propio), órdenes de compra, importadores.
12. **Cheques** — 7 estados, historial, endoso, entrega a proveedor.
13. **Transferencias** — validación `numero_operacion` duplicados, extracción con AI Gemini Vision.
14. **Clover** — importación pagos, matching por terminal.
15. **Descuentos PWA** — token 6 chars rotativo, solicitud desde POS, aprobación admin, config por producto/rol.
16. **Productos / Categorías / Marcas / Tipos / Subcategorías** — ABM, actualizador masivo precios, importador fríos, impresión precios, flag `es_frio`.
17. **Listas de precios** — porcentajes por lista, excepciones por producto, sync Paladini.
18. **Tarjetas** — tarjetas y cuotas con coeficiente (recargo trasladado al cliente).
19. **Configuración comercio** — razón social, AFIP ambiente, punto de venta, branding login.
20. **Roles y permisos** — roles dinámicos, `role_permissions` por módulo/permiso, `has_role`/`has_permission`.
21. **Visitas / Objetivos / Productos foco** — agenda, objetivos vendedor/zona, incidencias.
22. **Zonas / Horarios / Sucursales / Provincias / Vendedores** — datos maestros de territorio.
23. **Imputación y Reporte de pagos** — asociación pagos, reporte.
24. **Devoluciones** — manuales y desde pedidos, reversal inventario.
25. **Impresiones** — ticket 80mm, factura A4, factura A5 10 filas, remito ORO (bloqueado), consolidado, recibo liquidación, detalle pedido.
26. **APIs externas / Edge Functions** — `api-productos`, `api-logistica`, `chat-asistente`, push notifications, sync Paladini, admin-users.
27. **Sugerencias / Chat asistente / Update banner / Push** — features transversales.
28. **Reglas críticas cross-módulo** — límite 1K Supabase, `origen=historico`, Radix loops, remito ORO inmutable.

## Método
- Recorrer `src/pages/`, `src/components/`, `src/hooks/`, `supabase/functions/` para extraer features reales (no inventar).
- Cruzar con `ONBOARDING.md`, memorias del proyecto y `supabase-tables` para no omitir módulos.
- No incluir "cómo está implementado" a nivel código salvo cuando sea una regla de negocio (ej. "recargo tarjeta se traslada al cliente" sí; "usa useMemo" no).

## Entregable
- Archivo nuevo: `docs/FUNCIONALIDADES.md` (extenso, ~600-900 líneas).
- No se toca código de la app.

## Verificación
- Abrir el `.md` generado y confirmar que cada módulo listado en el sidebar (`AppSidebar.tsx`) tiene su sección.
- Confirmar que el checklist final incluye una línea por cada feature descripta arriba.
