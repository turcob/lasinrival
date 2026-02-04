
# Plan para verificar el funcionamiento de Cuentas Corrientes

## Objetivo
Probar el sistema de cuentas corrientes importando el Excel de Fernando Pereyra con el historico de facturas y recibos, verificando que los movimientos impacten correctamente en los saldos.

## Estado actual del sistema

### Lo que ya existe:
1. **Tabla `cliente_movimientos`**: Almacena todos los movimientos con campos:
   - `tipo`: compra, pago, nota_credito, nota_debito, devolucion, saldo_inicial
   - `monto`, `fecha`, `concepto`, `estado_imputacion`, etc.

2. **Vista `cliente_saldos`**: Calcula automáticamente:
   - `total_deuda` = suma de (compra + saldo_inicial + nota_debito)
   - `total_pagado` = suma de (pago + nota_credito + devolucion)
   - `saldo_actual` = total_deuda - total_pagado

3. **Importador Excel** (`ExcelImporterCuentaCorriente`): Procesa:
   - Columna "Fecha comprobante" para las fechas
   - Tipos: FAC (compra), REC (pago), NCR (nota credito)
   - Detecta "saldo inicial" en columna Estado
   - Evita duplicados por numero de comprobante

4. **Clientes de Fernando Pereyra**: Existen 30+ clientes pero sin movimientos cargados

### Flujo de prueba:

```
Excel Fernando Pereyra
        |
        v
[Importador CC] ---> [cliente_movimientos]
                              |
                              v
                     [cliente_saldos (vista)]
                              |
                              v
                  [Dialog Cuenta Corriente]
                     - Lista movimientos ordenados por fecha
                     - Muestra resumen de saldos
```

## Pasos para la prueba

### Paso 1: Importar el Excel
1. Ir a la pagina de **Clientes**
2. Hacer clic en **"Importar Cuenta Corriente"**
3. Seleccionar el archivo `FERNANDO_PEREYRA.xlsx`
4. Revisar la vista previa que muestra:
   - Cantidad por tipo (FAC, REC, NCR, Saldo Inicial)
   - Codigo cliente, fecha, tipo, comprobante, monto
5. Confirmar la importacion

### Paso 2: Verificar resultados de importacion
- El sistema mostrara cuantos fueron:
  - **Exitosos**: Importados correctamente
  - **Omitidos**: Ya existian (duplicados)
  - **Errores**: Cliente no encontrado u otro error

### Paso 3: Revisar cuenta corriente de un cliente
1. Buscar un cliente del vendedor Fernando Pereyra
2. Hacer clic en el icono de billetera (Cuenta Corriente)
3. Verificar:
   - **Orden de movimientos**: Mas recientes primero (ordenados por fecha DESC)
   - **Total Deuda**: Suma de facturas + saldo inicial
   - **Total Pagado**: Suma de recibos + notas de credito
   - **Saldo Actual**: Deuda - Pagado

## Puntos a observar

### Durante la importacion:
- Que el mapeo de columnas sea correcto (Fecha comprobante, no Fecha vto.)
- Que los tipos se detecten bien (FAC, REC, NCR, saldo inicial)
- Que los montos se tomen de las columnas correctas (Debe/Haber/Importe)

### En la cuenta corriente:
- Que el orden cronologico sea correcto
- Que los colores sean correctos:
  - Rojo: Compras/Facturas (deuda)
  - Verde: Pagos/Recibos (reduce deuda)
- Que el saldo final coincida con el esperado del Excel

## Seccion tecnica

### Estructura esperada del Excel:
| Cliente | Tipo comprobante | Nro. comprobante | Fecha comprobante | Debe | Haber | Estado |
|---------|-----------------|------------------|-------------------|------|-------|--------|
| 080640 - CHAVEZ JUAN | FAC | B0001101163413 | 05/01/2026 | 96053.22 | 0 | |
| 080640 - CHAVEZ JUAN | REC | X0040000108897 | 06/01/2026 | 0 | 96053.22 | |

### Logica de asignacion de montos:
```javascript
if (tipo === 'saldo_inicial') {
  monto = columna Importe
} else if (tipo === 'compra') {
  monto = columna Debe
} else {
  monto = columna Haber
}
```

### Calculo del saldo en la vista SQL:
```sql
saldo_actual = 
  SUM(CASE WHEN tipo IN ('compra','saldo_inicial','nota_debito') THEN monto ELSE -monto END)
```

## Proximos pasos sugeridos
1. Subir el Excel y revisar la previsualizacion
2. Confirmar importacion
3. Verificar cuenta corriente de 2-3 clientes
4. Reportar cualquier inconsistencia encontrada
