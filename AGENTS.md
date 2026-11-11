# CoLab — AI Agent Working Guide

> Read this before touching the code. It explains what CoLab is, how it's built,
> the conventions to follow, and the known landmines — so any AI (or human) can
> pick up the project without re-discovering everything.

## What is CoLab?

CoLab is a **collaborative real-time drawing / whiteboard app**. Multiple users
connect to a shared canvas over WebSockets and draw together — strokes appear on
everyone's screen instantly, with live cursors, presence, and chat.

It is built **from scratch** (this is NOT a migration) as two independent apps:

- `Frontend/` — the React UI + canvas
- `Backend/` — the Node.js WebSocket server

## Tech stack

**Frontend** (`Frontend/`)
- Vite + **React 19**
- **Redux Toolkit** for state (slices: `board`, `tool`, `user`)
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- **socket.io-client** for real-time
- **lucide-react** for icons

**Backend** (`Backend/`)
- Node.js + **Express 5** + **Socket.io 4** (CommonJS)
- `dotenv`, `nodemon` for dev

**Ports:** Backend `5000`, Frontend `5173`.

## Repo structure

```
CoLab/
├── Backend/
│   ├── src/
│   │   ├── server.js            # HTTP + Socket.io bootstrap (has inline handlers)
│   │   ├── socket/handler.js    # SocketHandlers class (currently DEAD CODE — see landmines)
│   │   └── utils/
│   │       ├── logger.js        # console logger (CommonJS)
│   │       └── constant.js      # socket event name constants (CommonJS)
│   └── .env                     # PORT, NODE_ENV, CORS_ORIGIN
└── Frontend/
    ├── src/
    │   ├── App.jsx              # Redux Provider → BoardPage
    │   ├── main.jsx             # Vite entry
    │   ├── pages/BoardPage.jsx  # main screen (header + toolbar + canvas + sidebar)
    │   ├── components/
    │   │   ├── Board/Canvas.jsx    # <canvas> + resize handling
    │   │   ├── Board/Toolbar.jsx   # tools, colors, brush size, undo/redo/clear
    │   │   └── UI/                 # Button.jsx, ColorPicker.jsx (both EMPTY)
    │   ├── hooks/
    │   │   ├── useCanvas.js     # drawing logic (local + emit to socket)
    │   │   ├── useSocket.js     # socket connection + emit helpers
    │   │   └── useBoard.js      # EMPTY
    │   ├── store/
    │   │   ├── store.js         # configureStore (serializableCheck disabled)
    │   │   └── slices/          # boardSlice, toolSlice, userSlice
    │   └── utils/
    │       ├── drawingTools.js  # drawElement, redrawCanvas, createElement
    │       └── constants.js     # event constants (uses module.exports — see landmines)
    └── vite.config.js           # react + tailwindcss plugins, '@' → src
```

## How to run

```bash
# Terminal 1 — backend
cd Backend
npm install
npm run dev          # nodemon → http://localhost:5000

# Terminal 2 — frontend
cd Frontend
npm install
npm run dev          # vite → http://localhost:5173
```

Open two browser tabs on `:5173` to see real-time sync.

## Working patterns & conventions

Follow these — they're how this codebase is written:

1. **State lives in Redux, not component state.** Board data (`elements`,
   `history`, `future`, `collaborators`, `chatMessages`) → `boardSlice`.
   Drawing tool settings (`activeTool`, `color`, `brushSize`, …) → `toolSlice`.
   Connection/user info → `userSlice`. Read with `useSelector`, write with
   `useDispatch`.

2. **Logic goes in hooks, markup in components.** Drawing → `useCanvas`.
   Socket → `useSocket`. Keep components mostly presentational.

3. **Component folders:** `components/Board/` for board-specific pieces,
   `components/UI/` for generic reusable pieces.

4. **Import alias:** `@/` → `Frontend/src/` (configured in `vite.config.js`).
   Use `@/components/...` for cross-folder imports.

5. **Styling:** Tailwind v4 utility classes. Note v4 syntax, e.g.
   `bg-linear-to-br` (not `bg-gradient-to-br`). No `tailwind.config.js` — theme
   is configured in CSS (`src/index.css`).

6. **Drawing pipeline:** `useCanvas` computes element → `drawElement()` renders
   locally → `emitDraw()` sends over socket → server broadcasts → other clients
   `dispatch(addElement())` → their `useCanvas` re-renders via `redrawCanvas()`.

7. **Socket events** are string names. Keep them in sync between
   `Backend/src/utils/constant.js` and `Frontend/src/utils/constants.js`
   (currently duplicated — see landmines).

8. **Backend is CommonJS** (`require`/`module.exports`). The **Frontend is ESM**
   (`import`/`export`). Don't mix them.

9. **Commits:** short, clear messages. Push to GitHub (`origin master`).

## 🚨 Known landmines (read before editing)

These are real inconsistencies in the current code — a new AI **will** trip on
them:

1. **`Backend/src/socket/handler.js` is dead code.** `server.js` does NOT import
   it — it has its own inline socket logic. `handler.js` also uses
   `export default` (ESM) while `Backend/package.json` is `"type": "commonjs"`,
   so requiring it would throw. Either wire it in and switch to
   `module.exports`, or delete it. Don't assume it's active.

2. **`Frontend/src/utils/constants.js` uses `module.exports`** but Frontend is
   ESM. If anything `import`s it, it breaks. Should be `export const ...`.

3. **Empty files:** `components/UI/Button.jsx`, `components/UI/ColorPicker.jsx`,
   `hooks/useBoard.js` are all 0 bytes — placeholders, not implemented.

4. **`useSocket()` creates a NEW socket every time it's called.** Both
   `BoardPage.jsx` and `Canvas.jsx` call it, so **two sockets connect per
   client**. Should be a singleton (module-level instance) or React context.
   This is a real bug — fix before adding more callers.

5. **Board state is in-memory only.** The server keeps `boardHistory` (max 100)
   and it's lost on restart. No database, no persistence, no rooms — a fresh
   server means a fresh (empty) board.

6. **`clear-board` isn't handled on the frontend.** `useSocket` listens but the
   callback is empty (`// Handle board clear from other users`). Clearing from
   one client doesn't clear others.

7. **No auth / no rooms.** Everyone joins one global board. `username` is a
   random `User_NNNN`.

## Current status

Scaffold + basic real-time drawing works. See `docs/plan/PROGRESS.md`
for the live tracker and `docs/plan/WORKLOG.md` for history.

**Roughly:** Phase 1–2 done, Phase 3 (core engine) mostly done, Phase 4
(realtime) partial, Phase 5 (features) early, Phase 6 not started.

## Git

- Branch: `master`, remote: `origin` → `https://github.com/DefenceSteller/CoLab.git`
- Workflow: `git add .` → `git commit -m "..."` → `git push`
