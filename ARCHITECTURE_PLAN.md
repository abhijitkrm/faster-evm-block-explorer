# Real-Time EVM Block Explorer - Dockerization Plan

## Project Overview
A dockerized, low-latency real-time EVM block explorer that streams blockchain transactions and blocks with minimal latency using RPC and WebSocket endpoints.

---

## 1. Architecture Overview

### High-Level Architecture
```
[RPC Endpoint] ──────┐
                     ├──→ [Block Listener Service] ──→ [Event Bus / Message Queue]
[WebSocket Endpoint]─┘
                                                       ↓
                                     ┌──────────────────┼──────────────────┐
                                     ↓                  ↓                  ↓
                            [Database Service]  [Cache Layer]    [API Service]
                                     ↓                  ↓                  ↓
                            ┌─────────────────────────────────────────────────────┐
                            │         Real-Time WebSocket Feed to Clients         │
                            └─────────────────────────────────────────────────────┘
```

### Core Components

#### 1.1 Block & Transaction Listener Service
- **Purpose**: Listen to new blocks and transactions in real-time
- **Technology**: 
  - Node.js with ethers.js or web3.js
  - WebSocket subscriptions for real-time updates
- **Key Features**:
  - Poll RPC for latest blocks (fallback mechanism)
  - Subscribe to pending/new transactions via WebSocket
  - Filter relevant transactions (DEX swaps, transfers, etc.)
  - Minimal processing before publishing

#### 1.2 Message Queue / Event Bus
- **Purpose**: Decouple data collection from processing
- **Options**:
  - **Redis Streams** (lightweight, fast, recommended for low-latency)
  - **RabbitMQ** (more robust, but heavier)
  - **Kafka** (scalable but overkill for single explorer)
- **Decision**: Redis Streams for lowest latency

#### 1.3 Database Service
- **Purpose**: Persistent storage of blocks, transactions, and metadata
- **Technology**:
  - **PostgreSQL** (relational data with JSONB for flexible TX data)
  - **TimescaleDB** extension (optimized for time-series data)
- **Key Tables**:
  - blocks (hash, number, timestamp, miner, etc.)
  - transactions (hash, from, to, value, gasPrice, status, etc.)
  - logs/events (indexed for quick filtering)
- **Indexing Strategy**:
  - Primary: block_number, tx_hash
  - Secondary: from, to, address (for accounts)
  - Partial indexes on pending/failed transactions

#### 1.4 Cache Layer
- **Purpose**: Fast retrieval of recent data and real-time statistics
- **Technology**:
  - **Redis** (primary cache)
  - TTL-based expiration for temporary data
- **Cached Data**:
  - Latest 100 blocks
  - Latest 1000 transactions
  - Account balances and activity
  - DEX pair prices (if tracking)
  - Mempool size and gas prices

#### 1.5 API Service
- **Purpose**: REST & WebSocket APIs for clients
- **Technology**:
  - Express.js or Fastify (Node.js)
  - Socket.io or native WebSocket for real-time streaming
- **Endpoints**:
  - `GET /blocks/{number}` - fetch block details
  - `GET /transactions/{hash}` - fetch transaction
  - `GET /address/{address}` - address activity
  - `WS /stream` - real-time block/transaction feed
  - `GET /stats` - explorer statistics

#### 1.6 Frontend (Optional)
- **Purpose**: Web UI for block exploration
- **Technology**:
  - React/Vue with WebSocket client
  - Real-time updates using Socket.io client

---

## 2. Docker Compose Structure

### Service Breakdown

```yaml
services:
  # Data Ingestion
  block-listener:
    image: block-listener:latest
    environment:
      RPC_URL: ${RPC_URL}
      WS_URL: ${WS_URL}
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis
    healthcheck: enabled

  # Message Queue & Cache
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru

  # Database
  postgres:
    image: postgis/postgis:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: explorer
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck: enabled

  # Data Processing & Indexing
  indexer:
    image: indexer:latest
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/explorer
    depends_on:
      - redis
      - postgres
    healthcheck: enabled

  # API Server
  api:
    image: api:latest
    ports:
      - "3000:3000"
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/explorer
    depends_on:
      - redis
      - postgres
    healthcheck: enabled

  # Frontend (Optional)
  frontend:
    image: frontend:latest
    ports:
      - "3001:3000"
    depends_on:
      - api

  # Monitoring (Optional)
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

volumes:
  redis-data:
  postgres-data:
```

---

## 3. Optimization Strategies for Low Latency

### 3.1 Data Ingestion
- ✅ Use WebSocket subscriptions instead of polling when possible
- ✅ Batch process transactions (10-50 items per batch)
- ✅ Minimize external API calls per transaction
- ✅ Use connection pooling for database

### 3.2 Message Queue
- ✅ Redis Streams with consumer groups for reliable delivery
- ✅ Keep stream retention short (last 1 hour of data)
- ✅ Use pipelining for batch inserts

### 3.3 Database
- ✅ Write-optimized: Use buffer/write-ahead logging
- ✅ Partitioning by date/block range for large tables
- ✅ Separate read replicas for API queries
- ✅ Connection pooling (PgBouncer recommended for 50+ connections)

### 3.4 Cache Layer
- ✅ Redis with in-memory optimization
- ✅ Pub/Sub for pushing updates to connected clients
- ✅ Short TTLs on volatile data (30-60 seconds)

### 3.5 API Layer
- ✅ Use HTTP/2 or WebSocket for multiplexing
- ✅ Implement request debouncing on client
- ✅ Compression (gzip) for large responses
- ✅ Rate limiting to prevent resource exhaustion

