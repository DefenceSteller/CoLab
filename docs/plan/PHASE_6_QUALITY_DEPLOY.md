# Phase 6: Quality & Deploy

**Status:** 🟡 In progress (~40%)
**Started:** 2026-11-16

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
- [x] Fix duplicate `useSocket()` connections — **done 2026-11-12 (singleton)**
- [ ] Remove or implement empty placeholder files
- [ ] Single source of truth for socket event names

## 6.5 Deployment

- [x] **Backend → Railway** — project `colab`, deployed via `railway up` from
  `Backend/`; public domain https://colab-production-4bce3d39.up.railway.app
  (verified HTTP 200 + socket.io handshake with CORS)
- [x] **Frontend → Vercel** — project `colab`; production
  https://colab-gold.vercel.app (GitHub integration → push-to-deploy)
- [x] **Env vars: `VITE_SOCKET_URL`** — set in Vercel (production), baked into
  the build (verified in live JS bundle)
- [x] **CORS: allow production frontend origin** — `server.js` reads
  `CORS_ORIGIN` (comma-separated); Railway var =
  `https://colab-gold.vercel.app`
- [ ] README: setup + deploy steps
- [x] Railway: connect GitHub repo — connected (branch `master`, root
  directory `Backend`); pushes to `master` auto-deploy both apps

## 6.6 Deliverables

- [ ] Test suites green
- [ ] Landmines from `AGENTS.md` resolved
- [ ] Deployed URL + docs
- [ ] `.env.example` for both apps

**End of plan.**
