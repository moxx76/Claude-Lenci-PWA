# Matrice di test manuale per ruolo — Lenci LAB

**Scopo:** prima di accettare un deploy in produzione (o di approvare una PR
che tocchi autenticazione/RLS/dashboard/sheets), verificare manualmente che
ogni ruolo veda e possa fare ESATTAMENTE quello che la specifica prevede —
niente di più, niente di meno.

Questa matrice copre i 7 ruoli operativi: `admin`, `coach`, `coach + is_manager`,
`admin + is_director`, `parent`, `athlete`, `journalist`. Più la vista
`admin → impersona manager` (supervisor) e `admin + can_switch_to_parent`.

Ambiente di prova: creare 1 utente per ruolo in Supabase con password standard
`Lenci2026!` (vedi `ways-of-working.md` per il pattern SQL bypass). Assegnare
loro 1 team conosciuto e usare dati reali di stagione.

---

## Legenda check

- ✅ **DEVE funzionare** — il ruolo ha diritto a questa azione, il risultato
  atteso è il successo (o il contenuto visibile)
- ❌ **DEVE essere negato** — la UI non deve mostrare il controllo, oppure
  il backend deve rifiutare la chiamata (RLS 42501 / 404)
- 👁️ **DEVE vedere senza poter modificare** — campo visibile ma readonly
- 🔀 **DIPENDE dal team assegnato** — vedere solo le righe del proprio team

Un check `❌` che risponde `✅` è un **bug di sicurezza da fixare prima del
deploy**. Un `✅` che risponde `❌` è un bug UX ma non blocca.

---

## 1. Login + sessione

| Azione | admin | director | coach | manager | parent | athlete | journalist |
|---|---|---|---|---|---|---|---|
| Login con email + password corretta | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Login con password sbagliata rimane su /login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reset password via email → nuova password funziona | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Logout torna a /login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sessione sopravvive al refresh | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hard refresh con token scaduto re-logga automaticamente | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 2. Routing (NotForJournalist)

| URL | admin | director | coach | manager | parent | athlete | journalist |
|---|---|---|---|---|---|---|---|
| `/` → Dashboard | ✅ Admin | ✅ Director | ✅ Coach | ✅ Manager | ✅ Parent | ✅ Athlete | ❌ redir /giornalisti |
| `/teams` | ✅ | ✅ | 🔀 solo own | 🔀 solo own | ❌ | ❌ | ❌ redir |
| `/calendario` | ✅ tutte squadre | ✅ | 🔀 solo own | 🔀 solo own | 🔀 solo propri figli | 🔀 solo own | ❌ redir |
| `/esercizi` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ redir |
| `/annunci` | ✅ CRUD | ✅ CRUD | ✅ submit (approvato da admin) | ✅ submit | 👁️ solo lettura | 👁️ solo lettura | ❌ redir |
| `/comunicati` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ redir |
| `/referti` | ✅ | ✅ | ✅ propri | ✅ propri | 👁️ propri figli | ❌ | ❌ redir |
| `/marketing` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ redir |
| `/giornalisti` | ✅ accessibile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ unica |
| `/moduli` | ✅ CRUD + upload | ✅ CRUD + upload | ❌ | ❌ | ❌ | ❌ | ❌ redir |
| `/profile` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Importante:** prova anche digitazione diretta nell'URL (non solo click sulla
NavBar) — un router che accetta `/marketing` per un parent al click ma non
all'URL diretto è ancora un bug.

## 3. Dashboard admin

