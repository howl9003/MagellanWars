import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { PageHeader, ProgressBar, Badge, TabBar, SkeletonCard, SectionTitle } from '../components/ui.js';
import { useToastFn } from '../hooks/useToastContext.js';

interface TechEntry {
  id: number;
  name: string;
  tree: string;
  level: number;
  prerequisites: number[];
  effects: Record<string, number>;
  baseCost: number;
  learned: boolean;
  available: boolean;
  cost: number;
  description?: string;
}

interface QueueData {
  techId: number;
  tech: TechEntry | null;
  currentPool: number;
  needed: number;
  progressPct: number;
}

const TREES = ['SOCL', 'INFO', 'MATR', 'LIFE'] as const;
type Tree = typeof TREES[number];

const TREE_LABELS: Record<Tree, string> = {
  SOCL: 'Social',
  INFO: 'Information',
  MATR: 'Matter',
  LIFE: 'Life Sciences',
};

const TREE_COLORS: Record<Tree, string> = {
  SOCL: 'var(--purple)',
  INFO: 'var(--accent)',
  MATR: 'var(--amber)',
  LIFE: 'var(--green)',
};

function effectLine(effects: Record<string, number>) {
  return Object.entries(effects)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${v > 0 ? '+' : ''}${v}% ${k}`)
    .join('  ');
}

export function TechPage() {
  const qc = useQueryClient();
  const toast = useToastFn();
  const [activeTree, setActiveTree] = useState<Tree>('SOCL');
  const [filter, setFilter] = useState<'all' | 'learned' | 'available'>('all');
  const [search, setSearch] = useState('');

  const { data: techData, isLoading } = useQuery({
    queryKey: ['tech'],
    queryFn: () => api.get<{ data: TechEntry[] }>('/tech'),
  });

  const { data: queueData } = useQuery({
    queryKey: ['tech', 'queue'],
    queryFn: () => api.get<{ data: QueueData }>('/tech/queue'),
    refetchInterval: 10_000,
  });

  const setQueue = useMutation({
    mutationFn: (techId: number) => api.put('/tech/queue', { techId }),
    onSuccess: (_, techId) => {
      void qc.invalidateQueries({ queryKey: ['tech'] });
      void qc.invalidateQueries({ queryKey: ['tech', 'queue'] });
      const name = techs.find((t) => t.id === techId)?.name ?? 'Tech';
      toast(techId === 0 ? 'Research cancelled.' : `Queued: ${name}`, techId === 0 ? 'warning' : 'success');
    },
  });

  const techs = techData?.data ?? [];
  const queue = queueData?.data;

  const treeTabs = TREES.map((t) => ({
    id: t,
    label: TREE_LABELS[t],
    count: techs.filter((x) => x.tree === t && !x.learned).length,
  }));

  const visible = techs
    .filter((t) => t.tree === activeTree)
    .filter((t) => filter === 'all' || (filter === 'learned' ? t.learned : t.available))
    .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.level - b.level);

  return (
    <div>
      <PageHeader
        title="Technology Tree"
        subtitle="Research technologies to unlock new capabilities for your empire."
        actions={
          <div className="flex-center gap-8">
            <input
              placeholder="Search techs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 180 }}
            />
          </div>
        }
      />

      {/* Research progress */}
      {queue?.tech && (
        <div className="card card--glow mb-16">
          <div className="flex-between mb-8">
            <div>
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.1em' }}>Researching</span>
              <h3 style={{ margin: '2px 0 0', color: 'var(--accent)' }}>{queue.tech.name}</h3>
            </div>
            <button className="btn btn--sm btn--danger" onClick={() => setQueue.mutate(0)}>Cancel</button>
          </div>
          <ProgressBar
            value={queue.currentPool}
            max={queue.needed}
            label={`${queue.currentPool.toLocaleString()} / ${queue.needed.toLocaleString()} RP`}
            showPct
          />
        </div>
      )}

      {/* Filter + tree tabs */}
      <div className="flex-between mb-8" style={{ alignItems: 'flex-end' }}>
        <TabBar
          tabs={treeTabs}
          active={activeTree}
          onChange={setActiveTree}
        />
        <div className="flex gap-4 text-xs" style={{ paddingBottom: 12 }}>
          {(['all', 'available', 'learned'] as const).map((f) => (
            <button key={f} className={`btn btn--sm ${filter === f ? 'btn--primary' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid-auto">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} rows={3} />)}</div>
      ) : (
        <>
          <SectionTitle>{TREE_LABELS[activeTree]} Technologies — {visible.length} shown</SectionTitle>
          {visible.length === 0 ? (
            <p className="text-muted" style={{ padding: '32px 0', textAlign: 'center' }}>
              No technologies match the current filter.
            </p>
          ) : (
            <div className="grid-auto">
              {visible.map((tech) => (
                <TechCard
                  key={tech.id}
                  tech={tech}
                  treeColor={TREE_COLORS[activeTree]}
                  isQueued={queue?.techId === tech.id}
                  onQueue={() => setQueue.mutate(tech.id)}
                  onCancel={() => setQueue.mutate(0)}
                  loading={setQueue.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TechCard({ tech, treeColor, isQueued, onQueue, onCancel, loading }: {
  tech: TechEntry;
  treeColor: string;
  isQueued: boolean;
  onQueue: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const borderColor = tech.learned
    ? 'rgba(0,232,122,0.35)'
    : isQueued
    ? 'rgba(0,212,255,0.35)'
    : tech.available
    ? 'var(--border-accent)'
    : 'var(--border)';

  return (
    <div
      className={`card ${!tech.learned && !tech.available ? 'locked' : ''}`}
      style={{ borderColor, transition: 'border-color 0.15s' }}
    >
      <div className="flex-between mb-8">
        <div className="flex-center gap-8">
          <span
            style={{ width: 6, height: 6, background: treeColor, display: 'inline-block', flexShrink: 0 }}
            data-tip={`Level ${tech.level}`}
          />
          <strong className="text-bright" style={{ fontSize: 13 }}>{tech.name}</strong>
        </div>
        <div className="flex gap-4">
          {tech.learned && <Badge variant="green">Learned</Badge>}
          {isQueued && <Badge variant="accent">Queued</Badge>}
          {!tech.learned && !tech.available && <Badge variant="muted">Locked</Badge>}
        </div>
      </div>

      {tech.description && (
        <p className="text-sm text-muted mb-8" style={{ lineHeight: 1.4 }}>{tech.description}</p>
      )}

      {Object.keys(tech.effects).length > 0 && (
        <p className="text-xs mb-8" style={{ color: treeColor }}>{effectLine(tech.effects)}</p>
      )}

      <div className="flex-between" style={{ alignItems: 'center' }}>
        <span className="text-xs text-muted">{tech.cost.toLocaleString()} RP · Lv {tech.level}</span>
        {tech.learned ? (
          <span className="text-xs" style={{ color: 'var(--green)' }}>✓</span>
        ) : isQueued ? (
          <button className="btn btn--sm btn--danger" onClick={onCancel} disabled={loading}>Cancel</button>
        ) : tech.available ? (
          <button className="btn btn--sm btn--primary" onClick={onQueue} disabled={loading}>Research</button>
        ) : (
          <span className="text-xs text-muted">Req: {tech.prerequisites.join(', ')}</span>
        )}
      </div>
    </div>
  );
}
