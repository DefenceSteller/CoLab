# Phase 6: Quality & Deploy

**Status:** ⬜ Not started (0%)
**Started:** —

> Tests, error handling, performance, and getting CoLab running somewhere
> other than localhost.

## 6.1 Testing

Currently **no tests at all**.

- [ ] Backend: unit tests for socket handlers (jest/vitest + socket.io-client)
- [ ] Frontend: component tests for `Toolbar`, `Canvas`, slices
- [ ] E2E smoke: two clients connect, draw, see sync (puppeteer/playwright)

## 6.2 Error handling & robustness

- [ ] Backend: wrap handlers in try/catch; structured logging via `utils/logger`
- [ ] Frontend: socket error/disconnect UI (already shows Connected/Disconnected dot)
- [ ] Validate incoming `draw` payloads (don't trust client)
- [ ] Reconnection UX (socket.io already retries 5×)

## 6.3 Performance

- [ ] Throttle `cursor-move` (currently every mousemove → network flood)
- [ ] Batch/interpolate strokes instead of one event per segment
- [ ] Cap `boardHistory` growth; consider offscreen canvas redraw optimization

## 6.4 Code health (landmine cleanup)

- [ ] Resolve `handler.js` vs inline `server.js`
- [ ] Fix ESM/CJS `constants.js`
- [ ] Fix duplicate `useSocket()` connections
- [ ] Remove or implement empty placeholder files
- [ ] Single source of truth for socket event names

## 6.5 Deployment

- [ ] Backend → Render / Railway / Fly.io (WebSockets need sticky sessions)
- [ ] Frontend → Vercel / Netlify
- [ ] Env vars: `VITE_SOCKET_URL` (currently hardcoded `http://localhost:5000`)
- [ ] CORS: allow production frontend origin
- [ ] README: setup + deploy steps

## 6.6 Deliverables

- [ ] Test suites green
- [ ] Landmines from `AGENTS.md` resolved
- [ ] Deployed URL + docs
- [ ] `.env.example` for both apps

**End of plan.**
