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

async function getCode(address) {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getCode', params: [address, 'latest'] }),
    });
    const { result } = await res.json();
    // '0x' or '0x0' means EOA
    if (!result || result === '0x' || result === '0x0') return { is_contract: false, bytecode_size: 0, bytecode: null };
    return { is_contract: true, bytecode_size: Math.floor((result.length - 2) / 2), bytecode: result };
  } catch {
    return { is_contract: false, bytecode_size: 0, bytecode: null };
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

      const [addrResult, txResult, countResult, balance, codeInfo] = await Promise.all([
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
        getCode(address),
      ]);

      // Find deployment transaction for contracts — use contract_address column
      // Falls back to RPC eth_getTransactionReceipt for already-indexed txs with NULL contract_address
      let deployInfo = null;
      if (codeInfo.is_contract) {
        const deployRes = await dbPool.query(`
          SELECT hash, block_number, block_timestamp, from_address
          FROM transactions
          WHERE contract_address = $1
          ORDER BY block_number ASC
          LIMIT 1
        `, [address]);
        if (deployRes.rows.length > 0) {
          deployInfo = deployRes.rows[0];
        } else {
          // Fallback: find candidate txs (to_address IS NULL) and check their receipt via RPC
          const candidates = await dbPool.query(`
            SELECT hash, block_number, block_timestamp, from_address
            FROM transactions
            WHERE to_address IS NULL AND contract_address IS NULL
            ORDER BY block_number ASC
            LIMIT 50
          `);
          for (const row of candidates.rows) {
            try {
              const r = await fetch(RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc:'2.0', id:3, method:'eth_getTransactionReceipt', params:[row.hash] }),
              });
              const { result } = await r.json();
              if (result?.contractAddress?.toLowerCase() === address) {
                // Backfill this record so future lookups are instant
                await dbPool.query(
                  `UPDATE transactions SET contract_address = $1 WHERE hash = $2`,
                  [address, row.hash]
                ).catch(() => {});
                deployInfo = row;
                break;
              }
            } catch { /* skip */ }
          }
        }
      }

      if (addrResult.rows.length === 0) {
        // Address not found in DB but may still have balance — show what we have
        return res.json({
          address,
          transaction_count: 0,
          first_seen: null,
          last_seen: null,
          is_contract: codeInfo.is_contract,
          bytecode_size: codeInfo.bytecode_size,
          bytecode: codeInfo.bytecode,
          deploy_info: deployInfo,
          balance,
          transactions: txResult.rows,
          total_transactions: countResult.rows[0].total,
          page,
          limit,
        });
      }

      res.json({
        ...addrResult.rows[0],
        is_contract: codeInfo.is_contract || addrResult.rows[0].is_contract,
        bytecode_size: codeInfo.bytecode_size,
        bytecode: codeInfo.bytecode,
        deploy_info: deployInfo,
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

