INSERT INTO public.roles (codigo, nombre, descripcion, color, es_sistema, activo, orden)
VALUES (
  'responsable',
  'Responsable',
  'Responsable de hoja de ruta - acceso a app móvil de reparto',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  false,
  true,
  7
)
ON CONFLICT (codigo) DO NOTHING;