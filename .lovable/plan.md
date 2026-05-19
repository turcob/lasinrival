## Vista del Encargado — `/encargado`

Mini-app responsive (mobile-first) que permite al encargado/chofer hacer todo el ciclo de una hoja de ruta desde el celular sin tocar el backoffice de Logística.

### Acceso y permisos
- Ruta nueva **`/encargado`**, fuera del sidebar (no aparece en `AppSidebar`).
- Protegida con `AuthProvider`: requiere usuario logueado y vinculado a un `empleados` (verificar `empleados.user_id = auth.uid()`).
- Filtra hojas solo donde el user es `responsable_id`, o `chofer_id` si no hay responsable (mismo criterio que `is_route_owner`).
- No toca nada del módulo `/logistica` actual.

### Pantallas

```text
1. Listado de hojas
   ├─ Pendientes hoy: cards grandes con #hoja, fecha, estado, cant. paradas
   └─ Tap → entra al Detalle

2. Detalle de hoja  (header sticky con estado + acción principal)
   Según estado:
   ├─ en_carga          → tab "Carga"  → confirmar mercadería
   ├─ carga_confirmada  → botón "Salir a ruta" (PATCH estado=en_ruta)
   ├─ en_ruta           → tab "Paradas" (default) + tab "Resumen $"
   └─ completada        → tab "Rendición" (crear/editar)

3. Carga (cuando estado=en_carga)
   - Lista agrupada por producto con cantidad_esperada
   - Cada item: botones rápidos [✓ Cargado] [△ Parcial: input cant] [✗ Faltante]
   - Footer: progreso "X de Y verificados"
   - Botón "Confirmar carga" → POST /hojas-ruta/:id/confirmar-carga
     (si quedan pendientes muestra alert para confirmar con forzar:true)

4. Paradas (cuando estado=en_ruta)
   - Lista vertical de paradas, ordenadas por `orden`, swipe / tap
   - Card por parada: nombre cliente, dirección, total pedido, badge estado
   - Tap → modal/sheet con 4 acciones grandes:
       [Entregado completo]  → si saldo>0 abre Cobrar
       [Entrega parcial]     → abre Cobrar + queda saldo
       [Rechazado]           → abre Devoluciones
       [No entregado]        → solo motivo

5. Cobrar (sheet mobile-first, sin diálogo de cheque)
   - Total adeudado del pedido
   - Botones grandes por forma de pago (efectivo, transferencia, QR, tarjeta)
   - Cada selección abre input numérico de monto + referencia opcional
   - Lista de cobros parciales agregados, con suma corriente
   - Botón "Confirmar entrega" → crea N cobros + PATCH parada estado=entregado|entrega_parcial

6. Devolución (cuando rechaza)
   - Lista los productos del pedido, selecciono cantidad a devolver por línea
   - Motivo (chips: rechazo_cliente, vencido, roto, otro)
   - Toggle "Reingresar a stock"
   - Confirmar → POST devoluciones + PATCH parada estado=rechazado

7. Resumen $ (tab dentro del detalle, cuando hay cobros)
   - Vista compacta de lo cobrado por medio de pago (suma)
   - Total cobrado vs total esperado

8. Rendición (cuando estado=completada y no hay rendición aprobada)
   - Auto-calcula totales por medio de pago desde los cobros
   - Inputs editables "declarado" por cada medio
   - Muestra diferencia
   - Observaciones
   - Botón "Enviar rendición" → INSERT hoja_ruta_rendiciones estado=pendiente
   - Si ya existe y está pendiente → permite editar (UPDATE)
   - Si está aprobada/rechazada → solo lectura
```

### Reuso de lógica existente
- Hook `useLogistica.ts` ya trae hojas, paradas, cobros y devoluciones con filtros — se reusa.
- Toda la lógica de RLS / triggers (auto pasar a `carga_confirmada`, auto `despachado` al pasar pedido a entregado, impacto en cuenta corriente al rendir) **ya funciona en backend**; la nueva vista solo es UI nueva que llama a las mismas mutaciones que hoy hace `RegistrarCobroDialog`, `RegistrarDevolucionDialog`, `RendicionHojaRutaDialog`.
- Se extraen las funciones de mutación a hooks pequeños (`useEncargadoActions`) para no duplicar SQL.
- Sin tocar componentes ni rutas existentes de `/logistica`.

### Detalles técnicos

- Stack: React Router (agregar `<Route path="/encargado">` y `/encargado/:hojaId` en `App.tsx`), Tailwind, shadcn (Sheet, Tabs, Card, Button, Input).
- Mobile-first: containers `max-w-md mx-auto`, headers sticky con safe-area, touch targets ≥ 48px, tipografía base 16px.
- Estado: TanStack Query con `staleTime: 30s` e `invalidate` después de cada mutación. Pull-to-refresh con botón refrescar en header.
- Sin dependencias nuevas.
- Archivos nuevos esperados:
  - `src/pages/Encargado.tsx` (listado)
  - `src/pages/EncargadoHojaDetalle.tsx` (tabs según estado)
  - `src/components/encargado/CargaTab.tsx`
  - `src/components/encargado/ParadasTab.tsx`
  - `src/components/encargado/CobrarSheet.tsx` (versión simplificada mobile, sin cheque detallado)
  - `src/components/encargado/DevolucionSheet.tsx`
  - `src/components/encargado/RendicionTab.tsx`
  - `src/components/encargado/ResumenCobrosTab.tsx`
  - `src/hooks/useEncargadoHojas.ts`
  - `src/hooks/useEncargadoActions.ts`
- Registrar las rutas en `src/App.tsx`. La ruta queda fuera del `MainLayout` (sin sidebar) usando layout propio compacto.

### Fuera de alcance
- No cambio nada en `/logistica` ni en la UI admin.
- No agrego cheque/QR detallado en cobro mobile (queda transferencia con referencia simple); si más adelante se necesita cheque desde mobile, se suma como iteración.
- No incluyo mapas/ruteo GPS.
- No incluyo offline-first (requiere conexión).