# EVM Block Explorer - README

A high-performance, real-time EVM block explorer built with Docker, designed for low-latency transaction streaming on custom EVM chains.

## Features

✅ **Real-Time Block & Transaction Indexing**
- WebSocket support for live updates
- Sub-1000ms transaction latency
- Automatic block polling with RPC fallback

✅ **Comprehensive Data Tracking**
- Full block and transaction data
- Address activity and statistics
- Transaction logs and events
- Custom EVM L1 blockchain support

✅ **Production-Ready Architecture**
- Modular microservices (listener, indexer, API)
- PostgreSQL persistent storage
- Redis message queue and caching
- WebSocket real-time streaming
- Health checks and graceful shutdown

✅ **Modern Web Interface**
- React-based responsive UI
- Real-time data updates
- Block and transaction explorer
- Address activity tracking
- Dark mode theme

✅ **Monitoring & Observability**
- Prometheus metrics
- Service health endpoints
- Comprehensive logging (Pino)
- Performance statistics

## Quick Start

### 1. Clone/Navigate to Project
```bash
cd /Users/sysadmin/Desktop/explorer/realtime
```

### 2. Start Services
```bash
docker-compose up -d
```

### 3. Access Application
- **Frontend**: http://localhost:3001
- **API**: http://localhost:3000
- **Prometheus**: http://localhost:9090

### 4. Verify Services
```bash
docker-compose ps
docker-compose logs -f
```

## Project Structure

```
realtime/
├── services/
│   ├── block-listener/     # Real-time block/tx listener
│   ├── indexer/            # Indexes data into database
│   ├── api/                # REST & WebSocket API
│   └── frontend/           # React web interface
├── database/
│   └── init-db.sql         # Database schema
├── config/
│   └── prometheus.yml      # Monitoring config
├── docs/
│   ├── DEPLOYMENT.md       # Deployment guide
│   ├── API.md              # API documentation
│   └── ARCHITECTURE_PLAN.md # Architecture details
├── docker-compose.yml      # Service orchestration
├── .env                    # Environment variables
└── ARCHITECTURE_PLAN.md    # Initial planning document
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **Blockchain Listener** | Node.js + ethers.js + WebSocket |
| **Message Queue** | Redis Streams |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **API** | Express.js + WebSocket |
| **Frontend** | React 18 + Vite |
| **Monitoring** | Prometheus |
| **Container** | Docker + Docker Compose |

## Configuration

### Environment Variables (`.env`)

```env
# RPC Endpoints
RPC_URL=http://34.220.79.132:8545/
WS_URL=ws://34.220.79.132:8546

# Database
DB_USER=explorer
DB_PASSWORD=explorer_secure_password_2026
DB_NAME=explorer

# API
VITE_API_URL=http://localhost:3000

# Performance
INDEXER_BATCH_SIZE=100
BLOCK_LISTENER_BATCH_SIZE=50
```

## API Overview

### REST Endpoints

```
GET  /api/blocks              # Latest blocks
GET  /api/blocks/:number      # Block details
GET  /api/blocks/range/:start/:end  # Block range
GET  /api/transactions        # Latest transactions
GET  /api/transactions/:hash  # Transaction details
GET  /api/addresses           # Top addresses
GET  /api/addresses/:address  # Address activity
GET  /stats                   # Global statistics
GET  /health                  # Health check
```

### WebSocket Events

```javascript
// Subscribe to real-time updates
ws.send(JSON.stringify({ type: 'subscribe', stream: 'blocks' }));
ws.send(JSON.stringify({ type: 'subscribe', stream: 'transactions' }));

// Receive updates
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  // type: 'block' or 'transaction'
};
```

## Services

### Block Listener
- Polls RPC for new blocks
- Subscribes to transactions via WebSocket
- Publishes to Redis Streams
- **Health**: http://localhost:3100/health

### Indexer
- Consumes Redis Streams
- Writes to PostgreSQL database
- Maintains address activity index
- **Health**: http://localhost:3101/health

### API Server
- Serves REST endpoints
- WebSocket streaming
- Real-time updates
- **Health**: http://localhost:3000/health

### Frontend
- React web interface
- Real-time block/transaction feed
- Address search and details
- Responsive design

### Database (PostgreSQL)
- Persistent block/transaction storage
- Indexed for fast queries
- Time-series optimized
- **Port**: 5432

### Cache (Redis)
- Message queue (Streams)
- Hot data caching
- Pub/Sub for real-time updates
- **Port**: 6379

### Monitoring (Prometheus)
- Metrics collection
- Service health visibility
- **Port**: 9090

## Common Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service]

# Check service status
docker-compose ps

# Restart a service
docker-compose restart [service]

# Enter database shell
docker exec -it explorer-postgres psql -U explorer -d explorer

# Check Redis
docker exec -it explorer-redis redis-cli

# View network traffic
docker-compose logs block-listener
```

