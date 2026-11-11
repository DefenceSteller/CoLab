import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Canvas from '../components/Board/Canvas';
import Toolbar from '@/components/Board/Toolbar';
import { clearBoard, undo, redo } from '../store/slices/boardSlice';
import { useSocket } from '../hooks/useSocket';

const BoardPage = () => {
  const dispatch = useDispatch();
  const { emitClearBoard } = useSocket();
  const { username, isConnected, color } = useSelector((state) => state.user);
  const collaboratorCount = useSelector(
    (state) => Object.keys(state.board.collaborators).length
  );

  const handleClear = () => {
    dispatch(clearBoard());
    emitClearBoard();
  };

  const handleUndo = () => dispatch(undo());
  const handleRedo = () => dispatch(redo());

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="shrink-0 bg-white border-b-2 border-ink px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Logo block */}
          <div className="w-9 h-9 rounded-lg bg-grape border-2 border-ink shadow-[3px_3px_0_#101014] grid place-items-center -rotate-3">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <div className="leading-none">
            <h1 className="text-lg font-bold tracking-tight">
              CoLab
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-sun border-2 border-ink rounded-full px-2 py-0.5 align-middle -rotate-2 inline-block">
                beta
              </span>
            </h1>
          </div>

          {/* Status pill */}
          <span
            className={`inline-flex items-center gap-1.5 border-2 border-ink rounded-full px-2.5 py-1 text-[11px] font-bold shadow-[2px_2px_0_#101014] ${
              isConnected ? 'bg-lime' : 'bg-bubble'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full status-dot ${
                isConnected ? 'bg-green-600' : 'bg-red-600'
              }`}
            />
            {isConnected ? 'LIVE' : 'OFFLINE'}
            {collaboratorCount > 0 && (
              <span className="font-medium opacity-70">· {collaboratorCount + 1}</span>
            )}
          </span>
        </div>

        {/* User chip */}
        <div className="flex items-center gap-2 bg-white border-2 border-ink rounded-full pl-1 pr-3 py-1 shadow-[3px_3px_0_#101014]">
          <div
            className="w-7 h-7 rounded-full border-2 border-ink grid place-items-center text-xs font-bold"
            style={{ backgroundColor: color, color: '#fff' }}
          >
            {username?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm font-semibold">{username}</span>
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar onUndo={handleUndo} onRedo={handleRedo} onClear={handleClear} />

      {/* Canvas — full width */}
      <main className="flex-1 p-4 min-h-0">
        <Canvas />
      </main>
    </div>
  );
};

export default BoardPage;
