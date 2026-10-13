import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { apiPost } from './api';

function PlaidConnect({ onAccountLinked, buttonText = "+ Connect a Bank Account", className = "" }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLinkToken = useCallback(async () => {
    try {
      setError(null);
      const data = await apiPost('/create_link_token', {});
      setLinkToken(data.link_token);
    } catch (err) {
      setError(err.message || 'Failed to initialize Plaid');
    }
  }, []);

  useEffect(() => {
    fetchLinkToken();
  }, [fetchLinkToken]);

  const onSuccess = useCallback(
    async (public_token, metadata) => {
      setLoading(true);
      setError(null);
      try {
        const institutionName = metadata?.institution?.name || 'Connected Bank';
        await apiPost('/exchange_public_token', {
          public_token,
          institution_name: institutionName,
        });
        if (onAccountLinked) {
          onAccountLinked();
        }
        // Fetch fresh token for next connect
        fetchLinkToken();
      } catch (err) {
        setError(err.message || 'Failed to link account');
      } finally {
        setLoading(false);
      }
    },
    [onAccountLinked, fetchLinkToken]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        onClick={() => open()}
        disabled={!ready || loading}
        className={className}
        style={{
          backgroundColor: '#2563eb',
          color: '#ffffff',
          border: 'none',
          padding: '10px 18px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: ready && !loading ? 'pointer' : 'not-allowed',
          opacity: ready && !loading ? 1 : 0.7,
          transition: 'background-color 0.2s',
        }}
      >
        {loading ? 'Connecting...' : !ready ? 'Initializing...' : buttonText}
      </button>
      {error && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>{error}</p>}
    </div>
  );
}

export default PlaidConnect;