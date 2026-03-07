import { createClient } from 'redis';
import pg from 'pg';
import pino from 'pino';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const { Pool } = pg;

class Indexer {
  constructor() {
    this.redisUrl = process.env.REDIS_URL;
    this.databaseUrl = process.env.DATABASE_URL;
    this.batchSize = parseInt(process.env.BATCH_SIZE || '100');
    this.redisClient = null;
    this.dbPool = null;
    this.isRunning = false;
    this.stats = {
      blocksProcessed: 0,
      transactionsProcessed: 0,
      logsProcessed: 0,
      errors: 0,
    };
    this.lastBlockId = '0-0';
    this.lastTxId = '0-0';
  }

  async initialize() {
    try {
      // Initialize Redis
      this.redisClient = createClient({ url: this.redisUrl });
      this.redisClient.on('error', (err) => logger.error('Redis error:', err));
      await this.redisClient.connect();
      logger.info('Redis connected');

      // Initialize Database
      this.dbPool = new Pool({ connectionString: this.databaseUrl });
      const client = await this.dbPool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('Database connected');

      this.isRunning = true;
    } catch (error) {
      logger.error('Initialization error:', error);
      throw error;
    }
  }

  async startIndexing() {
    while (this.isRunning) {
      try {
        // Process blocks
        await this.processBlockStream();
        // Process transactions
        await this.processTransactionStream();
      } catch (error) {
        logger.error('Error in indexing loop:', error);
        this.stats.errors++;
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Backoff
      }
    }
  }

  async processBlockStream() {
    try {
      const result = await this.redisClient.xRead(
        [{ key: 'blocks:stream', id: this.lastBlockId }],
        { COUNT: this.batchSize, BLOCK: 1000 }
      );

      if (!result || result.length === 0) {
        return;
      }

      const blocks = result[0].messages;
      const client = await this.dbPool.connect();

      try {
        await client.query('BEGIN');

        for (const { id, message } of blocks) {
          try {
            const blockData = JSON.parse(message.blockData);

            await client.query('SAVEPOINT sp_block');
            await client.query(
              `INSERT INTO blocks (hash, number, timestamp, miner, gas_used, gas_limit, transactions_count)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (hash) DO UPDATE
                 SET transactions_count = EXCLUDED.transactions_count
                 WHERE blocks.transactions_count = 0 AND EXCLUDED.transactions_count > 0`,
              [
                blockData.hash,
                blockData.number,
                blockData.timestamp,
                blockData.miner,
                blockData.gasUsed,
                blockData.gasLimit,
                blockData.transactions.length,
              ]
            );
            await client.query('RELEASE SAVEPOINT sp_block');

            this.lastBlockId = id;
            this.stats.blocksProcessed++;
          } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT sp_block').catch(() => {});
            logger.error(`Error processing block: ${error.message}`);
          }
        }

        await client.query('COMMIT');
        logger.info(`Indexed ${blocks.length} blocks`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      if (error.message.includes('NOGROUP')) {
        // Consumer group doesn't exist, create it
        try {
          await this.redisClient.xGroupCreate('blocks:stream', 'blocks-indexer', '0', {
            MKSTREAM: true,
          });
        } catch (groupError) {
          // Group might already exist
          logger.debug('Block consumer group creation:', groupError.message);
        }
      } else {
        logger.error({ err: error }, 'Error in processBlockStream');
      }
    }
  }

  async processTransactionStream() {
    try {
      const result = await this.redisClient.xRead(
        [{ key: 'transactions:stream', id: this.lastTxId }],
        { COUNT: this.batchSize, BLOCK: 1000 }
      );

      if (!result || result.length === 0) {
        return;
      }

      const transactions = result[0].messages;
      const client = await this.dbPool.connect();

      try {
        await client.query('BEGIN');

        for (const { id, message } of transactions) {
          try {
            const tx = JSON.parse(message.txData);

            await client.query('SAVEPOINT sp_tx');

            // Insert transaction
            await client.query(
              `INSERT INTO transactions (
                hash, block_number, block_hash, from_address, to_address,
                value, gas, gas_price, gas_used, status, input_data, nonce
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (hash) DO NOTHING`,
              [
                tx.hash,
                tx.blockNumber,
                tx.blockHash,
                tx.from,
                tx.to,
                tx.value,
                tx.gas,
                tx.gasPrice,
                tx.gasUsed,
                tx.status,
                tx.input,
                tx.nonce,
              ]
            );

            // Insert logs if present
            if (tx.logs && tx.logs.length > 0) {
              for (const log of tx.logs) {
                await client.query(
                  `INSERT INTO logs (
                    transaction_hash, block_number, block_hash,
                    log_index, address, data
                  ) VALUES ($1, $2, $3, $4, $5, $6)
                  ON CONFLICT (transaction_hash, log_index) DO NOTHING`,
                  [
                    tx.hash,
                    tx.blockNumber,
                    tx.blockHash,
                    log.index,
                    log.address,
                    JSON.stringify(log),
                  ]
                );
              }
            }

            // Update address activity — use its own savepoint so a failure
            // here does NOT abort the outer sp_tx and lose the tx insert.
            await client.query('SAVEPOINT sp_addr');
            try {
              await this.updateAddressActivity(client, tx);
              await client.query('RELEASE SAVEPOINT sp_addr');
            } catch (addrErr) {
              await client.query('ROLLBACK TO SAVEPOINT sp_addr').catch(() => {});
              logger.warn(`Address update skipped for ${tx.hash}: ${addrErr.message}`);
            }

            await client.query('RELEASE SAVEPOINT sp_tx');
            this.lastTxId = id;
            this.stats.transactionsProcessed++;
            this.stats.logsProcessed += (tx.logs?.length || 0);
          } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT sp_tx').catch(() => {});
            logger.error(`Error processing transaction: ${error.message}`);
          }
        }

        await client.query('COMMIT');
        logger.info(`Indexed ${transactions.length} transactions`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      if (error.message.includes('NOGROUP')) {
        // Consumer group doesn't exist, create it
        try {
          await this.redisClient.xGroupCreate('transactions:stream', 'transactions-indexer', '0', {
            MKSTREAM: true,
          });
        } catch (groupError) {
          logger.debug('Transaction consumer group creation:', groupError.message);
        }
      } else {
        logger.error({ err: error }, 'Error in processTransactionStream');
      }
    }
  }

  async updateAddressActivity(client, tx) {
    // NOTE: caller must wrap this in a savepoint — errors are not swallowed here.
    const addresses = [];
    if (tx.from) addresses.push(tx.from);
    if (tx.to)   addresses.push(tx.to);

    for (const address of addresses) {
      await client.query(
        `INSERT INTO addresses (address, transaction_count, first_seen, last_seen)
         VALUES ($1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (address) DO UPDATE SET
           transaction_count = addresses.transaction_count + 1,
           last_seen = CURRENT_TIMESTAMP`,
        [address]
      );
    }
  }

  startHealthCheck() {
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', isRunning: this.isRunning, stats: this.stats }));
      } else if (req.url === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.stats));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(3101, () => {
      logger.info('Health check server listening on port 3101');
    });
  }

  async shutdown() {
    logger.info('Shutting down indexer...');
    this.isRunning = false;
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
    if (this.dbPool) {
      await this.dbPool.end();
    }
  }
}

// Main execution
async function main() {
  try {
    const indexer = new Indexer();
    await indexer.initialize();
    indexer.startHealthCheck();

    // Handle graceful shutdown
    process.on('SIGTERM', () => indexer.shutdown());
    process.on('SIGINT', () => indexer.shutdown());

    // Start indexing
    await indexer.startIndexing();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
