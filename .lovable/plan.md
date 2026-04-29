Sí, entiendo la idea general. Lo que querés es que desde Logística se pueda ajustar una hoja de ruta ya armada cuando el total consolidado de un producto no coincide con lo que realmente se quiere llevar/facturar, bajando cantidades en pedidos/remitos existentes y reimprimiendo el remito corregido.

Plan propuesto:

1. Agregar botón “Refacturar hoja”
   - Ubicación: dentro del detalle de una Hoja de Ruta, junto a las acciones principales.
   - Al presionarlo abrirá una pantalla lateral/modal de refacturación para esa hoja.
   - Solo se podrá usar si la hoja tiene pedidos/paradas cargados.

2. Pantalla de refacturación
   - Mostrar un selector de producto con el consolidado de la hoja:
     - código
     - descripción
     - cantidad total actual contemplada entre todos los pedidos/facturas/remitos de la hoja
   - Al seleccionar un producto, pedir “Nueva cantidad”.
   - Validaciones:
     - La nueva cantidad debe ser menor que la cantidad actual.
     - No permitir aumentar cantidades en este flujo.
     - No permitir cantidades negativas.
     - Mostrar cuánto se va a descontar: `cantidad actual - nueva cantidad`.

3. Regla para descontar de pedidos/remitos
   - Buscar todas las facturas/pedidos de esa hoja que contienen ese producto.
   - Ordenarlas desde la que menos cantidad tiene de ese producto hacia la que más tiene.
   - Ir quitando cantidad desde esas facturas hasta completar la diferencia.
   - Ejemplo:
     - Pedido A tiene 3
     - Pedido B tiene 4
     - Pedido C tiene 5
     - Total actual: 12
     - Nueva cantidad: 10
     - Diferencia a quitar: 2
     - Se descuenta primero del pedido que menos tiene: Pedido A pasa de 3 a 1.
   - Si la diferencia fuera mayor que el primer pedido, se seguirá con el siguiente hasta completar.

4. Actualización de datos
   - Actualizar `pedido_detalles` del/los pedidos afectados:
     - `cantidad_pedida`
     - `cantidad_entregada`
     - `subtotal`
   - Recalcular y actualizar el total/subtotal de cada pedido afectado.
   - Registrar en historial del pedido una observación del tipo:
     - “Refacturación hoja de ruta #44: producto X ajustado de 3 a 1”.
   - Refrescar la hoja de carga para que el consolidado muestre la nueva cantidad.

5. Anulación/remito anterior y generación del nuevo
   - Como el sistema actualmente imprime el remito usando el número del pedido y los datos actuales del pedido, el “remito anterior” no existe como archivo separado guardado en base de datos.
   - Por eso, en esta primera implementación la anulación será funcional/operativa:
     - se registra en el historial que el remito anterior quedó anulado por refacturación;
     - se actualizan los valores del pedido;
     - se habilita/imprime el nuevo remito con cantidades e importes corregidos.
   - Al finalizar la refacturación, se mostrará un resumen de pedidos afectados y un botón para imprimir los nuevos remitos afectados.

6. Impresión posterior
   - Reutilizar el formato actual de remitos A4 fijo.
   - No tocar el layout bloqueado de `src/lib/imprimirRemito.ts`; solo usarlo para generar remitos con los datos nuevos.
   - El usuario podrá imprimir los remitos afectados inmediatamente después del ajuste.

Flujo esperado:

```text
Detalle Hoja de Ruta
  -> Refacturar hoja
  -> Seleccionar producto consolidado
  -> Ver cantidad actual total
  -> Ingresar nueva cantidad menor
  -> Confirmar
  -> Sistema descuenta desde el pedido con menor cantidad
  -> Actualiza pedidos/totales
  -> Registra historial/anulación operativa
  -> Muestra resumen
  -> Imprimir remitos nuevos afectados
```

Notas técnicas:
- No voy a modificar el archivo de formato de impresión del remito salvo que sea estrictamente necesario, porque hay una regla del proyecto que bloquea cambios de layout/dimensiones/estilos ahí.
- Para que esto sea seguro y consistente, conviene encapsular la operación de refacturación en una función de backend/base de datos o en un hook que haga todos los updates de forma controlada. Si el proyecto permite migración, lo ideal es una función transaccional para evitar que quede un pedido parcialmente actualizado si algo falla.
- También revisaría si existe movimiento de cuenta corriente ya generado por el pedido preparado; si lo hay, hay que ajustar o registrar la diferencia para que la deuda del cliente no quede con el importe viejo. En el plan base, además del total del pedido, se debe corregir el movimiento asociado al concepto del remito/pedido si corresponde.

Confirmación de entendimiento del ejemplo:
- Si el producto X suma 12 entre 3 remitos/facturas y se refactura a 10, hay que quitar 2 unidades.
- Se quita empezando por el pedido/remito que menos unidades tiene de X.
- Ese remito queda marcado como anulado/corregido en historial y se imprime uno nuevo con la cantidad e importe actualizados.