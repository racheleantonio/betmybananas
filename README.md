# Bet My Bananas 🍌

Gioco multiplayer in tempo reale: scommetti le tue banane virtuali e sfida gli amici!

- **Frontend**: Next.js + PrimeReact, deploy su GitHub Pages (static export)
- **Backend**: Node.js + Express + Socket.io, deploy su Glitch
- **Database**: nessuno — stato in memoria sul server

## Come funziona

1. L'**organizer** crea una partita e ottiene un link da condividere
2. I **giocatori** aprono il link, inseriscono il nome e entrano in lobby
3. L'organizer avvia la partita dal **pannello di controllo**
4. Ogni round: domanda + opzioni → scommesse in tempo reale → rivelazione vincitore
5. I giocatori vincenti dividono il piatto proporzionalmente alle puntate

Ogni giocatore parte con **100 banane**. Nessuna password, accesso immediato.

## Struttura progetto

```
betmybananas/
├── client/          # Next.js + PrimeReact (GitHub Pages)
├── server/          # Express + Socket.io (Glitch)
└── .github/         # CI/CD GitHub Pages
```

## Sviluppo locale

### Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Il server parte su `http://localhost:3001`.

### Client

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
```

Apri `http://localhost:3000`.

Variabili client (`.env.local`):

| Variabile | Descrizione |
|-----------|-------------|
| `NEXT_PUBLIC_SOCKET_URL` | URL del server Socket.io |
| `NEXT_PUBLIC_BASE_PATH` | Base path per GitHub Pages (vuoto in locale) |
| `NEXT_PUBLIC_SOCKET_TOKEN` | Token auth opzionale |

## Deploy su Glitch (server)

1. Importa il repo su [Glitch](https://glitch.com)
2. Imposta le **variabili d'ambiente** nel pannello `.env`:

| Variabile | Esempio | Descrizione |
|-----------|---------|-------------|
| `CORS_ORIGIN` | `https://tuousername.github.io` | URL del frontend (separare più origini con virgola) |
| `ROOM_SECRET` | stringa casuale lunga | Segreto per validazione stanze |
| `NODE_ENV` | `production` | Ambiente produzione |

3. Glitch imposta automaticamente `PORT`
4. Il file `glitch.json` avvia `server/server.js`

**CORS**: il server accetta richieste solo dalle origini definite in `CORS_ORIGIN`. Aggiorna questa variabile con l'URL esatto di GitHub Pages.

## Deploy su GitHub Pages (frontend)

1. Abilita **GitHub Pages** nelle impostazioni del repo (Source: GitHub Actions)
2. Configura i **secrets/variables** del repo:
   - `SOCKET_URL` — URL Glitch del server (es. `https://betmybananas.glitch.me`)
   - `SOCKET_TOKEN` — opzionale, se usi auth lato server
3. Push su `main` — il workflow `.github/workflows/deploy-pages.yml` builda e pubblica `client/out`

Se il repo si chiama `betmybananas`, l'app sarà su:
`https://tuousername.github.io/betmybananas/`

Modifica `NEXT_PUBLIC_BASE_PATH` in `.github/workflows/deploy-pages.yml` se il nome del repo è diverso.

## Eventi WebSocket

| Evento | Direzione | Descrizione |
|--------|-----------|-------------|
| `room:create` | Client → Server | Crea stanza (organizer) |
| `room:join` | Client → Server | Entra in stanza |
| `game:start` | Client → Server | Avvia partita |
| `round:start` | Client → Server | Nuovo round con domanda/opzioni |
| `bet:place` | Client → Server | Piazza/aggiorna scommessa |
| `betting:close` | Client → Server | Chiude scommesse |
| `round:reveal` | Client → Server | Rivela vincitore |
| `game:end` | Client → Server | Termina partita |
| `room:state` | Server → Client | Stato completo sincronizzato |

## Licenza

MIT
