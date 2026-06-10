CREATE TABLE public.lead_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_key TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  surname TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  phone2 TEXT,
  email TEXT,
  company TEXT,
  source TEXT,
  stage TEXT,
  engagement TEXT,
  temperature TEXT,
  potential TEXT,
  birth_date DATE,
  fiscal_code TEXT,
  sex TEXT,
  citizenship TEXT,
  address TEXT,
  tipo_lavoro TEXT,
  azienda TEXT,
  partita_iva TEXT,
  data_assunzione DATE,
  stipendio_netto NUMERIC,
  reddito_aggiuntivo NUMERIC,
  tfr_azienda NUMERIC,
  tfr_fondo NUMERIC,
  crif TEXT,
  impegni_mensili NUMERIC,
  provenienza_lead TEXT,
  tipo_contatto TEXT,
  priorita TEXT,
  recall_date DATE,
  notes TEXT,
  tipologia_abitazione TEXT,
  familiari_carico TEXT,
  relazione TEXT,
  prodotti_interesse TEXT[] NOT NULL DEFAULT '{}',
  privacy_trattamento BOOLEAN NOT NULL DEFAULT false,
  privacy_marketing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, lead_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_cards TO authenticated;
GRANT ALL ON public.lead_cards TO service_role;

ALTER TABLE public.lead_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own lead cards select"
ON public.lead_cards
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "own lead cards insert"
ON public.lead_cards
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own lead cards update"
ON public.lead_cards
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own lead cards delete"
ON public.lead_cards
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_lead_cards_updated_at
BEFORE UPDATE ON public.lead_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();