

## Plan: Selector de Productos para Nota de Credito

### Resumen
Modificar el dialog "Registrar Movimiento" para que cuando se seleccione "Nota de Credito" muestre las compras del cliente con sus productos, permitiendo seleccionar cuales incluir y ajustar cantidades para calcular el total automaticamente.

---

### 1. Cambios en RegistrarPagoClienteDialog.tsx

#### Nuevos Estados
```typescript
const [comprasCliente, setComprasCliente] = useState<CompraCliente[]>([]);
const [compraSeleccionada, setCompraSeleccionada] = useState<string | null>(null);
const [productosVenta, setProductosVenta] = useState<ProductoVenta[]>([]);
const [productosNotaCredito, setProductosNotaCredito] = useState<ProductoNotaCredito[]>([]);
```

#### Nuevas Interfaces
```typescript
interface CompraCliente {
  id: string;
  venta_id: string;
  monto: number;
  fecha: string;
  numero_comprobante: number;
}

interface ProductoVenta {
  id: string;
  producto_id: string | null;
  descripcion: string;
  codigo: string;
  cantidad_original: number;
  precio_unitario: number;
  subtotal: number;
}

interface ProductoNotaCredito {
  detalle_id: string;
  cantidad_seleccionada: number;
  cantidad_max: number;
  precio_unitario: number;
  subtotal: number;
}
```

#### Flujo de UI para Nota de Credito

Cuando `tipo === 'nota_credito'`:

```
+-------------------------------------------+
| Tipo: [Nota de Credito v]                 |
+-------------------------------------------+
| Seleccionar compra a acreditar:           |
| [Venta #393 - 27/01/2026 - $18.889,20 v]  |
+-------------------------------------------+
|                                           |
| Productos de la compra:                   |
| +---------------------------------------+ |
| | [ ] | Producto         | Cant | Subt. | |
| | [x] | ACEITUNA NEGRAS  |  [1] | $18k  | |
| | [ ] | OTRO PRODUCTO    |  [0] | $0    | |
| +---------------------------------------+ |
|                                           |
| Total Nota de Credito: $18.889,20         |
+-------------------------------------------+
| [Cancelar]              [Registrar]       |
+-------------------------------------------+
```

#### Logica de Carga de Compras

Cuando se selecciona `tipo = 'nota_credito'`:
1. Buscar en `cliente_movimientos` todos los registros con `tipo = 'compra'` y `venta_id IS NOT NULL`
2. Obtener el `numero_comprobante` de la venta relacionada
3. Mostrar en selector las compras disponibles

```typescript
const fetchComprasCliente = async () => {
  const { data } = await supabase
    .from('cliente_movimientos')
    .select(`
      id,
      venta_id,
      monto,
      fecha,
      ventas!inner(numero_comprobante)
    `)
    .eq('cliente_id', clienteId)
    .eq('tipo', 'compra')
    .not('venta_id', 'is', null)
    .order('fecha', { ascending: false });
  
  setComprasCliente(data || []);
};
```

#### Logica de Carga de Productos

Cuando se selecciona una compra:
1. Obtener `venta_detalles` de la venta
2. Mapear productos con descripcion
3. Inicializar cantidades en 0 (usuario debe seleccionar)

```typescript
const fetchProductosVenta = async (ventaId: string) => {
  const { data } = await supabase
    .from('venta_detalles')
    .select(`
      id,
      producto_id,
      cantidad,
      precio_unitario,
      subtotal,
      producto_temporal_nombre,
      productos(descripcion, codigo_articulo)
    `)
    .eq('venta_id', ventaId);
  
  // Mapear a estructura con descripcion
  const productos = data?.map(d => ({
    id: d.id,
    producto_id: d.producto_id,
    descripcion: d.productos?.descripcion || d.producto_temporal_nombre || 'Producto',
    codigo: d.productos?.codigo_articulo || '',
    cantidad_original: d.cantidad,
    precio_unitario: d.precio_unitario,
    subtotal: d.subtotal,
  }));
  
  setProductosVenta(productos || []);
  
  // Inicializar nota de credito con cantidad 0
  setProductosNotaCredito(productos?.map(p => ({
    detalle_id: p.id,
    cantidad_seleccionada: 0,
    cantidad_max: p.cantidad_original,
    precio_unitario: p.precio_unitario,
    subtotal: 0,
  })) || []);
};
```

#### Calculo Dinamico del Total

```typescript
const totalNotaCredito = useMemo(() => {
  return productosNotaCredito.reduce((sum, p) => 
    sum + (p.cantidad_seleccionada * p.precio_unitario), 0);
}, [productosNotaCredito]);
```

#### Validaciones

1. Cantidad ingresada debe ser >= 0 y <= cantidad_original
2. Al menos un producto debe tener cantidad > 0
3. El total debe ser > 0

#### Modificar Submit

Para tipo `nota_credito`:
- Usar el `totalNotaCredito` calculado automaticamente
- Guardar referencia a la `venta_id` de la compra original
- Concepto automatico: "NC - Venta #XXX - [productos]"

---

### 2. Componentes UI Adicionales

Usar componentes existentes:
- `Checkbox` para seleccionar productos
- `Input` type="number" para cantidades
- `Table` para mostrar productos

---

### 3. Flujo Visual Completo

```
Usuario abre dialog
    |
    v
Selecciona "Nota de Credito"
    |
    v
Se carga lista de compras CC del cliente
    |
    v
Usuario selecciona una compra
    |
    v
Se cargan productos de esa venta
    |
    v
Usuario marca productos y ajusta cantidades
    |
    v
Total se calcula automaticamente
    |
    v
Usuario confirma -> Se guarda movimiento
```

---

### 4. Consideraciones Adicionales

1. **Cantidades decimales**: Soportar productos con cantidad fraccionada (ej: 0.5 kg)
2. **Productos temporales**: Mostrar nombre temporal si no tiene producto_id
3. **Compras sin productos**: Si la compra no tiene venta_detalles, mostrar mensaje

---

### 5. Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/clientes/RegistrarPagoClienteDialog.tsx` | Agregar logica condicional para nota de credito con selector de compras y productos |

---

### 6. Beneficios

1. Control preciso sobre que productos incluir en la nota de credito
2. Calculo automatico del monto basado en productos seleccionados
3. Trazabilidad completa: se sabe de que compra y que productos
4. Validacion de cantidades (no puede acreditar mas de lo comprado)
5. UX intuitiva con tabla de seleccion

