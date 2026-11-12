# Phase 3: Core Drawing Engine

**Status:** 🟡 Mostly done (~85%)
**Started:** 2026-11-11

> The local drawing experience: canvas, tools, rendering, and the drawing hook.
> This is the foundation everything else builds on.

## 3.1 Canvas

- `components/Board/Canvas.jsx` — `<canvas>` that fills its container.
- Responsive: resizes to parent width/height on window resize.
- Input: mouse **and** touch events (mobile-friendly).

## 3.2 Tools

Implemented in `Toolbar.jsx` + `useCanvas.js` + `drawingTools.js`:

| Tool | Status |
|------|--------|
| Pencil | ✅ freehand strokes (segments committed to Redux → survive resize/remote redraws) |
| Line | ✅ one straight line per drag (preview while dragging, committed on mouseup) |
| Rectangle | ✅ one rect per drag, fitted to the drag box |
| Circle | ✅ one ellipse per drag, fitted to the drag box |
| Text | ✅ inline input overlay on the canvas (Enter = place, Esc = cancel) — no `prompt()` |
| Eraser | ✅ paints white over strokes (true element-removal eraser still future work) |

Plus: color palette (10 swatches) + native color picker, brush size slider (1–50).

## 3.3 Rendering

`utils/drawingTools.js`:
- `drawElement(ctx, element)` — switch on tool type, draws one element.
- `redrawCanvas(ctx, w, h, elements)` — clear + redraw all (called when `elements` changes).
- `createElement(...)` — helper to build an element object.

## 3.4 Drawing hook

`hooks/useCanvas.js` (rewritten 2026-11-12):
- `startDrawing` / `draw` / `stopDrawing` — mousedown/move/up/out + touch equivalents.
- **Shape tools** (`line`, `rectangle`, `circle`): live preview during drag,
  **one element committed on mouseup** (degenerate clicks ignored).
- **Pencil/eraser:** each move = one segment, dispatched to Redux *and* emitted
  (so strokes survive canvas redraws); eraser uses white.
- **Text:** opens an inline input at the click position; Enter/blur commits,
  Esc cancels — returns `{ canvasRef, textInput, onTextChange, commitText,
  cancelText, handleTextBlur }` for `Canvas.jsx` to render.

## 3.5 Undo / redo / clear

- `boardSlice` keeps `history` / `future` arrays.
- `undo()` / `redo()` move snapshots between them.
- **Fixed 2026-11-12:** history snapshot is taken *before* the element is
  pushed (was after → undo was a no-op).
- `clearBoard()` empties `elements` + history.
- Wired to `Toolbar` buttons via `BoardPage` handlers.

## 3.6 Engine tasks

- [x] Canvas + responsive resize
- [x] Tool set (pencil, line, rect, circle, text, eraser)
- [x] Color palette + picker, brush size
- [x] Local rendering (`drawElement` / `redrawCanvas`)
- [x] Drawing hook (mouse + touch)
- [x] Undo / redo / clear
- [x] **Text tool** — inline input overlay replaces `prompt()` (2026-11-12)
- [x] **Shape tools** — preview + single-commit per drag (line/rect/circle fixed 2026-11-12)
- [x] **Undo/redo** — snapshot-order bug fixed (2026-11-12)
- [ ] **Eraser** — currently paints white; make it truly remove elements under cursor
- [ ] **Fill / stroke controls** for shapes (opacity, strokeWidth are in state but unused)
- [ ] **Implement empty `UI/ColorPicker`** (currently a native `<input type=color>` is used)

**Ready to proceed to Phase 4: Real-time Collaboration.**
