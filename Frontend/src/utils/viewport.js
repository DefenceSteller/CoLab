// ============================================================
// Viewport math — one place for screen⇄world conversion.
// screen = world * zoom + offset  (world is the scene space all
// elements live in; zoom/offset is the camera).
// ============================================================

import { getCommonBounds } from './elementModel';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const screenFromWorld = (wx, wy, vp) => ({
  x: wx * vp.zoom + vp.offsetX,
  y: wy * vp.zoom + vp.offsetY,
});

export const worldFromScreen = (sx, sy, vp) => ({
  x: (sx - vp.offsetX) / vp.zoom,
  y: (sy - vp.offsetY) / vp.zoom,
});

/** Client/event coords → world, using the canvas' bounding rect. */
export const eventToWorld = (e, canvas, vp) => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  return worldFromScreen(sx, sy, vp);
};

/** Client/event coords → CSS pixels inside the canvas. */
export const eventToScreen = (e, canvas) => {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
};

/**
 * Zoom keeping a screen-space anchor (e.g. the cursor) fixed:
 * the world point under the anchor stays under the anchor.
 */
export const zoomAtScreenPoint = (vp, newZoom, sx, sy) => {
  const z = clampZoom(newZoom);
  const world = worldFromScreen(sx, sy, vp);
  return {
    zoom: z,
    offsetX: sx - world.x * z,
    offsetY: sy - world.y * z,
  };
};

/** Viewport that fits `bounds` (with padding px) into a w×h screen box. */
export const viewportForBounds = (bounds, w, h, padding = 40) => {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return { zoom: 1, offsetX: 0, offsetY: 0 };
  }
  const zoom = clampZoom(
    Math.min((w - padding * 2) / bounds.width, (h - padding * 2) / bounds.height)
  );
  return {
    zoom,
    offsetX: w / 2 - (bounds.x + bounds.width / 2) * zoom,
    offsetY: h / 2 - (bounds.y + bounds.height / 2) * zoom,
  };
};

/** Fit every element's union bounds into a w×h screen box (Shift+1 / fit button). */
export const fitViewportToElements = (elements, w, h, padding = 48) =>
  viewportForBounds(getCommonBounds(elements), w, h, padding);
