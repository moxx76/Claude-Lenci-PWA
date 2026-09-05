-- Migration: add_home_field_address_to_clubs_and_backfill
-- Applicata: 2026-09-04 via Supabase MCP
--
-- Scopo:
--   Aggiungere home_field_name e home_field_address alla tabella clubs
--   così che l'indirizzo del campo di casa sia configurato una volta e riusato
--   automaticamente per tutte le locandine di convocazione.
--
-- Effetti:
--   1. Nuove colonne clubs.home_field_name e clubs.home_field_address
--   2. Popolate per ASD Lenci Poirino con "Campo Sportivo Poirino" /
--      "Via Fonte Antico 16, 10046 Poirino (TO)"
--   3. Backfill di TUTTE le partite venue='home' con location_address = valore club
--      (dove NULL, senza sovrascrivere valori già inseriti manualmente)
--   4. Trigger sync_lnd_gara_to_match aggiornato: le partite future importate dal
--      calendario LND ottengono automaticamente location_address per il venue='home'.
--      Su UPDATE conflict, rispetta override manuali via COALESCE.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS home_field_name    text,
  ADD COLUMN IF NOT EXISTS home_field_address text;

UPDATE public.clubs
SET
  home_field_name    = 'Campo Sportivo Poirino',
  home_field_address = 'Via Fonte Antico 16, 10046 Poirino (TO)'
WHERE id = '9cb45011-8014-45f1-a045-f2253d422926';

UPDATE public.matches m
SET location_address = c.home_field_address
FROM public.clubs c
WHERE m.venue = 'home'
  AND m.location_address IS NULL
  AND c.id = '9cb45011-8014-45f1-a045-f2253d422926';

CREATE OR REPLACE FUNCTION public.sync_lnd_gara_to_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_team_id uuid;
  v_dt timestamptz;
  v_competition text;
  v_home_addr text;
BEGIN
  v_team_id := lnd_gara_map_team(NEW.competizione, NEW.fonte);
  IF v_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_dt := (NEW.data::text || ' ' || COALESCE(NEW.ora::text, '15:00:00'))::timestamp AT TIME ZONE 'Europe/Rome';

  v_competition := NEW.competizione;
  IF NEW.girone IS NOT NULL AND NEW.girone <> '' THEN
    v_competition := v_competition || ' — Girone ' || NEW.girone;
  END IF;
  IF NEW.giornata IS NOT NULL THEN
    v_competition := v_competition || ' · G.' || NEW.giornata;
    IF NEW.fase IS NOT NULL AND NEW.fase <> '' THEN
      v_competition := v_competition || ' (' || NEW.fase || ')';
    END IF;
  ELSIF NEW.fase IS NOT NULL AND NEW.fase <> '' THEN
    v_competition := v_competition || ' · ' || NEW.fase;
  END IF;

  SELECT home_field_address INTO v_home_addr
  FROM public.clubs
  WHERE id = '9cb45011-8014-45f1-a045-f2253d422926';

  INSERT INTO matches (
    lnd_gara_id, team_id, match_date, opponent, venue, competition,
    location, location_address, status
  ) VALUES (
    NEW.id, v_team_id, v_dt, NEW.avversario,
    CASE WHEN NEW.in_casa THEN 'home'::match_venue ELSE 'away'::match_venue END,
    v_competition,
    CASE WHEN NEW.in_casa THEN 'Campo Sportivo Poirino' ELSE NULL END,
    CASE WHEN NEW.in_casa THEN v_home_addr ELSE NULL END,
    'scheduled'::match_status
  )
  ON CONFLICT (lnd_gara_id) DO UPDATE SET
    team_id     = EXCLUDED.team_id,
    match_date  = EXCLUDED.match_date,
    opponent    = EXCLUDED.opponent,
    venue       = EXCLUDED.venue,
    competition = EXCLUDED.competition,
    location    = CASE
      WHEN matches.location IS NULL OR matches.location = 'Campo Sportivo Poirino'
        THEN CASE WHEN NEW.in_casa THEN 'Campo Sportivo Poirino' ELSE NULL END
      ELSE matches.location
    END,
    location_address = COALESCE(
      matches.location_address,
      CASE WHEN NEW.in_casa THEN v_home_addr ELSE NULL END
    );

  RETURN NEW;
END;
$function$;
