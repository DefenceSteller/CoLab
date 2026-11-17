// ============================================================
// Selection geometry — pure math for the selection engine
// (Phase 3): selection box, handle positions, marquee hits,
// resize/rotate transforms. No Redux, no DOM — unit-testable.
//
// Box frames: a single selected element keeps its rotation
// (box = element's own box + angle); a multi-selection is the
// axis-aligned union of bounds (angle 0).
// ============================================================

import { getElementBounds, getCommonBounds } from './elementModel';

export const HANDLE_SIZE = 8; // screen px (drawn)
export const HANDLE_HIT = 10; // screen px (grab radius)
export const ROTATE_OFFSET = 18; // screen px above the top edge

const rotatePt = (px, py, cx, cy, a) => {
  if (!a) return [px, py];
  const dx = px - cx;
  const dy = py - cy;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};

/**
 * The selection box for a set of ids.
 * Single element → its own box (angle preserved, so handles follow
 * the rotation). Multi → AABB union (angle 0).
 */
export const selectionBox = (elements, selectedIds) => {
  const sel = elements.filter((el) => selectedIds.includes(el.id));
  if (!sel.length) return null;
  if (sel.length === 1) {
    const el = sel[0];
    return {
      x: el.x,
      y: el.y,
      width: Math.abs(el.width),
      height: Math.abs(el.height),
      angle: el.angle || 0,
    };
  }
  return { ...getCommonBounds(sel), angle: 0 };
};

/** 4 corners [nw, ne, se, sw] of a (possibly rotated) box, world coords. */
export const boxCorners = (box) => {
  const { x, y, width: w, height: h, angle = 0 } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return [
    rotatePt(x, y, cx, cy, angle),
    rotatePt(x + w, y, cx, cy, angle),
    rotatePt(x + w, y + h, cx, cy, angle),
    rotatePt(x, y + h, cx, cy, angle),
  ];
};

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * World positions of the 8 resize handles + the rotate knob.
 * Sizes/offsets are converted to world units via `zoom` so they
 * stay constant on screen.
 */
export const handlePoints = (box, zoom = 1) => {
  const [nw, ne, se, sw] = boxCorners(box);
  const n = mid(nw, ne);
  const e = mid(ne, se);
  const s = mid(se, sw);
  const w = mid(sw, nw);
  // rotate knob: outward along the box's "up" normal (n − s), offset
  // past the top edge by the knob radius + gap
  const upX = n[0] - s[0];
  const upY = n[1] - s[1];
  const len = Math.hypot(upX, upY) || 1;
  const off = (ROTATE_OFFSET + HANDLE_SIZE) / zoom;
  const rotate = [n[0] + (upX / len) * off, n[1] + (upY / len) * off];
  return { nw, n, ne, e, se, s, sw, w, rotate };
};

/** Which handle (or null) is under a world point at the given zoom. */
export const hitHandle = (box, world, zoom) => {
  if (!box) return null;
  const pts = handlePoints(box, zoom);
  const tol = HANDLE_HIT / zoom;
  // corners first (more specific), then edges, then the knob
  for (const key of ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w', 'rotate']) {
    const p = pts[key];
    if (Math.hypot(world.x - p[0], world.y - p[1]) <= tol) return key;
  }
  return null;
};

/** Ids of elements whose (rotation-aware) bounds intersect the marquee. */
export const marqueeHits = (elements, rect) => {
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  const out = [];
  for (const el of elements) {
    const b = getElementBounds(el);
    if (b.x < x2 && b.x + b.width > rect.x && b.y < y2 && b.y + b.height > rect.y) {
      out.push(el.id);
    }
  }
  return out;
};

/** Normalize a drag into a positive-size rect. */
export const rectFromDrag = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(b.x - a.x),
  height: Math.abs(b.y - a.y),
});

// ---------- transforms ----------

const MIN_SIZE = 1; // world units

/**
 * Resize a selection box from its fixed anchor toward `pointer`.
 *
 * Works in the box's LOCAL frame (rotated by box.angle): the anchor
 * corner/edge stays put in world space while everything scales toward
 * the pointer. Returns per-element changes {id → {x,y,width,height,
 * points?, fontSize?}}; angles are untouched (points stay relative
 * to each element's origin and scale with it).
 *
 * All element geometry comes from `origs` (captured at gesture start)
 * so repeated per-frame calls stay absolute, not cumulative.
 *
 * @param box     selection box captured at gesture start
 * @param handle  'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'
 * @param pointer current world point
 * @param origs   Map(id → {x,y,width,height,angle,points,fontSize,type})
 * @param ids     ids being resized
 */
