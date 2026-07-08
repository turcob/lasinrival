# Prompt maestro — Sistema mayorista (distribuidora B2B)

> Este documento es un **brief autocontenido y agnóstico de stack** para arrancar el desarrollo del sistema mayorista desde cero. Consolidá acá todo lo B2B: clientes con cuenta corriente, pedidos, logística de reparto, app móvil del encargado/chofer, facturación AFIP (Argentina), notas de crédito parciales, cheques, transferencias, proveedores, listas de precios, zonas y vendedores. **Fuera de alcance**: POS mostrador retail, cajas/arqueo, descuentos PWA con token, terminal Clover, empleados/liquidaciones, dashboard, chat asistente.

---

## 1. Contexto y objetivo

Distribuidora mayorista de alimentos (fríos, frescos y secos). Vende a comercios (kioscos, almacenes, minimercados, restaurantes) con logística propia por zonas y ruteo diario. La operación real es:

1. Vendedores toman pedidos (visita, teléfono o web).
2. Depósito los prepara.
3. Los pedidos preparados se agrupan en **hojas de ruta** por zona/día/vehículo.
4. El encargado/chofer sale con la hoja, entrega en cada parada, cobra o deja a cuenta corriente, acepta devoluciones, y al final rinde.
5. Al confirmar la entrega se genera la **venta** y se emite el comprobante fiscal AFIP (A/B/C).
6. La cuenta corriente del cliente refleja compras y pagos con imputación FIFO.

El sistema tiene que sostener esta operación end-to-end, con foco en:
- Integridad transaccional (venta + stock + AFIP + CC en una sola unidad de trabajo).
- Trazabilidad (todo cambio de estado deja historial).
- Multi-rol con permisos granulares.
- Escalabilidad para catálogos y CC grandes (miles de clientes, decenas de miles de movimientos).
- App móvil para el chofer/encargado con el mismo backend.

---

## 2. Usuarios y roles

Roles del sistema (deben vivir en una **tabla dinámica**, no en un enum, y estar protegidos de borrado):

| Rol | Qué hace |
|---|---|
| `admin` | Todo: configuración, usuarios, permisos, anulaciones, reportes. |
| `encargado` | Arma hojas de ruta, sale al reparto (o supervisa), cobra en calle, rinde, aprueba devoluciones. |
| `vendedor` | Toma pedidos, consulta CC del cliente, agenda visitas. **No** hace movimientos manuales de dinero. |
| `chofer` | (Puede ser el mismo `encargado`) usa la app móvil para carga/paradas/cobros/rendición. |
| `deposito` | Prepara pedidos, ajusta cantidades reales, imprime consolidado. |

Los permisos son granulares por **módulo × acción** (`ver`, `crear`, `editar`, `eliminar`, `anular`, `exportar`) y se guardan en una tabla `role_permissions(role, modulo, permiso)`. El front y las policies de BD deben consultarlos con una función helper del tipo `has_permission(user, modulo, permiso)`.

**Importante — antipatrón a evitar:** nunca guardar el rol en la tabla de perfiles del usuario (`profiles.role`). Debe vivir en una tabla aparte (`user_roles`) y consultarse desde policies con una función *security definer* del tipo `has_role(user, role)` para evitar recursión de RLS y escalación de privilegios.

---

## 3. Glosario

- **Pedido**: intención de compra de un cliente, todavía no facturada. Tiene estado y detalle.
- **Hoja de ruta**: agrupación de pedidos preparados para un vehículo/chofer/día.
- **Parada**: cada visita concreta del recorrido (cliente + pedido asignado).
- **Carga**: verificación física de que lo preparado subió al vehículo.
- **Rendición**: cierre del chofer al volver (efectivo + valores entregados vs esperado).
- **Refacturación**: rehacer una factura de la hoja porque cambió el producto/cantidad post-entrega.
- **Devolución**: producto que el cliente rechaza en la parada.
- **Rechazado**: pedido completo que el cliente no recibe.
- **CC**: Cuenta Corriente. Movimientos `compra`, `pago`, `nota_credito`, `ajuste`.
- **Imputación FIFO**: al recibir un pago (REC) o una NC, se aplica automáticamente contra las facturas (FAC) más antiguas del cliente.
- **NC parcial**: nota de crédito por sólo algunos ítems de una factura, con wizard de selección.
- **Resolución pendiente**: cuando se anula/NC una factura de contado, hay que devolver el dinero (efectivo, cheque, transferencia). Ese "cómo se devuelve" es la resolución.
- **Comprobante AFIP**: factura A/B/C, NC A/B/C, con CAE y QR emitidos por WSFE (webservice de facturación electrónica de AFIP).
- **Condición IVA**: tipo fiscal del cliente (Responsable Inscripto, Monotributo, Consumidor Final, Exento). Define si se emite A, B o C.
- **Legacy / histórico**: datos importados de sistemas anteriores. Se guardan con un marcador (`origen = 'historico'`) y se **excluyen** de todo cálculo de balance actual.