### 3.6 Network & Infrastructure
- ✅ Run all services in single Docker network (minimal network hops)
- ✅ Use Unix sockets for local communication where possible
- ✅ CDN for static frontend assets
- ✅ Geographic distribution if needed (multiple explorer instances)

---

## 4. Technology Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Data Source** | RPC (REST) + WebSocket | Standard EVM interface |
| **Message Queue** | Redis Streams | Low latency, simple, built-in pub/sub |
| **Database** | PostgreSQL + TimescaleDB | Reliable, good for time-series, JSONB support |
| **Cache** | Redis | Fast, in-memory, pub/sub capabilities |
| **Backend** | Node.js + Fastify/Express | JavaScript ecosystem, fast, lightweight |
| **Real-time Communication** | WebSocket + Socket.io | Low latency, bidirectional |
| **Frontend** | React / Vue | Modern, reactive components |
| **Monitoring** | Prometheus + Grafana | Observable, metrics-driven |
| **Container Orchestration** | Docker Compose | Simple for single host; Docker Swarm/K8s for scale |

---

## 5. Project Structure

```
realtime/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── services/
│   ├── block-listener/
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── rpc-client.js
│   │   │   ├── websocket-client.js
│   │   │   └── publisher.js
│   │   ├── package.json
│   │   └── .dockerignore
│   │
│   ├── indexer/
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── consumer.js
│   │   │   ├── db-writer.js
│   │   │   └── batch-processor.js
│   │   ├── package.json
│   │   └── .dockerignore
│   │
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   │   ├── blocks.js
│   │   │   │   ├── transactions.js
│   │   │   │   ├── addresses.js
│   │   │   │   └── websocket.js
│   │   │   ├── middleware/
│   │   │   ├── utils/
│   │   │   └── db.js
│   │   ├── package.json
│   │   └── .dockerignore
│   │
│   └── frontend/ (Optional)
│       ├── Dockerfile
│       ├── src/
│       ├── package.json
│       └── .dockerignore
│
├── database/
│   ├── init-db.sql (schema definitions)
│   ├── migrations/
│   └── seeds/
│
├── config/
│   ├── prometheus.yml
│   ├── pgbouncer.ini
│   └── nginx.conf (if using reverse proxy)
│
└── docs/
    ├── DEPLOYMENT.md
    ├── API.md
    └── MONITORING.md
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Docker Compose with PostgreSQL, Redis
- [ ] Create block-listener service
- [ ] Create indexer service
- [ ] Define database schema

### Phase 2: API & Real-time (Week 2-3)
- [ ] Implement REST API (blocks, transactions, addresses)
- [ ] Add WebSocket streaming layer
- [ ] Connect all services
- [ ] Basic testing & optimization

### Phase 3: Frontend & Monitoring (Week 3-4)
- [ ] Build frontend (optional)
- [ ] Add Prometheus/Grafana monitoring
- [ ] Performance testing & tuning
- [ ] Documentation & deployment guides

### Phase 4: Production Readiness (Week 4+)
- [ ] Load testing
- [ ] Security audit
- [ ] Deployment to target environment
- [ ] Monitoring & alerting setup

---

## 7. Environment Variables Template

```bash
# RPC & WebSocket Endpoints
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Database
DB_USER=explorer
DB_PASSWORD=secure_password_here
DB_HOST=postgres
DB_PORT=5432
DB_NAME=explorer

# Redis
REDIS_URL=redis://redis:6379

# API Configuration
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=production

# Block Listener
LISTENER_BATCH_SIZE=50
LISTENER_POLL_INTERVAL=5000

# Indexer
INDEXER_BATCH_SIZE=100
INDEXER_WRITE_TIMEOUT=5000

# Frontend
FRONTEND_PORT=3000

# Monitoring
PROMETHEUS_PORT=9090
```

---

## 8. Performance Targets

- **Block Indexing**: < 500ms from chain to database
- **Transaction Streaming**: < 1000ms from mempool to client
- **API Response Time**: < 100ms (cached), < 1000ms (fresh)
- **WebSocket Updates**: Real-time (< 500ms latency)
- **Memory Usage**: 
  - Redis: ~ 500MB - 2GB
  - PostgreSQL: ~ 1GB + data size
  - Services: ~ 200-300MB each
- **Throughput**: 
  - 1000+ transactions/second
  - 100+ concurrent WebSocket connections

---

## 9. Next Steps

When you're ready to provide the RPC and WebSocket URLs, I will:
1. ✅ Create the block-listener service implementation
2. ✅ Create the indexer service
3. ✅ Create the API service with WebSocket support
4. ✅ Set up the database schema and migrations
5. ✅ Create Dockerfile configurations
6. ✅ Set up docker-compose.yml
7. ✅ Add monitoring and health checks
8. ✅ Provide deployment guide

---

## Questions for You

1. **Blockchain**: Which EVM chain? (Ethereum, Polygon, Arbitrum, etc.)
2. **Data Scope**: All transactions or filtered? (DEX swaps, transfers, all)
3. **Historical Data**: Need to backfill existing blocks?
4. **Deployment**: Single machine or distributed cluster?
5. **Scale**: Expected concurrent users/connections?
6. **Frontend**: Include web UI or API-only?
7. **Monitoring**: Full monitoring stack or minimal?

Please provide the RPC and WebSocket endpoints, and answers to any of the above questions that are relevant to your setup!
