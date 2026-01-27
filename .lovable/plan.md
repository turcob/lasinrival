
## Plan: Sistema de Cuenta Corriente para Clientes en POS

### Resumen
Implementar un sistema de cuenta corriente para clientes, permitiendo elegir entre "Pago Directo" (comportamiento actual) y "Cuenta Corriente" (nuevo), siguiendo el mismo patrón ya implementado para empleados.

---

### 1. Cambios en Base de Datos

#### Nueva tabla: `cliente_movimientos`
```sql
CREATE TABLE cliente_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'compra', 'pago', 'ajuste', 'devolucion', 'nota_credito'
  monto NUMERIC NOT NULL,
  concepto TEXT,
  venta_id UUID REFERENCES ventas(id),
  usuario_registro_id UUID NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Nueva vista: `cliente_saldos`
```sql
CREATE VIEW cliente_saldos AS
SELECT 
  cliente_id,
  COALESCE(SUM(CASE WHEN tipo IN ('compra') THEN monto ELSE 0 END), 0) as total_deuda,
  COALESCE(SUM(CASE WHEN tipo IN ('pago', 'nota_credito', 'devolucion') THEN monto ELSE 0 END), 0) as total_pagado,
  COALESCE(SUM(CASE WHEN tipo = 'compra' THEN monto ELSE -monto END), 0) as saldo_actual
FROM cliente_movimientos
GROUP BY cliente_id;
```

#### Politicas RLS
- Usuarios autenticados pueden ver movimientos
- Usuarios con permiso `clientes.crear` pueden insertar/actualizar/eliminar

---

### 2. Cambios en POS (`src/pages/POS.tsx`)

#### Nuevos Estados
```typescript
const [clienteModalidadPago, setClienteModalidadPago] = useState<'pago_directo' | 'cuenta_corriente'>('pago_directo');
```

#### Modificar UI de Seleccion de Cliente
Cuando se selecciona un cliente, mostrar opciones con radio buttons:
```
+---------------------------------------+
| Cliente                   [Cambiar]   |
+---------------------------------------+
| ACME S.A.                             |
| CUIT: 30-12345678-9                   |
|                                       |
| (•) Pago Directo  ← default           |
|     El cliente paga ahora             |
|                                       |
| ( ) Cuenta Corriente                  |
|     Carga el total como deuda         |
+---------------------------------------+
```

**Nota**: Para clientes, el default sera "Pago Directo" (comportamiento actual), a diferencia de empleados donde es "Cuenta Corriente".

#### Modificar Logica del Boton Cobrar
```typescript
// Si hay cliente con CC seleccionada
if (selectedCliente && clienteModalidadPago === 'cuenta_corriente') {
  handleProcesarVentaClienteCC(); // Nueva funcion
} else {
  setPagos([]);
  setPagoDialogOpen(true);
}
```

#### Nueva Funcion: `handleProcesarVentaClienteCC()`
Similar a `handleProcesarVentaEmpleado()`:
- Registrar la venta con estado 'completada'
- Registrar movimiento en `cliente_movimientos` con tipo 'compra'
- Actualizar stock
- Registrar movimiento de caja con ingreso $0 (es fiado)
- Mostrar ticket

---

### 3. Flujo Visual

```
+------------------------+
|  Cliente Seleccionado  |
+------------------------+
           |
           v
+------------------------+
|  Elegir Modalidad:     |
|  ● Pago Directo        |
|  ○ Cuenta Corriente    |
+------------------------+
           |
     +-----+-----+
     |           |
     v           v
+------------+  +--------+
| Dialog     |  |  CC    |
| de Pagos   |  |  Carga |
| (normal)   |  |  deuda |
+------------+  +--------+
```

---

### 4. Gestion de Cuenta Corriente de Clientes

#### Nuevo Componente: `CuentaCorrienteClienteDialog.tsx`
Similar al de empleados, permite:
- Ver historial de movimientos del cliente
- Ver saldo actual (debe/tiene a favor)
- Registrar pagos manuales
- Ver ventas asociadas a CC

#### Agregar a Pagina de Clientes
- Nuevo boton "Ver CC" en acciones de cada cliente
- Mostrar columna de saldo en la tabla

---

### 5. Impresion del Ticket

Para ventas en Cuenta Corriente de cliente:
```
Cliente: ACME S.A.
CUIT: 30-12345678-9
(Cuenta Corriente)

Cond. Venta: Fiado
```

---

### 6. Archivos a Crear/Modificar

| Archivo | Accion |
|---------|--------|
| `src/pages/POS.tsx` | Agregar estado, UI y logica para CC de clientes |
| `src/pages/Clientes.tsx` | Agregar boton CC, mostrar saldo en tabla |
| `src/components/clientes/CuentaCorrienteClienteDialog.tsx` | **NUEVO** - Dialog para ver/gestionar CC |
| `src/components/clientes/RegistrarPagoClienteDialog.tsx` | **NUEVO** - Dialog para registrar pagos |

---

### 7. Consideraciones Adicionales

1. **Limite de credito (futuro)**: Se podria agregar un campo `limite_credito` a la tabla `clientes` para controlar cuanto se le puede fiar

2. **Notificaciones**: Alertar cuando un cliente supera cierto monto de deuda

3. **Reportes**: Generar listado de clientes deudores con antigueedad de saldo

---

### Resumen de Beneficios
1. Flexibilidad para vender fiado a clientes de confianza
2. Trazabilidad completa de deudas y pagos
3. Patron consistente con el sistema de empleados
4. UI intuitiva con radio buttons claros
5. Gestion centralizada de cuentas corrientes
