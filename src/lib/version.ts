/**
 * Versione dell'app e storico release.
 * Ad ogni deploy: aggiornare APP_VERSION e aggiungere una nuova entry in CHANGELOG in cima.
 * Convention semver: MAJOR.MINOR.PATCH
 *  - PATCH: fix bug, piccole rifiniture
 *  - MINOR: nuove feature retrocompatibili
 *  - MAJOR: breaking change o riscrittura importante
 */

export const APP_VERSION = '1.9.37'
export const APP_VERSION_DATE = '2026-09-08'

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
