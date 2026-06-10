
-- ============ LIQUIDATO ============
CREATE TABLE public.liquidato (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liquidato TO authenticated;
GRANT ALL ON public.liquidato TO service_role;
ALTER TABLE public.liquidato ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liquidato owner" ON public.liquidato FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_liquidato_updated BEFORE UPDATE ON public.liquidato
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RINNOVI ============
CREATE TABLE public.rinnovi (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rinnovi TO authenticated;
GRANT ALL ON public.rinnovi TO service_role;
ALTER TABLE public.rinnovi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rinnovi owner" ON public.rinnovi FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_rinnovi_updated BEFORE UPDATE ON public.rinnovi
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PREVENTIVI ============
CREATE TABLE public.preventivi (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preventivi TO authenticated;
GRANT ALL ON public.preventivi TO service_role;
ALTER TABLE public.preventivi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preventivi owner" ON public.preventivi FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_preventivi_updated BEFORE UPDATE ON public.preventivi
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CALENDARI EVENTS ============
CREATE TABLE public.calendari_eventi (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendari_eventi TO authenticated;
GRANT ALL ON public.calendari_eventi TO service_role;
ALTER TABLE public.calendari_eventi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendari_eventi owner" ON public.calendari_eventi FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_calendari_eventi_updated BEFORE UPDATE ON public.calendari_eventi
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CONVERSAZIONI ============
CREATE TABLE public.conversazioni (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversazioni TO authenticated;
GRANT ALL ON public.conversazioni TO service_role;
ALTER TABLE public.conversazioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversazioni owner" ON public.conversazioni FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_conversazioni_updated BEFORE UPDATE ON public.conversazioni
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ IMPOSTAZIONI (option lists) ============
CREATE TABLE public.impostazioni (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.impostazioni TO authenticated;
GRANT ALL ON public.impostazioni TO service_role;
ALTER TABLE public.impostazioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impostazioni owner" ON public.impostazioni FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_impostazioni_updated BEFORE UPDATE ON public.impostazioni
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
