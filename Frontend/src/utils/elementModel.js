// ============================================================
// Element model — mirrors Excalidraw's element shape so "parity"
// is structural, not cosmetic. Every element on the board is one
// of ELEMENT_TYPES, carries an id, a bounding box (x/y/width/
// height), a rotation angle, full style props and (for line-like
// types) a points array relative to x/y.
//
// Legacy segments ({type, from, to, color, size}) produced by the
// pre-parity build are converted on ingest by normalizeElement /
// normalizeScene, so old rooms keep rendering.
// ============================================================

export const ELEMENT_TYPES = [
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
  'image',
  'frame',
];

const LEGACY_TYPES = new Set(['pencil', 'circle', 'eraser', 'line', 'rectangle', 'text']);

// Font keys → stacks. Stored as keys on elements; resolved here so a
// stack can be swapped without touching stored scenes.
export const FONT_STACKS = {
  sans: '"Space Grotesk", Arial, sans-serif',
  hand: '"Segoe Print", "Comic Sans MS", cursive',
  mono: '"Cascadia Code", Consolas, monospace',
};

export const FONT_WEIGHTS = { sans: 600, hand: 400, mono: 500 };

export const DEFAULT_STYLE = {
  strokeColor: '#101014',
  backgroundColor: 'transparent',
  fillStyle: 'solid', // solid | hachure | cross-hatch | zigzag
  strokeWidth: 2,      // Excalidraw's thin(1)/medium(2)/bold(4)
  strokeStyle: 'solid', // solid | dashed | dotted
  opacity: 100,        // 0–100
  roughness: 1,        // 0 architect · 1 artist · 2 cartoonist
};

// ---------- ids ----------

let idCounter = 0;
export const createId = () =>
  `el_${Date.now().toString(36)}${(idCounter++).toString(36)}${Math
    .random()
    .toString(36)
    .slice(2, 8)}`;

// ---------- text measuring (shared offscreen context) ----------

let measureCtx = null;
const getMeasureCtx = () => {
  if (!measureCtx) {
    const c = document.createElement('canvas');
    measureCtx = c.getContext('2d');
  }
  return measureCtx;
};

export const fontString = (fontSize, fontFamily = 'sans') =>
  `${FONT_WEIGHTS[fontFamily] ?? 600} ${fontSize}px ${FONT_STACKS[fontFamily] ?? FONT_STACKS.sans}`;

/** {width, height, lines} for a text element's content. */
export const measureText = (text, fontSize = 16, fontFamily = 'sans') => {
  const ctx = getMeasureCtx();
  ctx.font = fontString(fontSize, fontFamily);
  const lines = String(text ?? '').split('\n');
  let width = 0;
  for (const line of lines) width = Math.max(width, ctx.measureText(line).width);
  return {
    width: Math.max(width, 1),
    height: Math.max(lines.length, 1) * fontSize * 1.25,
    lines,
  };
};

// ---------- factory ----------

/**
 * Create a new-model element.
 * @param {string} type one of ELEMENT_TYPES
 * @param {object} props x/y/width/height/points/text + any style overrides
 */
export const createElement = (type, props = {}) => {
  const el = {
    id: createId(),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    points: null,   // [[dx,dy], …] for line / arrow / freedraw
    text: null,     // content for text
    // styles
    ...DEFAULT_STYLE,
    // meta
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
    userId: 'local',
    timestamp: Date.now(),
    ...props,
  };
  if (type === 'text' && el.text != null) {
    const m = measureText(el.text, el.fontSize ?? 16, el.fontFamily ?? 'sans');
    if (!props.width) el.width = m.width;
    if (!props.height) el.height = m.height;
  }
  return el;
};

// ---------- legacy ingest ----------

