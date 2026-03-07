# Faster — Real-Time EVM Block Explorer

A high-performance, real-time EVM block explorer built with Docker. Designed for high-throughput chains with sub-second block times — streams blocks and transactions live to the browser via WebSocket with no page refresh required.

> Works with any EVM-compatible chain (Ethereum, L2s, custom EVM L1s). Tested at 400ms block times with 50+ transactions per block.

## Features

- **Real-time streaming** — blocks and transactions pushed to the UI as they land on chain
- **Parallel block ingestion** — fetches 20 blocks simultaneously using raw JSON-RPC (`eth_getBlockByNumber` + `eth_getBlockReceipts` in one round trip per block)
- **Full data pipeline** — block listener → Redis Streams → indexer → PostgreSQL → API → WebSocket → frontend
- **Address activity tracking** — transaction counts and history per address
- **Instantaneous TPS** — calculated from latest block tx count ÷ recent avg block time
- **Terminal dark UI** — built with React + Vite, zero external UI dependencies
- **Resumable indexing** — listener saves checkpoint to Redis, picks up where it left off on restart
- **Health endpoints** on every service

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+
- An EVM-compatible RPC endpoint (HTTP JSON-RPC)

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/your-username/faster-explorer.git
cd faster-explorer

# 2. Configure your chain
cp .env.example .env
# Edit .env — set RPC_URL to your chain's HTTP RPC endpoint

# 3. Start everything
docker-compose up -d

# 4. Open the explorer
open http://localhost:3001
```

## Configuration

Copy `.env.example` to `.env` and set the following:

```env
# Your chain's HTTP JSON-RPC endpoint (required)
RPC_URL=http://your-rpc-node:8545/

# Database
DB_USER=explorer
DB_PASSWORD=change_me_in_production
DB_NAME=explorer

# API base URL (used by the frontend)
VITE_API_URL=http://localhost:3000
```

> **Note:** `eth_getBlockReceipts` must be supported by your RPC node for receipt data (gas used, status, logs). Most modern EVM nodes support it. If not, receipts will be `null` but blocks and transactions will still index.

## Project Structure

```
├── services/
│   ├── block-listener/     # Polls RPC, writes blocks + txs to Redis Streams
│   ├── indexer/            # Reads Redis Streams, writes to PostgreSQL
│   ├── api/                # REST + WebSocket API
│   └── frontend/           # React 18 + Vite UI
├── database/
│   └── init-db.sql         # Schema (auto-applied on first start)
├── docker-compose.yml
├── .env.example
└── .env                    # Your local config (git-ignored)
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Block Listener | Node.js, raw JSON-RPC via `fetch` |
| Message Queue | Redis Streams |
| Database | PostgreSQL 15 |
| API | Express.js + WebSocket |
| Frontend | React 18 + Vite |
| Container | Docker + Docker Compose |

## API Reference

### REST

```
GET  /api/blocks                      # Latest blocks
GET  /api/blocks/:number              # Block by number
GET  /api/transactions                # Latest transactions
GET  /api/transactions/:hash          # Transaction by hash
GET  /api/addresses/:address          # Address activity
GET  /stats                           # Chain stats (TPS, block time, totals)
GET  /health                          # Health check
```

### WebSocket

Connect to `ws://localhost:3000` — the server pushes events as they are indexed:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  // msg.type === 'block'  → msg.data = block object
  // msg.type === 'tx'     → msg.data = transaction object
  // msg.type === 'stats'  → msg.data = { tps, avg_block_time, ... }
};
```

## Services & Ports

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3001 | Web UI |
| API | 3000 | REST + WebSocket |
| Block Listener | 3100 | Health only |
| Indexer | 3101 | Health only |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Streams + cache |

## Common Commands

```bash
# View logs for a specific service
docker-compose logs -f block-listener

# Restart a service after editing its source
docker-compose up -d --build block-listener

# Open a database shell
docker exec -it explorer-postgres psql -U explorer -d explorer

# Check Redis stream lengths
docker exec -it explorer-redis redis-cli XLEN blocks:stream
docker exec -it explorer-redis redis-cli XLEN transactions:stream

# Reset everything (deletes all indexed data)
docker-compose down -v && docker-compose up -d
```

## How It Works

```
Chain RPC
   │
   ▼
block-listener  ──── eth_getBlockByNumber (full txs) ──┐
                └─── eth_getBlockReceipts              ─┤
                                                        ▼
                                                  Redis Streams
                                                  (blocks:stream,
                                                   transactions:stream)
                                                        │
                                                        ▼
                                                     indexer
                                                        │
                                                        ▼
                                                   PostgreSQL
                                                        │
                                                        ▼
                                                   API server
                                                   ├── REST
                                                   └── WebSocket ──→ Browser
```

The block listener persists its last processed block number in Redis (`listener:lastBlock`), so it automatically resumes from where it stopped on restart — no blocks are missed.

## Troubleshooting

**No blocks appearing**
- Verify your RPC endpoint is reachable: `curl -X POST http://your-rpc:8545/ -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' -H 'Content-Type: application/json'`
- Check listener logs: `docker-compose logs block-listener`

**Transactions not indexing**
- Check indexer logs: `docker-compose logs indexer`
- Verify `transactions:stream` is growing: `docker exec explorer-redis redis-cli XLEN transactions:stream`

**Services won't start**
```bash
docker-compose logs        # check all logs
docker --version           # requires 20+
docker compose version     # requires v2+
```

**Reset the listener checkpoint** (re-index from a specific block)
```bash
docker exec explorer-redis redis-cli SET listener:lastBlock 1234567
docker-compose restart block-listener
```

## Database Backup & Restore

```bash
# Backup
docker exec explorer-postgres pg_dump -U explorer explorer > backup.sql

# Restore
docker exec -i explorer-postgres psql -U explorer explorer < backup.sql
```

## Security Notes

⚠️ The default configuration is for local development only.

For production:
- Set a strong `DB_PASSWORD` in `.env`
- Place the API behind a reverse proxy (nginx/Caddy) with TLS
- Restrict Redis and PostgreSQL ports to internal networks only
- Add authentication to the API if exposing publicly

## License

MIT
