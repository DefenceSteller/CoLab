// ============================================================
// Scene renderer — roughjs-backed (the sketchy look Excalidraw
// is famous for) with a Path/Drawable cache so redraws during
// pan/zoom don't regenerate geometry.
//
// Coordinate model: elements live in WORLD space. Callers set up
// the viewport transform (see viewport.js); this module draws in
// world coordinates and never touches the camera.
// ============================================================

import rough from 'roughjs';
import { fontString, FONT_STACKS } from './elementModel';

const generator = rough.generator();

// ---------- RoughCanvas per <canvas> (they hold the ctx) ----------
const roughByCanvas = new WeakMap();
export const getRough = (canvas) => {
  let rc = roughByCanvas.get(canvas);
  if (!rc) {
    rc = rough.canvas(canvas);
    roughByCanvas.set(canvas, rc);
  }
  return rc;
};

// ---------- drawable cache ----------
// Keyed by everything that affects generated geometry EXCEPT
// x/y/angle (applied via ctx transform) → moving an element
// reuses its cached sketch.
const drawableCache = new Map();
const MAX_CACHE = 4000;

const dashFor = (el) => {
  const sw = el.strokeWidth || 2;
  if (el.strokeStyle === 'dashed') return [sw * 4, sw * 3];
  if (el.strokeStyle === 'dotted') return [0.01, sw * 3];
  return undefined;
};

const styleKey = (el) =>
  [
    el.type,
    Math.abs(el.width || 0),
    Math.abs(el.height || 0),
    el.strokeColor,
    el.backgroundColor,
    el.fillStyle,
    el.strokeWidth,
    el.strokeStyle,
    el.roughness,
    el.seed,
    el.text ?? '',
    el.fontSize ?? '',
    el.fontFamily ?? '',
    el.textAlign ?? '',
    el.name ?? '',
    el.points ? el.points.length + ':' + el.points.join(';') : '',
  ].join('|');

const optsFor = (el, overrides = {}) => {
  const sw = el.strokeWidth || 2;
  const fill =
    el.backgroundColor && el.backgroundColor !== 'transparent'
      ? el.backgroundColor
      : undefined;
  return {
    stroke: el.strokeColor || '#101014',
    strokeWidth: sw,
    fill,
    fillStyle: el.fillStyle || 'solid',
    roughness: el.roughness ?? 1,
    bowing: 1,
    seed: el.seed ?? 1,
    strokeLineDash: dashFor(el),
    // dashed/dotted + sketchy double-stroke looks muddy → single pass
    disableMultiStroke: el.strokeStyle !== 'solid' || !fill && el.type === 'freedraw',
    ...overrides,
  };
};

/** Build the roughjs drawable(s) for an element (local coords, no x/y). */
const buildDrawables = (el) => {
  const w = Math.abs(el.width || 0);
  const h = Math.abs(el.height || 0);
  const pts = el.points || [];

  switch (el.type) {
    case 'rectangle':
      return [generator.rectangle(0, 0, w, h, optsFor(el))];

    case 'ellipse':
      return [generator.ellipse(w / 2, h / 2, w, h, optsFor(el))];

    case 'diamond':
      return [
        generator.polygon(
          [
            [w / 2, 0],
            [w, h / 2],
            [w / 2, h],
            [0, h / 2],
          ],
          optsFor(el)
        ),
      ];

    case 'line':
      return [generator.linearPath(pts.length ? pts : [
        [0, 0],
        [w, h],
      ], optsFor(el))];

    case 'arrow': {
      const shaft = generator.linearPath(
        pts.length ? pts : [[0, 0], [w, h]],
        optsFor(el)
      );
      if (pts.length < 2) return [shaft];
      // arrowhead as an open "V": barb → tip → barb
      const n = pts.length;
      const [x1, y1] = pts[n - 2];
      const [x2, y2] = pts[n - 1];
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const len = 10 + (el.strokeWidth || 2) * 2.5;
      const spread = 0.42;
      const barbA = [
        x2 - len * Math.cos(ang - spread),
        y2 - len * Math.sin(ang - spread),
      ];
      const barbB = [
        x2 - len * Math.cos(ang + spread),
        y2 - len * Math.sin(ang + spread),
      ];
      const head = generator.linearPath([barbA, [x2, y2], barbB], optsFor(el));
      return [shaft, head];
    }

    case 'freedraw':
      if (pts.length < 2) return [];
      // freehand is already hand-drawn — no roughness jitter on top
      return [
        generator.linearPath(
          pts,
          optsFor(el, { roughness: 0, disableMultiStroke: true, fill: undefined })
        ),
      ];

    default:
      return [];
  }
};