const fromLegacy = (raw) => {
  const color = raw.color ?? '#101014';
  const size = raw.size ?? 2;
  const fill = raw.fillColor && raw.fillColor !== 'transparent'
    ? raw.fillColor
    : 'transparent';

  if (raw.type === 'text') {
    return createElement('text', {
      x: raw.x ?? 0,
      y: raw.y ?? 0,
      text: raw.text ?? '',
      fontSize: raw.fontSize ?? 16,
      strokeColor: color,
      userId: raw.userId,
      timestamp: raw.timestamp,
    });
  }

  if (raw.type === 'rectangle' || raw.type === 'circle') {
    const x = Math.min(raw.from.x, raw.to.x);
    const y = Math.min(raw.from.y, raw.to.y);
    return createElement(raw.type === 'circle' ? 'ellipse' : 'rectangle', {
      x,
      y,
      width: Math.abs(raw.to.x - raw.from.x),
      height: Math.abs(raw.to.y - raw.from.y),
      strokeColor: color,
      strokeWidth: size,
      backgroundColor: fill,
      userId: raw.userId,
      timestamp: raw.timestamp,
    });
  }

  if (raw.type === 'line') {
    return createElement('line', {
      x: raw.from.x,
      y: raw.from.y,
      width: raw.to.x - raw.from.x,
      height: raw.to.y - raw.from.y,
      points: [[0, 0], [raw.to.x - raw.from.x, raw.to.y - raw.from.y]],
      strokeColor: color,
      strokeWidth: size,
      userId: raw.userId,
      timestamp: raw.timestamp,
    });
  }

  // pencil / eraser → freedraw segment
  return createElement('freedraw', {
    x: raw.from.x,
    y: raw.from.y,
    width: raw.to.x - raw.from.x,
    height: raw.to.y - raw.from.y,
    points: [[0, 0], [raw.to.x - raw.from.x, raw.to.y - raw.from.y]],
    strokeColor: raw.type === 'eraser' ? '#ffffff' : color,
    strokeWidth: size,
    userId: raw.userId,
    timestamp: raw.timestamp,
  });
};

const isLegacy = (raw) =>
  raw && typeof raw === 'object' && raw.from && raw.to && LEGACY_TYPES.has(raw.type);

/** Ensure any element (new or legacy) is new-model. Returns null for junk. */
export const normalizeElement = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  if (isLegacy(raw)) return fromLegacy(raw);
  if (!ELEMENT_TYPES.includes(raw.type)) return null;
  return {
    ...DEFAULT_STYLE,
    ...raw,
    id: raw.id || createId(),
    angle: raw.angle || 0,
    version: raw.version || 1,
    seed: raw.seed ?? Math.floor(Math.random() * 2 ** 31),
  };
};

const sameStroke = (a, b) =>
  a.type === 'freedraw' &&
  b.type === 'freedraw' &&
  a.strokeColor === b.strokeColor &&
  a.strokeWidth === b.strokeWidth &&
  a.opacity === b.opacity;

/** Re-fit x/y/width/height to an element's points (normalizes negatives). */
export const normalizeBounds = (el) => {
  if (!el.points || !el.points.length) return;
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const [px, py] of el.points) {
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  el.x += minX; el.y += minY;
  el.points = el.points.map(([px, py]) => [px - minX, py - minY]);
  el.width = maxX - minX;
  el.height = maxY - minY;
};

/**
 * Normalize a whole scene: convert legacy segments, drop junk, and
 * merge runs of consecutive legacy pencil segments into single
 * multi-point strokes (old builds emitted one element per segment).
 */