---

## 4. Arquitectura sugerida (agnóstica)

```text
┌─────────────────────┐     ┌─────────────────────┐
│   Frontend web SPA   │     │   App móvil (chofer)│
│  (admin + backoffice)│     │  Carga / Paradas /  │
│                      │     │  Cobros / Rendición │
└──────────┬───────────┘     └──────────┬──────────┘
           │  HTTPS + auth token         │
           └────────────┬────────────────┘
                        ▼
           ┌────────────────────────────┐
           │  API / BaaS con RLS         │
           │  (base de datos relacional  │
           │   + auth + funciones        │
           │   serverless + storage)     │
           └────────────┬────────────────┘
                        │
           ┌────────────┼────────────┬────────────────┐
           ▼            ▼            ▼                ▼
     Gateway AFIP   AI Vision   Impresión         Notificaciones
     (WSFE / WSAA)  (OCR de     (térmica 80mm     push (opcional)
                    comprobantes) + A5)
```

Requisitos no negociables de la capa de datos:
- **RLS activo** en cada tabla de negocio.
- **GRANTs explícitos** por rol de aplicación en cada tabla (no basta con la policy).
- Todas las escrituras críticas (registrar venta, confirmar arqueo, refacturar hoja) deben ser **transacciones únicas** implementadas como funciones/procedimientos del lado servidor, no orquestadas desde el cliente.
- Bypass del límite de paginación del BaaS con paginado recursivo por rangos. Evitar filtros `IN (...)` con listas largas: preferir traer amplio y filtrar en cliente.

---

## 5. Modelo de dominio

Entidades mínimas (nombres orientativos). No incluye DDL específico de motor — usar el que corresponda al stack elegido, respetando FKs, índices y constraints.

```text
Zonas ─────────────┐
                   │
Vendedores ──── vendedor_zonas
                   │
ListasPrecios ── lista_precio_porcentajes
              └── lista_precio_excepciones (por producto)

Clientes ── zona, vendedor_asignado, lista_precio_id, condicion_iva,
            cuit, direccion, telefono, email, saldo_calculado,
            bloqueado (bool), motivo_bloqueo

Productos ── marca, tipo_producto, categoria, subcategoria,
             unidad_medida (unidad | kg), es_frio (bool),
             stock_actual, precio_base

Pedidos ── cliente, vendedor, tipo (web|reparto|mostrador), estado,
           fecha, total_estimado, observaciones
  └── PedidoDetalles ── producto, cantidad_pedida, cantidad_preparada,
                        precio_unitario, descuento, subtotal
  └── PedidoHistorial ── estado_desde, estado_hacia, usuario, timestamp
  └── PedidoDevoluciones (post-entrega)

HojasRuta ── vehiculo, chofer, zona, fecha, estado
  └── HojaRutaParadas ── pedido, cliente, orden_visita, estado_parada
  └── HojaRutaCargaItems ── producto, cantidad_verificada
  └── HojaRutaCobros ── parada, medio_pago, monto, referencia
  └── HojaRutaDevoluciones ── parada, producto, cantidad, motivo
  └── HojaRutaVentasRechazados ── parada, motivo_rechazo
  └── HojaRutaRendiciones ── total_efectivo, total_cheques,
                             total_transf, diferencia
  └── HojaRutaRefacturaciones ── producto, cantidad_nueva
Vehiculos ── patente, capacidad, activo

Ventas ── cliente, vendedor, fecha, total, tipo_operacion
          (contado | cta_cte), pedido_id (nullable), hoja_ruta_id (nullable)
  └── VentaDetalles ── producto, cantidad, precio_unitario, subtotal
  └── VentaPagos ── medio_pago, monto, referencia (solo contado)

ComprobantesAFIP ── venta_id, tipo (A|B|C|NCA|NCB|NCC),
                    punto_venta, numero, cae, cae_vto, qr,
                    importe_neto, importe_iva, importe_total,
                    condicion_iva_receptor

NotasCreditoPendientes ── comprobante_afip_id, venta_original_id,
                          tipo (total | parcial), monto, estado_resolucion
  └── NotaCreditoItems (para parciales) ── venta_detalle_id, cantidad

ResolucionesPendientes ── nc_id, medio (efectivo | cheque | transferencia),
                          monto, resuelto_en (fecha)

ClienteMovimientos ── cliente, tipo (compra | pago | nota_credito | ajuste),
                      monto, saldo_pendiente, fecha, referencia,
                      origen ('actual' | 'historico')
  └── ClienteMovimientoImputaciones ── mov_pago_id, mov_compra_id,
                                       monto_imputado, fecha

Cheques ── numero, banco, cliente_emisor, monto, fecha_emision,
           fecha_cobro, estado (pendiente_validacion | cartera |
           depositado | acreditado | rechazado | endosado |
           entregado_a_proveedor), cliente_id, proveedor_id
  └── ChequeHistorial ── estado_desde, estado_hacia, usuario, timestamp

Transferencias ── numero_operacion (UNIQUE), banco_origen,
                  banco_destino, monto, fecha, cliente_id,
                  comprobante_url

Proveedores ── razon_social, cuit, condicion_iva, contacto, saldo
  └── ProveedorMovimientos ── tipo (factura | pago | nota_credito |
                              nota_debito), monto, saldo_pendiente,
                              medio_pago (efectivo | transferencia |
                              cheque_terceros | cheque_propio)
OrdenesCompra ── proveedor, estado, subtotal, total
  └── OrdenCompraDetalles ── producto | descripcion, cantidad,
                             precio, cantidad_recibida

Roles ── nombre, es_sistema (bool, protege borrado)
RolePermissions ── role, modulo, permiso
UserRoles ── user_id, role

Empleados ── nombre, dni, telefono, user_id (linkea auth ↔ empleado
             para la app móvil)

ConfiguracionComercio ── razon_social, cuit, punto_venta, ambiente_afip,
                         umbral_dias_deuda, cantidad_max_facturas_impagas,
                         monto_max_deuda
```

