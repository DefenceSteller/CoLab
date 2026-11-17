# CoLab — Project Progress Tracker

> Live progress tracker for CoLab — a from-scratch collaborative drawing app.

## Current Phase: **Excalidraw-parity rebuild — Phase 10 (Docs, tests, deploy) — finalizing**

**Goal (2026-11-17, user request):** match **every tool & functionality of
excalidraw.com**. 10-phase plan (stop after each phase for review) — full
detail in `EXCALIDRAW_PARITY_PLAN.md`:

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation — element model, roughjs renderer, viewport state, two-layer canvas | ✅ **Done (2026-11-17)** |
| 2 | Viewport — wheel zoom at cursor, space/middle-drag pan, hand tool, zoom controls, fit-to-content | ✅ **Done (2026-11-17)** |
| 3 | Selection engine — click/shift-click, marquee, move/resize/rotate handles | ✅ **Done (2026-11-17)** |
| 4 | New tools — diamond, arrow, frame, laser, image, binders | ✅ **Done (2026-11-17)** |
| 5 | Property panel — colors, fill styles, stroke styles/width, roughness, opacity, fonts | ✅ **Done (2026-11-17)** |
| 6 | History + text editing — text edit-in-place, stroke-level undo, copy/paste/duplicate | ✅ **Done (2026-11-17)** |
| 7 | Shortcuts + menus — full keymap, context menu, command palette | ✅ **Done (2026-11-17)** |
| 8 | Export/import — PNG/SVG/JSON clipboard & file | ✅ **Done (2026-11-17)** |
| 9 | Realtime sync — `update-elements`/`selection`/`laser` events + room-state merge | ✅ **Done (2026-11-17)** |
| 10 | Docs, tests, production deploy | 🟡 In progress (2026-11-17) — final docs, full test pass, commit + push → Vercel/Railway auto-deploy |

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
- [x] **Excalidraw-parity Phase 2 — Viewport (2026-11-17)** — Excalidraw wheel
  semantics (plain = pan, shift = horizontal pan, ctrl/cmd + pinch = zoom at
  cursor), space-hold / middle-button / hand-tool panning, floating zoom
  widget (`ZoomControls.jsx`: − / % / + / fit-to-content), `+`/`-` zoom,
  `Shift+1` fit, grab/grabbing cursors, `panning`/`spaceHeld` viewport state.
  Verified: build clean, Phase 2 smoke 15/15, Phase 1 regression 8/8.
- [x] **Excalidraw-parity Phase 3 — Selection engine (2026-11-17)** — default
  tool flipped to `selection`; click / shift-click toggle, live marquee
  (shift = additive), group move (one undo checkpoint, final geometry emitted
  to the room), 8 rotation-aware resize handles (anchor-fixed math in the
  box's local frame; points + text font scale), rotate knob (shift = 15°
  snap), hover outline + `move` cursor, Delete/Backspace removes selection
  (synced via `delete-elements`), Escape deselects. New `utils/selection.js`
  (pure geometry), overlay renderer now draws box/handles/hover/marquee.
  Verified: build clean, Phase 3 smoke 20/20, Phase 1 regression 8/8,
  Phase 2 regression 15/15.
- [x] **Excalidraw-parity Phase 4 — New tools (2026-11-17)** — **Diamond**
  + **Arrow** toolbar buttons (geometry/render already existed). **Frame**
  tool: drag-create, auto-named `Frame N`, dragging a frame drags its
  fully-contained content (`expandWithFrames`). **Laser pointer**:
  overlay-only fading pink trail (`drawLaser`, per-segment alpha by age,
  width `(2+4a)/zoom`, 1000 ms life, rAF trim loop) — no elements, no
  history. **Image** tool: drag → aspect-fit box, click → natural size
  capped at 400px, oversized (>400k dataURL or >1200px) re-encoded via
  canvas → JPEG q0.85 (white bg, socket ~1MB limit); picker opens AFTER
  the gesture via an imperatively-created hidden `<input id=colab-image-input
  data-testid=image-input>`. **Shape binders** (`utils/binding.js`):
  arrow/line endpoints snap to shapes on creation (`applyBindings`,
  `pointOnBounds`, `findBindTarget`, `BINDABLE` excludes frames/lines,
  `BIND_GAP = 2`) and follow on move/resize/rotate (`syncBoundArrows` →
  `boundArrowChanges`, emitted as part of the move/resize/rotate emit).
  Verified: build clean, Phase 4 smoke 20/20, Phase 1 8/8, Phase 2 15/15,
  Phase 3 20/20.
