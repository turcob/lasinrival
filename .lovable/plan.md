

# Plan: Campo "es_frio" en productos + Confirmacion masiva de pedidos

## Resumen

Dos cambios principales:

1. **Nuevo campo `es_frio`** en la tabla `productos` (boolean, default false) para marcar productos frios/frescos explicitamente en vez de inferirlo por categoria.

2. **Confirmacion masiva de pedidos** en la pestana Consolidado: separar pedidos en dos grupos segun si contienen productos pesables (KG) o no, y permitir confirmar (pasar a "preparado") masivamente los que NO tienen pesables.

---

## Parte 1: Campo `es_frio` en productos

### Migracion SQL

```sql
ALTER TABLE productos ADD COLUMN es_frio boolean NOT NULL DEFAULT false;

-- Marcar como frios los productos de categorias frias existentes
UPDATE productos p
SET es_frio = true
FROM categorias c
WHERE p.categoria_id = c.id
AND c.codigo_familia IN ('01', '02', '05', '09');
```

Esto agrega el campo y pre-carga los valores basandose en las categorias frias actuales (FIAMBRES, QUESOS, LACTEOS Y MANTECAS, VARIOS FRIO).

### Cambios en codigo

- **Tipos**: El archivo `types.ts` se regenera automaticamente al agregar la columna.
- **ExcelImporter** (`src/components/shared/ExcelImporter.tsx`): Agregar soporte para importar el campo `es_frio` si viene en el Excel (opcional).
- **Consolidado** (componente nuevo del plan anterior): Usar `producto.es_frio` en vez de inferir por categoria para clasificar productos frios vs no frios.
- **Pagina Productos** (`src/pages/Productos.tsx`): Si existe un formulario de edicion de productos, agregar un switch/checkbox "Es producto frio".

---

## Parte 2: Confirmacion masiva de pedidos sin pesables

### Logica de clasificacion

Un pedido "tiene pesables" si **al menos uno** de sus productos tiene `unidad_medida` en ('KG', 'KG.').

### Cambios en la pestana Consolidado

Dentro del componente `ConsolidadoPedidos.tsx` (del plan anterior), se agrega:

1. **Dos secciones de pedidos**:
   - "Pedidos sin pesables" -- listos para confirmar masivamente
   - "Pedidos con pesables" -- requieren preparacion individual (porque hay que pesar)

2. **Boton "Confirmar todos"** en la seccion de pedidos sin pesables:
   - Selecciona todos los pedidos sin pesables visibles
   - Checkboxes individuales para seleccionar/deseleccionar
   - Al confirmar, cambia el estado de `pendiente` a `preparado` para todos los seleccionados
   - Registra entrada en `pedido_historial` para cada uno

3. **Flujo visual**:

```text
+------------------------------------------+
| Filtros: [Vendedor] [Zona] [Estado]      |
+------------------------------------------+
|                                          |
| --- Pedidos SIN pesables (15) ---------- |
| [x] Seleccionar todos                   |
| [x] #000123 - MARTINEZ JOSE - $45,000   |
| [x] #000124 - LOPEZ ANA - $32,000       |
| [ ] #000125 - GARCIA PEDRO - $28,000    |
|                                          |
| [Confirmar seleccionados (2)]            |
|                                          |
| --- Pedidos CON pesables (8) ----------- |
| #000126 - RUIZ MARIA - $51,000 (3 KG)   |
| #000127 - DIAZ CARLOS - $67,000 (1 KG)  |
| (Estos requieren preparacion individual) |
+------------------------------------------+
```

### Hook: cambios en `usePedidos.ts`

Agregar una nueva mutacion `useConfirmarPedidosMasivo()`:

```typescript
// Recibe array de pedido IDs
// Para cada uno:
//   1. UPDATE pedidos SET estado = 'preparado' WHERE id = X
//   2. INSERT pedido_historial (estado_anterior: 'pendiente', estado_nuevo: 'preparado')
// Invalida queries de pedidos
```

### Consulta para separar pedidos

Para determinar si un pedido tiene pesables, la query del consolidado incluye los detalles con el producto y su `unidad_medida`:

```sql
SELECT p.id, p.numero_pedido, p.total, c.nombre,
  EXISTS (
    SELECT 1 FROM pedido_detalles pd
    JOIN productos pr ON pd.producto_id = pr.id
    WHERE pd.pedido_id = p.id
    AND UPPER(REPLACE(pr.unidad_medida, '.', '')) IN ('KG', 'KILO', 'KILOS')
  ) as tiene_pesables
FROM pedidos p
JOIN clientes c ON p.cliente_id = c.id
WHERE p.estado = 'pendiente'
```

En codigo, esto se hace en memoria despues de cargar los pedidos con sus detalles (ya que necesitamos los detalles para el consolidado de todas formas).

---

## Seccion tecnica - Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Agregar columna `es_frio` boolean default false + UPDATE masivo |
| `src/pages/Pedidos.tsx` | Envolver en Tabs: "Pedidos" (actual) + "Consolidado" (nuevo) |
| `src/components/pedidos/ConsolidadoPedidos.tsx` | **NUEVO** - Componente principal con filtros, clasificacion, consolidado y confirmacion masiva |
| `src/hooks/useConsolidadoPedidos.ts` | **NUEVO** - Hooks para vendedores, zonas, pedidos con detalles, confirmacion masiva, quitar producto |
| `src/hooks/usePedidos.ts` | Agregar `useConfirmarPedidosMasivo()` |

### Orden de implementacion

1. Migracion: agregar campo `es_frio`
2. Crear hook `useConsolidadoPedidos.ts`
3. Crear componente `ConsolidadoPedidos.tsx`
4. Modificar `Pedidos.tsx` para agregar el tab
5. Agregar mutacion de confirmacion masiva