const getCachedDrawables = (el) => {
  const key = styleKey(el);
  let entry = drawableCache.get(key);
  if (entry) {
    // LRU-ish refresh
    drawableCache.delete(key);
    drawableCache.set(key, entry);
    return entry;
  }
  entry = buildDrawables(el);
  if (drawableCache.size >= MAX_CACHE) drawableCache.clear();
  drawableCache.set(key, entry);
  return entry;
};

// ---------- plain-canvas element types ----------

const drawText = (ctx, el) => {
  const fs = el.fontSize || 16;
  ctx.font = fontString(fs, el.fontFamily || 'sans');
  ctx.fillStyle = el.strokeColor || '#101014';
  ctx.textBaseline = 'top';
  const align = el.textAlign || 'left';
  ctx.textAlign = align;
  const tx = align === 'center' ? Math.abs(el.width) / 2 : align === 'right' ? Math.abs(el.width) : 0;
  const lines = String(el.text ?? '').split('\n');
  const lh = fs * 1.25;
  lines.forEach((line, i) => ctx.fillText(line, tx, i * lh));
  ctx.textAlign = 'left';
};

const imageCache = new Map(); // src → HTMLImageElement (may still be loading)
const imageListeners = new Set();
/** Called when a lazily-loaded image finishes — subscribe to trigger a redraw. */
export const onImageLoaded = (cb) => {
  imageListeners.add(cb);
  return () => imageListeners.delete(cb);
};

const drawImageEl = (ctx, el, w, h) => {
  const src = el.src;
  if (!src) return;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.onload = () => imageListeners.forEach((cb) => cb());
    img.src = src;
    imageCache.set(src, img);
  }
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    // placeholder while loading
    ctx.fillStyle = 'rgba(16, 16, 20, 0.05)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#101014';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(0, 0, w, h);
    ctx.setLineDash([]);
  }
};

const drawFrame = (ctx, el, w, h) => {
  // frames are crisp (like Excalidraw), not sketchy
  ctx.strokeStyle = el.strokeColor || '#101014';
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.strokeRect(0, 0, w, h);
  const name = el.name || 'Frame';
  ctx.font = `600 12px ${FONT_STACKS.sans}`;
  ctx.fillStyle = el.strokeColor || '#101014';
  ctx.textBaseline = 'bottom';
  ctx.fillText(name, 0, -4);
  ctx.textBaseline = 'top';
};

// ---------- public API ----------

/** Draw a single element at its world position (caller sets the transform). */
export const drawElement = (ctx, rc, el) => {
  if (!el || !el.type) return;
  ctx.save();
  ctx.globalAlpha = (el.opacity ?? 100) / 100;

  const isPts = !!(el.points && el.points.length);
  const w = Math.abs(el.width || 0);
  const h = Math.abs(el.height || 0);
  let bx = el.x || 0;
  let by = el.y || 0;
  // negative drag extents → shift origin so the box stays correct
  if (!isPts) {
    if ((el.width || 0) < 0) bx = el.x + el.width;
    if ((el.height || 0) < 0) by = el.y + el.height;
  }

  ctx.translate(bx, by);
  if (el.angle) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(el.angle);
    ctx.translate(-w / 2, -h / 2);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (el.type) {
    case 'text':
      drawText(ctx, el);
      break;
    case 'image':
      drawImageEl(ctx, el, w, h);
      break;
    case 'frame':
      drawFrame(ctx, el, w, h);
      break;
    default: {
      const drawables = getCachedDrawables(el);
      for (const d of drawables) rc.draw(d);
    }
  }
  ctx.restore();
};

/**
 * Redraw the whole base layer: clear → apply viewport transform →
 * draw every element in world coords.
 */
export const redrawScene = (canvas, elements, viewport, dpr = 1) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rc = getRough(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { zoom, offsetX, offsetY } = viewport;
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * offsetX, dpr * offsetY);
  for (const el of elements) drawElement(ctx, rc, el);
};

/**
 * Redraw the interaction layer: in-progress preview + (later)
 * selection UI. Same transform as the base layer.
 */
export const redrawOverlay = (canvas, preview, viewport, dpr = 1) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rc = getRough(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!preview) return;
  const { zoom, offsetX, offsetY } = viewport;
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * offsetX, dpr * offsetY);
  drawElement(ctx, rc, preview);
};
