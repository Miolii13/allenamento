# Allenamento

Web app personale per il log degli allenamenti, pensata per telefono e PC.
Sezioni: **Sala pesi** (attiva), **Corsa** e **Alimentazione** (in arrivo).

## Avvio

```bash
npm install
npm run dev
```

Poi apri http://localhost:5173. Dal telefono, sulla stessa rete Wi-Fi, apri `http://<IP-del-PC>:5173`
(l'indirizzo "Network" che stampa Vite).

Build di produzione (cartella `dist/`, pubblicabile su qualsiasi hosting statico):

```bash
npm run build
```

## Pubblicazione online (GitHub Pages)

Il workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila e pubblica l'app a ogni
push sul branch `main`. Indirizzo finale: `https://<tuo-utente>.github.io/<nome-repository>/`.

Una volta sola:

1. Su [github.com](https://github.com) crea un repository **vuoto** (senza README), per esempio `allenamento`.
   Per GitHub Pages gratuito il repository deve essere **pubblico**: il codice si vede, i dati no (stanno su
   Supabase, protetti dal login). L'Excel e il riepilogo personale sono esclusi da `.gitignore`.
2. Nel repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → scheda Variables → New repository variable**, due volte:
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` con gli stessi valori di `.env.local`.
4. Dal PC, nella cartella del progetto:

   ```bash
   git remote add origin https://github.com/<tuo-utente>/allenamento.git
   git push -u origin main
   ```

5. Nella scheda **Actions** del repository aspetta che "Pubblica su GitHub Pages" diventi verde (1-2 minuti).

Sul telefono Android apri l'indirizzo in Chrome e tocca **Installa** nel riquadro in cima alla pagina Schede
(oppure **menu ⋮ → Installa app**). Poi **Impostazioni → Sincronizzazione → Accedi**.
(Su iPhone: Safari → **Condividi → Aggiungi alla schermata Home**.)
Dopo la prima apertura l'app funziona anche senza rete; gli aggiornamenti arrivano da soli alla prima
apertura con la rete dopo un nuovo push.

## Come funziona la sala pesi

- **Schede**: esercizi con serie e ripetizioni obiettivo. Tipi di serie: normale, drop (scalata subito
  dopo), myo (mini-serie dopo l'attivazione). Esercizi con la stessa lettera sono in superset.
- **Avvia workout**: per ogni esercizio vedi cosa hai fatto l'ultima volta. La colonna «Prima» mostra la
  serie corrispondente con ▲ / = / ▼ rispetto a oggi. La ✓ segna la serie e, se lasci campi vuoti, li
  riempie con i valori della volta prima. Se l'ultima volta hai chiuso il range in tutte le serie, l'app
  suggerisce di aumentare il carico.
- **Smith machine e cavi**: gli esercizi collegati a un attrezzo con più versioni chiedono quale hai usato.
  I pesi della volta prima vengono convertiti sulla versione di oggi (default: 50 kg Smith 1 = 45 kg Smith 2,
  9 kg Cavo 1 = 4,5 kg Cavo 2). Nomi e equivalenze si cambiano in Impostazioni.
- **Settimana tipo** (Impostazioni o «Modifica» nella home): per ogni giorno una scheda, la corsa o il riposo.
  Aprendo l'app la home mostra l'allenamento di oggi; senza settimana tipo propone la scheda successiva della rotazione.
- **Recupero**: il timer parte quando spunti una serie. Ogni esercizio della scheda può avere il suo recupero;
  se non lo imposti vale quello predefinito (2:00, modificabile in Impostazioni).
- **Statistiche**: allenamenti, volume, serie e durata media con il confronto sul periodo precedente, volume per
  settimana o mese, serie a settimana per muscolo, record battuti e progressi per esercizio.
- **Storico** ed **Esercizi**: ogni allenamento con il confronto sulla sessione precedente; per ogni
  esercizio le sessioni passate e il grafico del 1RM stimato (ripetizioni totali per trazioni e dip).

## Dati e sincronizzazione

I dati stanno nel browser del dispositivo (IndexedDB), quindi l'app funziona anche senza rete. Con la
sincronizzazione attiva ogni modifica finisce in una coda e viene inviata a Supabase dopo un paio di secondi;
l'app scarica le modifiche degli altri dispositivi all'avvio, quando torna in primo piano e ogni minuto.
Se lo stesso dato cambia su due dispositivi, vince la modifica più recente.

### Configurare Supabase (una volta)

1. Crea un account su [supabase.com](https://supabase.com) e un nuovo progetto (piano gratuito, regione
   europea).
2. Apri **SQL Editor**, incolla il contenuto di [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**.
3. In **Authentication → Users** usa **Add user → Create new user**: la tua email e una password, con
   **Auto Confirm User** attivo.
4. In **Authentication**, nelle impostazioni dei provider/registrazioni, disattiva le nuove registrazioni
   (*Allow new users to sign up*): così l'unico utente sei tu.
5. Nelle impostazioni API del progetto copia la **Project URL** e la chiave pubblica (**publishable key**,
   o **anon key** nei progetti meno recenti). Non usare mai la chiave *secret* / *service_role*.
6. Copia `.env.example` in `.env.local` e incolla URL e chiave, poi riavvia `npm run dev`.
   In alternativa puoi incollarli direttamente in **Impostazioni → Sincronizzazione** dell'app.
7. In **Impostazioni → Sincronizzazione** accedi con email e password. Ripeti l'accesso su ogni dispositivo.

Al primo accesso il dispositivo carica sul server quello che il server non ha ancora e scarica il resto.
Nota: i progetti gratuiti di Supabase vanno in pausa dopo una settimana senza utilizzo; si riattivano dalla
dashboard.

Il backup JSON in Impostazioni resta disponibile (export / import).

## Struttura

- `src/db` — tipi, database (Dexie) con la coda delle modifiche, schede iniziali (`seed.ts`), operazioni
- `src/sync` — motore di sincronizzazione, collegamento a Supabase, server finto per le prove in sviluppo
  (`window.__dev` nella console)
- `supabase/schema.sql` — tabella, permessi e regola "vince la modifica più recente"
- `src/lib` — formattazione e logica di progressione (conversioni tra attrezzi, confronti, 1RM)
- `src/pages/gym` — schermate della sala pesi
- `public/` — manifest, icone e service worker (funziona offline una volta pubblicata in HTTPS)
