import { createSlice } from '@reduxjs/toolkit';
import { normalizeElement, normalizeScene } from '../../utils/elementModel';

const initialState = {
  elements: [],
  history: [],   // snapshots of `elements` (arrays) for undo
  future: [],
  selectedIds: [], // Excalidraw-style multi-selection
  isDrawing: false,
  collaborators: {},
  chatMessages: [],
  roomId: null,
  roomUsers: [],
};

// Snapshot BEFORE a mutation so undo restores the pre-mutation state.
// Capped so a long session can't grow memory forever.
const MAX_HISTORY = 100;
const snapshot = (state) => {
  state.history.push(state.elements.map((el) => ({ ...el })));
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.future = [];
};

const byId = (state, id) => state.elements.find((el) => el.id === id);

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    // Add a NEW element (local draw or remote stroke).
    addElement: (state, action) => {
      const el = normalizeElement(action.payload);
      if (!el) return;
      // Same id already present → treat as an update (live stroke chunks)
      const existing = byId(state, el.id);
      if (existing) {
        Object.assign(existing, el);
        return;
      }
      snapshot(state);
      state.elements.push(el);
    },

    // Batch-update existing elements by id. `changes` is a plain object
    // or a function(draftEl) for computed updates (move/resize).
    // Does NOT snapshot — callers dispatch beginHistory() once per gesture.
    updateElements: (state, action) => {
      const { ids, changes } = action.payload;
      const idSet = new Set(ids);
      for (const el of state.elements) {
        if (!idSet.has(el.id)) continue;
        if (typeof changes === 'function') changes(el);
        else Object.assign(el, changes);
        el.version = (el.version || 1) + 1;
      }
    },

    // Remove elements by id (local delete/eraser or remote delete).
    // Does NOT snapshot — callers dispatch beginHistory() first.
    removeElements: (state, action) => {
      const idSet = new Set(action.payload);
      state.elements = state.elements.filter((el) => !idSet.has(el.id));
      state.selectedIds = state.selectedIds.filter((id) => !idSet.has(id));
    },

    // Explicit history checkpoint (start of a move/resize/style gesture).
    beginHistory: (state) => {
      snapshot(state);
    },

    // Replace the whole scene (used when joining a room that already has content)
    loadBoard: (state, action) => {
      state.elements = normalizeScene(action.payload);
      state.history = [];
      state.future = [];
      state.selectedIds = [];
    },

    // Replace all elements (layer reordering: bring-to-front / send-to-back).
    // Does NOT snapshot — callers should wrap in beginHistory() themselves.
    setElements: (state, action) => {
      state.elements = action.payload;
    },

    clearBoard: (state) => {
      state.elements = [];
      state.history = [];
      state.future = [];
      state.selectedIds = [];
    },

    undo: (state) => {
      if (state.history.length > 0) {
        state.future.push(state.elements.map((el) => ({ ...el })));
        state.elements = state.history.pop();
        // Keep selection on whatever survived the undo (Excalidraw
        // preserves selection across undo — elements that still exist
        // stay selected, removed ones drop out).
        const alive = new Set(state.elements.map((el) => el.id));
        state.selectedIds = state.selectedIds.filter((id) => alive.has(id));
      }
    },
    redo: (state) => {
      if (state.future.length > 0) {
        state.history.push(state.elements.map((el) => ({ ...el })));
        state.elements = state.future.pop();
        const alive = new Set(state.elements.map((el) => el.id));
        state.selectedIds = state.selectedIds.filter((id) => alive.has(id));
      }
    },

    // ---------- selection ----------
    setSelection: (state, action) => {
      state.selectedIds = action.payload || [];
    },
    toggleSelected: (state, action) => {
      const id = action.payload;
      const i = state.selectedIds.indexOf(id);
      if (i >= 0) state.selectedIds.splice(i, 1);
      else state.selectedIds.push(id);
    },
    clearSelection: (state) => {
      state.selectedIds = [];
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
    setRoomId: (state, action) => {
      state.roomId = action.payload;
    },
    setRoomUsers: (state, action) => {
      state.roomUsers = action.payload;
    },

    // ---------- property panel: push style changes onto selected elements ----------
    setElementStyle: (state, action) => {
      const { ids, changes } = action.payload;
      const idSet = new Set(ids);
      for (const el of state.elements) {
        if (!idSet.has(el.id)) continue;
        Object.assign(el, changes);
        el.version = (el.version || 1) + 1;
      }
    },
  },
});

export const {
  addElement,
  updateElements,
  removeElements,
  beginHistory,
  loadBoard,
  clearBoard,
  setElements,
  undo,
  redo,
  setSelection,
  toggleSelected,
  clearSelection,
  updateCollaborator,
  removeCollaborator,
  addChatMessage,
  setDrawing,
  setRoomId,
  setRoomUsers,
  setElementStyle,
} = boardSlice.actions;

export default boardSlice.reducer;
