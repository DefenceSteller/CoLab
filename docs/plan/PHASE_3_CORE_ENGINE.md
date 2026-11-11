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
| Pencil | ✅ freehand strokes |
| Line | ✅ straight line |
| Rectangle | ✅ stroke + optional fill |
| Circle | ✅ stroke + optional fill |
| Text | ⚠️ works but uses `prompt()` dialog (needs proper UI) |
| Eraser | ⚠️ draws white strokes (doesn't truly erase) |

Plus: color palette (10 swatches) + native color picker, brush size slider (1–50).

## 3.3 Rendering

`utils/drawingTools.js`:
- `drawElement(ctx, element)` — switch on tool type, draws one element.
- `redrawCanvas(ctx, w, h, elements)` — clear + redraw all (called when `elements` changes).
- `createElement(...)` — helper to build an element object.

## 3.4 Drawing hook

`hooks/useCanvas.js`:
- `startDrawing` / `draw` / `stopDrawing` — mousedown/move/up/out + touch equivalents.
- Renders locally, then `emitDraw()` to broadcast.
- Dispatches `addElement` / `setDrawing` to Redux.

## 3.5 Undo / redo / clear

- `boardSlice` keeps `history` / `future` arrays.
- `undo()` / `redo()` move snapshots between them.
- `clearBoard()` empties `elements` + history.
- Wired to `Toolbar` buttons via `BoardPage` handlers.

## 3.6 Engine tasks

- [x] Canvas + responsive resize
- [x] Tool set (pencil, line, rect, circle, text, eraser)
- [x] Color palette + picker, brush size
- [x] Local rendering (`drawElement` / `redrawCanvas`)
- [x] Drawing hook (mouse + touch)
- [x] Undo / redo / clear
- [ ] **Text tool** — replace `prompt()` with an inline input overlay
- [ ] **Eraser** — actually remove elements under cursor (not white strokes)
- [ ] **Fill / stroke controls** for shapes (opacity, strokeWidth are in state but unused)
- [ ] **Implement empty `UI/ColorPicker`** (currently a native `<input type=color>` is used)

**Ready to proceed to Phase 4: Real-time Collaboration.**
