

## Plan: Corregir devoluciones/anulaciones, NC libre, y reporte de pagos

Hay tres problemas a resolver:

### 1. Devolución y Anulación no eliminan/revierten correctamente

**Problema**: Al registrar una "devolución" o "anulación de compra" en la cuenta corriente del cliente, solo se crea un movimiento nuevo en `cliente_movimientos`. Pero:
- La vista `cliente_saldos` **no incluye `anulacion`** en el cálculo de `total_pagado` (solo `pago`, `nota_credito`, `devolucion`), por lo que las anulaciones no impactan el saldo.
- No se restituye stock de los productos involucrados.
- El movimiento original de compra persiste.

**Solución**:
| Cambio | Detalle |
|---|---|
| **Migración DB** | Actualizar la vista `cliente_saldos` para incluir `anulacion` en `total_pagado` |
| `RegistrarPagoClienteDialog.tsx` | Para tipo `anulacion`: buscar la venta asociada, restituir stock de cada producto, registrar movimientos de inventario. Agregar selector de compra similar a nota de crédito para que el usuario elija qué compra anula. |
| `RegistrarPagoClienteDialog.tsx` | Para tipo `devolucion`: agregar selector de compra y productos (similar a NC) para restituir stock de los items devueltos |

### 2. Nota de Crédito libre (sin factura asociada)

**Problema**: Actualmente la NC solo permite seleccionar una compra existente. Si la factura ya fue cancelada o no existe en el sistema, no hay forma de generar una NC.

**Solución**:
| Cambio | Detalle |
|---|---|
| `RegistrarPagoClienteDialog.tsx` | Agregar un toggle/opción "NC sin factura asociada" que permita buscar productos manualmente (buscador de productos), ingresar cantidad y precio, y generar la NC libre. El concepto indicará "NC Manual" + productos seleccionados |

### 3. Reporte de Pagos de Clientes

**Problema**: No existe un reporte de pagos filtrable. La ruta `/reportes` redirige al Dashboard.

**Solución**:
| Cambio | Detalle |
|---|---|
| `src/pages/ReportePagos.tsx` | **Nuevo** - Página con tabla de pagos de clientes (`cliente_movimientos` tipo `pago`), con filtros por: tipo/medio de pago (efectivo, cheque, transferencia, tarjeta), zona del cliente, rango de fechas, cliente específico. Incluir totales por medio de pago y exportación |
| `src/App.tsx` | Agregar ruta `/reporte-pagos` |
| `AppSidebar.tsx` | Agregar link "Reporte Pagos" en la sección de operaciones |

### Archivos afectados

| Archivo | Acción |
|---|---|
| **Migración SQL** | Actualizar vista `cliente_saldos` (agregar `anulacion`) |
| `src/components/clientes/RegistrarPagoClienteDialog.tsx` | Corregir anulación (selector compra + stock), devolucion (selector + stock), NC libre |
| `src/pages/ReportePagos.tsx` | **Nuevo** - Reporte filtrable de pagos |
| `src/App.tsx` | Nueva ruta |
| `src/components/layout/AppSidebar.tsx` | Nuevo link sidebar |

