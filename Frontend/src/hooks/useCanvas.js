import { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch, useStore } from 'react-redux';
import {
  addElement,
  updateElements,
  removeElements,
  beginHistory,
  setDrawing,
} from '../store/slices/boardSlice';
import {
  createElement,
  normalizeBounds,
  elementAtPoint,
} from '../utils/elementModel';
import { eventToWorld } from '../utils/viewport';
import { redrawScene, redrawOverlay, onImageLoaded } from '../utils/renderer';

// Drag-preview tools → one element committed on pointerup.
const SHAPE_TOOLS = new Set(['rectangle', 'ellipse', 'diamond', 'line', 'arrow']);
// Progressive tools: points accumulate during the gesture.
const FREEHAND = 'freedraw';
// Phase 3/2/4 tools — recognized but inert until their phase lands.
const INERT_TOOLS = new Set(['selection', 'hand', 'laser', 'frame', 'image']);

// Old toolbar ids → new model ids (defensive; toolbar now emits new ids).
const canonicalTool = (t) =>
  t === 'pencil' ? 'freedraw' : t === 'circle' ? 'ellipse' : t;

const EMIT_INTERVAL_MS = 50; // throttle live stroke chunks
const MIN_POINT_DIST = 1.2; // screen px between freedraw points

let textIdCounter = 0;

