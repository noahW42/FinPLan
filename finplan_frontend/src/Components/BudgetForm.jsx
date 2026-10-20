import { useState } from 'react';
import { apiPost } from '../api';

function BudgetForm({ onSaved }) {
  const [scope, setScope] = useState('total');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await apiPost('/budgets', {
        vendor: scope === 'vendor' ? vendor.trim() : null,
        amount_dollars: parseFloat(amount),
      });
      onSaved(data);
      setAmount('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        <input type="radio" checked={scope === 'total'} onChange={() => setScope('total')} />
        Total spending
      </label>
      <label>
        <input type="radio" checked={scope === 'vendor'} onChange={() => setScope('vendor')} />
        By vendor
      </label>

      {scope === 'vendor' && (
        <input
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Vendor name (e.g. Starbucks)"
          required
        />
      )}

      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Monthly budget ($)"
        required
      />

      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save budget'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}

export default BudgetForm;