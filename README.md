# BOTGUARD

Compliance credential registry for the BOT Chain RWA ecosystem.

Brand: wine red `#722F37` · white `#FFFFFF`

## Layout (matches reference project)

```
botguard/
├── contracts/           # IssuerRegistry, CredentialRegistry, ComplianceGate, ExampleRWAToken
├── api/                 # openapi.yaml + Docker image
├── database/            # schema.sql (+ seed.sql)
├── monitoring/          # rules.py + Docker image
├── simulation/          # botguard_sim.py + results_*.json
├── infra/               # docker-compose.yml, nginx, secrets
├── worker/              # verification worker image
├── indexer/             # chain-indexer image
├── services/            # runnable Node API / worker / indexer / monitor
├── frontend/            # wine-red/white demo site
└── deployments/         # local contract addresses after deploy
```

## Deployed locally (Hardhat)

| Contract | Address |
|----------|---------|
| IssuerRegistry | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| CredentialRegistry | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| ExampleRWAToken | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |

Addresses are also written to `deployments/localhost.json` and `deployments/localhost.env`.

## Quick start

```bash
# install
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

### Docker topology

```bash
# after deploy:local, load addresses
Get-Content deployments/localhost.env | ForEach-Object { if ($_ -match '=') { Set-Item env:$($_.Split('=')[0]) $_.Split('=',2)[1] } }
docker compose -f infra/docker-compose.yml up --build
```

## API (from `api/openapi.yaml`)

- `POST /verifications` — async issuance (`202`, status poll)
- `GET /verifications/{requestId}`
- `GET /credentials/{holderAddress}`
- `POST /credentials/{holderAddress}/renew|revoke`
- `GET /issuers`
- `POST /monitor/flags`
- `GET /healthz`, `GET /readyz`
