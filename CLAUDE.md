# X-Men Card Game — Project Guide

## What this is
Real-time multiplayer card game with X-Men characters. Players create/join rooms, pick characters, and battle using dice rolls. PT-BR UI.

- **Stack**: React 18 + Firebase Realtime Database + Vite 5
- **Hosting**: Vercel (auto-deploy from `main`)
- **Dev**: `npm run dev` — `npm run build` — `npm run preview`

---

## Folder Structure

```
src/
├── components/
│   ├── Home.jsx / .css        # Create or join room
│   ├── Lobby.jsx / .css       # Character selection, wait screen
│   ├── Game.jsx / .css        # Active battle screen
│   ├── CharacterGrid.jsx / .css  # Card gallery (all 12)
│   ├── CardDetail.jsx / .css     # Single card + practice dice
│   └── DiceRoller.jsx / .css     # Reusable dice component
├── data/
│   └── characters.js          # 12 X-Men character definitions
├── App.jsx                    # URL router + screen state
├── firebase.js                # Firebase init + anonymous player ID
├── roomService.js             # All Firebase DB operations
├── session.js                 # localStorage persistence for tab restore
└── index.css / App.css
```

---

## Routing (No React Router)

Custom URL-based routing in `App.jsx` via `window.location.pathname` + `history.pushState`.

| URL | Screen |
|-----|--------|
| `/` | Home |
| `/lobby/:code` | Lobby |
| `/game/:code` | Game |

- Survives F5 refresh — `vercel.json` rewrites all routes to `index.html`
- `popstate` listener handles browser back/forward

---

## Firebase Database Schema

```
rooms/{6-char-code}/
  code: string
  hostId: string
  status: 'lobby' | 'playing'
  createdAt: timestamp
  players/
    {playerId}/
      name: string
      characterId: number (1–12) | null
      hp: number (0–100)
      alive: boolean
  battle/
    attackerId: string
    defenderId: string
    attackerRoll: number | null
    defenderRoll: number | null
    resolved: boolean
```

Key functions in `roomService.js`:
- `createRoom(playerId, playerName)` → returns 6-char code
- `joinRoom(code, playerId, playerName)` → max 8 players
- `selectCharacter(code, playerId, characterId)`
- `startGame(code)` → sets status = 'playing'
- `attackPlayer(code, attackerId, defenderId)`
- `submitRoll(code, playerId, roll)` → auto-resolves when both rolled
- `_resolveBattle()` → transactional, clears after 4 s

**Battle math**: `damage = |attackerRoll - defenderRoll|`, loser = lower roll, tie = no damage.

---

## Characters (12 total)

Each character in `characters.js` has: `id`, `name`, `alias`, `image`, `powers[]`, `type`, `typeIcon`, `diceType` (d6/d8/d10), `multiplier`, `color`, `gradient`, `team`, `number`.

| ID | Name | Die |
|----|------|-----|
| 1 | Wolverine | D6 |
| 2 | Ciclope | D8 |
| 3 | Tempestade | D6 |
| 4 | Fênix | D10 |
| 5 | Magneto | D8 |
| 6 | Professor X | D6 |
| 7 | Gambit | D6 |
| 8 | Pícara | D8 |
| 9 | Noturno | D6 |
| 10 | Colosso | D6 |
| 11 | Fera | D6 |
| 12 | Deadpool | D8 |

D6 shows unicode faces (⚀–⚅). D8/D10 show numbers. Dice animation: 12 random ticks → final value.

---

## Player Identity

- Anonymous — no Firebase Auth
- `getPlayerId()` in `firebase.js`: generates UUID once, stores in `sessionStorage['xmen_pid']`

---

## Firebase Environment Variables

Required in `.env` (not committed):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Only service used: **Realtime Database**. No Auth, Storage, or Functions.

---

## Key Patterns

- **No external state lib** — Firebase `onValue` listeners are the source of truth; clean up on unmount with `off(ref)`
- **Transactional battles** — `runTransaction()` prevents race conditions when both players roll simultaneously
- **Session persistence** — `session.js` saves roomCode + screen to localStorage for tab/crash restore
- **CSS** — BEM naming, CSS variables (`--accent`, `--glow-color`), inline styles for runtime character colors, mobile-first (`100dvh`)
- **Image fallback** — `onerror` → first letter in circle (character images from external CDN)
- **Guards** — `if (!db)` prevents crashes when Firebase config is missing

---

## Navigation Flow

```
Home ──create──▶ Lobby ──all ready + host starts──▶ Game
     ──join code──▶ Lobby
     ──view cards──▶ CharacterGrid ──click──▶ CardDetail
```

---

## Dependencies

| Package | Version | Role |
|---------|---------|------|
| react | 18.3.1 | UI framework |
| react-dom | 18.3.1 | DOM rendering |
| firebase | 12.13.0 | Realtime DB |
| vite | 5.4.0 | Build tool |
| @vitejs/plugin-react | 4.3.1 | Fast Refresh |

No router, no state lib, no UI kit — deliberately lean.
