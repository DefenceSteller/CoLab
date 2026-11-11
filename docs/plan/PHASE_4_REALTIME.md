# Phase 4: Real-time Collaboration

**Status:** 🟡 Partial (~50%)
**Started:** 2026-11-11

> Wire the socket layer so drawing, cursors, and presence sync across clients —
> and fix the connection bugs that block scaling this up.

## 4.1 What works

- **Connection:** frontend connects to `http://localhost:5000`, tracks
  `userId` + `isConnected` in `userSlice`.
- **Stroke sync:** `draw` broadcast to other clients; they `addElement` → re-render.
- **Board replay:** server keeps `boardHistory` (last 100) and sends it to new
  joiners via `board-state`.
- **Presence:** `user-joined` / `user-left` with total user count.
- **Cursor relay:** `cursor-move` broadcast with sender id.

## 4.2 What's broken / missing

1. **Duplicate sockets (landmine #4).** `useSocket()` creates a new socket each
   call. `BoardPage.jsx` and `Canvas.jsx` both call it → **2 connections per
   client**. Fix: module-level singleton or React context so all callers share
   one socket.

2. **`clear-board` not handled (landmine #6).** Frontend listener callback is
   empty — clearing on one client doesn't clear others. Needs
   `dispatch(clearBoard())` on receipt.

3. **Dead `handler.js` (landmine #1).** Two competing socket implementations.
   `server.js` has inline logic; `handler.js` (richer: cursor tracking, history,
   clear) is unused and ESM-in-CJS. Consolidate into one.

4. **Cursor rendering.** `cursor-move` updates `collaborators` in Redux, but
   there's no UI drawing other users' cursors yet.

5. **No rooms.** One global board for everyone.

## 4.3 Real-time tasks

- [x] Socket connection + reconnect config
- [x] Draw broadcast + board replay
- [x] Presence (join/leave) + cursor relay events
- [ ] **Fix duplicate socket** → singleton/context (highest priority)
- [ ] **Handle `clear-board`** on frontend
- [ ] **Consolidate** `server.js` inline ↔ `socket/handler.js`
- [ ] **Render collaborator cursors** on the canvas (colors + names)
- [ ] **Rooms** — create/join board by code (scope sockets to a room)
- [ ] Move event constants to a single shared source of truth

**Ready to proceed to Phase 5: Features.**
