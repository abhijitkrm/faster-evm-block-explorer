import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Blocks from './pages/Blocks';
import Transactions from './pages/Transactions';
import Address from './pages/Address';
import { useWS } from './context/WSContext';

const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString());

export default function App() {
  const { wsOk, stats } = useWS();
  const location = useLocation();

  const va = (p) => location.pathname === p ? ' active' : '';

  return (
    <div className="app-wrapper">
      <header className="site-header">
        <div className="container">
          <div className="header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Link to="/" className="logo">
                <span className="logo-hex">&#x2B21;</span>
                EVM Explorer
              </Link>
              <span className="live-pill">
                <span className="live-dot" style={{ background: wsOk ? 'var(--accent)' : 'var(--text-3)' }} />
                {wsOk ? 'LIVE' : 'CONNECTING'}
              </span>
            </div>
            <nav className="nav">
              <Link to="/"             className={'nav-link' + va('/')}>Home</Link>
              <Link to="/blocks"       className={'nav-link' + va('/blocks')}>Blocks</Link>
              <Link to="/transactions" className={'nav-link' + va('/transactions')}>Txns</Link>
            </nav>
          </div>
        </div>
      </header>

      {stats && (
        <div className="metrics-bar">
          <div className="container">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Block Height</div>
                <div className="metric-value blue">{fmtNum(stats.block_height)}</div>
                <div className="metric-sub">Latest indexed</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Avg Block Time</div>
                <div className="metric-value green">
                  {stats.avg_block_time ? stats.avg_block_time + 's' : '—'}
                </div>
                <div className="metric-sub">Last 100 blocks</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">TPS</div>
                <div className="metric-value purple">{stats.tps ?? '0.00'}</div>
                <div className="metric-sub">Transactions / sec</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Total Blocks</div>
                <div className="metric-value">{fmtNum(stats.total_blocks)}</div>
                <div className="metric-sub">Indexed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="container">
          <Routes>
            <Route path="/"                 element={<Home />} />
            <Route path="/blocks"           element={<Blocks />} />
            <Route path="/transactions"     element={<Transactions />} />
            <Route path="/address/:address" element={<Address />} />
          </Routes>
        </div>
      </main>

      <footer className="site-footer">
        EVM Block Explorer &nbsp;&middot;&nbsp; Real-time indexed data
      </footer>
    </div>
  );
}

