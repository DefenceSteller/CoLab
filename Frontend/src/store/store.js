import { configureStore } from '@reduxjs/toolkit';
import boardReducer from './slices/boardSlice';
import toolReducer from './slices/toolSlice';
import userReducer from './slices/userSlice';
import viewportReducer from './slices/viewportSlice';

export const store = configureStore({
  reducer: {
    board: boardReducer,
    tool: toolReducer,
    user: userReducer,
    viewport: viewportReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});