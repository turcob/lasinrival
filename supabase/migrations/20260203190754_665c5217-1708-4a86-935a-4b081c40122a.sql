-- Add user_id column to empleados table to link with auth users
ALTER TABLE public.empleados 
ADD COLUMN user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_empleados_user_id ON public.empleados(user_id);

-- Comment for documentation
COMMENT ON COLUMN public.empleados.user_id IS 'Links employee to their auth user account for role-based access';