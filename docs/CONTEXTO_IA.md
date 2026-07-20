# Contexto del Proyecto — Sistema de Gestión Comercial (LasinRival)

> Documento diseñado para pegar en otra IA (ChatGPT, Claude, Gemini, Antigravity, Cursor, etc.) y darle contexto completo del proyecto sin necesidad de leer el código.

---

## 1. Identidad del sistema

- **Tipo**: ERP/POS comercial multi-módulo para un mayorista/minorista de alimentos en Argentina.
- **Uso real**: en producción. Facturación electrónica AFIP en ambiente productivo.
- **Usuarios**: administradores, encargados, cajeros, vendedores, personal de depósito y choferes/repartidores (via APK móvil).
- **Alcance**: ventas mostrador (POS), pedidos web/reparto, logística de entrega, cuenta corriente de clientes/empleados/proveedores, cajas, cheques, transferencias, facturación AFIP con notas de crédito, y reportes.

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| UI | TailwindCSS v3 + shadcn/ui (Radix) |
| Estado servidor | TanStack Query |
| Ruteo | react-router-dom |
| Formularios | react-hook-form + zod |
| Backend | Lovable Cloud (Supabase por debajo): Postgres + Auth + Storage + Edge Functions (Deno) |
| Móvil | Capacitor (APK Android para encargados/choferes) |
| Impresión | Térmica 80mm (tickets) y A4/A5 (remitos, facturas, recibos) |
| AFIP | WSFE producción vía Edge Function con certificados en secrets |
| IA | Lovable AI Gateway (Gemini Vision para OCR de comprobantes) |

---

## 3. Arquitectura de datos

### 3.1 Flujo típico
```text
UI (páginas/components)
   ↓ hooks (useX.ts) o supabase.from(...)
Supabase JS client  ──►  Postgres (RLS + Policies + RPC)
                          │
                          └─►  Edge Functions (AFIP, push, descuentos, APIs externas)
```

### 3.2 Seguridad
- **RLS obligatorio** en toda tabla `public.*` + GRANTs explícitos por rol.
- **Roles dinámicos** en tabla `roles` (NO enum), chequeados vía función SECURITY DEFINER `has_role(user, role)` sobre `user_roles` (NUNCA en el perfil, para evitar escalación de privilegios).
- **Permisos por módulo** en `role_permissions (role, modulo, permiso)` con enum `app_permission` (`ver`, `crear`, `editar`, `eliminar`, `anular`, `exportar`), consultados con RPC `has_permission()` desde front y RLS.
- Helpers: `has_role`, `has_any_role`, `is_route_owner`, `is_stop_owner`, `is_route_responsable`, `get_empleado_id`.

### 3.3 Reglas de datos críticas
- **Bypass límite 1K de Supabase**: siempre paginar con `.range()` recursivo. Evitar `.in()` largos (rompen URL).
- **`origen = 'historico'`**: registros importados legacy, se **excluyen** del cálculo de balances actuales.
- **Idempotencia**: las RPCs de escritura sensible (`pos_registrar_venta`) borran/re-insertan pagos y movimientos al re-procesar un pedido, para evitar duplicados.

---

## 4. Módulos principales

| Módulo | Páginas clave | Función |
|---|---|---|
| **POS** | `POS.tsx` | Venta mostrador: carrito, split de pagos, factura AFIP, ticket térmico. |
| **Pedidos** | `Pedidos.tsx`, `NuevoPedidoDialog` | Toma de pedidos web/reparto/mostrador, preparación, consolidado por zona. |
| **Logística** | `Logistica.tsx`, `Encargado.tsx` | Hojas de ruta, carga, entregas, cobros en calle, rendición, devoluciones. |
| **Facturación** | `Facturacion.tsx`, `NotaCreditoParcialWizard` | Emisión AFIP, NC total/parcial, resoluciones financieras pendientes. |
| **Ventas** | `Ventas.tsx` | Consulta unificada ventas + pedidos (RPC `get_ventas_lista`). |
| **Cajas** | `Cajas.tsx` | Apertura, movimientos, arqueo con confirmación en 2 pasos. |
| **Clientes / Empleados / Proveedores** | `Clientes.tsx`, `Empleados.tsx`, `Proveedores.tsx` | Alta + Cuenta Corriente + importadores Excel. |
| **Cheques / Transferencias / Clover** | `Cheques.tsx`, `Clover.tsx`, `Imputacion.tsx` | Ciclo de vida de valores. |
| **Descuentos PWA** | `AdminDescuentos.tsx` | Token rotativo 6 chars para autorizar descuentos desde POS. |
| **Config** | `Configuracion.tsx`, `Roles.tsx`, `Tarjetas.tsx`, `ListasPrecios.tsx` | Parámetros, roles/permisos, listas y descuentos. |

