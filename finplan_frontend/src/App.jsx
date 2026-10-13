import { useState, useEffect } from 'react';
import Login from './Components/Login';
import Signup from './Components/signup';
import VendorSpending from './Components/VendorSpending';
import AccountManager from './Components/AccountManager';
import { apiGet, apiPost } from './Components/api';

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [activeTab, setActiveTab] = useState('spending'); // 'spending' | 'accounts'
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await apiGet('/me');
        setUser(data);
      } catch {
        setUser(null);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await apiPost('/logout_user', {});
    } catch (e) {
      console.error('Logout error:', e);
    }
    setUser(null);
  };

  const handleAuthSuccess = (userData) => {
    // Ensure email is present
    setUser(userData);
  };

  if (checkingSession) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#64748b' }}>
        Loading Finance Planner...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold',
            }}
          >
            $
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', textAlign: 'left' }}>
              FinPlan
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', textAlign: 'left' }}>
              Smart Budgeting &amp; Vendor Analytics
            </p>
          </div>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#475569' }}>
              👤 <strong>{user.email || 'User'}</strong>
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                color: '#64748b',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '32px 20px', boxSizing: 'border-box' }}>
        {user ? (
          <div>
            {/* Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '2px solid #e2e8f0',
                marginBottom: '24px',
              }}
            >
              <button
                onClick={() => setActiveTab('spending')}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: 'none',
                  fontSize: '15px',
                  fontWeight: activeTab === 'spending' ? '600' : '500',
                  color: activeTab === 'spending' ? '#2563eb' : '#64748b',
                  borderBottom: activeTab === 'spending' ? '2px solid #2563eb' : '2px solid transparent',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                📊 Vendor Spending
              </button>

              <button
                onClick={() => setActiveTab('accounts')}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: 'none',
                  fontSize: '15px',
                  fontWeight: activeTab === 'accounts' ? '600' : '500',
                  color: activeTab === 'accounts' ? '#2563eb' : '#64748b',
                  borderBottom: activeTab === 'accounts' ? '2px solid #2563eb' : '2px solid transparent',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🏦 Manage Accounts
              </button>
            </div>

            {/* Active Tab View */}
            {activeTab === 'spending' && (
              <VendorSpending key={refreshKey} />
            )}

            {activeTab === 'accounts' && (
              <AccountManager
                onAccountsChanged={() => setRefreshKey((k) => k + 1)}
              />
            )}
          </div>
        ) : (
          <div style={{ marginTop: '40px' }}>
            {showSignup ? (
              <>
                <Signup onSignupSuccess={handleAuthSuccess} />
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    onClick={() => setShowSignup(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: '14px',
                      textDecoration: 'underline',
                    }}
                  >
                    Already have an account? Log in
                  </button>
                </div>
              </>
            ) : (
              <>
                <Login onLoginSuccess={handleAuthSuccess} />
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    onClick={() => setShowSignup(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: '14px',
                      textDecoration: 'underline',
                    }}
                  >
                    Need an account? Sign up
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;