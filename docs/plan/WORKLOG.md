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
  mouse + touch events. Shapes preview during drag and commit **once** on
  mouseup; pencil/eraser commit per-segment (locally + socket); text tool uses
  an **inline input overlay** (no `prompt()`).
- **`hooks/useSocket.js`** — **singleton socket** + `useSocketListeners()`
  (attached once from `BoardPage`), subscribes to
  `draw` / `cursor-move` / `user-left` / `chat-message` / `clear-board`,
  dispatches to Redux, exposes `emitDraw` / `emitCursorMove` /
  `emitChatMessage` / `emitClearBoard`.
  - ~~Bug: new socket per call~~ — **fixed 2026-11-12** (one connection per client).
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
- **Real-time (working):** strokes sync across clients (server broadcasts to
  everyone except the sender; no board-state/history relay yet).

---

## 🛠️ Session notes

### 2026-11-16 — **🔥 Fixed: "Start a session" frozen on "starting…" (production)**

**Symptom (user's screenshot):** clicking "Start a session" on
https://colab-gold.vercel.app spun on "starting…" forever — no share popup, no
error banner.

**Root cause (found by probing the LIVE backend with the app's exact emit
path):** an ack-signature mismatch between server and client.

- Server acks Node-style: `cb(null, { ok:true, roomId, … })` (`server.js` L82).
- Client emits with `.timeout(8000)`, which makes socket.io-client flag the
  callback `withError` and **prepend its own error slot** on arrival
  (`socket.js` L601: `packet.data.unshift(null)`).
- So the callback actually received `(null, null, {ok:true,…})`: `err`=null,
  `res`=**null** (the *server's* null), real payload dropped.
- `resolve(null)` → `res.ok` threw `TypeError` inside the async handler →
  `setStatus('idle')` / `setError()` never ran → button frozen on
  "starting…", no banner. Verified: `ACK ARGS: [null,null,{…}]`.

Earlier protocol tests passed only because they emitted **without**
`.timeout()` — the bug lived solely in the app's code path.

**Fix (frontend only, no backend change):**
- `useSocket.js` — new `parseAck(err, …args)` helper: takes the **first object
  argument** (correct with/without `.timeout()`, both server ack styles);
  `createRoom`/`joinRoom` now use it; reconnect-rejoin guard null-checked.
- `App.jsx` — `handleStart` wrapped in `try/catch/finally` so the button
  **always** leaves "starting…"; shared-link join path got the same
  null-guards + `.catch`/`.finally` (it had the identical latent bug).

**Verified:** 8/8 checks against the live Railway backend through the exact
fixed path (create → join → `not-found` rejection → draw relay); production
bundle `index-CJhAqtHD.js` confirmed to contain the fix + Railway URL;
`colab-gold.vercel.app` aliased to the new deployment `colab-ad0pvclcq`.

**Also during this hunt:** reverted bad commit `41acddd` ("live server" — added
a stray test file that broke Vercel auto-builds) as `9860295`; restored
`VITE_SOCKET_URL` in Vercel; noted `colab` project's direct deployment URLs are
behind **Deployment Protection** (Vercel login page) — always verify via
`colab-gold.vercel.app`.

### 2026-11-16 — **Rooms / Sessions feature built & protocol-verified**

**User's exact ask:** "start session" button → link popup → share link → user 2
clicks and lands on the same board; user 3 without a link works separately or
creates their own link; **max 5 users per link**.

**Backend (`Backend/src/server.js` rewritten):**
- `create-room` / `join-room` / `leave-room` ack callbacks (8s timeout client-side).
- Per-room element storage (`elements[]`) with replay to new joiners.
- Room-scoped relay: `socket.to(room)` for `draw`, `io.to(room)` for `clear-board`
  + `chat-message`, `room-users` broadcasts on join/leave/disconnect.
- 5-user cap (`MAX_ROOM_SIZE = 5`) — `full` / `not-found` errors in ack.
- `MAX_ROOM_ELEMENTS = 20000` memory cap per room (oldest dropped).
- Empty rooms are **kept until server restart** so shared links stay valid.
- Disconnect cleanup leaves the room, broadcasts updated member list.

**Frontend:**
- `App.jsx` — session gate: landing vs board, auto-join from `?room=ABC123`,
  Start Session flow, error banners for `full` / `not-found`.
- `pages/Landing.jsx` — start screen with "Start a session" button (neobrutalist style).
- `components/Session/ShareModal.jsx` — link popup with copy button, room code,
  capacity pill (`N/5 people`), animated entrance.
- `BoardPage.jsx` — removed `useSocketListeners()` call (moved to session gate),
  replaced collaborator count with `{roomUsers.length}/5 people` pill, added
  Share button in header (re-opens the link popup).
- `hooks/useSocket.js` — `createRoom`/`joinRoom` timeout-promise helpers,
  `room-users` listener → `setRoomUsers`, **rejoin-on-reconnect** (reconnect mints
  a new socket id → server forgot membership → auto rejoin + board replay).
- `store/slices/boardSlice.js` — `roomId`, `roomUsers`, `setRoomId`,
  `setRoomUsers`, `loadBoard` (replaces whole board on replay).

**Protocol verified (19/19 assertions pass headlessly):**
- create-room returns 6-char ID + maxUsers=5
- join-room replays existing strokes + broadcasts 2 members
- draw relay only to the *other* client (sender excluded)
- unknown room returns `not-found`
- 6th user rejected with `full` when room is at 5/5
- clear-board wipes stored state (future joiner gets 0 elements)

**Docs updated:** `PHASE_5_FEATURES.md` (rooms section → ✅ DONE),
`PROGRESS.md` (Phase 5 ~60%, rooms complete), `AGENTS.md` (deployment section
refreshed).

### 2026-11-16 — backend deployed to Railway → **full stack live**
- **Host chosen: Railway** — free trial ($5 / 30 days, **no credit card**),
  CLI-driven like Vercel. (Render's free backend tier no longer exists.)
- **Backend changes for cloud** (`server.js`): `PORT` from env (host-assigned,
  fallback 5000), CORS origins from `CORS_ORIGIN` (comma-separated), loads
  `dotenv`; `dotenv` moved dev → production `dependencies`.
- **Railway:** CLI login → project `colab` → `railway up` from `Backend/` →
  service **Online**; public domain
  **https://colab-production-4bce3d39.up.railway.app** — verified HTTP 200
  and socket.io handshake returning
  `Access-Control-Allow-Origin: https://colab-gold.vercel.app`.
- **Railway vars:** `CORS_ORIGIN=https://colab-gold.vercel.app`,
  `NODE_ENV=production`.
- **Vercel wiring:** `VITE_SOCKET_URL` added (production) → frontend
  redeployed → verified the Railway URL is present in the live JS bundle.
- **Result:** https://colab-gold.vercel.app is wired end-to-end to the hosted
  backend (handshake verified server-side; browser test pending).
- **Caveats / follow-ups:** Railway trial ends → Free plan gives only $1/mo
  credit (an always-on service may exceed it — watch usage).
- **GitHub connected (push-to-deploy):** `railway service source connect
  --repo DefenceSteller/CoLab --branch master` + `rootDirectory: Backend` set
  via `serviceInstanceUpdate` (monorepo — first connect-triggered build failed
  from repo root until this was set). Redeploy of commit `05a7478` from GitHub
  → **SUCCESS** (meta confirms `repo`, `rootDirectory`, branch). Backend pushes
  to `master` now auto-deploy. CLI note: PowerShell mangles JSON args for
  `railway api --variables` — use `--file`/`@file` instead.

### 2026-11-16 — frontend deployed to Vercel
- **Prep:** `useSocket.js` socket URL now reads `import.meta.env.VITE_SOCKET_URL`
  (falls back to `http://localhost:5000` in dev); production build verified
  (`vite build` — clean, 272 kB JS / 88 kB gzip).
- **Vercel:** logged in via CLI, linked `Frontend/` as project **`colab`**
  (scope `hashims-projects-c6ccab3b`) — Vite auto-detected (build `vite build`,
  output `dist`).
- **Production URL: https://colab-gold.vercel.app** — deployment READY,
  verified public HTTP 200 (no deployment-protection wall).
- **GitHub integration connected** → pushes to `master` now auto-deploy.
- `.vercel/` added to `Frontend/.gitignore`.
- **Known gap:** backend can't run on Vercel (Socket.io needs a long-running
  server; Vercel is serverless) → next step: host `Backend/` on Render/Railway
  and set `VITE_SOCKET_URL` in Vercel project env vars. Until then the deployed
  site shows **Offline** (UI works, no real-time sync).

### 2026-11-12 — drawing tools fixed (line / rect / circle / text / eraser)
- **Reported** via screenshots in `Downloads/tools/`: line drew jagged
  freehand strokes, rect/circle drew *chains* of tiny shapes along the drag
  path, text opened a separate `prompt()` dialog and never appeared on the
  canvas, eraser behaviour unclear.
- **Root causes found:**
  1. Every `mousemove` committed a **new element** (shapes were emitted per
     move instead of once per drag).
  2. `drawElement` had **no `text` case** — text could never render even if
     it had been created.
  3. `circle` used from→to as a single point pair instead of the drag box.
  4. `useSocket()` created a **new socket per call** (2 connections/client).
  5. Local pencil strokes were **never dispatched to Redux** — only painted
     on the canvas — so any redraw (resize, remote stroke) wiped them.
  6. `boardSlice` pushed history **after** adding the element → undo was a
     no-op.
- **Fixes:**
  - `drawingTools.js` — added `text` rendering (`fillText`), circle = ellipse
    fitted to the drag box, clear-to-transparent.
  - `useCanvas.js` — rewritten: shape **preview during drag + single commit
    on mouseup** (with degenerate-click guard), pencil/eraser segments
    committed to Redux, eraser paints white, **inline text input state**
    (Enter = place, Esc = cancel, blur = commit).
  - `Canvas.jsx` — inline text editor overlay positioned on the canvas
    (replaces the `prompt()` dialog).
  - `useSocket.js` — **singleton socket** + `useSocketListeners()` attached
    once in `BoardPage`; `clear-board` listener now dispatches `clearBoard`
    (frontend half of landmine #6 — server still doesn't relay it).
  - `boardSlice.js` — history snapshot taken **before** pushing the element
    (undo/redo now works).
- **Verified:** Vite HMR compiled with **no errors**, HTTP 200 on :5173.
- **Known follow-ups:** backend doesn't relay `clear-board`/`cursor-move`;
  undo granularity is per-segment for freehand strokes.

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

**Last updated:** 2026-11-16
**Project:** CoLab collaborative drawing board
**From:** empty repo → React + Socket.io real-time drawing prototype
**To:** (planned) full collaborative whiteboard with chat, rooms, persistence, auth
