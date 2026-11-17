// ============================================================
// Shape binders — Excalidraw's "arrow sticks to shapes"
// (Phase 4). An arrow/line endpoint that lands on a shape gets
// `startBinding` / `endBinding` {elementId}; whenever that shape
// moves/resizes/rotates, the bound endpoint is re-projected onto
// the shape's boundary so the arrow follows it.
//
// Pure functions — no Redux/DOM (unit-testable from node).
// ============================================================

import { hitTestElement } from './elementModel';

export const BIND_GAP = 2; // world px between a bound endpoint and the shape edge

// Shapes an endpoint can bind TO (closed-ish bodies — not frames,
// not other lines: those make for nonsense anchors).
const BINDABLE = new Set(['rectangle', 'ellipse', 'diamond', 'text', 'image']);

/**
 * Point on `el`'s boundary along the ray from its center toward
 * `from`, pushed `gap` px outward (so the arrow never quite
 * touches). Works for any box; rotation is approximated by the
 * axis-aligned box (fine for Phase 4).
 */
export const pointOnBounds = (el, from, gap = 0) => {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const dx = from.x - cx;
  const dy = from.y - cy;
  const hw = Math.abs(el.width) / 2 || 1e-6;
  const hh = Math.abs(el.height) / 2 || 1e-6;
  const sx = Math.abs(dx) < 1e-6 ? Infinity : hw / Math.abs(dx);
  const sy = Math.abs(dy) < 1e-6 ? Infinity : hh / Math.abs(dy);
  const s = Math.min(sx, sy);
  const ix = cx + dx * s;
  const iy = cy + dy * s;
  const len = Math.hypot(dx, dy) || 1;
  return { x: ix + (dx / len) * gap, y: iy + (dy / len) * gap };
};

/** Topmost bindable shape under `point` (skips `excludeId`). */
export const findBindTarget = (elements, point, tol, excludeId) => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.id === excludeId || !BINDABLE.has(el.type)) continue;
    if (hitTestElement(el, point.x, point.y, tol)) return el;
  }
  return null;
};

/**
 * Bind a freshly created arrow/line: snap endpoints that landed on
 * shapes to those shapes' boundaries and record the bindings.
 * Mutates `arrow` (points + startBinding/endBinding); caller should
 * `normalizeBounds(arrow)` afterwards. `elements` must NOT yet
 * contain the arrow itself.
 */
export const applyBindings = (arrow, elements, tol) => {
  const pts = arrow.points;
  if (!pts || pts.length < 2) return;
  let start = { x: arrow.x + pts[0][0], y: arrow.y + pts[0][1] };
  let end = { x: arrow.x + pts[pts.length - 1][0], y: arrow.y + pts[pts.length - 1][1] };

  const sT = findBindTarget(elements, start, tol, arrow.id);
  const eT = findBindTarget(elements, end, tol, arrow.id);

  if (sT) {
    arrow.startBinding = { elementId: sT.id };
    start = pointOnBounds(sT, end, BIND_GAP);
  }
  if (eT) {
    arrow.endBinding = { elementId: eT.id };
    end = pointOnBounds(eT, start, BIND_GAP);
  }
  if (!sT && !eT) return;

  const middle = pts.slice(1, -1); // interior vertices (2-pt arrows: none)
  arrow.points = [
    [start.x - arrow.x, start.y - arrow.y],
    ...middle,
    [end.x - arrow.x, end.y - arrow.y],
  ];
};

/**
 * Recompute endpoints of every arrow whose binding target is in
 * `movedIds`. Returns {arrowId → {points}} (absolute-derived,
 * stored relative to each arrow's x/y — caller assigns and
 * `normalizeBounds`).
 */
export const boundArrowChanges = (elements, movedIds) => {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const out = {};
  for (const el of elements) {
    if (el.type !== 'arrow' && el.type !== 'line') continue;
    if (!el.startBinding && !el.endBinding) continue;
    const pts = el.points;
    if (!pts || pts.length < 2) continue;

    let start = { x: el.x + pts[0][0], y: el.y + pts[0][1] };
    let end = { x: el.x + pts[pts.length - 1][0], y: el.y + pts[pts.length - 1][1] };
    let touched = false;

    if (el.startBinding && movedIds.has(el.startBinding.elementId)) {
      const t = byId.get(el.startBinding.elementId);
      if (t) {
        start = pointOnBounds(t, end, BIND_GAP);
        touched = true;
      }
    }
    if (el.endBinding && movedIds.has(el.endBinding.elementId)) {
      const t = byId.get(el.endBinding.elementId);
      if (t) {
        end = pointOnBounds(t, start, BIND_GAP);
        touched = true;
      }
    }
    if (!touched) continue;

    out[el.id] = {
      points: [
        [start.x - el.x, start.y - el.y],
        ...pts.slice(1, -1),
        [end.x - el.x, end.y - el.y],
      ],
    };
  }
  return out;
};
