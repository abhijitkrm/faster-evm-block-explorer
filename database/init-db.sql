-- Database Initialization Script

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Blocks Table
CREATE TABLE IF NOT EXISTS blocks (
  id SERIAL PRIMARY KEY,
  hash VARCHAR(66) UNIQUE NOT NULL,
  number BIGINT UNIQUE NOT NULL,
  timestamp BIGINT NOT NULL,
  miner VARCHAR(42) NOT NULL,
  gas_used BIGINT NOT NULL,
  gas_limit BIGINT NOT NULL,
  difficulty DECIMAL(38,0) DEFAULT 0,
  total_difficulty DECIMAL(38,0),
  transactions_count INT NOT NULL,
  parent_hash VARCHAR(66),
  state_root VARCHAR(66),
  transactions_root VARCHAR(66),
  receipts_root VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blocks_number ON blocks(number DESC);
CREATE INDEX idx_blocks_timestamp ON blocks(timestamp DESC);
CREATE INDEX idx_blocks_miner ON blocks(miner);
CREATE INDEX idx_blocks_created_at ON blocks(created_at DESC);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  hash VARCHAR(66) UNIQUE NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash VARCHAR(66),
  block_timestamp BIGINT,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42),
  value DECIMAL(38,0) NOT NULL,
  gas BIGINT NOT NULL,
  gas_price DECIMAL(38,0) NOT NULL,
  gas_used BIGINT,
  transaction_index INT,
  nonce BIGINT,
  input_data TEXT,
  status SMALLINT,
  contract_address VARCHAR(42),
  logs_count INT,
  transaction_type SMALLINT,
  max_fee_per_gas DECIMAL(38,0),
  max_priority_fee_per_gas DECIMAL(38,0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (block_hash) REFERENCES blocks(hash) ON DELETE CASCADE
);

CREATE INDEX idx_transactions_block_number ON transactions(block_number DESC);
CREATE INDEX idx_transactions_hash ON transactions(hash);
CREATE INDEX idx_transactions_from ON transactions(from_address);
CREATE INDEX idx_transactions_to ON transactions(to_address);
CREATE INDEX idx_transactions_block_hash ON transactions(block_hash);
CREATE INDEX idx_transactions_timestamp ON transactions(block_timestamp DESC);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Logs/Events Table
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  transaction_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash VARCHAR(66),
  log_index INT NOT NULL,
  address VARCHAR(42) NOT NULL,
  topics JSONB,
  data TEXT,
  removed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (block_hash) REFERENCES blocks(hash) ON DELETE CASCADE,
  FOREIGN KEY (transaction_hash) REFERENCES transactions(hash) ON DELETE CASCADE,
  UNIQUE(transaction_hash, log_index)
);

CREATE INDEX idx_logs_address ON logs(address);
CREATE INDEX idx_logs_block_number ON logs(block_number);
CREATE INDEX idx_logs_transaction_hash ON logs(transaction_hash);
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);

-- Addresses Table (for address activity tracking)
CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) UNIQUE NOT NULL,
  transaction_count INT DEFAULT 0,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_contract BOOLEAN DEFAULT FALSE,
  balance DECIMAL(38,0) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addresses_address ON addresses(address);
CREATE INDEX idx_addresses_last_seen ON addresses(last_seen DESC);

-- Statistics Table (for quick stats queries)
CREATE TABLE IF NOT EXISTS statistics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(38,0),
  data JSONB,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(metric_name, recorded_at)
);

CREATE INDEX idx_statistics_metric ON statistics(metric_name, recorded_at DESC);

-- Sync Status Table (to track indexing progress)
CREATE TABLE IF NOT EXISTS sync_status (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(100) UNIQUE NOT NULL,
  last_processed_block BIGINT DEFAULT 0,
  last_sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'syncing'
);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
