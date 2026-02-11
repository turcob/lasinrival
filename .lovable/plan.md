

# Importar Historial de Movimientos por Vendedor

## Objetivo
Crear un importador para archivos Excel de historial por vendedor (ej: WILY_MOYANO.xlsx) que cargue todos los movimientos de cada cliente, y agregar una seccion "Historial" separada en la cuenta corriente del cliente.

## Columnas del Excel
| Columna | Uso |
|---------|-----|
| Cliente | Formato "CODIGO - NOMBRE". Se extrae codigo para buscar en BD |
| Fecha comprobante | Fecha del movimiento |
| Tipo comprobante | FAC (compra), REC (pago), NCR (nota credito) |
| Nro. comprobante | Identificador unico del comprobante |
| Estado | Si contiene "saldo inicial", se trata como saldo_inicial |
| Debe | Monto de facturas |
| Haber | Monto de pagos/notas credito |
| Importe | Monto para saldos iniciales |
| Leyenda 1-5 | Se concatenan como observacion |

Las columnas Cod. clasificacion, Descripcion Clasificacion, Fecha vto. y Acumulado se ignoran.

## Cambios en base de datos

Se agrega una columna `origen` a `cliente_movimientos` para distinguir movimientos del sistema vs importados historicamente:

```sql
ALTER TABLE cliente_movimientos 
  ADD COLUMN origen text DEFAULT 'sistema';
```

Valores posibles:
- `sistema` - movimientos generados por el sistema (default, retrocompatible)
- `historico` - movimientos importados desde el Excel de historial

## Nuevo componente: ImportarHistorialDialog.tsx

Reutiliza la logica del importador de cuenta corriente existente, adaptado para:

1. **Parsing**: Lee el Excel, extrae codigo/nombre del campo "Cliente" (formato "CODE - NAME"), determina tipo (FAC/REC/NCR/saldo_inicial), parsea montos (Debe/Haber/Importe)
2. **Matching**: Busca clientes por codigo normalizado (sin ceros iniciales) con paginacion para superar el limite de 1000 registros
3. **Duplicados**: Verifica comprobantes existentes por concepto para evitar reimportacion
4. **Insercion**: Inserta en lotes de 100, marcando `origen: 'historico'`
5. **Vista previa**: Muestra resumen por tipo de movimiento y primeros 100 registros

## Modificar CuentaCorrienteClienteDialog.tsx

Agregar pestanias usando Tabs:
- **Cuenta Corriente** (tab por defecto): Muestra movimientos con `origen != 'historico'` (o todos los que no sean historicos). Es la vista actual.
- **Historial**: Muestra solo movimientos con `origen = 'historico'`, ordenados por fecha descendente. Misma tabla pero filtrada.

La consulta se modifica para traer el campo `origen` y luego filtrar en el cliente segun la tab activa.

## Modificar Clientes.tsx

Agregar boton "Importar Historial" junto a los botones existentes, conectado al nuevo dialog.

## Resumen de archivos

| Archivo | Accion |
|---------|--------|
| Migracion SQL | Agregar columna `origen` a `cliente_movimientos` |
| `src/components/clientes/ImportarHistorialDialog.tsx` | Nuevo - importador de historial |
| `src/components/clientes/CuentaCorrienteClienteDialog.tsx` | Modificar - agregar tabs Cuenta Corriente / Historial |
| `src/pages/Clientes.tsx` | Modificar - agregar boton "Importar Historial" |

## Detalle tecnico

### Flujo del importador
1. Usuario selecciona archivo Excel del vendedor
2. Se parsean las filas, extrayendo codigo de cliente del campo "Cliente" (split por " - ")
3. Se buscan todos los clientes con paginacion (batches de 1000)
4. Se muestra resumen: cantidad de movimientos por tipo, clientes encontrados/no encontrados
5. Al confirmar, se insertan en `cliente_movimientos` con `origen = 'historico'`

### Vista Historial en Cuenta Corriente
- Se usa el componente Tabs de Radix
- Tab "Cuenta Corriente": movimientos donde `origen` es null o 'sistema'
- Tab "Historial": movimientos donde `origen = 'historico'`
- Ambas tabs comparten el mismo formato de tabla (fecha, tipo, concepto, monto, etc.)

