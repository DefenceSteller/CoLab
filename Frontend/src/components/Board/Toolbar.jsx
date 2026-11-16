import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setTool, setColor, setBrushSize, setStrokeWidth,
} from '../../store/slices/toolSlice';
import {
  Pencil, Square, Circle, Type, Eraser, Minus,
  Palette, Undo2, Redo2, Trash2,
} from 'lucide-react';

// Excalidraw-parity tool ids (see utils/elementModel.js ELEMENT_TYPES)
const TOOLS = [
  { id: 'freedraw', label: 'Draw', icon: <Pencil size={16} /> },
  { id: 'line', label: 'Line', icon: <Minus size={16} /> },
  { id: 'rectangle', label: 'Rect', icon: <Square size={16} /> },
  { id: 'ellipse', label: 'Ellipse', icon: <Circle size={16} /> },
  { id: 'text', label: 'Text', icon: <Type size={16} /> },
  { id: 'eraser', label: 'Eraser', icon: <Eraser size={16} /> },
];

const COLORS = [
  '#101014', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6',
  '#7c3aed', '#ec4899', '#06b6d4', '#6b7280', '#ffffff',
];

const Divider = () => <div className="w-0.5 h-7 bg-ink/15 mx-1 shrink-0" />;

const Toolbar = ({ onUndo, onRedo, onClear }) => {
  const dispatch = useDispatch();
  const { activeTool, color, brushSize } = useSelector((state) => state.tool);

  return (
    <div className="shrink-0 bg-cream border-b-2 border-ink px-3 py-2.5 flex items-center gap-2 overflow-x-auto">
      {/* Tools */}
      <div className="flex items-center gap-1.5 shrink-0">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => dispatch(setTool(tool.id))}
            title={tool.label}
            aria-pressed={activeTool === tool.id}
          >
            {tool.icon}
            <span className="hidden lg:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      <Divider />

      {/* Colors */}
      <div className="flex items-center gap-1.5 shrink-0">
        {COLORS.map((hex) => (
          <button
            key={hex}
            className={`swatch ${color === hex ? 'selected' : ''}`}
            style={{ backgroundColor: hex }}
            onClick={() => dispatch(setColor(hex))}
            title={hex}
            aria-label={`Color ${hex}`}
          />
        ))}

        <label
          className="relative w-8 h-8 rounded-lg border-2 border-ink bg-white shadow-[3px_3px_0_#101014] cursor-pointer grid place-items-center hover:bg-sun transition-colors"
          title="Custom color"
        >
          <Palette size={15} />
          <input
            type="color"
            value={color}
            onChange={(e) => dispatch(setColor(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
      </div>

      <Divider />

      {/* Stroke size — drives freedraw width AND shape stroke width
          (replaced by Excalidraw's thin/medium/bold control in Phase 5) */}
      <div className="flex items-center gap-2.5 shrink-0 min-w-[10rem]">
        <input
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            dispatch(setBrushSize(v));
            dispatch(setStrokeWidth(v));
          }}
          className="size-slider w-24"
          aria-label="Stroke size"
        />
        <span className="text-xs font-bold w-9 tabular-nums">{brushSize}px</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <button className="tool-btn" onClick={onUndo} title="Undo">
          <Undo2 size={16} />
        </button>
        <button className="tool-btn" onClick={onRedo} title="Redo">
          <Redo2 size={16} />
        </button>
        <button className="tool-btn danger" onClick={onClear} title="Clear board">
          <Trash2 size={16} />
          <span className="hidden md:inline">Clear</span>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
