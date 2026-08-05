---
name: Precios por cantidad y coherencia caja/unidad
description: Tramos de precio por cantidad (lista_precio_escalas), equivalencia caja-unidad y alertas de incoherencia
type: feature
---
- Tramos por cantidad en `lista_precio_escalas` (lista opcional = todas las listas, `cantidad_desde >= 2`, `precio_unitario` o `porcentaje`, vigencia opcional). Un tramo aplicable tiene prioridad sobre excepción/marca/tipo/general.
- Sin tramos definidos el cálculo es idéntico al histórico (compatibilidad de producción garantizada).
- El POS recalcula el precio unitario en cada cambio de cantidad (agregar, +/-, edición directa, peso) y muestra badge del tramo.
- Equivalencia de empaque: `productos.empaque_de_producto_id` + `productos.unidades_por_empaque`. Comparación contra el tramo equivalente por unidad usando `configuracion_comercio.tolerancia_precio_empaque` (%).
- Las alertas de incoherencia (Productos, diálogo de tramos, pestaña "Coherencia Caja / Unidad" en Listas de Precios) son SOLO informativas: nunca bloquean venta ni guardado.
