
-- Ateliers
CREATE TABLE public.workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshops TO anon, authenticated;
GRANT ALL ON public.workshops TO service_role;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.workshops FOR ALL USING (true) WITH CHECK (true);

-- Zones
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO anon, authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.zones FOR ALL USING (true) WITH CHECK (true);

-- Machines
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO anon, authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.machines FOR ALL USING (true) WITH CHECK (true);

-- Critères 5S
CREATE TABLE public.criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL DEFAULT 1,
  order_index INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.criteria TO anon, authenticated;
GRANT ALL ON public.criteria TO service_role;
ALTER TABLE public.criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.criteria FOR ALL USING (true) WITH CHECK (true);

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criteria_id UUID NOT NULL REFERENCES public.criteria(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.questions FOR ALL USING (true) WITH CHECK (true);

-- Audits
CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  auditor TEXT NOT NULL,
  global_score NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO anon, authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.audits FOR ALL USING (true) WITH CHECK (true);

-- Audit-Machines
CREATE TABLE public.audit_machines (
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  PRIMARY KEY (audit_id, machine_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_machines TO anon, authenticated;
GRANT ALL ON public.audit_machines TO service_role;
ALTER TABLE public.audit_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.audit_machines FOR ALL USING (true) WITH CHECK (true);

-- Réponses
CREATE TABLE public.audit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES public.criteria(id) ON DELETE CASCADE,
  score INT CHECK (score >= 0 AND score <= 5),
  comment TEXT,
  photo_url TEXT,
  gap TEXT,
  suggested_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(audit_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_responses TO anon, authenticated;
GRANT ALL ON public.audit_responses TO service_role;
ALTER TABLE public.audit_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.audit_responses FOR ALL USING (true) WITH CHECK (true);

-- Actions correctives
CREATE TABLE public.corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES public.criteria(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  responsible TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrective_actions TO anon, authenticated;
GRANT ALL ON public.corrective_actions TO service_role;
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.corrective_actions FOR ALL USING (true) WITH CHECK (true);

-- Seed critères 5S
INSERT INTO public.criteria (code, name, description, weight, order_index) VALUES
  ('seiri',    'Seiri - Trier',         'Éliminer l''inutile',              1, 1),
  ('seiton',   'Seiton - Ranger',       'Une place pour chaque chose',      1, 2),
  ('seiso',    'Seiso - Nettoyer',      'Maintenir la propreté',            1, 3),
  ('seiketsu', 'Seiketsu - Standardiser','Établir des standards visuels',   1, 4),
  ('shitsuke', 'Shitsuke - Maintenir',  'Respecter et faire respecter',     1, 5);

-- Seed questions (3 par critère)
INSERT INTO public.questions (criteria_id, text, order_index)
SELECT c.id, q.text, q.idx FROM public.criteria c
CROSS JOIN LATERAL (VALUES
  (CASE c.code
    WHEN 'seiri'    THEN 'Les objets inutiles sont-ils éliminés du poste ?'
    WHEN 'seiton'   THEN 'Chaque outil a-t-il un emplacement défini et identifié ?'
    WHEN 'seiso'    THEN 'Le poste et les équipements sont-ils propres ?'
    WHEN 'seiketsu' THEN 'Des standards visuels sont-ils affichés et respectés ?'
    WHEN 'shitsuke' THEN 'Les règles 5S sont-elles connues et appliquées ?'
   END, 1),
  (CASE c.code
    WHEN 'seiri'    THEN 'Les stocks sont-ils au niveau juste nécessaire ?'
    WHEN 'seiton'   THEN 'Les zones de circulation sont-elles dégagées et marquées ?'
    WHEN 'seiso'    THEN 'Les sources de salissure sont-elles identifiées et traitées ?'
    WHEN 'seiketsu' THEN 'Les procédures de nettoyage/rangement sont-elles documentées ?'
    WHEN 'shitsuke' THEN 'Les audits précédents ont-ils été suivis d''actions ?'
   END, 2),
  (CASE c.code
    WHEN 'seiri'    THEN 'Les documents obsolètes sont-ils retirés ?'
    WHEN 'seiton'   THEN 'Les identifications (étiquettes, marquages) sont-elles à jour ?'
    WHEN 'seiso'    THEN 'Le matériel de nettoyage est-il disponible et rangé ?'
    WHEN 'seiketsu' THEN 'Les indicateurs visuels de performance sont-ils à jour ?'
    WHEN 'shitsuke' THEN 'Les équipes participent-elles activement à l''amélioration ?'
   END, 3)
) AS q(text, idx);
