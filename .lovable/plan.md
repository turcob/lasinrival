

## Plan: Sync automático de listas de precios a Paladini-Pedidos

### Contexto
- **Este proyecto (La Sin Rival)** tiene listas de precios con sistema matricial (porcentajes por marca, tipo, excepciones).
- **Paladini-Pedidos** tiene su propia tabla `price_lists` con campos simples: `name` y `surcharge_percentage`.
- Paladini ya se conecta a Sin Rival via edge function (`sync-order-sinrival`) usando secrets `SINRIVAL_SUPABASE_URL` y `SINRIVAL_SERVICE_ROLE_KEY`.
- La sincronización será **de Sin Rival hacia Paladini**, ya que acá es donde se gestionan las listas.

### Cambios

**1. Migración de base de datos** (tabla `listas_precios`)
- Agregar columna `destino` (`text`, default `'sin_rival'`). Valores: `'sin_rival'`, `'paladini'`, `'ambos'`.

**2. Crear edge function `sync-lista-precios-paladini`**
- Recibe `lista_id`, `action` (`upsert` o `delete`)
- Se conecta a la base de Paladini usando secrets `PALADINI_SUPABASE_URL` y `PALADINI_SERVICE_ROLE_KEY` (se necesitarán configurar)
- Para `upsert`: busca en `price_lists` de Paladini por nombre, hace insert o update con `name` y `surcharge_percentage` (usando el porcentaje general de la lista)
- Para `delete`: elimina la lista correspondiente en Paladini

**3. Configurar secrets necesarios**
- `PALADINI_SUPABASE_URL` — URL del proyecto Paladini-Pedidos
- `PALADINI_SERVICE_ROLE_KEY` — Service Role Key del proyecto Paladini-Pedidos

**4. Modificar `src/pages/ListasPrecios.tsx`**
- Agregar campo `Select` con destino (La Sin Rival / Paladini Pedidos / Ambos) en el formulario de crear/editar
- Incluir `destino` en el state, `dataToSave`, y `openEditListaDialog`
- Mostrar badge con destino en la lista de listas de precios
- Después de guardar, si destino es `'paladini'` o `'ambos'`, invocar la edge function `sync-lista-precios-paladini` para sincronizar automáticamente
- Al eliminar una lista, si tenía destino paladini/ambos, invocar el delete en la edge function

### Mapeo de datos
La tabla `price_lists` de Paladini solo tiene `name` y `surcharge_percentage`. Se mapeará:
- `name` ← `nombre` de la lista en Sin Rival
- `surcharge_percentage` ← porcentaje **general** (`es_general = true`) de la matriz de esa lista

### Detalle técnico
- La edge function usa `createClient` de Supabase con la service role key de Paladini para hacer CRUD directo en su tabla `price_lists`
- Se necesitan 2 secrets nuevos del proyecto Paladini (URL y service role key)

