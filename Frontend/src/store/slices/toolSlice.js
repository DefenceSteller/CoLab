import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeTool: 'pencil',
  color: '#3b82f6',
  brushSize: 3,
  opacity: 1,
  fillColor: '#ffffff',
  strokeWidth: 2,
  fontSize: 16,
  fontFamily: 'Arial',
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
    setBrushSize: (state, action) => {
      state.brushSize = action.payload;
    },
    setOpacity: (state, action) => {
      state.opacity = action.payload;
    },
    setFillColor: (state, action) => {
      state.fillColor = action.payload;
    },
    resetTool: () => initialState,
  },
});

export const { 
  setTool, 
  setColor, 
  setBrushSize, 
  setOpacity, 
  setFillColor, 
  resetTool 
} = toolSlice.actions;

export default toolSlice.reducer;