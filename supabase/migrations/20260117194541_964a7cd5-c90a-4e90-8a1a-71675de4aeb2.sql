-- Create table to store admin tokens
CREATE TABLE public.admin_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL UNIQUE,
  token varchar(6) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expira_en timestamp with time zone NOT NULL,
  usado boolean NOT NULL DEFAULT false
);

-- Create unique index on token to ensure no duplicates
CREATE UNIQUE INDEX idx_admin_tokens_token ON public.admin_tokens(token) WHERE usado = false;

-- Enable RLS
ALTER TABLE public.admin_tokens ENABLE ROW LEVEL SECURITY;

-- Admins can view their own token
CREATE POLICY "Admins can view own token"
ON public.admin_tokens
FOR SELECT
USING (auth.uid() = admin_id AND has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage their own token
CREATE POLICY "Admins can manage own token"
ON public.admin_tokens
FOR ALL
USING (auth.uid() = admin_id AND has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage all tokens (for edge functions)
CREATE POLICY "Service role full access"
ON public.admin_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_tokens;