import express from 'express';

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

  // Get address details
  router.get('/:address', async (req, res, next) => {
    try {
      const { address } = req.params;

      // Get address info
      const addrResult = await dbPool.query(`
        SELECT address, transaction_count, first_seen, last_seen, is_contract, balance
        FROM addresses
        WHERE address = $1
      `, [address.toLowerCase()]);

      if (addrResult.rows.length === 0) {
        return res.status(404).json({ error: 'Address not found' });
      }

      const addressInfo = addrResult.rows[0];

      // Get recent transactions
      const txResult = await dbPool.query(`
        SELECT hash, block_number, from_address, to_address, value, status, created_at
        FROM transactions
        WHERE from_address = $1 OR to_address = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [address.toLowerCase()]);

      addressInfo.recentTransactions = txResult.rows;

      res.json(addressInfo);
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
