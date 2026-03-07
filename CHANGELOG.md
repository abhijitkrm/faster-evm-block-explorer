# Changelog

All notable changes to this project are documented here.  
Format: **[date] — type: description**

---

## [2026-03-07]

### Fixed
- **Block list out-of-order display** — blocks arriving out of order over WebSocket (due to parallel 50-block batch fetching) were naively prepended, causing e.g. block 115 to appear above 112. WSContext now deduplicates by hash and sorts descending by block number on every `block` event and on `init`.
- **Block list ordering on init** — initial payload from the API was not sorted; now sorted descending by `number` before storing in state.

### Added
- **Search bar** — global search in the header auto-detects input type and redirects:
  - `0x` + 40 hex chars → `/address/:address`
  - `0x` + 64 hex chars → probes tx hash first, falls back to block hash
  - Pure integer → `/blocks/:number`
  - Shows live type badge (Address / Tx+Block hash / Block #) as you type
  - Spinner during API probe, inline error on not-found

### Improved
- **Smooth metric counters** — header stats bar now animates instead of jumping:
  - Block Height & Total Blocks use `useCountUp` (steps ±1 per tick at ~25 steps/sec, snaps if gap > 50)
  - TPS & Avg Block Time use `useLerp` (exponential ease, 10% per frame)

---

## [2026-03-06]

### Added
- **Transaction detail page** (`/tx/:hash`) — overview panel with hash, block link, timestamp + age, from/to address links, value (ETH), gas limit/used + %, gas price (Gwei), nonce, expandable input data, status banner (SUCCESS / FAILED / PENDING), and decoded logs section (topics, data per log).
- **`/tx/:hash` route** registered in `App.jsx`.
- **Tx hash links** — hash cells in `TransactionList.jsx` and `Home.jsx` now link to `/tx/:hash`.
- **Block number links** in `TransactionList.jsx` now link to `/blocks/:number` (were pointing to `/blocks`).

### Fixed
- **Logs missing `topics` field** — `transactions.js` route now includes `topics` in the logs SELECT query.

---

## [2026-03-05]

### Added
- **Block detail page** (`/blocks/:number`) — overview panel (hash, parent hash link, timestamp, miner, tx count, gas used/limit bar), transactions table, Prev/Next navigation.
- **`/blocks/:number` route** registered in `App.jsx`.
- **Block number links** everywhere (Home, BlockList, TransactionList) now navigate to the detail page.
- **Address page overhaul** — live ETH balance via `eth_getBalance` RPC call, IN/OUT direction badge, age from `block_timestamp`, copy-to-clipboard button, pagination (25/page).
- **Light mode** — full `[data-theme="light"]` CSS override set; ☀/☾ toggle button in header persisted to `localStorage`.
- **`RPC_URL` env var** added to API service in `docker-compose.yml` to support live balance lookups.

### Fixed
- **`varchar = bigint` SQL error** in `blocks.js` — `WHERE number = $1 OR hash = $1` split into two separate queries based on whether the param starts with `0x`.
- **Blocks page stale data** — `/blocks` page switched from 5 s REST poll to `useWS()` + 1 s ticker.
- **Age column layout shift** — time span given `display:inline-block; min-width:74px` to prevent width jumping.

### Improved
- `WSContext` `MAX_BLOCKS` widened from 20 → 50.
- API `blocks.js` query returns richer tx fields: `gas`, `gas_price`, `gas_used`, `status`, `nonce`, `input_data`, `block_timestamp`.
- API `addresses.js` returns richer tx fields including `block_timestamp`, with pagination (`?page=&limit=`).

---

## [2026-03-04]

### Added
- **README** fully rewritten for public GitHub: removed hardcoded IPs/paths, added clone + setup instructions, environment variable documentation.
- **`.env.example`** with placeholder values for all required environment variables.

### Fixed
- **TPS calculation** — changed from 101-block average to `latest_block.transactions_count ÷ avg_block_time(last 20 blocks)` for a more responsive instantaneous reading. `avg_block_time` metric continues to use a 101-block window.

---

## [2026-03-03]

### Fixed
- **Block listener fetching 0 transactions** — rewrote listener to use raw `fetch()` JSON-RPC instead of ethers.js. Now calls `eth_getBlockByNumber(hex, true)` and `eth_getBlockReceipts(hex)` in parallel per block.

### Improved
- Block listener processes up to 50 blocks in parallel on catch-up.
- Redis checkpoint key `listener:lastBlock` tracks progress across restarts.
