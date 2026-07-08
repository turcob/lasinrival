# Plan: Prompt mayorista autocontenido para Antigravity

Generar un único archivo `docs/PROMPT_MAYORISTA.md` (~800–1200 líneas) redactado como brief de producto + especificación funcional, **agnóstico de stack** (sin nombrar React/Vite/Supabase/Lovable; se habla de "frontend web", "app móvil", "base de datos relacional", "funciones serverless", "gateway AFIP"). Sirve para pegar en Antigravity y arrancar desarrollo desde cero.

## Alcance incluido (todo B2B)

1. **Clientes mayoristas** — alta, datos fiscales, zona, vendedor asignado, lista de precios, condición IVA, bloqueo por deuda (umbral facturas impagas + monto), importadores Excel (clientes, deudas granulares, historial legacy con `origen=historico` excluido de balances).
2. **Cuenta Corriente cliente** — movimientos (compra, pago, nota_credito, ajuste), pagos multi-método y parciales, **imputación FIFO** de REC/NC contra FAC más antiguas, imputación diferida para cheque/transferencia (recién al validarse).
3. **Pedidos** — tipos web/reparto/mostrador, estados `pendiente → preparado → despachado → rechazado`, preparación con ajuste real (kg decimales, excedentes), precio/descuento manual por ítem, alerta de duplicados diarios, bloqueo por 30 días de deuda, sugerencias de productos.
4. **Consolidado de pedidos** — agrupación Pesables / Frescos / No Pesables, impresión por zona.
5. **Logística / Reparto** — vehículos, hojas de ruta (`planificada → en_carga → carga_confirmada → en_reparto → cerrada`), paradas, cobros en calle (efectivo/transf/cheque), devoluciones, rechazados, rendición del chofer, refacturación por producto, transición automática a `despachado` (solo desde Logística), agregación de datos legacy.
6. **App móvil encargado/chofer** — tabs Carga / Paradas / Cobros / Devoluciones / Rendición / Stock rechazado; mismo backend con RLS; login vía linkage `empleados.user_id`.
7. **Facturación AFIP** — WSFE producción, tipos A/B/C según condición IVA, ticket térmico 80 mm con QR, factura A5, NC total (anula + compensa CC), **NC parcial wizard** (elige ítems/cantidades), resoluciones pendientes (contado → dinero/cheque/transf; CC → crédito CC).
8. **Cheques** — 7 estados (`pendiente_validacion, cartera, depositado, acreditado, rechazado, endosado, entregado_a_proveedor`) con historial de auditoría.
9. **Transferencias** — validación de `numero_operacion` contra duplicados, extractor AI Vision de comprobantes.
10. **Proveedores** — alta, CC proveedor, órdenes de compra con detalle, pagos con 4 medios (efectivo, transferencia, cheque terceros, cheque propio), importadores.
11. **Listas de precios** — múltiples listas, asignación por cliente, actualizador masivo.
12. **Zonas / Vendedores** — territorios, horarios de zona, objetivos por vendedor/zona, agenda de visitas, productos foco, incidencias.
13. **Productos** (mínimo para B2B) — SKU, categorías/subcategorías/marcas/tipos, flag `es_frio`, unidad de medida (pesable/unidad), stock, movimientos de inventario.
14. **Roles y permisos** — tabla `roles` dinámica (no enum), `role_permissions(role, modulo, permiso)`, función `has_role` SECURITY DEFINER, RLS obligatoria en cada tabla + GRANTs.
15. **Impresión** — remito ORO (layout fijo, duplicado), factura A5 (10 filas fijas), ticket térmico 80 mm, recibo liquidación, consolidado por zona.

## Alcance EXCLUIDO explícitamente

- POS mostrador de contado (venta directa retail).
- Descuentos PWA con token rotativo.
- Terminal Clover.
- Empleados / liquidaciones / sueldos.
- Cajas (arqueo, apertura/cierre) — es retail.
- Dashboard, sugerencias/chat asistente.

## Estructura del archivo `docs/PROMPT_MAYORISTA.md`

```text
1. Contexto y objetivo del sistema (distribuidora mayorista de alimentos)
2. Usuarios y roles (admin, encargado, vendedor, chofer, depósito)
3. Glosario (hoja de ruta, parada, rendición, NC parcial, imputación FIFO, etc.)
4. Arquitectura sugerida (agnóstica): frontend web + app móvil + BD relacional + funciones serverless + gateway AFIP
5. Modelo de dominio (entidades + relaciones, sin DDL específico de motor)
     Clientes, Zonas, Vendedores, ListasPrecios, Productos,
     Pedidos+Detalles, HojasRuta+Paradas+Cobros+Devoluciones+Rendiciones,
     Ventas+Detalles+Pagos, ComprobantesAFIP, NotasCredito+Items,
     ClienteMovimientos+Imputaciones, Cheques+Historial, Transferencias,
     Proveedores+Movimientos+OrdenesCompra, Roles+Permisos, Empleados (mínimo link móvil)
6. Módulos funcionales (14 secciones, cada una con):
     · Qué hace
     · Pantallas / vistas
     · Flujo paso a paso
     · Reglas de negocio
     · Datos que toca
     · Permisos por rol
7. Circuitos end-to-end:
     · Toma de pedido → preparación → hoja de ruta → reparto → cobro → rendición → venta → factura AFIP → CC
     · NC parcial post-entrega con resolución financiera
     · Pago cliente multi-método con imputación FIFO
     · Pago a proveedor con cheque propio
8. Reglas invariantes (críticas, no negociables):
     · `despachado` sólo desde Logística
     · `origen=historico` excluido de balances
     · Roles en tabla aparte, nunca en profile (evita escalación)
     · Imputación diferida para valores no confirmados
     · Layout de remito ORO congelado
     · Duplicados de transferencia bloqueados por numero_operacion
9. Integraciones externas:
     · AFIP WSFE (certificado prod, ambientes)
     · AI Vision para extraer numero_operacion de comprobantes
     · Impresión térmica 80mm y A5
10. Seguridad y multi-tenant:
     · RLS por tabla, GRANTs explícitos
     · Función has_role SECURITY DEFINER
     · Linkage usuario-empleado para app móvil
11. Importadores Excel (formato de columnas + reglas de auto-provisión)
12. Checklist plano de features (para trackear progreso en Antigravity)
13. Sugerencias de orden de implementación (fase 1: clientes+productos+pedidos; fase 2: logística+encargado APK; fase 3: AFIP+NC; fase 4: cheques+transferencias+proveedores)
```

## Fuentes que se van a consolidar

- `docs/ONBOARDING.md` — arquitectura y circuitos.
- `docs/FUNCIONALIDADES.md` — inventario de 28 módulos (se filtran solo los B2B).
- `mem://` — reglas invariantes ya memorizadas (imputación FIFO, orden despachado, remito ORO, cheques 7 estados, etc.).

## Entregable

- **Un archivo nuevo:** `docs/PROMPT_MAYORISTA.md`.
- **Sin cambios de código de aplicación.**
- Redactado en español, tono spec/brief, con diagramas ASCII y tablas markdown, sin nombres de librerías ni de la plataforma.
