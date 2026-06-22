# Plan: Módulo de Transferencias

## Resumen
Crear módulo **Transferencias** para registrar y gestionar transferencias bancarias recibidas como medio de pago, con flujo de validación/rechazo, tarjetas resumen reactivas, filtros y auditoría completa.

Además:
- **Generación automática**: toda venta o pago de cuenta corriente cobrado con medio de pago "Transferencia" creará automáticamente un registro en esta tabla en estado **Pendiente**, vinculado al comprobante origen.
- **Fase 2 (futura, fuera del alcance de esta entrega)**: validación masiva automática mediante carga de extracto bancario (reutilizando la lógica ya existente en `ImportarBancoDialog.tsx` + `extraer-numero-operacion`), cruzando `numero_operacion` e importe para pasar transferencias de `pendiente → validada` en lote.

## Alcance del entregable (Fase 1)

### 1. Base de datos (migración)
Nueva tabla `public.transferencias`:
- Datos: `fecha_transferencia`, `cliente_id` (FK a `clientes`), `titular_nombre`, `titular_cuil`, `numero_operacion`, `importe`, `estado` ('pendiente'|'validada'|'rechazada', default `pendiente`).
- Auditoría: `creado_por` (uuid), `created_at`, `validado_por`, `validado_at`, `rechazado_por`, `rechazado_at`, `observacion_rechazo`, `updated_at`.
- Origen y trazabilidad (clave para Fase 2 de conciliación):
  - `origen` TEXT — 'manual' | 'venta' | 'cobro_cc'.
  - `venta_id` UUID NULL (FK a `ventas`).
  - `cobro_id` UUID NULL (FK a `cobros`).
  - `cliente_movimiento_id` UUID NULL (FK a `cliente_movimientos`).
- Reglas:
  - CHECK `importe > 0`.
  - Índice único parcial `(cliente_id, numero_operacion) WHERE numero_operacion IS NOT NULL`.
  - Trigger `update_updated_at_column`.
  - Trigger de transición de estado: bloquea `validada → pendiente`, bloquea cambios desde `rechazada` salvo admin, exige `observacion_rechazo` cuando pasa a `rechazada`, setea `validado_por/at` y `rechazado_por/at` con `auth.uid()` y `now()`.
- RLS + GRANTs:
  - SELECT/INSERT/UPDATE para `authenticated` filtrado por permiso `transferencias`.
  - Admin: todo.
- Seed de permisos `transferencias` (ver/crear/editar) en `role_permissions` para admin.

### 2. Generación automática desde cobros con medio "Transferencia"

**Detección del medio**: por nombre normalizado de `formas_pago` que coincida con "transferencia" (consistente con cómo el sistema distingue medios en `get_ventas_totales_por_medio_pago`).

**Punto A — Venta en POS** (`src/pages/POS.tsx` y modal de pagos):
- Tras crear `venta` + `venta_pagos`, por cada pago con `forma_pago=transferencia` insertar fila en `transferencias` con `origen='venta'`, `venta_id`, `cliente_id`, `importe`, `numero_operacion`, `fecha_transferencia`, titular/CUIL.
- El modal pedirá: titular, CUIL, nº operación, fecha (zod).

**Punto B — Pago de cuenta corriente** (`RegistrarPagoClienteDialog.tsx` / `cobros` / `cliente_movimientos`):
- Al registrar pago con transferencia, insertar fila con `origen='cobro_cc'`, `cobro_id`, `cliente_movimiento_id`, `cliente_id`, importe, titular/operación.

**Reglas comunes**:
- Siempre nace en `pendiente`.
- Si choca con el índice único `(cliente_id, numero_operacion)`, el cobro se rechaza con mensaje claro (memoria `bank-transfer-reconciliation`).

### 3. Frontend del módulo

**Nueva página** `src/pages/Transferencias.tsx`:
- Tarjetas resumen reactivas (Pendientes / Validadas / Rechazadas) con `useMemo` sobre dataset completo (mismo patrón que Pedidos — sin depender de click).
- Filtros: estado, cliente, fecha desde/hasta, nº de operación.
- Grilla con columnas pedidas + badge de **Origen** (manual / venta / cuenta corriente) con link al comprobante origen cuando exista.
- Acciones por estado:
  - Pendiente: **Validar** y **Rechazar** (observación obligatoria, placeholder con ejemplos).
  - Validada/Rechazada: solo lectura con tooltip de quién/cuándo.
- Botón "Nueva Transferencia" → dialog manual.

**Hook** `src/hooks/useTransferencias.ts`: fetch con joins a `clientes`/`profiles` y mutations (crear/validar/rechazar) con invalidación.

**Componentes** en `src/components/transferencias/`:
- `NuevaTransferenciaDialog.tsx`
- `RechazarTransferenciaDialog.tsx`

### 4. Routing y navegación
- Ruta `/transferencias` en `src/App.tsx`.
- Ítem "Transferencias" en `AppSidebar.tsx` (grupo **Operaciones**, icono `ArrowLeftRight`, `module: 'transferencias'`).

## Fase 2 (no se entrega ahora, sólo se deja preparado)

**Validación automática por extracto bancario**:
- Reutilizar UI/parseo de `src/components/clientes/ImportarBancoDialog.tsx` (mapeo de columnas, parseo XLSX, autodetección).
- Cruce contra `transferencias` en estado `pendiente` por `numero_operacion` + importe (tolerancia configurable).
- Resultado:
  - Match exacto → marcar `validada` automáticamente (registrando origen "conciliación bancaria" en `observacion`/auditoría).
  - Diferencia de importe → mostrar para revisión manual.
  - Sin match en sistema → reportar como "no encontradas".
  - Sin match en banco → reportar como pendientes huérfanas.
- Opcional: usar `extraer-numero-operacion` (Gemini Vision) para subir comprobante individual y autocompletar nº operación al validar/cargar.

La estructura de la tabla (FKs a venta/cobro, `numero_operacion` único por cliente, estados auditados) ya queda preparada para esta fase.

## Fuera de alcance (ambas fases)
- Imputación automática de transferencia validada a facturas puntuales (queda preparado vía FKs).
- Adjuntos de comprobantes en la transferencia (se puede sumar luego con el bucket `comprobantes-cobros`).