export const normalizeScene = (elements) => {
  const out = [];
  const indexOfId = new Map(); // id → index in `out` (live-streamed chunks re-send)
  for (const raw of Array.isArray(elements) ? elements : []) {
    const el = normalizeElement(raw);
    if (!el) continue;
    const seen = indexOfId.get(el.id);
    if (seen !== undefined) {
      // Same id again (throttled freedraw chunks re-sent on rejoin):
      // keep the newest version, in place.
      if ((el.version || 1) >= (out[seen].version || 1)) out[seen] = el;
      continue;
    }
    const prev = out[out.length - 1];
    if (prev && sameStroke(prev, el) && prev.points && el.points) {
      const last = prev.points[prev.points.length - 1];
      const startAbsX = prev.x + last[0];
      const startAbsY = prev.y + last[1];
      if (Math.abs(startAbsX - el.x) < 1.5 && Math.abs(startAbsY - el.y) < 1.5) {
        prev.points = [...prev.points, ...el.points.slice(1)];
        normalizeBounds(prev);
        prev.version = (prev.version || 1) + 1;
        continue;
      }
    }
    indexOfId.set(el.id, out.length);
    out.push(el);
  }
  return out;
};

// ---------- geometry ----------

/** Axis-aligned bounds in world coords (rotation-aware). */
export const getElementBounds = (el) => {
  const { x, y, width: w, height: h, angle = 0 } = el;
  if (!angle) return { x, y, width: w, height: h };
  const cx = x + w / 2;
  const cy = y + h / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [x, y], [x + w, y], [x + w, y + h], [x, y + h],
  ].map(([px, py]) => {
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
};

/** Union of many elements' bounds. */
export const getCommonBounds = (elements) => {
  if (!elements || !elements.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/** Inverse-rotate a world point into the element's unrotated local space. */
const toLocal = (el, px, py) => {
  const { x, y, width: w, height: h, angle = 0 } = el;
  if (!angle) return [px - x, py - y];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return [cx + dx * cos - dy * sin - x, cy + dx * sin + dy * cos - y];
};

const distanceToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

const polylineHit = (el, lx, ly, tol) => {
  const pts = el.points || [[0, 0], [el.width, el.height]];
  for (let i = 0; i < pts.length - 1; i++) {
    const x1 = el.x + pts[i][0];
    const y1 = el.y + pts[i][1];
    const x2 = el.x + pts[i + 1][0];
    const y2 = el.y + pts[i + 1][1];
    if (distanceToSegment(lx, ly, x1, y1, x2, y2) <= tol) return true;
  }
  // single-point stroke → hit the tip
  if (pts.length === 1) {
    return Math.hypot(lx - (el.x + pts[0][0]), ly - (el.y + pts[0][1])) <= tol;
  }
  return false;
};

/**
 * Hit-test a world point against an element.
 * Closed shapes hit by area (like Excalidraw); open types by
 * stroke proximity. `tol` is in world units.
 */
export const hitTestElement = (el, px, py, tol = 4) => {
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  const strokeTol = tol + (el.strokeWidth || 2) / 2;

  if (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') {
    const [lx, ly] = toLocal(el, px, py);
    return polylineHit(el, lx, ly, strokeTol);
  }

  const [lx, ly] = toLocal(el, px, py);

  if (el.type === 'rectangle' || el.type === 'text' || el.type === 'image' || el.type === 'frame') {
    return (
      lx >= -strokeTol && lx <= w + strokeTol &&
      ly >= -strokeTol && ly <= h + strokeTol
    );
  }

  if (el.type === 'ellipse') {
    const rx = w / 2 || 1;
    const ry = h / 2 || 1;
    const nx = (lx - rx) / (rx + strokeTol);
    const ny = (ly - ry) / (ry + strokeTol);
    return nx * nx + ny * ny <= 1;
  }

  if (el.type === 'diamond') {
    const rx = w / 2 || 1;
    const ry = h / 2 || 1;
    return Math.abs(lx - rx) / (rx + strokeTol) + Math.abs(ly - ry) / (ry + strokeTol) <= 1;
  }

  return false;
};

/** Topmost element at a point (elements are painted bottom→top). */
export const elementAtPoint = (elements, px, py, tol = 4) => {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTestElement(elements[i], px, py, tol)) return elements[i];
  }
  return null;
};