---

## 6. Módulos funcionales

Cada módulo se describe con: **Qué hace / Vistas / Flujo / Reglas / Datos / Permisos**.

### 6.1 Clientes mayoristas

- **Qué hace**: ABM de clientes con datos fiscales completos, asignación de zona y vendedor, lista de precios y condición IVA. Cuenta corriente por cliente. Bloqueo automático por deuda.
- **Vistas**: listado paginado con filtros por zona/vendedor/estado/saldo, ficha de cliente, diálogo de CC, diálogo de registrar pago, tab de NC pendientes por aplicar.
- **Flujo alta**: datos fiscales → asignar zona → asignar vendedor → elegir lista de precios → guardar.
- **Reglas**:
  - Si la cantidad de facturas impagas > umbral o el monto adeudado > umbral (configurables), el cliente queda bloqueado para nuevos pedidos.
  - Existe normalización dual de código cliente para convivir con códigos legacy y códigos nuevos.
  - Importadores Excel disponibles: alta masiva (asigna lista "Mayorista" por defecto), CC actual, deudas granulares (auto-provisiona clientes y zonas faltantes), pagos bancarios, historial legacy con tag `origen=historico`.
  - El importador procesa en lotes de ~5.000 filas insertando de a 100 para no timeoutear.
- **Datos**: `clientes`, `zonas`, `vendedores`, `vendedor_zonas`, `listas_precios`.
- **Permisos**: módulo `clientes`.

### 6.2 Cuenta Corriente cliente + Imputación FIFO

- **Qué hace**: registra todos los movimientos del cliente y calcula saldo en vivo. Aplica pagos y NC contra facturas viejas usando FIFO.
- **Vistas**: diálogo CC con timeline de movimientos, botón "Registrar pago", vista de NC pendientes.
- **Flujo pago**:
  1. Se elige monto y medio(s) de pago (multi-método permitido).
  2. Efectivo → se imputa **inmediato** a las facturas más antiguas.
  3. Cheque / transferencia → el pago queda registrado pero la imputación se difiere hasta que el valor esté **validado** (cheque en `acreditado`, transferencia con `numero_operacion` confirmado).
  4. Sobrante = saldo a favor del cliente, disponible para futuras compras.
- **Reglas**:
  - Balance actual **excluye** todo movimiento con `origen='historico'` (esos son informativos, ya vienen imputados por fuera).
  - Nunca se sobre-imputa: si el pago > deuda, el excedente queda como saldo a favor.
  - Pagos parciales son válidos.
  - Se permite ajuste manual (débito/crédito) con motivo.
- **Datos**: `cliente_movimientos`, `cliente_movimiento_imputaciones`, `notas_credito_pendientes`.
- **Permisos**: módulo `clientes` (ver/registrar pago).

### 6.3 Pedidos

- **Qué hace**: toma de pedidos con tipos web/reparto/mostrador. Ciclo simple: `pendiente → preparado → despachado`, más `rechazado`.
- **Vistas**: listado con filtros, diálogo nuevo pedido, diálogo editar, diálogo preparar, diálogo cambiar estado, detalle, selector de tipo, consolidado por zona, consolidado final por zona.
- **Flujo**:
  1. Vendedor abre "Nuevo pedido" → elige tipo → selecciona cliente (chequea bloqueo por deuda 30 días) → agrega ítems con precio/descuento manual overrideable.
  2. Sistema alerta si el mismo cliente ya tiene un pedido cargado ese día (no bloquea).
  3. Sistema sugiere productos según histórico del cliente.
  4. Depósito abre "Preparar pedido" y ajusta cantidades reales, admitiendo decimales para pesables (KG). Se calculan excedentes (lo que sobra respecto a lo pedido).
  5. Al confirmar preparación, pasa a `preparado`.
  6. Se puede editar después de `preparado` con reglas específicas (agregar ítems, corregir).
  7. **Estado `despachado` sólo lo setea el módulo Logística cuando la hoja se cierra.**
