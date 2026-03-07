import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const fmtNum   = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtEth   = (wei) => { try { return (Number(BigInt(wei)) / 1e18).toFixed(6); } catch { return '0.000000'; } };
const fmtGwei  = (wei) => { try { return (Number(BigInt(wei)) / 1e9).toFixed(2) + ' Gwei'; } catch { return '—'; } };
const shortAddr = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : 'Contract';

const fmtTs = (ts) => {
  if (!ts) return '—';
  return new Date(parseInt(ts) * 1000).toLocaleString();
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000) - parseInt(ts);
  if (s < 1)     return 'just now';
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
};

const Row = ({ label, children }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '210px 1fr',
    padding: '10px 20px', borderBottom: '1px solid var(--border)',
    fontSize: 12, alignItems: 'start',
  }}>
    <span style={{ color: 'var(--text-3)', fontWeight: 600, letterSpacing: '.06em',
                   fontSize: 10, textTransform: 'uppercase', paddingTop: 2 }}>{label}</span>
    <span style={{ color: 'var(--text-2)', wordBreak: 'break-all' }}>{children}</span>
  </div>
);

export default function TxDetail() {
  const { hash } = useParams();
  const [tx, setTx] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setTx(null); setNotFound(false);
    fetch(`${API}/api/transactions/${hash}`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setTx(d); })
      .catch(() => setNotFound(true));
  }, [hash]);

  if (notFound) return (
    <div className="empty" style={{ paddingTop: 60 }}>
      Transaction not found.
      <div style={{ marginTop: 16 }}>
        <Link to="/transactions" className="nav-link" style={{ fontSize: 11 }}>← Back to transactions</Link>
      </div>
    </div>
  );

  if (!tx) return <div className="empty">Loading transaction…</div>;

  const isSuccess = tx.status === 1;
  const isFail    = tx.status === 0;

  return (
    <div>
      {/* Header */}
      <div className="page-head">
        <span className="page-title">Transaction</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace',
                       wordBreak: 'break-all' }}>{hash}</span>
      </div>

      {/* Status banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 18px', borderRadius: 8, marginBottom: 14,
        background: isSuccess ? 'rgba(0,255,136,.06)' : isFail ? 'rgba(255,87,87,.06)' : 'rgba(255,179,71,.06)',
        border: `1px solid ${isSuccess ? 'rgba(0,255,136,.2)' : isFail ? 'rgba(255,87,87,.2)' : 'rgba(255,179,71,.2)'}`,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.12em', padding: '2px 8px',
          borderRadius: 4,
          background: isSuccess ? 'rgba(0,255,136,.12)' : isFail ? 'rgba(255,87,87,.12)' : 'rgba(255,179,71,.12)',
          color: isSuccess ? 'var(--green)' : isFail ? 'var(--red)' : 'var(--yellow)',
        }}>
          {isSuccess ? '✓ SUCCESS' : isFail ? '✗ FAILED' : '⧗ PENDING'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Block <Link to={`/blocks/${tx.block_number}`} className="num-link">#{fmtNum(tx.block_number)}</Link>
          {tx.block_timestamp && ` · ${fmtTs(tx.block_timestamp)} (${timeAgo(tx.block_timestamp)})`}
        </span>
      </div>

      {/* Overview */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><span className="panel-title">Overview</span></div>

        <Row label="Transaction Hash">
          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{tx.hash}</span>
        </Row>
        <Row label="From">
          <Link to={`/address/${tx.from_address}`} className="addr-link"
            style={{ fontFamily: 'monospace', fontSize: 11 }}>
            {tx.from_address}
          </Link>
        </Row>
        <Row label="To">
          {tx.to_address
            ? <Link to={`/address/${tx.to_address}`} className="addr-link"
                style={{ fontFamily: 'monospace', fontSize: 11 }}>
                {tx.to_address}
              </Link>
            : <span style={{ color: 'var(--text-3)' }}>Contract Creation
                {tx.contract_address && (
                  <> → <Link to={`/address/${tx.contract_address}`} className="addr-link"
                    style={{ fontFamily: 'monospace', fontSize: 11 }}>{tx.contract_address}</Link></>
                )}
              </span>
          }
        </Row>
        <Row label="Value">
          <span style={{ color: tx.value === '0' ? 'var(--text-3)' : 'var(--text)' }}>
            {fmtEth(tx.value)} ETH
          </span>
        </Row>
        <Row label="Gas Price">{fmtGwei(tx.gas_price)}</Row>
        <Row label="Gas Limit / Used">
          {fmtNum(tx.gas)} / {tx.gas_used ? fmtNum(tx.gas_used) : '—'}
          {tx.gas_used && tx.gas > 0 && (
            <span style={{ color: 'var(--text-3)', marginLeft: 10, fontSize: 11 }}>
              ({((tx.gas_used / tx.gas) * 100).toFixed(1)}%)
            </span>
          )}
        </Row>
        <Row label="Nonce">{tx.nonce ?? '—'}</Row>
        {tx.input_data && tx.input_data !== '0x' && (
          <Row label="Input Data">
            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--blue)', fontSize: 11 }}>
                {Math.ceil((tx.input_data.length - 2) / 2)} bytes
              </summary>
              <pre style={{ marginTop: 8, fontSize: 10, color: 'var(--text-3)',
                            background: 'var(--surface-2)', padding: 10,
                            borderRadius: 6, overflowX: 'auto', whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all' }}>
                {tx.input_data}
              </pre>
            </details>
          </Row>
        )}
      </div>

      {/* Logs */}
      {tx.logs && tx.logs.length > 0 && (
        <>
          <div className="page-head">
            <span className="page-title">Logs</span>
            <span className="page-count">{tx.logs.length} event{tx.logs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="panel">
            {tx.logs.map((log, i) => (
              <div key={log.log_index} style={{
                padding: '14px 20px',
                borderBottom: i < tx.logs.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em',
                                 color: 'var(--text-3)', background: 'var(--surface-2)',
                                 padding: '2px 8px', borderRadius: 4 }}>LOG #{log.log_index}</span>
                  <Link to={`/address/${log.address}`} className="addr-link"
                    style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {shortAddr(log.address)} ({log.address})
                  </Link>
                </div>
                {log.topics && log.topics.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {log.topics.map((t, ti) => (
                      <div key={ti} style={{ fontSize: 10, fontFamily: 'monospace',
                                             color: ti === 0 ? 'var(--purple)' : 'var(--text-3)',
                                             marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-3)', marginRight: 8 }}>
                          {ti === 0 ? 'topic[sig]' : `topic[${ti}]`}
                        </span>{t}
                      </div>
                    ))}
                  </div>
                )}
                {log.data && log.data !== '0x' && (
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-3)',
                                wordBreak: 'break-all' }}>
                    <span style={{ marginRight: 8 }}>data</span>{log.data}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
