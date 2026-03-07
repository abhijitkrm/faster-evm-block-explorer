import { Link } from 'react-router-dom';

const timeAgo = (ts) => {
  const s = Math.floor(Date.now() / 1000) - parseInt(ts);
  if (s < 60)   return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  return Math.floor(s / 3600) + 'h ago';
};
const shortAddr = (a) => a ? a.slice(0,6) + '\u2026' + a.slice(-4) : '';

export default function BlockList({ blocks }) {
  if (!blocks || blocks.length === 0) return <div className="empty">No blocks</div>;
  return (
    <table className="dt">
      <thead><tr>
        <th>Block</th><th>Hash</th><th>Miner</th>
        <th style={{textAlign:'right'}}>Txns</th>
        <th style={{textAlign:'right'}}>Gas Used</th>
        <th style={{textAlign:'right'}}>Age</th>
      </tr></thead>
      <tbody>
        {blocks.map(b => (
          <tr key={b.hash}>
            <td><Link to="/blocks" className="num-link">#{Number(b.number).toLocaleString()}</Link></td>
            <td style={{color:'var(--text-3)',fontSize:11}}><span className="hash-cell">{b.hash}</span></td>
            <td>
              <Link to={'/address/' + b.miner} className="addr-link">
                <span className="addr-cell">{shortAddr(b.miner)}</span>
              </Link>
            </td>
            <td style={{textAlign:'right',color: b.transactions_count > 0 ? 'var(--green)' : 'var(--text-3)'}}>{b.transactions_count}</td>
            <td style={{textAlign:'right',color:'var(--text-2)'}}>{Number(b.gas_used).toLocaleString()}</td>
            <td style={{textAlign:'right',color:'var(--text-3)'}}>{timeAgo(b.timestamp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
