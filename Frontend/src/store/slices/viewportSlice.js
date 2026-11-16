import { createSlice } from '@reduxjs/toolkit';

// Camera state: screen = world * zoom + offset (see utils/viewport.js).
// zoom is 1 at 100%; offset is in screen (CSS px) units.
const initialState = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

const viewportSlice = createSlice({
  name: 'viewport',
  initialState,
  reducers: {
    // Full replace — compute new values with utils/viewport.js helpers
    // (zoomAtScreenPoint, viewportForBounds) before dispatching.
    setViewport: (state, action) => {
      const { zoom, offsetX, offsetY } = action.payload;
      if (typeof zoom === 'number') state.zoom = zoom;
      if (typeof offsetX === 'number') state.offsetX = offsetX;
      if (typeof offsetY === 'number') state.offsetY = offsetY;
    },
    panBy: (state, action) => {
      state.offsetX += action.payload.dx || 0;
      state.offsetY += action.payload.dy || 0;
    },
    resetViewport: () => initialState,
  },
});

export const { setViewport, panBy, resetViewport } = viewportSlice.actions;
export default viewportSlice.reducer;
