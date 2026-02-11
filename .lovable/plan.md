

# Importar Facturas Adeudadas por Cliente (detalle individual)

## Cambio de enfoque

En lugar de importar una deuda global por cliente, se importara cada factura pendiente como un movimiento individual. Esto permite luego correlacionar pagos con facturas especificas.

## Columnas del Excel

| Columna | Uso |
|---------|-----|
| Fecha de emision | Fecha del movimiento |
| Tipo comprobante | Se usara para el concepto (ej: FACB0001400001524) |
| Nro. comprobante | Numero de comprobante (se guardara para correlacion futura) |
| Cod. cliente | Busqueda del cliente por `codigo_cliente` |
| Razon social | Solo para vista previa, no se guarda |
| Nombre Vendedor | Se guardara en nuevo campo |
| Cod. Deposito | Se guardara en nuevo campo |
| Importe Pendiente (CTE) | Monto de la deuda |

## Cambios en base de datos

Se necesitan agregar 3 columnas a `cliente_movimientos` para poder correlacionar luego:

```sql
ALTER TABLE cliente_movimientos 
  ADD COLUMN numero_comprobante text,
  ADD COLUMN codigo_deposito text,
  ADD COLUMN nombre_vendedor text;
```

Estas columnas permiten:
- Identificar cada factura de forma unica (numero_comprobante + codigo_deposito)
- Saber a que vendedor/deposito pertenece
- Hacer la correlacion futura con pagos

## Logica del importador

1. Leer el Excel y extraer todas las columnas
2. Para cada fila:
   - Buscar el cliente por `Cod. cliente` (normalizando ceros)
   - Parsear la fecha de emision
   - Parsear el importe (manejo de formato con puntos como separador de miles y coma como decimal: `3.148.541,89`)
3. Vista previa agrupada mostrando: codigo cliente, nombre, cantidad de facturas, deuda total
4. Al confirmar, insertar un registro por cada factura en `cliente_movimientos`:
   - `tipo`: `compra`
   - `monto`: importe pendiente
   - `concepto`: tipo de comprobante (ej: "FACB0001400001524")
   - `numero_comprobante`: nro. comprobante del Excel
   - `codigo_deposito`: cod. deposito
   - `nombre_vendedor`: nombre vendedor
   - `fecha`: fecha de emision del comprobante
   - `estado_imputacion`: `confirmado`

## Vista en Cuenta Corriente

Al abrir la cuenta corriente de un cliente, se veran todas sus facturas individuales:

```text
| Fecha      | Tipo   | Concepto              | Deposito | Vendedor      | Monto        |
|------------|--------|-----------------------|----------|---------------|--------------|
| 29/07/2025 | Compra | FACB0001400001524     | 01       | ZETAAGUIRRE   | $3.148.541,89|
| 28/05/2025 | Compra | FACB0001600001124     | 52       | ZETABANDA     | $4.257.883,20|
|            |        |                       |          | TOTAL DEUDA:  | $7.406.425,09|
```

## Archivos a crear/modificar

### 1. Migracion SQL
Agregar columnas `numero_comprobante`, `codigo_deposito`, `nombre_vendedor` a `cliente_movimientos`

### 2. Nuevo componente: `src/components/clientes/ImportarDeudasDialog.tsx`
- Flujo: subir archivo, vista previa, importar, resultados
- Parseo de formato numerico argentino (puntos = miles, coma = decimal)
- Deteccion de duplicados por numero_comprobante para evitar reimportaciones
- Resumen: clientes encontrados, no encontrados, total facturas, monto total

### 3. Modificar `src/pages/Clientes.tsx`
- Agregar boton "Importar Deudas" y conectar con el nuevo dialogo

### 4. Modificar `src/components/clientes/CuentaCorrienteClienteDialog.tsx`
- Mostrar las nuevas columnas (deposito, vendedor) si existen datos

### 5. Corregir error de build en `src/hooks/usePushNotifications.ts`
- Resolver el error de TypeScript con `pushManager`

## Formato numerico importante

El Excel usa formato argentino:
- `3.148.541,89` = tres millones ciento cuarenta y ocho mil quinientos cuarenta y uno con 89 centavos
- El importador parseara correctamente eliminando puntos y reemplazando coma por punto

