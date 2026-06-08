import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface PlayerRank { id: number; name: string; race: number; rating: number; honor: number; production: number; councilId: number | null }
interface FleetRank { ownerId: number; id: number; name: string; killedShips: number; owner: { name: string; race: number } }
interface CouncilRank { id: number; name: string; production: number; _count: { members: number } }
interface Cluster { id: number; name: string; _count: { planets: number; players: number } }
interface Tech { id: number; name: string; tree: string; level: number; cost: number; description: string }

export function InfoPage() {
  const [tab, setTab] = useState<'rankings' | 'clusters' | 'encyclopedia'>('rankings');
  const [rankBy, setRankBy] = useState<'rating' | 'honor' | 'production'>('rating');
  const [encSection, setEncSection] = useState<'techs' | 'races' | 'projects' | 'spy'>('techs');
  const [search, setSearch] = useState('');

  const { data: playerRankData } = useQuery({
    queryKey: ['info-rankings-players', rankBy],
    queryFn: () => api.get<{ data: PlayerRank[] }>(`/info/rankings/players?by=${rankBy}`),
    enabled: tab === 'rankings',
  });
  const { data: fleetRankData } = useQuery({
    queryKey: ['info-rankings-fleets'],
    queryFn: () => api.get<{ data: FleetRank[] }>('/info/rankings/fleets'),
    enabled: tab === 'rankings',
  });
  const { data: councilRankData } = useQuery({
    queryKey: ['info-rankings-councils'],
    queryFn: () => api.get<{ data: CouncilRank[] }>('/info/rankings/councils'),
    enabled: tab === 'rankings',
  });
  const { data: clusterData } = useQuery({
    queryKey: ['info-clusters'],
    queryFn: () => api.get<{ data: Cluster[] }>('/info/clusters'),
    enabled: tab === 'clusters',
  });
  const { data: techData } = useQuery({
    queryKey: ['info-enc-techs'],
    queryFn: () => api.get<{ data: Tech[] }>('/info/encyclopedia/techs'),
    enabled: tab === 'encyclopedia' && encSection === 'techs',
  });
  const { data: raceData } = useQuery({
    queryKey: ['info-enc-races'],
    queryFn: () => api.get<{ data: unknown[] }>('/info/encyclopedia/races'),
    enabled: tab === 'encyclopedia' && encSection === 'races',
  });

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: '4px 16px', background: tab === t ? '#1e3a5f' : 'transparent', border: '1px solid #1f2d45', color: '#e2e8f0', cursor: 'pointer' }}>{label}</button>
  );

  const playerRanks = playerRankData?.data ?? [];
  const fleetRanks = fleetRankData?.data ?? [];
  const councilRanks = councilRankData?.data ?? [];
  const clusters = clusterData?.data ?? [];
  const techs = techData?.data ?? [];
  const filteredTechs = search ? techs.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.tree.toLowerCase().includes(search.toLowerCase())) : techs;

  return (
    <div>
      <h1>Galaxy Info</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabBtn('rankings', 'Rankings')}
        {tabBtn('clusters', 'Cluster Map')}
        {tabBtn('encyclopedia', 'Encyclopedia')}
      </div>

      {tab === 'rankings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Players</h3>
              {(['rating', 'honor', 'production'] as const).map((by) => (
                <button key={by} onClick={() => setRankBy(by)} style={{ padding: '2px 8px', background: rankBy === by ? '#1e3a5f' : 'transparent', border: '1px solid #1f2d45', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>{by}</button>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '1px solid #1f2d45' }}>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>Player</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>{rankBy}</th>
              </tr></thead>
              <tbody>
                {playerRanks.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '2px 4px', color: '#64748b' }}>{i + 1}</td>
                    <td style={{ padding: '2px 4px' }}>{p.name}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', color: '#3b82f6' }}>{p[rankBy].toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>Fleets (by kills)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '1px solid #1f2d45' }}>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>Fleet</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>Kills</th>
              </tr></thead>
              <tbody>
                {fleetRanks.map((f, i) => (
                  <tr key={`${f.ownerId}-${f.id}`} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '2px 4px', color: '#64748b' }}>{i + 1}</td>
                    <td style={{ padding: '2px 4px' }}><span style={{ color: '#64748b', fontSize: 11 }}>{f.owner.name}/</span>{f.name}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', color: '#f59e0b' }}>{f.killedShips.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>Councils (by production)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '1px solid #1f2d45' }}>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>Council</th>
                <th style={{ textAlign: 'right', padding: '2px 4px' }}>Members</th>
              </tr></thead>
              <tbody>
                {councilRanks.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '2px 4px', color: '#64748b' }}>{i + 1}</td>
                    <td style={{ padding: '2px 4px' }}>{c.name}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right' }}>{c._count.members}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'clusters' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {clusters.map((c) => (
            <div key={c.id} style={{ padding: 12, border: '1px solid #1f2d45', borderRadius: 4 }}>
              <strong>{c.name}</strong>
              <p style={{ margin: '4px 0', fontSize: 12, color: '#94a3b8' }}>
                {c._count.planets} planets · {c._count.players} players
              </p>
            </div>
          ))}
          {clusters.length === 0 && <p style={{ color: '#94a3b8' }}>No clusters found.</p>}
        </div>
      )}

      {tab === 'encyclopedia' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['techs', 'races', 'projects', 'spy'] as const).map((s) => (
              <button key={s} onClick={() => setEncSection(s)} style={{ padding: '4px 12px', background: encSection === s ? '#1e3a5f' : 'transparent', border: '1px solid #1f2d45', color: '#e2e8f0', cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
            ))}
          </div>

          {encSection === 'techs' && (
            <div>
              <input placeholder="Search techs..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, padding: '4px 12px', background: '#111827', border: '1px solid #1f2d45', color: '#e2e8f0', width: 300 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {filteredTechs.map((t) => (
                  <div key={t.id} style={{ padding: 12, border: '1px solid #1f2d45', borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 13 }}>{t.name}</strong>
                      <span style={{ fontSize: 11, color: '#64748b' }}>#{t.id}</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 11, color: '#64748b' }}>{t.tree} Lv.{t.level} — {t.cost.toLocaleString()} RP</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{t.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {encSection === 'races' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {(raceData?.data ?? []).map((r) => (
                <div key={(r as { id: number }).id} style={{ padding: 12, border: '1px solid #1f2d45', borderRadius: 4 }}>
                  <pre style={{ margin: 0, fontSize: 11, color: '#94a3b8', overflow: 'auto' }}>{JSON.stringify(r, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}

          {(encSection === 'projects' || encSection === 'spy') && (
            <p style={{ color: '#94a3b8' }}>See Projects and Espionage pages for detailed information.</p>
          )}
        </div>
      )}
    </div>
  );
}
