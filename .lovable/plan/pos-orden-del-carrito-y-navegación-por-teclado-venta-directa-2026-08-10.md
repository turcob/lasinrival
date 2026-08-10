# POS: orden del carrito y navegación por teclado (venta directa + pedidos mostrador)

Todo el trabajo es front-end en `src/pages/POS.tsx`, `src/components/pos/ProductSearchModal.tsx` y `src/components/pos/PedidosMostradorPanel.tsx`. Sin cambios de datos ni de lógica de negocio.

## 1. Último producto arriba

- El carrito se muestra en orden inverso: el ítem recién escaneado/cargado aparece primero.
- Se invierte solo la **presentación** (`[...cart].reverse()` al renderizar); el array `cart` que se guarda en la venta/pedido no cambia de orden, así que totales, guardado y picking siguen igual.
- La navegación con ↑/↓ entre cantidades pasa a seguir el orden visual (↑ = ítem de arriba en pantalla).

## 2. Modal de búsqueda de productos: navegación con flechas

- Desde el input de búsqueda, **↓** (o Tab) baja a la lista de resultados y marca el primero.
- **↑/↓** recorren los resultados con resaltado visible; el ítem activo hace scroll automático a la vista.
- **Enter** selecciona el resaltado (mismo camino que el clic actual, incluido el peso de balanza).
- **Esc** vuelve el foco al input de búsqueda; con el input ya enfocado, cierra el modal.
- Cada fila de resultado pasa a ser un elemento enfocable real (rol botón + Enter/Espacio), manteniendo el clic con mouse.

## 3. Diálogo de cobro: flechas entre formas de pago

- **←/→/↑/↓** mueven la selección entre los botones de forma de pago (grilla de 2 columnas), con Enter/Espacio para activar.
- Se mantienen los atajos numéricos 1..9 y el foco inicial en Efectivo (botón azul).
- El botón de forma de pago activo queda visualmente resaltado.

## 4. Foco al volver de un sub-diálogo de pago

Hoy, al cerrar los diálogos de importe / transferencia / cheque / cuotas, el foco se pierde y hay que usar el mouse. Se corrige:

- Al cerrarse cualquier sub-diálogo, el foco vuelve al diálogo de pago:
  - si queda saldo pendiente → al botón de la forma de pago sugerida (Efectivo);
  - si el total ya está cubierto → al botón de confirmar venta.
- Igual comportamiento al cancelar con Esc que al confirmar.
- Enter sigue confirmando la venta cuando el pagado iguala el total.

## 5. Pedidos mostrador operable con teclado

Se habilitan los atajos también en la pestaña "Pedidos mostrador", conservando el mismo significado que en venta directa donde aplica:

```text
F2  foco al buscador de producto
F3  abrir catálogo de productos
F4  cliente / empleado
F6  foco en la lista de "Pedidos en curso"
F7  nuevo pedido (limpia el carrito)
F8  imprimir picking del pedido enfocado
F9  Enviar a preparar / Imprimir (según estado del pedido en edición)
F10 marcar Preparado (cuando el pedido está en preparación)
Esc volver el foco al buscador
```

- Dentro de la lista de pedidos: **↑/↓** mueven entre pedidos, **Enter** carga el pedido en el carrito, **P** (o F8) imprime/reimprime su picking, **Shift+Supr** lo elimina (con confirmación).
- El pedido enfocado se resalta con anillo de foco visible.
- Una línea de ayuda con los atajos de mostrador, análoga a la que ya existe en venta directa.

## Detalle técnico

- `POS.tsx`: el `useEffect` de atajos deja de cortar con `modoPos !== 'directa'`; se separa en atajos comunes (F2/F3/F4/Esc) y atajos por modo (F9 cobro en directa; F6/F7/F8/F9/F10 en mostrador). Se sigue ignorando cuando hay un diálogo abierto.
- Render del carrito: `const cartVisible = useMemo(() => [...cart].reverse(), [cart])`; `moverFocoCantidad` invierte el signo del delta para coincidir con el orden visual. Los refs siguen indexados por `item.id`.
- `ProductSearchModal.tsx`: estado `activeIndex`, refs por fila (`Map<string, HTMLDivElement>`), `scrollIntoView({ block: 'nearest' })` y handlers de `ArrowUp/ArrowDown/Enter/Escape` en el input y en la lista.
- Diálogo de pago: refs a los botones de forma de pago y al de confirmar, más un helper `focusPagoDialog()` llamado en el `onOpenChange(false)` de los sub-diálogos y al terminar `addPago`.
- `PedidosMostradorPanel.tsx`: se expone un ref imperativo (`focusLista()`) y navegación con flechas sobre los items ya existentes (`role="button" tabIndex={0}`), reutilizando `onImprimirPicking` para el pedido enfocado.