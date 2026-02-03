
# Plan: Limpieza de Tablas Duplicadas

## Resumen del Problema

Existen tablas duplicadas en la base de datos que generan confusión:

| Tabla Actual | Registros | Estado | Acción |
|--------------|-----------|--------|--------|
| `hojas_ruta` | 2 | En uso activo | Mantener |
| `hoja_ruta` | 0 | Obsoleta | Eliminar |
| `usuarios` | 0 | Obsoleta | Eliminar |

## Dependencias a Actualizar

Las siguientes funciones de base de datos usan las tablas obsoletas y deben ser actualizadas:

1. **`get_usuario_id()`** - Busca en tabla `usuarios` (obsoleta)
2. **`is_route_owner()`** - Une `hoja_ruta` con `usuarios`
3. **`is_stop_owner()`** - Une `hoja_ruta_paradas` con `hoja_ruta` y `usuarios`

## Plan de Migración

### Paso 1: Actualizar Funciones de Seguridad

Modificar las funciones para usar las tablas correctas:

- `get_usuario_id()` → Usar `empleados.user_id` (ya vinculado al auth user)
- `is_route_owner()` → Usar `hojas_ruta.chofer_id` → `empleados.user_id`
- `is_stop_owner()` → Ajustar para la nueva estructura

### Paso 2: Eliminar Tabla `hoja_ruta`

```sql
DROP TABLE IF EXISTS public.hoja_ruta CASCADE;
```

### Paso 3: Eliminar Tabla `usuarios`

```sql
DROP TABLE IF EXISTS public.usuarios CASCADE;
```

### Paso 4: Actualizar Políticas RLS

Las políticas que usan estas funciones se actualizarán automáticamente cuando reemplacemos las funciones.

## Sección Técnica

### Nueva Implementación de Funciones

```sql
-- Obtener empleado_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_empleado_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT id FROM public.empleados 
    WHERE user_id = auth.uid() 
    LIMIT 1
  );
END;
$$;

-- Verificar si el usuario es dueño de la ruta (es el chofer asignado)
CREATE OR REPLACE FUNCTION public.is_route_owner(route_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    JOIN public.empleados e ON hr.chofer_id = e.id
    WHERE hr.id = route_id 
    AND e.user_id = auth.uid()
  );
END;
$$;

-- Verificar si el usuario es dueño de la parada
CREATE OR REPLACE FUNCTION public.is_stop_owner(stop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hoja_ruta_paradas p
    JOIN public.hojas_ruta hr ON p.hoja_ruta_id = hr.id
    JOIN public.empleados e ON hr.chofer_id = e.id
    WHERE p.id = stop_id 
    AND e.user_id = auth.uid()
  );
END;
$$;
```

### Actualización de Políticas RLS

Las tablas afectadas con políticas que usan estas funciones:
- `hoja_ruta` (se eliminará)
- `hoja_ruta_paradas` 
- `cobros`
- `devoluciones`
- `rendiciones`

Estas políticas usarán las nuevas funciones que apuntan a `hojas_ruta` y `empleados`.

## Beneficios

1. Estructura de datos limpia sin duplicaciones
2. Relación clara: `Usuario Auth` → `Empleado` → `Chofer en Hoja de Ruta`
3. Políticas RLS funcionando correctamente para la app del chofer
4. Sincronización con la app externa que ya ajustaste

## Verificación Post-Migración

- Confirmar que las hojas de ruta existentes (2) siguen funcionando
- Verificar que los cobros y paradas mantienen sus relaciones
- Probar acceso del chofer a sus rutas asignadas
