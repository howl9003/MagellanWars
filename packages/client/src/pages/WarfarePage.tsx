import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface DefensePlan { id: number; planetId: number; autoReply: boolean; fleets: Array<{ fleetId: number }> }
interface Fleet { id: number; name: string; currentShips: number }
interface BattleLog { battleId: number; attackerWon: boolean; log: string[] }

export function WarfarePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'raid' | 'blockade' | 'defense'>('defense');
  const [raidForm, setRaidForm] = useState({ targetPlayerId: '', targetPlanetId: '', attackerFleetId: '' });
  const [blockadeForm, setBlockadeForm] = useState({ targetPlayerId: '', attackerFleetId: '' });
  const [defenseForm, setDefenseForm] = useState({ planetId: '', autoReply: false, fleetIds: '' });
  const [battleResult, setBattleResult] = useState<BattleLog | null>(null);

  const { data: fleetData } = useQuery({ queryKey: ['fleets'], queryFn: () => api.get<{ data: Fleet[] }>('/fleet') });
  const { data: defenseData } = useQuery({ queryKey: ['defense-plans'], queryFn: () => api.get<{ data: DefensePlan[] }>('/war/defense') });

  const raid = useMutation({
    mutationFn: (body: { targetPlayerId: number; targetPlanetId: number; attackerFleetId: number }) =>
      api.post<{ data: BattleLog }>('/war/raid', body),
    onSuccess: (d) => setBattleResult(d.data),
  });

  const blockade = useMutation({
    mutationFn: (body: { targetPlayerId: number; attackerFleetId: number }) =>
      api.post('/war/blockade', body),
  });

  const saveDefense = useMutation({
    mutationFn: (body: { planetId: number; autoReply: boolean; fleetIds: number[] }) =>
      api.post('/war/defense', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['defense-plans'] }),
  });

  const removeDefense = useMutation({
    mutationFn: (planetId: number) => fetch(`/api/war/defense/${planetId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['defense-plans'] }),
  });

  const fleets = fleetData?.data ?? [];
  const plans = defenseData?.data ?? [];

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{
      padding: '4px 16px', background: tab === t ? '#1e3a5f' : 'transparent',
      border: '1px solid #1f2d45', color: '#e2e8f0', cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div>
      <h1>Warfare</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabBtn('defense', 'Defense Plans')}
        {tabBtn('raid', 'Raid Planet')}
        {tabBtn('blockade', 'Blockade')}
      </div>

      {tab === 'defense' && (
        <div>
          <div style={{ padding: 16, border: '1px solid #1f2d45', borderRadius: 4, marginBottom: 16 }}>
            <h3>Set Defense Plan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'end' }}>
              <label>Planet ID
                <input type="number" value={defenseForm.planetId} onChange={(e) => setDefenseForm((p) => ({ ...p, planetId: e.target.value }))} style={{ width: '100%' }} />
              </label>
              <label>Fleet IDs (comma-separated)
                <input value={defenseForm.fleetIds} onChange={(e) => setDefenseForm((p) => ({ ...p, fleetIds: e.target.value }))} style={{ width: '100%' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={defenseForm.autoReply} onChange={(e) => setDefenseForm((p) => ({ ...p, autoReply: e.target.checked }))} />
                Auto-reply
              </label>
              <button onClick={() => saveDefense.mutate({
                planetId: Number(defenseForm.planetId),
                autoReply: defenseForm.autoReply,
                fleetIds: defenseForm.fleetIds.split(',').map(Number).filter(Boolean),
              })} style={{ padding: '4px 16px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>Save</button>
            </div>
          </div>

          {plans.length === 0
            ? <p style={{ color: '#94a3b8' }}>No defense plans set.</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid #1f2d45' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Planet</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Fleets</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Auto-reply</th>
                  <th />
                </tr></thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #111827' }}>
                      <td style={{ padding: '4px 8px' }}>{p.planetId}</td>
                      <td style={{ padding: '4px 8px' }}>{p.fleets.map((f) => f.fleetId).join(', ') || 'None'}</td>
                      <td style={{ padding: '4px 8px' }}>{p.autoReply ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <button onClick={() => removeDefense.mutate(p.planetId)} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', cursor: 'pointer' }}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {tab === 'raid' && (
        <div>
          <div style={{ padding: 16, border: '1px solid #1f2d45', borderRadius: 4, maxWidth: 480 }}>
            <h3>Raid a Planet</h3>
            <p style={{ color: '#f59e0b', fontSize: 12, marginBottom: 12 }}>Warning: raiding has diplomatic consequences.</p>
            <label style={{ display: 'block', marginBottom: 8 }}>Target Player ID
              <input type="number" value={raidForm.targetPlayerId} onChange={(e) => setRaidForm((p) => ({ ...p, targetPlayerId: e.target.value }))} style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 8 }}>Target Planet ID
              <input type="number" value={raidForm.targetPlanetId} onChange={(e) => setRaidForm((p) => ({ ...p, targetPlanetId: e.target.value }))} style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>Attacker Fleet
              <select value={raidForm.attackerFleetId} onChange={(e) => setRaidForm((p) => ({ ...p, attackerFleetId: e.target.value }))} style={{ width: '100%' }}>
                <option value="">-- select fleet --</option>
                {fleets.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.currentShips} ships)</option>)}
              </select>
            </label>
            <button
              disabled={!raidForm.targetPlayerId || !raidForm.targetPlanetId || !raidForm.attackerFleetId || raid.isPending}
              onClick={() => raid.mutate({ targetPlayerId: Number(raidForm.targetPlayerId), targetPlanetId: Number(raidForm.targetPlanetId), attackerFleetId: Number(raidForm.attackerFleetId) })}
              style={{ padding: '6px 24px', background: '#7f1d1d', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
            >
              {raid.isPending ? 'Launching raid...' : 'Launch Raid'}
            </button>
          </div>

          {battleResult && (
            <div style={{ marginTop: 16, padding: 16, border: `1px solid ${battleResult.attackerWon ? '#14532d' : '#7f1d1d'}`, borderRadius: 4 }}>
              <h3 style={{ color: battleResult.attackerWon ? '#22c55e' : '#ef4444' }}>
                {battleResult.attackerWon ? 'Victory! Planet captured.' : 'Defeat. Retreat.'}
              </h3>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {battleResult.log.map((line, i) => <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#94a3b8' }}>{line}</p>)}
              </div>
              <button onClick={() => setBattleResult(null)} style={{ marginTop: 8, padding: '2px 12px', background: 'transparent', border: '1px solid #1f2d45', color: '#94a3b8', cursor: 'pointer' }}>Dismiss</button>
            </div>
          )}
        </div>
      )}

      {tab === 'blockade' && (
        <div>
          <div style={{ padding: 16, border: '1px solid #1f2d45', borderRadius: 4, maxWidth: 480 }}>
            <h3>Blockade an Empire</h3>
            <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>Reduces target's commerce income for 5 turns. Costs 5 honour.</p>
            <label style={{ display: 'block', marginBottom: 8 }}>Target Player ID
              <input type="number" value={blockadeForm.targetPlayerId} onChange={(e) => setBlockadeForm((p) => ({ ...p, targetPlayerId: e.target.value }))} style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>Fleet
              <select value={blockadeForm.attackerFleetId} onChange={(e) => setBlockadeForm((p) => ({ ...p, attackerFleetId: e.target.value }))} style={{ width: '100%' }}>
                <option value="">-- select fleet --</option>
                {fleets.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
            <button
              disabled={!blockadeForm.targetPlayerId || !blockadeForm.attackerFleetId || blockade.isPending}
              onClick={() => blockade.mutate({ targetPlayerId: Number(blockadeForm.targetPlayerId), attackerFleetId: Number(blockadeForm.attackerFleetId) })}
              style={{ padding: '6px 24px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}
            >Initiate Blockade</button>
            {blockade.isSuccess && <p style={{ color: '#22c55e', marginTop: 8 }}>Blockade launched.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
