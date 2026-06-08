## Objetivo

En `src/pages/Ventas.tsx` agregar más filtros para poder ver, por ejemplo, "ventas de pedidos que entraron por la web" y no solo las de mostrador/mayorista.

## Cambios

### 1. Filtro "Usuario que cargó" visible a todos los roles
Hoy solo se muestra a admin. Se quita el `isAdmin &&` del selector y de la columna "Vendedor" de la tabla, para que cualquier usuario con acceso a Ventas pueda usarlo y ver quién cargó cada venta.

### 2. Nuevo filtro "Vendedor (del cliente)"
- Trae la lista desde `vendedores` (id, nombre).
- Cada venta se asocia al vendedor a través de `clientes.vendedor_id`.
- Se agrega `vendedor_id` al `select` de `clientes(...)` en `fetchVentas`.
- Selector con opciones: Todos / Sin vendedor / lista de vendedores.
- Visible a todos los roles.

### 3. Nuevo filtro "Origen"
Opciones: Todos / Mostrador / Web / Reparto.

Cómo se determina el origen de una venta:
- Se hace una consulta `pedidos` (id, venta_id, tipo_pedido) `where venta_id IS NOT NULL`, paginada con `.range()` siguiendo la regla de "Large Dataset Fetching" del proyecto.
- Se arma un `Map<venta_id, tipo_pedido>`.
- Venta con entrada en el map → origen = `tipo_pedido` (`'web'` o `'reparto'`).
- Venta sin entrada → origen = `'mostrador'`.

### 4. Aplicación de filtros y totales
- `ventasFiltradas` (useMemo) incorpora los 2 filtros nuevos además de los existentes (estado, fecha, usuario).
- La tarjeta "Resumen de Totales" hoy usa el RPC `get_ventas_totales_por_medio_pago`, que no conoce los filtros de vendedor/origen. Cuando alguno de los dos nuevos esté activo (distinto de "todos"), los totales y el desglose por medio de pago se calculan client-side a partir de `ventasFiltradas` + `pagosPorVenta` para que los números coincidan con la tabla. Si ambos están en "todos", se mantiene el RPC tal cual.

### 5. UI
Los tres selectores (Usuario, Vendedor, Origen) se renderizan en la fila de filtros existente, antes de Estado/Fecha. Se respetan los estilos actuales (Select de shadcn con ícono Lucide a la izquierda).

## Archivos tocados

- `src/pages/Ventas.tsx` (único archivo modificado).

## Fuera de alcance

- No se modifican RPCs ni el esquema de base de datos.
- No se cambian permisos: cualquier usuario que ya entra a la pantalla de Ventas verá los nuevos filtros.
- No se toca la pantalla de Pedidos ni la lógica de creación de ventas.
