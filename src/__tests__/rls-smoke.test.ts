import { describe, test, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * RLS smoke test — verifica che la ANON KEY (pubblica) non legga tabelle
 * sensibili. Prima linea di difesa: se qualcuno ruba la anon key dal
 * bundle del frontend (è pubblica by design), NON deve poter esportare
 * profili, pagamenti, messaggi, log push, ecc.
 *
 * Non copre:
 * - Policy specifiche per utente autenticato (richiedono staging con
 *   utenti test persistenti)
 * - RLS cross-team (richiedono due utenti di team diversi loggati
 *   contemporaneamente)
 *
 * Quelle sono documentate in docs/manual-test-matrix.md (M18) con la
 * procedura passo-passo da eseguire a mano in staging.
 *
 * Gira contro il progetto Supabase live (nlgknkopottaxewpdofl). Non ha
 * effetti collaterali: solo SELECT come anon.
 */

const SUPABASE_URL = 'https://nlgknkopottaxewpdofl.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZ2tua29wb3R0YXhld3Bkb2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODc0OTEsImV4cCI6MjA5NDc2MzQ5MX0.ruS3rzvUGBd5TKFXj2CWXVyPVRk2-DrO9H75KP14JNc'

const anon = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Timeout generoso: queste chiamano una API esterna
const TIMEOUT = 15_000

/**
 * Helper: verifica che una SELECT anon ritorni 0 righe (RLS blocca)
 * oppure un errore (policy esplicitamente nega). Entrambi i casi sono
 * accettabili per "nessun dato accessibile da anon".
 */
async function expectAnonBlocked(table: string, columns = '*') {
  const { data, error } = await anon.from(table).select(columns).limit(5)
  // RLS può ritornare array vuoto (policy restrittiva senza row match)
  // o errore (table-level deny). Entrambi "block" anon.
  if (error) {
    // Error acceptable — RLS blocca a livello di policy
    expect(error.message.length).toBeGreaterThan(0)
    return
  }
  expect(data, `Anon ha letto ${(data || []).length} righe da ${table}, atteso 0`).toEqual([])
}

describe('RLS smoke: tabelle sensibili bloccate per anon', () => {
  test('profiles — anon non vede profili utente', async () => {
    await expectAnonBlocked('profiles')
  }, TIMEOUT)

  test('players — anon non vede roster completo giocatori', async () => {
    await expectAnonBlocked('players')
  }, TIMEOUT)

  test('payments — anon non vede pagamenti', async () => {
    await expectAnonBlocked('payments')
  }, TIMEOUT)

  test('attendances — anon non vede presenze', async () => {
    await expectAnonBlocked('attendances')
  }, TIMEOUT)

  test('convocations — anon non vede convocazioni', async () => {
    await expectAnonBlocked('convocations')
  }, TIMEOUT)

  test('match_player_stats — anon non vede stat giocatore', async () => {
    await expectAnonBlocked('match_player_stats')
  }, TIMEOUT)

  test('player_assessments — anon non vede valutazioni (dati sensibili BMI)', async () => {
    await expectAnonBlocked('player_assessments')
  }, TIMEOUT)

  test('notifications — anon non vede notifiche di altri utenti', async () => {
    await expectAnonBlocked('notifications')
  }, TIMEOUT)

  test('push_subscriptions — anon non vede subscription endpoint utenti', async () => {
    await expectAnonBlocked('push_subscriptions')
  }, TIMEOUT)

  test('push_log — anon non vede log push (M17/A13 fix critical)', async () => {
    await expectAnonBlocked('push_log')
  }, TIMEOUT)

  test('event_responses — anon non vede risposte genitori a eventi', async () => {
    await expectAnonBlocked('event_responses')
  }, TIMEOUT)

  test('presence_submission_log — anon non vede submission log', async () => {
    await expectAnonBlocked('presence_submission_log')
  }, TIMEOUT)

  test('calendar_subscriptions — anon non vede token di sottoscrizione', async () => {
    await expectAnonBlocked('calendar_subscriptions')
  }, TIMEOUT)

  test('staff_attendances — anon non vede presenze staff', async () => {
    await expectAnonBlocked('staff_attendances')
  }, TIMEOUT)

  test('recruitment_leads — anon non vede lead reclutamento', async () => {
    await expectAnonBlocked('recruitment_leads')
  }, TIMEOUT)

  test('disciplinary_records — anon non vede provvedimenti disciplinari', async () => {
    await expectAnonBlocked('disciplinary_records')
  }, TIMEOUT)

  test('meetings — anon non vede riunioni (private/interne staff)', async () => {
    await expectAnonBlocked('meetings')
  }, TIMEOUT)

  test('meeting_rsvps — anon non vede RSVP riunioni', async () => {
    await expectAnonBlocked('meeting_rsvps')
  }, TIMEOUT)

  test('shuttle_services — anon non vede navette', async () => {
    await expectAnonBlocked('shuttle_services')
  }, TIMEOUT)
})

describe('RLS smoke: view PUBLIC (intenzionalmente leggibili da anon)', () => {
  test('players_public — anon può leggere nome/numero/ruolo giocatori', async () => {
    const { data, error } = await anon.from('players_public').select('*').limit(1)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    // Deve esporre SOLO i campi documentati (no DOB, no phone, no address)
    if (data && data.length > 0) {
      const row = data[0] as any
      expect(row).toHaveProperty('first_name')
      expect(row).toHaveProperty('last_name')
      // Campi sensibili NON devono comparire
      expect(row).not.toHaveProperty('birth_date')
      expect(row).not.toHaveProperty('phone')
      expect(row).not.toHaveProperty('address')
      expect(row).not.toHaveProperty('fiscal_code')
    }
  }, TIMEOUT)
})

describe('RLS smoke: lnd_comunicati bloccata per anon', () => {
  test('lnd_comunicati — anche i comunicati FIGC richiedono login (RLS)', async () => {
    // Decisione di prodotto: solo utenti autenticati vedono i comunicati
    // (coach/dirigenti/genitori). Un anon non deve esportarli in massa.
    await expectAnonBlocked('lnd_comunicati')
  }, TIMEOUT)
})
