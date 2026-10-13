import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiDelete, apiPost } from './api';
import PlaidConnect from './PlaidConnect';

function AccountManager({ onAccountsChanged }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/accounts');
      setAccounts(res.accounts || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch connected accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAccountLinked = async () => {
    setSuccessMsg('Bank account linked successfully!');
    setTimeout(() => setSuccessMsg(null), 4000);
    await fetchAccounts();
    if (onAccountsChanged) {
      onAccountsChanged();
    }
  };

  const handleDisconnect = async (accountId, institutionName) => {
    const confirmed = window.confirm(
      `Are you sure you want to disconnect ${institutionName}? Associated transactions will be removed.`
    );
    if (!confirmed) return;

    setActionLoadingId(accountId);
    setError(null);
    try {
      await apiDelete(`/accounts/${accountId}`);
      setSuccessMsg(`Disconnected ${institutionName}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await fetchAccounts();
      if (onAccountsChanged) {
        onAccountsChanged();
      }
    } catch (err) {
      setError(err.message || 'Failed to disconnect account');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setError(null);
    try {
      await apiPost('/sync_transactions', {});
      setSuccessMsg('Transactions synced successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
      await fetchAccounts();
      if (onAccountsChanged) {
        onAccountsChanged();
      }
    } catch (err) {
      setError(err.message || 'Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#1e293b' }}>Connected Accounts</h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Manage your linked financial institutions and Plaid data connections
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {accounts.length > 0 && (
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              style={{
                padding: '9px 14px',
                backgroundColor: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: syncing ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '13px',
              }}
            >
              {syncing ? 'Syncing...' : 'Sync All'}
            </button>
          )}
          <PlaidConnect onAccountLinked={handleAccountLinked} buttonText="+ Connect New Bank" />
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {successMsg}
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>
          Loading connected accounts...
        </div>
      ) : accounts.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏦</div>
          <h4 style={{ margin: '0 0 6px 0', color: '#334155', fontSize: '16px' }}>No Bank Accounts Connected</h4>
          <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px' }}>
            Link your bank or credit card accounts using Plaid to begin tracking your spending by vendor.
          </p>
          <PlaidConnect onAccountLinked={handleAccountLinked} buttonText="Connect Your First Bank" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {accounts.map((acc) => (
            <div
              key={acc.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                  }}
                >
                  🏛️
                </div>
                <div>
                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '15px' }}>
                    {acc.institution_name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    {acc.transaction_count} transactions recorded &bull; ID: #{acc.id}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    backgroundColor: acc.status === 'active' ? '#ecfdf5' : '#fef2f2',
                    color: acc.status === 'active' ? '#047857' : '#b91c1c',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                  }}
                >
                  {acc.status}
                </span>

                <button
                  onClick={() => handleDisconnect(acc.id, acc.institution_name)}
                  disabled={actionLoadingId === acc.id}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    color: '#ef4444',
                    backgroundColor: 'transparent',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    cursor: actionLoadingId === acc.id ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                  }}
                >
                  {actionLoadingId === acc.id ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AccountManager;
