import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface ShipClass { index: number; name: string; baseHp: number }
interface Component { id: number; name: string; type: string; [key: string]: unknown }
interface Design {
  id: number; name: string; shipClass: number;
  armorId: number; computerId: number; shieldId: number; engineId: number;
  deviceIds: string; weaponSlots: string;
}
interface QueueEntry { id: number; designId: number; count: number; turnsLeft: number; design: Design }
interface DockedShip { id: number; designId: number; count: number; design: Design }

function sectionStyle(): React.CSSProperties {
  return { padding: 16, border: '1px solid #1f2d45', borderRadius: 4, marginBottom: 16 };
}

export function ShipDesignerPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'designs' | 'build' | 'pool'>('designs');
  const [editing, setEditing] = useState<Partial<Design> | null>(null);
  const [buildForm, setBuildForm] = useState({ designId: 0, count: 1, planetId: 0 });

  const { data: classData } = useQuery({ queryKey: ['ship-classes'], queryFn: () => api.get<{ data: ShipClass[] }>('/ship/classes') });
  const { data: compData } = useQuery({ queryKey: ['components'], queryFn: () => api.get<{ data: Record<string, Component> }>('/ship/components') });
  const { data: designData } = useQuery({ queryKey: ['ship-designs'], queryFn: () => api.get<{ data: Design[] }>('/ship/designs') });
  const { data: queueData } = useQuery({ queryKey: ['ship-queue'], queryFn: () => api.get<{ data: QueueEntry[] }>('/ship/queue') });
  const { data: poolData } = useQuery({ queryKey: ['ship-pool'], queryFn: () => api.get<{ data: DockedShip[] }>('/ship/pool') });

  const saveDesign = useMutation({
    mutationFn: (body: Partial<Design>) =>
      body.id
        ? api.put(`/ship/designs/${body.id}`, body)
        : api.post('/ship/designs', body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['ship-designs'] }); setEditing(null); },
  });

  const deleteDesign = useMutation({
    mutationFn: (id: number) => api.put(`/ship/designs/${id}`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ship-designs'] }),
  });

  const addToQueue = useMutation({
    mutationFn: (b: typeof buildForm) => api.post('/ship/queue', b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ship-queue'] }),
  });

  const cancelQueue = useMutation({
    mutationFn: (id: number) => fetch(`/api/ship/queue/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ship-queue'] }),
  });

  const classes = classData?.data ?? [];
  const designs = designData?.data ?? [];
  const queue = queueData?.data ?? [];
  const pool = poolData?.data ?? [];
  const components = compData?.data ?? {};
  const armors = Object.values(components).filter((c) => c.type === 'armor');
  const computers = Object.values(components).filter((c) => c.type === 'computer');
  const engines = Object.values(components).filter((c) => c.type === 'engine');
  const weapons = Object.values(components).filter((c) => ['beam', 'missile', 'projectile'].includes(c.type));

  const tabBtn = (t: typeof tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{ padding: '4px 16px', background: tab === t ? '#1e3a5f' : 'transparent', border: '1px solid #1f2d45', color: '#e2e8f0', cursor: 'pointer' }}
    >{label}</button>
  );

  return (
    <div>
      <h1>Ship Designer</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabBtn('designs', 'Designs')}
        {tabBtn('build', 'Build Queue')}
        {tabBtn('pool', 'Ship Pool')}
      </div>

      {tab === 'designs' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setEditing({})} style={{ padding: '4px 16px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>
              + New Design
            </button>
          </div>
          {editing !== null && (
            <div style={sectionStyle()}>
              <h3>{editing.id ? 'Edit Design' : 'New Design'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>Name
                  <input value={editing.name ?? ''} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} style={{ width: '100%' }} />
                </label>
                <label>Class
                  <select value={editing.shipClass ?? 0} onChange={(e) => setEditing((p) => ({ ...p, shipClass: Number(e.target.value) }))} style={{ width: '100%' }}>
                    {classes.map((c) => <option key={c.index} value={c.index}>{c.name} (HP {c.baseHp})</option>)}
                  </select>
                </label>
                <label>Armor
                  <select value={editing.armorId ?? ''} onChange={(e) => setEditing((p) => ({ ...p, armorId: Number(e.target.value) }))} style={{ width: '100%' }}>
                    <option value="">-- select --</option>
                    {armors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <label>Computer
                  <select value={editing.computerId ?? ''} onChange={(e) => setEditing((p) => ({ ...p, computerId: Number(e.target.value) }))} style={{ width: '100%' }}>
                    <option value="">-- select --</option>
                    {computers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>Engine
                  <select value={editing.engineId ?? ''} onChange={(e) => setEditing((p) => ({ ...p, engineId: Number(e.target.value) }))} style={{ width: '100%' }}>
                    <option value="">-- select --</option>
                    {engines.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ marginTop: 12 }}>
                <h4>Weapons</h4>
                <p style={{ color: '#94a3b8', fontSize: 12 }}>Weapon slots configured in JSON: {editing.weaponSlots ?? '[]'}</p>
                <textarea
                  value={editing.weaponSlots ?? '[]'}
                  onChange={(e) => setEditing((p) => ({ ...p, weaponSlots: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', fontFamily: 'monospace' }}
                  placeholder='[{"weaponId":6101,"count":2}]'
                />
                <p style={{ color: '#64748b', fontSize: 11 }}>Weapon IDs: {weapons.map((w) => `${w.id}=${w.name}`).join(', ')}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => saveDesign.mutate({ ...editing, weaponSlots: editing.weaponSlots ?? '[]', deviceIds: '[]' })} style={{ padding: '4px 16px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ padding: '4px 16px', background: 'transparent', border: '1px solid #1f2d45', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {designs.map((d) => (
              <div key={d.id} style={sectionStyle()}>
                <strong>{d.name}</strong>
                <p style={{ color: '#94a3b8', fontSize: 12 }}>Class: {classes.find((c) => c.index === d.shipClass)?.name ?? d.shipClass}</p>
                <p style={{ color: '#94a3b8', fontSize: 12 }}>Armor #{d.armorId} · Computer #{d.computerId} · Engine #{d.engineId}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => setEditing(d)} style={{ padding: '2px 10px', background: 'transparent', border: '1px solid #1f2d45', color: '#94a3b8', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => deleteDesign.mutate(d.id)} style={{ padding: '2px 10px', background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
            {designs.length === 0 && <p style={{ color: '#94a3b8' }}>No designs yet.</p>}
          </div>
        </div>
      )}

      {tab === 'build' && (
        <div>
          <div style={{ ...sectionStyle(), display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <label>Design
              <select value={buildForm.designId} onChange={(e) => setBuildForm((p) => ({ ...p, designId: Number(e.target.value) }))} style={{ width: '100%' }}>
                <option value={0}>-- select --</option>
                {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Count
              <input type="number" min={1} value={buildForm.count} onChange={(e) => setBuildForm((p) => ({ ...p, count: Number(e.target.value) }))} style={{ width: '100%' }} />
            </label>
            <label>Planet ID
              <input type="number" min={1} value={buildForm.planetId} onChange={(e) => setBuildForm((p) => ({ ...p, planetId: Number(e.target.value) }))} style={{ width: '100%' }} />
            </label>
            <button onClick={() => addToQueue.mutate(buildForm)} style={{ padding: '4px 16px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>Queue</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid #1f2d45' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Design</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Count</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Turns left</th>
              <th />
            </tr></thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id} style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ padding: '4px 8px' }}>{q.design.name}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{q.count}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{q.turnsLeft}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                    <button onClick={() => cancelQueue.mutate(q.id)} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', cursor: 'pointer' }}>Cancel</button>
                  </td>
                </tr>
              ))}
              {queue.length === 0 && <tr><td colSpan={4} style={{ padding: 8, color: '#94a3b8' }}>No ships in queue.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pool' && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid #1f2d45' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Design</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Fleet</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Ships</th>
            </tr></thead>
            <tbody>
              {pool.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ padding: '4px 8px' }}>{s.design.name}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.fleetId || 'Unassigned'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.count}</td>
                </tr>
              ))}
              {pool.length === 0 && <tr><td colSpan={3} style={{ padding: 8, color: '#94a3b8' }}>No ships docked.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
