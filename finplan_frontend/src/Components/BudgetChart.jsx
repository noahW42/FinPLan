import { useState, useEffect } from 'react';
import { apiGet } from '../api';

const TIMESPANS = [
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All' },
];

function BudgetChart({ vendor = null }) {
  const [timespan, setTimespan] = useState('6m');
  const [points, setPoints] = useState([]);

  useEffect(() => {
    const load = async () => {
      const params = new URLSearchParams({ timespan });
      if (vendor) params.set('vendor', vendor);
      const data = await apiGet(`/budget_progress?${params}`);
      setPoints(data.points);
    };
    load();
  }, [timespan, vendor]);

  if (points.length === 0) return <p>Loading…</p>;

  const width = 600;
  const height = 300;
  const padding = 40;
  const maxValue = Math.max(...points.map((p) => Math.max(p.spent, p.budget)), 1);
  const xStep = (width - padding * 2) / Math.max(points.length - 1, 1);
  const toY = (v) => height - padding - (v / maxValue) * (height - padding * 2);
  const toX = (i) => padding + i * xStep;
  const linePath = (key) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p[key])}`).join(' ');

  return (
    <div>
      <div>
        {TIMESPANS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTimespan(t.key)}
            style={{ fontWeight: timespan === t.key ? 'bold' : 'normal' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <svg width={width} height={height}>
        <path d={linePath('budget')} fill="none" stroke="gray" strokeDasharray="4" strokeWidth="2" />
        <path d={linePath('spent')} fill="none" stroke="steelblue" strokeWidth="2" />
        {points.map((p, i) => (
          <text key={p.month} x={toX(i)} y={height - 10} fontSize="10" textAnchor="middle">
            {p.month.slice(5)}
          </text>
        ))}
      </svg>

      <p>
        <span style={{ color: 'steelblue' }}>■</span> Spent{' '}
        <span style={{ color: 'gray' }}>■</span> Budget
      </p>
    </div>
  );
}

export default BudgetChart;