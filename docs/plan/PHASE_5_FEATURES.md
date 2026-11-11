# Phase 5: Features

**Status:** 🔴 Early (~20%)
**Started:** 2026-11-11

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

## 5.3 Rooms / boards

Currently one global board. Need create/join by code.

**Tasks:**
- [ ] Room id in socket handshake; `io.to(room).emit(...)` instead of global broadcast
- [ ] Landing page: "Create board" / "Join with code"
- [ ] Board URL like `/board/:roomId`

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

**Ready to proceed to Phase 6: Quality & Deploy.**
