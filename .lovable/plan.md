## Cierre del módulo `/encargado`

Faltan 2 pasos para que el módulo mobile-first quede operativo y compile:

### 1. Crear página de detalle de hoja de ruta
**Archivo nuevo:** `src/pages/EncargadoHojaDetalle.tsx`

- Layout mobile-first (`max-w-md mx-auto`, header sticky con back, #hoja, estado).
- Carga la hoja por `:id` usando `useEncargadoHojas` (filtrada por responsable/chofer).
- Tabs dinámicas según estado:
  - `en_carga` → `CargaTab` + botón "Confirmar carga".
  - `carga_confirmada` → botón "Salir a ruta" (pasa a `en_ruta`).
  - `en_ruta` → `ParadasTab` + `ResumenCobrosTab`.
  - `completada` / `rendida` → `RendicionTab` + `ResumenCobrosTab` (read-only si ya rendida).
- Reusa los componentes ya creados en `src/components/encargado/`.

### 2. Registrar rutas en `src/App.tsx`
- `/encargado` → `<Encargado />` (listado), protegida con `ProtectedRoute`.
- `/encargado/:id` → `<EncargadoHojaDetalle />`, protegida con `ProtectedRoute`.
- Sin tocar sidebar ni `/logistica`.

### Verificación
- Compilación limpia.
- Navegar `/encargado` muestra solo hojas del usuario logueado.
- Detalle muestra tabs correctas por estado y permite ejecutar el flujo end-to-end (confirmar carga → ruta → paradas/cobros/devoluciones → rendición).

Sin cambios de schema, sin nuevas dependencias, sin tocar `/logistica`.