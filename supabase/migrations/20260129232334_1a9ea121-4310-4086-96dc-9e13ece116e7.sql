-- Agregar permisos de facturación al rol vendedor
INSERT INTO role_permissions (role, modulo, permiso)
VALUES 
  ('vendedor', 'facturacion', 'ver'),
  ('vendedor', 'facturacion', 'crear')
ON CONFLICT DO NOTHING;