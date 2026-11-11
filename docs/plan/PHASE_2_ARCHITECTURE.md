# Phase 2: Architecture

**Status:** 🟡 In progress (~70%)
**Started:** 2026-11-11

> Define how CoLab is structured: folder layout, state shape, socket protocol,
> and the drawing pipeline — so features plug in cleanly.

## 2.1 App structure

Two independent apps, run separately:

```
CoLab/
├── Backend/    Express + Socket.io (CommonJS)
└── Frontend/   Vite + React 19 + Redux Toolkit (ESM)
```

**Frontend layout:**
```
src/
├── App.jsx            → Redux Provider → BoardPage
├── pages/             → BoardPage (main screen)
├── components/
│   ├── Board/         → Canvas, Toolbar
│   └── UI/            → generic reusable (Button, ColorPicker) ← still empty
├── hooks/             → useCanvas, useSocket, useBoard
├── store/             → store.js + slices/ (board, tool, user)
└── utils/             → drawingTools, constants
```

**Backend layout:**
```
src/
├── server.js          → HTTP + Socket.io (inline handlers, active)
├── socket/handler.js  → SocketHandlers class (dead code, to be resolved)
└── utils/             → logger, constant
```

## 2.2 State design (Redux)

| Slice | Holds |
|-------|-------|
| `board` | `elements[]`, `history[]`, `future[]`, `isDrawing`, `collaborators{}`, `chatMessages[]` |
| `tool` | `activeTool`, `color`, `brushSize`, `opacity`, `fillColor`, `strokeWidth`, `fontSize`, `fontFamily` |
| `user` | `userId`, `username`, `isConnected`, `cursorPosition`, `color` |

`serializableCheck` disabled (elements contain non-serializable-friendly shapes).

## 2.3 Socket protocol

Event names (kept in `Backend/src/utils/constant.js` + `Frontend/src/utils/constants.js`):

| Event | Direction | Payload |
|-------|-----------|---------|
| `connection` / `disconnect` | server | socket lifecycle |
| `draw` | client → server → others | `{ type, from, to, color, size, fillColor, userId }` |
| `cursor-move` | client → server → others | `{ x, y }` + sender id |
| `clear-board` | client → server → all | — |
| `chat-message` | client → server → all | `{ userId, message, timestamp }` |
| `user-joined` / `user-left` | server → others | `{ id, totalUsers }` |
| `board-state` | server → new client | `boardHistory[]` (replay) |

## 2.4 Drawing pipeline

```
useCanvas (mousedown/move)
  → build element
  → drawElement(ctx, element)      # local render
  → socket.emitDraw(element)       # send to server
  → server broadcasts 'draw'
  → other client dispatch(addElement)
  → their useCanvas effect → redrawCanvas()
```

## 2.5 Architecture tasks

- [x] Folder structure established
- [x] Redux store + 3 slices defined
- [x] Socket protocol drafted (event names + payloads)
- [x] Drawing pipeline defined
- [ ] **Resolve `handler.js` vs inline `server.js`** — pick one (landmine #1)
- [ ] **Make socket a singleton / context** — stop creating one per `useSocket()` call (landmine #4)
- [ ] **Fix frontend `constants.js`** to ESM `export` (landmine #2)
- [ ] Decide persistence strategy (file vs DB) for Phase 5

**Ready to proceed to Phase 3: Core Drawing Engine.**
