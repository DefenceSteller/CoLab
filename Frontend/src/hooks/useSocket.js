import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { setUserId, setConnected } from '../store/slices/userSlice';
import {
  addElement,
  updateCollaborator,
  removeCollaborator,
  addChatMessage,
  clearBoard,
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
 * Call this from a top-level component (BoardPage).
 */
export const useSocketListeners = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      console.log('Connected to server:', socket.id);
      dispatch(setUserId(socket.id));
      dispatch(setConnected(true));
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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('draw', onDraw);
    socket.on('cursor-move', onCursorMove);
    socket.on('user-left', onUserLeft);
    socket.on('chat-message', onChatMessage);
    socket.on('clear-board', onClearBoard);

    // The singleton may already be connected before this mounts
    // (e.g. StrictMode remount) — sync state right away.
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('draw', onDraw);
      socket.off('cursor-move', onCursorMove);
      socket.off('user-left', onUserLeft);
      socket.off('chat-message', onChatMessage);
      socket.off('clear-board', onClearBoard);
    };
  }, [dispatch]);
};

/** Emit helpers — safe to call from any component. */
export const useSocket = () => {
  const socket = getSocket();

  const emitDraw = (data) => socket.emit('draw', data);
  const emitCursorMove = (position) => socket.emit('cursor-move', position);
  const emitChatMessage = (message) => socket.emit('chat-message', message);
  const emitClearBoard = () => socket.emit('clear-board');

  return {
    socket,
    emitDraw,
    emitCursorMove,
    emitChatMessage,
    emitClearBoard,
  };
};
