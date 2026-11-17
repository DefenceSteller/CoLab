import React, { useEffect, useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from './store/store';
import { loadBoard, setRoomId } from './store/slices/boardSlice';
import BoardPage from './pages/BoardPage';
import Landing from './pages/Landing';
import ShareModal from './components/Session/ShareModal';
import { useSocket, useSocketListeners } from './hooks/useSocket';

// Room ids are 6 chars from the server's unambiguous alphabet
const ROOM_PATTERN = /^[A-Z0-9]{6}$/;

const getRoomFromUrl = () => {
  const room = new URLSearchParams(window.location.search)
    .get('room')
    ?.trim()
    .toUpperCase();
  return room && ROOM_PATTERN.test(room) ? room : null;
};

const setUrlRoom = (roomId) => {
  const url = roomId
    ? `${window.location.pathname}?room=${roomId}`
    : window.location.pathname;
  window.history.replaceState({}, '', url);
};

/**
 * Session gate — decides what the user sees:
 *  - no link            → Landing ("Start a session")
 *  - ?room=ABC123       → auto-join that board (error banner if full/gone)
 *  - after Start/Join   → BoardPage + ShareModal (link popup)
 */
function Session() {
  const dispatch = useDispatch();
  const { createRoom, joinRoom, emitLeaveRoom } = useSocket();
  const { username } = useSelector((state) => state.user);
  useSocketListeners(); // global socket listeners, attached exactly once

  const [view, setView] = useState('landing'); // 'landing' | 'board'
  const [status, setStatus] = useState('idle'); // 'idle' | 'joining' | 'creating'
  const [error, setError] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [isSolo, setIsSolo] = useState(false); // no shareable URL param

  /** Leave current session → back to landing */
  const handleLeave = () => {
    emitLeaveRoom();
    setUrlRoom(null);
    setView('landing');
    setShowShare(false);
  };

  // Arrived via a shared link (?room=...) → auto-join that session.
  useEffect(() => {
    const roomId = getRoomFromUrl();
    if (!roomId) return;

    let cancelled = false;
    setStatus('joining');
    joinRoom(roomId, username)
      .then((res) => {
        if (cancelled) return; // StrictMode double-mount: let the 2nd run win
        if (res && res.ok) {
          dispatch(setRoomId(res.roomId));
          dispatch(loadBoard(res.elements)); // replay strokes already on the board
          setIsSolo(false);
          setView('board');
          setError(null);
        } else {
          setUrlRoom(null); // drop the dead link from the address bar
          setError(
            res && res.error === 'full'
              ? 'That session is full — 5/5 people are already drawing.'
              : "That session link isn't active anymore — ask for a fresh one."
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrlRoom(null);
          setError("That session link isn't active anymore — ask for a fresh one.");
        }
      })
      .finally(() => {
        if (!cancelled) setStatus('idle');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Start a session" → create room → show board + share-link popup
  // finally{} guarantees the button always leaves "starting…", even if the
  // ack payload is malformed or dispatch throws (never freeze the button).
  const handleStart = async () => {
    setStatus('creating');
    setError(null);
    try {
      const res = await createRoom(username);
      if (res && res.ok) {
        dispatch(setRoomId(res.roomId));
        dispatch(loadBoard(res.elements));
        setUrlRoom(res.roomId); // URL becomes shareable: /?room=ABC123
        setIsSolo(false);
        setView('board');
        setShowShare(true); // ← the link popup the user asked for
      } else {
        setError("Couldn't start a session — check your connection and try again.");
      }
    } catch {
      setError("Couldn't start a session — check your connection and try again.");
    } finally {
      setStatus('idle');
    }
  };

  // "Draw solo" → create room silently, no share modal, no URL param
  const handleSolo = () => {
    setStatus('creating');
    setError(null);
    createRoom(username).then((res) => {
      setStatus('idle');
      if (!res?.ok) {
        setError("Couldn't connect — check your network and try again.");
        return;
      }
      dispatch(setRoomId(res.roomId));
      dispatch(loadBoard(res.elements));
      // No setUrlRoom call — URL stays clean (/) so there's no persistent link
      setIsSolo(true);
      setView('board');
    });
  };

  if (view === 'board') {
    return (
      <>
        <BoardPage onShare={() => setShowShare(true)} onLeave={handleLeave} isSolo={isSolo} />
        {showShare && <ShareModal onClose={() => setShowShare(false)} />}
      </>
    );
  }

  return (
    <Landing onStart={handleStart} onSolo={handleSolo} status={status} error={error} />
  );
}

function App() {
  return (
    <Provider store={store}>
      <Session />
    </Provider>
  );
}

export default App;
