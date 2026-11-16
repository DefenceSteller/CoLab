# CoLab — Project Progress Tracker

> Live progress tracker for CoLab — a from-scratch collaborative drawing app.

## Current Phase: **Excalidraw-parity rebuild — Phase 1 (Foundation) ✅ done**

**Goal (2026-11-17, user request):** match **every tool & functionality of
excalidraw.com**. 10-phase plan (stop after each phase for review):

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation — element model, roughjs renderer, viewport state, two-layer canvas | ✅ **Done (2026-11-17)** |
| 2 | Viewport — wheel zoom at cursor, space/middle-drag pan, hand tool, zoom controls, fit-to-content | ⬜ Next |
| 3 | Selection engine — click/shift-click, marquee, move/resize/rotate handles | ⬜ |
| 4 | New tools — diamond, arrow, frame, laser, image, binders | ⬜ |
| 5 | Property panel — colors, fill styles, stroke styles/width, roughness, opacity, fonts | ⬜ |
| 6 | History + text editing — text edit-in-place, stroke-level undo, copy/paste | ⬜ |
| 7 | Shortcuts + menus — full keymap, context menu, command palette | ⬜ |
| 8 | Export/import — PNG/SVG/JSON clipboard & file | ⬜ |
| 9 | Realtime sync — `update-elements`/`selection`/`laser` events + room-state merge | ⬜ |
| 10 | Docs, tests, production deploy | ⬜ |

**Goal shift (2026-11-12):** move from prototype → **production-grade, real-world
usable** app, step by step. **First step = full UI overhaul** (Gen Z / professional
style) — implemented, see `PHASE_7_UI_UX.md`.

**Completed:** ~4 of 7 original phases + parity Phase 1

### Phase status overview (original plan)

| Phase | Status | % Complete |
|-------|--------|------------|
| 1 — Analysis & Scope | ✅ Done | 100% |
| 2 — Architecture | 🟡 In progress | ~70% |
| 3 — Core Drawing Engine | 🟢 Mostly done | ~95% (rewritten for parity in Phase 1) |
| 4 — Real-time Collaboration | 🟡 Partial | ~55% (delete-elements relay added 11-17) |
| 5 — Features | 🟢 Rooms done | ~60% |
| 6 — Quality & Deploy | 🟢 Done | 100% |
| **7 — UI/UX & Design System** | 🟢 Done (pending review) | ~95% |

**Overall:** rooms + production deploys working; **parity rebuild underway** —
Phase 1 shipped (element model, roughjs renderer, viewport, two-layer canvas);
selection/tools/panel/shortcuts/export/sync remain.

---

## ✅ What's done

- [x] **Frontend scaffolded** — Vite + React 19 + Redux Toolkit + Tailwind CSS v4
- [x] **Backend scaffolded** — Express 5 + Socket.io 4 (CommonJS), `.env` configured
- [x] **Redux store** with `board` / `tool` / `user` slices (`serializableCheck` disabled)
- [x] **Canvas component** with responsive resize handling (mouse + touch)
- [x] **Toolbar** — tools (pencil, line, rectangle, circle, text, eraser), color palette + picker, brush size slider, undo / redo / clear
- [x] **`useCanvas` hook** — local drawing + `emitDraw()`; shapes preview
  during drag + commit once on mouseup; pencil/eraser segments committed to
  Redux (survive resize); inline text input (no `prompt()`)
- [x] **`useSocket` hook** — **singleton socket** + `useSocketListeners()`
  (attached once in `BoardPage`), draw / cursor / chat / clear listeners, emit helpers
- [x] **Drawing utilities** — `drawElement` (incl. `text` + ellipse circle),
  `redrawCanvas`, `createElement`
- [x] **Socket draw broadcast** — server relays strokes to other clients
- [x] **Undo/redo** — snapshot-order bug fixed (was a no-op)
- [x] **Frontend deployed to Vercel** — https://colab-gold.vercel.app
  (2026-11-16; GitHub integration connected → pushes auto-deploy)
- [x] **Backend deployed to Railway** —
  https://colab-production-4bce3d39.up.railway.app (2026-11-16; PORT/CORS
  via env vars, `VITE_SOCKET_URL` wired into Vercel, handshake verified)
- [x] **Rooms / sessions feature (2026-11-16)** — create/join by 6-char code,
  max 5 users per link, stroke replay for late joiners, room-scoped draw/clear/chat,
  share-link popup with copy button, rejoin-on-reconnect.