- [x] **Excalidraw-parity Phase 5 — Property panel (2026-11-17)** — floating
  on-canvas panel (`PropertyPanel.jsx`, `data-testid="property-panel"`) that
  appears when `selectedIds.length > 0`. Reads the **first selected element's**
  current values (multi-select shows a representative sample; changes apply to
  ALL selected uniformly — Excalidraw behavior). Sections: **Stroke** color
  (10 swatches + custom `<input type=color>` picker), **Fill** (color swatches
  only when fill is non-transparent, 4 fill-style buttons solid/hachure/
  cross-hatch/zigzag + ⊘ no-fill — shape elements only), **Line** (solid/dashed/
  dotted stroke-style + thin/med/bold width bars), **Sketch** (A/N/C roughness),
  **Opacity** (range 0–100 + `%` label), **Font** (Sans/Mono — text elements only).
  Style changes go through new `boardSlice.setElementStyle` reducer wrapped in
  `beginHistory` (one undo step per change). Panel uses `data-testid` (not
  `data-ui`) to avoid colliding with `ZoomControls`. Debug probe
  `window.__COLAB_STORE__` added to `store.js` (dev-only, may be removed).
  Verified: build clean (1746 modules), Phase 5 smoke **14/14**, Phase 1 8/8,
  Phase 2 15/15, Phase 3 20/20, Phase 4 20/20.
- [x] **Excalidraw-parity Phase 6 — History + text editing (2026-11-17)** —
   **Text edit-in-place**: double-click on a text element opens an inline input
   pre-filled with the existing text; Enter commits (in-place update if id
   matches, else creates new); blur commits too. Double-click detection works
   by recording `lastClickRef {id,x,y,t}` on first click and deferring the move
   gesture so the second click within 500 ms / <12 px lands in the editor path
   instead of starting a drag. **Copy/paste/duplicate**: `Ctrl+C` copies selected
   ids to clipboard (with bbox center for anchor), `Ctrl+V` pastes at last cursor
   position (re-binds arrows to new ids), `Ctrl+D` duplicates selection offset
   by 20 px. **Undo/redo**: `Ctrl+Z` / `Ctrl+Shift+Z` dispatch `undo()`/`redo()`
   from boardSlice; selection is preserved across undo (elements that survived
   stay selected). History capped at 100 snapshots (FIFO); each real gesture
   (move/resize/style/text commit) captures one checkpoint via `beginHistory()`.
   Added `ctrlKey`/`metaKey` + 'a' select-all, 'c' copy, 'v' paste, 'd'
   duplicate, 'z' undo, Shift+Z redo keyboard handlers. Verified: Phase 6 smoke
   **12/12**, full regression suite **33/33** (Phases 1–6 all green).
- [x] **Excalidraw-parity Phase 7 — Shortcuts + menus (2026-11-17)** —
   **Single-letter tool shortcuts**: V/H/P/L/A/R/O/D/F/I/T/E (guarded by
   `isTyping()` so they don't fire while editing text). **Cut (Ctrl+X)**:
   copies selection to `clipboardRef` and removes it in one undo checkpoint.
   **N key → send-to-back / tie-breaker**: moves all selected elements to the
   bottom of the z-order (uses new `boardSlice.setElements` action — no
   auto-snapshot). **Right-click context menu** (`ContextMenu.jsx`): Cut /
   Copy / Paste / Duplicate / Delete + Bring-to-front / Send-to-back + Undo /
   Redo. Menu is rendered by `Canvas.jsx` (not the hook) because the
   `contextmenu` event listener needs a live DOM node — React hasn't painted
   yet when `useCanvas`'s `useEffect` runs. **Command palette** (Ctrl+K /
   Cmd+K): VS Code–style searchable overlay (`CommandPalette.jsx`) listing all
   13 tools + 8 actions; ↑↓ navigate, ↵ select, Esc close. **Zoom-with-scroll-
   wheel preference**: stored in `toolSlice.zoomWithWheel` (default OFF —
   Excalidraw makes this opt-in); toggled via a settings gear button on the
   toolbar. Exposed globals for child-component access:
   `window.__COLAB_STORE__`, `window.__COLAB_CLIPBOARD__`,
   `window.__COLAB_EMIT_DELETE`, `window.__FIT_TO_CONTENT`,
   `window.__ZOOM_STEP`. Verified: Phase 7 smoke **25/25**, full regression
   **33/33** (Phases 1–7 all green).
