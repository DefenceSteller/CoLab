# CoLab — Work Log

> Tracks what was built, when, and how on CoLab.

## Status: Excalidraw-parity rebuild — Phase 10 (Docs, tests, deploy) — finalizing

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

### 2026-11-17 — **Excalidraw-parity Phase 4 (New tools) built & verified**

**Shipped (uncommitted, with Phases 1–3):**
- **`utils/binding.js` (new)** — shape binders: `pointOnBounds`,
  `findBindTarget` (only binds to rectangle/ellipse/diamond/text/image,
  not frames or lines; `BIND_GAP = 2`), `applyBindings` (snap endpoints
  on creation before `addElement` + `normalizeBounds`), `boundArrowChanges`
  (recompute bound endpoints when targets move/resize/rotate).
- **`useCanvas.js` Phase 4 wiring:** removed inert-tools guard (no more
  `INERT_TOOLS`); laser (`pushLaser` with rAF trim loop, `LASER_LIFE =
  1000`); image tool (`pickImage` creates imperatively a hidden `<input
  id=colab-image-input data-testid=image-input>`, opens AFTER the gesture,
  `placeImage` reads via FileReader, re-encodes giants via canvas → JPEG
  q0.85 on white bg, caps natural size at 400px); frame tool (auto-named
  `Frame N`, drag-create); image preview during drag (`dashed violet
  rectangle`); frame content expansion (`expandWithFrames`) on move
  gestures; `syncBoundArrows` called after each move/resize/rotate dispatch,
  bound ids emitted too; `boundIds: new Set()` in move/resize/rotate
  gesture constructors.
- **`renderer.js`:** `drawLaser(ctx, points, zoom, now)` — pink `#ec4899`,
  per-segment alpha from age, width `(2+4*a)/zoom`; `redrawOverlay` accepts
  and renders `laser` array of `{x,y,t}` points.
- **`Toolbar.jsx`:** Arrow (`ArrowUpRight`), Diamond (`Diamond`), Frame
  (`Frame`), Image (`Image as Fortune`), Laser (`Zap`) buttons added.

**Debug note:** phase-4 smoke failed first on the image test — BMP
  fixture had swapped endianness in CRCs (`writeUInt32LE` instead of
  `writeUInt32BE` for PNG chunk lengths; also CRCs were little-endian but
  stored big-endian, giving mismatches). Chrome rejected the malformed
  PNG silently via `onerror`. Fixed by generating a correct PNG (proper
  big-endian lengths + CRCs). All 20/20 green after that. Also added
  mild `console.warn` on `img.onerror` / `reader.onerror` for future
  debugging.

**Verified:** `vite build` clean (1745 modules) · **Phase 4 smoke 20/20**
(diamond paints correctly within drag box, arrow horizontal span and
endpoint detection, frame crisp border + edges near expected coords,
laser trail visible during drag then fully faded after 1.5 s, hidden
input created + image rendered via uploadFile, arrow endpoint followed
moved rect minX 594→694, zero page errors) · **Phase 1 regression 8/8**
· **Phase 2 regression 15/15** · **Phase 3 regression 20/20**.

**Next:** Phase 6 — history + text editing (edit-in-place, stroke-level undo, copy/paste).

### 2026-11-17 — **Excalidraw-parity Phase 5 (Property panel) built & verified**

**Shipped (uncommitted, with Phases 1–4):**
- **`components/Board/PropertyPanel.jsx` (new)** — floating on-canvas panel
  (`data-testid="property-panel"`, NOT `data-ui` — that collides with
  `ZoomControls`). Appears when `selectedIds.length > 0`. Reads the **first
  selected element's** current values; multi-select shows a representative
  sample and changes apply to ALL selected uniformly (Excalidraw behavior).
  Sections: **Stroke** (10 color swatches + custom `<input type=color>`
  picker), **Fill** (color swatches only when fill ≠ transparent, 4 fill-style
  buttons solid/hachure/cross-hatch/zigzag + ⊘ no-fill — shape elements only),
  **Line** (solid/dashed/dotted stroke-style + thin/med/bold width bars),
  **Sketch** (A/N/C roughness), **Opacity** (range 0–100 + `%` label), **Font**
  (Sans/Mono — text elements only).
- **`store/slices/boardSlice.js`** — new `setElementStyle` reducer (applies
  `changes` to every id in `ids`, bumps `version`) + export.
