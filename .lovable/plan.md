## Reestructurar flujo de parada en `/encargado`

### Objetivo
Simplificar las acciones de una parada a **2 botones** y unificar el rechazo de mercadería dentro del flujo de cobro.

### Cambios en `src/components/encargado/ParadaSheet.tsx`

**1. Reemplazar los 3 botones por 2:**
- **"Cobrar y entregar"** (verde) — abre un selector de tipo de entrega.
- **"Rechazado"** (anteriormente "No se pudo entregar") — mantiene el flujo actual de marcar como `no_entregado` con motivo. Solo cambia el label y el ícono a algo más asociado a rechazo (ej. `XCircle`).

**2. Nuevo paso intermedio al tocar "Cobrar y entregar":**
Mostrar un Sheet con dos opciones:
- **"Entrega completa"** → va directo al `CobrarSheet` con el total del pedido.
- **"Entrega parcial"** → abre primero el `DevolucionSheet` (selección de productos que el cliente no acepta y cantidad). Al guardar la devolución, automáticamente continúa al `CobrarSheet` con el total recalculado (total original − monto rechazado).

**3. Encadenado parcial → cobro:**
- Cuando el usuario confirma la devolución en flujo "parcial", en lugar de cerrar todo, abrir `CobrarSheet`.
- Implementar con un estado `flujoEntrega: 'idle' | 'eligiendo' | 'parcial-devolucion' | 'parcial-cobro' | 'total-cobro'` en `ParadaSheet`.
- `DevolucionSheet` ya soporta `onSuccess` callback — se usa para avanzar al cobro cuando `flujoEntrega === 'parcial-devolucion'`.

**4. Mantener compatibilidad:**
- El botón "Rechazó mercadería" independiente se elimina (queda integrado en "parcial").
- El cálculo de `totalPedido` (con monto rechazado descontado) ya existe y se reutiliza tal cual.
- El estado de la parada sigue siendo `pendiente` hasta que el cobro/entrega se confirme (como ya quedó arreglado en iteraciones previas).

### Detalle UX del selector parcial/total
Sheet inferior con título "¿Cómo es la entrega?" y dos botones grandes:
- "Entrega completa — el cliente acepta todo"
- "Entrega parcial — el cliente rechaza algunos productos"

### Archivos a modificar
- `src/components/encargado/ParadaSheet.tsx` (único archivo)

No se tocan `DevolucionSheet`, `CobrarSheet`, ni hooks. No hay cambios de schema.
