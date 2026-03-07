import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TransactionList from '../components/TransactionList';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString());

export default function Address() {
  const { address } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(API + '/api/addresses/' + address)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [address]);

  if (!data) return <div className="empty">Loading address&hellip;</div>;

  return (
    <div>
      <div className="addr-full">{address}</div>
      <div className="addr-card">
        <div className="addr-stat">
          <div className="metric-label">Transactions</div>
          <div className="metric-value blue">{fmtNum(data.transaction_count)}</div>
        </div>
        <div className="addr-stat">
          <div className="metric-label">First Seen</div>
          <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-2)' }}>
            {data.first_seen ? new Date(data.first_seen).toLocaleDateString() : '—'}
          </div>
        </div>
        <div className="addr-stat">
          <div className="metric-label">Last Active</div>
          <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-2)' }}>
            {data.last_seen ? new Date(data.last_seen).toLocaleDateString() : '—'}
          </div>
        </div>
      </div>

      {data.recentTransactions && data.recentTransactions.length > 0 && (
        <div>
          <div className="page-head" style={{ marginTop: 20 }}>
            <span className="page-title">Recent Transactions</span>
          </div>
          <div className="panel">
            <TransactionList transactions={data.recentTransactions} />
          </div>
        </div>
      )}
    </div>
  );
}