---

## 5. Circuitos comerciales

### 5.1 Venta directa en POS (contado)
```text
Productos → Carrito → Cliente (opcional) → "Cobrar"
 → Diálogo pagos (efectivo/tarjeta/transferencia/cheque/Clover, multi-medio)
 → Diálogo AFIP (tipo A/B/C, condición IVA)
 → RPC pos_registrar_venta (transacción única):
     · ventas + venta_detalles + venta_pagos
     · descuenta stock + movimientos_inventario
     · movimientos_caja (ingreso)
     · transferencias / cheques si aplica
 → Edge Function afip-facturacion/emitir → CAE
 → comprobantes_afip (venta_id, CAE, QR, importes)
 → Ticket térmico 80mm con QR AFIP
```

### 5.2 Venta en cuenta corriente cliente
Igual a 5.1 pero **sin `venta_pagos` ni movimiento de caja**; se agrega `cliente_movimientos` tipo `compra`. La facturación AFIP se ofrece igual (opción 1 aprobada). Ticket muestra "Cond. Venta: Cuenta Corriente".

### 5.3 Pedido → Entrega → Cobro (reparto)
```text
NuevoPedido → pedidos + pedido_detalles ('pendiente')
 → PrepararPedido (ajusta cantidades reales) → 'preparado'
 → HojaRuta ('planificada' → 'en_carga')
 → CargaTab (encargado verifica) → 'carga_confirmada'
 → Reparto: ParadaSheet
     · Cobra → hoja_ruta_cobros
     · Devuelve → hoja_ruta_devoluciones
     · Rechaza → hoja_ruta_ventas_rechazados
 → Rendición del chofer → hoja_ruta_rendiciones
 → Pedido pasa a 'despachado' AUTOMÁTICAMENTE desde Logística (regla core)
 → Genera venta + factura AFIP (si aplica) + cliente_movimientos compra
```

### 5.4 Facturación y Notas de Crédito
- **Emisión**: Edge function `afip-facturacion` (WSFE prod, secrets `AFIP_CERT_PROD` / `AFIP_PRIVATE_KEY_PROD`). Ambiente auto-cambia según `configuracion_comercio.afip_ambiente`.
- **NC total**: anula factura y compensa CC.
- **NC parcial**: wizard `NotaCreditoParcialWizard` con `nota_credito_items` (elige ítems/cantidades). Inserta `cliente_movimientos` con tipo `nota_credito` (NUNCA `NCR`).
- **Resolución financiera automática**:
  - Venta original en CC → crédito en CC (informativo).
  - Venta original contado → egreso en caja (vendedor: su caja; admin: puede elegir).
- Regla AFIP: `DocTipo=99` (consumidor final) requiere `DocNro=0`; se normaliza en la edge function.

---

## 6. Módulos financieros

### 6.1 Cajas
- Apertura con saldo inicial → movimientos (`ingreso`, `egreso`, ventas automáticas).
- **Vendedor NO puede** hacer Ingreso/Egreso manuales.
- Cierre: `diferencia = arqueo - esperado`. RPC `confirmar_arqueo_con_ajuste` (2 pasos). Si el admin imputa la diferencia, se crea `empleado_movimientos` (faltante o sobrante).

### 6.2 Cuenta Corriente
- **Cliente**: `cliente_movimientos` (compra, pago, nota_credito, ajuste). Balance suma sólo `origen <> 'historico'`.
- **Empleado**: `empleado_movimientos` + `empleado_liquidaciones`.
- **Proveedor**: `proveedor_movimientos` con 4 medios (efectivo, transferencia, cheque terceros, cheque propio).

### 6.3 Imputación de pagos
- FIFO: pagos (REC) y NC contra facturas (FAC) más antiguas.
- Efectivo: instantáneo. Cheque/Transferencia: imputa recién cuando el valor se valida.
- Tabla: `cliente_movimiento_imputaciones`.

