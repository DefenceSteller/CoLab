import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { store } from '../store/store';
import { setUserId, setConnected } from '../store/slices/userSlice';
import {
  addElement,
  removeElements,
  updateCollaborator,
  removeCollaborator,
  addChatMessage,
  clearBoard,
  setRoomUsers,
  loadBoard,
} from '../store/slices/boardSlice';

// Socket server URL — set VITE_SOCKET_URL in production (.env),
// falls back to the local dev server.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Singleton: ONE socket per page, shared by every hook consumer.
// (Previously each useSocket() call created a new socket, so BoardPage +
// Canvas opened 2 connections per client → duplicate remote strokes.)
let sharedSocket = null;

const getSocket = () => {
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return sharedSocket;
};

/**
 * Attach the global socket listeners exactly once.
 * Call this from the session gate (App.jsx → <Session />).
 */
export const useSocketListeners = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      console.log('Connected to server:', socket.id);
      dispatch(setUserId(socket.id));
      dispatch(setConnected(true));

      // Reconnect = new socket id → the server forgot our room membership.
      // Rejoin it (and re-sync the board) so drawing keeps working.
      const { roomId } = store.getState().board;
      if (roomId) {
        const { username } = store.getState().user;
        joinRoom(roomId, username).then((res) => {
          if (res && res.ok) dispatch(loadBoard(res.elements));
        });
      }
    };
    const onDisconnect = () => {
      console.log('Disconnected from server');
      dispatch(setConnected(false));
    };
    const onDraw = (data) => {
      // Server broadcasts to everyone except the sender, so this only
      // ever carries remote strokes.
      dispatch(addElement(data));
    };
    const onDeleteElements = (ids) => {
      // Remote eraser pass — ids only, removal is local + idempotent.
      if (Array.isArray(ids) && ids.length) dispatch(removeElements(ids));
    };
    const onCursorMove = (data) =>
      dispatch(
        updateCollaborator({
          id: data.id,
          cursor: data,
          lastSeen: new Date().toISOString(),
        })
      );
    const onUserLeft = (data) => dispatch(removeCollaborator(data.id));
    const onChatMessage = (data) => dispatch(addChatMessage(data));
    const onClearBoard = () => dispatch(clearBoard());
    const onRoomUsers = (members) => dispatch(setRoomUsers(members));
    // Phase 9: explicit element updates (move/resize/rotate final state).
    // The server upserts by id before broadcasting, so remote clients
    // receive clean single-entry elements — no duplicates after replays.
    const onUpdateElements = (updates) => {
      if (!Array.isArray(updates)) updates = [updates];
      for (const el of updates) dispatch(addElement(el));
    };
    // Laser trail points streamed live from other users.
    // Stored in a module-level array so renderer can draw them during overlay repaints.
    const onLaserPoint = (pt) => {
      if (!window.__COLAB_REMOTE_LASERS) window.__COLAB_REMOTE_LASERS = [];
      window.__COLAB_REMOTE_LASERS.push({ ...pt, userId: pt.userId ?? 'remote' });
      if (window.__COLAB_REMOTE_LASERS.length > 400)
        window.__COLAB_REMOTE_LASERS.splice(0, window.__COLAB_REMOTE_LASERS.length - 400);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('draw', onDraw);
    socket.on('delete-elements', onDeleteElements);
    socket.on('cursor-move', onCursorMove);
    socket.on('user-left', onUserLeft);
    socket.on('chat-message', onChatMessage);
    socket.on('clear-board', onClearBoard);
    socket.on('room-users', onRoomUsers);
    socket.on('update-elements', onUpdateElements);
    socket.on('laser-point', onLaserPoint);

    // The singleton may already be connected before this mounts
    // (e.g. StrictMode remount) — sync state right away.
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('draw', onDraw);
      socket.off('delete-elements', onDeleteElements);
      socket.off('cursor-move', onCursorMove);
      socket.off('user-left', onUserLeft);
      socket.off('chat-message', onChatMessage);
      socket.off('clear-board', onClearBoard);
      socket.off('room-users', onRoomUsers);
      socket.off('update-elements', onUpdateElements);
      socket.off('laser-point', onLaserPoint);
    };
  }, [dispatch]);
};

/**
 * Parse an ack callback from the server.
 *
 * The server acks Node-style: `cb(null, payload)`. But when we emit WITH
 * `.timeout()`, socket.io-client flags the callback `withError` and PREPENDS
 * its own error slot when the ack arrives (`packet.data.unshift(null)`), so
 * the client callback actually receives `(null, null, payload)`.
 *
 * The old code read position 1 → got the SERVER's `null` → `res.ok` threw →
 * "Start a session" froze on "starting…" with no error banner (2026-11-16).
 *
 * Fix: take the first OBJECT argument. Correct with or without `.timeout()`,
 * and for both `cb(payload)` and `cb(null, payload)` server styles.
 */
const parseAck = (err, ...args) => {
  if (err) return { ok: false, error: 'timeout' };
  return (
    args.find((a) => a && typeof a === 'object') || {
      ok: false,
      error: 'bad-response',
    }
  );
};

/** Create a new session (room) → resolves { ok, roomId, elements, maxUsers }. */
const createRoom = (username) =>
  new Promise((resolve) => {
    getSocket()
      .timeout(8000)
      .emit('create-room', { username }, (err, ...args) =>
        resolve(parseAck(err, ...args))
      );
  });

/** Join a session by room id → resolves { ok, roomId, elements } or { ok:false, error }. */
const joinRoom = (roomId, username) =>
  new Promise((resolve) => {
    getSocket()
      .timeout(8000)
      .emit('join-room', { roomId, username }, (err, ...args) =>
        resolve(parseAck(err, ...args))
      );
  });

/** Emit helpers — safe to call from any component. */
export const useSocket = () => {
  const socket = getSocket();

  const emitDraw = (data) => socket.emit('draw', data);
  const emitDeleteElements = (ids) => socket.emit('delete-elements', ids);
  const emitCursorMove = (position) => socket.emit('cursor-move', position);
  const emitChatMessage = (message) => socket.emit('chat-message', message);
  const emitClearBoard = () => socket.emit('clear-board');
  const emitUpdateElements = (updates) => socket.emit('update-elements', updates);
  const emitLaserPoint = (point) => socket.emit('laser-point', point);

  return {
    socket,
    emitDraw,
    emitDeleteElements,
    emitCursorMove,
    emitChatMessage,
    emitClearBoard,
    emitUpdateElements,
    emitLaserPoint,
    createRoom,
    joinRoom,
  };
};
