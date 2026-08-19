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

## How other platforms confirm a wallet

Other apps never see ID documents. They only check **whether this wallet is cleared**, **which tier** (Retail / Accredited / Institutional), and **which region**. Personal data stays off-chain.

Use one of three paths. On-chain is the source of truth; the API is a convenience read.

### 1. HTTP status (any backend)

No API key. `verified` is false for missing, expired, or revoked wallets (HTTP 200, not 404).

```bash
curl "https://botguard-production-7c4d.up.railway.app/status/0xWALLET"
curl "https://botguard-production-7c4d.up.railway.app/status/0xWALLET?minTier=ACCREDITED&jurisdiction=US"
```

```json
{
  "verified": true,
  "kind": { "tier": "RETAIL", "tierRank": 1, "jurisdiction": "US", "label": "RETAIL · US" },
  "meetsRequirement": true,
  "requirement": { "minTier": "RETAIL", "jurisdiction": null },
  "expiresAt": "2027-08-19T00:00:00.000Z",
  "badge": { "contract": "0x3e01…", "tokenId": "…", "owned": true },
  "personalData": "off-chain"
}
```

Gate your product on `meetsRequirement` (or `verified` if you only need “cleared at Retail or above”). `kind.tier` / `kind.jurisdiction` is the verification that was done.

### 2. On-chain (RWA tokens, contracts)

BOT Chain Testnet (968). Registry: `0xfcdD8c5823dcDEE47836bfbAd03A425DFd1C0fe5`

```solidity
// inherit ComplianceGate, or call the registry directly
enum InvestorTier { NONE, RETAIL, ACCREDITED, INSTITUTIONAL } // 0–3

function isValid(address holder, InvestorTier minimumTier) external view returns (bool);
function isValidForJurisdiction(address holder, InvestorTier minimumTier, bytes2 region) external view returns (bool);
```

```js
const registry = new Contract(REGISTRY, [
  "function isValid(address,uint8) view returns (bool)",
  "function credentials(address) view returns (bytes32,uint8 tier,bytes2 jurisdiction,address,uint64,uint64,bool revoked,bytes32)",
], provider);

const cleared = await registry.isValid(wallet, 1); // 1 = Retail
const [, tier, region] = await registry.credentials(wallet);
```

Tiers: `1` Retail, `2` Accredited, `3` Institutional. Region is ISO 3166-1 alpha-2 (`US`, `NG`, `GB`, `EU`).

`ExampleRWAToken` shows transfer gating: both sender and recipient must pass `onlyCompliant`.

Soulbound badge (kind on the NFT): VerificationPass `0x3e01dC32E7c3dCC9D43bEe186A73575004cd818E` — `hasPass(wallet)` / `passOf(wallet)`.

### 3. Cached credential record

`GET /credentials/{holderAddress}` — same facts (`valid`, `tier`, `jurisdiction`, `nft`). 404 if this wallet has never been issued a pass.

## API (from `services/api/openapi.yaml`)

- `GET /status/{holderAddress}` — public wallet check (`?minTier=&jurisdiction=`)
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
