
## Plan: Corregir registro de compras en cuenta corriente de empleados

### Problema Detectado

Cuando un usuario con rol **vendedor** realiza una venta a un empleado seleccionando "Cuenta Corriente", el movimiento de deuda **no se registra** en la tabla `empleado_movimientos`.

**Causa raíz**: La política RLS de `empleado_movimientos` requiere el permiso `crear` en el módulo `empleados`, pero los vendedores no tienen este permiso. El insert falla silenciosamente.

**Evidencia**:
- Venta #414 (ALVAREZ ARIEL): Total $882.65 - Sin movimiento de CC registrado
- Venta #405 (ELIAS FERNANDA): Total $7,327.99 - Sin movimiento de CC registrado
- Venta #412 (ALVAREZ ARIEL): Total $3,261.37 - Movimiento registrado correctamente (procesado por usuario con permisos)

---

### Solución Propuesta

Agregar una nueva política RLS que permita a usuarios con permiso de crear ventas (`pos.crear`) también insertar movimientos de empleados cuando registran una venta.

---

### Cambios de Base de Datos

**Migración SQL**:

```sql
-- Política para permitir a vendedores registrar compras de empleados
CREATE POLICY "Users with pos permission can insert empleado_movimientos" 
ON public.empleado_movimientos 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_permission(auth.uid(), 'pos'::text, 'crear'::app_permission)
);
```

---

### Cambios de Código

**Archivo**: `src/pages/POS.tsx`

Agregar manejo de errores para la inserción de movimientos de empleado:

```typescript
// Línea ~1069: Agregar verificación de error
const { error: movimientoError } = await supabase.from('empleado_movimientos').insert([{
  empleado_id: selectedEmpleado.id,
  tipo: 'compra',
  monto: total,
  concepto: `Compra - Venta #${venta.numero_comprobante}`,
  venta_id: venta.id,
  usuario_registro_id: user.id,
}]);

if (movimientoError) {
  console.error('Error registrando movimiento:', movimientoError);
  toast.error('Error al registrar en cuenta corriente');
  throw movimientoError;
}
```

Aplicar el mismo cambio en la función `handleConfirmarVenta` (~línea 1484).

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Agregar política RLS para `empleado_movimientos` |
| `src/pages/POS.tsx` | Agregar manejo de errores en inserts de movimientos |

---

### Script de Corrección de Datos

Para corregir las ventas existentes sin movimiento registrado, se proporcionará un script SQL opcional:

```sql
-- Corregir ventas de empleados sin movimiento en CC
INSERT INTO empleado_movimientos (empleado_id, tipo, monto, concepto, venta_id, usuario_registro_id, fecha)
SELECT 
  v.empleado_id,
  'compra',
  v.total,
  'Compra - Venta #' || v.numero_comprobante || ' (corrección)',
  v.id,
  v.usuario_id,
  v.fecha::date
FROM ventas v
LEFT JOIN empleado_movimientos em ON em.venta_id = v.id
WHERE v.empleado_id IS NOT NULL 
  AND v.estado = 'confirmada'
  AND v.anulada = false
  AND em.id IS NULL;
```

---

### Resultado Esperado

Después de aplicar estos cambios:
1. Vendedores podrán registrar ventas a cuenta corriente de empleados correctamente
2. Los errores de inserción serán visibles al usuario (no fallarán silenciosamente)
3. Los datos históricos podrán ser corregidos con el script opcional
