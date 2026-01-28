

# Plan: Importador de Cuenta Corriente y Pantalla de Asociacion de Pagos

## Resumen

Implementar dos funcionalidades complementarias:
1. **Importador de saldos historicos** desde el Excel de cuenta corriente
2. **Pantalla de asociacion de pagos a facturas** que permita buscar un cliente y gestionar la vinculacion de sus pagos pendientes con facturas abiertas

---

## 1. Importador de Cuenta Corriente de Clientes

### Logica de importacion

Dado que todos los recibos del archivo ya estan imputados, la estrategia sera:
- Importar **saldo inicial** por cliente como un movimiento tipo `saldo_inicial` (nuevo tipo)
- Todos los movimientos se importaran con `estado_imputacion = 'confirmado'`
- Se mapeara el codigo del cliente (ej: `010`) con `clientes.codigo_cliente`

### Nuevo componente

**Archivo:** `src/components/clientes/ExcelImporterCuentaCorriente.tsx`

```text
Flujo:
1. Subir archivo Excel
2. Parsear y agrupar por cliente
3. Extraer codigo del formato "CODIGO - NOMBRE"
4. Buscar cliente por codigo_cliente en BD
5. Calcular saldo total (ultima fila de cada cliente)
6. Crear movimiento tipo 'saldo_inicial' con el monto
7. Mostrar resumen de importacion
```

### Mapeo de datos

| Columna Excel | Campo BD |
|---------------|----------|
| Cliente (codigo) | Buscar en `clientes.codigo_cliente` |
| Acumulado (ultima fila) | `monto` del saldo_inicial |
| - | `tipo = 'saldo_inicial'` |
| - | `estado_imputacion = 'confirmado'` |
| - | `concepto = 'Saldo inicial importado'` |

### Integracion

Agregar boton "Importar Cuenta Corriente" en `src/pages/Clientes.tsx`

---

## 2. Pantalla de Asociacion de Pagos a Facturas

### Nueva pagina

**Archivo:** `src/pages/AsociacionPagos.tsx`

### Funcionalidad

Pantalla con layout de dos columnas:

```text
+----------------------------------------------------+
| Buscar cliente: [_______________] [Buscar]         |
+----------------------------------------------------+
|                                                    |
| Cliente: PANADERIA BUHO | Saldo: $15,000          |
|                                                    |
+------------------------+---------------------------+
| FACTURAS PENDIENTES    | PAGOS DISPONIBLES        |
+------------------------+---------------------------+
| [x] FAC-001 $5,000    | [ ] REC-001 $3,000       |
| [ ] FAC-002 $8,000    | [ ] REC-002 $2,000       |
| [ ] FAC-003 $4,000    |                          |
|                        |                          |
| Total: $17,000        | Total: $5,000            |
+------------------------+---------------------------+
|         [ Asociar Pagos Seleccionados ]           |
+----------------------------------------------------+
```

### Columna izquierda: Facturas

- Lista todas las ventas del cliente que tienen saldo pendiente
- Cada factura muestra: numero, fecha, total, saldo restante
- Checkbox para seleccionar multiples facturas

### Columna derecha: Pagos disponibles

- Lista movimientos tipo `pago` que NO estan asociados a una factura (`venta_id IS NULL`)
- Muestra: concepto, fecha, monto, forma de pago
- Checkbox para seleccionar que pagos asociar

### Accion "Asociar"

- Actualiza el campo `venta_id` de los pagos seleccionados
- Registra en el concepto a que facturas se imputo
- Si un pago cubre multiples facturas, se divide en movimientos parciales

---

## 3. Cambios en la Base de Datos

### Nuevo tipo de movimiento

Agregar `saldo_inicial` como tipo valido en `cliente_movimientos`
- Funciona como deuda si es positivo
- Funciona como credito si es negativo

### Vista actualizada

La vista `cliente_saldos` ya calcula el saldo correctamente basandose en los tipos de movimiento

---

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/components/clientes/ExcelImporterCuentaCorriente.tsx` | Crear |
| `src/pages/AsociacionPagos.tsx` | Crear |
| `src/pages/Clientes.tsx` | Agregar boton de importacion |
| `src/App.tsx` | Agregar ruta `/asociacion-pagos` |
| `src/components/layout/AppSidebar.tsx` | Agregar enlace en menu |

---

## Detalles Tecnicos

### Parseo del Excel

```text
- Libreria: XLSX (ya instalada)
- Formato numeros: Argentino (96,053.22)
- Extraccion codigo: split(' - ')[0].trim()
```

### Calculo de saldo a importar

Para cada cliente del Excel:
1. Buscar la ultima fila (mayor fecha o ultima posicion)
2. Tomar el valor de "Acumulado" como saldo inicial
3. Si es positivo: el cliente debe al comercio
4. Si es negativo: el cliente tiene saldo a favor

### Validaciones

- No crear movimiento si el cliente no existe en la BD
- Evitar duplicados verificando si ya existe un `saldo_inicial` para ese cliente
- Mostrar errores y exitos en resumen final

---

## Navegacion

La nueva pantalla "Asociacion de Pagos" se agregara al menu lateral en la seccion de Clientes o como subitem del modulo de Imputacion

