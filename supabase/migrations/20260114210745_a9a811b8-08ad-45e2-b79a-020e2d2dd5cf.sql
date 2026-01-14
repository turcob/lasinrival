-- Table to cache AFIP authentication tokens
CREATE TABLE public.afip_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service VARCHAR(50) NOT NULL,
  token TEXT NOT NULL,
  sign TEXT NOT NULL,
  expiration TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only keep one token per service
CREATE UNIQUE INDEX idx_afip_tokens_service ON public.afip_tokens(service);

-- Enable RLS
ALTER TABLE public.afip_tokens ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write tokens
CREATE POLICY "Authenticated can manage tokens"
ON public.afip_tokens FOR ALL
USING (true)
WITH CHECK (true);