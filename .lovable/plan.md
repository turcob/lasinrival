

# Plan: Importar Todos los Movimientos del Excel

## Resumen

Modificar el importador para que importe **todos los movimientos individuales** del Excel (Saldo inicial, FAC, REC, NCR) en lugar de solo el saldo final. Se incluira validacion para evitar duplicados.

---

## Cambios en el Componente

### Archivo: `src/components/clientes/ExcelImporterCuentaCorriente.tsx`

### Nueva Estructura de Datos

```text
Antes: Map<codigo, { saldo final }>
Ahora: Array<{ cliente, tipo, fecha, nroComprobante, monto, estado }>
```

### Mapeo de Tipos de Comprobante

| Excel | Base de Datos | Campo Monto |
|-------|---------------|-------------|
| Saldo inicial | `saldo_inicial` | Debe - Haber (puede ser negativo) |
| FAC | `compra` | `Debe` |
| REC | `pago` | `Haber` |
| NCR | `nota_credito` | `Haber` |

### Logica de Importacion

1. **Parsear todas las filas** del Excel (no agrupar por cliente)
2. **Clasificar cada fila** segun su tipo de comprobante
3. **Validar duplicados** antes de importar:
   - Si ya existe un `saldo_inicial` para ese cliente → omitir la fila de saldo inicial
   - Si ya existe un movimiento con el mismo `concepto` (nro. comprobante) → omitir
4. **Insertar movimientos** en `cliente_movimientos`

### Prevencion de Duplicados

Para cada movimiento se verificara:
- **Saldo inicial**: Consulta si existe `tipo = 'saldo_inicial'` para ese cliente
- **FAC/REC/NCR**: Consulta si existe un movimiento con el mismo numero de comprobante en el concepto

```text
SELECT id FROM cliente_movimientos 
WHERE cliente_id = ? 
AND concepto LIKE '%B0001101163413%'  -- Numero de comprobante
```

---

## Flujo de Usuario Actualizado

```text
1. Subir archivo Excel
         ↓
2. Parsear TODAS las filas (no solo saldos)
         ↓
3. Vista previa muestra:
   - Total de movimientos por tipo
   - Lista detallada con fecha, tipo, comprobante, monto
         ↓
4. Al confirmar:
   a. Verificar cliente existe
   b. Verificar no duplicado
   c. Insertar movimiento
         ↓
5. Resumen: exitosos, omitidos, errores
```

---

## Cambios Especificos en el Codigo

### 1. Nueva interfaz para movimientos

```typescript
interface MovimientoExcel {
  clienteCodigo: string;
  clienteNombre: string;
  fecha: string | null;
  tipo: 'saldo_inicial' | 'compra' | 'pago' | 'nota_credito';
  nroComprobante: string;
  monto: number;
  estado: string;
}
```

### 2. Parseo de filas individuales

En lugar de agrupar por cliente, se creara un array con todos los movimientos:

```text
Para cada fila del Excel:
  - Si "Tipo comprobante" esta vacio y hay "Saldo inicial:" → tipo = saldo_inicial
  - Si "Tipo comprobante" = FAC → tipo = compra
  - Si "Tipo comprobante" = REC → tipo = pago
  - Si "Tipo comprobante" = NCR → tipo = nota_credito
```

### 3. Validacion de duplicados

Antes de importar:
```text
1. Obtener todos los cliente_movimientos existentes
2. Crear Set con conceptos existentes por cliente
3. Para cada movimiento a importar:
   - Verificar si nro comprobante ya existe
   - Si existe → marcar como omitido
```

### 4. Vista previa mejorada

Mostrar tabla con:
- Codigo cliente
- Nombre cliente
- Fecha
- Tipo (FAC/REC/NCR/Saldo Inicial)
- Nro. Comprobante
- Monto

---

## Consideraciones

### Saldo Inicial Negativo

Si el saldo inicial es negativo (cliente tiene credito a favor), se importara como:
- `tipo = 'saldo_inicial'` con `monto` negativo
- La vista `cliente_saldos` sumara este valor negativo a la deuda, resultando en credito a favor

### Fecha de Saldo Inicial

Las filas de "Saldo inicial" no tienen fecha. Se usara la fecha actual o una fecha configurable (primer dia del periodo).

### Estado de Imputacion

Todos los movimientos se importan con `estado_imputacion = 'confirmado'` ya que son datos historicos verificados.

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/clientes/ExcelImporterCuentaCorriente.tsx` | Reestructurar para importar movimientos individuales |

No se requieren cambios en la base de datos ya que los tipos de movimiento ya estan soportados en la vista `cliente_saldos`.