- **Consolidado**: agrupa pedidos por zona en tres bloques: **Pesables**, **Frescos** (`es_frio=true`), **No pesables**. Imprimible.
- **Reglas**:
  - Nunca setear `despachado` manualmente desde Pedidos.
  - Pesables aceptan decimales; validar parseo (`,` y `.` como separador).
  - Devoluciones y cambios post-entrega van a `pedido_devoluciones` con historial completo.
- **Datos**: `pedidos`, `pedido_detalles`, `pedido_historial`, `pedido_devoluciones`.
- **Permisos**: módulo `pedidos`.

### 6.4 Logística / Reparto

- **Qué hace**: agrupa pedidos preparados en hojas de ruta, gestiona vehículos y controla el ciclo carga → reparto → rendición.
- **Vistas**: listado de hojas, diálogo nueva hoja de ruta, diálogo de carga, detalle de hoja con paradas, diálogos de cobrar/devolver/subsanar/refacturar/rendir, ABM vehículos, pantallas auxiliares "detalle de entregas" y "pendientes por chofer", horarios por zona.
- **Ciclo de una hoja**: `planificada → en_carga → carga_confirmada → en_reparto → cerrada`.
- **Flujo**:
  1. Encargado arma la hoja seleccionando pedidos preparados de una zona/día.
  2. Asigna vehículo y chofer.
  3. Depósito verifica la carga (marca ítem por ítem contra el consolidado).
  4. Chofer sale con la hoja. En cada parada puede: **cobrar**, **devolver producto**, **rechazar el pedido completo**.
  5. Al volver, el chofer rinde: total efectivo entregado + valores + diferencia contra lo esperado.
  6. Al confirmar cierre, cada pedido pasa **automáticamente** a `despachado` y se genera la venta + comprobante AFIP + movimiento de CC del cliente.
- **Refacturación**: si un producto/cantidad cambió post-entrega, se puede rehacer la factura de esa venta desde la hoja.
- **Subsanar cobro**: corregir montos/medios de cobros mal cargados en la calle.
- **Reglas**:
  - Auto-completado de estado al alcanzar terminales.
  - Fetching desacoplado por si algún dato legacy tiene FKs faltantes (no romper la UI).
  - Datos legacy (`origen=historico`) se muestran en histórico pero **no afectan** balances actuales.
- **Datos**: `hojas_ruta`, `hoja_ruta_paradas`, `hoja_ruta_carga_items`, `hoja_ruta_cobros`, `hoja_ruta_devoluciones`, `hoja_ruta_ventas_rechazados`, `hoja_ruta_rendiciones`, `hoja_ruta_refacturaciones`, `vehiculos`.
- **Permisos**: módulo `logistica` (encargado, admin, deposito).

### 6.5 App móvil encargado/chofer

- **Qué hace**: cliente móvil que usa **el mismo backend** con las mismas policies RLS. El chofer/encargado ejecuta el reparto desde el celular.
- **Tabs**: Carga, Paradas, Rendición, Resumen Cobros, Stock Rechazado.
- **Interacciones clave**: sheets modales para cobrar / devolver por parada, foto de comprobante con cámara nativa, sincronización online (idealmente con reintentos).
- **Autenticación**: el empleado tiene un `user_id` linkeado a la tabla `empleados`. Las policies RLS filtran por `get_empleado_id(auth_user)` para que cada chofer vea sólo sus hojas/paradas/cobros.
- **Permisos**: rol `encargado` (o `chofer` si se separan).

### 6.6 Facturación AFIP

- **Qué hace**: emite comprobantes fiscales (A/B/C y sus NC) contra el WSFE de AFIP; almacena CAE + QR; permite anular con NC total o parcial.
- **Vistas**: pantalla de facturación (listado con filtros por fecha/tipo/estado), wizard de NC parcial, panel de resoluciones pendientes.
- **Flujo emisión** (ejecutado al cerrar venta):
  1. Determinar tipo de comprobante según condición IVA del emisor (siempre RI) y del receptor:
     - Receptor RI → **Factura A**
     - Receptor Monotributo / Exento / Consumidor Final → **Factura B**
     - Emisor Monotributo → **Factura C** (si aplica)
  2. Armar payload con detalle de neto, IVA por alícuota, percepciones si corresponden.
  3. Llamar WSFE `FECAESolicitar` con token cacheado.
  4. Guardar `cae`, `cae_vto`, `numero`, `qr` en `comprobantes_afip`.
  5. Imprimir A5 o ticket térmico 80mm con QR.
