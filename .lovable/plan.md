# Precios por cantidad (escalas) + control de coherencia caja/unidad

## Idea central
Hoy un producto tiene un solo precio por lista (costo x margen, o precio fijo por excepcion). La propuesta agrega **escalas de cantidad**: una misma linea de producto puede tener varios tramos de precio unitario.

Ejemplo producto X en la lista Mostrador:
```text
desde 1  unidad  -> 1500 c/u
desde 4  unidades -> 1350 c/u
desde 12 unidades -> 1300 c/u
```
El POS toma la cantidad del renglon y aplica automaticamente el tramo que corresponde. Si el vendedor pasa 12 unidades una por una, la cantidad del renglon llega a 12 y el precio baja solo a 1300.

## Interfaz 1: escalas en la ficha del producto
En la pantalla Productos, dentro del producto, una seccion **Precios por cantidad** (por lista de precios, con el selector de lista que ya existe):
- Tabla chica editable: `Desde cantidad | Precio unitario | % implicito sobre costo | Vigencia (opcional)`.
- Fila base fija "desde 1" = el precio actual de la lista (calculado o fijo). Debajo se agregan tramos.
- Boton "+ Agregar tramo". Se puede cargar precio final o porcentaje; se muestra siempre el otro valor calculado.
- Validaciones en vivo: cantidades sin repetir, orden creciente, y aviso si un tramo mayor tiene precio unitario **mas alto** que el anterior.
- Desde la seleccion multiple de la tabla de Productos: accion **Cargar escala de cantidad** para aplicar el mismo esquema (ej. "desde 4: -10%", "desde 12: -13%") a varios productos de una vez.

## Interfaz 2: vinculo caja <-> unidad
En la ficha del producto caja (el que tiene su propio codigo de barra), un bloque **Equivalencia**:
- `Es empaque de: [producto unidad]` + `Contiene: [12] unidades` (reusa `cantidad_por_empaque`).
- Debajo, un panel de coherencia siempre visible que compara, por lista:
  ```text
  Unidad  x12  = 1300 c/u  -> 15.600
  Caja               1.290 c/u -> 15.480
  Diferencia: -120 (-0,8%)  [Igualar al tramo x12]
  ```
- Si la diferencia supera una tolerancia configurable (por defecto 1%), el bloque se pone en estado de alerta y el boton "Igualar" fija el precio de la caja al tramo equivalente (o al reves).

## Interfaz 3: alertas de precios incoherentes
- En la tabla de Productos, un chip de advertencia en la fila del producto caja/unidad cuando hay divergencia, y un filtro **Solo con precios incoherentes**.
- En Listas de Precios, panel **Revision de coherencia**: lista de todos los pares caja/unidad fuera de tolerancia, con el precio de cada lado, la diferencia y accion de igualar (individual o en lote).
- En el POS, aviso no bloqueante en el renglon: "hay caja x12 mas conveniente" cuando la cantidad de unidades alcanza el empaque, para que el vendedor pueda cambiar de producto si quiere descontar stock de caja.

## Comportamiento en POS y pedidos
- El precio unitario del renglon se recalcula al cambiar la cantidad, mostrando un badge con el tramo aplicado ("x12").
- Si el usuario edita el precio a mano, gana el precio manual y el badge pasa a "manual".
- Los descuentos por solicitud siguen aplicandose despues del tramo, sin cambios.

## Detalle tecnico
- Nueva tabla `public.lista_precio_escalas`: `lista_precio_id` (null = todas las listas), `producto_id`, `cantidad_desde int`, `precio_unitario numeric null`, `porcentaje numeric null`, `fecha_inicio/fecha_fin`, unique `(lista_precio_id, producto_id, cantidad_desde)`, con GRANTs + RLS igual a `lista_precio_excepciones`.
- `productos`: `empaque_de_producto_id uuid null` (self FK) para vincular caja -> unidad; se reutiliza `cantidad_por_empaque`.
- `configuracion_comercio`: `tolerancia_precio_empaque numeric default 1` (porcentaje).
- `src/lib/precioUtils.ts`: nueva `obtenerPrecioVentaPorCantidad(producto, listaId, cantidad, porcentajes, excepciones, escalas)` que elige el tramo mayor con `cantidad_desde <= cantidad` y cae al calculo actual cuando no hay tramos. La firma actual se mantiene delegando con `cantidad = 1`, para no romper consumidores.
- Nuevo helper `calcularCoherenciaEmpaque(unidad, caja, listaId, ...)` que devuelve precios comparados, diferencia y si excede tolerancia.
- UI: `src/components/productos/EscalasCantidadDialog.tsx` (tramos, individual y en lote), bloque de equivalencia + coherencia en el formulario de `src/pages/Productos.tsx`, panel de revision en `src/pages/ListasPrecios.tsx`.
- Consumidores a actualizar para pasar cantidad y cargar escalas: `src/pages/POS.tsx`, `src/components/pos/ProductSearchModal.tsx`, `NuevoPedidoDialog`, `EditarPedidoDialog`, `PrepararPedidoDialog`, `DetalleListaPrecioDialog`, `ImprimirPreciosDialog` (etiquetas siguen usando el tramo desde 1).
