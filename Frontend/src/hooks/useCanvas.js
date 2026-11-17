import { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch, useStore } from 'react-redux';
import {
  addElement,
  updateElements,
  removeElements,
  beginHistory,
  setDrawing,
  setSelection,
  toggleSelected,
  clearSelection,
  undo,
  redo,
  setElements,
} from '../store/slices/boardSlice';
import {
  setViewport,
  panBy,
  setPanning,
  setSpaceHeld,
} from '../store/slices/viewportSlice';
import {
  createElement,
  normalizeBounds,
  elementAtPoint,
  getElementBounds,
  createId,
  measureText,
} from '../utils/elementModel';
import {
  selectionBox,
  hitHandle,
  marqueeHits,
  rectFromDrag,
  resizeChanges,
  rotateChanges,
  angleAround,
} from '../utils/selection';
import { applyBindings, boundArrowChanges } from '../utils/binding';
import {
  eventToWorld,
  zoomAtScreenPoint,
  fitViewportToElements,
} from '../utils/viewport';
import { redrawScene, redrawOverlay, onImageLoaded } from '../utils/renderer';

// Drag-preview tools → one element committed on pointerup.
// 'frame' rides along (crisp box + name, see stopDrawing).
const SHAPE_TOOLS = new Set(['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'frame']);
// Progressive tools: points accumulate during the gesture.
const FREEHAND = 'freedraw';
// (No inert tools right now — laser/image/frame landed in Phase 4.)

// Old toolbar ids → new model ids (defensive; toolbar now emits new ids).
const canonicalTool = (t) =>
  t === 'pencil' ? 'freedraw' : t === 'circle' ? 'ellipse' : t;

const EMIT_INTERVAL_MS = 50; // throttle live stroke chunks
const MIN_POINT_DIST = 1.2; // screen px between freedraw points

let textIdCounter = 0;

export const useCanvas = ({ emitDraw, emitCursorMove, emitDelete, emitUpdateElements } = {}) => {
  const containerRef = useRef(null);
  const baseRef = useRef(null); // committed layer
  const overlayRef = useRef(null); // preview / interaction layer
  const dprRef = useRef(1);
  const isDrawingRef = useRef(false);
  const gestureRef = useRef(null); // active gesture bookkeeping
  const previewRef = useRef(null);
  const textInputRef = useRef(null);
  const spaceRef = useRef(false); // space bar held → next drag pans
  const marqueeRef = useRef(null); // {x,y,width,height} world rect (ref → per-move redraw via tick)
  const laserRef = useRef(null); // {points:[{x,y,t}], raf} — fading laser trail
  const lastClickRef = useRef(null); // {id,x,y,t} — double-click detection for text edit-in-place
  const clipboardRef = useRef(null); // {els, cx, cy} — Ctrl+C/Ctrl+V/Ctrl+D
  const lastCursorRef = useRef(null); // {x,y} — last mouse cursor position (for paste)

  const toolState = useSelector((s) => s.tool);
  const elements = useSelector((s) => s.board.elements);
  const selectedIds = useSelector((s) => s.board.selectedIds);
  const viewport = useSelector((s) => s.viewport);

  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const toolRef = useRef(toolState);
  toolRef.current = toolState;

  // socket emitters for the keyboard effect (stable ref, fresh values)
  const emitRef = useRef({});
  emitRef.current = { emitDraw, emitCursorMove, emitDelete, emitUpdateElements };

  const dispatch = useDispatch();
  const store = useStore();
  const [textInput, setTextInput] = useState(null);
  const [hoverId, setHoverId] = useState(null); // element under pointer (selection tool)
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
    redrawOverlay(
      overlayRef.current,
      {
        preview: previewRef.current,
        marquee: marqueeRef.current,
        laser: laserRef.current?.points,
      },
      viewportRef.current,
      dpr
    );
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
  // Redraws when the scene, camera, selection, hover or the tick
  // (marquee/preview ref updates) change.
  useEffect(() => {
    const selBox = selectionBox(elements, selectedIds);
    const hoverBox = hoverId ? selectionBox(elements, [hoverId]) : null;
    redrawOverlay(
      overlayRef.current,
      {
        preview: previewRef.current,
        hover: hoverBox,
        marquee: marqueeRef.current,
        selection: selBox,
        laser: laserRef.current?.points,
      },
      viewport,
      dprRef.current
    );
  }, [elements, viewport, selectedIds, hoverId, overlayTick]);

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

  // Pointer position in CLIENT (screen) px — works for mouse + touch events.
  const clientFromEvent = (e) => {
    const src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    return { x: src.clientX, y: src.clientY };
  };

  // Start a pan gesture (space-drag / middle-drag / hand tool).
  const beginPan = (e) => {
    const p = clientFromEvent(e);
    isDrawingRef.current = true;
    gestureRef.current = { tool: 'pan', lastX: p.x, lastY: p.y };
    dispatch(setPanning(true));
  };

  const bumpOverlay = () => setOverlayTick((v) => v + 1);

  // ---------- laser pointer ----------
  // Trail lives on the overlay only (no elements, no history). A rAF
  // loop trims expired points and repaints until the trail is gone.
  const LASER_LIFE = 1000; // ms — matches renderer.js fade

  const pushLaser = (world) => {
    let L = laserRef.current;
    if (!L) {
      L = { points: [], raf: 0 };
      laserRef.current = L;
    }
    const pt = { x: world.x, y: world.y, t: performance.now() };
    L.points.push(pt);
    // Emit this point to the room so collaborators see the trail grow
    const { emitUpdateElements: emitUE } = emitRef.current;
    if (emitUE) emitUE([{ type: 'laser-point', ...pt, userId: 'local' }]);
    if (L.raf) return;
    const tick = () => {
      const l = laserRef.current;
      if (!l) return;
      const now = performance.now();
      l.points = l.points.filter((p) => now - p.t < LASER_LIFE);
      bumpOverlay();
      if (l.points.length) {
        l.raf = requestAnimationFrame(tick);
      } else {
        l.raf = 0;
        laserRef.current = null;
      }
    };
    L.raf = requestAnimationFrame(tick);
  };

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

  /** Emit a batch of element updates via the dedicated update-elements event. */
  const emitUpdateElementsBatch = (updates) => {
    const { emitUpdateElements: emitUE } = emitRef.current || {};
    if (!emitUE) return;
    emitUE(updates);
  };

  // Elements fully inside a frame ride along when the frame moves
  // (Excalidraw: dragging a frame drags its content).
  const expandWithFrames = (elements, ids) => {
    const frames = elements.filter((el) => el.type === 'frame' && ids.includes(el.id));
    if (!frames.length) return ids;
    const out = new Set(ids);
    for (const f of frames) {
      const fb = getElementBounds(f);
      for (const el of elements) {
        if (out.has(el.id) || el.type === 'frame') continue;
        const b = getElementBounds(el);
        if (
          b.x >= fb.x && b.y >= fb.y &&
          b.x + b.width <= fb.x + fb.width &&
          b.y + b.height <= fb.y + fb.height
        ) {
          out.add(el.id);
        }
      }
    }
    return [...out];
  };

  // ---------- image tool ----------

  // Reused hidden <input type=file>; the picker opens AFTER the drag
  // (a native dialog would swallow the gesture mid-flight).
  const pickImage = (cb) => {
    let input = document.getElementById('colab-image-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.id = 'colab-image-input';
      input.setAttribute('data-testid', 'image-input');
      input.style.display = 'none';
      document.body.appendChild(input);
    }
    if (typeof window !== 'undefined') window.__colabImageProbe = undefined;
    input.onchange = () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (file) cb(file);
    };
    input.click();
  };

  const placeImage = (file, target) => {
    // target = {x,y,width,height} drag box, or {x,y} click point
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const nw = img.naturalWidth || 100;
        const nh = img.naturalHeight || 100;
        let x, y, width, height;
        if (target.width >= 4 && target.height >= 4) {
          // drag box → fit (aspect-preserving, centered)
          const s = Math.min(target.width / nw, target.height / nh);
          width = nw * s;
          height = nh * s;
          x = target.x + (target.width - width) / 2;
          y = target.y + (target.height - height) / 2;
        } else {
          // plain click → natural size, capped at 400px
          const s = Math.min(1, 400 / Math.max(nw, nh));
          width = nw * s;
          height = nh * s;
          x = target.x;
          y = target.y;
        }
        let src = dataURL;
        // Socket.io's default ~1MB frame limit → re-encode giants
        if (dataURL.length > 400_000 || Math.max(nw, nh) > 1200) {
          const rs = Math.min(1, 1200 / Math.max(nw, nh));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(nw * rs));
          c.height = Math.max(1, Math.round(nh * rs));
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff'; // jpeg has no alpha
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          src = c.toDataURL('image/jpeg', 0.85);
        }
        const el = createElement('image', {
          x, y, width, height, src,
          strokeColor: toolRef.current.color,
          opacity: toolRef.current.opacity,
          userId: 'local',
        });
        dispatch(addElement(el));
        emitElement(el);
      };
      img.onerror = () => {
        console.warn('image element failed to load', dataURL.slice(0, 80));
      };
      img.src = dataURL;
    };
    reader.onerror = () => {
      console.warn('image file read failed');
    };
    reader.readAsDataURL(file);
  };

  // Sync arrows/lines bound to any of `movedIds` (call AFTER the
  // element update so we read fresh positions). Returns changed ids.
  const syncBoundArrows = (movedIds) => {
    const els = store.getState().board.elements;
    const moved = new Set(movedIds);
    const changes = boundArrowChanges(els, moved);
    const ids = Object.keys(changes);
    if (!ids.length) return [];
    dispatch(
      updateElements({
        ids,
        changes: (el) => {
          const c = changes[el.id];
          if (!c) return;
          el.points = c.points;
          normalizeBounds(el);
        },
      })
    );
    return ids;
  };

  // Snapshot geometry of the selected elements at gesture start —
  // move/resize/rotate compute per-frame changes from this so each
  // frame is absolute, not cumulative.
  const captureGeometries = (elements, ids) => {
    const idSet = new Set(ids);
    const map = new Map();
    for (const el of elements) {
      if (!idSet.has(el.id)) continue;
      map.set(el.id, {
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        angle: el.angle || 0,
        points: el.points ? el.points.map((p) => [...p]) : null,
        fontSize: el.fontSize,
      });
    }
    return map;
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

    // If the id matches an EXISTING text element → update in place
    // (edit-in-place via double-click). Otherwise create a new element.
    const existing = store.getState().board.elements.find(
      (el) => el.id === current.id && el.type === 'text'
    );
    if (existing) {
      dispatch(beginHistory());
      dispatch(
        updateElements({
          ids: [current.id],
          changes: {
            text: current.value,
            ...measureText(current.value, t.fontSize, t.fontFamily),
          },
        })
      );
      emitElement({ ...existing, text: current.value });
      return;
    }

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
    // Middle button → always pan (also kills Chrome's autoscroll-on-click)
    if (e.button === 1) {
      e.preventDefault();
      beginPan(e);
      return;
    }
    if (e.button != null && e.button !== 0) return; // left button / touch only
    // The inline text editor and floating UI (zoom widget) are children
    // of the container — clicks inside them must not start a gesture.
    if (e.target && e.target.closest && e.target.closest('input, [data-ui]')) return;
    // Cancel Chrome's default mousedown focus handling: it can run AFTER
    // React mounts the text editor (trusted-input focus fixup) and yank
    // focus out of the fresh input → editor closes untyped (Excalidraw
    // prevents default on canvas mousedown for the same reason).
    e.preventDefault();

    // A pending text gets placed before any new interaction
    if (textInputRef.current) commitText();

    // Space held or hand tool → pan the camera instead of drawing
    if (spaceRef.current || canonicalTool(toolRef.current.activeTool) === 'hand') {
      beginPan(e);
      return;
    }

    const world = posFromEvent(e);
    if (!world) return;

    const tool = canonicalTool(toolRef.current.activeTool);

    // ---------- selection tool ----------
    if (tool === 'selection') {
      const board = store.getState().board;
      const selBox = selectionBox(board.elements, board.selectedIds);

      // First, hit-test the element under the pointer (for double-click on text
      // and for shift+click toggle). This must run BEFORE handle checks so that
      // a double-click on an already-selected text element doesn't hit a
      // resize handle first.
      const tol = 8 / viewportRef.current.zoom;
      const hit = elementAtPoint(board.elements, world.x, world.y, tol);

      // shift+click on an element → toggle it in/out of the selection
      if (e.shiftKey && hit) {
        dispatch(toggleSelected(hit.id));
        return;
      }

      // Double-click on a text element → edit in place (Excalidraw behavior).
      // Track last click per element id; a second click within 500 ms on
      // the same text element opens the editor instead of selecting.
      if (hit && hit.type === 'text') {
        const now = performance.now();
        const last = lastClickRef.current;
        if (
          last &&
          last.id === hit.id &&
          now - last.t < 500 &&
          Math.hypot(world.x - last.x, world.y - last.y) < 12
        ) {
          // Enter edit mode on the existing text element — reuse its id
          // so commitText() updates in place instead of creating a new one.
          dispatch(setSelection([hit.id]));
          textIdCounter += 1;
          setTextState({
            id: hit.id, // matches the existing element's id → edit-in-place
            x: hit.x,
            y: hit.y,
            value: hit.text || '',
          });
          lastClickRef.current = null;
          return;
        }
        // First click on text: record for potential double-click.
        // Do NOT start move gesture yet — wait for either:
        // - second click (double-click → edit)
        // - mouse move > threshold (start move gesture)
        lastClickRef.current = { id: hit.id, x: world.x, y: world.y, t: now };
        // Just select, don't start dragging yet
        const already = board.selectedIds.includes(hit.id);
        if (!already) dispatch(setSelection([hit.id]));
        return;
      } else {
        lastClickRef.current = null;
      }

      // 1) resize / rotate handles (they sit on top of everything)
      // Only check handles if we didn't just handle a text double-click above.
      // Note: selBox may be empty (no selection), in which case hitHandle returns null.
      const handle = hitHandle(selBox, world, viewportRef.current.zoom);
      if (handle) {
        isDrawingRef.current = true;
        dispatch(setDrawing(true));
        setHoverId(null);
        gestureRef.current = {
          tool: handle === 'rotate' ? 'rotate' : 'resize',
          handle,
          box: selBox,
          start: world,
          ids: [...board.selectedIds],
          origs: captureGeometries(board.elements, board.selectedIds),
          didCheckpoint: false,
          boundIds: new Set(),
        };
        return;
      }

      if (hit) {
        const already = board.selectedIds.includes(hit.id);
        if (!already) dispatch(setSelection([hit.id]));
        // Non-text elements: start move gesture immediately
        isDrawingRef.current = true;
        dispatch(setDrawing(true));
        setHoverId(null);
        const ids = expandWithFrames(
          board.elements,
          already ? board.selectedIds : [hit.id]
        );
        gestureRef.current = {
          tool: 'move',
          start: world,
          ids,
          origs: captureGeometries(board.elements, ids),
          didCheckpoint: false,
          boundIds: new Set(),
        };
        return;
      }

      // empty space → marquee (replaces selection unless shift-held)
      if (!e.shiftKey) dispatch(clearSelection());
      isDrawingRef.current = true;
      dispatch(setDrawing(true));
      gestureRef.current = {
        tool: 'marquee',
        start: world,
        base: e.shiftKey ? [...board.selectedIds] : [],
      };
      marqueeRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
      bumpOverlay();
      return;
    }

    if (tool === 'text') {
      textIdCounter += 1;
      setTextState({ id: textIdCounter, x: world.x, y: world.y, value: '' });
      return;
    }

    // laser: trail only — no elements, no history
    if (tool === 'laser') {
      isDrawingRef.current = true;
      dispatch(setDrawing(true));
      gestureRef.current = { tool: 'laser' };
      pushLaser(world);
      return;
    }

    // image: gesture defines the box/point, picker opens on mouseup
    if (tool === 'image') {
      isDrawingRef.current = true;
      dispatch(setDrawing(true));
      gestureRef.current = { tool: 'image', start: world };
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
    // ---- idle hover (selection tool only): highlight under pointer ----
    if (!isDrawingRef.current) {
      const tool = canonicalTool(toolRef.current.activeTool);
      if (tool !== 'selection') {
        setHoverId((prev) => (prev == null ? prev : null));
        return;
      }
      const world = posFromEvent(e);
      if (!world) return;
      const tol = 8 / viewportRef.current.zoom;
      const hit = elementAtPoint(elementsRef.current, world.x, world.y, tol);
      const id = hit ? hit.id : null;
      setHoverId((prev) => (prev === id ? prev : id)); // no rerender if unchanged
      return;
    }

    const g = gestureRef.current;
    if (!g) return;

    // Pan gesture: screen-space deltas → camera offset
    if (g.tool === 'pan') {
      const p = clientFromEvent(e);
      const dx = p.x - g.lastX;
      const dy = p.y - g.lastY;
      g.lastX = p.x;
      g.lastY = p.y;
      if (dx || dy) dispatch(panBy({ dx, dy }));
      return;
    }

    const world = posFromEvent(e);
    if (!world) return;

    // Cursor broadcast in WORLD coords (viewport-independent; rendered
    // per-client with its own camera — see Phase 9 for the relay).
    if (emitCursorMove) emitCursorMove({ x: world.x, y: world.y });
    lastCursorRef.current = { x: world.x, y: world.y };

    // ---- selection gestures ----

    if (g.tool === 'marquee') {
      const rect = rectFromDrag(g.start, world);
      marqueeRef.current = rect;
      const hits = marqueeHits(elementsRef.current, rect);
      const merged = g.base.length
        ? Array.from(new Set([...g.base, ...hits]))
        : hits;
      const cur = store.getState().board.selectedIds;
      const same =
        cur.length === merged.length && merged.every((id) => cur.includes(id));
      if (!same) dispatch(setSelection(merged));
      bumpOverlay();
      return;
    }

    if (g.tool === 'move') {
      const dx = world.x - g.start.x;
      const dy = world.y - g.start.y;
      if (!dx && !dy) return;
      if (!g.didCheckpoint) {
        dispatch(beginHistory()); // one undo step for the whole drag
        g.didCheckpoint = true;
      }
      dispatch(
        updateElements({
          ids: g.ids,
          changes: (el) => {
            const o = g.origs.get(el.id);
            if (!o) return;
            el.x = o.x + dx;
            el.y = o.y + dy;
          },
        })
      );
      syncBoundArrows(g.ids).forEach((id) => g.boundIds?.add(id));
      return;
    }

    if (g.tool === 'resize') {
      const changes = resizeChanges(g.box, g.handle, world, g.origs, g.ids);
      if (!Object.keys(changes).length) return;
      if (!g.didCheckpoint) {
        dispatch(beginHistory());
        g.didCheckpoint = true;
      }
      dispatch(
        updateElements({
          ids: g.ids,
          changes: (el) => {
            const c = changes[el.id];
            if (c) Object.assign(el, c);
          },
        })
      );
      syncBoundArrows(g.ids).forEach((id) => g.boundIds?.add(id));
      return;
    }

    if (g.tool === 'rotate') {
      const cx = g.box.x + g.box.width / 2;
      const cy = g.box.y + g.box.height / 2;
      const center = { x: cx, y: cy };
      const changes = rotateChanges(
        g.box,
        angleAround(center, g.start),
        angleAround(center, world),
        g.origs,
        g.ids,
        e.shiftKey // shift → snap to 15°
      );
      if (!Object.keys(changes).length) return;
      if (!g.didCheckpoint) {
        dispatch(beginHistory());
        g.didCheckpoint = true;
      }
      dispatch(
        updateElements({
          ids: g.ids,
          changes: (el) => {
            const c = changes[el.id];
            if (c) Object.assign(el, c);
          },
        })
      );
      syncBoundArrows(g.ids).forEach((id) => g.boundIds?.add(id));
      return;
    }

    if (g.tool === 'laser') {
      pushLaser(world);
      return;
    }

    if (g.tool === 'image') {
      // dashed violet preview rect from drag start → current point
      previewRef.current = createElement('rectangle', {
        ...rectFromDrag(g.start, world),
        strokeColor: '#7c3aed',
        strokeStyle: 'dashed',
        fillStyle: 'solid',
        fill: 'transparent',
        strokeWidth: 2,
        roughness: 0,
        opacity: 0.6,
      });
      bumpOverlay();
      return;
    }

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

    if (g.tool === 'pan') {
      dispatch(setPanning(false));
      return;
    }

    if (g.tool === 'marquee') {
      marqueeRef.current = null;
      bumpOverlay();
      return;
    }

    // move/resize/rotate: push the final state to the room
    if (g.tool === 'move' || g.tool === 'resize' || g.tool === 'rotate') {
      if (g.didCheckpoint) {
        const els = store.getState().board.elements;
        const emitIds = new Set([...g.ids, ...(g.boundIds || [])]);
        const updates = [];
        for (const id of emitIds) {
          const el = els.find((x) => x.id === id);
          if (el) updates.push({ ...el });
        }
        if (updates.length) emitUpdateElementsBatch(updates);
      }
      return;
    }

    if (g.tool === 'laser') return; // trail fades on its own — nothing to commit

    if (g.tool === 'image') {
      previewRef.current = null;
      bumpOverlay();
      const world = e ? posFromEvent(e) : null;
      const cur = world || g.start;
      const dx = Math.abs(cur.x - g.start.x);
      const dy = Math.abs(cur.y - g.start.y);
      // ≥4px drag → aspect-fit the image in the box; plain click →
      // natural size at the click point. Picker opens AFTER the
      // gesture (a native dialog would swallow the drag).
      const target =
        dx >= 4 && dy >= 4 ? rectFromDrag(g.start, cur) : { x: g.start.x, y: g.start.y };
      pickImage((file) => placeImage(file, target));
      return;
    }

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

      // frames auto-name like Excalidraw ("Frame 1", "Frame 2", …)
      if (g.tool === 'frame') {
        const frames = store.getState().board.elements.filter((x) => x.type === 'frame');
        el.name = `Frame ${frames.length + 1}`;
      }

      // arrows/lines bind to shapes their endpoints landed on
      if (open) {
        const tol = 8 / viewportRef.current.zoom;
        applyBindings(el, store.getState().board.elements, tol);
        normalizeBounds(el);
      }

      dispatch(addElement(el)); // snapshots
      emitElement(el);
    }
  };

  // ---------- wheel: pan / horizontal pan / ctrl-zoom at cursor ----------
  // Excalidraw defaults: plain wheel pans, shift+wheel pans horizontally,
  // ctrl/cmd+wheel (and trackpad pinch) zooms around the pointer.
  // "zoom with scroll wheel" is a preference (default OFF — Excalidraw makes this opt-in).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      // don't hijack wheel over the inline editor or floating UI
      if (e.target && e.target.closest && e.target.closest('input, [data-ui]')) return;
      e.preventDefault(); // stop page scroll / browser pinch-zoom
      const vp = viewportRef.current;
      const zoomWithWheel = toolRef.current?.zoomWithWheel ?? false;

      if (e.ctrlKey || e.metaKey) {
        if (!e.deltaY) return; // horizontal-only wheel never zooms
        const rect = container.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.002);
        dispatch(
          setViewport(
            zoomAtScreenPoint(vp, vp.zoom * factor, e.clientX - rect.left, e.clientY - rect.top)
          )
        );
        return;
      }
      // If user enabled "zoom with wheel" preference, plain wheel zooms at center
      if (zoomWithWheel) {
        if (!e.deltaY) return;
        const rect = container.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.002);
        dispatch(
          setViewport(
            zoomAtScreenPoint(vp, vp.zoom * factor, rect.width / 2, rect.height / 2)
          )
        );
        return;
      }
      if (e.shiftKey) {
        const d = e.deltaY || e.deltaX; // vertical wheel → horizontal pan
        if (d) dispatch(panBy({ dx: -d, dy: 0 }));
        return;
      }
      if (!e.deltaX && !e.deltaY) return;
      dispatch(panBy({ dx: -e.deltaX, dy: -e.deltaY }));
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  // ---------- keyboard: space-to-pan + zoom shortcuts ----------
  useEffect(() => {
    const isTyping = () => {
      const ae = document.activeElement;
      return !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
    };

    const zoomStep = (factor) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vp = viewportRef.current;
      dispatch(
        setViewport(zoomAtScreenPoint(vp, vp.zoom * factor, r.width / 2, r.height / 2))
      );
    };

    const fit = () => {
      const el = containerRef.current;
      if (!el) return;
      dispatch(
        setViewport(
          fitViewportToElements(store.getState().board.elements, el.clientWidth, el.clientHeight, 48)
        )
      );
    };

    const onKeyDown = (e) => {
      if (e.code === 'Space') {
        if (isTyping()) return;
        e.preventDefault(); // no page scroll while space is held
        if (e.isRepeat) return;
        if (!spaceRef.current) {
          spaceRef.current = true;
          dispatch(setSpaceHeld(true));
        }
        return;
      }
      if (isTyping()) return;

      // Escape → drop the selection (Excalidraw behavior)
      if (e.key === 'Escape') {
        dispatch(clearSelection());
        return;
      }

      // Delete/Backspace → remove selected elements (synced to room)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = store.getState().board.selectedIds;
        if (ids.length) {
          e.preventDefault();
          dispatch(beginHistory());
          dispatch(removeElements(ids));
          emitRef.current.emitDelete?.(ids);
        }
        return;
      }

      // +/= zoom in, -/_ zoom out (plain or with ctrl — we preventDefault
      // so the browser's own zoom/text-size shortcuts don't fire)
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomStep(1.2);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomStep(1 / 1.2);
      } else if (e.key === '!' || (e.shiftKey && e.key === '1')) {
        e.preventDefault(); // Shift+1 → zoom to fit
        fit();
      }
      // Ctrl+A / Cmd+A → select all elements
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const allIds = store.getState().board.elements.map((el) => el.id);
        dispatch(setSelection(allIds));
        return;
      }
      // Ctrl+C / Cmd+C → copy selection to clipboard
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        const ids = store.getState().board.selectedIds;
        if (ids.length) {
          const els = store.getState().board.elements.filter((el) => ids.includes(el.id));
          // bbox center of the selection (for pasting at cursor)
          let cx = 0, cy = 0, n = 0;
          for (const el of els) {
            cx += el.x + (el.width || 0) / 2;
            cy += el.y + (el.height || 0) / 2;
            n++;
          }
          clipboardRef.current = {
            els: els.map((el) => ({ ...el })),
            cx: n ? cx / n : 0,
            cy: n ? cy / n : 0,
          };
        }
        return;
      }
      // Ctrl+V / Cmd+V → paste at last cursor position
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        const cb = clipboardRef.current;
        if (!cb || !cb.els.length) return;
        // Use the last cursor position as the paste anchor
        const cx = lastCursorRef.current?.x ?? cb.cx;
        const cy = lastCursorRef.current?.y ?? cb.cy;
        const dx = cx - cb.cx;
        const dy = cy - cb.cy;
        const newIds = [];
        const idMap = new Map();
        for (const el of cb.els) {
          const id = createId();
          idMap.set(el.id, id);
          newIds.push(id);
          dispatch(
            addElement({
              ...el,
              id,
              x: el.x + dx,
              y: el.y + dy,
            })
          );
        }
        dispatch(setSelection(newIds));
        // Re-bind arrows/lines that pointed at the original elements
        for (const el of store.getState().board.elements) {
          if ((el.type === 'arrow' || el.type === 'line') && el.points) {
            let changed = false;
            const pts = el.points.map((p) => {
              const mapped = idMap.get(p.bindTarget);
              if (mapped) { changed = true; return { ...p, bindTarget: mapped }; }
              return p;
            });
            if (changed) dispatch(updateElements({ ids: [el.id], changes: { points: pts } }));
          }
        }
        return;
      }
      // Ctrl+D / Cmd+D → duplicate selected elements in place
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const ids = store.getState().board.selectedIds;
        if (!ids.length) return;
        const els = store.getState().board.elements.filter((el) => ids.includes(el.id));
        // Offset by 20px so the duplicate is visible
        const newIds = [];
        for (const el of els) {
          const id = createId();
          newIds.push(id);
          dispatch(addElement({ ...el, id, x: el.x + 20, y: el.y + 20 }));
        }
        dispatch(setSelection(newIds));
        return;
      }
      // Ctrl+X / Cmd+X → cut (remove + copy to clipboard)
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        const ids = store.getState().board.selectedIds;
        if (!ids.length) return;
        const els = store.getState().board.elements.filter((el) => ids.includes(el.id)).map((el) => ({ ...el }));
        clipboardRef.current = { els, cx: 0, cy: 0 };
        let cx = 0, cy = 0, n = 0;
        for (const el of els) { cx += el.x + (el.width || 0) / 2; cy += el.y + (el.height || 0) / 2; n++; }
        clipboardRef.current = { els, cx: n ? cx / n : 0, cy: n ? cy / n : 0 };
        dispatch(beginHistory());
        dispatch(removeElements(ids));
        emitRef.current.emitDelete?.(ids);
        return;
      }
      // N → tie-breaker: send selected elements to back (Excalidraw default)
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        const ids = store.getState().board.selectedIds;
        if (!ids.length) return;
        const elArr = [...store.getState().board.elements];
        const keep = elArr.filter((el) => !ids.includes(el.id));
        const moved = elArr.filter((el) => ids.includes(el.id));
        dispatch(setElements([...moved, ...keep])); // moved first = below others
        return;
      }
      // Ctrl+K / Cmd+K → toggle command palette (dispatched via custom event)
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('colab-open-command-palette'));
        return;
      }
      // Ctrl+O / Cmd+O → open file picker for JSON import
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('colab-open-import-dialog'));
        return;
      }
      // Ctrl+S / Cmd+S → export current viewport as PNG
      else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && !e.shiftKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('colab-export-png'));
        return;
      }
      // Single-letter tool shortcuts (only when not typing)
      // V=select  H=hand  P=pencil  L=line  A=arrow  R=rect  O=ellipse
      // D=diamond  F=frame  I=image  T=text  E=eraser
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && !isTyping() && /^[vhpilradoftte]$/.test(e.key.toLowerCase())) {
        const TOOL_MAP = {
          v: 'selection', h: 'hand', p: 'freedraw', l: 'line', a: 'arrow',
          r: 'rectangle', o: 'ellipse', d: 'diamond', f: 'frame',
          i: 'image', t: 'text', e: 'eraser',
        };
        const target = TOOL_MAP[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          dispatch({ type: 'tool/setTool', payload: target });
          return;
        }
      }
      // Ctrl+Z / Cmd+Z → undo
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
        return;
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z → redo
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey) {
        e.preventDefault();
        dispatch(redo());
        return;
      }
    };

    const onKeyUp = (e) => {
      if (e.code === 'Space' && spaceRef.current) {
        spaceRef.current = false;
        dispatch(setSpaceHeld(false));
      }
    };
    const releaseSpace = () => {
      if (spaceRef.current) {
        spaceRef.current = false;
        dispatch(setSpaceHeld(false));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseSpace); // releasing space alt-tabbed away
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseSpace);
    };
  }, [dispatch]);

  // ---------- event listeners (re-registered each render for fresh closures) ----------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastCursorEmit = 0;
    const emitCursor = (e) => {
      const now = performance.now();
      if (now - lastCursorEmit < 60) return; // throttle ~15 Hz
      lastCursorEmit = now;
      const rect = container.getBoundingClientRect();
      const world = posFromEvent(e);
      const { emitCursorMove: emitCM } = emitRef.current;
      if (!emitCM || !world) return;
      const userId = store.getState().user?.userId ?? 'unknown';
      const username = store.getState().user?.username ?? 'Guest';
      emitCM({
        x: world.x, y: world.y,
        tool: toolRef.current.activeTool,
        userId, username,
      });
    };

    const onMouseDown = (e) => startDrawing(e);
    const onMouseMove = (e) => { draw(e); emitCursor(e); };
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

  // Expose globals so ContextMenu / CommandPalette / Toolbar can dispatch actions
  useEffect(() => {
    window.__COLAB_STORE__ = store;
    window.__COLAB_CLIPBOARD__ = clipboardRef;
    window.__COLAB_EMIT_DELETE = emitDelete;
    window.__FIT_TO_CONTENT = () => {
      const el = containerRef.current;
      if (!el) return;
      dispatch(setViewport(fitViewportToElements(store.getState().board.elements, el.clientWidth, el.clientHeight, 48)));
    };
    window.__ZOOM_STEP = (factor) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vp = viewportRef.current;
      dispatch(setViewport(zoomAtScreenPoint(vp, vp.zoom * factor, r.width / 2, r.height / 2)));
    };
    window.__COLAB_REMOTE_LASERS = [];
    // Phase 8 exports
    window.__EXPORT_PNG = async () => {
      try {
        const { toPngBlob, downloadFile } = await import('../utils/export');
        const els = store.getState().board.elements;
        const vp = viewportRef.current;
        const el = containerRef.current;
        if (!el) return;
        const w = Math.round(el.clientWidth * vp.zoom);
        const h = Math.round(el.clientHeight * vp.zoom);
        const blob = await toPngBlob(els, { width: w, height: h });
        downloadFile(blob, `colab-${Date.now()}.png`);
      } catch (err) {
        console.error('[CoLab] export failed:', err);
      }
    };
    window.__EXPORT_JSON = async () => {
      try {
        const { serializeElements, downloadFile } = await import('../utils/export');
        const state = store.getState();
        const blob = new Blob([serializeElements(state.board.elements, state.viewport)], { type: 'application/json' });
        downloadFile(blob, `colab-${Date.now()}.json`);
      } catch (err) {
        console.error('[CoLab] export failed:', err);
      }
    };
    window.__OPEN_IMPORT_DIALOG = () => {
      document.dispatchEvent(new CustomEvent('colab-open-import-dialog'));
    };
    // Also expose deserializer so Canvas.jsx can call it without require()
    (async () => {
      try {
        const mod = await import('../utils/export');
        window.__DESERIALIZE_SCENE = mod.deserializeScene;
        window.__SERIALIZE_ELEMENTS = mod.serializeElements;
      } catch { /* ignore */ }
    })();
  }, [store, emitDelete, containerRef, dispatch]);

  return {
    containerRef,
    baseRef,
    overlayRef,
    hoverId,
    textInput,
    onTextChange,
    commitText,
    cancelText,
    handleTextBlur,
  };
};
