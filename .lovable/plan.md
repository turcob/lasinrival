# Modo "Carga rápida de códigos de barra"

Agregar en la pantalla **Productos** un modo dedicado para cargar códigos de barra con lector/scanner de forma ágil, sin abrir el formulario completo de edición de cada producto.

## UX propuesta

1. Botón nuevo en la barra de acciones de `src/pages/Productos.tsx`: **"Cargar códigos de barra"**.
2. Al abrirlo, se muestra un Dialog a pantalla amplia con:
   - **Buscador de producto** arriba (por código de artículo o descripción). Autofocus.
   - Lista/resultado filtrado (máx. ~20 items) mostrando código de artículo, descripción y el código de barras actual (si lo tiene).
   - El usuario selecciona un producto (click o Enter sobre el primer resultado).
3. Al seleccionar producto:
   - Se muestra una tarjeta con el producto elegido.
   - El foco pasa **automáticamente** al input **"Código de barras"** (autofocus real, `ref.focus()` tras seleccionar).
   - El input acepta el scan (los lectores mandan el código + Enter).
4. Al presionar Enter (o blur con valor):
   - Se guarda `codigo_barra` en `productos` vía `supabase.update` filtrando por `id`.
   - Toast de éxito (solo error o feedback breve; según memoria, evitar toasts innecesarios — usaré uno mínimo de confirmación con auto-dismiss).
   - Se limpia la selección y el buscador vuelve a tomar foco, listo para el siguiente producto.
5. Historial en vivo dentro del diálogo: lista de los últimos N productos cargados en la sesión (código artículo → código barra) para verificar visualmente.

## Validaciones

- Trim del código, rechazar vacío.
- Verificar duplicado: si ya existe otro producto con ese `codigo_barra`, mostrar alerta y no guardar (permitir "sobrescribir en este producto" solo si el usuario confirma).
- Si el producto ya tiene código, pedir confirmación antes de sobrescribir.

## Archivos afectados

- **Nuevo:** `src/components/productos/CargaCodigosBarraDialog.tsx` — Dialog con buscador, selección, input scan y guardado.
- **Editado:** `src/pages/Productos.tsx` — botón "Cargar códigos de barra" que abre el diálogo; refrescar lista tras cerrar.

## Detalles técnicos

- Reusar el fetch de productos ya disponible en `Productos.tsx` (pasarlo por props) para no re-consultar.
- Guardado: `supabase.from('productos').update({ codigo_barra }).eq('id', id)`.
- Chequeo de duplicado: `select id, descripcion from productos where codigo_barra = ? and id != ? limit 1`.
- Manejo de foco con `useRef<HTMLInputElement>` + `useEffect` cuando cambia el producto seleccionado.
- Seguir el design system (tokens semánticos, sin colores hardcodeados).

¿Confirmás para implementarlo así?
