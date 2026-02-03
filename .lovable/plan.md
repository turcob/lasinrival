
# Plan: Simplificación de Estados de Pedidos

## Resumen

Se modificara el sistema de pedidos para simplificar los estados y restringir las transiciones, alineándolo con el flujo real del negocio donde los vendedores crean pedidos, se preparan internamente, y solo pasan a "despachado" cuando logística los asigna a una hoja de ruta.

## Cambios a Realizar

### 1. Modificación del Enum de Estados en Base de Datos

Actualizar el tipo `pedido_estado` para tener solo 4 estados:

```sql
-- Eliminar valores no usados del enum
ALTER TYPE pedido_estado RENAME VALUE 'confirmado' TO 'preparado_old';
ALTER TYPE pedido_estado RENAME VALUE 'entregado' TO 'entregado_old';
ALTER TYPE pedido_estado RENAME VALUE 'parcial' TO 'parcial_old';
ALTER TYPE pedido_estado RENAME VALUE 'devuelto' TO 'devuelto_old';
ALTER TYPE pedido_estado RENAME VALUE 'anulado' TO 'rechazado';
```

**Nota:** Por limitaciones de PostgreSQL, en lugar de modificar el enum existente, crearemos una migración que:
- Marque pedidos antiguos con estados obsoletos
- Actualice la lógica para solo usar: `pendiente`, `preparado`, `despachado`, `rechazado`

### 2. Actualización de Tipos TypeScript

**Archivo:** `src/hooks/usePedidos.ts`

```typescript
// ANTES
export type PedidoEstado = 
  | 'pendiente' 
  | 'confirmado' 
  | 'preparado' 
  | 'despachado' 
  | 'entregado' 
  | 'parcial' 
  | 'devuelto' 
  | 'anulado';

// DESPUÉS
export type PedidoEstado = 
  | 'pendiente' 
  | 'preparado' 
  | 'despachado' 
  | 'rechazado';
```

### 3. Actualización del Flujo de Estados en UI

**Archivo:** `src/components/pedidos/DetallePedidoDialog.tsx`

```typescript
// ANTES
const flujoEstados: Record<PedidoEstado, PedidoEstado[]> = {
  pendiente: ['confirmado', 'anulado'],
  confirmado: ['preparado', 'anulado'],
  preparado: ['despachado', 'anulado'],
  despachado: ['entregado', 'parcial', 'devuelto'],
  ...
};

// DESPUÉS
const flujoEstados: Record<PedidoEstado, PedidoEstado[]> = {
  pendiente: ['preparado', 'rechazado'],
  preparado: ['rechazado'],  // Sin opción de despachado manual
  despachado: [],            // Solo logística gestiona
  rechazado: [],
};
```

### 4. Actualización de Configuración Visual de Estados

**Archivos:** `src/pages/Pedidos.tsx` y `src/components/pedidos/DetallePedidoDialog.tsx`

```typescript
const estadoConfig = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  preparado: { label: 'Preparado', color: 'bg-blue-100 text-blue-800', icon: Package },
  despachado: { label: 'Despachado', color: 'bg-green-100 text-green-800', icon: Truck },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle },
};
```

### 5. Automatización del Estado "Despachado"

**Archivo:** `src/hooks/useLogistica.ts`

Modificar `useCrearHojaRuta` y `useAgregarParada` para que al asignar un pedido a una hoja de ruta, automáticamente cambie su estado a `despachado`:

```typescript
// En useCrearHojaRuta, después de insertar las paradas:
if (data.pedido_ids && data.pedido_ids.length > 0) {
  // Insertar paradas...
  
  // Cambiar estado de pedidos a despachado
  await supabase
    .from('pedidos')
    .update({ estado: 'despachado' })
    .in('id', data.pedido_ids);
    
  // Registrar en historial
  for (const pedidoId of data.pedido_ids) {
    await supabase.from('pedido_historial').insert({
      pedido_id: pedidoId,
      estado_anterior: 'preparado',
      estado_nuevo: 'despachado',
      usuario_id: user.id,
      observaciones: `Asignado a hoja de ruta #${hojaRuta.numero_hoja}`
    });
  }
}
```

### 6. Actualización de Pedidos Disponibles para Ruta

**Archivo:** `src/hooks/useLogistica.ts`

Modificar `usePedidosDisponiblesParaRuta` para que solo muestre pedidos en estado `preparado`:

```typescript
// ANTES
.in('estado', ['confirmado', 'preparado', 'despachado'])

// DESPUÉS  
.eq('estado', 'preparado')
```

### 7. Eliminación de Funcionalidad de Rendición desde Pedidos

**Archivo:** `src/components/pedidos/DetallePedidoDialog.tsx`

Remover el botón "Rendir Pedido" y el componente `RendirPedidoDialog` de la vista de detalle de pedidos, ya que esta gestión se realiza exclusivamente desde Logística.

### 8. Actualización del Diálogo de Cambio de Estado

**Archivo:** `src/components/pedidos/CambiarEstadoDialog.tsx`

Adaptar los labels para usar "Rechazado" en lugar de "Anulado":

```typescript
const estadoLabels: Record<PedidoEstado, string> = {
  pendiente: 'Pendiente',
  preparado: 'Preparado',
  despachado: 'Despachado',
  rechazado: 'Rechazado',
};
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/hooks/usePedidos.ts` | Actualizar tipo `PedidoEstado`, eliminar función `useRendirPedido` |
| `src/pages/Pedidos.tsx` | Actualizar `estadoConfig` con 4 estados |
| `src/components/pedidos/DetallePedidoDialog.tsx` | Actualizar flujo de estados, eliminar botón rendir |
| `src/components/pedidos/CambiarEstadoDialog.tsx` | Actualizar labels de estados |
| `src/hooks/useLogistica.ts` | Automatizar cambio a despachado, filtrar solo preparados |
| `src/components/logistica/NuevaHojaRutaDialog.tsx` | Sin cambios (usa hook actualizado) |

## Migración de Datos Existentes

Se creara una migración SQL para:
1. Convertir pedidos con estado `confirmado` a `preparado`
2. Convertir pedidos con estado `anulado` a `rechazado`
3. Mantener `entregado`, `parcial`, `devuelto` como estados legacy solo visibles (para historial)

```sql
-- Migrar estados existentes
UPDATE pedidos SET estado = 'preparado' WHERE estado = 'confirmado';
UPDATE pedidos SET estado = 'rechazado' WHERE estado = 'anulado';
```

## Flujo Final

```text
+------------+     +-----------+     +------------+
| Pendiente  | --> | Preparado | --> | Despachado |
+------------+     +-----------+     +------------+
      |                  |                 |
      v                  v                 v
+------------+     (automático        (Gestionado
| Rechazado  |      desde             en Logística)
+------------+      Logística)
```

## Detalles Tecnicos

- El cambio de `pendiente` a `preparado` se realiza manualmente desde el modulo de Pedidos
- El cambio de `pendiente` o `preparado` a `rechazado` se realiza manualmente desde Pedidos
- El cambio a `despachado` SOLO ocurre automaticamente al asignar el pedido a una hoja de ruta
- Las devoluciones, cobranzas y rendicion se gestionan exclusivamente desde el modulo de Logistica
