import { createSlice } from '@reduxjs/toolkit';

// Excalidraw-parity tool ids:
// selection | hand | rectangle | diamond | ellipse | arrow | line |
// freedraw | text | image | eraser | frame | laser
const initialState = {
  // 'freedraw' until the selection engine lands (Phase 3), which
  // flips the default to 'selection' like Excalidraw.
  activeTool: 'freedraw',
  // stroke / fill (Excalidraw's two color rows)
  color: '#101014',            // strokeColor
  backgroundColor: 'transparent', // fill
  fillStyle: 'solid',          // solid | hachure | cross-hatch | zigzag
  strokeStyle: 'solid',        // solid | dashed | dotted
  strokeWidth: 2,              // thin(1) | medium(2) | bold(4)
  roughness: 1,                // 0 architect | 1 artist | 2 cartoonist
  opacity: 100,                // 0–100 (Excalidraw scale)
  brushSize: 3,                // freedraw width (legacy slider)
  fontSize: 16,
  fontFamily: 'sans',          // sans | hand | mono (see elementModel FONT_STACKS)
  textAlign: 'left',
};

const toolSlice = createSlice({
  name: 'tool',
  initialState,
  reducers: {
    setTool: (state, action) => {
      state.activeTool = action.payload;
    },
    setColor: (state, action) => {
      state.color = action.payload;
    },
    setBackgroundColor: (state, action) => {
      state.backgroundColor = action.payload;
    },
    setFillStyle: (state, action) => {
      state.fillStyle = action.payload;
    },
    setStrokeStyle: (state, action) => {
      state.strokeStyle = action.payload;
    },
    setStrokeWidth: (state, action) => {
      state.strokeWidth = action.payload;
    },
    setRoughness: (state, action) => {
      state.roughness = action.payload;
    },
    setOpacity: (state, action) => {
      state.opacity = action.payload;
    },
    setBrushSize: (state, action) => {
      state.brushSize = action.payload;
    },
    setFontSize: (state, action) => {
      state.fontSize = action.payload;
    },
    setFontFamily: (state, action) => {
      state.fontFamily = action.payload;
    },
    setTextAlign: (state, action) => {
      state.textAlign = action.payload;
    },
    // Bulk apply (property panel applying to a selection)
    setStyles: (state, action) => {
      Object.assign(state, action.payload);
    },
    resetTool: () => initialState,
  },
});

export const {
  setTool,
  setColor,
  setBackgroundColor,
  setFillStyle,
  setStrokeStyle,
  setStrokeWidth,
  setRoughness,
  setOpacity,
  setBrushSize,
  setFontSize,
  setFontFamily,
  setTextAlign,
  setStyles,
  resetTool,
} = toolSlice.actions;

export default toolSlice.reducer;
