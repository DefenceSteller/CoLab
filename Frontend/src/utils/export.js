// ============================================================
// Export / Import utilities — no DOM required (except for the
// optional PNG renderer below). Designed as pure helpers that
// components can call without importing canvas-specific code.
// ============================================================

import { getRough } from './renderer';
import { redrawScene } from './renderer';
import { viewportForBounds } from './viewport';

// ---------- JSON serialization ----------
/**
 * Serialize the board scene to a JSON string suitable for download
 * or pasting into the browser console. Includes version tag for
 * future schema evolution.
 */
export const serializeElements = (elements, viewport) =>
  JSON.stringify(
    {
      version: 1,
      elements: elements.map((el) => ({ ...el })), // shallow clone
      viewport,
    },
    null,
    2
  );

/**
 * Deserialize a scene JSON string.
 * Returns null if the payload is not parseable / doesn't match
 * our expected shape — callers should handle the null gracefully.
 */
export const deserializeScene = (text) => {
  try {
    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
    if (!parsed || typeof parsed !== 'object') return null;
    // Support both top-level arrays (legacy) and the structured form
    if (Array.isArray(parsed)) {
      return { elements: parsed, viewport: { zoom: 1, offsetX: 0, offsetY: 0 } };
    }
    if (!Array.isArray(parsed.elements)) return null;
    return {
      elements: parsed.elements.map((el) => ({ ...el })),
      viewport: parsed.viewport ?? { zoom: 1, offsetX: 0, offsetY: 0 },
    };
  } catch {
    return null;
  }
};

// ---------- PNG export ----------
/**
 * Render all elements onto an offscreen canvas at the given
 * dimensions and return a Blob (PNG). Uses the same renderer
 * pipeline as the on-canvas display.
 *
 * @param elements       Array of element objects (same shape as boardSlice.board.elements)
 * @param width          Output canvas width in px
 * @param height         Output canvas height in px
 * @param backgroundColor  Optional fill color behind everything (default transparent)
 * @returns              Promise<Blob>
 */
export const toPngBlob = async (
  elements,
  { width, height, backgroundColor = undefined } = {}
) => {
  const scale = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  // Build a minimal viewport so redrawScene applies the camera transform.
  // To produce a flat PNG we map world bounds → entire canvas, matching
  // Excalidraw's "export selection" behavior when no viewport is provided.
  const vp = computeExportViewport(elements, width, height);
  redrawScene(canvas, elements, vp, 1);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob returned null'));
      },
      'image/png',
      1.0
    );
  });
};

/**
 * Given a set of elements plus desired output dims, compute a viewport
 * that fills the target rect with a small padding. Mirrors Excalidraw's
 * export logic.
 */
const PADDING = 24;

const computeExportViewport = (elements, width, height) => {
  // Empty scene → blank white page
  if (!elements || elements.length === 0) {
    return { zoom: 1, offsetX: 0, offsetY: 0 };
  }
  // Union AABB in world space
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const w = Math.abs(el.width || 0);
    const h = Math.abs(el.height || 0);
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + w);
    maxY = Math.max(maxY, el.y + h);
  }
  const bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  // Fit inside (width - padding*2) × (height - padding*2)
  const availW = width - PADDING * 2;
  const availH = height - PADDING * 2;
  return viewportForBounds(bbox, availW, availH);
};

// ---------- File download helper ----------
/**
 * Trigger a browser download for the given filename + blob.
 * Revokes the object URL after a short delay so Safari doesn't
 * leak memory.
 */
export const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
};

// ---------- Clipboard ----------
/**
 * Write a PNG blob to the system clipboard (AsyncClipboard API).
 * Returns false if the API is unavailable.
 */
export const writeImageToClipboard = async (blob) => {
  if (!navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
};
