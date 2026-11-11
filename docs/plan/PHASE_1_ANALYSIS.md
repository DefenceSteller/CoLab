# Phase 1: Analysis & Scope

**Status:** ✅ Done
**Completed:** 2026-11-11

> Define what CoLab is, what it must do, and what already exists — before
> writing feature code.

## 1.1 Product definition

**CoLab** = a collaborative real-time drawing / whiteboard app.

Core promise: multiple people open the same board and draw together; strokes,
cursors, and presence sync instantly over WebSockets.

## 1.2 In-scope features (MVP → full)

**MVP (current target):**
- Shared canvas with drawing tools (pencil, line, rectangle, circle, text, eraser)
- Color palette + brush size
- Real-time stroke sync across clients
- Live cursor positions + user presence (join/leave)
- Undo / redo / clear board

**Full (later phases):**
- Chat panel
- Live users panel (names, colors)
- Rooms / boards (create + join by code)
- Persistence (board survives server restart)
- Auth (named accounts instead of random `User_NNNN`)
- Polished text tool (replace `prompt()`)
- Eraser that truly erases
- Tests + deployment

## 1.3 Existing codebase audit

Analyzed both apps and recorded findings in `AGENTS.md` → "Known landmines":

- Backend has **two** socket implementations (`server.js` inline + unused
  `socket/handler.js`).
- Frontend `constants.js` uses `module.exports` (ESM conflict).
- `useSocket()` creates a new socket per call → duplicate connections.
- Empty placeholder files: `UI/Button`, `UI/ColorPicker`, `useBoard`.
- No persistence, no rooms, no auth.

## 1.4 Tech decisions (confirmed)

| Concern | Choice |
|---------|--------|
| Frontend | Vite + React 19 |
| State | Redux Toolkit (3 slices) |
| Styling | Tailwind CSS v4 |
| Backend | Express 5 + Socket.io 4 (CommonJS) |
| Transport | WebSockets (socket.io) |
| Ports | Backend 5000, Frontend 5173 |

## 1.5 Deliverables

- [x] Product scope defined
- [x] Feature checklist created (MVP + full)
- [x] Existing codebase audited; landmines documented
- [x] Tech stack confirmed

**Ready to proceed to Phase 2: Architecture.**
