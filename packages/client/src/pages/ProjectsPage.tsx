import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { PageHeader, Badge, SectionTitle, SkeletonCard, Empty } from '../components/ui.js';
import { useToastFn } from '../hooks/useToastContext.js';

interface ProjectEffect {
  production?: number; research?: number; military?: number; commerce?: number;
  efficiency?: number; diplomacy?: number; spy?: number; growth?: number;
}
interface Project {
  id: number; name: string; type: string; cost: number;
  prereqs: number[]; effects: ProjectEffect; description: string;
  societyReq?: string; built: boolean; available: boolean;
}

const TYPE_VARIANT: Record<string, 'accent' | 'purple' | 'teal' | 'muted'> = {
  Planet: 'accent', Fixed: 'teal', Council: 'purple', Secret: 'muted',
};

function effectsStr(e: ProjectEffect): string {
  return Object.entries(e).filter(([, v]) => v !== 0).map(([k, v]) => `${(v ?? 0) > 0 ? '+' : ''}${v}% ${k}`).join('  ');
}

export function ProjectsPage() {
  const qc = useQueryClient();
  const toast = useToastFn();

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: Project[] }>('/project'),
  });

  const build = useMutation({
    mutationFn: (projectId: number) => api.post('/project/build', { projectId }),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      const name = projects.find((p) => p.id === id)?.name ?? 'Project';
      toast(`${name} constructed.`, 'success');
    },
    onError: () => toast('Insufficient resources or prerequisites not met.', 'error'),
  });

  const projects = data?.data ?? [];
  const byType = projects.reduce<Record<string, Project[]>>((acc, p) => {
    (acc[p.type] ??= []).push(p);
    return acc;
  }, {});

  const built = projects.filter((p) => p.built).length;

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${built}/${projects.length} projects completed. Invest production in permanent empire improvements.`}
      />

      {isLoading ? (
        <div className="grid-auto">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : projects.length === 0 ? (
        <Empty message="No projects available." />
      ) : (
        Object.entries(byType).map(([type, list]) => (
          <div key={type} className="mb-24">
            <SectionTitle>
              <Badge variant={TYPE_VARIANT[type] ?? 'muted'}>{type}</Badge>
              {type} Projects
            </SectionTitle>
            <div className="grid-auto">
              {list.map((p) => (
                <div
                  key={p.id}
                  className={`card ${p.built ? 'card--green' : p.available ? 'card--glow' : ''} ${!p.built && !p.available ? 'locked' : ''}`}
                >
                  <div className="flex-between mb-8">
                    <strong className="text-bright">{p.name}</strong>
                    {p.built
                      ? <Badge variant="green">Built</Badge>
                      : p.available
                      ? <Badge variant="accent">Available</Badge>
                      : <Badge variant="muted">Locked</Badge>}
                  </div>

                  <p className="text-sm text-muted mb-8" style={{ lineHeight: 1.4 }}>{p.description}</p>

                  {effectsStr(p.effects) && (
                    <p className="text-xs text-accent mb-8">{effectsStr(p.effects)}</p>
                  )}

                  <div className="flex-between" style={{ alignItems: 'center' }}>
                    <div className="flex gap-8 text-xs text-muted">
                      <span>{p.cost.toLocaleString()} PP</span>
                      {p.societyReq && <span className="text-purple">{p.societyReq}</span>}
                    </div>
                    {!p.built && (
                      <button
                        className={`btn btn--sm ${p.available ? 'btn--primary' : ''}`}
                        disabled={!p.available || build.isPending}
                        onClick={() => build.mutate(p.id)}
                      >
                        {p.available ? 'Build' : 'Locked'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
