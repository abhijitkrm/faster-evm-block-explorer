import express from 'express';

const RPC_URL = process.env.RPC_URL;

async function getBalance(address) {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
    });
    const { result } = await res.json();
    return result ? BigInt(result).toString() : '0';
  } catch {
    return '0';
  }
}

export default function addressesRouter(dbPool) {
  const router = express.Router();

  // Get all addresses
  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const result = await dbPool.query(`
        SELECT address, transaction_count, first_seen, last_seen, is_contract
        FROM addresses
        ORDER BY transaction_count DESC
        LIMIT $1
      `, [limit]);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  // Get address details + live balance + transaction history
  router.get('/:address', async (req, res, next) => {
    try {
      const address = req.params.address.toLowerCase();
      const page    = Math.max(1, parseInt(req.query.page)  || 1);
      const limit   = Math.min(50, parseInt(req.query.limit) || 25);
      const offset  = (page - 1) * limit;

      const [addrResult, txResult, countResult, balance] = await Promise.all([
        dbPool.query(`
          SELECT address, transaction_count, first_seen, last_seen, is_contract
          FROM addresses
          WHERE address = $1
        `, [address]),

        dbPool.query(`
          SELECT
            t.hash, t.block_number, t.block_timestamp,
            t.from_address, t.to_address,
            t.value, t.gas, t.gas_price, t.gas_used,
            t.status, t.nonce,
            t.input_data
          FROM transactions t
          WHERE t.from_address = $1 OR t.to_address = $1
          ORDER BY t.block_number DESC, t.nonce DESC
          LIMIT $2 OFFSET $3
        `, [address, limit, offset]),

        dbPool.query(`
          SELECT COUNT(*)::int AS total
          FROM transactions
          WHERE from_address = $1 OR to_address = $1
        `, [address]),

        getBalance(address),
      ]);

      if (addrResult.rows.length === 0) {
        // Address not found in DB but may still have balance — show what we have
        return res.json({
          address,
          transaction_count: 0,
          first_seen: null,
          last_seen: null,
          is_contract: false,
          balance,
          transactions: txResult.rows,
          total_transactions: countResult.rows[0].total,
          page,
          limit,
        });
      }

      res.json({
        ...addrResult.rows[0],
        balance,
        transactions: txResult.rows,
        total_transactions: countResult.rows[0].total,
        page,
        limit,
      });
    } catch (error) {
      next(error);
    }
  });

  // Search addresses
  router.get('/search/by-pattern', async (req, res, next) => {
    try {
      const { pattern } = req.query;
      if (!pattern || pattern.length < 3) {
        return res.status(400).json({ error: 'Pattern must be at least 3 characters' });
      }

      const result = await dbPool.query(`
        SELECT address, transaction_count, last_seen
        FROM addresses
        WHERE address ILIKE $1
        LIMIT 20
      `, [`${pattern}%`]);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

