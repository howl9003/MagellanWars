import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { api } from '../lib/api.js';
import type { ApiResponse, DashboardResponse } from '@magellanwars/shared';
import { PageHeader, Stat, ProgressBar, Badge, SkeletonCard, SectionTitle } from '../components/ui.js';

const RACE_NAMES: Record<string, string> = {
  human: 'Human', noxian: 'Noxian', cephean: 'Cephean', torean: 'Torean',
  agerus: 'Agerus', targoid: 'Targoid', krill: 'Krill', xerusian: 'Xerusian',
};
const MISSION_LABELS: Record<string, string> = {
  standby: 'Standby', training: 'Training', patrol: 'Patrol',
  expedition: 'Expedition', attack: 'Attack', defense: 'Defense', alliance_dispatch: 'Alliance Dispatch',
};

function honourColor(h: number) {
  if (h >= 70) return 'var(--green)';
  if (h >= 40) return 'var(--amber)';
  return 'var(--red)';
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['player', 'me'],
    queryFn: () => api.get<ApiResponse<DashboardResponse>>('/player/me'),
    refetchInterval: 30_000,
  });

  const player = data?.data.player;
  const planets = data?.data.planets ?? [];
  const fleets = data?.data.fleets ?? [];

  if (isLoading) {
    return (
      <div>
        <div className="skel-header skeleton mb-16" />
        <div className="grid-4 mb-16">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skel-block skeleton" />)}
        </div>
        <div className="grid-2"><SkeletonCard rows={5} /><SkeletonCard rows={4} /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Commander ${player?.name ?? '...'}`}
        subtitle={`${RACE_NAMES[player?.race ?? 'human'] ?? 'Unknown'} Empire · Turn ${player?.turn ?? 0}`}
        actions={<span className="text-xs text-muted" style={{ letterSpacing: '0.1em' }}>RATING <span className="text-accent">{player?.rating ?? 2000}</span></span>}
      />

      <div className="grid-4 mb-16">
        <Stat label="Production" value={player?.production ?? 0} unit="PP" />
        <Stat label="Research" value={player?.research ?? 0} unit="RP" />
        <Stat label="Honour" value={player?.honor ?? 50} color={honourColor(player?.honor ?? 50)} />
        <Stat label="Rating" value={player?.rating ?? 2000} />
      </div>

      <div className="grid-2 gap-16">
        <div className="card">
          <SectionTitle>Planets ({planets.length})</SectionTitle>
          {planets.length === 0 ? (
            <p className="text-muted text-sm">No planets colonised.</p>
          ) : (
            <div className="flex-col gap-8">
              {planets.slice(0, 8).map((p) => (
                <div key={p.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <div className="flex-between mb-4">
                    <span className="text-bright">{p.name}</span>
                    <span className="text-xs text-muted">Pop {p.population.toLocaleString()}</span>
                  </div>
                  <div className="flex gap-12 text-xs text-muted mb-4">
                    <span>Factory {p.buildingFactory}</span>
                    <span>MilBase {p.buildingMilitaryBase}</span>
                    <span>Lab {p.buildingResearchLab}</span>
                  </div>
                  <ProgressBar value={p.ratioFactory} max={100} variant="green" />
                </div>
              ))}
              {planets.length > 8 && <p className="text-sm text-muted">+{planets.length - 8} more planets</p>}
            </div>
          )}
        </div>

        <div className="flex-col gap-16">
          <div className="card">
            <SectionTitle>Fleets ({fleets.length})</SectionTitle>
            {fleets.length === 0 ? (
              <p className="text-muted text-sm">No fleets deployed.</p>
            ) : (
              <table className="data-table">
                <thead><tr><th>Name</th><th className="num">Ships</th><th>Status</th></tr></thead>
                <tbody>
                  {fleets.slice(0, 6).map((f) => (
                    <tr key={f.id}>
                      <td className="text-bright">{f.name}</td>
                      <td className="num text-xs">{f.currentShips}<span className="text-muted">/{f.maxShips}</span></td>
                      <td><Badge variant={f.mission === 'standby' ? 'muted' : 'accent'}>{MISSION_LABELS[f.mission] ?? 'Unknown'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card card--sm">
            <SectionTitle>Quick Access</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { to: '/tech', label: 'Tech Tree', key: 'T' },
                { to: '/warfare', label: 'Warfare', key: 'W' },
                { to: '/spy', label: 'Espionage', key: 'Y' },
                { to: '/diplomacy', label: 'Diplomacy', key: 'D' },
                { to: '/council', label: 'Council', key: 'C' },
                { to: '/info', label: 'Rankings', key: 'I' },
              ].map((item) => (
                <NavLink key={item.to} to={item.to} className="btn" style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none' }}>
                  <span>{item.label}</span>
                  <kbd className="kbkey">{item.key}</kbd>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
