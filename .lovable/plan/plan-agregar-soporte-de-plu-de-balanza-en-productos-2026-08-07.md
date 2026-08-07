# Plan: Agregar soporte de PLU de balanza en productos

## Objetivo
Agregar una columna `plu_balanza` en `public.productos` para soportar códigos PLU de balanza Kretz (etiquetas EAN-13 de peso variable, formato 2-5-6).

## Alcance
- Solo cambio de schema en tabla existente `public.productos`.
- No se crean tablas nuevas.
- No se modifican políticas RLS ni grants (los grants a nivel tabla ya cubren columnas nuevas).
- No se toca frontend en este paso (POS.tsx ni tipos Producto se mantienen intactos).

## Cambio técnico (SQL)

````sql
ALTER TABLE public.productos
  ADD COLUMN plu_balanza integer;

ALTER TABLE public.productos
  ADD CONSTRAINT productos_plu_balanza_rango
  CHECK (plu_balanza IS NULL OR (plu_balanza > 0 AND plu_balanza <= 99999));

CREATE INDEX idx_productos_plu_balanza
  ON public.productos (plu_balanza)
  WHERE plu_balanza IS NOT NULL;

COMMENT ON COLUMN public.productos.plu_balanza IS
  'PLU de balanza Kretz (etiqueta EAN-13 peso variable, prefijo 2, formato 2-5-6). Nullable, no unico todavia (resolver duplicados antes de indice unico).';
````

## Validación post-migración
1. Verificar que la columna `plu_balanza` existe en `public.productos`.
2. Verificar que el constraint de rango 1-99999 está activo.
3. Verificar que el índice parcial `idx_productos_plu_balanza` fue creado.

## Próximos pasos (fuera de este plan)
- Actualizar tipos TypeScript de `Producto`.
- Modificar búsqueda en POS.tsx para matchear por `plu_balanza`.
- Agregar campo en formulario de productos.
