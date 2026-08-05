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

## Compatibilidad con produccion (sin romper nada)
El sistema esta en produccion, por lo que el cambio se hace **aditivo** y con comportamiento por defecto identico al actual:

- **Base de datos**: solo se agregan objetos nuevos (tabla `lista_precio_escalas`, columna de vinculo caja/unidad en `productos`, columna de tolerancia en configuracion). No se modifica ni renombra ninguna columna existente, no se toca `lista_precio_excepciones` ni ninguna RPC de ventas (`pos_registrar_venta`, `pos_actualizar_pedido_estado`, `get_ventas_lista`).
- **Sin escalas cargadas = precios actuales**: mientras no exista ningun tramo, el calculo cae exactamente en la logica de hoy (excepcion > marca > tipo > general). Al no cargar datos, ningun precio cambia.
- **Firma vieja intacta**: `obtenerPrecioVentaProducto` se mantiene con la misma firma y resultado (equivale a cantidad = 1), asi los consumidores que no se toquen siguen funcionando igual (`DetalleListaPrecioDialog`, `ImprimirPreciosDialog`, `ExcelImporterDesactivados`, `FijarPrecioVentaDialog`).
- **Ventas historicas**: el precio se sigue guardando en `venta_detalles.precio_unitario`, por lo que ventas, pedidos, remitos, facturas AFIP y notas de credito ya emitidos no se recalculan nunca.
- **Precio manual gana**: si el operador escribio un precio en el renglon, el tramo no lo pisa (se marca "manual").
- **Alertas no bloqueantes**: los avisos de coherencia caja/unidad son informativos; no impiden vender, facturar ni guardar productos.
- **Permisos**: la tabla nueva usa las mismas politicas RLS y GRANTs que `lista_precio_excepciones`, sin ampliar accesos.

## Orden de aplicacion
1. Migracion aditiva (tabla + columnas + RLS/GRANTs).
2. `precioUtils.ts`: nueva funcion con cantidad y helper de coherencia, manteniendo la firma actual.
3. UI de escalas en Productos (individual y en lote) + bloque de equivalencia caja/unidad.
4. POS y pedidos: pasar la cantidad al calculo y mostrar el badge de tramo.
5. Panel de revision de coherencia en Listas de Precios.

Verificacion antes de cerrar: con la tabla de escalas vacia, POS, pedidos, etiquetas y detalle de lista deben mostrar exactamente los mismos precios que hoy.
