import { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addElement, setDrawing } from '../store/slices/boardSlice';
import { drawElement, redrawCanvas } from '../utils/drawingTools';

const SHAPE_TOOLS = ['line', 'rectangle', 'circle'];
const ERASER_COLOR = '#ffffff';

let textIdCounter = 0;

export const useCanvas = ({ emitDraw } = {}) => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  // Shape currently being dragged (preview only — committed once on mouseup)
  const previewRef = useRef(null);
  // Mirror of the textInput state so blur/mousedown handlers always see the
  // latest value without stale closures.
  const textInputRef = useRef(null);

  const { activeTool, color, brushSize } = useSelector((state) => state.tool);
  const elements = useSelector((state) => state.board.elements);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const dispatch = useDispatch();
  const [textInput, setTextInput] = useState(null);

  // Eraser always paints white (the canvas surface)
  const strokeColor = activeTool === 'eraser' ? ERASER_COLOR : color;

  // Redraw committed elements whenever the board changes
  // (remote strokes, undo/redo, clear) — keep a live preview on top.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    redrawCanvas(ctx, canvas.width, canvas.height, elements);
    if (previewRef.current) drawElement(ctx, previewRef.current);
  }, [elements]);

  // ---------- helpers ----------

  const posFromEvent = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const src =
      (e.touches && e.touches[0]) ||
      (e.changedTouches && e.changedTouches[0]) ||
      e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const commitElement = (element) => {
    dispatch(addElement(element));
    if (emitDraw) emitDraw(element);
  };

  const isDegenerate = (el) => {
    const dx = Math.abs(el.to.x - el.from.x);
    const dy = Math.abs(el.to.y - el.from.y);
    if (el.type === 'line') return dx < 2 && dy < 2;
    // rect / circle need some size in both axes
    return dx < 2 || dy < 2;
  };

  // ---------- inline text input (no browser prompt() dialog) ----------

  const setTextState = (next) => {
    textInputRef.current = next;
    setTextInput(next);
  };

  const commitText = () => {
    const current = textInputRef.current;
    if (!current) return;
    setTextState(null);
    if (!current.value.trim()) return;

    const element = {
      type: 'text',
      x: current.x,
      y: current.y,
      text: current.value,
      color,
      fontSize: Math.max(14, brushSize * 5),
      userId: 'local',
    };
    commitElement(element);
  };

  const cancelText = () => {
    setTextState(null);
  };

  const onTextChange = (value) => {
    const current = textInputRef.current;
    if (!current) return;
    setTextState({ ...current, value });
  };

  // Only commit on blur if this is still the active input (the input may
  // have been superseded by a newer one created in startDrawing).
  const handleTextBlur = (inputId) => {
    const current = textInputRef.current;
    if (!current || current.id !== inputId) return;
    commitText();
  };

  // ---------- drawing handlers ----------

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = posFromEvent(e);
    if (!pos) return;

    // A pending text gets placed before any new interaction
    if (textInputRef.current) commitText();

    // Text tool: open the inline editor at the click position
    if (activeTool === 'text') {
      textIdCounter += 1;
      setTextState({ id: textIdCounter, x: pos.x, y: pos.y, value: '' });
      return;
    }

    isDrawingRef.current = true;
    lastPosRef.current = pos;
    previewRef.current = null;
    dispatch(setDrawing(true));
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = posFromEvent(e);
    if (!pos) return;

    const ctx = canvas.getContext('2d');

    // Shape tools: render a live preview from start → current position.
    // Nothing is committed until the mouse is released.
    if (SHAPE_TOOLS.includes(activeTool)) {
      const preview = {
        type: activeTool,
        from: lastPosRef.current,
        to: pos,
        color,
        size: brushSize,
      };
      previewRef.current = preview;
      redrawCanvas(ctx, canvas.width, canvas.height, elementsRef.current);
      drawElement(ctx, preview);
      return;
    }

    // Pencil + eraser: each move is one small segment, committed immediately
    // (locally to Redux and over the socket) so strokes survive redraws.
    const segment = {
      type: activeTool,
      from: lastPosRef.current,
      to: pos,
      color: strokeColor,
      size: brushSize,
      userId: 'local',
    };
    drawElement(ctx, segment);
    commitElement(segment);
    lastPosRef.current = pos;
  };

  const stopDrawing = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    dispatch(setDrawing(false));

    if (SHAPE_TOOLS.includes(activeTool)) {
      const preview = previewRef.current;
      previewRef.current = null;
      const canvas = canvasRef.current;
      if (!preview || !canvas) return;

      // Snap the final point to the release position
      if (e) {
        const pos = posFromEvent(e);
        if (pos) preview.to = pos;
      }

      if (isDegenerate(preview)) {
        // Click without a real drag — just erase the preview
        const ctx = canvas.getContext('2d');
        redrawCanvas(ctx, canvas.width, canvas.height, elementsRef.current);
      } else {
        // THE fix: one shape, one element, committed once.
        commitElement(preview);
      }
      return;
    }

    // Pencil/eraser segments are already committed — just reset the path.
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').beginPath();
  };

  // ---------- event listeners (re-registered each render for fresh closures) ----------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e) => startDrawing(e);
    const onMouseMove = (e) => draw(e);
    const onMouseUp = (e) => stopDrawing(e);
    const onMouseOut = (e) => stopDrawing(e);

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

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseout', onMouseOut);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseout', onMouseOut);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  });

  return { canvasRef, textInput, onTextChange, commitText, cancelText, handleTextBlur };
};
