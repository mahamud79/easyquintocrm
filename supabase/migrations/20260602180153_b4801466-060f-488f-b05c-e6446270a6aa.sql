ALTER TABLE public.lead_cards
ADD COLUMN IF NOT EXISTS residence_city text,
ADD COLUMN IF NOT EXISTS province text;