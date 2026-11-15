# Phase 5: Features

**Status:** 🟡 In progress (~60%) — rooms done, chat/persistence/auth remaining
**Started:** 2026-11-11
**Updated:** 2026-11-16

> The product features beyond raw drawing: chat, users panel, rooms,
> persistence, and auth.

## 5.1 Chat

- **Backend:** `chat-message` event already emits `{ userId, message, timestamp }` to all.
- **Frontend:** `useSocket` listens and `dispatch(addChatMessage)`;
  `boardSlice.chatMessages` holds them. `emitChatMessage` exists.
- **Missing:** the actual UI. `ChatPanel` / `UsersPanel` imports are
  **commented out** in `BoardPage.jsx`, and the files don't exist yet.

**Tasks:**
- [ ] Create `components/Chat/ChatPanel.jsx` (message list + input)
- [ ] Create `components/Chat/UsersPanel.jsx` (live users)
- [ ] Uncomment + wire into `BoardPage` sidebar
- [ ] Auto-scroll, timestamp formatting, your-message styling

## 5.2 Users panel & presence UI

- `collaborators` already updated via `updateCollaborator` / `removeCollaborator`.
- **Missing:** render them (avatar/color, live cursor on canvas).

**Tasks:**
- [ ] Users list with names + colors
- [ ] Draw other users' cursors on the canvas

## 5.3 Rooms / boards ✅ DONE

**Implemented 2026-11-16** — full session system:

- **Backend** (`Backend/src/server.js`): `create-room` / `join-room` / `leave-room`
  ack callbacks (8s timeout on the client), per-room element storage with
  replay to new joiners, `socket.to(room)` draw/clear/chat relay, room-scoped
  `room-users` broadcasts, 5-user cap (`full` / `not-found` errors), disconnect
  cleanup. Empty rooms are kept until restart so shared links stay valid.
- **Frontend:**
  - `App.jsx` — session gate: landing vs board, auto-join from `?room=ABC123`,
    Start Session flow, error banners for `full` / `not-found`.
  - `pages/Landing.jsx` — start screen with "Start a session" button.
  - `components/Session/ShareModal.jsx` — link popup with copy button + capacity.
  - `BoardPage.jsx` — `{roomUsers.length}/5 people` pill + Share button.
  - `useSocket.js` — `createRoom`/`joinRoom` helpers + rejoin-on-reconnect
    (reconnect mints a new socket id, so the server forgets membership).
- **Protocol verified:** 19/19 assertions pass headlessly
  (create/join/replay/draw-relay/room-users/not-found/full/clear).

**Tasks:**
- [x] Room id in socket handshake; `io.to(room).emit(...)` instead of global broadcast
- [x] Landing page: "Create board" / "Join with code"
- [x] Board URL like `/?room=ABC123` (query param, not route)
- [x] Share-link popup with copy button
- [x] Max 5 users per link (server-side enforcement)

## 5.4 Persistence

Board is in-memory only (`boardHistory`, max 100) — lost on restart.

**Tasks:**
- [ ] Choose storage (JSON file for MVP, or a DB later)
- [ ] Persist on change; load on server start
- [ ] Bump history cap or store full stroke list per room

## 5.5 Auth

Currently random `User_NNNN`, no login.

**Tasks:**
- [ ] Simple join-with-name first (room-scoped)
- [ ] Later: real accounts if needed

## 5.6 UI polish

- [ ] Implement empty `UI/Button.jsx` and `UI/ColorPicker.jsx` (or delete)
- [ ] Text tool overlay (from Phase 3)
- [ ] Responsive/mobile pass

**Next:** Phase 6 — Quality & Deploy (already done); push the rooms work live.
