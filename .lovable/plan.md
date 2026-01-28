

# Plan: Ajustar Columna de Fecha y Lógica de Saldo Inicial

## Resumen

Modificar el importador para:
1. Usar la columna **"Fecha vto."** para la fecha de los movimientos
2. Detectar **saldo inicial** cuando `Debe=0` y `Haber=0`, tomando el valor de la columna **"Importe"**

---

## Cambios en el Archivo

### Archivo: `src/components/clientes/ExcelImporterCuentaCorriente.tsx`

### 1. Actualizar la interfaz ClienteRow

Agregar la nueva columna del Excel:

```typescript
interface ClienteRow {
  Cliente: string;
  'Tipo comprobante'?: string;
  'Nro. comprobante'?: string;
  Fecha?: string | number;
  'Fecha vto.'?: string | number;  // NUEVO - columna de fecha a usar
  Debe?: string | number;
  Haber?: string | number;
  Importe?: string | number;       // NUEVO - para saldo inicial
  Acumulado?: string | number;
  Estado?: string;
}
```

### 2. Modificar la lógica de determinación de tipo

Actualizar la función `determinarTipoMovimiento` para detectar saldo inicial cuando Debe=0 y Haber=0:

```typescript
const determinarTipoMovimiento = (row: ClienteRow): { tipo: TipoMovimiento; tipoOriginal: string } | null => {
  const tipoComprobante = row['Tipo comprobante']?.toString().trim().toUpperCase();
  
  // Si no hay tipo de comprobante, verificar si es saldo inicial
  if (!tipoComprobante || tipoComprobante === '') {
    const debe = parseNumber(row.Debe);
    const haber = parseNumber(row.Haber);
    const importe = parseNumber(row.Importe);
    
    // NUEVO: Si Debe y Haber son 0, pero hay Importe -> saldo inicial
    if (debe === 0 && haber === 0 && importe !== 0) {
      return { tipo: 'saldo_inicial', tipoOriginal: 'Saldo inicial' };
    }
    
    // Caso anterior: si hay valores en Debe/Haber
    if (debe !== 0 || haber !== 0) {
      return { tipo: 'saldo_inicial', tipoOriginal: 'Saldo inicial' };
    }
    
    return null;
  }
  
  // FAC, REC, NCR sin cambios
  if (tipoComprobante === 'FAC') {
    return { tipo: 'compra', tipoOriginal: 'FAC' };
  }
  if (tipoComprobante === 'REC') {
    return { tipo: 'pago', tipoOriginal: 'REC' };
  }
  if (tipoComprobante === 'NCR') {
    return { tipo: 'nota_credito', tipoOriginal: 'NCR' };
  }
  
  return null;
};
```

### 3. Modificar el cálculo del monto

En `handleFileSelect`, actualizar la lógica para usar Importe cuando corresponda:

```typescript
let monto: number;
if (tipoInfo.tipo === 'saldo_inicial') {
  const debe = parseNumber(row.Debe);
  const haber = parseNumber(row.Haber);
  const importe = parseNumber(row.Importe);
  
  // NUEVO: Si Debe y Haber son 0, usar Importe
  if (debe === 0 && haber === 0) {
    monto = importe;
  } else {
    monto = debe - haber;
  }
} else if (tipoInfo.tipo === 'compra') {
  monto = parseNumber(row.Debe);
} else {
  monto = parseNumber(row.Haber);
}
```

### 4. Cambiar la columna de fecha

En `handleFileSelect`, cambiar de `row.Fecha` a `row['Fecha vto.']`:

```typescript
// Antes:
fecha: parseExcelDate(row.Fecha),

// Después:
fecha: parseExcelDate(row['Fecha vto.']),
```

---

## Resumen de Cambios

| Aspecto | Antes | Después |
|---------|-------|---------|
| Columna fecha | `Fecha` | `Fecha vto.` |
| Saldo inicial | Solo si Debe o Haber != 0 | También si Debe=0, Haber=0 e Importe != 0 |
| Monto saldo inicial | `Debe - Haber` | Si Debe=Haber=0 usa `Importe`, sino `Debe - Haber` |

---

## Ejemplo de Comportamiento

**Fila del Excel:**
| Cliente | Tipo comprobante | Debe | Haber | Importe |
|---------|------------------|------|-------|---------|
| 010 - Cliente X | (vacío) | 0 | 0 | 15,000 |

**Resultado:**
- Tipo: `saldo_inicial`
- Monto: `15,000` (tomado de Importe)
- Concepto: "Saldo inicial importado"

