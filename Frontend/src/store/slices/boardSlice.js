import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  elements: [],
  history: [],
  future: [],
  isDrawing: false,
  collaborators: {},
  chatMessages: [],
};

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    addElement: (state, action) => {
      state.elements.push(action.payload);
      state.history.push([...state.elements]);
      state.future = [];
    },
    clearBoard: (state) => {
      state.elements = [];
      state.history = [];
      state.future = [];
    },
    undo: (state) => {
      if (state.history.length > 0) {
        state.future.push([...state.elements]);
        state.elements = state.history.pop();
      }
    },
    redo: (state) => {
      if (state.future.length > 0) {
        state.history.push([...state.elements]);
        state.elements = state.future.pop();
      }
    },
    updateCollaborator: (state, action) => {
      state.collaborators[action.payload.id] = {
        ...state.collaborators[action.payload.id],
        ...action.payload,
      };
    },
    removeCollaborator: (state, action) => {
      delete state.collaborators[action.payload];
    },
    addChatMessage: (state, action) => {
      state.chatMessages.push(action.payload);
    },
    setDrawing: (state, action) => {
      state.isDrawing = action.payload;
    },
  },
});

export const {
  addElement,
  clearBoard,
  undo,
  redo,
  updateCollaborator,
  removeCollaborator,
  addChatMessage,
  setDrawing,
} = boardSlice.actions;

export default boardSlice.reducer;