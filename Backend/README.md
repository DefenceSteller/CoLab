# CoLab Backend

Express 5 + Socket.io 4 server (CommonJS).

## Run locally

```bash
npm install
npm run dev    # nodemon → http://localhost:5000
```

Configuration comes from `.env` (or the host's environment):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Port to listen on (hosts like Railway assign their own) |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `NODE_ENV` | — | `production` when deployed |

## Deployed

Runs on Railway (project `colab`, root directory `Backend`). Pushes to
`master` auto-deploy. See `AGENTS.md` at the repo root for the full setup.