| Elemento | Visibile? | Interattivo? | Note |
|---|---|---|---|
| Statistiche aggregate (atleti/squadre/trainings/matches) | ✅ | — | aggregate su TUTTE le squadre |
| Certificati medici in scadenza/scaduti/mancanti | ✅ | ✅ click apre Compliance | 3 contatori separati |
| Prossimi eventi (globali) | ✅ | ✅ edit evento | tutte le squadre |
| Annunci in attesa approvazione | ✅ | ✅ approva/rifiuta | con reason textarea su rifiuto |
| CoachPlayerStatsDashboard per squadra selezionata | ✅ | ✅ seleziona team | lazy chunk 21KB |
| WeekendPlannerCard | ✅ | ✅ | lazy chunk 20KB |
| ShuttleServiceCard | ✅ | ✅ | se abilitato per il profilo |
| AdminStaffOverviewCard | ✅ | ✅ | lazy chunk 37KB |
| Btn "Backup dati" apre DatabaseBackupSheet | ✅ | ✅ | lazy chunk 8KB |
| Btn "Compliance" apre MedicalComplianceSheet | ✅ | ✅ | lazy chunk 9KB |
| Btn "Catalogo esercizi" apre TrainingExerciseCatalogSheet | ✅ | ✅ | lazy chunk 6KB |
| Btn "Log presenze" apre PresenceLogSheet | ✅ | ✅ | lazy chunk 7KB |
| Btn "Nuovo evento" apre EventEditSheet con teams=ALL | ✅ | ✅ | lazy chunk 41KB |

**Director** (admin + is_director): sostituisce AdminDashboard con DirectorDashboard
(chunk separato 24KB). Verificare che veda anche KPI direttivi + sezione report.

## 4. Dashboard coach / manager

| Elemento | coach (non manager) | manager |
|---|---|---|
| Mostra solo la squadra assegnata | ✅ | ✅ (prima squadra del manager) |
| Prossimo allenamento + evento gara | ✅ | ✅ |
| Lista roster con click → PlayerDetailSheet | ✅ (71KB lazy) | ✅ |
| "Nuovo evento" apre EventEditSheet con defaultTeamId | ✅ | ✅ |
| "Prendi presenze" apre EventPickerSheet poi AttendanceSheet | ✅ | ✅ |
| ShuttleServiceCard se autista | ✅ se marked | ✅ se marked |
| ManagerDashboard (manager+coach): sezione extra "staff del mio girone" | — | ✅ 39KB extra |

**Impersonation (admin supervisor):** admin che va in profilo e sceglie
"impersona Mario Rossi" vede il dashboard di Mario (coach o manager o altro
admin), e NON del proprio. Verificare che:
- Il nome mostrato è quello dell'impersonato (`effectiveFirstName`)
- Le query (events, team, roster) usano l'ID dell'impersonato
- Un click a `/profile` continua a mostrare il profilo dell'admin reale
- Lo switch disattivato in profilo rimette admin su propria dashboard

## 5. Dashboard parent

| Elemento | Comportamento atteso |
|---|---|
| Lista figli collegati via `parent_profile_id` | solo i propri figli, mai altri |
| Click su figlio → prossimo evento (match/training) | solo eventi del team del figlio |
| ParentAttendanceSheet (btn "Conferma/Rifiuta") | lazy 12KB, salva event_response |
| CalendarSubscribeSheet (btn "Sottoscrivi al calendario") | lazy 7KB, genera link ICS firmato con token stabile |
| Admin con `can_switch_to_parent=true` e mode='parent' | mostra ParentDashboard con i propri figli |
| Parent SENZA figli → messaggio "Nessun ragazzo associato" | ✅ |

## 6. Dashboard athlete

| Elemento | Comportamento atteso |
|---|---|
| Mostra solo il proprio nome + squadra | solo l'atleta loggato |
| Stat gamification (gol/minuti/presenze/MVP) | solo stat proprie (al momento valori mock, M12 non li ha ancora collegati al DB) |
| Btn "Conferma presenza allenamento di oggi" | setPresenceConfirmed, scrive event_response |
| Nessun accesso a roster di altri | ❌ |

## 7. Journalist

| Elemento | Comportamento atteso |
|---|---|
| /giornalisti è l'unica pagina raggiungibile | ✅ tutte le altre `/*` → redirect |
| Mostra news post pubblicati | solo news `publication_status=published` |
| Nessun accesso a dati sensibili (profili, pagamenti, roster) | ❌ |

## 8. RLS: cross-team isolation

Procedura: creare 2 coach di team diversi (Team A, Team B).

