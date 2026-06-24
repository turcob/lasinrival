INSERT INTO public.role_permissions (role, modulo, permiso) VALUES
  ('vendedor', 'transferencias', 'crear'),
  ('vendedor', 'transferencias', 'ver')
ON CONFLICT DO NOTHING;