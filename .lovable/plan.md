# Venta directa 100% operable con teclado

Objetivo: vender sin tocar el mouse en la pestaña "Venta directa" del POS, con foco inicial en el buscador y una secuencia de Tab predecible. El mouse sigue funcionando igual.

## Comportamiento propuesto

### 1. Foco inicial y post-escaneo
- Al entrar a /pos (y al volver a la pestaña "Venta directa"), el cursor queda en **Buscar producto**.
- Después de escanear/agregar un producto, el foco vuelve al buscador y el campo se limpia (ya funciona en escaneo exacto; se extiende a: elegir del listado rápido, cerrar el modal de búsqueda, confirmar peso y confirmar producto libre).
- Si se pierde el foco por un clic en un área sin controles, se re-enfoca el buscador.

### 2. Orden de Tab en venta directa
Se define un orden explícito y estable (los elementos decorativos o redundantes quedan fuera del recorrido):

```text
1. Buscar producto  (foco inicial, scanner)
2. Cantidad del último ítem agregado
3. Descuento % del último ítem agregado
4. Cliente (buscador de cliente)
5. Modalidad de pago (Pago directo / Cuenta corriente)  -> flechas para elegir
6. Descuento global %
7. Botón COBRAR / Cargar a CC
```

Shift+Tab recorre lo mismo en sentido inverso. Los botones "Producto Libre", "Buscar", "Vaciar" y la lista de precios siguen accesibles con el mouse y con Tab, pero después del botón de cobro (no interrumpen el circuito de venta).

### 3. Navegación dentro del carrito
- En el campo Cantidad: **Enter** confirma y vuelve al buscador; **Escape** cancela la edición.
- **Flecha arriba/abajo** en Cantidad mueve el foco al mismo campo del ítem anterior/siguiente, para corregir cualquier línea sin mouse.
- Se permite Tab hacia Cantidad/Descuento de **todos** los ítems cuando el foco ya está dentro del carrito (hoy solo el último ítem es alcanzable).
- **Supr/Delete** con el foco en una línea del carrito elimina ese ítem (con confirmación por Enter si el ítem tiene descuento aplicado).

### 4. Atajos de teclado (venta directa)
- **F2**: foco al buscador de producto.
- **F3**: abrir modal de búsqueda de productos.
- **F4**: foco al buscador de cliente.
- **F9**: ejecutar Cobrar / Cargar a CC (equivale al botón, con las mismas validaciones).
- **Escape**: cierra el diálogo o el listado abierto; si no hay nada abierto, vuelve el foco al buscador.
- Los atajos se ignoran mientras se está tipeando en un campo de texto salvo F2/F3/F4/F9, y no se disparan en la pestaña "Pedidos mostrador".

### 5. Diálogos de cobro sin mouse
- **Selección de medio de pago**: los medios se recorren con Tab y se activan con Enter/Espacio; el primero recibe foco al abrir el diálogo.
- **Importe**: ya viene con autofoco y prellenado del pendiente; Enter agrega el pago.
- Diálogos de **transferencia**, **cheque** y **peso**: foco al primer campo obligatorio, Enter confirma, Escape cancela.
- Botón final de confirmar venta alcanzable con un Tab desde el último campo.

### 6. Ayuda visible
- Una línea discreta de atajos debajo del buscador (F2 buscar · F3 catálogo · F4 cliente · F9 cobrar · Esc cancelar), para que el operador no tenga que memorizar.

## Detalle técnico

- Trabajo únicamente front-end en `src/pages/POS.tsx`, más ajustes menores de foco en `src/components/pos/ProductSearchModal.tsx` y `src/components/pos/ProductQuantityModal.tsx`. Sin cambios de datos ni de lógica de negocio.
- Reemplazar los `tabIndex` fijos actuales (1/2/3 y `-1` en el resto del carrito) por un esquema coherente: `tabIndex={0}` en el circuito de venta con orden basado en el DOM, reordenando/marcando con `tabIndex={-1}` sólo lo que debe quedar fuera. Se evita mezclar tabindex positivos con 0 porque eso es lo que hoy hace que el recorrido salte de forma impredecible.
- Un `useEffect` con listener de `keydown` a nivel de la vista para los atajos, activo sólo cuando `modoPos === 'directa'` y sin diálogos abiertos donde corresponda.
- Refs por ítem del carrito (`Map<string, HTMLInputElement>`) para mover el foco con flechas y para enfocar la línea recién agregada cuando haga falta.
- Re-enfoque del buscador centralizado en un helper `focusBuscador()` usado por todos los caminos de alta de producto.