- **NC total**: anula la factura y compensa la CC del cliente (o dispara resolución pendiente si era contado).
- **NC parcial**: wizard donde se eligen ítems + cantidades de la factura original. Guarda en `nota_credito_items`. Nunca usar el literal `NCR`; siempre `nota_credito`.
- **Resoluciones pendientes**: cuando la factura anulada era **contado**, hay que devolver el dinero. Panel para resolver con efectivo, cheque nuevo o transferencia.
- **Certificados**: guardar clave privada + certificado AFIP como secretos del entorno, nunca en el repo. Ambiente auto según `configuracion_comercio.ambiente_afip` (producción / homologación).
- **Datos**: `comprobantes_afip`, `notas_credito_pendientes`, `nota_credito_items`, `afip_tokens`, `configuracion_comercio`.
- **Permisos**: `admin`, `encargado`. Vendedor con permisos acotados si aplica.

### 6.7 Ventas (consulta unificada)

- **Qué hace**: vista consolidada de todo lo vendido (contado + CC + con y sin pedido asociado) con filtros de fecha/cliente/vendedor/medio de pago.
- **Escalabilidad**: implementar como procedimiento servidor que devuelva la lista ya paginada y agregada. No traer todo al cliente.
- **Permisos**: módulo `ventas`.

### 6.8 Proveedores

- **Qué hace**: ABM proveedores, CC con 4 medios de pago (efectivo, transferencia, cheque de terceros por endoso, cheque propio), órdenes de compra con detalle e importadores.
- **Reglas**: pago con cheque de terceros cambia el estado del cheque a `entregado_a_proveedor` y registra la salida.
- **Permisos**: módulo `proveedores`.

### 6.9 Cheques

- **Qué hace**: gestión completa del ciclo de vida del cheque de terceros y propio.
- **Estados (7)**:
  1. `pendiente_validacion` — recién recibido, sin confirmar datos.
  2. `cartera` — validado, en poder de la empresa.
  3. `depositado` — depositado en banco, esperando acreditar.
  4. `acreditado` — cobrado. Recién acá se **imputa** en la CC del cliente.
  5. `rechazado` — devuelto por el banco. Reactiva la deuda.
  6. `endosado` — endosado a un tercero.
  7. `entregado_a_proveedor` — usado para pagar a un proveedor.
- **Cada cambio de estado deja registro** en `cheque_historial` con usuario y timestamp.
- **Vistas**: listado con filtros por estado/banco/fecha, diálogo nuevo, diálogo cambiar estado, diálogo historial.
- **Permisos**: `admin`, `encargado`.

### 6.10 Transferencias

- **Qué hace**: registro de transferencias bancarias como medio de pago del cliente.
- **Reglas**:
  - `numero_operacion` es **único**: bloquea duplicados (dos personas cargando la misma).
  - Se puede adjuntar comprobante (imagen). Función serverless con IA de visión extrae automáticamente el `numero_operacion` y datos clave del comprobante para reducir errores de carga.
  - La imputación en CC se dispara cuando la transferencia queda confirmada.
- **Permisos**: módulo `cobros`.

### 6.11 Listas de precios

- **Qué hace**: N listas (Mayorista, Consumidor, Especial, etc.) con porcentaje sobre base + excepciones por producto.
- **Vistas**: listado, detalle por lista con tabla de productos y precios finales.
- **Reglas**:
  - Cada cliente tiene una lista asignada.
  - Precio final = precio_base × (1 + porcentaje_lista) salvo que exista excepción para ese producto.
  - Actualizador masivo para subir precios en bloque.
  - Sync opcional con lista de precios de proveedor externo.

### 6.12 Zonas / Vendedores

- **Zonas**: definen el territorio de reparto y agrupan clientes. Tienen horarios (`zona_horarios`) que restringen días de entrega.
- **Vendedores**: asignados a una o varias zonas (`vendedor_zonas`). Cada cliente tiene un vendedor asignado que es el que ve sus pedidos y comisiones.
- **Agenda de visitas comerciales**: calendario de visitas planificadas y realizadas, con formulario de incidencias (sin venta, cliente cerrado, quejas, etc.).
- **Objetivos**: por vendedor y por zona, con seguimiento mensual.
- **Productos foco**: lista de productos priorizados por vendedor para empujar en la visita.

### 6.13 Productos (mínimo para B2B)

- ABM con: SKU, nombre, descripción, marca, tipo, categoría, subcategoría, unidad de medida (`unidad` | `kg`), flag `es_frio` (marca los frescos para el consolidado), stock actual, precio base, activo.
- Movimientos de inventario por venta / devolución / ajuste, con motivo y usuario.
- Impresión de etiquetas de precios.
- Importador de productos fríos.
- ABM auxiliares: marcas, tipos, categorías, subcategorías.

