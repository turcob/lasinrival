# Lectura de códigos de balanza Kretz en el POS

Solo se modifica `src/pages/POS.tsx`.

## Qué se logra
Al escanear una etiqueta de balanza (EAN-13 de peso variable), el POS reconoce el PLU y el peso impreso y agrega el producto al carrito con ese peso exacto, sin pedir el peso a mano.

## Detalle técnico

### 1. Helper puro a nivel módulo
`parseCodigoBalanza(raw)` (arriba del componente, tal cual la especificación):
- valida formato `^2\d{12}$`
- valida dígito verificador EAN-13; si falla → `null` (se trata como término normal)
- `plu = s.slice(1,6)`, `pesoKg = s.slice(6,12) / 1000`
- `pesoKg <= 0` → `null`

### 2. Intercepción en `handleSearchKeyDown` (POS.tsx:694)
Antes de `buscarPorCodigoExacto`:
- `null` → flujo actual sin cambios
- 1 match por `plu_balanza === plu` sobre el array completo `productos` → agregar con `cantidad = pesoKg`, limpiar input, `focusBuscador()`
- 0 matches → toast "PLU de balanza {plu} no asignado a ningún producto" (no cae a código de barra)
- >1 match → `setSearchTerm` deja la lista filtrada visible con esos productos + toast "PLU {plu} duplicado — seleccioná el producto (el peso deberá cargarse manualmente)"; sin peso automático

En los tres casos: `return`.

### 3. Agregado con peso (`agregarConPesoBalanza`)
- Valida precio con `getProductoPrice` (mismo mensaje de error existente).
- Si el ítem ya está en el carrito: `updateCantidadDirecta(item.id, cantidad + pesoKg)` — mismo camino que `handleGuardarPeso`, recalcula escalas y subtotal.
- Si no está: nueva línea con `cantidad = pesoKg`, precio por `getProductoPrice(producto, pesoKg)` y `calcSubtotal`, salteando el diálogo de peso y el comportamiento de `cantidad: 1` de modo mostrador.
- Nunca abre el diálogo "Ingresar Peso".

### 4. Datos
- `plu_balanza` agregado al `select` de productos (POS.tsx:460).
- `plu_balanza?: number | null` en la interfaz `Producto`.

## Fuera de alcance
`ProductSearchModal.tsx`, `calcSubtotal`, `getProductoPrice`.
