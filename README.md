# BOTGUARD

Compliance credential registry for the BOT Chain RWA ecosystem.

Brand purple `#8A3FFC` · page `#F7F6F3`

## Repository layout

```
botguard/
├── frontend/                 # Vite + React (deploy on Vercel)
│   ├── vercel.json
│   └── .env.example          # VITE_API_URL
├── services/
│   ├── api/                  # Express API + Dockerfile + OpenAPI (Railway)
│   ├── worker/               # verification worker + Dockerfile
│   ├── indexer/              # chain indexer + Dockerfile
│   └── monitor/              # monitoring agent + rules + Dockerfile
├── contracts/                # Hardhat Solidity sources
├── database/                 # Postgres schema + seed
├── infra/                    # docker-compose, nginx, secrets
├── simulation/               # Python sims
├── scripts/                  # deploy helpers + local tooling
├── deployments/              # contract addresses after deploy
├── vercel.json               # monorepo fallback for Vercel
├── railway.toml              # Railway API service (Dockerfile build)
├── package.json              # root deps + npm scripts
└── hardhat.config.js
```

## Quick start (local)

```bash
npm install
cd frontend && npm install && cd ..

# terminal 1 — local chain
npx hardhat node

# terminal 2 — deploy contracts
npm run deploy:local

# terminal 3 — API (memory mode demo)
npm run api

# terminal 4 — frontend
npm run frontend
```

- Site: http://localhost:5173  
- API: http://localhost:8080  
- Auth header: `X-BOTGUARD-Api-Key: demo-issuer-key`

## Deploy

### Frontend → Vercel

1. Import this GitHub repo in Vercel.
2. Set **Root Directory** to `frontend` (recommended).
3. Framework: Vite (auto-detected via `frontend/vercel.json`).
4. Environment variable:
   - `VITE_API_URL` = your Railway API URL (no trailing slash), e.g. `https://botguard-api.up.railway.app`
5. Deploy.

If Root Directory is left empty, the root `vercel.json` builds `frontend/` for you.

### API → Railway

1. New Railway project → **Deploy from GitHub** (this repo).
2. Use the root `railway.toml` (Dockerfile: `services/api/Dockerfile`, build context = repo root).
3. Attach a Postgres plugin (and Redis if not using memory mode).
4. Set variables (minimum for a demo API):

```bash
BOTGUARD_MEMORY_MODE=1
INLINE_WORKER=1
DEMO_API_KEY=demo-issuer-key
MONITOR_TOKEN=demo-monitor-token
CORS_ORIGIN=https://your-app.vercel.app
PORT=8080
```

5. For full stack mode (`BOTGUARD_MEMORY_MODE=0`), also set `DATABASE_URL`, `REDIS_URL`, `QUEUE_URL`, and contract/RPC addresses.
6. Health check: `GET /healthz`

Optional extra Railway services (same repo, different Dockerfiles):

| Service | Dockerfile |
|---------|------------|
| worker | `services/worker/Dockerfile` |
| indexer | `services/indexer/Dockerfile` |
| monitor | `services/monitor/Dockerfile` |

### Docker (local topology)

```bash
# after deploy:local, load addresses into the shell, then:
docker compose -f infra/docker-compose.yml up --build
```

## API (from `services/api/openapi.yaml`)

- `POST /verifications` — async issuance (`202`, status poll)
- `GET /verifications/{requestId}`
- `GET /credentials/{holderAddress}`
- `POST /credentials/{holderAddress}/renew|revoke`
- `GET /issuers`
- `POST /monitor/flags`
- `GET /healthz`, `GET /readyz`

### Issue a credential on-chain

```bash
node scripts/onchain-issue.js 0xYourAddress RETAIL NG
```

### Tests / simulation

```bash
npm test
pip install -r requirements.txt
npm run sim
```
