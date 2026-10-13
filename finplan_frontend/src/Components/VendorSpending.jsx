import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from './api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import './VendorSpending.css';

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const TIME_OPTIONS = [
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 90 Days', value: 90 },
  { label: 'Last 180 Days', value: 180 },
  { label: 'All Time', value: 0 },
];

const VIEW_MODES = [
  { label: 'Bar View', value: 'bar' },
  { label: 'Pie View', value: 'pie' },
];

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};

const formatDollars = (val) => [`$${Number(val).toFixed(2)}`, 'Total Spent'];
const cx = (...classes) => classes.filter(Boolean).join(' ');

function VendorSpending() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState({
    days: 30,
    total_spent_cents: 0,
    total_spent_dollars: 0,
    vendors: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('bar');

  const fetchSpending = useCallback(async (timeframeDays) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet(`/analytics/spending_by_vendor?days=${timeframeDays}`);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load spending data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpending(days);
  }, [days, fetchSpending]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await apiPost('/sync_transactions', {});
      await fetchSpending(days);
    } catch (err) {
      setError(err.message || 'Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  // Top 10 vendors for cleaner chart rendering
  const chartData = data.vendors.slice(0, 10).map((v) => ({
    name: v.merchant_name.length > 14 ? `${v.merchant_name.substring(0, 14)}...` : v.merchant_name,
    fullName: v.merchant_name,
    amount: v.total_dollars,
    count: v.transaction_count,
    percentage: v.percentage,
  }));

  const topVendor = data.vendors[0] ?? null;
  const vendorCount = data.vendors.length;

  const cells = chartData.map((_, i) => (
    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
  ));

  return (
    <div className="vs-card">
      {/* Header */}
      <div className="vs-header">
        <div>
          <h2 className="vs-title">Vendor Spending Breakdown</h2>
          <p className="vs-subtitle">Tracking total spent categorized by vendor over time</p>
        </div>
        <button className="vs-sync-btn" onClick={handleSync} disabled={syncing}>
          {syncing ? '🔄 Syncing with Plaid...' : '🔄 Sync Transactions'}
        </button>
      </div>

      {/* Time filter */}
      <div className="vs-filters">
        {TIME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={cx('vs-pill', days === opt.value && 'is-active')}
            onClick={() => setDays(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <div className="vs-error">{error}</div>}

      {/* Metrics */}
      <div className="vs-metrics">
        <div className="vs-metric">
          <div className="vs-metric-label">Total Spent</div>
          <div className="vs-metric-value">
            ${data.total_spent_dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="vs-metric-note">
            Across {vendorCount} {vendorCount === 1 ? 'vendor' : 'vendors'}
          </div>
        </div>

        <div className="vs-metric">
          <div className="vs-metric-label">Top Vendor</div>
          <div className="vs-metric-value vs-metric-value--text">
            {topVendor ? topVendor.merchant_name : 'N/A'}
          </div>
          <div className="vs-metric-note">
            {topVendor
              ? `$${topVendor.total_dollars.toFixed(2)} (${topVendor.percentage}% of total)`
              : 'No transactions'}
          </div>
        </div>

        <div className="vs-metric">
          <div className="vs-metric-label">Active Vendors</div>
          <div className="vs-metric-value">{vendorCount}</div>
          <div className="vs-metric-note">In selected period</div>
        </div>
      </div>

      {/* Chart + list */}
      {loading ? (
        <div className="vs-loading">Loading spending breakdown...</div>
      ) : vendorCount === 0 ? (
        <div className="vs-empty">
          <p className="vs-empty-title">No transaction data found for this time period.</p>
          <p className="vs-empty-text">
            Connect a bank account below or click &quot;Sync Transactions&quot; to fetch your latest records.
          </p>
        </div>
      ) : (
        <>
          <div className="vs-view-toggle">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.value}
                className={cx('vs-toggle-btn', viewMode === mode.value && 'is-active')}
                onClick={() => setViewMode(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="vs-chart">
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(val) => `$${val}`}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={formatDollars}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                    contentStyle={{ ...TOOLTIP_STYLE, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {cells}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="amount"
                    nameKey="fullName"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={60}
                    paddingAngle={3}
                    label={(entry) => `${entry.name} ($${entry.amount.toFixed(0)})`}
                  >
                    {cells}
                  </Pie>
                  <Tooltip formatter={formatDollars} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="vs-list">
            <h3 className="vs-list-title">All Vendors ({vendorCount})</h3>
            <div className="vs-table">
              <div className="vs-row vs-row--head">
                <div>Vendor</div>
                <div>Total Spent</div>
                <div>Share</div>
                <div>Transactions</div>
              </div>
              <div className="vs-rows">
                {data.vendors.map((v, i) => (
                  <div key={v.merchant_name + i} className="vs-row vs-row--item">
                    <div className="vs-vendor">
                      <span
                        className="vs-dot"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="vs-vendor-name">{v.merchant_name}</span>
                    </div>
                    <div className="vs-amount">${v.total_dollars.toFixed(2)}</div>
                    <div className="vs-muted">{v.percentage}%</div>
                    <div className="vs-muted">{v.transaction_count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default VendorSpending;