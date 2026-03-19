

## Plan: Remitos por tamaño, validación de transferencias duplicadas, cruce bancario, y bonificación en NC

### 1. Separar remitos por cantidad de productos (≤10 y >10)

**Archivo**: `src/components/pedidos/ConsolidadoFinalZona.tsx`

Reemplazar el botón único "Imprimir Remitos" por dos botones:
- **"Remitos Cortos (≤10 prod.)"**: filtra pedidos con ≤10 líneas de producto y abre ventana de impresión solo con esos
- **"Remitos Largos (>10 prod.)"**: filtra pedidos con >10 líneas

Agregar un indicador visual (badge) que muestre cuántos remitos hay en cada grupo. La lógica de `handleImprimirRemitos` se parametriza con un filtro `maxItems` / `minItems`.

### 2. Validación de transferencias duplicadas

**Migración DB**: Agregar columna `numero_operacion` (text, nullable) a `cliente_movimientos` para almacenar el número de operación/transferencia.

**Archivo**: `src/components/clientes/RegistrarPagoClienteDialog.tsx`
- Agregar campo "Nro. Operación" visible cuando la forma de pago es transferencia
- Al guardar, antes de insertar, consultar si ya existe un movimiento con ese `numero_operacion` → mostrar advertencia/bloqueo si está duplicado

**Archivo**: `src/pages/Imputacion.tsx`
- Mostrar el `numero_operacion` en la tabla de movimientos pendientes para facilitar la verificación

### 3. Importar reporte bancario para cruce de transferencias

**Archivo nuevo**: `src/components/clientes/ImportarBancoDialog.tsx`

Crear un diálogo que permita:
- Importar un Excel/CSV del banco (columnas típicas: fecha, descripción, monto, referencia/operación)
- Mapear columnas del archivo a los campos esperados
- Cruzar automáticamente por `numero_operacion` contra transferencias cargadas en `cliente_movimientos`
- Mostrar resultados: matcheadas (confirmar automáticamente), no encontradas en sistema, cargadas pero no en banco

**Archivo**: `src/pages/Imputacion.tsx`
- Agregar botón "Importar Extracto Bancario" que abra el diálogo

### 4. Bonificación en Nota de Crédito

**Archivo**: `src/components/clientes/RegistrarPagoClienteDialog.tsx`

Agregar al tipo de movimiento una opción **"Bonificación"** que funcione como NC pero con concepto específico:
- Agregar `{ value: 'bonificacion', label: 'Bonificación' }` al array `TIPOS_MOVIMIENTO`
- La bonificación se registra como tipo `nota_credito` internamente con concepto "Bonificación" + detalle
- Permite ingresar monto libre y concepto descriptivo (ej: "Bonificación por diferencia de cobro")
- No requiere seleccionar factura ni productos

### Archivos afectados

| Archivo | Cambio |
|---|---|
| **Migración SQL** | Agregar `numero_operacion` a `cliente_movimientos` |
| `src/components/pedidos/ConsolidadoFinalZona.tsx` | Separar botón de remitos en dos (≤10 / >10 productos) |
| `src/components/clientes/RegistrarPagoClienteDialog.tsx` | Campo nro. operación + validación duplicados + tipo bonificación |
| `src/components/clientes/ImportarBancoDialog.tsx` | **Nuevo** - Importador de extracto bancario |
| `src/pages/Imputacion.tsx` | Mostrar nro. operación + botón importar extracto |