## Performance Tuning

### Block Listener
- Adjust polling interval in `services/block-listener/src/index.js`
- Increase `BLOCK_LISTENER_BATCH_SIZE` for faster throughput

### Indexer
- Increase `INDEXER_BATCH_SIZE` (default: 100)
- Tune database connection pool size

### Database
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC;

-- Vacuum and analyze
VACUUM ANALYZE;

-- Check index usage
SELECT schemaname, tablename, indexname FROM pg_indexes;
```

### API
- Enable gzip compression (reverse proxy)
- Add caching headers
- Implement request deduplication on client

## Monitoring

### Health Checks
```bash
curl http://localhost:3100/health  # Block Listener
curl http://localhost:3101/health  # Indexer
curl http://localhost:3000/health  # API
```

### Prometheus Query Examples
```
# Service uptime
up{job="api"}

# Request rate
rate(http_requests_total[5m])

# Indexed transactions
increase(transactions_processed_total[1m])
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Verify docker and docker-compose
docker --version
docker-compose --version

# Check disk space
df -h
```

### No data appearing
1. Verify RPC/WS endpoints are accessible
2. Check block-listener logs: `docker-compose logs block-listener`
3. Verify Redis: `docker exec explorer-redis redis-cli PING`
4. Check database: `docker exec explorer-postgres psql -U explorer -d explorer -c "SELECT COUNT(*) FROM blocks;"`

### High CPU/Memory Usage
- Reduce batch sizes in `.env`
- Check for slow database queries
- Limit concurrent WebSocket connections (add rate limiting)

### Database Full
```bash
# Check disk usage
docker exec explorer-postgres du -sh /var/lib/postgresql/data

# Cleanup old data
docker exec explorer-postgres psql -U explorer -d explorer -c "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';"
```

## Security

⚠️ **Current setup is development/testing only!**

For production deployment:
1. Change default passwords in `.env`
2. Use secrets management (Docker Secrets, HashiCorp Vault)
3. Enable SSL/TLS with reverse proxy (nginx)
4. Implement authentication (JWT, API keys)
5. Add rate limiting
6. Configure firewall rules
7. Enable database backups
8. Monitor security logs

## Database Backup

```bash
# Backup PostgreSQL
docker exec explorer-postgres pg_dump -U explorer explorer > backup.sql

# Restore PostgreSQL
docker exec -i explorer-postgres psql -U explorer explorer < backup.sql
```

## Development

### Modify Block Listener
```bash
# Edit source
vim services/block-listener/src/index.js

# Rebuild and restart
docker-compose up -d --build block-listener
```

### Update Database Schema
```bash
# Add migration
vim database/migrations/01_initial.sql

# Reapply schema
docker-compose down -v
docker-compose up -d postgres
```

### Frontend Development
```bash
# Install dependencies locally
cd services/frontend
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - Detailed setup and configuration
- [API Reference](docs/API.md) - Complete API documentation
- [Architecture Plan](ARCHITECTURE_PLAN.md) - System design and decisions

## Performance Targets

- **Block Indexing**: < 500ms from chain
- **Transaction Streaming**: < 1000ms latency
- **API Response**: < 100ms (cached), < 1000ms (fresh)
- **WebSocket Updates**: Real-time (< 500ms)
- **Throughput**: 1000+ tx/second indexing
- **Concurrent Connections**: 100+ WebSocket clients

## Network Configuration

### Internal Port Mapping
- Block Listener: 3100 (health)
- Indexer: 3101 (health)
- API: 3000 (REST + WS)
- Frontend: 3001 (web)
- PostgreSQL: 5432
- Redis: 6379
- Prometheus: 9090

### External Access
- Frontend: http://localhost:3001
- API: http://localhost:3000
- Prometheus: http://localhost:9090

## License

MIT

## Support

For issues or questions:
1. Check logs: `docker-compose logs [service]`
2. Review documentation in `docs/`
3. Verify `.env` configuration
4. Check RPC/WS endpoint availability

---

**Created**: March 6, 2026  
**Blockchain**: Custom EVM L1  
**RPC**: http://34.220.79.132:8545/  
**WebSocket**: ws://34.220.79.132:8546/
