## Problema

`src/lib/imprimirPickingMostrador.ts` arma una tabla con **6 columnas** (check, código, descripción, cantidad, real, precio) sobre un ancho útil de 72 mm. En la impresora térmica esas columnas quedan tan angostas que la descripción se corta y el resto de los campos se pisan. El ticket factura se ve bien porque tiene menos columnas.

## Objetivo

Reordenar el ticket de picking para que cada ítem ocupe **más de una fila**, priorizando la legibilidad de descripción + cantidad, y dejando el espacio manuscrito (Real / Precio) sólo en pesables.

Solo cambia `src/lib/imprimirPickingMostrador.ts`. Sin cambios de datos, firmas ni llamados.

## Nuevo layout por ítem (80mm)

```text
☐  [CÓDIGO]                         CANT: 2 u
   Descripción completa del producto sin truncar
   Real: ______ kg    Precio: $ __________   <- solo pesables
   ---------------------------------------------
```

- Fila 1: checkbox + código a la izquierda, cantidad + unidad a la derecha, en negrita.
- Fila 2: descripción a ancho total del ticket, con `word-break` para nombres largos.
- Fila 3 (condicional, solo pesables): línea manuscrita "Real: ____ kg   Precio: $ __________".
- Separador punteado entre ítems.

## Cambios en `imprimirPickingMostrador.ts`

1. Reemplazar la `<table>` de 6 columnas por una lista de bloques `<div class="item">…</div>`, uno por ítem, con:
   - `row1`: check + código a la izquierda, cantidad a la derecha (flex, `justify-content: space-between`).
   - `desc`: descripción a ancho completo.
   - `manual`: "Real: ____ kg   Precio: $ __________" solo cuando `esPeso(unidad_medida)` es true.
2. Ajustar estilos:
   - Font base 12px, código 10px, cantidad en negrita 12px.
   - `.desc { word-break: break-word; font-size: 12px; margin: 2px 0; }`.
   - Borde punteado inferior en `.item` para separar visualmente.
   - Quitar reglas de `table/th/td`.
3. Mantener sin tocar: encabezado `PICKING`, meta (número, fecha, operador), bloque `Cliente:`, aviso `*** PREPARACIÓN ***`, firma, script de auto-print y `@page 80mm`.

## Fuera de alcance

- No se toca el ticket factura ni `imprimirTicketFactura.ts`.
- No se cambia el contenido de los datos ni el flujo de impresión desde `PrepararMostradorDialog`.
- No se modifican estilos globales de `index.css`.