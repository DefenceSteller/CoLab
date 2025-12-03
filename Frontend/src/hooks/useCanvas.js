import { useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addElement, setDrawing } from '../store/slices/boardSlice';
import { drawElement, redrawCanvas } from '../utils/drawingTools';

export const useCanvas = (socket) => { 
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  
  const { activeTool, color, brushSize, fillColor } = useSelector((state) => state.tool);
  const elements = useSelector((state) => state.board.elements);
  const dispatch = useDispatch();

  // Draw existing elements
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    redrawCanvas(ctx, canvas.width, canvas.height, elements);
  }, [elements]);

  // Drawing handlers
  const startDrawing = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    lastPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    
    dispatch(setDrawing(true));
    
    // If tool is text, handle separately
    if (activeTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        const element = {
          type: 'text',
          x: lastPosRef.current.x,
          y: lastPosRef.current.y,
          text,
          color,
          fontSize: brushSize * 5,
          userId: 'local',
        };
        
        dispatch(addElement(element));
        socket.emitDraw(element);
      }
      isDrawingRef.current = false;
      dispatch(setDrawing(false));
    }
  }, [activeTool, color, brushSize, dispatch, socket]);

  const draw = useCallback((e) => {
    if (!isDrawingRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    
    const ctx = canvas.getContext('2d');
    
    // Draw locally
    drawElement(ctx, {
      type: activeTool,
      from: lastPosRef.current,
      to: currentPos,
      color,
      size: brushSize,
      fillColor,
    });
    
    // Send to server
    const element = {
      type: activeTool,
      from: lastPosRef.current,
      to: currentPos,
      color,
      size: brushSize,
      fillColor,
    };
    
    socket.emitDraw(element);
    
    // Update last position
    lastPosRef.current = currentPos;
  }, [activeTool, color, brushSize, fillColor, socket]);

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    dispatch(setDrawing(false));
    
    // Reset path
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
  }, [dispatch]);

  // Setup event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startDrawing(e.touches[0]);
    });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      draw(e.touches[0]);
    });
    
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      stopDrawing();
    });
    
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
      });
      canvas.removeEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e.touches[0]);
      });
      canvas.removeEventListener('touchend', (e) => {
        e.preventDefault();
        stopDrawing();
      });
    };
  }, [startDrawing, draw, stopDrawing]);

  return canvasRef;
};