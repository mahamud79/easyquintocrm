
-- Generic per-entity tables with JSONB payload, scoped per user.
-- Approach: keep schema stable as UI evolves; the full object is stored in `data`.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ CLIENTI ============
CREATE TABLE public.clienti (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clienti TO authenticated;
GRANT ALL ON public.clienti TO service_role;
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clienti owner" ON public.clienti FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_clienti_updated BEFORE UPDATE ON public.clienti
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ NOTE CLIENTE ============
CREATE TABLE public.note_cliente (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_note_cliente_user_cli ON public.note_cliente (user_id, cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_cliente TO authenticated;
GRANT ALL ON public.note_cliente TO service_role;
ALTER TABLE public.note_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "note_cliente owner" ON public.note_cliente FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_note_cliente_updated BEFORE UPDATE ON public.note_cliente
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ LEAD ============
CREATE TABLE public.lead (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead TO authenticated;
GRANT ALL ON public.lead TO service_role;
ALTER TABLE public.lead ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead owner" ON public.lead FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_lead_updated BEFORE UPDATE ON public.lead
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PRATICHE ============
CREATE TABLE public.pratiche (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pratiche TO authenticated;
GRANT ALL ON public.pratiche TO service_role;
ALTER TABLE public.pratiche ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pratiche owner" ON public.pratiche FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_pratiche_updated BEFORE UPDATE ON public.pratiche
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ BANCHE ============
CREATE TABLE public.banche (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banche TO authenticated;
GRANT ALL ON public.banche TO service_role;
ALTER TABLE public.banche ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banche owner" ON public.banche FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_banche_updated BEFORE UPDATE ON public.banche
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ AZIENDE ============
CREATE TABLE public.aziende (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aziende TO authenticated;
GRANT ALL ON public.aziende TO service_role;
ALTER TABLE public.aziende ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aziende owner" ON public.aziende FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_aziende_updated BEFORE UPDATE ON public.aziende
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COMPAGNIE ASSICURATIVE ============
CREATE TABLE public.compagnie_assicurative (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compagnie_assicurative TO authenticated;
GRANT ALL ON public.compagnie_assicurative TO service_role;
ALTER TABLE public.compagnie_assicurative ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compagnie owner" ON public.compagnie_assicurative FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_compagnie_updated BEFORE UPDATE ON public.compagnie_assicurative
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
