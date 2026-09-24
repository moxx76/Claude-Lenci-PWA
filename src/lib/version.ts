/**
 * Versione dell'app e storico release.
 * Ad ogni deploy: aggiornare APP_VERSION e aggiungere una nuova entry in CHANGELOG in cima.
 * Convention semver: MAJOR.MINOR.PATCH
 *  - PATCH: fix bug, piccole rifiniture
 *  - MINOR: nuove feature retrocompatibili
 *  - MAJOR: breaking change o riscrittura importante
 */

export const APP_VERSION = '1.9.87'
export const APP_VERSION_DATE = '2026-09-22'

export interface Release {
  version: string
  date: string        // ISO YYYY-MM-DD
  title?: string
  features?: string[]  // ✨ novità
  fixes?: string[]     // 🐛 fix bug
  notes?: string[]     // 📌 note / anticipazioni
}

export const CHANGELOG: Release[] = [
  {
    version: '1.9.87',
    date: '2026-09-22',
    title: 'Flag "escludi da statistiche" per partite senza referto compilato',
    fixes: [
      'Nuova migration matches.exclude_from_stats (BOOLEAN, default false, con indice parziale). Le partite marcate come escluse non contano nei calcoli aggregati della dashboard mister: non entrano nel denominatore della % presenza, non gonfiano i minuti totali della squadra e i loro dati non alimentano le medie. Utile per partite giocate ma il cui referto non è mai stato compilato (o compilato in modo troppo parziale) — includerle penalizzava tutti i giocatori con presenze fittiziamente basse',
      'Toggle nella pagina Referti: sotto ogni riga partita c\'è ora una piccola barra con switch "Escludi dalle statistiche giocatori" (o "Esclusa dalle statistiche · tap per reincludere" se già attivo). Update ottimistico: la card diventa immediatamente pi\u00f9 tenue (opacity ridotta) e il badge diventa "🚫 Esclusa da stats" grigio; se il DB rifiuta l\'update, revert automatico con alert',
      'Nuovo chip filtro "🚫 Escluse" nella pagina Referti (accanto a Tutti / Da compilare / Compilati) per vedere in un colpo d\'occhio quali partite sono state escluse dalla stagione. Contatore per squadra',
      'Header card statistiche giocatori mostra "N escluse" in giallo quando ci sono partite escluse ("21 giocatori · 2 partite disputate · 5 escluse"), cos\u00ec il mister vede subito perch\u00e9 il denominatore non torna col calendario. Sia CoachPlayerStatsDashboard che PlayerDetailSheet applicano il filtro',
    ],
  },
  {
    version: '1.9.86',
    date: '2026-09-22',
    title: 'Statistiche giocatori admin: selettore squadra uniformato a Calendario e Squadre',
    fixes: [
      'Nella dashboard admin (e direttore) il selettore squadra della card "Statistiche giocatori" era una fila di chip scorrevoli custom, diversa dal resto dell\'app. Ora usa lo stesso pattern di Calendario e Squadre: pulsante grande colorato col nome della squadra attiva (colore = colore squadra, sottotitolo "N tesserati · Cambia squadra", icona expand_more) che apre TeamPickerSheet — il bottom sheet condiviso con la lista completa. Interazione, layout e stili identici alle altre pagine',
    ],
  },
  {
    version: '1.9.85',
    date: '2026-09-22',
    title: 'Dashboard admin/direttore: statistiche giocatori con selettore squadra',
    fixes: [
      'La dashboard "Statistiche giocatori" (con filtri e confronto introdotta in 1.9.83-84) era visibile solo al mister della singola squadra. Ora appare anche in AdminDashboard (admin senza direttore) e DirectorDashboard (admin con is_director=true), posizionata subito dopo la card "Panoramica staff", con un selettore squadra a chip scorrevoli in cima. L\'admin sceglie quale categoria vedere (Prima Squadra, Juniores, Under 16, Under 14, ecc.) e il pannello sotto ricarica automaticamente con tutti i giocatori di quella squadra, i loro filtri, il confronto e la tabella completa',
      'Il selettore mostra il nome della squadra + numero tesserati (es. "Under 14 · 21"). Il colore del chip attivo eredita dal colore della squadra. Default: prima squadra della lista al primo caricamento, poi rimane la scelta dell\'utente per tutta la sessione',
    ],
  },
  {
    version: '1.9.84',
    date: '2026-09-22',
    title: 'Dashboard mister: filtri (ricerca, ruolo, stato) e confronto giocatori side-by-side',
    fixes: [
      'Nuova barra filtri sopra la tabella "Statistiche giocatori": ricerca testuale su nome/cognome (con pulsante clear), chip ruolo (🧤Portieri / 🛡️Difensori / ⚙️Centrocampisti / ⚔️Attaccanti) e chip stato (✅Attivi / 👻Mai giocato). I filtri si combinano in AND; contatore "N su M" mostra quanti giocatori restano visibili. Empty-state con pulsante "Azzera filtri" se la selezione svuota la lista',
      'Confronto tra 2 giocatori: nuova colonna checkbox nella prima posizione della tabella. Tappa la casella per aggiungere un giocatore al confronto (max 2, il 3° espelle il pi\u00f9 vecchio in FIFO). La riga selezionata resta evidenziata in azzurro. Appare una barra blu in basso al box con i cognomi selezionati e il pulsante "Confronta →"',
      'Vista confronto (bottom sheet dedicato): 2 card header con numero maglia, cognome, nome, ruolo e contatore "N vinte". Sotto, griglia di 11 KPI a colonne affiancate (Presenze, Titolarit\u00e0, Subentri, %, Minuti tot, Media min/presenza, Gol, Media gol/presenza, Assist, 🟨, 🟥). Il valore migliore di ogni riga viene evidenziato in verde. Per cartellini vince chi ne ha meno (logica invertita). Include metriche derivate (medie) per confronto equo anche tra giocatori con numero di partite diverso',
    ],
  },
  {
    version: '1.9.83',
    date: '2026-09-22',
    title: 'Dashboard mister: tabella completa statistiche giocatori (presenze, %, minuti, gol, assist, cartellini)',
    fixes: [
      'Nuova sezione "Statistiche giocatori" nella dashboard del mister (ManagerDashboard per allenatore-dirigente, CoachDashboard per allenatore semplice). Tabella riassuntiva di TUTTO il roster della squadra con: numero maglia, cognome/nome, presenze (titolare + subentri), % presenza calcolata su partite disputate, minuti giocati totali, gol (rigori inclusi con asterisco), assist, gialli, rossi. Header cliccabili per ordinare per qualsiasi colonna. Tap sul nome apre la scheda personale del giocatore. Sezione collassabile',
      '% presenza colorata: verde ≥70%, giallo 40-70%, rosso <40%. Giocatori mai convocati appaiono in grigio in fondo alla lista, cos\u00ec il mister vede a colpo d\u2019occhio chi non gioca. La cella presenze mostra split "totale (N T)" con N = titolarit\u00e0. Il calcolo minuti usa la durata partita configurata sul team (35\'x2 per U14, ecc.) per gestire correttamente titolari fino alla fine e subentri',
      'Nessuna migration DB: query aggregata client-side su match_player_stats join matches del team. Testato su Under 14 (21 giocatori, 7 partite disputate, 95 righe stats): la classifica minuti mette in cima chi ha giocato pi\u00f9 partite intere, quella gol Mantovani Nicol\u00f2 con 7 marcature',
    ],
  },
  {
    version: '1.9.82',
    date: '2026-09-22',
    title: 'Scheda giocatore: presenze, gol, assist e minuti giocati per singola partita',
    fixes: [
      'La scheda personale del giocatore (PlayerDetailSheet) mostrava solo la storia dei gol. Ora mostra la vista completa "Statistiche stagione" con 4 KPI aggregati (Presenze / Gol / Assist / Minuti) e la lista partita-per-partita di ogni presenza (titolare o subentro) con badge TIT/SUB, range minuti in-out, gol, assist e minuti effettivi giocati',
      'Calcolo minuti giocati robusto per singola partita: titolare fino alla fine = durata totale (2\u00d735=70\u2019 per U14, 2\u00d745=90\u2019 per Juniores, ecc.); titolare sostituito al min X = X; subentrato al min Y fino alla fine = totale − Y; subentrato al min Y sostituito al min Z = Z − Y. La durata partita arriva dal join con teams (fallback 90 minuti). Media minuti per presenza mostrata come sub-label del KPI',
      'Nessuna migration DB necessaria: tutti i dati (goals, assists, minute_in, minute_out, was_starter) erano gi\u00e0 salvati correttamente in match_player_stats dal referto post-partita e dalla distinta tattica. Mancava solo la vista aggregata sul lato giocatore. Verificato lo stato: gi\u00e0 40 giocatori con 114 righe di stats storiche, quindi la scheda comincia a essere significativa da subito',
    ],
  },
  {
    version: '1.9.81',
    date: '2026-09-22',
    title: 'Distinta tattica: campo numero di maglia per partita → finisce nel foglio A4 stampato',
    fixes: [
      'Nella distinta tattica (step 3, dopo capitano/vice) nuova sezione "🎽 Numeri di maglia" con un input compatto per ogni convocato (titolari + panchina). Il numero inserito viene salvato in convocations.shirt_number_override (colonna gi\u00e0 esistente) e viene stampato nel foglio partita A4 con precedenza sul numero di anagrafica del giocatore. Utile quando i giocatori non hanno un numero fisso in anagrafica (comune nel giovanile) o si assegnano numeri diversi partita per partita',
      'Salvataggio efficiente: al save vengono aggiornati SOLO i numeri effettivamente modificati rispetto allo stato di apertura (snapshot iniziale confrontato con lo stato corrente), non l\u2019intera tabella convocations. Le UPDATE vengono lanciate in parallelo con Promise.allSettled, i fallimenti loggano un warning ma non bloccano il salvataggio di distinta e capitani',
    ],
  },
  {
    version: '1.9.80',
    date: '2026-09-22',
    title: 'Fix 3 bug ruolo Dirigente: autoesclusione, multi-categoria calendari, convocazioni cross-team',
    fixes: [
      'BUG 1 (Squadre): un dirigente poteva selezionare "Nessuno" nel proprio ruolo di Dirigente accompagnatore nella schermata Modifica squadra e perdere l\u2019accesso alla propria squadra. Ora bloccato lato frontend (messaggio "Non puoi rimuovere la tua assegnazione alla squadra. Contatta un amministratore.") E lato backend con un trigger BEFORE UPDATE sulla tabella teams che verifica per non-admin che almeno uno dei 6 ruoli (head/assistant/helper coach + team/second/third manager) resti assegnato all\u2019utente corrente se ci era prima. Gli admin possono modificare senza limiti',
      'BUG 2 (Calendario): un dirigente assegnato a due categorie vedeva nel Calendario solo la prima squadra (nessun modo di switchare). Causa: CalendarPage usava useMyTeam().myTeam (singolare, prima squadra) invece di myTeams (array). Ora se lo staff ha \u2265 2 squadre assegnate compare il selettore squadra in cima alla pagina (lo stesso usato dagli admin, ma filtrato solo sulle squadre a cui l\u2019utente ha accesso — senza opzione "Tutte le squadre" che sarebbe fuorviante). Passare da una squadra all\u2019altra ricarica gli eventi correnti; creare/modificare eventi finisce sempre nella squadra selezionata',
      'BUG 3 (Convocazioni): la funzione "Da altra categoria" ritornava elenco vuoto per i dirigenti (funzionava solo per gli admin). Causa: le RLS su players filtravano su team_id IN my_team_ids() per gli staff, impedendo la lettura di giocatori di altre categorie. Aggiunta nuova policy SELECT permissiva ("staff legge tutti i giocatori per convocazioni cross-team") che consente a qualsiasi coach/dirigente di LEGGERE anagrafiche di tutti i giocatori del club per formare convocazioni miste. Le operazioni INSERT/UPDATE/DELETE restano ristrette ai propri team — nessun cambio di permessi di gestione',
    ],
  },
  {
    version: '1.9.79',
    date: '2026-09-22',
    title: 'Pagina Referti: gli admin vedono tutte le squadre di tutte le categorie',
    fixes: [
      'La pagina Referti ora distingue admin dai coach: gli admin vedono TUTTE le partite di TUTTE le squadre del club, non solo di quelle a cui sono formalmente assegnati come head/assistant coach o team manager. Fetch di tutte le teams al load per popolare il dropdown filtro squadra, e query matches senza il filtro .in(team_id) per gli admin',
      'Badge "ADMIN · TUTTE LE CATEGORIE" mostrato nell\u2019header solo per gli admin, per rendere esplicita la vista trasversale. Descrizione della pagina adattata di conseguenza',
      'Dropdown filtro squadra ora sempre visibile per gli admin (con la lista completa delle squadre del club, ordinata per categoria + nome), invece che solo quando il coach ha \u2265 2 squadre assegnate. Per i coach il comportamento resta invariato',
    ],
  },
  {
    version: '1.9.78',
    date: '2026-09-22',
    title: 'Nuova voce menu "Referti partite" per compilare i post-match da un unico posto',
    fixes: [
      'Aggiunta la pagina Referti nel menu laterale (per staff: admin/coach). Mostra l\u2019elenco di tutte le partite passate delle squadre a carico, ordinate dalla pi\u00f9 recente, con badge dello stato: "\u2705 Compilato" se ci sono statistiche, "\u26a0\ufe0f Da compilare" altrimenti (evidenziate in giallo). Tap sulla card apre lo stesso Post-Match report gi\u00e0 usato da dashboard e calendario',
      'Filtri: dropdown squadra (se l\u2019utente ne ha pi\u00f9 di una) e segmented control per stato (Tutti / Da compilare / Compilati) con conteggio a fianco. Ordinamento fisso per data decrescente. Cap a ultimi 200 referti — pi\u00f9 che sufficiente per una stagione',
      'Design coerente: barra colorata del team a sinistra della card, badge team + stato in alto, avversario con icona 🏠/✈️, data e ora, competizione, e il risultato a destra col verdetto Vittoria/Pareggio/Sconfitta. Al salvataggio del referto la card si aggiorna automaticamente da "Da compilare" a "Compilato" senza dover ricaricare',
    ],
  },
  {
    version: '1.9.77',
    date: '2026-09-22',
    title: 'Foglio partita A4: stampa su 1 sola pagina + fix definitivo taglio panchina',
    fixes: [
      'Stampa foglio partita sforava su 2 fogli. Causa: la somma delle altezze del layout era 209mm (padding 3mm×2 + header 18 + gap 1.5×2 + body 137 + footer 45) mentre l\u2019area utile A4 landscape con margini stampa 5mm \u00e8 200mm. Fix: eliminato padding del container sheet, ridotti i gap (1.5\u21921mm), footer (45\u219240mm) e ribilanciato il body (137\u2192140mm). Totale ora esattamente 200mm — sta su 1 sola pagina',
      'Ultima riga panchina (9\u00b0 giocatore) veniva tagliata dall\u2019overflow del container. Complice del bug pagina 2: il body non aveva abbastanza spazio per contenere 11 titolari + 9 panchinari. Con il body ora a 140mm e le righe compattate (titolari 5\u21925mm da 5.5, panchina 4mm da 4.5) tutti i 20 posti entrano senza sforare',
    ],
  },
  {
    version: '1.9.76',
    date: '2026-09-22',
    title: 'Nuovo pulsante "Aggiorna app / svuota cache" nel Profilo',
    fixes: [
      'Aggiunto un pulsante blu prominente in cima alla sezione Profilo: "Aggiorna app / svuota cache". Serve quando dopo un aggiornamento della app vedi ancora le vecchie schermate: la PWA (Service Worker + cache Workbox) pu\u00f2 continuare a servire chunk vecchi per un po\u2019, ed evita di dover andare nelle impostazioni del browser per ripulire i dati',
      'Cosa fa il pulsante: (1) disinstalla i Service Worker registrati, (2) svuota tutte le Cache API di Workbox, (3) ricarica la pagina con un cache-buster nell\u2019URL cos\u00ec il browser scarica tutto da zero. I dati e il login non vengono persi (restano sul server Supabase)',
    ],
  },
  {
    version: '1.9.75',
    date: '2026-09-22',
    title: 'Pulizia etichetta diagnostica sotto Timeline recap',
    fixes: [
      'Rimossa l\u2019etichetta diagnostica grigia sotto la Timeline nel Post-Match recap (aggiunta in v1.9.74 per capire perch\u00e9 la barra mostrava 90\u2019 anche per la U14). La causa era cache PWA del Service Worker sul dispositivo: il codice era corretto gi\u00e0 dal v1.9.71/v1.9.73, ma i chunk vecchi restavano serviti dalla cache locale finch\u00e9 un nuovo deploy non forzava il refresh degli asset',
    ],
  },
  {
    version: '1.9.74',
    date: '2026-09-22',
    title: 'Diagnostica temporanea sotto Timeline recap per capire perch\u00e9 mostra 90\u2019',
    fixes: [
      'DEBUG TEMPORANEO: sotto la Timeline nel Post-Match recap ora compare una riga grigia in corsivo che mostra la durata usata e i valori grezzi dei campi ricevuti dal chiamante. Serve a distinguere se il problema \u00e8 (a) cache PWA vecchia che serve codice pre-v1.9.71, (b) chiamante non aggiornato che non popola i campi durata, o (c) altro bug. Verr\u00e0 rimossa nella prossima release una volta capita la causa',
    ],
  },
  {
    version: '1.9.73',
    date: '2026-09-22',
    title: 'Pulsante Foglio A4 sticky dopo save distinta + Timeline durata anche da Calendario',
    fixes: [
      'Distinta tattica: il pulsante "Foglio partita A4 (stampa / PDF)" nella distinta appariva subito dopo il salvataggio e poi spariva dopo circa 1.5 secondi. Causa: la condizione era `savedOk || match.lineup_completed_at`, ma savedOk torna a false dopo 1500ms e la prop `match.lineup_completed_at` (che arriva dal parent) non veniva ricaricata in tempo. Fix: nuovo state locale `hasLineupSaved` che parte dal valore della prop ma diventa true al salvataggio e ci resta finch\u00e9 la sheet resta aperta, cos\u00ec il pulsante rimane visibile dopo il save senza dipendere dal ricaricamento del parent',
      'Timeline eventi nel Post-Match report ora usa la durata partita anche quando il recap viene aperto dalla pagina Calendario (in aggiunta alla dashboard Manager gi\u00e0 sistemata in v1.9.71). Erano rimasti 2 chiamanti in CalendarPage non aggiornati: apertura da evento calendario e apertura dallo storico partite di un giocatore. Ora entrambi popolano team_match_periods_count/team_match_period_duration_min tramite una fetch resiliente dei campi durata dal team, cos\u00ec la Timeline si scala correttamente (U14 70\u2019, U16 80\u2019, ecc.) da ogni punto di ingresso',
    ],
  },
  {
    version: '1.9.72',
    date: '2026-09-22',
    title: 'Foglio partita A4: aggiunta casella assist sotto ogni marcatore',
    fixes: [
      'GOAL LENCI: ogni slot ha ora 2 righe compilabili — "marcatore" (sopra) e "assist" (sotto in italico grigio), utili al match analyst per tracciare il contributo del compagno che ha servito il gol. La griglia resta 3\u00d75 = 15 slot per non allungare la sezione oltre l\u2019area disponibile del foglio A4',
    ],
  },
  {
    version: '1.9.71',
    date: '2026-09-22',
    title: 'Locandina col nome del club + Timeline con durata categoria + bozza fantasma fixed + panchina compatta',
    fixes: [
      'Locandina post-partita ora mostra "LENCI POIRINO" come titolo grande al posto del nome squadra ("UNDER 14"): la locandina promuove il CLUB, non la categoria interna. La squadra e la categoria ("Under 14 · U-14") scendono a sottotitolo sotto il nome club. Fetchato in modo resiliente dal DB (tabella clubs.short_name). Vale per entrambi i lati dell\u2019header',
      'Timeline eventi (barra 0\u2019-N\u2019) finalmente collegata alla durata partita configurata sulla squadra: la U14 mostra la barra su 70\u2019 con divisore a 35\u2019, la U16 su 80\u2019 con divisore a 40\u2019, ecc. Il collegamento era mancante in 2 punti: dashboard Manager (Timeline nelle partite passate espandibili) e Post-Match report (Timeline live nel recap). Ora entrambi caricano la durata dalla tabella teams e la passano al componente. La pagina Giornalista era gi\u00e0 collegata da v1.9.67',
      'U14 aggiornata in DB da 2\u00d730 (60\u2019) a 2\u00d735 (70\u2019). Le altre categorie restano sui preset FIGC: Piccoli Amici 3\u00d710, Primi Calci/Pulcini 3\u00d715, Esordienti 3\u00d720, U16 2\u00d740, Juniores/Prima 2\u00d745. Per modificare la durata di una categoria: Squadre \u2192 \u2699\ufe0f modifica squadra \u2192 pannello "Durata partita"',
      'Bozza fantasma nel Post-Match report: il banner "Hai una bozza non salvata" ricompariva anche dopo aver cliccato Scarta o Salva. Causa: il useEffect di autosalvataggio bozza aveva un debounce 500ms non cancellabile da fuori, quindi Scarta rimuoveva la bozza e 300ms dopo il timer scaduto la riscriveva. Idem al Salva. Fix: timer in ref cancellabile esplicitamente da discardDraft e save, e skip dell\u2019autosalvataggio quando saving/savedOk sono true',
      'Foglio partita A4: l\u2019ultimo giocatore della panchina (il 9\u00b0) veniva tagliato dal bordo del container. Ridotte le altezze delle righe (titolari 5.5\u21925mm, panchina 5\u21924.5mm) e compattato il font del numero maglia panchina (9.5\u21928.5pt con line-height 1). Ora tutti i 9 posti panchina entrano senza sforare',
      'Escape Unicode rotto nel banner del Post-Match: "Distinta tattica gi\\u00e0 compilata" mostrava letteralmente il codice invece del carattere "\u00e0". Ora scritto correttamente come "gi\u00e0 compilata"',
    ],
  },
  {
    version: '1.9.70',
    date: '2026-09-22',
    title: 'Foglio partita: pulsante sempre visibile + header pi\u00f9 alto + capitano/vice senza "?" quando manca numero maglia',
    fixes: [
      'Pulsante "Foglio partita (PDF stampabile)" nella card della prossima partita continuava a sparire in modo intermittente anche dopo il fix sticky di v1.9.68. Vera causa individuata: la condizione richiedeva convocated_count > 0, ma la query convocations in Promise.all pu\u00f2 fallire silenziosamente (Supabase restituisce {data:null, error:...} invece di rejectare) facendo scendere il conteggio a 0 anche in presenza di convocazioni. Doppio fix: (a) il pulsante Foglio ora appare sempre se c\u2019\u00e8 una prossima partita, perch\u00e9 comunque \u00e8 un PDF da stampare e riempire a mano - anche in bianco \u00e8 utile alla panchina; (b) sticky ref anche sui conteggi convocazioni e stats: se la query fallisce, riuso i valori precedenti invece di azzerare la UI, cos\u00ec anche gli altri contatori/badge non lampeggiano',
      'Header schiacciato: la riga "Arbitro / Terreno / Meteo" sforava fuori dall\u2019area header e si mescolava con le sezioni sottostanti (SCHIERAMENTO, TITOLARI, GOAL LENCI). Ora l\u2019header ha 18mm (era 15mm) e il corpo 137mm (era 140mm), totale invariato 200mm A4 landscape',
      'Riquadro CAP/VC mostrava un brutto cerchietto nero con "?" bianco quando il numero maglia del capitano non era in anagrafica. Ora: cerchietto bianco vuoto con bordo se numero mancante, cerchietto nero pieno col numero se presente. Icona \u2b50 dorata per CAP (colore capitano) e blu per VC',
    ],
  },
  {
    version: '1.9.69',
    date: '2026-09-22',
    title: 'Foglio partita: mini-campo funzionante, ruoli compatti, panchina che non sfora',
    fixes: [
      'Mini-campo grafico: i cerchietti dei titolari erano tutti sovrapposti al centro (11 pallini nello stesso punto). Bug di accesso: il codice cercava FORMATIONS[modulo].slots ma FORMATIONS[modulo] è direttamente l\u2019array degli slot. Ora i puntini si distribuiscono correttamente sulle posizioni del modulo (portiere in basso, difensori, centrocampisti, attaccanti in alto)',
      'Panchina che sconfinava sopra alle sezioni AMMONIZIONI/ESPULSIONI/NOTE: ridotta altezza riga tabelle (titolari 5.5mm, panchina 5mm) e aggiunto overflow:hidden sul contenitore corpo. Il footer ora ha 45mm invece di 40mm, il corpo 140mm invece di 145mm, tutto rimane nei 200mm A4 landscape',
      'Ruoli titolari mostravano il testo lungo "Difensore centrale" / "Terzino destro" che occupava troppa larghezza nella colonna. Ora uso le sigle GK / TD / TS / DC / MED / INT / TRQ / ED / ES / AD / AS / PC (colorate in blu) come nel resto della app',
      'Numero maglia: se non impostato in anagrafica, ora appare come casella vuota da compilare a mano invece del brutto "\u2014". Consiglio: aggiungete i numeri di maglia dei giocatori in Roster \u2192 modifica giocatore per averli pre-stampati',
    ],
  },
  {
    version: '1.9.68',
    date: '2026-09-22',
    title: 'Dashboard mister: pulsanti prossima partita smettono di lampeggiare',
    fixes: [
      'I pulsanti "Distinta tattica" e "Foglio partita" nella card del prossimo match a volte scomparivano e riapparivano a intermittenza. Ora la dashboard tiene in memoria l\u2019ultima partita mostrata (sticky) e non azzera pi\u00f9 i pulsanti anche se un reload interno fallisce a met\u00e0. Aggiunto anche un try/catch globale intorno al caricamento della dashboard: se una singola query fallisce, gli altri dati continuano a mostrarsi invece di far sparire tutto',
      'Aggiunti log diagnostici in console del browser (F12 \u2192 Console) che stampano "[ManagerDashboard] load() #N" ogni volta che la dashboard si ricarica: utile per capire se un\u2019azione fa scattare troppi reload consecutivi',
    ],
  },
  {
    version: '1.9.67',
    date: '2026-09-22',
    title: 'Foglio partita: fix titolari mancanti + layout molto pi\u00f9 leggibile',
    fixes: [
      'Titolari e panchina ora vengono davvero pre-compilati dalla distinta tattica. Bug del fetch convocazioni che usava status inesistenti (\'confirmed\', \'convocated\') invece di quello reale (\'accepted\'): la tabella titolari e la panchina restavano vuote, il capitano/vice mostrava "?" invece del nome, e il mini-campo era senza puntini giocatori',
    ],
    features: [
      'Layout tabelle titolari/panchina riscritto: righe con bordi netti (non pi\u00f9 tratteggi confusi), zebra background alternato bianco/grigio chiaro, numero maglia in font grosso 10pt, ruolo in blu 7.5pt, cognome in maiuscolo + nome. 11 righe fisse per titolari e 9 per panchina anche se la distinta \u00e8 parziale (righe vuote pronte da compilare a mano)',
      'Sezione GOAL LENCI (15 slot) riorganizzata a griglia: casella minuto disegnata, linea marcatore con label sotto, checkbox rig/pun su due righe pulite. Niente pi\u00f9 "min:/marc:/ast:" affastellati',
      'Sezione GOAL AVVERSARI e SOSTITUZIONI riscritte con casella minuto + campo ENTRA/ESCE dedicati per la sostituzione (colori verde/rosso per riconoscimento immediato)',
      'AMMONIZIONI/ESPULSIONI con caselle disegnate, ETICHETTE piccole grigio-chiaro sotto i campi per orientarsi',
      'Se apri il foglio prima di compilare la distinta, il mini-campo mostra un messaggio "Distinta non compilata / torna alla dashboard" invece di stare vuoto e confondere',
    ],
  },
  {
    version: '1.9.66',
    date: '2026-09-22',
    title: 'Foglio partita A4 stampabile in PDF per la panchina',
    features: [
      'Nuovo pulsante "\ud83d\uddb0\ufe0f Foglio partita (PDF stampabile)" sotto la card del prossimo match nella dashboard: apre una pagina dedicata gi\u00e0 impaginata come foglio A4 orizzontale, con distinta pre-compilata dei tuoi convocati e griglie vuote per annotare a mano tutto quello che succede in partita',
      'Contenuto del foglio: header con squadre + risultato finale in caselle vuote + arbitro/terreno/meteo, mini-campo con schieramento e numeri di maglia, tabella titolari (11 righe con caselle Cart e Uscita), tabella panchina (Entra + Sostituisce), 15 slot GOAL LENCI su 3 colonne con min/marcatore/assist e checkbox rigore/punizione, 8 slot GOAL AVVERSARI, 10 slot SOSTITUZIONI, 8 slot AMMONIZIONI orizzontali, 2 slot ESPULSIONI con motivo esteso e zona NOTE a righe',
      'Stampa: un tap sul pulsante "\ud83d\uddb0\ufe0f Stampa / Salva come PDF" apre il dialogo nativo del browser che permette di stampare fisicamente o salvare in PDF (su iOS/Android si salva in Files/Drive con un tap). Il layout \u00e8 impostato per essere leggibile anche in bianco/nero, cos\u00ec funziona con qualsiasi stampante',
      'Disponibile anche nel wizard "Distinta tattica" step finale: appena salvi la distinta compare la CTA "\ud83d\uddb0\ufe0f Foglio partita A4" per stampare subito con i giocatori appena scelti',
    ],
    notes: [
      'Nessuna dipendenza esterna: implementato con Print CSS + window.print() nativo. Il foglio si adatta gi\u00e0 alle proporzioni A4 landscape (297\u00d7210 mm)',
      'La rotta \u00e8 /foglio-partita/:matchId, apre in una nuova scheda per non perdere la dashboard',
    ],
  },
  {
    version: '1.9.65',
    date: '2026-09-22',
    title: 'Locandina PNG post-partita: header col risultato + campo + marcatori',
    features: [
      'I pulsanti "Scarica" e "Condividi" nel Recap del referto ora generano una vera **locandina post-partita** in formato portrait 900\u00d71760\u20132100px, pronta per WhatsApp/Instagram/Facebook. Non pi\u00f9 solo il campo grafico',
      'Header: fascia colorata nel colore squadra con nome team + avversario, categoria (Under 14/16 ecc.), competizione, data, orario, casa/trasferta, e al centro un badge scuro col risultato in font Anybody grande',
      'Corpo centrale: il campo grafico gi\u00e0 esistente (con sostituzioni indicate dalle freccette gialle)',
      'Footer: elenco completo dei marcatori Lenci con minuti (indicando i rigori con "rig"), autogol avversari a favore, sostituzioni cronologiche (in \u2190 out), modulo e hashtag della squadra. Il footer si dimensiona automaticamente al contenuto',
    ],
    notes: [
      'Il rendering \u00e8 fatto interamente in canvas dal browser senza librerie esterne: il nome squadra viene scritto ad alta risoluzione dal Canvas API, il campo viene rasterizzato dall\u2019SVG del PitchView e composto sopra. Peso PNG finale tipicamente 300\u2013800 KB',
    ],
  },
  {
    version: '1.9.64',
    date: '2026-09-22',
    title: 'Timeline eventi grafica 0\u2019-90\u2019 con gol, cartellini rossi e sostituzioni',
    features: [
      'Nuova timeline orizzontale che racconta la partita minuto per minuto: puntini gialli per i gol Lenci, rossi per i gol subiti, cartellini rossi con icona, sostituzioni con freccia (uscente \u2190 subentrato). Il tratto centrale segna l\u2019intervallo (HT al 45\u2019) e la scala si estende automaticamente ai supplementari se ci sono eventi oltre il 90\u2019',
      'Nel referto post-gara nuovo campo "Gol avversari (minuti)" facoltativo: se compilato, i gol subiti compaiono come puntini rossi sulla timeline. Il conteggio totale rimane invariato e si legge sempre dal risultato',
      'Timeline visibile in tre punti: vista giornalisti sotto il campo grafico, anteprima live nel Recap del referto (mentre compili vedi come apparir\u00e0), e nelle partite passate della dashboard come nuovo pulsante espandibile "Timeline eventi" accanto a "Vedi distinta"',
      'I cartellini gialli vengono contati e mostrati come badge riassuntivo (es. "\ud83d\udfe8 3 ammonizioni") accanto alla timeline: nel DB attuale non abbiamo i minuti dei gialli, quindi non finiscono sulla barra',
    ],
    notes: [
      'Nuova colonna DB matches.opponent_goal_minutes (array int, default vuoto). Il campo \u00e8 opzionale e retro-compatibile: le partite gi\u00e0 registrate senza minuti gol subiti continuano a mostrare tutto tranne quei puntini rossi',
    ],
  },
  {
    version: '1.9.63',
    date: '2026-09-22',
    title: 'Campo grafico: sostituzioni indicate + immagine PNG per WhatsApp + preview partite passate',
    features: [
      'Il campo grafico ora mostra anche le sostituzioni: sotto ogni titolare che \u00e8 uscito compare una freccia gialla "\u2193 65\u2032" seguita dal cognome (con numero maglia) del subentrato. Cos\u00ec la formazione racconta l\u2019intera partita a colpo d\u2019occhio, non solo l\u2019undici iniziale. Visibile su dashboard, distinta tattica, vista giornalisti e nel recap PNG',
      'Nuovi due pulsanti nel Recap partita del referto post-gara: "Scarica campo (PNG)" e "Condividi immagine". La formazione viene esportata come immagine 900x1260 pixel (qualit\u00e0 retina) pronta per WhatsApp/Instagram. Su mobile "Condividi" apre il selettore nativo di condivisione con file immagine allegato; su desktop scarica il PNG e copia il testo del recap negli appunti da incollare accanto',
      'Preview distinta anche sulle partite passate della dashboard: le ultime 5 gi\u00e0 giocate mostrano una sezione espandibile "Vedi distinta" con modulo, campo grafico e sostituzioni. Utile per rivedere schieramenti e cambi vecchi senza dover riaprire il referto',
    ],
    notes: [
      'Il PNG del campo \u00e8 generato via canvas dal SVG del componente PitchView (nessuna dipendenza esterna): funziona offline e senza upload di dati. Se il browser non supporta la Web Share API con file (desktop principalmente), la condivisione fa fallback su download del PNG + copia del testo negli appunti',
    ],
  },
  {
    version: '1.9.62',
    date: '2026-09-22',
    title: 'Referto post-gara riscritto: parte dalla distinta + bozza persistente',
    features: [
      'Il referto post-gara ora parte dalla distinta tattica: i giocatori vengono mostrati nell\u2019ordine dello schieramento (portiere, difesa, centrocampo, attacco secondo gli slot del modulo) invece che per numero di maglia, con i panchinari sotto. Se \u00e8 stata compilata la distinta compare un banner verde in cima "Distinta tattica gi\u00e0 compilata" e i titolari sono automaticamente impostati con i ruoli — il coach nel dopo-gara aggiunge solo gol, sostituzioni e cartellini',
      'Bozza persistente: ogni modifica al referto viene salvata automaticamente nel browser (localStorage con debounce di 500ms). Se chiudi la scheda senza salvare, per errore o per il timeout della sessione, alla riapertura compare un banner arancione "Hai una bozza non salvata" con la data e ora della modifica e i pulsanti Recupera / Scarta. Al salvataggio esplicito su server la bozza viene ripulita',
      'Sostituzioni strutturate: quando marchi un panchinaro come "Subentrato" e inserisci il minuto di ingresso, compare un dropdown "Sostituisce" che elenca solo i titolari ancora in campo a quel minuto. Selezionando un titolare, il suo minuto di uscita viene impostato automaticamente uguale al minuto di ingresso del subentrato — una sostituzione = un singolo click coordinato invece di dover modificare a mano i minutaggi di due giocatori',
    ],
    notes: [
      'La bozza \u00e8 locale al singolo dispositivo/browser: non si sincronizza tra telefono e desktop. Serve come rete di sicurezza, non come vero salvataggio — il salvataggio esplicito con il pulsante "Salva" resta l\u2019unico modo per rendere le modifiche visibili a tutti',
      'Chiude il ciclo di 5 release dedicato al flusso squadra (v1.9.58 vice capitano, v1.9.59 distinta tattica, v1.9.60 import + preview, v1.9.61 campo grafico + modulo cambiato in corsa, v1.9.62 referto riscritto). Il ciclo di miglioramenti report squadra \u00e8 completato',
    ],
  },
  {
    version: '1.9.61',
    date: '2026-09-22',
    title: 'Distinta tattica: vista campo grafico + modulo cambiato in corsa',
    features: [
      'Nuova vista "campo grafico" della distinta: un mini campo verde SVG con i giocatori posizionati sugli slot del modulo, cerchi con numero maglia e nome sotto, bordo dorato per il capitano e bordo blu tratteggiato per il vice, portiere evidenziato in giallo. Ogni modulo dei 17 preset ha coordinate x/y specifiche (portiere in basso, attacco in alto)',
      'Il campo compare in 3 posti: nella dashboard del prossimo match (sostituisce la lista testuale della preview), nel terzo step della Distinta tattica come anteprima live mentre imposti panchina e fascia, e nella vista Giornalisti sopra la sezione Titolari — cos\u00ec la formazione si legge a colpo d\u2019occhio invece di scorrere un elenco',
      'Nel referto post-partita ora si pu\u00f2 dichiarare se il modulo \u00e8 cambiato in corsa dopo un\u2019espulsione o un cambio tattico: nuovo toggle "Modulo cambiato in corsa" che espande i campi "Nuovo modulo" e "Al minuto". Nella vista Giornalisti l\u2019header del campo mostra la transizione (es. "4-3-1-2 \u2192 4-4-1 dal 65\u2032")',
    ],
    notes: [
      'Migration DB: matches.effective_formation, matches.formation_change_minute. Nuovo componente riutilizzabile PitchView (SVG scalabile con coordinate percentuali per garantire coerenza tra i vari punti di visualizzazione)',
      'Prossima tappa (v1.9.62): riscrittura completa del referto post-gara che parte dalla distinta invece di ricompilare da zero + bozza persistente per non perdere il lavoro se chiudi senza salvare',
    ],
  },
  {
    version: '1.9.60',
    date: '2026-09-22',
    title: 'Distinta tattica: import da partite precedenti + preview in dashboard',
    features: [
      'Nel primo passaggio della Distinta tattica ora compare in alto un menu "Importa da distinta precedente" con le ultime 10 partite gi\u00e0 compilate della squadra: data, avversario, modulo e numero di titolari. Scegliendone una viene importato tutto — modulo, giocatori sugli slot, capitano, vice, panchina — e si viene portati direttamente allo step Titolari per rifinire',
      'I giocatori della distinta importata che non sono convocati per la nuova partita vengono automaticamente esclusi: i loro slot restano vuoti e in cima appare un avviso giallo con l\u2019elenco degli esclusi ("3 giocatori non convocati per questa partita: Rossi M. (Terzino), Bianchi L. (Punta), \u2026") che pu\u00f2 essere chiuso con un click',
      'Preview della distinta gi\u00e0 compilata direttamente sulla dashboard del prossimo match: card azzurra sotto il pulsante che mostra modulo, elenco titolari per slot con (C) e (VC), e riassunto numerico (11 tit \u00b7 9 panc). Toccando la card si apre la scheda in modifica. Il pulsante cambia etichetta in "Modifica distinta tattica" quando la distinta \u00e8 gi\u00e0 salvata',
    ],
    notes: [
      'Prossima tappa (v1.9.61): vista campo grafico SVG in preview distinta e nel report giornalisti, gestione modulo cambiato in corsa nel post-gara. Poi v1.9.62: riscrittura completa del referto post-gara che parte dalla distinta + bozza persistente',
    ],
  },
  {
    version: '1.9.59',
    date: '2026-09-22',
    title: 'Distinta tattica: modulo, titolari per slot, capitani',
    features: [
      'Nuovo passaggio dopo la Convocazione: la "Distinta tattica" — un flusso a 3 step per compilare la formazione partendo dal modulo. Step 1: scegli il modulo tra 17 preset (4-4-2, 4-3-3, 3-5-2 e molti altri, incluse le formazioni a 7 e a 9 per Pulcini/Esordienti). Step 2: il modulo genera slot posizionali (Portiere, Terzino destro, Mediano, Ala…) e per ciascuno scegli il giocatore da un menu a tendina che pesca solo tra i convocati; i giocatori del ruolo naturale giusto compaiono in cima. Le etichette degli slot sono editabili (clicca la matita) per personalizzare il singolo ruolo. Step 3: assegni la panchina tra i convocati non titolari e confermi capitano e vice capitano (ereditati dalla convocazione ma modificabili qui)',
      'Il pulsante "Distinta tattica" compare nella scheda partita del dirigente sotto il pulsante Convocazione (visibile solo quando c\u2019\u00e8 almeno un convocato), e anche in fondo alla scheda Presenze & Convocazioni per passare direttamente al passo successivo appena salvata la convocazione',
      'La distinta popola automaticamente la scheda referto post-partita: i titolari sono gi\u00e0 impostati con il ruolo giocato preso dallo slot della distinta, quindi il coach nel dopo-gara deve solo aggiungere gol, minuti di sostituzione, cartellini',
    ],
    notes: [
      'Migration DB: match_player_stats.role_slot / role_slot_label / slot_index, matches.lineup_completed_at / lineup_completed_by. Salvataggio tramite UPSERT su (match_id, player_id) per non azzerare eventuali stats gi\u00e0 presenti. Il PostMatchSheet ora azzera automaticamente role_slot quando un giocatore viene spostato dalla titolarit\u00e0 alla panchina, per mantenere coerenza',
      'Prossime tappe: v1.9.60 vista campo grafico SVG in preview distinta e nel report giornalisti + modulo cambiato in corsa. v1.9.61 riscrittura completa del referto post-gara che parte dalla distinta + bozza persistente',
    ],
  },
  {
    version: '1.9.58',
    date: '2026-09-22',
    title: 'Vice capitano e passaggio di fascia nel referto giornalisti',
    features: [
      'Nella scheda Presenze & Convocazioni ora \u00e8 possibile nominare anche il Vice Capitano, con una nuova stella a met\u00e0 (\u2606) accanto alla stella del capitano. Vincoli: un solo vice per partita, e non pu\u00f2 essere lo stesso giocatore designato come capitano titolare',
      'Sul referto post-gara: se il capitano titolare esce durante la partita, il minuto della sua sostituzione viene automaticamente registrato come passaggio di fascia al vice capitano. Nessuna azione manuale richiesta',
      'Sulla vista Giornalisti la fascia \u00e8 ora tracciata correttamente: il capitano sostituito compare come "(C fino al 65\')" e il vice che ha ereditato la fascia come "(C dal 65\')", sia se era titolare sia se \u00e8 subentrato dalla panchina',
      'Anche il messaggio recap WhatsApp riflette la nuova notazione di capitano/vice capitano con il minuto del cambio fascia',
    ],
    notes: [
      'Prima release del ciclo di 4 versioni dedicato alla riscrittura della gestione distinta/report squadra. Prossime tappe: nuovo flusso Distinta Tattica con slot per modulo (v1.9.59), vista campo grafico e modulo cambiato in corsa (v1.9.60), referto post-gara che parte dalla distinta e bozza persistente (v1.9.61)',
    ],
  },
  {
    version: '1.9.57',
    date: '2026-09-21',
    title: 'Fix: l\u2019orario di ritrovo salvato dalla convocazione ora persiste',
    features: [
      'Corretto un bug per cui l\u2019orario di ritrovo scritto nella scheda Presenze & Convocazioni (usato per la locandina) veniva perso alla riapertura della scheda: il campo era solo temporaneo e non veniva mai scritto sul database. Ora l\u2019orario \u00e8 persistito sulla partita e ricomparir\u00e0 al successivo accesso, sia per il coach che per il dirigente',
    ],
  },
  {
    version: '1.9.56',
    date: '2026-09-15',
    title: 'Recap partita: pulsanti Copia e WhatsApp in fondo al referto',
    features: [
      'Dopo il salvataggio del referto post-gara compare una card blu con l\u2019anteprima di un messaggio di riepilogo pronto da condividere: risultato, squadra e competizione, elenco marcatori con il minuto del gol (rigori e autoreti indicati esplicitamente), formazione titolare col modulo tattico e i ruoli, subentrati col minuto di ingresso, ammoniti ed espulsi',
      'Due pulsanti: Copia messaggio (mette il testo negli appunti) e Condividi WhatsApp (apre WhatsApp Web/App con il messaggio gi\u00e0 precompilato per l\u2019invio al gruppo o a un contatto). Ideale da mandare al gruppo della squadra subito dopo il fischio finale',
      'La card \u00e8 sempre visibile mentre il referto \u00e8 aperto: puoi copiare il recap anche riaprendo il referto giorni dopo. Il messaggio si aggiorna in tempo reale mentre modifichi il referto',
    ],
  },
  {
    version: '1.9.55',
    date: '2026-09-15',
    title: 'Referto: ora puoi registrare gli autogol degli avversari a favore Lenci',
    features: [
      'Nel referto post-gara, sopra la lista giocatori, compare una nuova card "Autogol avversari a favore Lenci" con contatore + campo minuti opzionali. \u00c8 per quei gol Lenci che nascono da un autogol dell\u2019avversario e che prima non trovavano posto nel referto: prima potevi solo alzare manualmente il punteggio disattivando la somma automatica, adesso li registri esplicitamente e il contatore Nostri gol si aggiorna da solo',
      'Il campo "Autogol" gi\u00e0 presente nel form del singolo giocatore resta com\u2019era e continua a valere per il caso opposto (un nostro giocatore che segna nella propria porta, a favore avversario)',
      'La vista giornalisti riporta questi autogol come voce speciale "aut. avversario" in corsivo nella sezione Marcatori Lenci, inserita cronologicamente insieme agli altri marcatori. La stessa voce compare anche nella card homepage e nell\u2019elenco partite della squadra, sempre coi minuti se inseriti',
    ],
  },
  {
    version: '1.9.54',
    date: '2026-09-15',
    title: 'Vista giornalisti: marcatori in ordine cronologico',
    features: [
      'Nella vista giornalisti i marcatori sono ora ordinati in ordine cronologico dalla marcatura più antica alla più recente, in tutti i punti in cui appaiono: card home, elenco partite, sezione marcatori del dettaglio partita, sezione autoreti. Chi ha segnato il primo gol della partita compare per primo. I giocatori il cui minuto non è stato inserito restano in fondo, ordinati per numero di gol come prima',
    ],
  },
  {
    version: '1.9.53',
    date: '2026-09-15',
    title: 'Minuti dei gol: si registrano nel referto e appaiono ai giornalisti',
    features: [
      'Nel referto post-gara, quando indichi che un giocatore ha segnato gol, autoreti o rigori, subito sotto compare un campo dove puoi scrivere i minuti delle marcature separati da virgola (es. "12, 45+2, 78"). Il formato "45+2" viene interpretato come 47\u00b0 minuto. I minuti si salvano insieme al referto e sono opzionali: se non li conosci puoi lasciare il campo vuoto e resta solo il conteggio dei gol come prima',
      'La vista giornalisti ora mostra i minuti in ogni punto in cui compaiono i marcatori: nella dashboard homepage sotto ogni card squadra ("Rossi 12\', 45+2\'"), nell\u2019elenco partite della squadra e nel dettaglio partita sotto il nome del marcatore. Se i minuti non sono stati inseriti resta il conteggio a moltiplicatore (es. "Rossi ×2")',
    ],
  },
  {
    version: '1.9.52',
    date: '2026-09-15',
    title: 'Vista giornalisti: marcatori visibili anche nell\u2019elenco partite e nelle card',
    features: [
      'I marcatori Lenci ora appaiono anche nelle liste, non solo nel dettaglio partita. Nella dashboard homepage, sotto il risultato dell\u2019ultima partita di ogni squadra, compare l\u2019elenco dei marcatori (es. "Rossi (2), Bianchi"). Stessa cosa nella lista partite dentro il dettaglio squadra: sotto ogni riga vedi subito chi ha segnato e quanti gol per giocatore. Così il giornalista ha il quadro dei marcatori a colpo d\u2019occhio senza dover aprire ogni partita',
    ],
  },
  {
    version: '1.9.51',
    date: '2026-09-15',
    title: 'Vista giornalisti: formazione ordinata per ruolo dal portiere in poi',
    features: [
      'Nella vista giornalisti la formazione titolare e la panchina vengono ora ordinate seguendo la logica del modulo tattico: dal portiere ai difensori (centrali e terzini), poi centrocampisti (mediani, interni, esterni, trequartista), poi ali e attaccanti. Se due giocatori hanno lo stesso ruolo l\u2019ordine è per numero di maglia; giocatori senza ruolo assegnato appaiono in fondo. Prima erano nell\u2019ordine grezzo del database',
    ],
  },
  {
    version: '1.9.50',
    date: '2026-09-15',
    title: 'Fix: pulsante "Subentrato" nel referto post-gara',
    features: [
      'Corretto il pulsante "Subentrato" che nel referto post-gara non si accendeva al tocco: ora premendolo il giocatore viene marcato come subentrato con minuto di ingresso 46 di default (inizio secondo tempo, valore modificabile subito sotto). Il flusso Titolare / Subentrato / Non entrato ora funziona come atteso',
    ],
  },
  {
    version: '1.9.49',
    date: '2026-09-15',
    title: 'Fix salvataggio referto + modulo tattico + dashboard giornalisti',
    features: [
      'Nella scheda partita del referto post-gara ora il modulo tattico si sceglie da un elenco standard (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 3-4-3 e molti altri incluse le formazioni ridotte a 7 e a 9 per Esordienti/Pulcini). Si può anche digitare liberamente. I ruoli giocati passano da 4 generici (Portiere/Difensore/Centrocampista/Attaccante) a 15 posizioni specifiche (Terzino destro/sinistro, Mediano, Interno, Trequartista, Ala, Punta centrale, Seconda punta e altri)',
      'La vista giornalisti ora mostra in cima al dettaglio partita il modulo scelto (badge azzurro sotto il risultato) e, per ogni titolare, il ruolo specifico assegnato — così i giornalisti hanno subito il quadro tattico corretto senza dover chiedere',
      'Nuova homepage giornalisti a card per squadra: al login l\u2019utente vede subito tutte le annate con quante partite sono pubblicate, la data dell\u2019ultima partita, l\u2019avversario e il risultato colorato. Le squadre con dati disponibili appaiono prima, quelle senza dati mostrano un placeholder chiaro',
    ],
    notes: [
      'Corretto un bug per cui il salvataggio del referto post-gara falliva con errore SQL "null value in column id violates not-null constraint": lo stato del referto conservava l\u2019UUID precedente delle statistiche e lo reinseriva dopo la cancellazione. Ora la INSERT lascia sempre generare l\u2019id al database, come previsto',
    ],
  },
  {
    version: '1.9.48',
    date: '2026-09-15',
    title: 'Vista giornalisti: dirigenti compilano il referto e flaggano la pubblicazione',
    features: [
      'I dirigenti (is_manager=true) ora hanno gli stessi permessi degli allenatori sulle proprie squadre: possono creare, modificare ed eliminare partite, compilare la convocazione (titolari e panchina), scrivere il referto post-gara con formazione, marcatori, ammonizioni, espulsioni, subentri e note arbitrali. Prima queste operazioni erano riservate ai soli coach; ora anche i team_manager/second_manager/third_manager della squadra possono compilarle',
      'Nel referto post-partita è comparso un nuovo interruttore "Pubblica su vista giornalisti". Quando attivo, la partita compare nell\u2019elenco letto dagli account giornalista con formazione titolare, panchina, marcatori, cartellini e subentri. Disattivo di default: la partita resta interna finché il dirigente non decide che il referto è pronto per la comunicazione esterna',
      'La vista giornalisti ora mostra solo le partite pubblicate: nessuna partita esce accidentalmente prima che il dirigente ne dia il via libera',
    ],
    notes: [
      'Account di test creato: giornalista@matchos.it (password provvisoria: LenciGiornalista2026!). Fare login per verificare come i giornalisti vedono l\u2019app',
    ],
  },
  {
    version: '1.9.47',
    date: '2026-09-15',
    title: 'Vista Giornalisti: distinte, risultati e marcatori',
    features: [
      'Nuovo tipo di account "Giornalista" pensato per i giornalisti locali che chiedono distinte e risultati partite. Un account con questo permesso entra in una vista dedicata (menu ridotto) dove vede: selettore squadra, elenco partite giocate della squadra scelta con risultato ordinate dalla più recente, e tap sulla singola partita apre il dettaglio con formazione titolare, panchina e subentrati, marcatori con numero rigori, autoreti, cartellini gialli e rossi',
      'Il giornalista NON ha accesso a dashboard, calendario, comunicazioni, comunicati LND, gestione squadre o giocatori: la sua vista è completamente separata e read-only sui soli dati partita non sensibili. I dati anagrafici privati (email, telefono, data di nascita, medico) restano protetti dalle policy database, non vengono mai serviti a questi account',
    ],
    notes: [
      'Per creare un account giornalista: l\u2019admin registra l\u2019utente come normale, poi imposta il flag is_journalist=true sul suo profilo. Le policy Supabase filtrano automaticamente cosa può leggere. Prossimo passo: gestione visuale del flag direttamente dallo staff sheet',
    ],
  },
  {
    version: '1.9.46',
    date: '2026-09-15',
    title: 'Fix: dirigenti vedono nel planner solo la loro annata',
    features: [
      'Corretto un bug per cui il dirigente di una squadra (per esempio Pulcini 2016) apriva il Planner settimanale e vedeva un mix di impegni delle annate vicine (2016 + 2017) invece della sola sua squadra. Ora il planner rispetta sempre la squadra di appartenenza del dirigente/allenatore, come già faceva il filtro calendario',
    ],
    notes: [
      'Il baco era duplice: da un lato il selettore automatico della squadra riconosceva solo gli allenatori (role=coach) e non i dirigenti (is_manager=true); dall\u2019altro il planner riceveva il filtro manuale invece dell\u2019id di squadra effettivo. Entrambi corretti in questa release',
    ],
  },
  {
    version: '1.9.45',
    date: '2026-09-15',
    title: 'Nella scheda partita ora vedi le risposte dei ragazzi dalla landing presenze',
    features: [
      'Aprendo la scheda partita (dal calendario) il coach ora vede in cima una nuova card "Disponibilità dai ragazzi" con 4 KPI cliccabili: quanti Vengono / Forse / Non vengono / Non hanno risposto. Cliccando su un KPI si espande l\u2019elenco dei nomi in quello stato — così hai subito il quadro di chi ha risposto sulla landing pubblica presenze prima di procedere con la convocazione',
      'Le risposte inline accanto al singolo giocatore restano visibili come prima; la card in cima aggiunge la vista aggregata che mancava, in stile simile alla card presenze degli allenamenti',
    ],
    notes: [
      'Se nessuno ha ancora risposto compare un promemoria che invita a condividere il link della landing pubblica sul gruppo WhatsApp della squadra (il link si copia comodamente da Modifica squadra → Landing pubblica presenze)',
    ],
  },
  {
    version: '1.9.44',
    date: '2026-09-15',
    title: 'Link landing pubblica presenze in evidenza nelle preferenze squadra',
    features: [
      'Quando in Modifica squadra si attiva il flag "Landing pubblica presenze", ora appare subito sotto un pannello dedicato con l\u2019URL della landing pubblica (lenci-poirino-presenze.netlify.app) e tre pulsanti pronti all\u2019uso: Apri (verifica visiva), Copia (mette il link negli appunti) e WhatsApp (apre la condivisione con un messaggio già scritto per il gruppo squadra). Così il coach ha sempre a portata di mano il link da condividere sul gruppo genitori — nessun ricordo da tenere a mente',
      'Il messaggio WhatsApp pre-compilato contiene già il nome della squadra e le istruzioni per genitori/ragazzi: come selezionare il proprio nome con il tasto "Cambia" e rispondere Vengo / Non vengo / Forse per ogni impegno',
    ],
    notes: [
      'La landing pubblica è un\u2019app separata dal Lenci LAB (repository dedicato) che condivide lo stesso database Supabase: le risposte finiscono direttamente nel calendario della squadra e i coach le vedono aggregate',
    ],
  },
  {
    version: '1.9.43',
    date: '2026-09-11',
    title: 'KPI partite cliccabili: apre il dettaglio con marcatori',
    features: [
      'Nella pagina squadra, i 3 KPI risultato (Vinte, Pareggi, Perse) sono ora cliccabili. Al tap si apre l\u2019elenco delle sole partite con quell\u2019esito, ordinate dalla più recente, con avversario, casa/trasferta, competizione, data, risultato finale e la lista dei nostri marcatori con conteggio gol (es. "Rossi (2), Bianchi") — così hai il dettaglio completo di come ogni partita è andata',
      'Da ogni riga puoi entrare direttamente nel report tattico della partita per rivedere formazione, minutaggi e gol dettagliati',
    ],
    notes: [
      'La lista marcatori è aggregata dai referti partita compilati e mostra i cognomi in ordine di gol totali; l\u2019indicatore "Report da compilare" segnala le partite dove manca ancora il post-match',
    ],
  },
  {
    version: '1.9.42',
    date: '2026-09-11',
    title: 'Nuova pagina squadre con statistiche in evidenza',
    features: [
      'La pagina di ogni squadra è stata completamente ripensata. Ora la vista principale mostra a colpo d\u2019occhio le statistiche della squadra: KPI riepilogativi (partite Giocate / Vinte / Pareggi / Perse) e tre classifiche podio Top 3: marcatori, ammoniti ed espulsi. Tutto aggregato automaticamente dai referti partita compilati',
      'La lista dei giocatori (rosa completa con ricerca, filtri per posizione e tutte le funzionalità di gestione) è ora accessibile tramite il nuovo pulsante blu "Rosa" in cima alla pagina — accanto ai già presenti Presenze e Storico. Un tocco per passare dalla vista statistiche alla vista rosa e viceversa',
    ],
    notes: [
      'Le classifiche mostrano solo giocatori che hanno effettivamente registrato quel tipo di dato (gol, ammonizione, espulsione) nei referti partita — se nessuno rientra, appare "Nessun dato registrato". I KPI partite considerano solo le partite con risultato inserito',
    ],
  },
  {
    version: '1.9.41',
    date: '2026-09-11',
    title: 'Top 3 marcatori nella pagina squadra',
    features: [
      'Nella pagina di ogni squadra, subito sotto il riepilogo (categoria e numero tesserati), è ora visibile la card "Top marcatori squadra" con la classifica dei primi 3 giocatori per gol totali (azione + rigore). Podio con medaglie oro, argento e bronzo, breakdown dettagliato "X su azione · Y su rigore" per capire come ha segnato ognuno. Aggregata automaticamente dai referti partita compilati, si aggiorna man mano che i coach registrano i tabellini',
    ],
    notes: [
      'La card compare solo se almeno un giocatore ha segnato — se la squadra non ha ancora referti compilati o nessuno ha ancora segnato, la card resta nascosta',
    ],
  },
  {
    version: '1.9.40',
    date: '2026-09-11',
    title: 'Ripristino dello storico delle release',
    notes: [
      'Nelle 10 release precedenti (dalla 1.9.30 alla 1.9.39) il changelog non era stato aggiornato. Ora sotto trovi tutte le entry ricostruite: fix di editing dei form, nuova gestione staff con 7 ruoli, distinte miste, PDF distinta più leggero, planner settimanale ottimizzato e altro',
    ],
  },
  {
    version: '1.9.39',
    date: '2026-09-11',
    title: 'Distinte miste: convoca giocatori da altre categorie',
    features: [
      'Nella scheda Convocazione, nell\u2019header dei controlli (accanto a "Convoca tutti" e "Azzera"), c\u2019è ora un nuovo bottone viola "Da altra categoria" con icona persona+. Cliccandolo si apre un picker per selezionare giocatori dalle altre squadre della società — utile per distinte miste della scuola calcio dove si accorpano annate diverse (es. torneo Piccoli Amici con giocatori 2020 + 2021, o Primi Calci con qualche ospite da annata attigua)',
      'Il picker mostra i giocatori raggruppati per categoria di provenienza con ricerca live per nome/cognome/categoria e selezione multipla. Alla conferma i giocatori scelti vengono aggiunti alla lista principale con un badge viola "↕ Nome Squadra" accanto al nome e impostati automaticamente come convocati',
      'I giocatori "prestati" vengono trattati normalmente nella distinta FIGC e nella locandina WhatsApp (tessera, codice fiscale, data nascita presi dal loro record originale). Alla riapertura della convocazione, i prestati vengono ricaricati automaticamente con il loro badge — non si perdono tra un salvataggio e l\u2019altro',
    ],
    notes: [
      'Nessuna migrazione dati richiesta: sfrutta la struttura esistente delle convocazioni',
    ],
  },
  {
    version: '1.9.38',
    date: '2026-09-11',
    title: 'PDF distinta FIGC molto più leggero',
    fixes: [
      'Il PDF della distinta di gara pesava 1-3 MB per un semplice foglio A4 di 1 pagina con la lista giocatori — troppo per essere condiviso via WhatsApp o email senza compressione manuale. Ora l\u2019output pesa tipicamente 150-300 KB (fino a 10 volte più leggero) senza alcuna perdita di qualità visiva: logo, testo vettoriale e bordi tabelle restano identici a prima',
    ],
    notes: [
      'Sono state ottimizzate tre cose in cascata: attivata compressione deflate nativa del PDF, ridotta la risoluzione del logo mascherato circolarmente (bastano 256px per il rettangolo di 16mm dell\u2019header), aggiunta compressione anche sull\u2019immagine embeddata',
    ],
  },
  {
    version: '1.9.37',
    date: '2026-09-11',
    title: 'Locandina convocazioni: nome squadra specifico',
    fixes: [
      'Nella locandina di convocazione, sotto il titolo "CONVOCAZIONI", appariva la categoria generica ("ESORDIENTI") invece del nome specifico della squadra ("ESORDIENTI 2015"). Utile distinguere quando ci sono più squadre nella stessa categoria di età',
    ],
  },
  {
    version: '1.9.36',
    date: '2026-09-11',
    title: 'Planner settimanale: categoria grande come titolo',
    features: [
      'Nella locandina del planner settimanale, il nome della categoria (es. "PULCINI 2017") sotto "PLANNER SETTIMANALE" è ora rosso brand e grande come le altre righe del titolo, non più un sottotitolo piccolo che si perdeva sullo sfondo blu. Auto-shrink automatico per i nomi più lunghi (es. "PICCOLI AMICI 2020-21")',
    ],
  },
  {
    version: '1.9.35',
    date: '2026-09-11',
    title: 'Planner settimanale: categoria in rosso',
    features: [
      'Nella locandina del planner settimanale, il nome della categoria sotto "PLANNER SETTIMANALE" ora è colorato in rosso brand per farlo risaltare (prima era biancastro trasparente, difficile da leggere)',
    ],
  },
  {
    version: '1.9.34',
    date: '2026-09-10',
    title: 'Fix indirizzo campo partita che spariva',
    fixes: [
      'Quando si modificava una partita e si inseriva l\u2019indirizzo campo nel campo "Indirizzo campo (per locandine)", riaprendo la partita l\u2019indirizzo appariva vuoto anche se era stato salvato. Ora la modifica di ogni partita ricarica sempre tutti i campi aggiornati dal database, senza rischio che scompaiano informazioni recenti',
    ],
    notes: [
      'Il bug riguardava solo la visualizzazione: le informazioni erano correttamente salvate nel database — mancava solo la loro rilettura al riapertura del form',
    ],
  },
  {
    version: '1.9.33',
    date: '2026-09-10',
    title: 'Gestione staff: mostra squadre con ruolo specifico',
    features: [
      'Nella lista di Gestione staff, ogni persona ora mostra tutte le squadre dove è assegnata insieme al ruolo esatto: per esempio "Esordienti 2014 (Vice) · Esordienti 2015 (Aiuto)". Prima venivano mostrate solo le squadre dove la persona era allenatore principale o dirigente accompagnatore principale, ignorando vice/aiuto/secondo/terzo dirigente — che restavano invisibili in lista dando l\u2019impressione che la persona non fosse assegnata',
    ],
  },
  {
    version: '1.9.32',
    date: '2026-09-10',
    title: 'Fix modifiche che si perdevano durante l\u2019editing',
    fixes: [
      'Nei form di modifica partita e modifica squadra, i valori che l\u2019utente stava digitando venivano a volte silenziosamente sovrascritti con i valori originali durante l\u2019editing (era sufficiente che il sistema aggiornasse i dati in background). Ora i valori inseriti restano stabili fino al salvataggio esplicito',
    ],
    notes: [
      'Questo bug era la causa principale delle "modifiche che non vengono salvate" segnalate su assegnazioni squadre, indirizzo partita e altri campi',
    ],
  },
  {
    version: '1.9.31',
    date: '2026-09-09',
    title: 'Gestione staff: 7 ruoli + avviso sovrascritture',
    features: [
      'Nel foglio di modifica di un membro dello staff, il menu di ogni squadra è passato da 3 a 7 opzioni: Non assegnato / Allenatore / Vice allenatore / Aiuto allenatore / Dirigente accompagnatore / 2° Dirigente / 3° Dirigente. Prima si poteva assegnare solo Allenatore o Dirigente principale, gli altri ruoli intermedi passavano solo dal foglio "Modifica squadra" creando confusione',
      'Se stai per assegnare una persona a un ruolo dove c\u2019è già qualcun altro, compare un banner giallo con conferma esplicita: "Attenzione: Emanuele Cordero prenderà il posto di Alessandro Altavilla come Allenatore di Esordienti 2014". Solo dopo il "Sì, sostituisci" la modifica viene applicata',
      'Il menu ora mostra sempre il ruolo REALE della persona sulla squadra: se sei Vice, vedi "Vice allenatore" e non più "Non assegnato" che era fuorviante',
      'Se cambi ruolo (es. da Vice ad Allenatore) il sistema azzera automaticamente lo slot vecchio, evitando i duplicati (stessa persona head + assistant) che potevano verificarsi prima',
    ],
  },
  {
    version: '1.9.30',
    date: '2026-09-09',
    title: 'Messaggi di errore chiari se manca il permesso',
    fixes: [
      'Quando modifichi una squadra o le assegnazioni staff, se non hai il permesso di salvare (perché mister non assegnato a quella categoria, o altre restrizioni) ora compare un messaggio di errore visibile: "Non hai i permessi per modificare questa squadra". Prima il salvataggio sembrava andare a buon fine ma le modifiche restavano invisibili nel database, generando confusione ("il tasto Salva non fa nulla")',
    ],
    notes: [
      'Consolidamento di alcuni account duplicati con lo stesso nome ma email diverse, per evitare situazioni ambigue di questo tipo',
    ],
  },
  {
    version: '1.9.29',
    date: '2026-09-05',
    title: 'Gol in scheda giocatore + terzo dirigente per squadra',
    features: [
      'Nella scheda personale di ogni giocatore ora è visibile la sezione "Gol stagione": totale marcature (gol su azione + gol su rigore) in evidenza, elenco delle partite in cui ha segnato con data, avversario, risultato finale, quanti gol e quanti su rigore. Dati aggregati automaticamente dai referti partita, nessun inserimento manuale richiesto',
      'Terzo slot dirigenziale sulle squadre: da "Modifica squadra" è ora possibile assegnare fino a 3 dirigenti accompagnatori (prima solo 2). Il terzo dirigente ha gli stessi permessi operativi degli altri due: accesso completo a gestione squadra, calendario, presenze, valutazioni. Compare correttamente in convocazione e distinta FIGC come "Terzo Dirigente Accompagnatore"',
    ],
    notes: [
      'La sezione Gol appare solo se il giocatore ha almeno una marcatura registrata in un referto partita — altrimenti mostra "Nessun gol registrato"',
    ],
  },
  {
    version: '1.9.28',
    date: '2026-09-04',
    title: 'Locandina convocazioni — fino a 30 giocatori (Prima Squadra)',
    features: [
      'La locandina WhatsApp ora accetta fino a 30 convocati (prima il limite era 20, sufficiente per giovanili ma stretto per la Prima Squadra che spesso convoca 22-28 giocatori tra portieri, difensori, centrocampisti e attaccanti)',
      'Layout adattivo: fino a 22 giocatori la griglia resta a 2 colonne come prima, da 23 in su passa automaticamente a 3 colonne con dimensioni del chevron numero e del font leggermente ridotte per stare comodi nel formato quadrato',
      'Auto-fit del nome giocatore migliorato: si adatta alla larghezza della colonna riducendo il font se serve (utile con cognomi lunghi in modalità 3 colonne)',
    ],
    notes: [
      'Nessun cambiamento richiesto lato utente: basta convocare i giocatori normalmente dalla scheda convocazione, la locandina si adatta',
    ],
  },
  {
    version: '1.9.27',
    date: '2026-09-04',
    title: 'Locandina convocazioni — orario di ritrovo personalizzabile',
    features: [
      'Nella scheda convocazione, sopra il bottone verde "Genera locandina per WhatsApp", trovi ora un campo "Orario ritrovo · locandina": se lo lasci vuoto viene calcolato in automatico come 1 ora prima del calcio d\u2019inizio (come prima), se invece scrivi un orario diverso (es. 15:30) sarà quello a comparire nella locandina',
      'Il campo è precompilato con l\u2019orario automatico solo come hint sotto l\u2019input; per usare l\u2019automatico basta lasciarlo vuoto, per tornare all\u2019automatico dopo aver inserito un valore c\u2019è il pulsante "Usa automatico" a fianco',
    ],
    notes: [
      'Modifica utile per trasferte lontane (ritrovo 2h prima) o partite molto vicine (ritrovo 30 min prima)',
    ],
  },
  {
    version: '1.9.26',
    date: '2026-09-04',
    title: 'Schede tecniche — modifica ed elimina valutazioni esistenti',
    features: [
      'Ora puoi modificare una valutazione già salvata: nella scheda tecnica di ogni giocatore, accanto a ciascuna valutazione trovi due bottoni — la matita blu per aprire il form pre-compilato con i valori attuali e correggerli/completarli, il cestino rosso per eliminarla del tutto (con conferma)',
      'Le valutazioni salvate senza punteggi (solo altezza/peso/scarpa) sono ora evidenziate con un bordo tratteggiato arancione e un avviso "Valutazione senza punteggi — clicca Modifica per compilarla", così si vede subito quali sono da completare',
    ],
    fixes: [
      'Prima chi creava una valutazione senza compilare i box Tecnica/Fisica/Tattica non aveva modo di tornarci sopra: bisognava crearne una nuova o cancellare quella vecchia dal database. Ora il flusso è naturale.',
    ],
  },
  {
    version: '1.9.25',
    date: '2026-09-04',
    title: 'Comunicati LND — ordine cronologico + evidenza "Lenci"',
    features: [
      'I rilievi sono ora ordinati dal comunicato più recente al più vecchio; a parità di data, quello con scadenza più vicina compare per primo',
      'Ogni volta che nel testo (rilievi, comunicati) compare "Lenci" o "Lenci Poirino" è evidenziato con sfondo giallo e in grassetto — così individui subito le comunicazioni che ti riguardano davvero senza dover leggere ogni singolo rilievo',
    ],
  },
  {
    version: '1.9.24',
    date: '2026-09-04',
    title: 'Nel calendario si vede a colpo d\'occhio casa/trasferta',
    features: [
      'Ogni partita nel calendario ha ora una banda colorata verticale sul lato sinistro: verde = casa, arancione = trasferta',
      'Aggiunta anche una pill in alto con icona 🏠 "CASA" (verde) oppure 🚗 "TRASFERTA" (arancione) per chi vuole conferma esplicita',
      'La doppia indicazione (bordo + pill) permette di riconoscere il tipo di partita anche scorrendo velocemente il calendario, senza dover leggere il titolo',
    ],
  },
  {
    version: '1.9.23',
    date: '2026-09-04',
    title: 'Tag allegati con autosalvataggio + nuove categorie',
    fixes: [
      'Risolto bug: i tag messi dai tecnici sugli allegati degli allenamenti non venivano salvati se si chiudeva l\'editor senza cliccare "Salva". Ora ogni modifica al tag viene salvata istantaneamente — non c\'è più bisogno di cliccare alcun pulsante di salvataggio',
    ],
    features: [
      'Nuova categoria "Condizionali" con 5 tag: Forza, Resistenza, Velocità, Prontezza dei riflessi, Coordinazione (chip arancione)',
      'Nuova categoria "Tecnici" con 6 tag: Colpire la palla, Ricevere la palla, Conduzione, Colpo di testa, Contrasto, Rimessa laterale (chip verde)',
      'L\'editor tag ora ha 4 sezioni collassabili invece di 2: Principi di gioco / Sotto principi / Condizionali / Tecnici',
      'I tag visualizzati sugli allegati sono colorati per categoria: blu (principi) · viola (sotto principi) · arancione (condizionali) · verde (tecnici) · grigio (personalizzati)',
    ],
  },
  {
    version: '1.9.22',
    date: '2026-09-03',
    title: 'Curve WHO Growth Reference per il BMI',
    features: [
      'Il BMI ora è affiancato da una classificazione secondo la WHO Growth Reference 2007 (curve BMI-for-age per bambini e adolescenti da 5 a 19 anni)',
      'La classificazione tiene conto di età (in mesi) e sesso del giocatore — più accurata delle soglie da adulto usate nella versione precedente',
      'Etichette neutre: "Nella norma / Sopra la norma / Molto sopra / Magrezza / Magrezza grave" — evitiamo termini clinici allarmistici come "obeso" o "sottopeso"',
      'Mostrato lo z-score approssimato (deviazioni standard rispetto alla mediana della popolazione WHO)',
      'Per atleti ≥ 19 anni si applicano le soglie WHO adulto (18.5 / 25 / 30) con un caveat che negli sportivi la composizione corporea è meglio valutata con altri metodi',
    ],
    notes: [
      'Il campo "Sesso" è stato aggiunto ai giocatori: tutti impostati a "M" di default (contesto del club). Se in futuro apriremo squadre femminili, va cambiato per applicare le curve corrette (differenti in adolescenza)',
      'Ogni classificazione include il caveat: "Il singolo dato non fa diagnosi: per valutazioni cliniche affidati sempre a pediatra o medico sportivo"',
    ],
  },
  {
    version: '1.9.21',
    date: '2026-09-03',
    title: 'BMI calcolato in automatico nella scheda giocatore',
    features: [
      'Accanto ad altezza e peso di ogni giocatore ora compare il BMI (Body Mass Index) calcolato in automatico',
      'Nel form di valutazione fisica: box blu che aggiorna il BMI in tempo reale mentre digiti peso e altezza',
      'Nella scheda giocatore in alto: BMI visibile subito accanto ad altezza, peso e scarpa (se entrambi i dati sono presenti)',
      'Nello storico valutazioni: BMI incluso in ogni riga per vedere l\'andamento nel tempo',
    ],
    notes: [
      'Il BMI è mostrato come valore numerico puro. Per gli atleti in età evolutiva è più utile seguirne l\'andamento nel tempo che confrontarlo con soglie da adulto — quindi non abbiamo aggiunto etichette tipo "normopeso/sovrappeso" che potrebbero essere fuorvianti',
    ],
  },
  {
    version: '1.9.20',
    date: '2026-09-02',
    title: 'Allenatore in seconda e aiuto allenatore con permission piene',
    features: [
      'Chi è allenatore in seconda, aiuto allenatore o secondo dirigente accompagnatore di una squadra ha ora le stesse permission del mister ufficiale: vede la squadra, il calendario, il roster, gli allenamenti, le partite, i report, e può registrare presenze o modificare eventi come se fosse l\'allenatore principale',
      'Il menu di navigazione si sblocca automaticamente anche per chi ha uno di questi ruoli — prima solo head coach e dirigente accompagnatore ottenevano il menu completo',
    ],
    notes: [
      'Guardalinee di casa e Massaggiatore restano invece ruoli laterali senza accesso in scrittura al roster o allenamenti (compaiono solo in distinta FIGC e nel registro presenze staff)',
    ],
  },
  {
    version: '1.9.19',
    date: '2026-09-02',
    title: 'Panoramica staff · modifica diretta dalla dashboard',
    features: [
      'Ogni riga della "Panoramica staff" ora è cliccabile. Un tap sul nome di un allenatore apre lo storico dettagliato dei suoi eventi con la possibilità di correggere le presenze direttamente da lì, senza aprire calendario o registri',
      'Il tap ciclico su ogni evento passa lo stato tra Non firmata → Presente → Assente → In ritardo → Giustif. → Non firmata (per rimuovere una registrazione errata)',
      'Cliccando invece una riga della vista Navetta si apre il registro dell\'autista: si possono aggiungere servizi passati o rimuoverli con un tap, utile per correggere dimenticanze',
      'I contatori della card principale si aggiornano in tempo reale dopo ogni modifica',
    ],
  },
  {
    version: '1.9.18',
    date: '2026-09-02',
    title: 'Panoramica staff visibile anche ai direttori',
    fixes: [
      'La card "Panoramica staff" (introdotta in v1.9.17) ora è visibile anche a chi è admin + direttore contemporaneamente (es. Luca Palermo, Mattia Pani, Stefano Barbero, Direttore Tecnico). Prima appariva solo agli admin puri perché in dashboard veniva mostrata la vista da direttore invece che quella da admin',
    ],
  },
  {
    version: '1.9.17',
    date: '2026-09-02',
    title: 'Panoramica staff nella dashboard admin',
    features: [
      'Nuova card "Panoramica staff · solo admin" nella dashboard degli amministratori (Luca Palermo, Andrea Caratto, ecc.)',
      'Tre viste selezionabili con un tap: Allenamenti / Partite / Navetta',
      'Vista Allenamenti e Partite: elenco ordinato per % presenza (dal più presente al meno), con % grande semaforo colorata (verde ≥ 80, giallo ≥ 60, rosso < 60) e pill dettaglio Presente/Ritardo/Giustificate/Assenze/Non firmate',
      'Vista Navetta: elenco autisti con contatore mese corrente + totale e data ultimo servizio',
      'Dati calcolati server-side con permessi verificati (solo admin e direttori possono chiamare le funzioni di riepilogo)',
    ],
  },
  {
    version: '1.9.16',
    date: '2026-09-02',
    title: 'Servizio navetta per gli allenatori-autisti',
    features: [
      'Nuova card blu "Servizio navetta" nella dashboard degli allenatori designati come autisti (attualmente Lorenzo Moschini e Alessandro Raineri)',
      'Un tap sul bottone arancione "Segna servizio di oggi" registra il viaggio; contatori mese corrente + totale sempre visibili',
      'Sheet "Vedi storico e aggiungi date passate" per registrare servizi svolti prima (utile per recuperare arretrati) o rimuovere errori',
      'Un autista può registrare al massimo un servizio per giorno (vincolo DB); admin e direttori vedono i totali di tutti gli autisti per contabilizzare',
    ],
    notes: [
      'La card compare solo per chi ha il flag "autista navetta" attivo sul profilo — per aggiungere nuovi autisti fammi sapere',
    ],
  },
  {
    version: '1.9.15',
    date: '2026-09-02',
    title: 'Report gara — minutaggio corretto per i subentrati dalla panchina',
    fixes: [
      'Nel referto post-gara ora si può indicare correttamente il minuto d\'ingresso di un giocatore che parte dalla panchina e subentra a partita in corso',
    ],
    features: [
      'Nuovo selettore a 3 stati per ogni giocatore: Titolare / Subentrato / Non entrato (prima erano solo Ha giocato / Panchina, con il minuto d\'ingresso forzato a 0)',
      'Se scegli "Subentrato" il campo "Min ingresso" resta vuoto e si aspetta che tu digiti il vero minuto d\'ingresso (es. 60)',
      'Il riepilogo di ogni giocatore ora mostra "Titolare" o "Subentrato al 60\'" invece del generico "In campo"',
      'La statistica di minutaggio ora è finalmente coerente: prima i subentrati risultavano come titolari con ingresso al minuto 0',
    ],
  },
  {
    version: '1.9.14',
    date: '2026-09-02',
    title: 'Presenze staff ad allenamenti e partite',
    features: [
      'Ora si possono registrare le presenze anche di mister, dirigenti, massaggiatore e guardalinee — non solo dei giocatori',
      'Nel foglio presenze dell\'allenamento compare la nuova sezione "Presenze staff" con tutti i membri dello staff della squadra: un tocco cambia lo stato (Presente → Assente → In ritardo → Giustificato)',
      'Stessa sezione anche nel referto post-gara per registrare chi era effettivamente in panchina',
      'Nel proprio Profilo, gli allenatori e i dirigenti vedono la card "Le mie presenze" con statistiche separate per allenamenti e partite: percentuale grande + dettaglio Presente/In ritardo/Giustificato/Assente',
    ],
    notes: [
      'Le presenze staff sono modificabili da chiunque sia allenatore o dirigente della squadra (oltre ad admin e direttori). Ogni persona vede sempre le proprie',
      'La card "Le mie presenze" compare solo se il profilo ha almeno un evento tracciato come staff — genitori e atleti non la vedono',
    ],
  },
  {
    version: '1.9.13',
    date: '2026-09-02',
    title: 'Staff squadra esteso — allenatore in seconda, guardalinee, massaggiatore',
    features: [
      'Nella scheda squadra ora si possono assegnare 5 nuovi ruoli oltre ad Allenatore e Dirigente accompagnatore',
      'Staff tecnico: Allenatore in seconda, Aiuto allenatore',
      'Staff dirigenziale e sanitario: Secondo dirigente accompagnatore, Guardalinee di casa, Massaggiatore/sanitario',
      'Tutti i ruoli compilati compaiono automaticamente nella sezione staff della distinta FIGC generata prima della partita, nell\'ordine gerarchico corretto',
      'L\'elenco delle persone assegnabili include admin, coach e direttori (per coprire massaggiatori e dirigenti anche se non sono coach)',
    ],
    notes: [
      'Solo admin e direttori possono modificare la scheda squadra e assegnare questi ruoli',
    ],
  },
  {
    version: '1.9.12',
    date: '2026-09-01',
    title: 'Notifiche push ripristinate',
    fixes: [
      'Sistemate le chiavi crittografiche per l\'invio delle notifiche push (erano orfane, senza la chiave privata corrispondente sul server)',
      'Ripristinato l\'invio push per ogni nuova notifica generata dall\'app',
    ],
    features: [
      'Notifica automatica a tutti gli utenti destinatari quando viene pubblicato un nuovo annuncio in Bacheca',
      'Notifica automatica a tutto lo staff quando arriva un nuovo Comunicato LND',
    ],
    notes: [
      'Chi aveva già attivato le notifiche prima di oggi dovrà accettarle di nuovo al primo accesso dopo l\'aggiornamento (verrà chiesto automaticamente dal banner)',
    ],
  },
  {
    version: '1.9.11',
    date: '2026-09-01',
    title: 'Tag allegati allineati ai principi di gioco',
    features: [
      'I tag degli allegati ora usano gli stessi Principi e Sotto principi di gioco della metodologia societaria (gli stessi che scegli quando componi una seduta)',
      'Editor tag riorganizzato in due sezioni collassabili: "Principi di gioco" (blu, 15 voci) e "Sotto principi" (viola, 14 voci)',
      'Puoi comunque scrivere tag personalizzati liberi (grigio scuro)',
      'Le chip dei tag hanno colori distintivi per tipo: azzurro=principio, rosa=sotto principio, grigio=custom — a colpo d\'occhio riconosci la categoria',
      'Ricerca istantanea: digitando nel campo si filtrano insieme sia i principi sia i sotto principi',
    ],
    notes: [
      'I tag già inseriti in precedenza restano invariati. Se coincidono con un principio ufficiale vengono automaticamente colorati come tali; altrimenti compaiono come tag personalizzati',
    ],
  },
  {
    version: '1.9.10',
    date: '2026-09-01',
    title: 'Correzione etichette statistiche presenze',
    fixes: [
      'Nelle statistiche presenze del giocatore le pill ora usano il sostantivo corretto: "6 Presenze" invece di "6 Presenti", "2 Assenze" invece di "2 Assenti", "1 Giustificate" invece di "1 Giustificati"',
    ],
  },
  {
    version: '1.9.9',
    date: '2026-09-01',
    title: 'Tag sugli allegati per riconoscere il contenuto',
    features: [
      'Ora puoi aggiungere tag descrittivi a ogni allegato (foto o PDF) per riconoscere al volo cosa contiene',
      'Suggerimenti preimpostati per i tag più comuni: "schema tattico", "lavagna", "campetto", "1v1", "possesso palla", "situazionale", "partitella", "analisi video" e altri 8',
      'Puoi scrivere tag personalizzati liberamente: basta digitare e premere Invio o virgola',
      'Backspace su input vuoto rimuove l\'ultimo tag inserito, per correzioni rapide',
      'Sotto ogni allegato le pill dei tag sono ben visibili anche a genitori e atleti (in sola lettura)',
    ],
  },
  {
    version: '1.9.8',
    date: '2026-09-01',
    title: 'Allegati (foto + PDF) sulle sessioni di allenamento',
    features: [
      'Ora gli allenatori possono caricare foto e PDF nelle sessioni di allenamento: schemi lavagna, campetti, PDF di riferimento dal preparatore, tutto in un posto',
      'Tre bottoni dedicati: "Foto da galleria", "Scatta foto" e "PDF"',
      'Anteprima immagini con lightbox a tutto schermo, PDF apribile in nuova scheda',
      'Le foto e i PDF sono visibili anche a genitori e atleti della squadra quando aprono "Vedi programma seduta"',
      'Limite 15 MB per file, storage privato con accesso protetto per club',
    ],
    notes: [
      'Per caricare allegati devi prima salvare l\'allenamento, poi riaprirlo dal calendario e usare la nuova sezione "Allegati"',
    ],
  },
  {
    version: '1.9.7',
    date: '2026-09-01',
    title: 'Nuovi allenatori + gestione "in attesa di squadra"',
    features: [
      'Creati 4 nuovi profili allenatore: Emanuele Cordero, Alessandro Raineri, Lorenzo Moschini, Walter Moschini (password standard società)',
      'Dashboard "In attesa di assegnazione squadra" per gli allenatori nuovi che non hanno ancora una squadra: card arancione evidente con spiegazione e indicazione di contattare un amministratore',
      'Menu semplificato per gli allenatori senza squadra: vedono solo Dashboard e Profilo finché non vengono assegnati',
      'Guard sulle route: se un allenatore senza squadra digita un URL diretto (es. /teams o /calendario) viene rimandato alla dashboard',
    ],
    notes: [
      'Solo gli amministratori (attualmente Luca Palermo, Andrea Caratto, Christian Trovato, Davide Mantovani, Enzo Paoletti, Mattia Pani, Stefano Barbero, Francesco Spada) possono assegnare una squadra a un allenatore, dalle Impostazioni squadra',
    ],
  },
  {
    version: '1.9.6',
    date: '2026-08-31',
    title: 'Numero di scarpa nelle valutazioni',
    features: [
      'Nella scheda tecnica del giocatore (accanto ad altezza e peso) puoi ora inserire il numero di scarpa EU (supporta mezze taglie tipo 41.5)',
      'Il numero di scarpa viene tracciato anche nello storico valutazioni, così vedi la crescita del piede nel tempo — utile per gestione materiale sportivo (scarpini, calzari portiere, parastinchi)',
    ],
  },
  {
    version: '1.9.5',
    date: '2026-08-31',
    title: 'Foto profilo: scelta tra galleria e fotocamera',
    features: [
      'Nel caricamento foto profilo (utenti, giocatori) ora puoi scegliere se caricarla dalla galleria del telefono o scattarla al momento con la fotocamera',
      'Due bottoni chiari: "Da galleria" (blu pieno) e "Scatta foto" (bianco con bordo blu)',
    ],
  },
  {
    version: '1.9.4',
    date: '2026-08-31',
    title: 'Fix orari partite in dashboard',
    fixes: [
      'Nella Dashboard gli orari delle partite ora vengono mostrati correttamente in ora italiana (es. Under 14 vs Barracuda alle 18:00 non appare più come 16:00)',
      'Fix esteso anche a Dashboard direttivo e Dashboard dirigente accompagnatore',
    ],
  },
  {
    version: '1.9.3',
    date: '2026-08-31',
    title: 'Fix punteggi partite passate',
    fixes: [
      'Nella lista "Partite passate" non compare più il falso "0–0" quando il report della partita non è stato ancora salvato',
      'Se hai già inserito i marcatori nel report ma non lo hai ancora salvato, la card mostra un\'anteprima arancione tipo "3–?" per farti capire che ci sono gol registrati in bozza',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-08-31',
    title: 'Divise casa/trasferta + gol auto nel match report',
    features: [
      'Nelle Impostazioni squadra (ingranaggio in alto) ora si configurano DUE divise: Casa e Trasferta, ognuna con maglia giocatori e maglia portiere',
      'In fase di convocazione la divisa viene precompilata automaticamente in base al fatto che la partita sia in casa o in trasferta',
      'Nella schermata convocazione trovi tre pill per cambio rapido: Casa, Trasferta o Personalizzata (se modifichi manualmente i colori)',
      'Nel Match Report, quando aggiungi un gol a un giocatore, il punteggio "nostro" si aggiorna in automatico con la somma dei marcatori',
      'Se preferisci inserire il punteggio a mano puoi farlo — un badge indica se il valore è sincronizzato o manuale, con bottone "Usa somma" per riallineare',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-08-31',
    title: 'L\'app diventa "Lenci LAB"',
    features: [
      'Nuovo brand ufficiale per l\'app: "Lenci LAB · Dati, Analisi, Crescita"',
      'Nuovo logo con banner LENCI LAB in tutte le schermate dell\'app, favicon, icona home screen e splash',
      'Il logo classico ASD Lenci Poirino resta invariato su distinta FIGC, locandine convocazione e planner settimanale (documenti ufficiali società)',
      'Nome app aggiornato in "Lenci LAB" nel manifest PWA, nel titolo browser e nel banner di installazione',
    ],
    notes: [
      'Se l\'app è già installata sul telefono, dopo l\'aggiornamento potrebbe servire rimuoverla e reinstallarla dalla PWA per vedere la nuova icona nella home',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08-31',
    title: 'Nuova area Catalogo esercizi',
    features: [
      'Nuova voce "Catalogo esercizi" nel menu staff: sfoglia tutti gli esercizi della metodologia senza dover per forza entrare in un allenamento',
      'Filtri per parte seduta (attivazione / tecnica / situazionale / gioco), fascia età e ricerca testo',
      'Bottone rosso "Nuovo esercizio" sempre a portata di mano, con lo stesso form del compositore',
      'Card scorciatoia nella Dashboard admin per raggiungere il catalogo in un tap',
    ],
  },
  {
    version: '1.8.6',
    date: '2026-08-31',
    title: 'Fix: "Vedi programma seduta" mostra sempre gli esercizi',
    fixes: [
      'Nel calendario, cliccando su "Vedi programma seduta" ora si vedono correttamente gli esercizi composti (prima appariva vuoto se non era stato compilato anche il campo libero "Programma dettagliato")',
      'Il pulsante nel calendario mostra "Vedi programma seduta" (invece di "Programma non pubblicato") anche quando c\'è solo la composizione da compositore',
    ],
  },
  {
    version: '1.8.5',
    date: '2026-08-31',
    title: 'Programma seduta visibile nel dettaglio allenamento',
    fixes: [
      'Se componi la seduta con il compositore esercizi, ora nel dettaglio dell\'allenamento (dallo storico o dal calendario) vedi il programma completo',
    ],
    features: [
      'Ogni esercizio è mostrato con badge parte di seduta (Attivazione / Tecnica / Situazionale / Gioco), durata, descrizione, area di gioco, materiali e le eventuali note personalizzate',
      'Header sezione con contatore esercizi e durata totale della seduta',
    ],
  },
  {
    version: '1.8.4',
    date: '2026-08-31',
    title: 'Comunicati: selettore squadra ordinato per età',
    fixes: [
      'Il selettore squadra nella pagina Comunicati ora è ordinato come negli altri menu dell\'app: Prima Squadra, Juniores, Allievi, Under a scendere fino a Piccoli Amici',
    ],
  },
  {
    version: '1.8.3',
    date: '2026-08-31',
    title: 'Comunicati: filtro per squadra',
    features: [
      'Nella pagina Comunicati LND nuovo selettore squadra in cima',
      'Selezionando una squadra vengono mostrati solo gli argomenti che la riguardano più quelli trasversali (validi per tutte)',
      'Le 36 gare di Prima categoria e Coppa Piemonte compaiono ora selezionando "Prima Squadra"',
      'I contatori in header (rilievi/comunicati/gare) si aggiornano in base al filtro',
    ],
  },
  {
    version: '1.8.2',
    date: '2026-08-31',
    title: 'Icona Comunicati nel menu mobile',
    features: [
      'Aggiunta icona 📄 Comunicati nel menu in basso su mobile (visibile per lo staff)',
      'Ora Comunicati LND è raggiungibile direttamente con un tap invece di passare dalla dashboard',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-08-31',
    title: 'Gare LND automatiche nel calendario squadra',
    features: [
      'Le gare pubblicate nei comunicati ufficiali LND ora appaiono automaticamente nel calendario della squadra di appartenenza',
      '30 gare di Prima categoria → Prima Squadra, 6 gare Coppa Piemonte U19 → Juniores',
      'Se una gara viene modificata nel comunicato (ora, data, luogo), il match nel calendario si aggiorna in automatico',
      'Ogni gara ufficiale ha un badge "📄 UFFICIALE" per distinguerla dalle amichevoli',
      'La competizione include girone, giornata e fase (es. "Prima categoria — Girone E · G.1 (andata)")',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-30',
    title: 'Nuova area Comunicati LND',
    features: [
      'Nuova sezione "Comunicati LND" con 3 tab: Rilievi, Comunicati, Gare 1ª squadra',
      'Tab Rilievi: 25 punti interpretati dai comunicati ufficiali, filtrabili per categoria (Società / Disciplinare / Scadenze / Gare)',
      'Ogni rilievo mostra data pubblicazione, fonte (file e pagina), scadenza con evidenza colorata (⚠ scaduto / ⏰ vicino / normale) e link al PDF ufficiale',
      'Tab Comunicati: 4 comunicati ufficiali con titolo, categoria, data, sintesi e link al PDF',
      'Tab Gare: 36 gare della prima squadra da settembre ad aprile con badge "PROSSIMA" sulla prima non ancora giocata',
      'Accessibile dal menu Comunicati LND nella sidebar desktop e dalla scorciatoia in dashboard per lo staff (admin/coach)',
    ],
  },
  {
    version: '1.7.2',
    date: '2026-08-30',
    title: 'Principi e sotto principi di gioco a menù',
    features: [
      'Nella scheda seduta di allenamento il campo "Principi di gioco" ora è un menù a tendina con l\'elenco ufficiale (15 principi)',
      'Aggiunto nuovo campo "Sotto principi di gioco" (14 opzioni predefinite)',
      'Entrambi i menù hanno la voce "➕ Altro (specifica…)" che apre un campo libero per scrivere un principio personalizzato',
      'Il dettaglio dell\'allenamento nello storico mostra anche il sotto principio quando compilato',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-08-30',
    title: 'Report presenze dal calendario',
    features: [
      'Nel calendario nuovo bottone arancione "Report presenze" (visibile per lo staff)',
      'Apre la classifica dei giocatori più presenti agli allenamenti (già disponibile prima solo dal menu Squadre)',
      'Include filtri per periodo (stagione, ultimo mese, personalizzato), ordinamento configurabile, dettaglio timeline per giocatore, evidenzia i giocatori "critici" sotto il 60%, export CSV',
      'Richiede di selezionare prima una squadra dal menu in alto (perché il report è sempre per squadra)',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08-30',
    title: 'Ripetizione settimanale degli eventi',
    features: [
      'Nel form di creazione allenamento/partita nuovo box "🔁 Ripeti settimanalmente"',
      'Attivandolo puoi indicare fino a quando ripetere: il sistema crea automaticamente un evento identico ogni 7 giorni fino alla data indicata',
      'Preview live del numero totale di eventi che verranno creati',
      'Utile per la stagione: crei una volta l\'allenamento del martedì e ottieni tutti i martedì fino a giugno',
      'Gli eventi ricorrenti sono raggruppati internamente (in futuro sarà possibile modificarli/eliminarli tutti insieme)',
    ],
  },
  {
    version: '1.6.4',
    date: '2026-08-30',
    title: 'Planner: orario di termine allenamento',
    features: [
      'Nel planner settimanale ora sotto l\'orario di inizio compare l\'orario di fine (es. "18:00 → 19:30") quando è compilato per l\'allenamento',
    ],
  },
  {
    version: '1.6.3',
    date: '2026-08-30',
    title: 'Planner: slogan footer pulito',
    fixes: [
      'Rimosso lo slogan doppio nel footer del planner ("«Casa non è un luogo, è una maglia»" appariva sovrapposto)',
    ],
  },
  {
    version: '1.6.2',
    date: '2026-08-30',
    title: 'Planner: nome squadra esteso',
    fixes: [
      'Nel planner settimanale ora le squadre appaiono con il nome esteso e l\'annata (es. "Under 16 annata 2011" invece di "U-16")',
    ],
  },
  {
    version: '1.6.1',
    date: '2026-08-30',
    title: 'Planner: settimana lunedì → domenica corretta',
    fixes: [
      'Il planner settimanale ora parte correttamente dal lunedì e finisce alla domenica (era spostato di un giorno per un problema di fuso orario)',
      'Le partite ora appaiono sotto il giorno giusto anche se giocate a orari serali',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-30',
    title: 'Planner settimanale per WhatsApp e PDF',
    features: [
      'Nel calendario nuovo bottone verde "Planner settimanale"',
      'Genera un\'immagine stile locandina Lenci con tutti gli impegni della settimana (lun→dom)',
      'Ogni giorno mostra ora, tipo (allenamento/partita), squadra, avversario/luogo — giorni senza eventi appaiono con "💤 Riposo"',
      'Rispetta il filtro squadra: se una squadra è selezionata mostra solo la sua, altrimenti tutte',
      'Navigazione tra settimane con frecce ← →, ritorno rapido alla settimana corrente',
      'Condivisione diretta via selettore nativo (WhatsApp, Instagram, ecc.) su mobile, download PNG o PDF su desktop',
    ],
  },
  {
    version: '1.5.4',
    date: '2026-08-29',
    title: 'Dashboard: filtro pre-selezionato nel calendario',
    fixes: [
      'KPI "Allenamenti in programma" → apre il calendario già filtrato per allenamenti',
      'KPI "Partite in programma" → apre il calendario già filtrato per partite',
      'Card "Prossimi impegni" → apre il calendario con il filtro corretto in base al tipo di evento (allenamento o partita)',
    ],
  },
  {
    version: '1.5.3',
    date: '2026-08-29',
    title: 'Dashboard tutta cliccabile',
    features: [
      'KPI Tesserati e Squadre → tap porta al menu Squadre',
      'KPI Allenamenti e Partite in programma → tap porta al Calendario',
      'Card "Prossimi impegni" → tap su ogni riga apre il Calendario',
      'Card riepilogo squadre in fondo → tap su ogni squadra porta al menu Squadre',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-08-29',
    title: 'Modifica allenamento dallo storico calendario',
    fixes: [
      'Aprendo un allenamento dallo storico nel calendario, ora sono disponibili i bottoni "Modifica presenze" e "Modifica dettagli evento" (prima erano assenti)',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-08-29',
    title: 'Feedback salvataggio + storico sempre aggiornato',
    fixes: [
      'Ora dopo aver salvato un allenamento o una partita compare una notifica verde di conferma in alto',
      'In caso di errore compare una notifica rossa con il dettaglio del problema',
      'Notifica anche per eliminazioni e per la modifica del report tattico',
      'Lo storico allenamenti e lo storico partite ora si aggiornano subito quando modifichi qualcosa mentre sono aperti (prima serviva chiuderlo e riaprirlo)',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-29',
    title: 'Storico dal calendario',
    features: [
      'Filtrando il calendario per "Allenamenti" compare il pulsante "Storico allenamenti"',
      'Filtrando per "Partite" compare "Partite passate & report" per accedere al report tattico di ogni partita giocata',
      'Le liste rispettano il filtro squadra: se hai selezionato una squadra, vedi solo la sua, altrimenti tutte',
      'Nelle liste multi-squadra ogni voce mostra il badge colorato della squadra per riconoscerla al volo',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-08-29',
    title: 'Distinta FIGC: logo pulito',
    fixes: [
      'Rimosso il quadrato bianco intorno al logo Lenci nella distinta FIGC: ora il logo è ritagliato circolarmente su fondo blu navy',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-08-29',
    title: 'Selettore squadre unificato nel calendario',
    features: [
      'Nel calendario, il selettore squadra ora è lo stesso dropdown a schermo intero usato nel menu Squadre',
      'Include opzione "Tutte le squadre" per gli admin che vogliono vedere il calendario aggregato',
      'Rimosse le chip orizzontali di filtro squadra: interfaccia più pulita e uniforme',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-29',
    title: 'Locandina: ritrovo, indirizzo campo e divisa',
    features: [
      'Locandina WhatsApp: ora ritrovo calcolato automaticamente (1 ora prima del calcio d\'inizio)',
      'Locandina WhatsApp: banner "👕 Presentarsi con divisa di rappresentanza" prima del mister',
      'Nuovo campo "Indirizzo campo" nel form partita (visibile su locandina e distinta FIGC)',
      'Distinta FIGC: cella CAMPO ora mostra nome + indirizzo completo',
    ],
  },
  {
    version: '1.3.1',
    date: '2026-08-29',
    title: 'Distinta FIGC: logo + categoria',
    fixes: [
      'Distinta ufficiale FIGC ora riporta il logo ASD Lenci Poirino in alto a sinistra dentro l\'header',
      'Categoria squadra ora compilata automaticamente (era vuota quando si generava dal calendario)',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-29',
    title: 'Dettaglio allenamento cliccabile',
    features: [
      'Nello storico allenamenti ora ogni allenamento è cliccabile e apre una scheda con tutti i dettagli',
      'Vista dettagliata: focus, obiettivi tecnici, principi di gioco, programma, staff seduta',
      'Riepilogo presenze registrate con conteggio e lista nominale suddivisa per stato (presenti/ritardo/giustificati/assenti)',
      'Da lì bottoni "Modifica presenze" e "Modifica dettagli evento" per intervenire subito',
    ],
  },
  {
    version: '1.2.1',
    date: '2026-08-29',
    title: 'Rifinitura locandina WhatsApp',
    fixes: [
      'Testi nomi squadre non più troncati (font auto-adattivo)',
      'Cella "Campo" non sfora più dal box info: layout con 3 colonne uguali (icona sopra, valore sotto)',
      'Icone Data/Ora/Campo ora disegnate come icone vettoriali, più leggibili',
      'Bottone Mister: banda bianca uniforme con bordini colorati, nome sempre contenuto',
      'Slogan finale: "maglia" più visibile e allineato con «Casa non è un luogo, è una»',
      'Tutti i testi con lunghezza variabile ora si ridimensionano automaticamente per stare nel loro spazio',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-29',
    title: 'Locandina convocazioni per WhatsApp',
    features: [
      'Genera locandina grafica della convocazione in un click (formato 4:5 verticale)',
      'Design brandizzato Lenci Poirino: logo, colori blu/rosso, slogan della società',
      'Bottone "Condividi" nativo: apre WhatsApp, Instagram, ecc. direttamente da mobile',
      'Bottone "Scarica PNG" alternativo per usare il file dove vuoi',
      'Portieri automaticamente in cima alla lista, capitano marcato con (C)',
      'Numero maglia mostrato accanto al nome',
      'Nome del mister evidenziato in basso',
    ],
    notes: [
      'La locandina è accessibile dalla schermata convocazioni, accanto ai bottoni distinta FIGC e salvataggio',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-29',
    title: 'Report tattico partite',
    features: [
      'Sezione "Report tattico" nel referto partita: modulo, meteo, cosa è andato bene, cosa migliorare, commento generale, note arbitrali',
      'Accesso al report post-partita direttamente dal calendario (bottone "Compila report" sulle partite passate)',
      'Badge automatico sulla card partita: "Compila report" (giallo) o "Report OK · modifica" (verde)',
      'Indicatore "compilato / vuoto" nel titolo della sezione report',
    ],
    fixes: [
      'Report post-partita: ora accessibile anche a chi lavora dal calendario, non solo dal cruscotto dirigente',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-29',
    title: 'Editor esercizi esteso + Storico allenamenti',
    features: [
      'Nuovi elementi editor esercizi: giocatori verde, rosa e viola',
      'Nuovi attrezzi editor: cinesini (piatti bassi), aste, scaletta agility',
      'Freccia guida palla ora ondulata (più leggibile)',
      'Nuova configurazione campo "2 porte lati corti" con cerchio di centrocampo',
      'Ostacolo ridisegnato con traversa + palini verticali',
      'Testo editor esercizi ora davvero modificabile (fino a 32 caratteri)',
      'Portiere e Jolly con etichetta di default automatica (P / J)',
      'Storico allenamenti per squadra (accessibile da scheda squadra)',
      'Banner esplicativo per allenamenti/partite retroattivi',
      'Utenza dirigente Under 16 (Alberto Santoru) creata',
      'Numero di versione + changelog visibili in-app',
    ],
    fixes: [
      'Editor esercizi: correzione flow di piazzamento testo (prompt immediato)',
      'Policy RLS esercizi custom più chiare (autore o admin possono modificare)',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-08-27',
    title: 'Modulo esercizi e sedute strutturate',
    features: [
      'Catalogo 40 esercizi ufficiali con schemi tattici SVG',
      'Composer seduta strutturato (attivazione / tecnica / situazionale / gioco)',
      'Editor esercizi custom con canvas SVG tap-to-place',
      'Sistema permessi granulari: admin scrivono tutto, coach solo i propri',
      'Duplica esercizio ufficiale per adattarlo',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-08-20',
    title: 'Staff, backup e notifiche',
    features: [
      'Gestione staff con ruoli: admin, coach, dirigente, direttore tecnico, segreteria',
      'Ruolo Supervisor con impersonation utenti',
      'Backup database scaricabile in JSON con progress',
      'Notifiche push web con badge notifiche non lette real-time',
      'PWA auto-update con reload immediato',
      'Direttore Tecnico readonly con doppia protezione UI + DB trigger',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-08-10',
    title: 'Base app',
    features: [
      'Gestione squadre e giocatori con avatar (compressione client-side)',
      'Presenze allenamenti: matrice, timeline giocatore, trend mensile',
      'Convocazioni e referti partite con statistiche individuali',
      'Programmi di allenamento consultabili',
      'Valutazioni tecniche (26 parametri tra tecnica, fisica, tattica)',
      'Visite mediche con badge stato',
      'Stato pagamenti (acconto / saldo)',
    ],
  },
]
