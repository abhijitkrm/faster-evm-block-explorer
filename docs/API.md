# EVM Block Explorer - API Reference

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently no authentication required. For production, implement JWT or API keys.

---

## Blocks Endpoints

### Get Latest Blocks

```http
GET /api/blocks?limit=20
```

**Query Parameters:**
- `limit` (int, optional): Number of blocks to return (default: 20, max: 100)

**Response:**
```json
[
  {
    "id": 1,
    "hash": "0x1234...",
    "number": 12345,
    "timestamp": 1234567890,
    "miner": "0x5678...",
    "gas_used": "9999999",
    "gas_limit": "30000000",
    "transactions_count": 156,
    "created_at": "2026-03-06T10:00:00Z"
  }
]
```

### Get Block by Number or Hash

```http
GET /api/blocks/:number
```

**Parameters:**
- `:number` (string): Block number (integer) or block hash (0x...)

**Response:**
```json
{
  "id": 1,
  "hash": "0x1234...",
  "number": 12345,
  "timestamp": 1234567890,
  "miner": "0x5678...",
  "gas_used": "9999999",
  "gas_limit": "30000000",
  "transactions_count": 156,
  "transactions": [
    {
      "hash": "0xabcd...",
      "from_address": "0x1111...",
      "to_address": "0x2222...",
      "value": "1000000000000000000",
      "status": 1
    }
  ]
}
```

### Get Block Range

```http
GET /api/blocks/range/:start/:end
```

**Parameters:**
- `:start` (int): Starting block number
- `:end` (int): Ending block number (max range: 1000)

**Response:** Array of block summaries

---

## Transactions Endpoints

### Get Latest Transactions

```http
GET /api/transactions?limit=20
```

**Query Parameters:**
- `limit` (int, optional): Default 20, max 100

**Response:**
```json
[
  {
    "hash": "0xabcd...",
    "block_number": 12345,
    "from_address": "0x1111...",
    "to_address": "0x2222...",
    "value": "1000000000000000000",
    "gas_price": "45000000000",
    "status": 1,
    "created_at": "2026-03-06T10:00:00Z"
  }
]
```

### Get Transaction by Hash

```http
GET /api/transactions/:hash
```

**Parameters:**
- `:hash` (string): Transaction hash (0x...)

**Response:**
```json
{
  "hash": "0xabcd...",
  "block_number": 12345,
  "block_hash": "0x1234...",
  "from_address": "0x1111...",
  "to_address": "0x2222...",
  "value": "1000000000000000000",
  "gas": "21000",
  "gas_price": "45000000000",
  "gas_used": "21000",
  "status": 1,
  "nonce": 42,
  "input_data": "0x",
  "logs": [
    {
      "log_index": 0,
      "address": "0x3333...",
      "data": "0x1234567890abcdef..."
    }
  ]
}
```

### Get Transactions by Address

```http
GET /api/transactions/address/:address?limit=20
```

**Parameters:**
- `:address` (string): Ethereum address (0x...)

**Response:** Array of transactions where the address is sender or recipient

### Get Pending Transactions

```http
GET /api/transactions/pending/list
```

**Response:** Array of pending transactions (top 20 by gas price)

---

## Addresses Endpoints

### Get All Addresses

```http
GET /api/addresses?limit=20
```

**Response:**
```json
[
  {
    "address": "0x1111...",
    "transaction_count": 1234,
    "first_seen": "2026-01-01T00:00:00Z",
    "last_seen": "2026-03-06T10:00:00Z",
    "is_contract": false
  }
]
```

### Get Address Details

```http
GET /api/addresses/:address
```

**Parameters:**
- `:address` (string): Ethereum address (0x...)

**Response:**
```json
{
  "address": "0x1111...",
  "transaction_count": 1234,
  "first_seen": "2026-01-01T00:00:00Z",
  "last_seen": "2026-03-06T10:00:00Z",
  "is_contract": false,
  "balance": "5000000000000000000",
  "recentTransactions": [
    {
      "hash": "0xabcd...",
      "block_number": 12345,
      "from_address": "0x1111...",
      "to_address": "0x2222...",
      "value": "1000000000000000000",
      "status": 1,
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

### Search Addresses

```http
GET /api/addresses/search/by-pattern?pattern=0x111
```

**Query Parameters:**
- `pattern` (string, required): Address pattern to search (min 3 chars, case-insensitive)

**Response:** Array of matching addresses

---

## Statistics Endpoint

### Get Global Statistics

```http
GET /stats
```

**Response:**
```json
{
  "total_blocks": 12345,
  "total_transactions": 987654,
  "total_addresses": 123456,
  "total_logs": 5000000
}
```

---

## Health & Status

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-06T10:00:00Z",
  "connectedClients": 42
}
```

---

## WebSocket (Real-Time Updates)

### Connect to WebSocket Stream

```javascript
const ws = new WebSocket('ws://localhost:3000');

// Subscribe to blocks
ws.send(JSON.stringify({ type: 'subscribe', stream: 'blocks' }));

// Subscribe to transactions
ws.send(JSON.stringify({ type: 'subscribe', stream: 'transactions' }));

// Receive updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### WebSocket Message Format

**Block Update:**
```json
{
  "type": "block",
  "data": {
    "number": 12345,
    "hash": "0x1234...",
    "timestamp": 1234567890,
    "transactions_count": 156
  }
}
```

**Transaction Update:**
```json
{
  "type": "transaction",
  "data": {
    "hash": "0xabcd...",
    "from_address": "0x1111...",
    "to_address": "0x2222...",
    "value": "1000000000000000000",
    "status": 1
  }
}
```

---

## Error Handling

All errors follow standard HTTP status codes:

- `200`: Success
- `400`: Bad request (invalid parameters)
- `404`: Not found (block/transaction/address not found)
- `500`: Server error

**Error Response:**
```json
{
  "error": "Description of what went wrong"
}
```

---

## Rate Limiting

Currently not implemented. For production:
- Implement rate limiting: 100 requests/minute per IP
- WebSocket connections: 10 concurrent per IP
- Use reverse proxy (nginx) for rate limiting

---

## Examples

### cURL

```bash
# Get latest blocks
curl http://localhost:3000/api/blocks

# Get specific block
curl http://localhost:3000/api/blocks/12345

# Get address details
curl http://localhost:3000/api/addresses/0x1234567890123456789012345678901234567890

# Get statistics
curl http://localhost:3000/stats
```

### JavaScript/Fetch

```javascript
// Get latest transactions
const response = await fetch('http://localhost:3000/api/transactions?limit=10');
const transactions = await response.json();

// Get address
const address = '0x1234567890123456789012345678901234567890';
const addressData = await fetch(`http://localhost:3000/api/addresses/${address}`);
const data = await addressData.json();
```

### WebSocket JavaScript

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.addEventListener('open', () => {
  // Subscribe to both streams
  ws.send(JSON.stringify({ type: 'subscribe', stream: 'blocks' }));
  ws.send(JSON.stringify({ type: 'subscribe', stream: 'transactions' }));
});

ws.addEventListener('message', (event) => {
  const { type, data } = JSON.parse(event.data);
  
  if (type === 'block') {
    console.log('New block:', data);
  } else if (type === 'transaction') {
    console.log('New transaction:', data);
  }
});
```

---

## Response Times (Expected)

- Blocks endpoint: < 100ms
- Transaction lookup: < 100ms  (cached)
- Address activity: < 200ms
- WebSocket updates: < 500ms from chain

---

**Last Updated**: March 6, 2026
