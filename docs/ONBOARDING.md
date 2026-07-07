# Guía del sistema — Onboarding paso a paso

Documento de referencia para nuevas personas en el proyecto.

---

## 1. Arquitectura general

**Stack**
- Frontend: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui.
- Backend: Lovable Cloud (Supabase por debajo) → Postgres + Auth + Storage + Edge Functions (Deno).
- Móvil: Capacitor (APK para encargados/choferes).
- Estado servidor: TanStack Query. Ruteo: react-router-dom. Formularios: react-hook-form + zod.

**Flujo de datos típico**
```text
UI (páginas/components)
   ↓ hooks (useX.ts) o supabase.from(...)
Supabase JS client  ──►  Postgres (con RLS + Policies + RPC)
                          │
                          └─►  Edge Functions (AFIP, push, descuentos, APIs externas)
```

**Autenticación**: `src/contexts/AuthContext.tsx` mantiene `user`, `profile`, `roles` y expone `hasRole`, `hasPermission` (RPC `has_permission`). Toda ruta pasa por `ProtectedRoute` en `App.tsx`.

**Seguridad en BD**: cada tabla `public.*` tiene RLS + policies + GRANTs. Los chequeos de rol se hacen con la función SECURITY DEFINER `has_role(user, role)` sobre `user_roles` (nunca sobre el perfil).

---

## 2. Módulos principales (mapa mental)

| Área | Páginas clave | Para qué sirve |
|---|---|---|
| **POS** | `POS.tsx` | Ventas mostrador: carga carrito, cobra, factura AFIP, imprime ticket. |
| **Pedidos** | `Pedidos.tsx`, `NuevoPedidoDialog` | Toma de pedidos (web/reparto/mostrador), preparación, consolidado. |
| **Logística** | `Logistica.tsx`, `Encargado.tsx` | Hojas de ruta, carga, entregas, cobros, rendición, devoluciones. |
| **Facturación** | `Facturacion.tsx`, `NotaCreditoParcialWizard` | Emisión AFIP, notas de crédito, resoluciones pendientes. |
| **Ventas** | `Ventas.tsx` | Consulta unificada ventas + pedidos (RPC `get_ventas_lista`). |
| **Cajas** | `Cajas.tsx` | Apertura, movimientos, arqueo con confirmación en 2 pasos. |
| **Clientes / Empleados / Proveedores** | `Clientes.tsx`, `Empleados.tsx`, `Proveedores.tsx` | Alta + Cuenta Corriente + importadores Excel. |
| **Cheques / Transferencias / Clover** | `Cheques.tsx`, `Clover.tsx` | Ciclo de vida de valores. |
| **Config** | `Configuracion.tsx`, `Roles.tsx`, `Tarjetas.tsx`, `ListasPrecios.tsx` | Parámetros del comercio, roles/permisos, listas y descuentos. |
| **Descuentos PWA** | `AdminDescuentos.tsx` | Token rotativo 6 chars para autorizar descuentos desde el POS. |

---

## 3. Circuito comercial completo

### 3.a Venta directa en POS (pago contado)
```text
Selección productos → Carrito → Elegir cliente (opcional)
   → Botón "Cobrar" → Diálogo pagos (efectivo/tarjeta/transferencia/cheque/Clover)
   → Diálogo Factura AFIP (tipo A/B/C, condición IVA)
   → RPC pos_registrar_venta (transacción única):
        · crea `ventas` + `venta_detalles` + `venta_pagos`
        · descuenta stock + crea `movimientos_inventario`
        · crea `movimientos_caja` (ingreso)
        · si aplica, inserta `transferencias` / `cheques`
   → Edge Function afip-facturacion/emitir → CAE
   → Inserta `comprobantes_afip` (venta_id, CAE, QR, importes)
   → Imprime ticket térmico 80mm (con QR AFIP si hay factura)
```

### 3.b Venta en Cuenta Corriente (cliente)
Igual al 3.a pero sin `venta_pagos` ni movimiento de caja; se agrega `cliente_movimientos` tipo `compra`. La facturación AFIP se ofrece igual que en pago directo. El ticket muestra "Cond. Venta: Cuenta Corriente".

### 3.c Pedido → Entrega → Cobro (circuito reparto)
```text
Pedidos.NuevoPedido  → pedidos + pedido_detalles (estado 'pendiente')
   → PrepararPedido (ajusta cantidades reales)  → estado 'preparado'
   → Se agrupa en Logística: HojaRuta (estado 'planificada' → 'en_carga')
   → CargaTab (encargado verifica ítems)         → 'carga_confirmada'
   → Reparto en calle: ParadaSheet
        · Cobra (efectivo/transf/cheque)  → hoja_ruta_cobros
        · Devuelve  → hoja_ruta_devoluciones
        · Rechaza   → hoja_ruta_ventas_rechazados
   → Rendición del chofer → hoja_ruta_rendiciones
   → Pedido pasa a 'despachado' AUTOMÁTICAMENTE desde Logística (regla core)
   → Se genera venta + factura AFIP (si aplica) + `cliente_movimientos` compra
```

