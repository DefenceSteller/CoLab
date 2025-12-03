import React, { useEffect } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useSocket } from '../../hooks/useSocket';

const Canvas = () => {
  const { emitDraw, emitCursorMove } = useSocket();
  const canvasRef = useCanvas({ emitDraw, emitCursorMove });

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef]);

  return (
    <div className="canvas-container h-[600px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
      />
    </div>
  );
};

export default Canvas;