- **`store/slices/toolSlice.js`** — existing style reducers
  (`setColor`/`setBackgroundColor`/`setFillStyle`/`setStrokeStyle`/
  `setStrokeWidth`/`setRoughness`/`setOpacity`/`setFontFamily`) used by the
  panel; `setStyles` applies a batch to tool defaults.
- **`store/store.js`** — `window.__COLAB_STORE__ = store` debug probe
  (dev-only; used by smoke tests to read Redux state directly).
- **`Canvas.jsx`** — imports `PropertyPanel`, renders it when
  `selectedIds.length > 0`.
- Style changes go through `dispatch(beginHistory())` → `dispatch(setElementStyle)`
  (one undo step per change). Phase 9 formalizes remote sync for styles.

**Verified:** `vite build` clean (1746 modules) · **Phase 5 smoke 14/14**
(panel appears on select, fill-style buttons, 10 stroke swatches, opacity slider
+ label, 3 width bars, roughness A/N/C, panel gone after erase, text select
shows Font section + Mono clickable, hachure style change applied to selected
element) · **Phase 1 regression 8/8** · **Phase 2 regression 15/15** ·
**Phase 3 regression 20/20** · **Phase 4 regression 20/20**.

### 2026-11-17 — **Excalidraw-parity Phase 6 (History + text editing) built & verified**

**Shipped (uncommitted, with Phases 1–5):**
- **`useCanvas.js`** — double-click on text element enters edit-in-place mode:
  first click records `lastClickRef {id,x,y,t}` and selects without starting
  move gesture; second click within 500 ms / <12 px distance opens inline input
  pre-filled with existing text (`hit.id` reused so `commitText()` updates in
  place instead of creating a new element). Non-text elements still start move
  gesture immediately on first click. **Copy/paste/duplicate**: `Ctrl+C` copies
  selected ids + bbox center to clipboard; `Ctrl+V` pastes at last cursor
  position (re-binds arrow endpoints to new ids); `Ctrl+D` duplicates selection
  offset by 20 px. **Undo/redo**: `Ctrl+Z` / `Ctrl+Shift+Z` dispatch
  `undo()`/`redo()` from boardSlice; selection is preserved across undo (surviving
  elements stay selected). Added `ctrl+a` select-all handler.
- **`store/slices/boardSlice.js`** — `undo`/`redo` reducers now preserve
  `selectedIds` filtered to surviving element ids (was: clearing selection on
  every undo/redo). `setElementStyle` exported for property panel use.
- Keyboard shortcuts added: `ctrl/cmd+c` copy, `ctrl/cmd+v` paste, `ctrl/cmd+d`
  duplicate, `ctrl/cmd+z` undo, `ctrl/cmd+shift+z` redo, `ctrl/cmd+a` select all.

**Debug note:** initial double-click implementation failed because the first
click on a text element started a move gesture immediately, so the second click
was handled by the move handler before double-click detection could fire. Fix:
record `lastClickRef` on first click and return early (just selecting), only
starting the move gesture on subsequent pointer movement. Also restructured
selection-tool `startDrawing` so hit-testing runs BEFORE handle-checking, since
a newly-selected element's resize handles would intercept the second click.

**Verified:** `vite build` clean (1746 modules) · **Phase 6 smoke 12/12**
(text commit, double-click editor appears, edit-in-place updates text, ctrl+D
duplicates and selects, ctrl+c/v copies/pastes, delete all empties board, undo
restores elements and respects history cap) · **full regression 33/33** (Phases
1–6 green).

**Next:** Phase 7 — full keymap, context menu, command palette.

### 2026-11-17 — **Excalidraw-parity Phase 3 (Selection engine) built & verified**

**Shipped (uncommitted, with Phases 1–2):**
- **`utils/selection.js` (new, pure geometry)** — selection box (single
  element keeps its rotation; multi = AABB union), 8 handle + rotate-knob
  world positions (constant screen-size via zoom), handle hit-testing,
  marquee intersection, **resize** (works in the box's *local* frame: the
  anchor corner stays fixed in world space while everything scales toward
  the pointer; edge handles lock an axis; points scale, text font scales,
  angle untouched) and **rotate** (centers swing around the box center,
  delta normalized to ±π, shift → 15° snap). All transforms read a
  gesture-start `origs` map → per-frame calls are **absolute, not
  cumulative** (first draft mutated live elements and double-applied
  on frame 2 — caught in review before testing).
