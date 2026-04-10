

## Plan: Edge Function temporal para obtener Service Role Key

### Qué se hará
Crear una edge function llamada `get-service-role` que devuelva el valor de `SUPABASE_SERVICE_ROLE_KEY` desde las variables de entorno del servidor.

### Seguridad
- La function será temporal — se eliminará después de que copies la key
- No requiere autenticación (verify_jwt = false) para acceso rápido
- **Importante**: eliminarla inmediatamente después de usarla

### Detalles técnicos
- Archivo: `supabase/functions/get-service-role/index.ts`
- Lee `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` y la devuelve en JSON
- Se agrega config en `supabase/config.toml` con `verify_jwt = false`
- Después de copiar la key, se elimina la function

