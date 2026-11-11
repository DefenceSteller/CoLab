# CoLab — Work Log

> Tracks what was built, when, and how on CoLab.

## Status: Phase 7 (UI overhaul) in progress — prototype works, being polished for production

---

## Commits

| Commit | Message |
|--------|---------|
| `e7eab2b` | first commit — initial scaffold (Frontend + Backend) |
| `7b4fa79` | Create README.md with project details |

---

## What exists

### Backend (`Backend/`)

- **`src/server.js`** — HTTP server + Socket.io bootstrap.
  - Handles `draw` (broadcast to others), `chat-message` (emit to all),
    `connection`, `disconnect`.
  - Tracks connected users in a `Map`.
  - CORS locked to `http://localhost:5173`.
  - **Note:** contains its own inline socket logic; does **not** use
    `src/socket/handler.js` (see landmine #1 in `AGENTS.md`).
- **`src/socket/handler.js`** — `SocketHandlers` class (board history, cursor,
  clear-board, chat). **Dead code** — not imported anywhere; uses ESM
  `export default` in a CommonJS package.
- **`src/utils/logger.js`** — timestamped console logger (`info`/`error`/`warn`).
- **`src/utils/constant.js`** — socket event name constants.
- **`.env`** — `PORT=5000`, `NODE_ENV=development`, `CORS_ORIGIN=http://localhost:5173`.

### Frontend (`Frontend/`)

- **Entry:** `main.jsx` → `App.jsx` (Redux `Provider`) → `BoardPage`.
- **`pages/BoardPage.jsx`** — main screen: header (connection status),
  `Toolbar`, `Canvas`, sidebar (`ChatPanel`/`UsersPanel` **commented out**).
- **`components/Board/Canvas.jsx`** — `<canvas>` + window-resize handling.
- **`components/Board/Toolbar.jsx`** — tool buttons, color palette + native
  color input, brush size slider, undo / redo / clear actions.
- **`components/UI/Button.jsx`, `UI/ColorPicker.jsx`** — **empty placeholders**.
- **`hooks/useCanvas.js`** — drawing: `startDrawing` / `draw` / `stopDrawing`,
  mouse + touch events, renders locally via `drawElement`, emits via
  `socket.emitDraw`. Text tool uses `prompt()`.
- **`hooks/useSocket.js`** — creates socket connection, subscribes to
  `draw` / `cursor-move` / `user-joined` / `user-left` / `chat-message` /
  `clear-board`, dispatches to Redux, exposes `emitDraw` / `emitCursorMove` /
  `emitChatMessage` / `emitClearBoard`.
  - **Bug:** creates a **new socket per call**; called from 2 components →
    2 connections per client.
- **`hooks/useBoard.js`** — **empty placeholder**.
- **`store/store.js`** — `configureStore` with `board`, `tool`, `user` reducers;
  `serializableCheck: false`.
- **`store/slices/boardSlice.js`** — `elements`, `history`, `future`,
  `isDrawing`, `collaborators`, `chatMessages`; actions `addElement`,
  `clearBoard`, `undo`, `redo`, `updateCollaborator`, `removeCollaborator`,
  `addChatMessage`, `setDrawing`.
- **`store/slices/toolSlice.js`** — `activeTool`, `color`, `brushSize`,
  `opacity`, `fillColor`, `strokeWidth`, `fontSize`, `fontFamily`.
- **`store/slices/userSlice.js`** — `userId`, `username` (random `User_NNNN`),
  `isConnected`, `cursorPosition`, `color`.
- **`utils/drawingTools.js`** — `drawElement` (pencil/eraser/line/rectangle/
  circle/text), `redrawCanvas`, `createElement`.
- **`utils/constants.js`** — event constants — **uses `module.exports` in an
  ESM package** (see landmine #2).

### Shared

- **Drawing pipeline (working):** local render → `emitDraw` → server broadcast →
  other clients `addElement` → `redrawCanvas`.
- **Real-time (working):** strokes sync across clients; new joiners receive the
  server's `boardHistory`.

---

## 🛠️ Session notes

### 2026-11-12 — goal shift → production-grade; Phase 7 (UI) overhaul built
- **Decision:** app is "too basic" — goal is now real-world / production-level
  quality, taken **step by step** with explicit approval before each step.
- **Step 1: full UI overhaul — IMPLEMENTED.** Dark glassmorphic chrome, gradient
  accents (violet→fuchsia→cyan), Space Grotesk font, animated Live status pill,
  gradient logo, floating glass toolbar with hover/active states, styled color
  swatches + brush slider with live preview, elevated grid canvas, glass sidebar
  (Collaborators + Chat placeholder), entrance animations, custom scrollbar.
- **Files rewritten:** `index.css` (design system), `index.html` (font/title/dark),
  `BoardPage.jsx` (header + layout), `Toolbar.jsx` (hero toolbar),
  `Canvas.jsx` (surface + resize fix), `drawingTools.js` (transparent clear fix).
- **Root causes found:** `.tool-btn` was never styled anywhere; `App.css` was dead
  Vite boilerplate (not imported); `index.css` was empty.
- New `PHASE_7_UI_UX.md` created; `PROGRESS.md` updated to show Phase 7 active.

### 2026-11-11/12 — project setup & first working prototype
- Scaffolded both apps (`Frontend/` Vite React, `Backend/` Express + Socket.io).
- Built Redux store (3 slices), canvas, toolbar, drawing hook, socket hook.
- Got end-to-end real-time drawing working (two tabs sync strokes).
- Wrote `README.md` and pushed initial commits to GitHub.
- **Known issues logged** (duplicate sockets, dead `handler.js`, ESM/CJS
  constant mismatch, empty placeholder files, no persistence).

---

## 📝 Notes / conventions

- Work in phases; stop after each for review.
- Short, clear commit messages; push to `origin master`.
- State lives in Redux; logic in hooks; markup in components.
- Backend = CommonJS, Frontend = ESM — don't mix.
- Socket event names must stay in sync between backend and frontend constants.
- No persistence yet — don't rely on server state surviving a restart.

---

**Last updated:** 2026-11-12
**Project:** CoLab collaborative drawing board
**From:** empty repo → React + Socket.io real-time drawing prototype
**To:** (planned) full collaborative whiteboard with chat, rooms, persistence, auth