| Da coach di Team A, tentare… | Risultato atteso |
|---|---|
| SELECT players WHERE team_id=TeamB | 0 righe (RLS) |
| SELECT attendances WHERE player.team_id=TeamB | 0 righe |
| INSERT training per team_id=TeamB | 42501 insufficient_privilege |
| UPDATE match WHERE team_id=TeamB | 0 righe aggiornate (silent-fail → errore esplicito nel codice M3) |
| Visualizzare DashboardCoach: vede solo Team A | ✅ |
| Aprire /calendario: vede solo eventi Team A | ✅ |

## 9. RLS: parent → figli

Procedura: parent con 2 figli collegati (Carlo in Team U14, Giulia in Team U12).

| Dal parent, verificare che… | Risultato atteso |
|---|---|
| Dashboard mostra entrambi i figli | ✅ |
| /calendario mostra eventi dei team U14 e U12 | ✅ |
| /comunicati mostra sia U14 che U12 | ✅ |
| SELECT players WHERE team_id="altra squadra" | 0 righe |
| ParentAttendanceSheet per Carlo non salva event_response.child_id = Giulia | 42501 |

## 10. PWA + VersionGuard

| Scenario | Risultato atteso |
|---|---|
| Deploy nuova versione, PWA aperta su cellulare → entro 5 min aggiorna | ✅ automatico senza prompt |
| Admin sta compilando referto (bozza non salvata) + nuovo deploy | VersionGuard rimanda il reload (hasUnsavedWork → true) |
| Chiusura app → riapertura → entra con la nuova versione | ✅ cold start check |
| App offline (Chrome DevTools → Offline) + reload | mostra UI (Workbox precache), 401 sulle API è gestito |

## 11. Push notifications

| Scenario | Risultato atteso |
|---|---|
| Prima autorizzazione sul device → notifica di test arriva | ✅ |
| Secondo invio entro il rate-limit (can_notify_user RPC) | ❌ silenziata, push_log registra |
| Deny su device → nessun crash lato Edge Function | ✅ errore gestito |

## 12. Export dati

| Azione | Risultato atteso |
|---|---|
| Admin apre DatabaseBackupSheet, esegue export | ZIP con tutte le tabelle paginata 1000 righe/pagina |
| Export parziale (una tabella fallisce) | filename `_PARZIALE.zip`, metadata `is_backup=false`, warning esplicito |
| Non-admin tenta DatabaseBackupSheet | ❌ UI nascosta, RLS blocca comunque le SELECT |

---

## Procedura di esecuzione

1. **Setup utenti test** (una sola volta per staging):
   ```sql
   -- pattern SQL bypass per ciascun ruolo (vedi ways-of-working.md)
   -- email: test-admin@lenci.test / test-coach@lenci.test / ...
   -- password: Lenci2026!
   ```
2. **Esegui la matrice** nelle 12 sezioni sopra, dalla PWA di produzione
   (`https://lenci-poirino-app.netlify.app`) con un browser pulito (incognito
   per non ereditare sessioni).
3. **Documenta discrepanze** su GitHub Issues con tag `security` (per `❌→✅`)
   o `ux` (per `✅→❌`).
4. **Non deploy** finché gli `❌→✅` non sono risolti.

**Tempo stimato esecuzione completa:** 90–120 minuti per 7 ruoli.
**Frequenza raccomandata:** prima di ogni deploy che tocca `src/pages/`,
`src/components/*Sheet.tsx`, `src/store/auth.ts`, o le policy RLS.

## Automazione in CI (debito futuro)

Le sezioni 1, 10, 11 (login/PWA/push) richiedono interazione browser con
credenziali reali; sono candidate ad E2E Playwright con dataset di staging.
Le sezioni 8, 9 (RLS cross-team/parent-figli) richiedono staging DB con
utenti test persistenti.

Lo smoke RLS attuale (`src/__tests__/rls-smoke.test.ts`) copre invece la
prima linea: anon non vede nessuna tabella sensibile. Quello gira ad ogni
`npm test`.
