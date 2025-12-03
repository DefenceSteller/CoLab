import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setTool, setColor, setBrushSize } from '../../store/slices/toolSlice';
import { 
  Pencil, 
  Square, 
  Circle, 
  Type, 
  Eraser, 
  Minus,
  Palette,
  Undo2,
  Redo2,
  Trash2
} from 'lucide-react';

const TOOLS = [
  { id: 'pencil', label: 'Pencil', icon: <Pencil size={20} /> },
  { id: 'line', label: 'Line', icon: <Minus size={20} /> },
  { id: 'rectangle', label: 'Rectangle', icon: <Square size={20} /> },
  { id: 'circle', label: 'Circle', icon: <Circle size={20} /> },
  { id: 'text', label: 'Text', icon: <Type size={20} /> },
  { id: 'eraser', label: 'Eraser', icon: <Eraser size={20} /> },
];

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#000000', '#64748b', '#ffffff'
];

const Toolbar = ({ onUndo, onRedo, onClear }) => {
  const dispatch = useDispatch();
  const { activeTool, color, brushSize } = useSelector((state) => state.tool);

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Tools */}
        <div className="flex flex-wrap gap-2">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => dispatch(setTool(tool.id))}
              title={tool.label}
            >
              {tool.icon}
              <span className="hidden md:inline">{tool.label}</span>
            </button>
          ))}
        </div>

        {/* Color Picker */}
        <div className="flex items-center gap-2">
          <Palette size={20} className="text-gray-500" />
          <div className="flex gap-1">
            {COLORS.map((colorHex) => (
              <button
                key={colorHex}
                className={`w-8 h-8 rounded-full border-2 ${color === colorHex ? 'border-gray-800' : 'border-gray-300'}`}
                style={{ backgroundColor: colorHex }}
                onClick={() => dispatch(setColor(colorHex))}
                title={colorHex}
              />
            ))}
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => dispatch(setColor(e.target.value))}
            className="w-10 h-10 cursor-pointer rounded-lg border border-gray-300"
          />
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Size:</span>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => dispatch(setBrushSize(parseInt(e.target.value)))}
            className="w-32"
          />
          <span className="w-10 text-center font-medium">{brushSize}px</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={onUndo}
            className="tool-btn"
            title="Undo"
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={onRedo}
            className="tool-btn"
            title="Redo"
          >
            <Redo2 size={20} />
          </button>
          <button
            onClick={onClear}
            className="tool-btn bg-red-50 text-red-600 hover:bg-red-100"
            title="Clear Board"
          >
            <Trash2 size={20} />
            <span className="hidden md:inline">Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;