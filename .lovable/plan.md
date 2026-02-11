
# Plan: Limpiar Cuenta Corriente de Clientes

## Situación Actual
- **46 movimientos** en `cliente_movimientos` (deudas, pagos, notas de crédito, saldos iniciales)
- **33 imputaciones** en `cliente_movimiento_imputaciones` (registros que correlacionan pagos con facturas)
- Información vieja y sin correlación clara → no sirve para los clientes
- Objetivo: Empezar desde cero antes de importar las deudas actuales correctas

## Estrategia de Limpieza

### Paso 1: Eliminar Imputaciones Huérfanas
Primero se eliminarán los registros en `cliente_movimiento_imputaciones` porque dependen de los movimientos.

```sql
DELETE FROM cliente_movimiento_imputaciones;
```

### Paso 2: Eliminar Todos los Movimientos
Luego se eliminarán todos los registros en `cliente_movimientos`, excepto los del tipo `saldo_inicial` si deseas guardar alguno (opcional).

**Opción A - Limpiar completamente (recomendado):**
```sql
DELETE FROM cliente_movimientos;
```

**Opción B - Mantener solo saldos iniciales:**
```sql
DELETE FROM cliente_movimientos WHERE tipo != 'saldo_inicial';
```

## Efecto en la Aplicación
- Las cuentas corrientes (`CuentaCorrienteClienteDialog`) mostrarán vacías o sin movimientos
- La vista `cliente_saldos` calculará saldos en $0 para todos los clientes
- Lista nueva para importar deudas actuales sin conflictos con data vieja

## Consideraciones de Dependencias
- **`cheque_detalles`** (tabla de cheques): También referencia `cliente_movimientos`, pero parece ser un registro menor de detalle de cheques. Se pueden eliminar también para limpiar completamente.
- **RLS Policies**: El usuario tiene permisos de edición en clientes, así que puede eliminar movimientos
- **Auditoría**: No hay tabla de histórico de cambios, así que la eliminación es irreversible

## Plan de Ejecución

1. **Ejecutar migración SQL** que elimine:
   - `cliente_movimiento_imputaciones` (33 registros)
   - `cliente_movimientos` (46 registros)
   - Opcionalmente `cheque_detalles` si es necesario

2. **Verificar en la UI** que la cuenta corriente de cualquier cliente esté vacía

3. **Luego**: Importar las deudas actuales via el nuevo importador `ImportarDeudasDialog`

## Pregunta de Confirmación
¿Se debe limpiar **completamente todos los movimientos** (opción A), o mantener **solo los saldos iniciales** que puedan haber sido cargados intencionalmente (opción B)?

Recomendación: **Opción A** (limpieza total) para empezar desde cero.
