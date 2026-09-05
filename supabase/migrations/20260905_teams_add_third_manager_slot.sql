-- Migration: teams_add_third_manager_slot
-- Applicata: 2026-09-05 via Supabase MCP
--
-- Scopo:
--   Aggiungere un terzo slot dirigenziale a teams (dopo team_manager_id e second_manager_id)
--   e includerlo nei ruoli operativi di my_team_ids() così che il terzo dirigente
--   abbia gli stessi permessi RLS degli altri due sui player/trainings/matches/attendances.
--
-- Motivazione:
--   Primi Calci 2018 ha 3 dirigenti attivi (Lella Pirillo, Alessandro Schito,
--   Umberto Vecchione) ma il modello supportava max 2. Il terzo slot è opzionale,
--   utilizzabile solo dove serve.
--
-- Impatto client:
--   - useTeamStaff.ts estesa a 8 ruoli (aggiunto 'third_manager' con order 6,
--     shift di linesman/masseur a 7/8)
--   - TeamEditSheet.tsx: nuovo select "Terzo dirigente accompagnatore"
--   - ConvocationSheet.tsx: join FK + push in staffList con label
--     "Terzo Dirigente Accompagnatore"
--   - distintaFigc.ts non modificato (itera dinamicamente su data.staff)

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS third_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.teams.third_manager_id IS
  'Terzo dirigente accompagnatore (opzionale). Ha stesse permission operative di team_manager_id e second_manager_id via my_team_ids().';

CREATE INDEX IF NOT EXISTS idx_teams_third_manager
  ON public.teams(third_manager_id) WHERE third_manager_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.my_team_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id FROM public.teams
  WHERE head_coach_id      = auth.uid()
     OR assistant_coach_id = auth.uid()
     OR helper_coach_id    = auth.uid()
     OR team_manager_id    = auth.uid()
     OR second_manager_id  = auth.uid()
     OR third_manager_id   = auth.uid();
$function$;