### 6.4 Cheques (7 estados)
`pendiente_validacion → cartera → depositado → acreditado / rechazado`, y `endosado`, `entregado_a_proveedor`. Historial completo en `cheque_historial`.

### 6.5 Transferencias
- Se valida `numero_operacion` para evitar duplicados.
- OCR con **Gemini Vision** vía edge function `extraer-numero-operacion`.
- Pendientes/validadas/rechazadas gestionadas en `Imputacion.tsx` con modal de detalle + comprobante en Storage.

---

## 7. Roles del sistema

| Rol | Puede |
|---|---|
| **admin** | Todo |
| **encargado** | Logística, carga, hojas de ruta, cajas |
| **cajero** | POS, cajas, imputación |
| **vendedor** | POS (con restricciones), pedidos, ver/emitir NC, imprimir precios |
| **deposito** | Preparación de pedidos, stock |

---

## 8. Reglas invariantes (NO romper)

1. **Layout de remitos ORO** (`src/lib/imprimirRemito.ts`): dimensiones, duplicado y estilos bloqueados — sólo cambiar datos.
2. Estado `despachado` de pedidos SÓLO lo setea Logística automático — nunca manual.
3. `origen = 'historico'` se excluye de balances actuales.
4. Bypass 1K de Supabase con `.range()` recursivo. Evitar `.in()` largos.
5. Radix UI: usar `Sheet` en formularios complejos y `React.forwardRef` para evitar loops de render.
6. Roles: SIEMPRE en tabla separada (`user_roles`), nunca en `profiles`.
7. Nunca editar `src/integrations/supabase/client.ts`, `types.ts`, `.env`, `supabase/config.toml` (auto-gen).
8. Ventas: usar RPC transaccional `pos_registrar_venta` (idempotente para evitar duplicados por doble click).
9. Guard anti-doble-click: usar `useRef` sincrónico además de `useState` en botones de confirmación.

---

## 9. Edge Functions relevantes

| Función | Uso |
|---|---|
| `afip-facturacion` | Emisión WSFE (Factura A/B/C, NC), consulta CAE |
| `api-productos` | API pública inventario (x-api-key) |
| `api-logistica` | API móvil chofer |
| `solicitar-descuento` / `validar-token-descuento` / `aprobar-descuento` | Flujo PWA descuentos con token 6 chars |
| `send-push-notification` / `manage-push-subscription` | Push a móviles |
| `extraer-numero-operacion` | OCR de comprobantes de transferencia (Gemini Vision) |
| `chat-asistente` | Asistente IA embebido |
| `admin-users` | Gestión de usuarios admin |

---

## 10. Estado de avance (~88%)

**Completo**: registro de ventas, pedidos, facturación AFIP + NC, logística, devoluciones, cajas, cuentas corrientes cliente/empleado/proveedor, cheques, transferencias, roles/permisos, importadores Excel, impresión térmica/A4, PWA descuentos, app móvil encargado, sincronización de versiones (SW v7 + banner).

**Pendiente / parcial**: presupuestos, reportes avanzados (rentabilidad, stock valorizado, clientes inactivos), geolocalización con mapa en tiempo real, notas de débito manuales.

---

## 11. Convenciones de código

- Componentes funcionales + hooks. Un archivo por responsabilidad.
- Imports absolutos desde `@/`.
- Tokens de color/tipografía en `src/index.css` y `tailwind.config.ts` — **nunca** hardcodear colores (`text-white`, `bg-[#...]`) en componentes.
- Cliente Supabase: `import { supabase } from "@/integrations/supabase/client"`.
- Idioma UI: español (Argentina). Moneda: ARS con separador `.` para miles y `,` para decimales.
- Fechas: parsear como local (Argentina) para evitar offset UTC en pantallas de reporte.

---

## 12. Cómo pedirle cambios a otra IA

Al copiar este documento a otra IA, aclarar:
- Stack fijo: **React + Vite + TS + Tailwind + shadcn + Supabase**. No sugerir Next/Vue/Angular.
- Backend real es **Supabase** pero al usuario final se le dice "Lovable Cloud / backend".
- Cualquier tabla nueva en `public` necesita **RLS + policies + GRANTs** en la misma migración.
- No proponer guardar roles en `profiles` (escalación de privilegios).
- Respetar el layout del remito ORO y el estado `despachado` automático.

---

_Última actualización: julio 2026._