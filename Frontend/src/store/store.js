import { configureStore } from '@reduxjs/toolkit';
import boardReducer from './slices/boardSlice';
import toolReducer from './slices/toolSlice';
import userReducer from './slices/userSlice';

export const store = configureStore({
  reducer: {
    board: boardReducer,
    tool: toolReducer,
    user: userReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});