### 6.14 Roles y permisos

- Tabla `roles` dinámica con flag `es_sistema` que protege los cinco roles core del borrado.
- Editor de matriz `role × módulo × permiso` para admin.
- Consulta desde front y desde policies RLS mediante función *security definer*.

### 6.15 Impresión

- **Remito** (formato "ORO"): layout fijo, duplicado, dimensiones específicas. **No modificar el layout**, sólo cambiar los datos.
- **Factura A5**: formato fijo de 10 filas de detalle. Si el pedido tiene más de 10 ítems, se paginan.
- **Ticket térmico 80mm**: para tickets de venta con QR AFIP cuando aplica.
- **Recibo de pago**: comprobante entregado al cliente al recibir un pago.
- **Consolidado por zona**: impresión que usa Depósito para preparar todos los pedidos de una zona/día agrupados por tipo (pesables / frescos / secos).

---

## 7. Circuitos end-to-end

### 7.1 Pedido → entrega → cobro → venta → factura

```text
Vendedor arma pedido
   → chequeo bloqueo por deuda (>30 días o umbral configurado)
   → alerta duplicado del día si aplica
   → guardar (pedidos + pedido_detalles, estado 'pendiente')

Depósito prepara
   → ajusta cantidades reales (KG decimales)
   → pedido pasa a 'preparado'

Encargado arma hoja de ruta con pedidos preparados de una zona
   → asigna vehículo + chofer
   → hoja 'planificada' → 'en_carga'
   → depósito verifica carga → 'carga_confirmada' → 'en_reparto'

Chofer visita parada
   ├── Cobra (efectivo / cheque / transferencia) → hoja_ruta_cobros
   ├── Devuelve producto → hoja_ruta_devoluciones
   └── Rechaza pedido completo → hoja_ruta_ventas_rechazados

Chofer vuelve y rinde
   → hoja_ruta_rendiciones (esperado vs entregado)
   → hoja 'cerrada'

Al cerrar la hoja, por cada pedido entregado:
   → pedido pasa AUTOMÁTICAMENTE a 'despachado'
   → se crea 'venta' + 'venta_detalles' (+ 'venta_pagos' si fue contado en calle)
   → se emite comprobante AFIP (A/B/C) → comprobantes_afip
   → si fue CC: se crea cliente_movimientos tipo 'compra' con saldo_pendiente = total
   → si hubo cobro: se dispara imputación FIFO (efectivo inmediato,
                     cheque/transferencia diferido hasta validación)
```

### 7.2 NC parcial post-entrega

```text
Admin abre "Nota de crédito parcial" sobre una factura ya emitida
   → wizard: elegir ítems + cantidades a acreditar
   → calcular neto/IVA a acreditar
   → llamar WSFE para emitir NC A/B/C con mismo receptor
   → guardar comprobantes_afip (tipo NC) + nota_credito_items
   → si la factura original fue CC:
        → crear cliente_movimientos tipo 'nota_credito'
        → imputar FIFO contra facturas pendientes
   → si fue contado:
        → crear resolución pendiente (efectivo / cheque / transferencia)
        → panel resoluciones pendientes muestra hasta que se resuelva
```

### 7.3 Pago del cliente con imputación FIFO

```text
Registrar pago
   → elegir monto total + uno o varios medios de pago
   → efectivo: cliente_movimientos tipo 'pago', imputar YA a FAC más viejas
   → cheque: alta en 'cheques' con estado inicial y cliente emisor
        → NO imputa todavía; espera acreditación
   → transferencia: alta en 'transferencias' validando numero_operacion único
        → imputa al confirmar
   → si el pago excede la deuda → saldo a favor (queda como movimiento
                                   pago con saldo_pendiente negativo o NC pendiente)
```

### 7.4 Pago a proveedor con cheque propio

```text
Registrar pago a proveedor
   → elegir medio: cheque_propio
   → generar cheque propio (número correlativo, banco propio)
   → guardar en 'cheques' con estado 'entregado_a_proveedor'
   → proveedor_movimientos tipo 'pago' con referencia al cheque
```

---

## 8. Reglas invariantes (no negociables)

