import { createClient } from 'redis';
import pino from 'pino';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const RPC_URL   = process.env.RPC_URL;
const REDIS_KEY = 'listener:lastBlock';

async function rpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

function hexToNum(h) { return parseInt(h, 16); }

class BlockListener {
  constructor() {
    this.redisClient = null;
    this.isRunning = false;
    this.lastBlockNumber = 0;
    this.catchUpBatch = 50;
  }

  async initialize() {
    this.redisClient = createClient({ url: process.env.REDIS_URL });
    this.redisClient.on('error', (err) => logger.error('Redis error:', err));
    await this.redisClient.connect();
    logger.info('Redis connected');
    const saved = await this.redisClient.get(REDIS_KEY);
    if (saved) {
      this.lastBlockNumber = parseInt(saved);
      logger.info(`Resuming from saved block ${this.lastBlockNumber}`);
    } else {
      this.lastBlockNumber = hexToNum(await rpc('eth_blockNumber'));
      logger.info(`First run - starting from tip ${this.lastBlockNumber}`);
    }
    this.isRunning = true;
  }

  async listenForBlocks() {
    while (this.isRunning) {
      try {
        const tip = hexToNum(await rpc('eth_blockNumber'));
        if (tip > this.lastBlockNumber) {
          const from = this.lastBlockNumber + 1;
          const to   = Math.min(tip, this.lastBlockNumber + this.catchUpBatch);
          const nums = [];
          for (let n = from; n <= to; n++) nums.push(n);
          await Promise.all(nums.map((n) => this.processBlock(n)));
          this.lastBlockNumber = to;
          await this.redisClient.set(REDIS_KEY, String(this.lastBlockNumber));
          if (to < tip) continue;
        }
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        logger.error(`listenForBlocks error: ${err.message}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  async processBlock(blockNumber) {
    const hex = '0x' + blockNumber.toString(16);
    try {
      const [block, receipts] = await Promise.all([
        rpc('eth_getBlockByNumber', [hex, true]),
        rpc('eth_getBlockReceipts', [hex]),
      ]);
      if (!block) { logger.warn(`Block ${blockNumber} not found`); return; }
      const txs = block.transactions || [];

      await this.redisClient.xAdd('blocks:stream', '*', {
        blockData: JSON.stringify({
          hash:              block.hash,
          number:            hexToNum(block.number),
          timestamp:         hexToNum(block.timestamp),
          miner:             block.miner,
          gasUsed:           hexToNum(block.gasUsed).toString(),
          gasLimit:          hexToNum(block.gasLimit).toString(),
          transactions:      txs.map((t) => t.hash),
          transactions_count: txs.length,
        }),
      });

      if (txs.length === 0) {
        logger.info(`Block ${blockNumber}: 0 txs`);
        return;
      }

      const receiptMap = {};
      if (receipts) {
        for (const r of receipts) receiptMap[r.transactionHash.toLowerCase()] = r;
      }

      const pipeline = this.redisClient.multi();
      for (const tx of txs) {
        const receipt = receiptMap[tx.hash.toLowerCase()];
        pipeline.xAdd('transactions:stream', '*', {
          txData: JSON.stringify({
            hash:            tx.hash,
            blockNumber:     hexToNum(block.number),
            blockHash:       block.hash,
            blockTimestamp:  hexToNum(block.timestamp),
            from:            tx.from,
            to:              tx.to,
            value:           BigInt(tx.value).toString(),
            gas:             hexToNum(tx.gas).toString(),
            gasPrice:        tx.gasPrice ? BigInt(tx.gasPrice).toString() : '0',
            gasUsed:         receipt ? hexToNum(receipt.gasUsed).toString() : null,
            status:          receipt ? hexToNum(receipt.status) : null,
            contractAddress: receipt ? (receipt.contractAddress || null) : null,
            input:           tx.input,
            nonce:           hexToNum(tx.nonce),
            logs:            receipt ? receipt.logs : [],
          }),
        });
      }
      await pipeline.exec();
      logger.info(`Block ${blockNumber}: ${txs.length} txs`);
    } catch (err) {
      logger.error(`Error processing block ${blockNumber}: ${err.message}`);
    }
  }

  startHealthCheck() {
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', isRunning: this.isRunning, lastBlock: this.lastBlockNumber }));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(3100, () => logger.info('Health check on port 3100'));
  }

  async shutdown() {
    logger.info('Shutting down...');
    this.isRunning = false;
    if (this.redisClient) await this.redisClient.disconnect();
  }
}

async function main() {
  const listener = new BlockListener();
  await listener.initialize();
  listener.startHealthCheck();
  process.on('SIGTERM', () => listener.shutdown());
  process.on('SIGINT',  () => listener.shutdown());
  await listener.listenForBlocks();
}

main().catch((err) => { logger.error(`Fatal: ${err}`); process.exit(1); });
