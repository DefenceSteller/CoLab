# CoLab — Excalidraw Parity Plan (10 Phases)

> **Goal:** give CoLab every tool & functionality of https://excalidraw.com.
> Agreed 2026-11-17. Work proceeds phase-by-phase; **we stop after each
> phase for review.** Nothing is committed until the final deploy step (10).

> ⚠️ **Note on numbering:** `PHASE_1_ANALYSIS.md` … `PHASE_7_UI_UX.md` in
> this folder are the **original build plan** (already executed — analysis,
> architecture, first drawing engine, rooms, deploys, UI overhaul). This
> file is the **current plan**. "Phase N" in recent worklog/progress entries
> refers to *this* plan, not the old files.

## Style direction

Gen Z neobrutalism: chunky `2px` ink borders, hard offset shadows
(`shadow-[Npx_Npx_0_#101014]`), lime/purple/pink accents, Space Grotesk,
cream backgrounds, Tailwind v4. Conventions: `.tool-btn` (toolbar/widget
buttons), `.swatch` (color chips) in `Frontend/src/index.css`.

## Phase status

| # | Phase | Status | Summary |
|---|-------|--------|---------|
| 1 | **Foundation** | ✅ Done 2026-11-17 | Excalidraw-shaped element model (`elementModel.js`), **roughjs** renderer (`renderer.js`), viewport math + `viewportSlice`, two stacked canvases (base = committed / overlay = interaction, DPR-aware), world-coordinate pointer pipeline in `useCanvas`, eraser removes + syncs via new `delete-elements` socket event, legacy `{from,to}` ingest |
| 2 | **Viewport** | ✅ Done 2026-11-17 | Excalidraw wheel semantics: plain wheel = pan, shift = horizontal pan, ctrl/cmd (+ trackpad pinch) = zoom at cursor; space-hold / middle-button / hand-tool panning; floating `ZoomControls` widget (− / % / + / fit); `+`/`-` zoom, `Shift+1` fit-to-content; grab/grabbing cursors |
| 3 | **Selection engine** | ✅ Done 2026-11-17 | default tool = Select · click / shift-click toggle · marquee (shift = additive, live) · drag-move (group, one undo step) · 8 rotation-aware resize handles (anchor-fixed, points/font scale) · rotate knob (shift = 15° snap) · hover outline + `move` cursor · Delete removes selection (synced) · Escape deselects · final geometry emitted to room |
| 4 | **New tools** | ✅ Done 2026-11-17 | diamond + arrow toolbar buttons · **Frame** tool (drag-create, auto-named `Frame N`, dragging a frame moves fully-contained content) · **Laser pointer** (overlay-only fading pink trail, 1000 ms life, rAF trim, no elements/history) · **Image** tool (drag → aspect-fit box, click → natural size capped at 400px, >400k dataURL or >1200px re-encoded to JPEG q0.85, picker opens AFTER the gesture) · **Shape binders** — arrow/line endpoints snap to shapes on creation and follow on move/resize/rotate |
| 5 | **Property panel** | ✅ Done 2026-11-17 | floating on-canvas panel (`PropertyPanel.jsx`, `data-testid="property-panel"`), appears when `selectedIds.length > 0`; reads the **first selected element's** values, changes apply to ALL selected uniformly. Sections: Stroke color (10 swatches + custom picker), Fill (color swatches + 4 fill-style buttons + ⊘ no-fill, shapes only), Line (solid/dashed/dotted + thin/med/bold width), Sketch (A/N/C roughness), Opacity (range + % label), Font (Sans/Mono, text only). Style changes → `boardSlice.setElementStyle` wrapped in `beginHistory` (one undo step). Panel uses `data-testid` (not `data-ui`) to avoid colliding with `ZoomControls` |
| 6 | **History + text** | ✅ Done 2026-11-17 | edit-in-place text (double-click opens inline editor pre-filled with existing text, Enter commits via id-match for in-place update), stroke-level undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`, selection preserved across undo), copy/paste/duplicate (`Ctrl+C` / `Ctrl+V` / `Ctrl+D`, paste re-binds arrow endpoints), select-all (`Ctrl+A`). History capped at 100 snapshots. Double-click detection defers move-gesture start on text elements; hit-testing runs before handle-check so second click doesn't hit a resize handle |
| 7 | **Shortcuts + menus** | ✅ Done 2026-11-17 | single-letter tool shortcuts (V/H/P/L/A/R/O/D/F/I/T/E, guarded by `isTyping()`), **Cut (Ctrl+X)** — copies selection to clipboard + removes in one undo checkpoint, **N key → send-to-back / tie-breaker** (uses new `boardSlice.setElements` action, no auto-snapshot), **right-click context menu** (`ContextMenu.jsx`: Cut/Copy/Paste/Duplicate/Delete + Bring-to-front/Send-to-back + Undo/Redo — rendered by `Canvas.jsx` not the hook because the `contextmenu` listener needs a live DOM node), **command palette** (Ctrl+K / Cmd+K, `CommandPalette.jsx`: searchable list of all 13 tools + 8 actions, ↑↓ navigate, ↵ select, Esc close), **zoom-with-scroll-wheel preference** (`toolSlice.zoomWithWheel`, default OFF — Excalidraw makes this opt-in, toggled via settings gear on the toolbar). Globals exposed for child-component access: `__COLAB_STORE__`, `__COLAB_CLIPBOARD__`, `__COLAB_EMIT_DELETE`, `__FIT_TO_CONTENT`, `__ZOOM_STEP`. Verified: Phase 7 smoke **25/25**, full regression **33/33** |
| 8 | **Export / import** | ✅ Done 2026-11-17 | `utils/export.js` (new): `serializeElements(elements, viewport)` / `deserializeScene(text)` for JSON round-trip; `toPngBlob(elements, {width,height})` renders via offscreen canvas using same `redrawScene` pipeline with computed viewport (union AABB → fit-to-rect, 24 px padding); `downloadFile(blob, filename)` triggers browser download + URL revocation after 1 s. Globals: `__EXPORT_PNG`, `__EXPORT_JSON`, `__OPEN_IMPORT_DIALOG`, `__DESERIALIZE_SCENE`. Toolbar: PNG / JSON export buttons + Import button. Keyboard: Ctrl+S = export PNG, Ctrl+O = import dialog. Command palette actions wired. Canvas.jsx: import dialog overlay (fixed z-[90]) with textarea + "Open file…" + "Import" + "Cancel"; drag-and-drop .json onto canvas; paste of image data or JSON string dispatched via custom event `colab-raw-scene-json` which Canvas listens on and loads into board via `boardSlice.loadBoard`. Verified: Phase 8 smoke 14/14, full regression 33/33 |
| 9 | **Realtime sync** | ✅ Done 2026-11-17 | `update-elements` / `laser-point` / `cursor-move` events, room-state merge on rejoin, remote collaborator cursors + laser trails rendered on overlay, server upsert-by-id prevents duplicates after replays |
| 10 | **Docs, tests, deploy** | ✅ Done 2026-11-17 | final docs, full test pass, commit + push → Vercel/Railway auto-deploy |

## Key files

| File | Role |
|------|------|
| `Frontend/src/utils/elementModel.js` | element schema, `createElement`, legacy ingest, bounds, hit-testing |
| `Frontend/src/utils/selection.js` | selection box, handle positions, marquee hits, resize/rotate transforms (Phase 3) |
| `Frontend/src/utils/renderer.js` | roughjs renderer + drawable cache (base/overlay layers) |
| `Frontend/src/utils/viewport.js` | `screen = world * zoom + offset`, zoom-at-point, fit-to-bounds |
| `Frontend/src/utils/binding.js` | shape binders — `pointOnBounds`, `findBindTarget`, `applyBindings`, `boundArrowChanges` (Phase 4) |
| `Frontend/src/store/slices/viewportSlice.js` | camera state (zoom/offset/panning/spaceHeld) |
| `Frontend/src/store/slices/boardSlice.js` | elements, selection, history checkpoints, `setElementStyle` (Phase 5) |
| `Frontend/src/store/store.js` | Redux store + `window.__COLAB_STORE__` debug probe |
| `Frontend/src/store/slices/toolSlice.js` | active tool + Excalidraw style fields |
| `Frontend/src/hooks/useCanvas.js` | all pointer/wheel/keyboard gestures |
| `Frontend/src/components/Board/Canvas.jsx` | two canvas layers, cursors, inline text editor |
| `Frontend/src/components/Board/ZoomControls.jsx` | bottom-left zoom widget |
| `Frontend/src/components/Board/Toolbar.jsx` | tool + color + size buttons |
| `Frontend/src/hooks/useSocket.js` | socket singleton, listeners, emits |
| `Backend/src/server.js` | room state + relays (`draw`, `delete-elements`, `clear-board`, …) |

## Verified so far

- **Phase 1:** build clean · puppeteer smoke 8/8 · headed-Chrome text check ·
  socket protocol 6/6 (create/join, draw relay, delete relay, room-state pruning)
- **Phase 2:** build clean · Phase 2 smoke 15/15 (zoom widget, wheel pan/zoom,
  hand/space pan, fit) · Phase 1 regression 8/8
- **Phase 3:** build clean · Phase 3 smoke 20/20 (default Select, hover cursor,
  click-select, move, Escape, marquee, shift-toggle, group move, SE resize,
  rotate knob, Delete + Undo, zero errors) · Phase 1 regression 8/8 ·
  Phase 2 regression 15/15
- **Phase 4:** build clean · Phase 4 smoke 20/20 (diamond, arrow, frame,
  laser trail visible during drag → fully faded after 1.5 s, image insert
  via hidden file input, arrow endpoint followed the moved rect —
  minX 594 → 694, zero errors) · Phase 1 regression 8/8 · Phase 2
  regression 15/15 · Phase 3 regression 20/20
- **Phase 5:** build clean · Phase 5 smoke 14/14 (panel appears on select,
  fill-style buttons, 10 stroke swatches, opacity slider + label, 3 width
  bars, roughness A/N/C, panel gone after erase, text select shows Font
  section + Mono clickable, hachure style change applied to selected element,
  zero errors) · Phase 1 regression 8/8 · Phase 2 regression 15/15 ·
  Phase 3 regression 20/20 · Phase 4 regression 20/20
- **Phase 6:** build clean · Phase 6 smoke 12/12 (text commit, double-click
   editor opens with existing text, edit-in-place updates text, Ctrl+D duplicates
   and selects, Ctrl+C/V copies/pastes including arrow re-binds, delete all empties
   board, undo restores elements, history cap respected at <100) · full
   regression 33/33 (Phases 1–6 green, zero page/console errors)

## Test harness (dev)

- Backend: `node Backend/src/server.js` → :5000 · Frontend: `npm run dev` → :5173
- Puppeteer scripts in `C:\Users\Admin\AppData\Local\Temp\opencode\`
  (`phase1-smoke.js`, `phase2-smoke.js`, `phase1-protocol.cjs`, `phase1-headed.js`),
  run from `...\Temp\opencode\puppetest` (puppeteer-core + system Chrome)
- Gotcha: Chrome's *trusted* mousedown default focus action yanks focus from
  the freshly-mounted inline text editor → fixed with `preventDefault()` on
  canvas mousedown (see `useCanvas.js`)
