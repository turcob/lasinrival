## Paso a — Columna `categoria` en `formas_pago`

Migración DB única, sin tocar RPCs ni front. Backfill determinístico en la misma migración.

### SQL propuesto

```sql
-- 1) Columna con default seguro (sin lock largo, sin rewrite masivo)
ALTER TABLE public.formas_pago
  ADD COLUMN categoria text NOT NULL DEFAULT 'otro';

-- 2) CHECK del dominio permitido
ALTER TABLE public.formas_pago
  ADD CONSTRAINT formas_pago_categoria_check
  CHECK (categoria IN ('efectivo','debito','credito','transferencia','cheque','otro'));

-- 3) Backfill único, determinístico. Regex sobre lower(nombre).
--    (unaccent no está instalado; los nombres actuales usan tilde real,
--     así que cubrimos 'e' y 'é' con clase de caracteres.)
UPDATE public.formas_pago
SET categoria = CASE
  WHEN lower(nombre) ~ 'efectivo'          THEN 'efectivo'
  WHEN lower(nombre) ~ 'transferencia'     THEN 'transferencia'
  WHEN lower(nombre) ~ 'cheque'            THEN 'cheque'
  WHEN lower(nombre) ~ 'd[eé]bito'         THEN 'debito'
  WHEN lower(nombre) ~ 'cr[eé]dito'        THEN 'credito'
  ELSE 'otro'
END;
```

### Mapeo resultante (6 filas actuales)

| nombre | categoria |
|---|---|
| Efectivo | `efectivo` |
| Débito | `debito` |
| Crédito | `credito` |
| Transferencia | `transferencia` |
| Cheque | `cheque` |
| QR | `otro` |

Clover / MP / etc. no existen todavía como filas — quedarán `otro` por default cuando se den de alta y luego se reclasifican manualmente.

### GRANTs / RLS

`formas_pago` ya tiene `arwdDxtm` para `anon`, `authenticated` y `service_role` (verificado con `pg_class.relacl`). Es catálogo de lectura. **No se agregan policies ni grants nuevos** en este paso.

### Superficie de deploy

- **Solo migración DB.** Sin cambios de RPC, edge functions, ni front.
- **Sin ventana off-hours.** `ADD COLUMN ... DEFAULT 'otro'` en PG ≥11 es metadata-only; el `UPDATE` afecta 6 filas.
- **Reversible** con `ALTER TABLE ... DROP COLUMN categoria` si hace falta.

Confirmá el mapeo y aplico.
