import express from 'express';

export default function transactionsRouter(dbPool) {
  const router = express.Router();

  // Get latest transactions
  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const result = await dbPool.query(`
        SELECT hash, block_number, from_address, to_address, value, gas_price, status, created_at
        FROM transactions
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  // Get transaction by hash
  router.get('/:hash', async (req, res, next) => {
    try {
      const { hash } = req.params;
      const result = await dbPool.query(`
        SELECT * FROM transactions
        WHERE hash = $1
      `, [hash]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const tx = result.rows[0];

      // Get logs for this transaction
      const logsResult = await dbPool.query(`
        SELECT log_index, address, topics, data
        FROM logs
        WHERE transaction_hash = $1
        ORDER BY log_index ASC
      `, [hash]);

      tx.logs = logsResult.rows;

      res.json(tx);
    } catch (error) {
      next(error);
    }
  });

  // Get transactions by address
  router.get('/address/:address', async (req, res, next) => {
    try {
      const { address } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);

      const result = await dbPool.query(`
        SELECT hash, block_number, from_address, to_address, value, gas_price, status, created_at
        FROM transactions
        WHERE from_address = $1 OR to_address = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [address.toLowerCase(), limit]);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  // Get pending transactions
  router.get('/pending/list', async (req, res, next) => {
    try {
      const result = await dbPool.query(`
        SELECT hash, from_address, to_address, value, gas_price
        FROM transactions
        WHERE status IS NULL
        ORDER BY gas_price DESC
        LIMIT 20
      `);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
