import React from 'react';
import { useSelector } from 'react-redux';
import { useCanvas } from '../../hooks/useCanvas';
import { useSocket } from '../../hooks/useSocket';
import { screenFromWorld } from '../../utils/viewport';

const CURSOR = {
  text: 'text',
  hand: 'grab',
  selection: 'default',
  eraser: 'cell',
  laser: 'crosshair',
};

const Canvas = () => {
  const { emitDraw, emitCursorMove, emitDeleteElements } = useSocket();
  const {
    containerRef,
    baseRef,
    overlayRef,
    textInput,
    onTextChange,
    commitText,
    cancelText,
    handleTextBlur,
  } = useCanvas({ emitDraw, emitCursorMove, emitDelete: emitDeleteElements });

  const activeTool = useSelector((state) => state.tool.activeTool);
  const color = useSelector((state) => state.tool.color);
  const fontSize = useSelector((state) => state.tool.fontSize);
  const viewport = useSelector((state) => state.viewport);

  // Text editor lives at a WORLD position — project it to screen on
  // every render so pans/zooms keep it glued to its anchor.
  const anchor = textInput ? screenFromWorld(textInput.x, textInput.y, viewport) : null;
  const editorFontSize = Math.max(10, fontSize * viewport.zoom);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-white border-2 border-ink rounded-xl overflow-hidden shadow-[6px_6px_0_#101014]"
      style={{ cursor: CURSOR[activeTool] || 'crosshair' }}
    >
      {/* base layer: committed elements */}
      <canvas ref={baseRef} className="absolute inset-0 w-full h-full block" />
      {/* overlay layer: in-progress preview / interaction */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />

      {/* Inline text editor — sits on the canvas, no prompt() dialog */}
      {textInput && anchor && (
        <input
          key={textInput.id}
          autoFocus
          value={textInput.value}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={() => handleTextBlur(textInput.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitText();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelText();
            }
          }}
          placeholder="Type…  Enter to place"
          className="absolute z-10 px-1.5 py-0.5 bg-white/90 outline-none border-2 border-ink rounded-md shadow-[3px_3px_0_#101014] font-semibold placeholder:text-gray-400 placeholder:font-normal"
          style={{
            left: anchor.x,
            top: Math.max(0, anchor.y - 4),
            color,
            fontSize: `${editorFontSize}px`,
            minWidth: '10rem',
            width: `${Math.max(12, textInput.value.length + 4)}ch`,
          }}
        />
      )}
    </div>
  );
};

export default Canvas;