### 3.d Facturación y Notas de Crédito
- Emisión: Edge function `afip-facturacion` (WSFE producción, cert en secrets `AFIP_CERT_PROD` / `AFIP_PRIVATE_KEY_PROD`). Ambiente auto-cambia según `configuracion_comercio.afip_ambiente`.
- **NC total**: anula factura y compensa CC del cliente.
- **NC parcial**: wizard con `nota_credito_items` (elige ítems/cantidades). Inserta `cliente_movimientos` con tipo `nota_credito` (nunca `NCR`).
- Resolución financiera: si la factura original fue CC → crédito en CC; si fue contado → resolución pendiente (dinero, cheque, transf).

---

## 4. Módulos financieros

### 4.a Cajas
- Apertura con saldo inicial → registra movimientos (`ingreso`, `egreso`, ventas automáticas).
- **Vendedor NO puede** hacer Ingreso/Egreso manuales.
- Cierre: se calcula `diferencia = arqueo - esperado`. Confirmación en 2 pasos vía `confirmar_arqueo_con_ajuste`. Si el admin decide imputar la diferencia, se crea `empleado_movimientos` (ajuste faltante o devolución sobrante).

### 4.b Cuenta Corriente
- **Cliente**: `cliente_movimientos` (compra, pago, nota_credito, ajuste). El balance suma sólo movimientos con `origen <> 'historico'` (los importados legacy son informativos).
- **Empleado**: `empleado_movimientos` (compra, sueldo, ajuste, devolución). Liquidaciones en `empleado_liquidaciones`.
- **Proveedor**: `proveedor_movimientos` con 4 medios de pago (efectivo, transferencia, cheque terceros, cheque propio).

### 4.c Imputación de pagos
- FIFO: pagos (REC) y NC se imputan contra las facturas (FAC) más antiguas.
- Efectivo: imputa instantáneo. Cheque/Transferencia: imputa recién cuando el valor queda validado (estado del cheque/transferencia).
- Registrada en `cliente_movimiento_imputaciones`.

### 4.d Cheques (7 estados)
`pendiente_validacion → cartera → depositado → acreditado / rechazado`, y `endosado`, `entregado_a_proveedor`. Todo cambio deja rastro en `cheque_historial`.

### 4.e Transferencias
Se valida `numero_operacion` para evitar duplicados. Extractor con AI Gemini Vision procesa el comprobante (`extraer-numero-operacion`).

---

## 5. Seguridad y roles

- **Roles del sistema** (dinámicos en tabla `roles`, protegidos de borrado): admin, encargado, cajero, vendedor, deposito.
- **Permisos por módulo**: `role_permissions (role, modulo, permiso)` con enum `app_permission` (ver, crear, editar, eliminar, anular, exportar). Se consultan con `has_permission()` desde front y RLS.
- **RLS**: cada tabla filtra por `auth.uid()` o por rol. Funciones helper: `has_role`, `has_any_role`, `is_route_owner`, `is_stop_owner`, `is_route_responsable`, `get_empleado_id`.
- **PWA descuentos** (`/admin-descuentos`): token 6 chars rotativo (`admin_tokens`) → el POS valida con `validar-token-descuento` → registra `solicitudes_descuento` → admin aprueba con `aprobar-descuento`. Nunca se guarda credencial en localStorage.
- **App móvil encargados**: mismo Supabase JS + RLS. `empleados.user_id` linkea auth ↔ empleado; las policies usan `get_empleado_id()`.

---

## 6. Reglas críticas a recordar

- No romper el layout de impresión de remitos ORO (`imprimirRemito.ts`).
- Estado `despachado` de pedidos SÓLO lo setea Logística, nunca manual.
- Registros `origen = 'historico'` se excluyen de balances actuales.
- Bypass del límite 1K de Supabase: recursivo con `.range()`, evitar `.in()` largos.
- Radix UI: usar `Sheet` en formularios complejos y `forwardRef` para evitar loops de render.

---

## 7. Cómo seguir explorando

- Ver `src/pages/POS.tsx` → circuito venta end-to-end.
- Ver `supabase/functions/afip-facturacion/index.ts` → integración WSFE.
- Ver RPCs `pos_registrar_venta`, `refacturar_hoja_ruta_producto`, `get_ventas_lista`, `confirmar_arqueo_con_ajuste` → lógica transaccional.
- Ver `src/components/facturacion/NotaCreditoParcialWizard.tsx` → wizard NC.