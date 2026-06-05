## Problema

En el remito B 00001-00000171 aparece "3%" cuando la bonificación real es 2.5%. La causa está en `src/lib/imprimirRemito.ts`:

```ts
${linea.descuento > 0 ? linea.descuento.toFixed(0) + '%' : ''}
```

`toFixed(0)` redondea al entero más cercano (2.5 → 3, 7.5 → 8, etc.).

## Cambio propuesto

Reemplazar el formateo para preservar decimales solo cuando existan:

- Si el descuento es entero (ej. 5) → mostrar `5%`
- Si tiene decimales (ej. 2.5) → mostrar `2.5%`
- Máximo 2 decimales, sin ceros sobrantes (ej. 2.50 → `2.5%`)

Implementación: usar una función helper local tipo `formatBonif(n)` que devuelva `Number(n).toString()` luego de redondear a 2 decimales con `Math.round(n*100)/100`.

## Alcance

- Único archivo afectado: `src/lib/imprimirRemito.ts` (solo el render de la celda "Bon.").
- No se altera layout, dimensiones, duplicado ni estilos del remito (respeta la regla ORO).
- No se tocan datos en DB ni cálculos de subtotal/total.

## Verificación

Reimprimir un remito con una línea bonificada al 2.5% y confirmar que la columna "Bon." muestre `2.5%` en vez de `3%`.