1. **`despachado` sólo lo setea Logística.** Ninguna otra pantalla ni acción manual puede setearlo.
2. **`origen='historico'` se excluye** de todo cálculo de balance actual. Es sólo informativo.
3. **Roles en tabla aparte** (`user_roles`), nunca en `profiles`, y consultados con función *security definer* para evitar recursión de RLS y escalación.
4. **Imputación diferida** para valores no confirmados (cheques hasta `acreditado`, transferencias hasta confirmar `numero_operacion`).
5. **Layout del remito "ORO" congelado**: se pueden cambiar los datos pero no dimensiones, duplicado, estilos.
6. **`numero_operacion` de transferencia es único** — bloquea duplicados a nivel BD.
7. **RLS activo + GRANTs explícitos** en cada tabla del esquema público. Una tabla sin GRANT es inaccesible aunque la policy sea correcta.
8. **Todas las escrituras críticas son transaccionales del lado servidor.** El cliente no orquesta multi-tabla.
9. **Bypass del límite 1K** del BaaS con paginado recursivo por rangos. No usar `IN(...)` con listas largas.
10. **Ticket A5 de factura**: siempre 10 filas de detalle por página; si sobra, se pagina.
11. **Nunca guardar credenciales sensibles** (certificados AFIP, tokens, claves de API) en el repo o en `localStorage`. Van en el sistema de secretos del entorno.
12. **NC parcial se guarda como `nota_credito`**, nunca como `NCR` u otro literal.

---

## 9. Integraciones externas

- **AFIP WSFE / WSAA** (Argentina): emisión de facturas y NC. Requiere certificado + clave privada. Cachear tokens (`afip_tokens`) hasta expiración. Manejar reintentos y errores tipificados.
- **AI Vision (extractor de comprobantes)**: función serverless que recibe imagen de comprobante de transferencia y devuelve datos clave (`numero_operacion`, monto, banco). Reduce errores de carga manual.
- **Impresión térmica 80mm**: para recibos y tickets. Con QR AFIP cuando el comprobante lo tiene.
- **Impresión A5**: para factura formal con detalle fijo.
- **Impresión A4/oficio**: para el remito ORO y consolidados por zona.

---

## 10. Seguridad y multi-tenant

- RLS por tabla, con policies que combinan `auth.uid()` + rol via `has_role()`.
- GRANTs explícitos por tabla y por rol de aplicación (`anon`, `authenticated`, `service_role` o equivalentes).
- Función `has_role(user, role)` **security definer** con `search_path` fijado en `public` para evitar recursión.
- Función `has_permission(user, modulo, permiso)` para checks granulares.
- Función `get_empleado_id(user)` para que la app móvil scoping cada chofer a sus datos.
- Nunca exponer claves de servicio al cliente.
- Nunca hacer chequeos de admin mirando `localStorage` o data del cliente: siempre en el servidor.

---

## 11. Importadores Excel (formato y reglas)

Todos los importadores comparten patrón:
- Preview de las primeras N filas con mapeo de columnas.
- Validación por fila con mensajes de error específicos.
- Procesamiento por lotes de ~5.000 filas, insertando en batches de 100.
- Reporte final: creadas / actualizadas / ignoradas / con error.

**Importadores requeridos:**

| Importador | Columnas mínimas | Reglas |
|---|---|---|
| Alta masiva clientes | codigo, razon_social, cuit, direccion, telefono, zona, condicion_iva | Auto-provisiona zonas faltantes. Asigna lista "Mayorista" por defecto. |
| CC actual clientes | codigo_cliente, fecha, tipo (FAC/REC/NC), numero, monto | Todos los movimientos como `origen='actual'`. |
| Deudas granulares | codigo_cliente, fecha, numero_factura, monto_pendiente | Auto-provisiona cliente si no existe. Marca como pendiente. |
| Pagos bancarios | fecha, numero_operacion, monto, cliente | Chequea duplicados por `numero_operacion`. |
| Historial legacy | codigo_cliente, fecha, tipo, monto | Marca `origen='historico'`. **No afecta balance actual.** |
| Productos fríos | sku, descripcion, precio, marca | Setea `es_frio=true`. |
| Alta proveedores | razon_social, cuit, condicion_iva, contacto | ABM masivo. |
| CC proveedores | codigo_proveedor, fecha, tipo, numero, monto | Mismo patrón que CC clientes. |

---

## 12. Checklist plano de features (para tracking)

