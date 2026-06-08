import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../lib/auth.js';
import { PageHeader, SectionTitle, Alert, KbHint } from '../components/ui.js';
import { useToastFn } from '../hooks/useToastContext.js';

interface PlayerMe {
  id: number; name: string; race: number; mode: number;
  alertness: number; securityLevel: number; empireRelation: number; turn: number;
}

const RACE_NAMES = ['Human', 'Targoid', 'Buckaneer', 'Tecanoid', 'Evintos', 'Agerus', 'Bosalian', 'Xeloss'];

const HOTKEYS = [
  ['E', '/'],         ['T', '/tech'],    ['S', '/ships'],
  ['W', '/warfare'],  ['Y', '/spy'],     ['P', '/projects'],
  ['D', '/diplomacy'],['C', '/council'], ['B', '/battles'],
  ['I', '/info'],     ['M', '/blackmarket'], ['R', '/prefs'],
];

export function PreferencesPage() {
  const { player } = useAuthStore();
  const toast = useToastFn();
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [formError, setFormError] = useState('');

  const { data } = useQuery({
    queryKey: ['player-me'],
    queryFn: () => api.get<{ data: PlayerMe }>('/player/me'),
  });

  const changePassword = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', body),
    onSuccess: () => {
      toast('Password changed successfully.', 'success');
      setPasswordForm({ current: '', next: '', confirm: '' });
      setFormError('');
    },
    onError: () => setFormError('Incorrect current password.'),
  });

  const me = data?.data;

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (passwordForm.next !== passwordForm.confirm) { setFormError('Passwords do not match.'); return; }
    if (passwordForm.next.length < 8) { setFormError('Minimum 8 characters.'); return; }
    changePassword.mutate({ currentPassword: passwordForm.current, newPassword: passwordForm.next });
  };

  return (
    <div>
      <PageHeader title="Preferences" subtitle="Account settings and game configuration." />

      <div className="grid-2 gap-16">
        <div className="flex-col gap-16">
          <div className="card">
            <SectionTitle>Commander Profile</SectionTitle>
            <table className="data-table">
              <tbody>
                <tr><td className="text-muted text-xs uppercase">Username</td><td className="text-bright">{player?.name ?? '—'}</td></tr>
                <tr><td className="text-muted text-xs uppercase">Player ID</td><td className="num">{me?.id ?? '—'}</td></tr>
                <tr><td className="text-muted text-xs uppercase">Race</td><td>{RACE_NAMES[me?.race ?? 0] ?? '—'}</td></tr>
                <tr><td className="text-muted text-xs uppercase">Turns Played</td><td className="num">{me?.turn ?? '—'}</td></tr>
                <tr><td className="text-muted text-xs uppercase">Empire Relation</td><td className="num">{me?.empireRelation ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <SectionTitle>Change Access Code</SectionTitle>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <form onSubmit={handlePwSubmit}>
              <div className="field">
                <label>Current Password</label>
                <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))} required />
              </div>
              <div className="field">
                <label>New Password</label>
                <input type="password" value={passwordForm.next} onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))} minLength={8} required />
              </div>
              <div className="field">
                <label>Confirm New Password</label>
                <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))} required />
              </div>
              <button type="submit" className="btn btn--primary btn--full" disabled={changePassword.isPending}>
                {changePassword.isPending ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

        <div className="flex-col gap-16">
          <div className="card">
            <SectionTitle>Keyboard Shortcuts</SectionTitle>
            <p className="text-sm text-muted mb-12">Press these keys (when not in an input) to navigate instantly.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {HOTKEYS.map(([key, route]) => (
                <div key={key} className="flex-center gap-8" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <KbHint k={key} label={route} />
                </div>
              ))}
            </div>
          </div>

          <div className="card card--sm">
            <SectionTitle>Game Settings</SectionTitle>
            <p className="text-sm text-muted mb-4">Spy alertness &amp; security — <a href="/spy">Espionage page</a></p>
            <p className="text-sm text-muted mb-4">Planet build ratios — <a href="/">Empire page</a></p>
            <p className="text-sm text-muted">Fleet missions — <a href="/ships">Ship Designer page</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