- [x] **"Start a session" frozen on "starting…" — FIXED (2026-11-16)** —
  ack-signature mismatch: server `cb(null, payload)` + client `.timeout()`
  socket.io error-slot prepend → app read `null` as the response → `res.ok`
  threw → button froze. Frontend `parseAck()` + `try/catch/finally` hardening
  (no backend change); 8/8 live tests, deployed to `colab-gold.vercel.app`.
- [x] **Railway push-to-deploy** — backend service connected to GitHub
  (branch `master`, root directory `Backend`); pushes rebuild it automatically
- [x] **Vercel push-to-deploy FIXED (2026-11-16)** — project Root Directory was
  `.` (repo root, no `package.json`) so every git build died with `vite: command
  not found`; set Root Directory = `Frontend`. Git pushes now build + alias
  `colab-gold.vercel.app` automatically.
- [x] **Excalidraw-parity Phase 1 — Foundation (2026-11-17)** — new id-based
  element model (`utils/elementModel.js`) with legacy `{from,to}` ingest +
  stroke merging, **roughjs** renderer (`utils/renderer.js`, replaces
  `drawingTools.js`), viewport math (`utils/viewport.js` + `viewportSlice`),
  two-layer canvas (committed base + interaction overlay, DPR-aware),
  world-coordinate pointer pipeline in `useCanvas.js`, eraser now **removes**
  elements (relayed by new backend `delete-elements` event, room state pruned),
  Excalidraw tool ids in the toolbar. Verified: build clean, puppeteer smoke
  8/8, headed-Chrome text check, socket protocol 6/6.

## 🔴 What's pending / broken

- [ ] **Server: relay `clear-board` / `cursor-move` / presence events** —
  frontend listeners exist now, but `server.js` only relays `draw` + `chat-message`
  *(note: rooms server now relays clear-board; cursor-move still missing)*
- [ ] **Wire or remove dead `socket/handler.js`** — not imported; ESM export in a CJS package
- [ ] **Frontend `constants.js`** uses `module.exports` but Frontend is ESM
- [ ] **Chat UI** — `ChatPanel` / `UsersPanel` are commented out in `BoardPage.jsx`
- [ ] **`cursor-move` still not relayed by the server** (draw/clear/delete now relay)
- [ ] **Excalidraw-parity Phases 2–10** — viewport interactions, selection,
  new tools, property panel, text/undo, shortcuts, export, realtime sync, docs
- [ ] **Persistence** — board lost on server restart; add storage (file/DB) + rooms
- [ ] **Auth** — currently one global board, random `User_NNNN` names
- [ ] **Empty placeholder files** — `UI/Button.jsx`, `UI/ColorPicker.jsx`, `hooks/useBoard.js`
- [ ] **Tests** — none yet
- [ ] **Railway usage watch** — trial $5/30 days, then only $1/mo free credit

---

## 🎯 Phase 5 target features (when reached)

- Chat panel with message list + input (backend events already emit `chat-message`)
- Live users panel (avatars, colors, cursor indicators)
- Rooms / boards (create/join by code) instead of one global board
- Persistence (save/load board; survive server restart)
- Shapes with fill + stroke controls
- Eraser that truly removes elements under cursor (currently paints white)
- Stroke-level undo for freehand (currently one undo per segment)

---

## 📄 Related files

- `AGENTS.md` — working pattern + landmines for any AI/human picking this up
- `docs/plan/PROGRESS.md` — this tracker
- `docs/plan/WORKLOG.md` — work log (commits + what was built)
- `docs/plan/PHASE_1_ANALYSIS.md` … `PHASE_7_UI_UX.md` — per-phase detail
- `docs/plan/PHASE_7_UI_UX.md` — UI overhaul plan
- `Frontend/src/utils/elementModel.js` — Excalidraw-style element model (parity Phase 1)
- `Frontend/src/utils/renderer.js` — roughjs scene renderer (parity Phase 1)
- `Frontend/src/utils/viewport.js` — screen⇄world camera math (parity Phase 1)
- `Backend/src/server.js` — active socket logic (inline)
- `Frontend/src/hooks/useSocket.js` — socket connection + emits
- `Frontend/src/hooks/useCanvas.js` — drawing logic (world coords, two layers)

---

**Last updated:** 2026-11-17
**Project:** CoLab collaborative drawing board
**Stack:** React 19 + Redux Toolkit + Tailwind v4 (Frontend) · Express 5 + Socket.io 4 (Backend)
