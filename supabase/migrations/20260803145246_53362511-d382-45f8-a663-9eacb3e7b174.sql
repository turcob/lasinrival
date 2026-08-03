-- 1) Backfill rol_codigo from the legacy enum column
UPDATE public.role_permissions
SET rol_codigo = role::text
WHERE rol_codigo IS NULL;

-- 2) Fix rows stored with a fallback enum value that does not match their real role code
UPDATE public.role_permissions
SET role = rol_codigo::public.app_role
WHERE rol_codigo IS NOT NULL
  AND rol_codigo <> role::text
  AND rol_codigo IN (SELECT unnest(enum_range(NULL::public.app_role))::text);

-- 3) has_permission must resolve permissions by role code, not only by the legacy enum
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _modulo text, _permiso app_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp
      ON COALESCE(rp.rol_codigo, rp.role::text) = ur.role::text
    WHERE ur.user_id = _user_id
      AND rp.modulo = _modulo
      AND rp.permiso = _permiso
  )
$$;