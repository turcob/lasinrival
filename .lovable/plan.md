
# Plan: Alinear flujo de cobros, rendición y pendientes del chofer

## Objetivo
Cerrar las 5 brechas detectadas en el análisis para que el sistema replique el proceso real: cobro en tiempo real con clasificación por medio de pago, rendición de control, faltantes a "cuenta del chofer" y descuento manual en liquidación.

---

## Cambios

### 1. Imputación en tiempo real al registrar el cobro
**Archivo:** `src/hooks/useEncargado.ts` → `useRegistrarCobrosEncargado`

Cuando el cobrador guarda un cobro en la app, generar **un `cliente_movimientos` por cobro** (no esperar a la rendición):
- `efectivo` → `estado_imputacion = 'confirmado'` (impacta cuenta corriente al instante).
- `transferencia`, `qr`, `cheque` → `estado_imputacion = 'pendiente'` (caen en la cola de `/imputacion` para validar contra extracto bancario / cheque).
- Guardar `numero_operacion` (referencia) y `forma_pago_id`.
- Vincular al `venta_id` / `pedido_id` correspondiente para que la imputación a factura sea trivial.

Quitar el bloque "Impactar cuenta corriente" de `useGuardarRendicion` (ya estará impactado al registrar).

### 2. Aprobación de rendición → genera pendiente del chofer
**Archivos:** `RendicionHojaRutaDialog.tsx`, nueva tabla `chofer_pendientes`, hook nuevo `useAprobarRendicion`.

Al aprobar la rendición, si `diferencia_efectivo < 0` (faltó efectivo), crear registro en `chofer_pendientes`:
- `empleado_id` (chofer o responsable), `hoja_ruta_id`, `monto`, `estado: 'pendiente'`, `concepto: 'Faltante HR #N'`, `fecha`, `usuario_aprobador_id`.
- Si `diferencia_efectivo > 0` (sobró) → crear `cliente_movimientos` tipo `pago_a_favor` genérico o registro a favor del chofer (a definir si conviene "reintegro").

La rendición ya no impacta cuenta corriente (esa parte se hace en paso 1).

### 3. Nueva tabla `chofer_pendientes`
Campos: `id`, `empleado_id`, `hoja_ruta_id`, `monto`, `concepto`, `fecha`, `estado` (`pendiente | descontado | saldado_manual | anulado`), `liquidacion_id` (nullable), `usuario_registro_id`, timestamps.

RLS: ver = `logistica:ver` o `empleados:ver`; gestionar = `empleados:editar`.

### 4. Pantalla nueva "Pendientes de Chofer"
**Archivo:** `src/pages/PendientesChofer.tsx` + entrada en sidebar.

Lista filtrable por chofer / estado / período. Acciones:
- Marcar como saldado manualmente (con observación).
- Anular (con motivo).

### 5. Liquidación: aplicar pendientes manualmente
**Archivo:** `src/components/empleados/LiquidacionSection.tsx` (o el dialog de generación).

Al armar la liquidación del empleado, mostrar lista de `chofer_pendientes` con `estado='pendiente'`. El admin tilda cuáles aplicar; al confirmar:
- Suma esos pendientes a `total_descuentos`.
- Marca los pendientes como `descontado` con `liquidacion_id`.
- Si la liquidación se anula, revertir (`estado='pendiente'`, `liquidacion_id=null`).

### 6. Ajustes en `/imputacion`
La cola pendiente ya funciona; solo verificar que muestre el `pedido_id` / `numero_pedido` y el `hoja_ruta_id` cuando el origen es cobro de chofer, para facilitar identificar el pago.

---

## Detalles técnicos

**Tabla nueva:**
```sql
CREATE TABLE public.chofer_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL,
  hoja_ruta_id uuid NOT NULL,
  rendicion_id uuid,
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','descontado','saldado_manual','anulado')),
  liquidacion_id uuid,
  observaciones text,
  usuario_registro_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```
+ GRANTs + RLS + trigger `update_updated_at`.

**Migración de datos existentes:** los `cliente_movimientos` que ya generó la rendición histórica quedan como están (no se tocan). El cambio aplica solo a cobros nuevos.

**Compatibilidad:** `useGuardarRendicion` mantiene `impactarCuentaCorriente=false` automático (deprecado el flag); solo guarda totales declarados para control.

---

## Orden de implementación
1. Migración: tabla `chofer_pendientes` + RLS.
2. Refactor `useRegistrarCobrosEncargado` (impacto en tiempo real con clasificación).
3. Quitar impacto de `useGuardarRendicion`.
4. Hook + lógica de aprobación de rendición que genera el pendiente.
5. Página `/pendientes-chofer` con CRUD básico.
6. Integrar pendientes en flujo de liquidación.

¿Avanzo así?
