import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { setUserId, setConnected } from '../store/slices/userSlice';
import { addElement, updateCollaborator, removeCollaborator, addChatMessage } from '../store/slices/boardSlice';

const SOCKET_URL = 'http://localhost:5000';

export const useSocket = () => {
  const socketRef = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      dispatch(setUserId(socket.id));
      dispatch(setConnected(true));
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      dispatch(setConnected(false));
    });

    // Drawing events
    socket.on('draw', (data) => {
      if (data.userId !== socket.id) {
        dispatch(addElement(data));
      }
    });

    // Cursor events
    socket.on('cursor-move', (data) => {
      dispatch(updateCollaborator({
        id: data.id,
        cursor: data,
        lastSeen: new Date().toISOString(),
      }));
    });

    // User events
    socket.on('user-joined', (data) => {
      console.log('User joined:', data);
    });

    socket.on('user-left', (data) => {
      dispatch(removeCollaborator(data.id));
    });

    // Chat events
    socket.on('chat-message', (data) => {
      dispatch(addChatMessage(data));
    });

    // Board events
    socket.on('clear-board', () => {
      // Handle board clear from other users
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [dispatch]);

  // Emit functions
  const emitDraw = (data) => {
    if (socketRef.current) {
      socketRef.current.emit('draw', data);
    }
  };

  const emitCursorMove = (position) => {
    if (socketRef.current) {
      socketRef.current.emit('cursor-move', position);
    }
  };

  const emitChatMessage = (message) => {
    if (socketRef.current) {
      socketRef.current.emit('chat-message', message);
    }
  };

  const emitClearBoard = () => {
    if (socketRef.current) {
      socketRef.current.emit('clear-board');
    }
  };

  return {
    socket: socketRef.current,
    emitDraw,
    emitCursorMove,
    emitChatMessage,
    emitClearBoard,
  };
};