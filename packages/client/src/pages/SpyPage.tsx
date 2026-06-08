import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface SpyOp {
  id: number; name: string; difficulty: number; cost: number;
  type: string; prereqs: number[]; description: string; available: boolean;
}
interface Settings { alertness: number; securityLevel: number }

const OP_TYPE_COLOR: Record<string, string> = {
  ACPT: '#22c55e',
  ORDN: '#3b82f6',
  HOST: '#f59e0b',
  ATRO: '#ef4444',
};

export function SpyPage() {
  const [targetId, setTargetId] = useState('');
  const [selectedOp, setSelectedOp] = useState<number | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [alertness, setAlertness] = useState<number | null>(null);
  const [security, setSecurity] = useState<number | null>(null);

  const { data: opsData } = useQuery({ queryKey: ['spy-ops'], queryFn: () => api.get<{ data: SpyOp[] }>('/spy/ops') });
  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ['spy-settings'],
    queryFn: () => api.get<{ data: Settings }>('/spy/settings'),
  });

  const updateAlertness = useMutation({
    mutationFn: (v: number) => api.put('/spy/settings/alertness', { alertness: v }),
    onSuccess: () => { void refetchSettings(); },
  });
  const updateSecurity = useMutation({
    mutationFn: (v: number) => api.put('/spy/settings/security', { securityLevel: v }),
    onSuccess: () => { void refetchSettings(); },
  });

  const launch = useMutation({
    mutationFn: ({ opId, targetId: tid }: { opId: number; targetId: number }) =>
      api.post<{ data: Record<string, unknown> }>('/spy/launch', { opId, targetId: tid }),
    onSuccess: (data) => setResult(data.data),
  });

  const ops = opsData?.data ?? [];
  const settings = settingsData?.data;

  return (
    <div>
      <h1>Espionage</h1>

      {settings && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, padding: 16, border: '1px solid #1f2d45', borderRadius: 4 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>Alertness (spy power): {alertness ?? settings.alertness}</label>
            <input type="range" min={0} max={10} value={alertness ?? settings.alertness}
              onChange={(e) => setAlertness(Number(e.target.value))} style={{ width: '100%' }} />
            <button onClick={() => alertness !== null && updateAlertness.mutate(alertness)}
              style={{ marginTop: 4, padding: '2px 12px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>Save</button>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>Security Level (defense): {security ?? settings.securityLevel}</label>
            <input type="range" min={0} max={10} value={security ?? settings.securityLevel}
              onChange={(e) => setSecurity(Number(e.target.value))} style={{ width: '100%' }} />
            <button onClick={() => security !== null && updateSecurity.mutate(security)}
              style={{ marginTop: 4, padding: '2px 12px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label>Target Player ID:
          <input type="number" value={targetId} onChange={(e) => setTargetId(e.target.value)}
            style={{ marginLeft: 8, width: 120 }} placeholder="Player ID" />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {ops.map((op) => (
          <div key={op.id} style={{
            padding: 16, border: `1px solid ${selectedOp === op.id ? '#3b82f6' : '#1f2d45'}`,
            borderRadius: 4, opacity: op.available ? 1 : 0.5, cursor: op.available ? 'pointer' : 'default',
          }} onClick={() => op.available && setSelectedOp(op.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <strong>{op.name}</strong>
              <span style={{ color: OP_TYPE_COLOR[op.type] ?? '#94a3b8', fontSize: 12 }}>{op.type}</span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0' }}>{op.description}</p>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
              <span>Cost: {op.cost.toLocaleString()}</span>
              <span>Difficulty: {op.difficulty}</span>
            </div>
            {!op.available && <p style={{ color: '#7f1d1d', fontSize: 11, marginTop: 4 }}>Locked (missing tech)</p>}
          </div>
        ))}
      </div>

      {selectedOp !== null && (
        <div style={{ marginTop: 16, padding: 16, border: '1px solid #1e3a5f', borderRadius: 4 }}>
          <h3>Launch: {ops.find((o) => o.id === selectedOp)?.name}</h3>
          <button
            disabled={!targetId || launch.isPending}
            onClick={() => launch.mutate({ opId: selectedOp, targetId: Number(targetId) })}
            style={{ padding: '6px 24px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}
          >
            {launch.isPending ? 'Launching...' : 'Launch Operation'}
          </button>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: 16, border: `1px solid ${result['success'] ? '#14532d' : '#7f1d1d'}`, borderRadius: 4 }}>
          <h3 style={{ color: result['success'] ? '#22c55e' : '#ef4444' }}>
            {result['success'] ? 'Operation Successful' : 'Operation Failed'}
            {result['detected'] ? ' — DETECTED' : ''}
          </h3>
          <pre style={{ color: '#94a3b8', fontSize: 12, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>
          <button onClick={() => setResult(null)} style={{ padding: '2px 12px', background: 'transparent', border: '1px solid #1f2d45', color: '#94a3b8', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
