# Precios desde la pantalla Productos

## 1. Renombrar la herramienta actual
"Actualizar Precios" pasa a llamarse **Actualizador de Costo Agrupado** (botón y título del diálogo), para dejar claro que modifica el **costo** y no el precio de venta.

## 2. Ver precio de venta en la tabla de Productos
- Selector de **Lista de precios** arriba de la tabla (por defecto la primera lista activa; se recuerda la última elegida).
- Nueva columna **Precio venta** con el precio calculado para esa lista, con un indicador chico del origen del margen (excepción / marca / tipo / general) y "Sin precio" cuando no hay regla.
- El cálculo usa la jerarquía ya vigente: excepción > marca > tipo > general.

## 3. Selección múltiple + fijar precio de venta directo
- Checkbox por fila y "seleccionar todo" sobre los productos filtrados.
- Barra de acciones cuando hay selección: "N seleccionados" → botón **Fijar precio de venta**.
- Diálogo:
  - Lista sobre la que se aplica (por defecto la lista visible; opción "todas las listas").
  - Modo **Precio fijo**: se escribe el precio final deseado y queda fijo, sin calcular porcentaje. Se puede aplicar el mismo precio a todos los seleccionados o cargar un precio por producto en una mini-tabla.
  - Modo **Porcentaje**: margen manual (comportamiento actual de excepciones).
  - Vigencia opcional (desde / hasta) y descripción, igual que las excepciones actuales.
  - Vista previa: costo, precio actual y precio nuevo antes de confirmar.
- Estas definiciones son excepciones por producto: pisan cualquier margen por marca, tipo o general, y se pueden quitar para volver al margen automático.

## 4. Coherencia en el resto del sistema
El precio fijo se respeta en todos los lugares que ya calculan precio de venta (POS, pedidos, impresión de etiquetas, detalle de lista de precios), no sólo en la pantalla de Productos.

## Detalle técnico
- Migración: agregar `precio_fijo numeric null` a `public.lista_precio_excepciones`, permitir `porcentaje` nulo y un check de que venga uno de los dos. Se mantienen RLS y grants existentes.
- `src/lib/precioUtils.ts`: si la excepción vigente tiene `precio_fijo`, devolver ese precio con `origen: 'fijo'`; si no, seguir con la lógica de porcentaje.
- `src/pages/Productos.tsx`: cargar `listas_precios`, `lista_precio_porcentajes` y `lista_precio_excepciones`; estado de selección (`Set<string>`); nueva columna y barra de acciones; renombrar el botón del actualizador de costos.
- Nuevo `src/components/productos/FijarPrecioVentaDialog.tsx`: upsert en `lista_precio_excepciones` por (lista, producto) en lotes.
- Revisar consumidores de `precioUtils` (POS, pedidos, `DetalleListaPrecioDialog`, `ImprimirPreciosDialog`) para que traigan el nuevo campo.