- **Selection gestures in `useCanvas.js`** — handle hit first, then
  element hit (shift = toggle, no drag), then empty space → marquee
  (non-shift clears first; shift keeps base selection and unions).
  Move/resize/rotate capture `origs` at mousedown and only
  `beginHistory()` on the **first real delta** (pure clicks don't pollute
  undo). Mouseup emits final geometry per id (remote `addElement` upserts
  by id — formalized as `update-elements` in Phase 9).
- **Overlay renderer** — `redrawOverlay(canvas, {preview, hover, marquee,
  selection})`: violet hover outline, tinted dashed marquee, selection
  box + 8 white/ink square handles + rotate knob with stem — all sized
  in screen px (`1/zoom`) so zooming doesn't grow them.
- **Keyboard** — Escape deselects; Delete/Backspace removes the selection
  (`beginHistory` + `removeElements` + `emitDelete`); both exempt while
  typing in inputs.
- **Defaults** — `activeTool: 'selection'` (Excalidraw's default); toolbar
  leads with **Select** (`MousePointer2`); `move` cursor over hoverable
  elements; hover tracked with a bail-out state setter (no rerender when
  unchanged).
- `resize()` / overlay effect call sites updated to the new payload shape;
  `hoverId` returned from the hook for the cursor.

**Verified:** `vite build` clean (1744 modules) · **Phase 3 smoke 20/20**
(default Select, hover `move`/`default` cursors, click-select draws box,
drag moves A only, Escape clears overlay, marquee selects both, shift+click
toggles off/on, group move follows, SE handle resize anchored NW, rotate
knob swings geometry, Delete empties the board + overlay, Undo restores,
zero page errors) · **Phase 1 regression 8/8** · **Phase 2 regression
15/15** (both suites updated: first drag now picks the Draw tool explicitly
since the default flipped to selection).

**Note:** one test expectation was corrected, not the code — rotating two
corner-squares about the union center moves the *top* ink down while the
*left* ink swings out; assertion now checks the leftward swing.

**Next:** Phase 4 — new tools (diamond, arrow, frame, laser pointer,
image insert, shape binders).

### 2026-11-17 — **Excalidraw-parity Phase 7 (Shortcuts + menus) built & verified**

**Shipped (uncommitted, with Phases 1–6):**

- **Single-letter tool shortcuts** — `useCanvas.js` keyboard handler: V=Select,
  H=Hand, P=Draw, L=Line, A=Arrow, R=Rect, O=Ellipse, D=Diamond, F=Frame,
  I=Image, T=Text, E=Eraser. Guarded by `isTyping()` so they don't fire while
  editing text or inside the inline editor.
- **Cut (Ctrl+X)** — copies selected ids to `clipboardRef` (with bbox center for
  anchor) **and** removes them in one undo checkpoint (`beginHistory` +
  `removeElements` + `emitDelete`). Mirrors Excalidraw.
- **N key → send-to-back / tie-breaker** — moves all selected elements to the
  bottom of the z-order. Uses new `boardSlice.setElements` action (pure
  replace, no auto-snapshot — callers wrap in `beginHistory` themselves).
- **Right-click context menu** — `ContextMenu.jsx`: Cut / Copy / Paste /
  Duplicate / Delete + Bring-to-front / Send-to-back + Undo / Redo.
  **Rendered by `Canvas.jsx`, not `useCanvas`** — the `contextmenu` event
  listener needs a live DOM node, and React hasn't painted yet when the hook's
  `useEffect` runs (verified: `containerRef.current` was null inside the hook,
  so the listener never attached). Menu dismisses on Escape, outside click, or
  command execution. Uses `selIdsRef` so actions read the selection at
  execution time, not at mount time.
- **Command palette** — `CommandPalette.jsx`: VS Code–style searchable overlay
  opened by Ctrl+K / Cmd+K. Lists all 13 tools + 8 actions (Cut/Copy/Paste/
  Duplicate/Delete/Select All/Undo/Redo/Fit/Zoom in/Zoom out). ↑↓ navigate,
  Enter selects, Esc closes, click-outside dismisses. Filters live as you type
  (matches label or shortcut).
- **Zoom-with-scroll-wheel preference** — `toolSlice.zoomWithWheel` (default
  **OFF** — Excalidraw makes this opt-in). When ON, plain wheel zooms at the
  canvas center instead of panning. Toggled via a settings gear button on the
  toolbar (`Toolbar.jsx`).
- **Globals exposed for child-component access** — `window.__COLAB_STORE__`
  (already existed), `window.__COLAB_CLIPBOARD__` (clipboard ref),
  `window.__COLAB_EMIT_DELETE` (socket emit helper),
  `window.__FIT_TO_CONTENT` (viewport fit), `window.__ZOOM_STEP` (zoom by
  factor). These let `ContextMenu` / `CommandPalette` dispatch Redux actions
  and emit socket events without prop-drilling through `Canvas`.

**Verified:** `vite build` clean (1748 modules) · **Phase 7 smoke 25/25**
(tool shortcuts, context menu open+dismiss, command palette open+filter+close,
zoomWithWheel toggle, Ctrl+X cut, N-key send-to-back, zero page errors) ·
**full regression 33/33** (Phases 1–7 all green — 58/58 total).

**Docs:** `PROGRESS.md` Phase 7 ✅, `EXCALIDRAW_PARITY_PLAN.md` row 7 ✅,
`WORKLOG.md` this entry.

**Next:** Phase 8 — Export/import (PNG/SVG/JSON clipboard & file).

---

### 2026-11-17 — **Excalidraw-parity Phase 8 (Export/import) built & verified**

**Shipped (uncommitted, with Phases 1–7):**

- **`utils/export.js` (new)** — `serializeElements(elements, viewport)` /
  `deserializeScene(text)` for JSON round-trip; `toPngBlob(elements, {width,height})`
  renders via offscreen canvas using the same `redrawScene` pipeline with a
  computed viewport (union AABB → fit-to-rect with 24 px padding);
  `downloadFile(blob, filename)` triggers a browser download and revokes the
  object URL after 1 s; `writeImageToClipboard(blob)` wraps the Async Clipboard API.
- **Globals exposed**: `window.__EXPORT_PNG`, `window.__EXPORT_JSON`,
  `window.__OPEN_IMPORT_DIALOG`, `window.__DESERIALIZE_SCENE`.
- **Toolbar**: PNG export button (`title="Export view as PNG (Ctrl+S)"`),
  JSON export button, Import button.
- **Keyboard shortcuts**: Ctrl+S = export PNG, Ctrl+O = open import dialog.
- **Command palette**: added "Export as PNG" / "Export as JSON" /
  "Import scene" actions wired through globals.
- **Canvas.jsx**: import dialog overlay (`fixed inset-0 z-[90]`) with textarea,
  "Open file…" label (hidden `<input type=file accept=".json">`), "Import"
  button, and "Cancel". Drag-and-drop of `.json` onto canvas dispatches
  `colab-raw-scene-json`; paste of image data or JSON string also handled.
  Canvas listens on `colab-raw-scene-json` and loads into board via
  `boardSlice.loadBoard` + `viewport/setViewport`.

**Verified:** `vite build` clean (1750 modules) · **Phase 8 smoke 14/14**
(toolbar buttons present, globals exposed, PNG export creates file, JSON
export valid + contains rectangle, scene imported from dialog, command
palette shows export options, zero page errors) · **full regression 33/33**
(Phases 1–8 all green — 47/47 total).

**Docs:** `PROGRESS.md` Phase 8 ✅, `EXCALIDRAW_PARITY_PLAN.md` row 8 ✅,
`WORKLOG.md` this entry.

**Next:** Phase 9 — Realtime sync (`update-elements` / `selection` / `laser`
events, room-state merge on rejoin, cursor rendering, conflict-safe versioning).

---

### 2026-11-17 — **Excalidraw-parity Phase 9 (Realtime sync) built & verified**

**Shipped (uncommitted, with Phases 1–8):**

- **Backend `server.js` rewritten**:
  - `draw` now **upserts by id** — replaces any existing element with the
    same id instead of appending, so replays are clean (no duplicates).
  - New **`update-elements`** event: upserts by id + broadcasts to room.
    Used for move/resize/rotate final state.
  - New **`laser-point`** event: each laser point streamed live to the room
    so collaborators see the trail grow.
  - **`cursor-move`** now relayed within room (was missing on the server —
    only frontend listeners existed, so cursors were never shared).
  - **`user-left`** broadcast added on disconnect so remaining members get
    the update (previously only `room-users` was emitted on leave).
- **Frontend `useSocket.js`**:
  - New listeners: `update-elements` (dispatches `addElement` per item —
    idempotent upsert, no duplicates), `laser-point` (accumulates into
    `window.__COLAB_REMOTE_LASERS`, bounded at 400).
  - New emit helpers: `emitUpdateElements`, `emitLaserPoint`.
- **`useCanvas.js`**:
  - Cursor position now emitted on every mousemove (throttled ~15 Hz) with
    `userId`/`username`/`tool` payload.
  - Laser points emitted individually as they're pushed.
  - Move/resize/rotate final state now emitted via `emitUpdateElements`
    instead of `emitDraw`.
- **`renderer.js`**: new `drawRemoteLasers` helper draws remote collaborator
  laser trails grouped by user with pink color + username label at the head.
- **`Canvas.jsx`**: passes `emitUpdateElements` through to `useCanvas`.

**Verified:** `vite build` clean (1750 modules) · Phase 7 smoke 25/25 ·
Phase 8 smoke 14/14 · full regression 33/33 — **72/72 total**.

**Docs:** `PROGRESS.md` Phase 9 ✅, `EXCALIDRAW_PARITY_PLAN.md` row 9 ✅,
`WORKLOG.md` this entry.

**Next:** Phase 10 — Docs, tests, deploy (final docs, full test pass,
commit + push → Vercel/Railway auto-deploy).

---


**Shipped (uncommitted, with Phase 1):**
- **Excalidraw wheel semantics** (verified against Excalidraw source/search):
  plain wheel = pan · shift+wheel = horizontal pan · ctrl/cmd+wheel (and
  trackpad pinch) = zoom at cursor · page-scroll hijack prevented · wheel
  ignored over inline editor / floating UI (`input, [data-ui]` guard).
  "Zoom with scroll wheel" is an opt-in Excalidraw preference → deferred to
  Phase 7 (menus).
- **Panning** — space-hold drag, middle-button drag (also kills Chrome
  autoscroll), and the new **Hand** tool (first button in the toolbar).
  `viewportSlice` gained `panning`/`spaceHeld` + actions; `draw()` handles a
  `pan` gesture in screen-space deltas.
- **`ZoomControls.jsx` (new)** — floating bottom-left widget: − /
  % (click = reset 100%) / + / fit-to-content, neobrutal `.tool-btn` style,
  marked `data-ui` so canvas gestures ignore it.
- **Shortcuts** — `+`/`=` zoom in, `-`/`_` zoom out (center-anchored),
  `Shift+1` = fit-to-content, Space = temporary pan (released on keyup or
  window blur; typing in inputs is exempt).
- **`fitViewportToElements`** added to `viewport.js` (union bounds → camera).
- **Cursors** — `grabbing` while panning, `grab` while space held.
- Removed `hand` from `INERT_TOOLS`; toolbar now leads with the Hand button.

**Verified:** `vite build` clean (1743 modules) · **Phase 2 smoke 15/15**
(initial 100% zoom, ctrl+wheel zoom, plain-wheel no-zoom pan, zoom buttons +
reset, hand pan, space-pan, Shift+1 fit, zero page errors) · **Phase 1
regression 8/8**. (One early smoke run had a transient 0-px first stroke —
first-run timing after HMR; identical debug drag + re-runs pass consistently.)

**Docs:** created `docs/plan/EXCALIDRAW_PARITY_PLAN.md` (the current 10-phase
plan + status + key files) and marked `PHASE_1..7_*.md` as the **historical**
original plan in `PROGRESS.md`, so an outsider isn't confused by the two
phase-numbering schemes. `PROGRESS.md` updated (Phase 2 ✅, Phase 3 next).

**Next:** Phase 3 — selection engine (click/shift-click, marquee, move /
resize / rotate handles; default tool flips to `selection`).

### 2026-11-17 — **Excalidraw-parity plan: Phase 1 (Foundation) built & verified**

**Goal (user request):** give CoLab every tool/functionality Excalidraw has.
10-phase plan agreed: 1 Foundation · 2 Viewport · 3 Selection · 4 New tools ·
5 Property panel · 6 History+text · 7 Shortcuts+menus · 8 Export/import ·
9 Realtime sync · 10 Docs/tests/deploy. **Phase 1 = done this session.**

**Built:**
- `utils/elementModel.js` **(new)** — Excalidraw-shaped elements (`id`,
  `x/y/width/height`, `angle`, `points[]`, `strokeColor/backgroundColor/
  fillStyle/strokeWidth/strokeStyle/opacity/roughness`, `text/fontSize/
  fontFamily/textAlign`, `seed/version`), `createElement`, legacy
  `{type,from,to}` ingest (`normalizeElement`/`normalizeScene`, merges old
  pencil segments into multi-point strokes + **dedupes by id** for live
  chunks replayed on rejoin), bounds + rotation-aware hit-testing.
- `utils/viewport.js` **(new)** — `screen = world * zoom + offset` math,
  zoom clamp 0.1–4, `zoomAtScreenPoint`, `viewportForBounds`.
- `utils/renderer.js` **(new)** — **roughjs** renderer (same lib Excalidraw
  uses): drawable cache keyed by style+geometry (x/y/angle via ctx transform,
  4000-entry LRU-ish), dashed/dotted via `strokeLineDash`, arrow V-heads,
  lazy image cache, crisp frames. **Replaces `drawingTools.js` (deleted).**
- `store/slices/viewportSlice.js` **(new)** — camera state (zoom/offset).
- `store/slices/boardSlice.js` — `selectedIds`, `updateElements` (batch, no
  auto-snapshot), `removeElements`, `beginHistory` (capped 100), selection
  actions; gestures checkpoint once via `beginHistory()`.
- `store/slices/toolSlice.js` — Excalidraw tool/style fields (fill, stroke
  style/width, roughness, opacity, font, align) + setters.
- `hooks/useCanvas.js` **rewritten** — world-coordinate pointer pipeline,
  two-layer redraw (base = committed, overlay = live preview), freedraw grows
  one element (throttled 50 ms live emit, same id → remote upsert), shapes
  preview-then-commit, **eraser hit-tests + removes elements** (synced via new
  `delete-elements` socket event), inline text editor anchored in world coords.
- `components/Board/Canvas.jsx` **rewritten** — two stacked `<canvas>` layers,
  DPR-aware sizing + `ResizeObserver`, tool cursors, text editor positioned
  through the viewport transform.
- `components/Board/Toolbar.jsx` — tool ids → new model
  (`freedraw/line/rectangle/ellipse/text/eraser`); size slider drives
  brush + shape stroke width.
- `Backend/src/server.js` — additive **`delete-elements`** relay: prunes room
  state by id + broadcasts to the room (old clients ignore it).
- `hooks/useSocket.js` — `delete-elements` listener + `emitDeleteElements`.

**Landmine found & fixed (text tool):** trusted-mousedown default focus
handling in Chrome can run **after** React mounts the inline text input →
yanks focus → `onBlur` → empty `commitText()` → editor vanished untyped
(reproduced headed + headless; synthetic JS mousedown did NOT trigger it).
Fix: `preventDefault()` on container mousedown (Excalidraw does the same),
with a guard so clicks inside the editor input itself still work.

**Verified:** `vite build` clean · puppeteer smoke **8/8** (two canvases,
freedraw, rect, ellipse, text commit, eraser removes, undo restores, zero
console errors) · headed-Chrome text check PASS · socket protocol test
**6/6** (room create/join, draw relay, delete-elements relay, room-state
pruning). Dev servers: backend :5000, vite :5173.

**Next:** Phase 2 — viewport interactions (wheel zoom at cursor, space/middle
drag pan, hand tool, zoom controls, fit-to-content).

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

**Push-to-deploy FIXED (same day):** every git-push build had *always* failed
(`BUILD_UTILS_SPAWN_127: vite: command not found`) — Vercel was building at the
**repo root**, which has no `package.json` (monorepo: code lives in
`Frontend/`). All previous "Ready" deployments were manual CLI deploys (no git
SHA). Fix: set project **Root Directory = `Frontend`** (Vercel API
`PATCH /v9/projects/{id}`). Verified: redeploy of the fix commit built from git
in 15s, auto-aliased to `colab-gold.vercel.app`, bundle contains the
`parseAck` fix + Railway URL.

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

**Last updated:** 2026-11-17 (Phase 9 done)
**Project:** CoLab collaborative drawing board
**From:** empty repo → React + Socket.io real-time drawing prototype
**To:** (planned) full collaborative whiteboard with chat, rooms, persistence, auth
