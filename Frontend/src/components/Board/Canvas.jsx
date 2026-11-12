import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useCanvas } from '../../hooks/useCanvas';
import { useSocket } from '../../hooks/useSocket';
import { redrawCanvas } from '../../utils/drawingTools';

const Canvas = () => {
  const { emitDraw, emitCursorMove } = useSocket();
  const {
    canvasRef,
    textInput,
    onTextChange,
    commitText,
    cancelText,
    handleTextBlur,
  } = useCanvas({ emitDraw, emitCursorMove });

  const activeTool = useSelector((state) => state.tool.activeTool);
  const brushSize = useSelector((state) => state.tool.brushSize);
  const color = useSelector((state) => state.tool.color);

  // Latest elements for redraw-on-resize without re-registering the listener
  const elements = useSelector((state) => state.board.elements);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;

      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      // Re-render strokes so a window resize doesn't wipe the board
      const ctx = canvas.getContext('2d');
      redrawCanvas(ctx, canvas.width, canvas.height, elementsRef.current);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef]);

  const textFontSize = Math.max(14, brushSize * 5);

  return (
    <div className="relative w-full h-full bg-white border-2 border-ink rounded-xl overflow-hidden shadow-[6px_6px_0_#101014]">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
      />

      {/* Inline text editor — sits directly on the canvas, no prompt() dialog */}
      {textInput && (
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
            left: textInput.x,
            top: Math.max(0, textInput.y - 4),
            color,
            fontSize: `${textFontSize}px`,
            minWidth: '10rem',
            width: `${Math.max(12, textInput.value.length + 4)}ch`,
          }}
        />
      )}
    </div>
  );
};

export default Canvas;