export const resizeChanges = (box, handle, pointer, origs, ids) => {
  const { x, y, width: w, height: h, angle = 0 } = box;
  if (w <= 0 || h <= 0) return {};
  const cx = x + w / 2;
  const cy = y + h / 2;

  // world → box-local (top-left origin, unrotated)
  const toLocal = (px, py) => {
    if (!angle) return { x: px - x, y: py - y };
    const dx = px - cx;
    const dy = py - cy;
    const c = Math.cos(-angle);
    const s = Math.sin(-angle);
    return { x: dx * c - dy * s + w / 2, y: dx * s + dy * c + h / 2 };
  };

  // fixed anchor in local coords (opposite of the dragged handle)
  const anchorL = {
    nw: { x: w, y: h },
    n: { x: 0, y: h },
    ne: { x: 0, y: h },
    e: { x: 0, y: 0 },
    se: { x: 0, y: 0 },
    s: { x: 0, y: 0 },
    sw: { x: w, y: 0 },
    w: { x: w, y: 0 },
  }[handle] || { x: 0, y: 0 };

  const pL = toLocal(pointer.x, pointer.y);
  let lw = Math.abs(pL.x - anchorL.x);
  let lh = Math.abs(pL.y - anchorL.y);

  // edge handles only scale on their own axis
  const lockX = handle === 'n' || handle === 's';
  const lockY = handle === 'e' || handle === 'w';
  if (lockX) lw = w;
  if (lockY) lh = h;

  const sx = Math.max(lw, MIN_SIZE) / w;
  const sy = Math.max(lh, MIN_SIZE) / h;

  // anchor in WORLD coords (fixed for the whole gesture)
  const anchorWorld = angle
    ? (() => {
        const dx = anchorL.x - w / 2;
        const dy = anchorL.y - h / 2;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
      })()
    : { x: x + anchorL.x, y: y + anchorL.y };

  const out = {};
  for (const id of ids) {
    const o = origs.get(id);
    if (!o) continue;
    const ew = Math.abs(o.width);
    const eh = Math.abs(o.height);

    if (!angle) {
      // axis-aligned (multi-select or unrotated single): scale the
      // element's origin relative to the fixed world anchor
      out[id] = {
        x: anchorWorld.x + (o.x - anchorWorld.x) * sx,
        y: anchorWorld.y + (o.y - anchorWorld.y) * sy,
        width: ew * sx,
        height: eh * sy,
      };
    } else {
      // rotated single: the box IS the element — place its local
      // origin so the anchor lands back on the fixed world point
      const nL = {
        x: anchorL.x + (0 - anchorL.x) * sx, // element local top-left = (0,0)
        y: anchorL.y + (0 - anchorL.y) * sy,
      };
      const dx = nL.x - w / 2;
      const dy = nL.y - h / 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      out[id] = {
        x: cx + dx * c - dy * s,
        y: cy + dx * s + dy * c,
        width: ew * sx,
        height: eh * sy,
      };
    }

    if (o.points && o.points.length) {
      out[id].points = o.points.map(([px, py]) => [px * sx, py * sy]);
    }
    if (o.type === 'text') {
      out[id].fontSize = Math.max(4, (o.fontSize || 16) * Math.min(sx, sy));
    }
  }
  return out;
};

/**
 * Rotate a selection about the box center captured at gesture start.
 * `a0`/`a1` are the angles of the pointer around that center at drag
 * start / now. Shift → snap the delta to 15°. Geometry comes from
 * `origs` (gesture start) so per-frame calls stay absolute.
 * Returns {id → {x,y,angle}}.
 */
export const rotateChanges = (box, a0, a1, origs, ids, snap) => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let dA = a1 - a0;
  // normalize to [-π, π]
  while (dA > Math.PI) dA -= Math.PI * 2;
  while (dA < -Math.PI) dA += Math.PI * 2;
  if (snap) {
    const STEP = Math.PI / 12; // 15°
    dA = Math.round(dA / STEP) * STEP;
  }
  if (!dA) return {};

  const c = Math.cos(dA);
  const s = Math.sin(dA);
  const out = {};
  for (const id of ids) {
    const o = origs.get(id);
    if (!o) continue;
    // rotate the element's CENTER around the box center; the renderer
    // spins each element about its own center, so origin follows
    const ecx = o.x + Math.abs(o.width) / 2;
    const ecy = o.y + Math.abs(o.height) / 2;
    const dx = ecx - cx;
    const dy = ecy - cy;
    const ncx = cx + dx * c - dy * s;
    const ncy = cy + dx * s + dy * c;
    out[id] = {
      x: ncx - Math.abs(o.width) / 2,
      y: ncy - Math.abs(o.height) / 2,
      angle: (o.angle + dA) % (Math.PI * 2),
    };
  }
  return out;
};

/** Angle of a world point around a center (for rotate gestures). */
export const angleAround = (center, point) =>
  Math.atan2(point.y - center.y, point.x - center.x);
