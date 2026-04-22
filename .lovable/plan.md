
Objetivo

Volver al flujo original basado en "pendiente", pero conservando la edición dentro de "Preparar pedido" y trasladando la confirmación final al Consolidado.

Lo que entendí

1. No querés usar más el estado "borrador" para este flujo.
2. Cuando abrís un pedido desde "Preparar pedido", hacés cambios y presionás "Guardar", el pedido debe seguir en estado "pendiente".
3. Si cambiás de pedido con Av Pág / Re Pág, también debe guardar esos cambios y dejar el pedido en "pendiente".
4. Dentro de la pantalla de preparación ya no querés un botón "Confirmar" por pedido. Debe quedar solo "Guardar".
5. La confirmación debe hacerse en el módulo "Consolidado", con un botón que confirme pedidos en lote.
6. En otras palabras:
   - Preparación = editar y guardar cambios
   - Consolidado = confirmar pedidos de una vez
   - Logística = sigue manejando despacho y entrega

Cambios a implementar

1. Preparar Pedido
- Reemplazar la lógica actual de "Guardar borrador" por un simple "Guardar".
- Ese guardado actualizará líneas, cantidades, precios, descuentos y total, pero mantendrá `estado = pendiente`.
- Al navegar entre pedidos con PageDown/PageUp o botones Anterior/Siguiente, se guardarán automáticamente los cambios antes de pasar al siguiente pedido.
- Quitar el botón de confirmación individual del diálogo de preparación.

2. Hook de guardado
- Ajustar `usePrepararPedido` para soportar un guardado de edición sin pasar a `preparado`.
- Separar claramente dos comportamientos:
  - Guardar edición: persiste cambios y deja el pedido en `pendiente`
  - Confirmar masivo: cambia de `pendiente` a `preparado`
- Evitar registrar deuda o movimientos financieros durante el guardado desde preparación.

3. Detalle del pedido
- Mantener el acceso a "Preparar Pedido", pero alineado al nuevo flujo.
- Revisar textos y acciones para que no aparezcan referencias a borrador ni confirmación individual innecesaria.

4. Consolidado
- Agregar/ajustar el botón principal de confirmación para que sea el lugar donde se pasan pedidos de `pendiente` a `preparado`.
- Mantener la confirmación masiva sobre pedidos filtrados/seleccionados.
- Revisar si el botón actual debe renombrarse a algo más claro como "Confirmar pedidos" para que quede explícito que ahí ocurre la confirmación final.

5. Pantalla de Pedidos
- Cambiar el filtro por defecto nuevamente a `pendiente`.
- Quitar del listado las referencias visuales y lógicas pensadas para `borrador`.
- Revisar badges, contadores y acciones para que el flujo visible vuelva a ser: pendiente, preparado, despachado, rechazado.

6. Limpieza del flujo "borrador"
- No usar más `borrador` en UI, navegación, textos, toasts ni acciones.
- Por seguridad, dejar el valor en base de datos sin usar por ahora, en vez de eliminarlo inmediatamente. Así evitamos una migración riesgosa y rompimientos en datos ya creados.
- Si después querés, se puede hacer una segunda etapa de limpieza total del estado borrador.

Archivos a tocar

- `src/components/pedidos/PrepararPedidoDialog.tsx`
- `src/hooks/usePrepararPedido.ts`
- `src/components/pedidos/DetallePedidoDialog.tsx`
- `src/components/pedidos/ConsolidadoPedidos.tsx`
- `src/pages/Pedidos.tsx`
- posiblemente `src/hooks/useConsolidadoPedidos.ts` para ajustar textos/comportamiento de confirmación masiva

Resultado esperado

- Editás un pedido desde "Preparar Pedido".
- Tocás cantidades, agregás o quitás productos.
- Presionás "Guardar" y el pedido sigue en "pendiente".
- Si pasás al siguiente pedido, se guarda y el actual también queda "pendiente".
- No existe más "Confirmar" dentro de cada pedido.
- En "Consolidado" confirmás todos juntos y recién ahí pasan a "preparado".

Detalle técnico

- No hace falta un cambio de estructura de base de datos para resolver esto.
- El cambio principal es de flujo de UI y de mutaciones.
- El valor `borrador` puede quedar existente en el enum pero sin uso funcional, que es la opción más segura en esta etapa.