- [x] **Excalidraw-parity Phase 9 — Realtime sync (2026-11-17)** —
   **Backend `server.js` rewritten**: `draw` now **upserts by id** (replaces
   existing element with same id instead of appending → no duplicates after
   replays); new **`update-elements`** event for move/resize/rotate final
   state (upsert + broadcast); new **`laser-point`** event for live laser
   trail streaming; **`cursor-move`** now relayed within room (was missing on
   server — only frontend listeners existed); **`user-left`** broadcast added
   on disconnect so remaining members get the update. **Frontend
   `useSocket.js`**: new listeners for `update-elements` (dispatches
   `addElement` per item — idempotent upsert) and `laser-point` (accumulates
   into `window.__COLAB_REMOTE_LASERS`, bounded at 400); new emit helpers
   `emitUpdateElements`, `emitLaserPoint`. **`useCanvas.js`**: cursor
   position now emitted on every mousemove (throttled ~15 Hz) with
   `userId`/`username`/`tool` payload; laser points emitted individually as
   they're pushed; move/resize/rotate final state now emitted via
   `emitUpdateElements` instead of `emitDraw`. **`renderer.js`**: new
   `drawRemoteLasers` helper draws remote collaborator laser trails grouped
   by user with pink color + username label at the head. **`Canvas.jsx`**:
   passes `emitUpdateElements` through to `useCanvas`. Verified: build clean
   (1750 modules), Phase 7 smoke 25/25, Phase 8 smoke 14/14, full regression
   33/33 — 72/72 total.
   `utils/export.js` **(new)**: `serializeElements(elements, viewport)` /
   `deserializeScene(text)` for JSON round-trip; `toPngBlob(elements, {width,height})`
   renders via offscreen canvas using the same `redrawScene` pipeline with a
   computed viewport (union AABB → fit-to-rect with 24 px padding);
   `downloadFile(blob, filename)` triggers a browser download and revokes the
   object URL after 1 s; `writeImageToClipboard(blob)` wraps the Async
   Clipboard API. Globals exposed: `window.__EXPORT_PNG`,
   `window.__EXPORT_JSON`, `window.__OPEN_IMPORT_DIALOG`,
   `window.__DESERIALIZE_SCENE`. **Toolbar**: PNG / JSON export buttons +
   Import button. **Keyboard**: `Ctrl+S` = export PNG, `Ctrl+O` = open import
   dialog. **Command palette**: "Export as PNG" / "Export as JSON" /
   "Import scene" actions wired through globals. **Canvas.jsx**: import
   dialog overlay (`fixed z-[90]`) with textarea + "Open file…" + "Import" +
   "Cancel"; drag-and-drop `.json` onto canvas; paste of image data or JSON
   string (detected by MIME type / `text/plain`) dispatched via custom event
   `colab-raw-scene-json` which Canvas listens on and loads into board via
   `boardSlice.loadBoard`. Verified: Phase 8 smoke **14/14** (toolbar buttons,
   globals, PNG export, JSON export+parse, import from dialog, command palette
   shows export actions), full regression **33/33**.
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
- `docs/plan/EXCALIDRAW_PARITY_PLAN.md` — **current plan**: 10-phase
  Excalidraw-parity rebuild, status + key files
- `docs/plan/PHASE_1_ANALYSIS.md` … `PHASE_7_UI_UX.md` — **historical**:
  the original 7-phase build plan (already executed; kept for context —
  don't confuse with the parity Phases 1–10 above)
- `Frontend/src/utils/elementModel.js` — Excalidraw-style element model (parity Phase 1)
- `Frontend/src/utils/renderer.js` — roughjs scene renderer (parity Phase 1)
- `Frontend/src/utils/viewport.js` — screen⇄world camera math (parity Phase 1)
- `Backend/src/server.js` — active socket logic (inline)
- `Frontend/src/hooks/useSocket.js` — socket connection + emits
- `Frontend/src/hooks/useCanvas.js` — drawing logic (world coords, two layers)

---

**Last updated:** 2026-11-17 (Phase 6 done)
**Project:** CoLab collaborative drawing board
**Stack:** React 19 + Redux Toolkit + Tailwind v4 (Frontend) · Express 5 + Socket.io 4 (Backend)