export const useCanvas = ({ emitDraw, emitCursorMove, emitDelete } = {}) => {
  const containerRef = useRef(null);
  const baseRef = useRef(null); // committed layer
  const overlayRef = useRef(null); // preview / interaction layer
  const dprRef = useRef(1);
  const isDrawingRef = useRef(false);
  const gestureRef = useRef(null); // active gesture bookkeeping
  const previewRef = useRef(null);
  const textInputRef = useRef(null);

  const toolState = useSelector((s) => s.tool);
  const elements = useSelector((s) => s.board.elements);
  const viewport = useSelector((s) => s.viewport);

  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const toolRef = useRef(toolState);
  toolRef.current = toolState;

  const dispatch = useDispatch();
  const store = useStore();
  const [textInput, setTextInput] = useState(null);
  const [overlayTick, setOverlayTick] = useState(0);

  // ---------- sizing (DPR-aware) + redraws ----------

  const resize = () => {
    const container = containerRef.current;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const w = Math.max(1, Math.round(container.clientWidth * dpr));
    const h = Math.max(1, Math.round(container.clientHeight * dpr));
    for (const c of [baseRef.current, overlayRef.current]) {
      if (c && (c.width !== w || c.height !== h)) {
        c.width = w;
        c.height = h;
      }
    }
    redrawScene(baseRef.current, elementsRef.current, viewportRef.current, dpr);
    redrawOverlay(overlayRef.current, previewRef.current, viewportRef.current, dpr);
  };

  // Mount: size both layers + observe container resizes.
  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Committed scene → base layer.
  useEffect(() => {
    redrawScene(baseRef.current, elements, viewport, dprRef.current);
  }, [elements, viewport]);

  // Preview / interaction state → overlay layer.
  useEffect(() => {
    redrawOverlay(overlayRef.current, previewRef.current, viewport, dprRef.current);
  }, [viewport, overlayTick]);

  // Lazy-loaded images finished → repaint.
  useEffect(
    () =>
      onImageLoaded(() => {
        redrawScene(baseRef.current, elementsRef.current, viewportRef.current, dprRef.current);
      }),
    []
  );

  // ---------- helpers ----------

  const posFromEvent = (e) => {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    return eventToWorld(e, canvas, viewportRef.current);
  };

  const bumpOverlay = () => setOverlayTick((v) => v + 1);

  // Style bag shared by every gesture (captured at gesture start so
  // mid-drag palette changes don't repaint the in-progress element).
  const styleFor = (tool) => {
    const t = toolRef.current;
    const closed = tool === 'rectangle' || tool === 'ellipse' || tool === 'diamond';
    return {
      strokeColor: t.color,
      backgroundColor: closed ? t.backgroundColor : 'transparent',
      fillStyle: t.fillStyle,
      strokeStyle: t.strokeStyle,
      strokeWidth: t.brushSize,
      roughness: t.roughness,
      opacity: t.opacity,
      userId: 'local',
    };
  };

  // Drag box with correct origin for negative drags; line/arrow get
  // rebased points so points[] always stays relative to x/y.
  const shapeFromDrag = (type, start, cur, style) => {
    const dx = cur.x - start.x;
    const dy = cur.y - start.y;
    const nx = Math.min(0, dx);
    const ny = Math.min(0, dy);
    const el = createElement(type, {
      x: start.x + nx,
      y: start.y + ny,
      width: Math.abs(dx),
      height: Math.abs(dy),
      ...style,
    });
    if (type === 'line' || type === 'arrow') {
      el.points = [[-nx, -ny], [dx - nx, dy - ny]];
    }
    return el;
  };

  const emitElement = (el) => {
    if (!emitDraw) return;
    // deep-ish copy: redux state is frozen in dev; socket serializes anyway
    emitDraw(el.points ? { ...el, points: el.points.map((p) => [...p]) } : { ...el });
  };

  const eraseAt = (world) => {
    const g = gestureRef.current;
    if (!g) return;
    const tol = 8 / viewportRef.current.zoom; // constant screen feel
    const hit = elementAtPoint(elementsRef.current, world.x, world.y, tol);
    if (!hit || g.erased.has(hit.id)) return;
    g.erased.add(hit.id);
    dispatch(removeElements([hit.id]));
    if (emitDelete) emitDelete([hit.id]);
  };

  // ---------- inline text input ----------

  const setTextState = (next) => {
    textInputRef.current = next;
    setTextInput(next);
  };

  const commitText = () => {
    const current = textInputRef.current;
    if (!current) return;
    setTextState(null);
    if (!current.value.trim()) return;

    const t = toolRef.current;
    const el = createElement('text', {
      x: current.x,
      y: current.y,
      text: current.value,
      fontSize: t.fontSize,
      fontFamily: t.fontFamily,
      textAlign: t.textAlign,
      strokeColor: t.color,
      opacity: t.opacity,
      userId: 'local',
    });
    dispatch(addElement(el));
    emitElement(el);
  };

  const cancelText = () => setTextState(null);

  const onTextChange = (value) => {
    const current = textInputRef.current;
    if (!current) return;
    setTextState({ ...current, value });
  };

  // Only commit on blur if this is still the active input (it may have
  // been superseded by a newer one created in startDrawing).
  const handleTextBlur = (inputId) => {
    const current = textInputRef.current;
    if (!current || current.id !== inputId) return;
    commitText();
  };

  // ---------- gesture handlers ----------

  const startDrawing = (e) => {
    if (!overlayRef.current) return;
    if (e.button != null && e.button !== 0) return; // left button / touch only
    // The inline text editor is a child of the container — clicks inside
    // it must reach the input untouched (caret placement, selection).
    if (e.target && e.target.closest && e.target.closest('input')) return;
    // Cancel Chrome's default mousedown focus handling: it can run AFTER
    // React mounts the text editor (trusted-input focus fixup) and yank
    // focus out of the fresh input → editor closes untyped (Excalidraw
    // prevents default on canvas mousedown for the same reason).
    e.preventDefault();
    const world = posFromEvent(e);
    if (!world) return;

    // A pending text gets placed before any new interaction
    if (textInputRef.current) commitText();

    const tool = canonicalTool(toolRef.current.activeTool);
    if (INERT_TOOLS.has(tool)) return;

    if (tool === 'text') {
      textIdCounter += 1;
      setTextState({ id: textIdCounter, x: world.x, y: world.y, value: '' });
      return;
    }

    isDrawingRef.current = true;
    dispatch(setDrawing(true));
    const style = styleFor(tool);

    if (tool === 'eraser') {
      gestureRef.current = { tool, erased: new Set() };
      dispatch(beginHistory()); // one checkpoint for the whole erase pass
      eraseAt(world);
      return;
    }

    if (tool === FREEHAND) {
      const el = createElement('freedraw', {
        x: world.x,
        y: world.y,
        points: [[0, 0]],
        ...style,
      });
      gestureRef.current = { tool, id: el.id, lastEmit: 0 };
      dispatch(addElement(el)); // snapshots (new id)
      emitElement(el);
      return;
    }

    if (SHAPE_TOOLS.has(tool)) {
      gestureRef.current = { tool, start: world, style };
      previewRef.current = shapeFromDrag(tool, world, world, style);
      bumpOverlay();
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const g = gestureRef.current;
    if (!g) return;
    const world = posFromEvent(e);
    if (!world) return;

    // Cursor broadcast in WORLD coords (viewport-independent; rendered
    // per-client with its own camera — see Phase 9 for the relay).
    if (emitCursorMove) emitCursorMove({ x: world.x, y: world.y });

    if (g.tool === 'eraser') {
      eraseAt(world);
      return;
    }

    if (g.tool === FREEHAND) {
      const zoom = viewportRef.current.zoom;
      dispatch(
        updateElements({
          ids: [g.id],
          changes: (el) => {
            const px = world.x - el.x;
            const py = world.y - el.y;
            const last = el.points[el.points.length - 1];
            if (last && Math.hypot(px - last[0], py - last[1]) < MIN_POINT_DIST / zoom) return;
            el.points.push([px, py]);
            normalizeBounds(el);
            el.version = (el.version || 1) + 1;
          },
        })
      );
      // Throttled live emit so collaborators watch the stroke grow.
      const now = performance.now();
      if (now - g.lastEmit >= EMIT_INTERVAL_MS) {
        g.lastEmit = now;
        const el = store.getState().board.elements.find((x) => x.id === g.id);
        if (el) emitElement(el);
      }
      return;
    }

    if (SHAPE_TOOLS.has(g.tool)) {
      previewRef.current = shapeFromDrag(g.tool, g.start, world, g.style);
      bumpOverlay();
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    dispatch(setDrawing(false));
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g) return;

    if (g.tool === 'eraser') return; // removals already applied

    if (g.tool === FREEHAND) {
      // Final full-state emit (last points may be unthrottled).
      const el = store.getState().board.elements.find((x) => x.id === g.id);
      if (el) emitElement(el);
      return;
    }

    if (SHAPE_TOOLS.has(g.tool)) {
      const world = e ? posFromEvent(e) : null;
      const cur = world || g.start;
      const el = shapeFromDrag(g.tool, g.start, cur, g.style);
      previewRef.current = null;
      bumpOverlay();

      const dx = Math.abs(cur.x - g.start.x);
      const dy = Math.abs(cur.y - g.start.y);
      const open = g.tool === 'line' || g.tool === 'arrow';
      const degenerate = open ? dx < 2 && dy < 2 : dx < 2 || dy < 2;
      if (degenerate) return; // click without drag → discard

      dispatch(addElement(el)); // snapshots
      emitElement(el);
    }
  };

  // ---------- event listeners (re-registered each render for fresh closures) ----------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (e) => startDrawing(e);
    const onMouseMove = (e) => draw(e);
    const onMouseUp = (e) => stopDrawing(e); // window: release outside still ends it

    const onTouchStart = (e) => {
      e.preventDefault();
      startDrawing(e);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      draw(e);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      stopDrawing(e);
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  });

  return {
    containerRef,
    baseRef,
    overlayRef,
    textInput,
    onTextChange,
    commitText,
    cancelText,
    handleTextBlur,
  };
};
