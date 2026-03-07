# EVM Block Explorer - Deployment Guide

## Quick Start

### 1. Prerequisites
- Docker & Docker Compose (latest version)
- macOS, Linux, or Windows (with WSL2)
- 8GB+ RAM recommended

### 2. Setup Environment

```bash
cd /Users/sysadmin/Desktop/explorer/realtime

# The .env file is already configured with your endpoints:
# RPC_URL=http://34.220.79.132:8545/
# WS_URL=ws://34.220.79.132:8546
```

### 3. Start the Explorer

```bash
# Build and start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Access the Application

- **Frontend**: http://localhost:3001
- **API**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Database**: localhost:5432

### 5. Stop the Explorer

```bash
docker-compose down

# To completely remove volumes/data:
docker-compose down -v
```

---

## Service Details

### Block Listener
- **Port**: 3100 (health check)
- **Function**: Polls RPC for new blocks and transactions
- **Data Flow**: RPC → Redis Streams
- **Config**: `services/block-listener/src/index.js`

### Indexer
- **Port**: 3101 (health check)
- **Function**: Processes events from Redis into PostgreSQL
- **Data Flow**: Redis Streams → Database
- **Config**: `services/indexer/src/index.js`

### API Server
- **Port**: 3000 (REST + WebSocket)
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /stats` - Global statistics
  - `GET /api/blocks` - Latest blocks
  - `GET /api/blocks/:number` - Block details
  - `GET /api/transactions` - Latest transactions
  - `GET /api/transactions/:hash` - Transaction details
  - `GET /api/addresses` - Top addresses
  - `GET /api/addresses/:address` - Address activity
  - `WS /` - WebSocket for real-time updates

### Frontend
- **Port**: 3001
- **Features**:
  - Real-time block and transaction display
  - Address search and activity tracking
  - Statistics dashboard
  - Responsive design

### Database (PostgreSQL)
- **Port**: 5432
- **Database**: explorer
- **Tables**: blocks, transactions, logs, addresses, statistics, sync_status
- **Volume**: postgres-data (persisted between restarts)

### Cache (Redis)
- **Port**: 6379
- **Purpose**: Message queues (block/transaction streams), caching
- **Volume**: redis-data (persisted between restarts)

### Monitoring (Prometheus)
- **Port**: 9090
- **Config**: `config/prometheus.yml`
- **Metrics**: Available at various `/metrics` endpoints

---

## Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]
```

### Database connection error
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Reinitialize database
docker-compose down -v
docker-compose up -d postgres
docker-compose up indexer
```

### No data appearing
1. Check block-listener logs: `docker-compose logs block-listener`
2. Verify RPC/WS URLs in `.env`
3. Check Redis: `docker exec explorer-redis redis-cli PING`
4. Check database: `docker exec explorer-postgres psql -U explorer -d explorer -c "SELECT COUNT(*) FROM blocks;"`

### High Memory Usage
- Increase Docker memory limit
- Reduce Redis memory: Edit `docker-compose.yml` maxmemory value
- Enable database query optimization

---

## Configuration

### Environment Variables

Edit `.env` to customize:

```bash
# RPC Endpoints
RPC_URL=http://34.220.79.132:8545/
WS_URL=ws://34.220.79.132:8546

# Database
DB_USER=explorer
DB_PASSWORD=explorer_secure_password_2026

# Log level: debug, info, warn, error
LOG_LEVEL=info

# Batch sizes for performance tuning
INDEXER_BATCH_SIZE=100
BLOCK_LISTENER_BATCH_SIZE=50
```

### Performance Tuning

1. **Block Listener**:
   - Increase `BLOCK_LISTENER_BATCH_SIZE` for faster indexing (higher CPU/memory)
   - Decrease polling interval in `services/block-listener/src/index.js`

2. **Indexer**:
   - Increase `INDEXER_BATCH_SIZE` for faster database writes
   - Add database indexes for frequent queries

3. **API**:
   - Add caching headers for GET requests
   - Enable compression with reverse proxy (nginx)

4. **Database**:
   ```sql
   -- Analyze query performance
   ANALYZE;
   
   -- Check index usage
   SELECT schemaname, tablename, indexname FROM pg_indexes;
   ```

---

## Monitoring & Observability

### Health Checks

All services expose health endpoints:
- Block Listener: http://localhost:3100/health
- Indexer: http://localhost:3101/health
- API: http://localhost:3000/health

### Prometheus Metrics

Access at http://localhost:9090

Common queries:
```
# Service uptime
up{job="api"}

# Request throughput
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### Log Aggregation

View logs from all services:
```bash
docker-compose logs --timestamps --tail=100 -f
```

---

## Database Backup & Restore

### Backup
```bash
# Create backup
docker exec explorer-postgres pg_dump -U explorer explorer > backup.sql

# Create volume backup
docker run --rm -v explorer-realtime_postgres-data:/data -v $(pwd):/backup \
  postgres:15-alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Restore
```bash
# Restore from SQL dump
docker exec -i explorer-postgres psql -U explorer explorer < backup.sql

# Restore from volume backup
docker run --rm -v explorer-realtime_postgres-data:/data -v $(pwd):/backup \
  postgres:15-alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

---

## Security Considerations

⚠️ **For Production:**

1. Change default passwords in `.env`
2. Use environment secrets management (docker secrets, vault)
3. Add authentication to API endpoints
4. Enable SSL/TLS with reverse proxy (nginx)
5. Implement rate limiting
6. Use firewall rules to restrict access
7. Regular security updates
8. Monitor for suspicious activity

### Add Basic Auth (nginx reverse proxy)

Create `nginx.conf`:
```nginx
upstream api {
  server api:3000;
}

server {
  listen 80;
  server_name _;

  location / {
    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://api;
  }
}
```

Then add to `docker-compose.yml`:
```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./htpasswd:/etc/nginx/.htpasswd:ro
    depends_on:
      - api
```

---

## Next Steps

1. Start application: `docker-compose up -d`
2. Monitor logs: `docker-compose logs -f`
3. Open frontend: http://localhost:3001
4. Check Prometheus: http://localhost:9090
5. Review database: `docker exec explorer-postgres psql -U explorer -d explorer`

---

## Support & Resources

- Docker Compose: https://docs.docker.com/compose/
- PostgreSQL: https://www.postgresql.org/docs/
- Redis: https://redis.io/documentation
- React: https://react.dev/
- Ethers.js: https://docs.ethers.org/

---

**Last Updated**: March 6, 2026
**Configuration**: Custom EVM L1 with WebSocket enabled
