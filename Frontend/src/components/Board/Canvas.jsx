import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useCanvas } from '../../hooks/useCanvas';
import { useSocket } from '../../hooks/useSocket';
import { redrawCanvas } from '../../utils/drawingTools';

const Canvas = () => {
  const { emitDraw, emitCursorMove } = useSocket();
  const canvasRef = useCanvas({ emitDraw, emitCursorMove });

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

  return (
    <div className="w-full h-full bg-white border-2 border-ink rounded-xl overflow-hidden shadow-[6px_6px_0_#101014]">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
};

export default Canvas;
