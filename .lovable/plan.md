

## Plan: Corregir workflows y agregar bloqueo por monto

Hay dos correcciones necesarias:

### 1. Corregir workflow de cobros en los PDFs

**Problema actual**: El workflow no distingue correctamente que:
- **Efectivo**: se imputa solo una vez aprobada la rendición de caja/logística
- **Transferencias y cheques**: se imputan manualmente desde el módulo Imputación

**Cambio**: Actualizar `src/lib/imprimirWorkflows.ts` en las secciones de cobros y logística para reflejar este flujo diferenciado con pasos claros por medio de pago.

### 2. Agregar bloqueo por monto adeudado

**Problema actual**: Solo se bloquea por cantidad de facturas adeudadas (`facturas_adeudadas_bloqueo`). Falta bloqueo por monto.

**Cambios necesarios**:

| Archivo / Recurso | Cambio |
|---|---|
| **Migración DB** | Agregar columna `monto_adeudado_bloqueo` (numeric, default 0 = desactivado) a `configuracion_comercio`, y `monto_adeudado_bloqueo_override` (numeric, nullable) a `clientes` |
| `src/pages/Configuracion.tsx` | Agregar campo para configurar monto máximo de deuda permitido |
| `src/pages/Clientes.tsx` | Actualizar lógica de auto-bloqueo para también evaluar saldo actual vs monto límite |
| `src/lib/imprimirWorkflows.ts` | Actualizar workflow de cobros para mencionar ambos criterios de bloqueo (facturas Y monto) y el flujo diferenciado efectivo vs transferencia/cheque |

### Lógica de bloqueo actualizada

```
shouldBlock = 
  (adeudadas >= limiteFacturas) 
  OR 
  (montoLimite > 0 AND saldoActual >= montoLimite)
```

El motivo de bloqueo indicará cuál criterio se activó.

