import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Canvas from '../components/Board/Canvas';
import Toolbar from '@/components/Board/Toolbar';
//import ChatPanel from '@/components/Chat/ChatPanel';
// import UsersPanel from '../components/Chat/UsersPanel';
import { clearBoard, undo, redo } from '../store/slices/boardSlice';
import { useSocket } from '../hooks/useSocket';

const BoardPage = () => {
  const dispatch = useDispatch();
  const { emitClearBoard } = useSocket();
  const { username, isConnected } = useSelector((state) => state.user);
  
  const handleClear = () => {
    dispatch(clearBoard());
    emitClearBoard();
  };
  
  const handleUndo = () => {
    dispatch(undo());
  };
  
  const handleRedo = () => {
    dispatch(redo());
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Collab Board</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-600">
                {username} • {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg px-4 py-2 shadow">
              <span className="text-gray-600">Real-time collaboration enabled</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas Area - 3/4 width */}
        <div className="lg:col-span-3">
          <Toolbar 
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
          />
          <Canvas />
        </div>

        {/* Sidebar - 1/4 width */}
        <div className="space-y-6">
          {/* <UsersPanel /> */}
        </div>
      </div>
    </div>
  );
};

export default BoardPage;