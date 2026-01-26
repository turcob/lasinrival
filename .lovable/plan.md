
# Plan: Corregir Impresión de Facturas desde Ventas

## Problema Identificado

Al analizar el código y la captura de pantalla, el problema es que:

1. **El HTML de la factura está diseñado para formato A4** (línea 825-921 de Ventas.tsx):
   - Usa `grid-cols-2` para dividir en columnas
   - Tiene padding de 6 (`p-6`)
   - Usa bordes y diseño de factura tradicional

2. **Los estilos CSS fuerzan formato térmico 80mm**:
   - Ancho fijo de 76mm
   - `position: fixed` con `top: 0` y `left: 0`

3. **El resultado**: La factura A4 se comprime a 76mm de ancho y aparece en la esquina superior izquierda del papel, pero el contenido está diseñado para ser más ancho, por lo que se ve pequeño y cortado.

## Solución

Crear **dos modos de impresión**:
- **Ticket térmico 80mm**: Para tickets de venta del POS (formato actual)
- **Factura A4/Carta**: Para facturas electrónicas desde Ventas

---

## Detalles Técnicos

### 1. Modificar src/index.css

Agregar una segunda sección de estilos para facturas A4 usando un ID diferente (`printable-factura`):

```css
/* Estilos para factura A4 (desde página Ventas) */
#printable-factura,
#printable-factura * {
  visibility: visible;
}

#printable-factura {
  position: fixed;
  left: 0;
  top: 0;
  width: 210mm; /* Ancho A4 */
  max-width: 210mm;
  padding: 10mm;
  margin: 0;
  background: white !important;
  color: black !important;
  font-size: 12px !important;
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

También agregar regla para detectar qué tipo de impresión usar:

```css
@page factura-a4 {
  size: A4 portrait;
  margin: 10mm;
}
```

### 2. Modificar src/pages/Ventas.tsx

Cambiar el ID del contenedor de factura de `printable-invoice` a `printable-factura`:

**Antes (línea 825)**:
```tsx
<div id="printable-invoice" className="space-y-4">
```

**Después**:
```tsx
<div id="printable-factura" className="space-y-4">
```

### 3. Mantener compatibilidad

- El POS seguirá usando `#printable-invoice` para tickets térmicos
- Ventas usará `#printable-factura` para facturas A4

---

## Cambios en Archivos

| Archivo | Acción |
|---------|--------|
| `src/index.css` | Agregar estilos para `#printable-factura` con formato A4 |
| `src/pages/Ventas.tsx` | Cambiar ID de `printable-invoice` a `printable-factura` |

---

## Resultado Esperado

- Las facturas desde la página Ventas se imprimirán en formato A4 con la posición correcta
- Los tickets del POS seguirán imprimiéndose en formato térmico 80mm
- Cada tipo de documento usará el formato de papel apropiado
