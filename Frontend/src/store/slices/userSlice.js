import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userId: null,
  username: `User_${Math.floor(Math.random() * 1000)}`,
  isConnected: false,
  cursorPosition: { x: 0, y: 0 },
  color: '#3b82f6',
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserId: (state, action) => {
      state.userId = action.payload;
    },
    setUsername: (state, action) => {
      state.username = action.payload;
    },
    setConnected: (state, action) => {
      state.isConnected = action.payload;
    },
    setCursorPosition: (state, action) => {
      state.cursorPosition = action.payload;
    },
    setUserColor: (state, action) => {
      state.color = action.payload;
    },
  },
});

export const {
  setUserId,
  setUsername,
  setConnected,
  setCursorPosition,
  setUserColor,
} = userSlice.actions;

export default userSlice.reducer;