import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setViewport } from '../../store/slices/viewportSlice';
import { zoomAtScreenPoint, fitViewportToElements } from '../../utils/viewport';
import { Minus, Plus, Maximize2 } from 'lucide-react';

/**
 * Floating zoom widget (bottom-left of the canvas) — Excalidraw's
 * zoom bar: out · percentage · in | zoom-to-fit.
 * `containerRef` is the canvas container (for center + size math).
 */
const ZoomControls = ({ containerRef }) => {
  const dispatch = useDispatch();
  const viewport = useSelector((s) => s.viewport);
  const elements = useSelector((s) => s.board.elements);

  const center = () => {
    const el = containerRef?.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { cx: r.width / 2, cy: r.height / 2, w: r.width, h: r.height };
  };

  const step = (factor) => {
    const c = center();
    if (!c) return;
    dispatch(setViewport(zoomAtScreenPoint(viewport, viewport.zoom * factor, c.cx, c.cy)));
  };

  const resetTo100 = () => {
    const c = center();
    if (!c) return;
    dispatch(setViewport(zoomAtScreenPoint(viewport, 1, c.cx, c.cy)));
  };

  const fit = () => {
    const el = containerRef?.current;
    if (!el) return;
    dispatch(setViewport(fitViewportToElements(elements, el.clientWidth, el.clientHeight, 48)));
  };

  return (
    <div
      data-ui
      className="absolute left-3 bottom-3 z-10 flex items-center gap-1 bg-cream border-2 border-ink rounded-xl shadow-[4px_4px_0_#101014] p-1"
    >
      <button className="tool-btn" title="Zoom out (−)" onClick={() => step(1 / 1.2)}>
        <Minus size={14} />
      </button>
      <button
        className="tool-btn min-w-[3.6rem] justify-center"
        title="Reset zoom to 100%"
        onClick={resetTo100}
        data-testid="zoom-percent"
      >
        <span className="text-xs font-bold tabular-nums">{Math.round(viewport.zoom * 100)}%</span>
      </button>
      <button className="tool-btn" title="Zoom in (+)" onClick={() => step(1.2)}>
        <Plus size={14} />
      </button>
      <div className="w-0.5 h-6 bg-ink/15 mx-0.5 shrink-0" />
      <button className="tool-btn" title="Zoom to fit (Shift+1)" onClick={fit}>
        <Maximize2 size={14} />
      </button>
    </div>
  );
};

export default ZoomControls;
