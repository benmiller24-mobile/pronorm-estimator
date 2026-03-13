import React, { useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const FONT = "'DM Sans',system-ui,sans-serif";
const SERIF = "'Cormorant Garamond','Georgia',serif";
const C = {
  bg: '#f7f6f3', card: '#fff', dark: '#191919', gold: '#b08d4c',
  goldMuted: 'rgba(176,141,76,.12)', border: '#e4e1dc',
  textPri: '#191919', textSec: '#8a8580', danger: '#c24040',
};

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, background: C.bg,
    }}>
      <div style={{
        width: 380, background: C.card, borderRadius: 12,
        border: `1px solid ${C.border}`, padding: 40,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', color: C.dark }}>
            pronorm
          </div>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>Dealer Estimator</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '10px 12px', fontSize: 14, fontFamily: FONT,
                color: C.textPri, outline: 'none',
              }}
              placeholder="dealer@company.com"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '10px 12px', fontSize: 14, fontFamily: FONT,
                color: C.textPri, outline: 'none',
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              fontSize: 13, color: C.danger, background: 'rgba(194,64,64,0.06)',
              padding: '8px 12px', borderRadius: 6, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', border: 'none', borderRadius: 6, padding: '12px',
              fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: loading ? 'wait' : 'pointer',
              background: C.gold, color: '#fff', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ fontSize: 11, color: C.textSec, textAlign: 'center', marginTop: 24 }}>
          Contact your administrator for account access
        </div>
      </div>
    </div>
  );
}
