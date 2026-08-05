# Código sugerido por categoría/subcategoría (Productos)

## Objetivo
Al crear un producto nuevo, primero se eligen Categoría y Subcategoría y el sistema propone el próximo código disponible dentro de esa subcategoría. La propuesta es editable: nunca obliga.

## Cómo se ve
- En el formulario de nuevo producto, los selectores de Categoría y Subcategoría pasan arriba, antes del campo Código.
- Al elegir la subcategoría, el campo Código se completa automáticamente con el siguiente número libre (por ejemplo, si el último de "FIDEOS Y LEGUMBRES" es 03002194, propone 03002195).
- Debajo del campo aparece una nota tipo "Sugerido para FIDEOS Y LEGUMBRES: 03002195" con un botón para volver a aplicar la sugerencia si el usuario lo borró o lo editó.
- El usuario puede escribir cualquier código a mano; si lo modifica, el sistema no lo vuelve a sobreescribir.
- Si la subcategoría no tiene productos aún, se propone el primero (código de grupo + 001).
- En edición de un producto existente no se toca el código: la sugerencia solo actúa en creación.

## Regla del código
El código se arma como: código de grupo de la subcategoría (5 dígitos) + 3 dígitos secuenciales.
Se toma el mayor secuencial existente entre los productos de esa subcategoría cuyo código empieza con el código de grupo, y se suma 1 (con relleno de ceros a 3 posiciones). Si el resultado ya existe, se avanza al siguiente libre.

## Detalles técnicos
- Archivo único: `src/pages/Productos.tsx` (solo front-end).
- Se agrega `codigo_grupo` a la carga de `subcategorias` (hoy trae `id, nombre, categoria_id`).
- Nueva función `sugerirCodigo(subcategoriaId)` que consulta `productos` con `select('codigo_articulo').like('codigo_articulo', grupo + '%')` y calcula el máximo sufijo numérico; se ejecuta al cambiar la subcategoría en modo creación.
- Se agrega un flag de estado `codigoEditadoManualmente` para no sobreescribir lo tipeado por el usuario.
- Reordenamiento del JSX del diálogo: bloque Categoría/Subcategoría antes del bloque Código; sin cambios de validación (Código sigue siendo requerido) ni de lógica de guardado.
