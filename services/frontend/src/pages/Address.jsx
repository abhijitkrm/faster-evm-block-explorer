import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const fmtNum  = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtEth  = (wei) => { try { return (Number(BigInt(wei)) / 1e18).toFixed(6); } catch { return '0.000000'; } };
const fmtVal  = (wei) => { try { return (Number(BigInt(wei)) / 1e18).toFixed(4);  } catch { return '0.0000';   } };
const shortHash = (h) => h ? h.slice(0, 10) + '…' + h.slice(-6) : '';
const shortAddr = (a) => a ? a.slice(0, 6)  + '…' + a.slice(-4)  : 'Contract';

const timeAgo = (blockTs) => {
  if (!blockTs) return '—';
  const s = Math.floor(Date.now() / 1000) - parseInt(blockTs);
  if (s < 1)    return 'just now';
  if (s < 60)   return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
};

export default function Address() {
  const { address } = useParams();
  const [data,    setData]    = useState(null);
  const [page,    setPage]    = useState(1);
  const [copied,  setCopied]  = useState(false);

  const load = useCallback((p) => {
    fetch(`${API}/api/addresses/${address}?page=${p}&limit=25`)
      .then(r => r.json()).then(d => { setData(d); setPage(p); }).catch(() => {});
  }, [address]);

  useEffect(() => { load(1); }, [load]);

  const copy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!data) return <div className="empty">Loading address…</div>;

  const totalPages = Math.ceil((data.total_transactions || 0) / 25);

  return (
    <div>
      {/* Address header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16,
                    background:'var(--surface)', border:'1px solid var(--border)',
                    borderRadius:10, padding:'12px 18px' }}>
        <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--text-2)',
                       wordBreak:'break-all', flex:1 }}>{address}</span>
        <button onClick={copy} style={{
          background:'none', border:'1px solid var(--border-hi)', borderRadius:6,
          color: copied ? 'var(--green)' : 'var(--text-2)', cursor:'pointer',
          fontSize:10, fontWeight:700, letterSpacing:'.1em', padding:'4px 10px',
          textTransform:'uppercase', transition:'all .15s', whiteSpace:'nowrap'
        }}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>

      {/* Stats cards */}
      <div className="addr-card" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:18 }}>
        <div className="addr-stat">
          <div className="metric-label">Balance</div>
          <div className="metric-value green" style={{ fontSize:18 }}>{fmtEth(data.balance)}</div>
          <div className="metric-sub">ETH</div>
        </div>
        <div className="addr-stat">
          <div className="metric-label">Transactions</div>
          <div className="metric-value blue" style={{ fontSize:18 }}>{fmtNum(data.total_transactions)}</div>
          <div className="metric-sub">Total indexed</div>
        </div>
        <div className="addr-stat">
          <div className="metric-label">First Seen</div>
          <div style={{ fontSize:12, marginTop:6, color:'var(--text-2)' }}>
            {data.first_seen ? new Date(data.first_seen).toLocaleString() : '—'}
          </div>
        </div>
        <div className="addr-stat">
          <div className="metric-label">Last Active</div>
          <div style={{ fontSize:12, marginTop:6, color:'var(--text-2)' }}>
            {data.last_seen ? new Date(data.last_seen).toLocaleString() : '—'}
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="page-head">
        <span className="page-title">Transaction History</span>
        <span className="page-count">
          {data.total_transactions ? `${fmtNum(data.total_transactions)} total` : 'no transactions'}
        </span>
      </div>
      <div className="panel">
        {(!data.transactions || data.transactions.length === 0)
          ? <div className="empty">No transactions found</div>
          : (
            <>
              <table className="dt">
                <thead><tr>
                  <th>Hash</th>
                  <th>Block</th>
                  <th style={{textAlign:'center'}}>Dir</th>
                  <th>From</th>
                  <th>To</th>
                  <th style={{textAlign:'right'}}>Value (ETH)</th>
                  <th style={{textAlign:'right'}}>Status</th>
                  <th style={{textAlign:'right'}}>Age</th>
                </tr></thead>
                <tbody>
                  {data.transactions.map(tx => {
                    const isOut = tx.from_address?.toLowerCase() === address.toLowerCase();
                    return (
                      <tr key={tx.hash}>
                        <td style={{ color:'var(--text-2)', fontSize:11 }}>
                          <span className="hash-cell">{shortHash(tx.hash)}</span>
                        </td>
                        <td>
                          <Link to="/blocks" className="num-link">
                            #{Number(tx.block_number).toLocaleString()}
                          </Link>
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <span style={{
                            display:'inline-block', fontSize:9, fontWeight:700,
                            letterSpacing:'.08em', padding:'2px 7px', borderRadius:3,
                            background: isOut ? 'rgba(255,87,87,.1)' : 'rgba(0,255,136,.1)',
                            color: isOut ? 'var(--red)' : 'var(--green)',
                            border: `1px solid ${isOut ? 'rgba(255,87,87,.25)' : 'rgba(0,255,136,.25)'}`,
                          }}>{isOut ? 'OUT' : 'IN'}</span>
                        </td>
                        <td>
                          <Link to={'/address/' + tx.from_address} className="addr-link">
                            <span className="addr-cell">{shortAddr(tx.from_address)}</span>
                          </Link>
                        </td>
                        <td>
                          <Link to={'/address/' + tx.to_address} className="addr-link">
                            <span className="addr-cell">{shortAddr(tx.to_address)}</span>
                          </Link>
                        </td>
                        <td style={{ textAlign:'right', color: tx.value === '0' ? 'var(--text-3)' : 'var(--text)' }}>
                          {fmtVal(tx.value)}
                        </td>
                        <td style={{ textAlign:'right' }}>
                          {tx.status === 1   && <span className="badge badge-ok">OK</span>}
                          {tx.status === 0   && <span className="badge badge-fail">Fail</span>}
                          {tx.status == null && <span className="badge badge-pend">—</span>}
                        </td>
                        <td style={{ textAlign:'right', color:'var(--text-3)' }}>
                          <span style={{ display:'inline-block', minWidth:74, textAlign:'right' }}>
                            {timeAgo(tx.block_timestamp)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                              gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)' }}>
                  <button onClick={() => load(page - 1)} disabled={page <= 1}
                    style={pagerStyle(page <= 1)}>← Prev</button>
                  <span style={{ fontSize:10, color:'var(--text-3)', letterSpacing:'.1em',
                                 textTransform:'uppercase' }}>
                    Page {page} / {totalPages}
                  </span>
                  <button onClick={() => load(page + 1)} disabled={page >= totalPages}
                    style={pagerStyle(page >= totalPages)}>Next →</button>
                </div>
              )}
            </>
          )
        }
      </div>
    </div>
  );
}

const pagerStyle = (disabled) => ({
  background: 'none',
  border: '1px solid var(--border-hi)',
  borderRadius: 6,
  color: disabled ? 'var(--text-3)' : 'var(--text-2)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.1em',
  padding: '4px 12px',
  textTransform: 'uppercase',
  opacity: disabled ? 0.4 : 1,
});

