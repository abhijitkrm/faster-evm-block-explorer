import express from 'express';

export default function blocksRouter(dbPool) {
  const router = express.Router();

  // Get latest blocks
  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const result = await dbPool.query(`
        SELECT * FROM blocks
        ORDER BY number DESC
        LIMIT $1
      `, [limit]);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  // Get block by number
  router.get('/:number', async (req, res, next) => {
    try {
      const { number } = req.params;
      const result = await dbPool.query(`
        SELECT * FROM blocks
        WHERE number = $1 OR hash = $1
      `, [isNaN(number) ? number : parseInt(number)]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Block not found' });
      }

      const block = result.rows[0];

      // Get transactions in this block
      const txResult = await dbPool.query(`
        SELECT hash, from_address, to_address, value, status
        FROM transactions
        WHERE block_number = $1
        ORDER BY transaction_index ASC
      `, [block.number]);

      block.transactions = txResult.rows;

      res.json(block);
    } catch (error) {
      next(error);
    }
  });

  // Get block range
  router.get('/range/:start/:end', async (req, res, next) => {
    try {
      const start = parseInt(req.params.start);
      const end = parseInt(req.params.end);

      if (start > end || end - start > 1000) {
        return res.status(400).json({ error: 'Invalid range' });
      }

      const result = await dbPool.query(`
        SELECT number, hash, timestamp, miner, transactions_count, gas_used, gas_limit
        FROM blocks
        WHERE number BETWEEN $1 AND $2
        ORDER BY number ASC
      `, [start, end]);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
