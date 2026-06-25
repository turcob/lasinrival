## Objetivo
Que al abrir "Confirmar Arqueo" el empleado quede pre-seleccionado automáticamente con el empleado vinculado al usuario de la caja.

## Diagnóstico
`ConfirmarArqueoDialog.tsx` ya intenta preseleccionar buscando `empleados.user_id === caja.usuario_id`, pero falla cuando:
- El empleado vinculado está marcado como `activo = false` (el query filtra `.eq('activo', true)`).
- No existe ningún empleado vinculado a ese `user_id`.

## Cambios en `src/components/cajas/ConfirmarArqueoDialog.tsx`

1. Quitar el filtro `.eq('activo', true)` al cargar empleados (o cargar el vinculado por separado) para garantizar que el empleado del cajero aparezca y se pueda preseleccionar aunque esté inactivo.
2. Mantener el orden por nombre y la búsqueda por `user_id` para setear `empleadoId` antes de que el usuario interactúe.
3. Si no se encuentra empleado vinculado al `usuario_id` de la caja, mostrar un texto de aviso debajo del Select: "El usuario de la caja no tiene un empleado vinculado. Seleccioná uno manualmente." para que quede claro por qué no se autocompleta.
4. Asegurar que el `Select` use el `empleadoId` ya seteado (sin resetearlo después de la carga).

No se modifica la RPC ni el esquema. Solo UI del diálogo.