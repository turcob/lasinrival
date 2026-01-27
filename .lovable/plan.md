

## Plan: Agregar Opción de Pago Directo para Empleados en POS

### Situacion Actual
Actualmente, cuando se activa "Venta a Empleado" en el POS, el sistema carga automaticamente el total de la venta a la cuenta corriente del empleado. No existe opcion para que el empleado pague en el momento como lo haria un cliente normal.

### Solucion Propuesta
Agregar un selector de modalidad de pago cuando se selecciona un empleado, permitiendo elegir entre:
- **Cuenta Corriente**: El comportamiento actual (carga el total como deuda)
- **Pago Directo**: Funciona igual que una venta a cliente, pasando por el dialogo de pagos normal

### Cambios a Implementar

#### 1. Nuevo Estado para Modalidad de Pago de Empleado
Agregar un estado que controle si el empleado paga ahora o va a cuenta corriente:
- `empleadoModalidadPago`: `'cuenta_corriente'` | `'pago_directo'`

#### 2. Modificar la UI de Seleccion de Empleado
Cuando se selecciona un empleado, mostrar dos opciones con radio buttons:
- **Cuenta Corriente** (opcion por defecto): Muestra el badge "CC" actual
- **Pago Directo**: Muestra un badge "Pago" y permite cobrar como cliente normal

#### 3. Modificar Logica del Boton de Cobrar
El boton principal cambiara segun la modalidad:
- Si es `cuenta_corriente`: Mantiene el texto "Cargar a CC $X" y ejecuta `handleProcesarVentaEmpleado()`
- Si es `pago_directo`: Muestra "Cobrar $X" y abre el dialogo de pagos normal

#### 4. Ajustar el Flujo de Venta con Pago Directo
Cuando un empleado paga directamente:
- Registrar la venta con `empleado_id` para trazabilidad
- Pasar por el dialogo de pagos normal (efectivo, tarjeta, etc.)
- Registrar los pagos en `venta_pagos`
- Registrar el ingreso en `movimientos_caja`
- **NO** crear movimiento de deuda en `empleado_movimientos`

#### 5. Ajustar Impresion del Ticket
El ticket mostrara:
- Para Cuenta Corriente: "Empleado: [Nombre] (Cuenta Corriente)"
- Para Pago Directo: "Empleado: [Nombre]" + forma de pago utilizada

---

### Detalles Tecnicos

**Archivo a modificar:** `src/pages/POS.tsx`

**Nuevo estado:**
```typescript
const [empleadoModalidadPago, setEmpleadoModalidadPago] = useState<'cuenta_corriente' | 'pago_directo'>('cuenta_corriente');
```

**Cambios en la UI (seccion de seleccion de empleado):**
```text
+---------------------------------------+
| Empleado                  [Cambiar]   |
+---------------------------------------+
| JUAN PEREZ                            |
| DNI: 12345678                         |
|                                       |
| ( ) Cuenta Corriente  ← seleccionar   |
|     Carga el total como deuda         |
|                                       |
| ( ) Pago Directo                      |
|     El empleado paga ahora            |
+---------------------------------------+
```

**Logica del boton principal:**
```typescript
onClick={() => {
  if (isVentaEmpleado) {
    if (!selectedEmpleado) {
      toast.error('Seleccione un empleado');
      return;
    }
    if (empleadoModalidadPago === 'cuenta_corriente') {
      handleProcesarVentaEmpleado();
    } else {
      // Pago directo: abrir dialogo de pagos normal
      setPagos([]);
      setPagoDialogOpen(true);
    }
  } else {
    setPagos([]);
    setPagoDialogOpen(true);
  }
}}
```

**Ajuste en handleProcesarVenta (linea ~1276):**
```typescript
// Solo registrar en CC si NO es empleado con pago directo
if (isVentaEmpleado && selectedEmpleado && empleadoModalidadPago === 'cuenta_corriente') {
  await supabase.from('empleado_movimientos').insert([...]);
}
// Si es pago directo, NO se crea movimiento de deuda
```

### Flujo Visual

```text
+------------------------+
|  Venta a Empleado: ON  |
+------------------------+
           |
           v
+------------------------+
|  Seleccionar Empleado  |
+------------------------+
           |
           v
+------------------------+
|  Elegir Modalidad:     |
|  ○ Cuenta Corriente    |
|  ○ Pago Directo        |
+------------------------+
           |
     +-----+-----+
     |           |
     v           v
+--------+  +------------+
|  CC    |  | Pago       |
|  Carga |  | Dialog     |
|  deuda |  | (efectivo, |
+--------+  | tarjeta)   |
            +------------+
```

### Resumen de Beneficios
1. Flexibilidad para empleados que prefieren pagar al momento
2. Mantiene la trazabilidad de ventas a empleados
3. No requiere cambios en la base de datos
4. Flujo intuitivo con radio buttons claros

