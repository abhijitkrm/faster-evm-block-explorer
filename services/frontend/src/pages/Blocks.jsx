import { useEffect, useState } from 'react';
import BlockList from '../components/BlockList';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Blocks() {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  const load = async () => {
    try { setBlocks(await (await fetch(API + '/api/blocks?limit=50')).json()); } catch {}
  };

  return (
    <div>
      <div className="page-head">
        <span className="page-title">Blocks</span>
        <span className="page-count">{blocks.length} shown</span>
      </div>
      <div className="panel">
        <BlockList blocks={blocks} />
      </div>
    </div>
  );
}
