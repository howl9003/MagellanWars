import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuthStore } from '../lib/auth.js';
import type { LoginResponse, ApiResponse } from '@magellanwars/shared';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', { username, password });
      login(res.data.token, res.data.player);
      void navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.4em', color: 'var(--accent)', textShadow: 'var(--accent-glow)', textTransform: 'uppercase', marginBottom: 8 }}>
            ◈ Vibespace ◈
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
            GALACTIC COMMAND INTERFACE v2.0
          </div>
        </div>

        <div className="card card--glow" style={{ padding: '24px 28px' }}>
          <div className="section-title" style={{ marginBottom: 20 }}>Authentication Required</div>

          {error && <div className="alert alert--danger">{error}</div>}

          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label>Commander ID</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoComplete="username" required autoFocus />
            </div>
            <div className="field">
              <label>Access Code</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            </div>
            <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? '[ AUTHENTICATING... ]' : '[ ENGAGE ]'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
          SECURE CHANNEL · ENCRYPTED UPLINK · 256-BIT
        </div>
      </div>
    </div>
  );
}
