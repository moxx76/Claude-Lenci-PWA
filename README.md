# Lenci LAB · ASD Lenci Poirino PWA

Progressive Web App gestionale per **A.S.D. Lenci O.N.L.U.S. Poirino**.
Serve staff (admin, coach, dirigenti), atleti e famiglie: calendario, presenze,
convocazioni FIGC, referti partita, valutazioni tecniche, allegati allenamenti,
comunicati LND e altro.

**Live:** https://lenci-poirino-app.netlify.app

## Stack

- **Frontend:** React + TypeScript + Vite (PWA con service worker)
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Hosting:** Netlify (continuous deploy)
- **Design:** inline styles, Material Symbols, font Anybody + Poppins
- **Branding:** blu `#005f98`, rosso `#c73434`

## Sviluppo locale

Requisiti: Node.js 18+, npm.

```bash
# 1. Installa dipendenze
npm install

# 2. Crea file .env locale con credenziali Supabase (NON committare)
cp .env.example .env
# poi popola VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# 3. Dev server
npm run dev

# 4. Build produzione
npm run build

# 5. Preview build
npm run preview
```

## Deploy

Il repo è collegato a Netlify: **ogni push su `main` triggerà un deploy automatico**.

Deploy manuale (se serve):

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

## Struttura progetto

```
src/
├── components/       # Componenti riutilizzabili (Sheet, Card, ecc.)
├── pages/            # Route (Dashboard, Teams, CalendarPage, Comunicati, ecc.)
├── hooks/            # Custom hooks (useAuth, useMyTeam, useCalendarEvents, ecc.)
├── lib/              # Utility (supabase client, teamOrder, whoBmiReference, ecc.)
├── store/            # Zustand store (auth)
└── sw.ts             # Service worker (PWA)

public/               # Asset statici (logo, icone PWA)
supabase/             # Edge Functions
```

## Riferimenti chiave

- **Progetto Supabase:** `nlgknkopottaxewpdofl`
- **Club ID:** `9cb45011-8014-45f1-a045-f2253d422926`
- **Netlify site ID:** `49676344-4aeb-4335-9a01-7a0eb5d08e83`
- **Password standard nuovi staff:** `Lenci2026!`

## Convenzioni tecniche importanti

- **Timezone:** l'app opera in `Europe/Rome`. **Mai** usare `.toISOString().slice(0,10)` o `.slice(11,16)` su timestamp UTC per estrarre data/ora locali. Usare `getFullYear/getMonth+1/getDate` per date locali e `toLocaleTimeString('it-IT', {timeZone:'Europe/Rome'})` per orari.
- **Creazione staff via SQL bypass:** l'Edge Function `create-staff-user` è instabile. Pattern robusto: `INSERT auth.users + auth.identities`, poi `UPDATE profiles` (il trigger `handle_new_user` crea la riga default).
- **Logo:** il logo Lenci LAB è il logo *dell'app*. Il logo classico A.S.D. Lenci Poirino (`/public/lenci-logo-ufficiale.jpg`) resta il logo *ufficiale della società* per documenti FIGC, convocazioni e planner.
- **Team ordering:** riusare sempre `sortTeamsByAge` da `lib/teamOrder.ts` per ordinare squadre per età.
- **RLS:** `my_team_ids()` (SECURITY DEFINER) include head_coach + assistant + helper + team_manager + second_manager. Tutte le policy usano questa funzione.