```text
[ ] Auth email + password, sin auto-registro público
[ ] Roles dinámicos en tabla + role_permissions granulares
[ ] Función has_role security definer
[ ] Función has_permission
[ ] Función get_empleado_id (linkage app móvil)
[ ] RLS + GRANTs en todas las tablas del esquema público
[ ] ABM Clientes con datos fiscales
[ ] Asignación cliente ↔ zona ↔ vendedor ↔ lista de precios
[ ] Bloqueo cliente por deuda (facturas impagas + monto umbral)
[ ] CC cliente con imputación FIFO
[ ] Imputación diferida cheques/transferencias
[ ] NC pendientes por aplicar
[ ] Importador clientes
[ ] Importador CC actual
[ ] Importador deudas granulares
[ ] Importador pagos bancarios
[ ] Importador historial legacy (origen=historico excluido de balance)
[ ] ABM Zonas + horarios
[ ] ABM Vendedores + vendedor_zonas
[ ] Agenda de visitas comerciales
[ ] Formulario de incidencias en visita
[ ] Objetivos por vendedor / zona
[ ] Productos foco por vendedor
[ ] ABM Listas de precios (porcentaje + excepciones)
[ ] Actualizador masivo de precios
[ ] ABM Productos (SKU, marca, tipo, categoría, subcategoría, unidad, es_frio, stock)
[ ] ABM Marcas / Tipos / Categorías / Subcategorías
[ ] Movimientos de inventario
[ ] Impresión etiquetas de precios
[ ] Pedidos: alta con tipos web/reparto/mostrador
[ ] Pedidos: preparación con decimales KG y excedentes
[ ] Pedidos: precio/descuento manual por línea
[ ] Pedidos: alerta duplicados diarios
[ ] Pedidos: sugerencias por histórico
[ ] Pedidos: bloqueo por deuda 30 días
[ ] Pedidos: edición post-preparado con reglas
[ ] Pedidos: historial de estados
[ ] Consolidado por zona: Pesables / Frescos / No pesables
[ ] ABM Vehículos
[ ] Hojas de ruta con ciclo planificada→en_carga→carga_confirmada→en_reparto→cerrada
[ ] Carga verificada por depósito
[ ] Paradas con cobrar/devolver/rechazar
[ ] Rendición del chofer (esperado vs entregado)
[ ] Refacturación por producto
[ ] Subsanar cobro
[ ] Auto-transición pedido a 'despachado' al cerrar hoja
[ ] Detalle de entregas + pendientes por chofer
[ ] App móvil chofer: tabs Carga/Paradas/Rendición/Resumen/Stock rechazado
[ ] App móvil: sheets cobrar/devolver por parada
[ ] App móvil: foto de comprobante con cámara nativa
[ ] Facturación AFIP WSFE producción + homologación
[ ] Tipo comprobante auto A/B/C según condición IVA
[ ] Ticket térmico 80mm con QR AFIP
[ ] Factura A5 (10 filas fijas)
[ ] Remito ORO (layout congelado)
[ ] NC total (anula + compensa CC)
[ ] NC parcial wizard con selección de ítems/cantidades
[ ] Resoluciones pendientes (efectivo/cheque/transferencia)
[ ] Cache de tokens AFIP
[ ] ABM Cheques con 7 estados + historial
[ ] Alta cheque desde cobros/POS
[ ] Cambio de estado con auditoría
[ ] Transferencias con numero_operacion único
[ ] AI Vision para extraer datos del comprobante de transferencia
[ ] ABM Proveedores
[ ] CC proveedor con 4 medios de pago
[ ] Cheque propio como pago a proveedor (estado 'entregado_a_proveedor')
[ ] Endoso cheque de terceros a proveedor
[ ] Órdenes de compra con detalle
[ ] Importadores proveedores + CC proveedor
[ ] Ventas: consulta unificada vía procedimiento servidor paginado
[ ] Configuración del comercio (fiscal, ambiente AFIP, umbrales)
[ ] Sucursales (multi-sucursal si aplica)
[ ] Secretos del entorno para certificados/keys (nunca en repo)
[ ] Paginado recursivo por rangos (bypass límite 1K)
```

---

## 13. Orden sugerido de implementación

**Fase 1 — Núcleo comercial**
1. Auth + roles + permisos + RLS + GRANTs.
2. Zonas, Vendedores, Listas de precios, Productos.
3. Clientes + asignaciones + bloqueo por deuda.
4. CC cliente + imputación FIFO (sin AFIP todavía).
5. Pedidos + preparación + consolidado por zona.
6. Importadores clientes / CC / historial.

**Fase 2 — Logística y app móvil**
1. Vehículos + hojas de ruta + carga.
2. Paradas + cobros + devoluciones + rechazos.
3. Rendición + auto-transición a `despachado` + generación de venta.
4. App móvil chofer con tabs y sheets.
5. Detalle de entregas y pendientes por chofer.

**Fase 3 — Facturación**
1. Integración WSFE (homologación primero).
2. Emisión A/B/C con impresión térmica 80mm y A5.
3. NC total con compensación CC + resolución pendiente.
4. Wizard NC parcial.
5. Remito ORO.

**Fase 4 — Valores y proveedores**
1. Cheques con 7 estados + historial.
2. Transferencias con `numero_operacion` único.
3. AI Vision para extraer comprobantes.
4. Proveedores + CC + órdenes de compra + pago con cheque propio/endoso.

**Fase 5 — Pulido**
1. Reportes de ventas y CC.
2. Agenda de visitas + objetivos + productos foco.
3. Actualizador masivo de precios.
4. Multi-sucursal si corresponde.

---

> Fin del prompt. Todo lo que aparece acá es lo que el sistema **debe** hacer en la operación mayorista. Cualquier cosa fuera de esta lista queda deliberadamente fuera del alcance inicial y se evalúa aparte.