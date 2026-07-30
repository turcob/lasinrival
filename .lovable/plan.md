## Respuesta al punto 4 (verificado en código)

`addToCart` en `src/pages/POS.tsx` (L556) **ya incrementa cantidad** si el producto existe: busca `prev.find(item => item.producto?.id === producto.id && !item.es_temporal)` y, si lo encuentra, hace `cantidad + 1` recalculando subtotal, sin reordenar ni duplicar línea. No hay que cambiar esa lógica.

Salvedad: si el producto es por peso (KG/KILO) y el modo NO es `mostrador`, en vez de sumar abre el diálogo de peso (`setPesoDialogOpen(true)`) sobre la línea existente. En modo mostrador (`modoPos === 'mostrador'`) salta ese prompt y suma directo. Esto se mantiene tal cual: el escaneo reutiliza `addToCart`, así que hereda ese comportamiento.

En el modal, el click en un resultado llama `handleProductSelectedFromModal` → abre `ProductQuantityModal` → `handleConfirmProductQuantity`, que también suma sobre la línea existente. Para el escaneo dentro del modal, el plan usa `onSelectProduct` (la misma función de alta que el click), respetando la consigna.

## Cambios (front-end únicamente)

### 1. `src/pages/POS.tsx`
- `interface Producto` (L70): agregar `codigo_barra?: string | null`.
- `fetchData` (L436): agregar `codigo_barra` al `select` de `productos`.
- `filteredProductos` (L487) y `totalResults` (L497): sumar `(p.codigo_barra || '').toLowerCase().includes(term)` al filtro OR existente. Sin otros cambios de comportamiento.
- Nuevo helper `buscarPorCodigoExacto(term)`: sobre `productos` (ya filtrados por `activo`), devuelve los que cumplen igualdad exacta (case-insensitive, trim) contra `codigo_barra` o `codigo_articulo`.
- Nuevo `searchInputRef` en el `Input` de búsqueda (L2630) + `onKeyDown`:
  - `Enter` → `preventDefault`; toma `searchTerm.trim()`; si vacío, no hace nada.
  - 1 match exacto → `addToCart(producto)` (misma función que el click en resultado inline; ya suma cantidad si existe). `addToCart` limpia `searchTerm` y `showAllResults`; luego refoco al input con `setTimeout(..., 0)`.
  - >1 match → no agrega nada; deja el término y la lista filtrada visible.
  - 0 match → `toast.error('Producto no encontrado')`, sin limpiar el input.
  - Enter nunca agrega resultados de la búsqueda por texto.

### 2. `src/components/pos/ProductSearchModal.tsx`
- `interface Producto`: agregar `codigo_barra?: string | null` (recibe productos por props, sin query propia).
- `filteredProductos` (L53): sumar `codigo_barra` al `includes`.
- `ref` en el `Input` (L93) + `onKeyDown` con la misma lógica de match exacto: 1 → `onSelectProduct(producto)` (idéntico al click en la tarjeta), limpiar `searchTerm` y refocar; >1 → dejar lista filtrada; 0 → `toast.error('Producto no encontrado')`.
- Requiere importar `toast` de `sonner` y `useRef`.

## Fuera de alcance (confirmado)
Sin migraciones, sin tocar `pos_registrar_venta`, sin cambios de estilos/layout ni remitos, sin librerías de scanner, sin tocar `NuevoPedidoDialog.tsx`.

## Nota
Existen 2 códigos de barra duplicados (4 productos). Con el match exacto múltiple el flujo cae en el caso ">1" y el usuario elige de la lista, como pediste.
