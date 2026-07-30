## Mejoras al diálogo de Impresión de Precios

Todo front-end, en `src/components/productos/ImprimirPreciosDialog.tsx`.

### 1. Cantidad de copias por ítem
- Agregar campo `copias: number` (default 1) a la interfaz `Cartel`.
- En el panel derecho, cada cartel suma un input numérico "Copias" (min 1, max 100) junto a Entero / Decimales / Unidad.
- Al imprimir, cada cartel se expande a `copias` celdas consecutivas antes de paginar por N por hoja.
- El contador del header pasa a mostrar carteles y total de etiquetas (ej. "3 carteles · 12 etiquetas").

### 2. Búsqueda por código de barra
- Sumar `codigo_barra` al `select` de productos y a la interfaz `ProductoRow`.
- Incluirlo en el filtro de texto (además de código de artículo y descripción).
- Si el término coincide exactamente con un `codigo_barra`, ese producto se ordena primero en la lista filtrada.

### 3. Tamaño aproximado por etiqueta en el selector
- Calcular en base al área imprimible A4 con márgenes 8mm y gap 3mm:
  ancho = (194 − 3·(cols−1)) / cols, alto = (280 − 3·(rows−1)) / rows.
- Mostrar en cada opción del select: `4 por hoja (95 × 138 mm)`, etc., redondeado a mm enteros.
- Se calcula desde la misma constante `LAYOUTS` que usa la impresión, para que nunca se desincronice.

### Notas técnicas
- La lógica de escalado de precio y nombre (3 renglones, auto-achique) queda intacta.
- El precio y el layout de la hoja no cambian; sólo se altera la cantidad de celdas generadas.
