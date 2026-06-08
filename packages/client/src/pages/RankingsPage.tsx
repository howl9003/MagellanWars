import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { PageHeader, SkeletonTable, DataTable, Badge } from '../components/ui.js';

interface RankedPlayer {
  id: number;
  name: string;
  race: number;
  rating: number;
  honor: number;
  production: number;
  council: { name: string } | null;
}

export function RankingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['rankings'],
    queryFn: () => api.get<{ data: RankedPlayer[] }>('/player/rankings'),
  });

  if (isLoading) return (
    <div className="page">
      <PageHeader title="Rankings" />
      <SkeletonTable rows={10} cols={6} />
    </div>
  );

  const players = data?.data ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Rankings"
        subtitle={`${players.length} commanders ranked`}
      />

      <DataTable
        columns={[
          { key: 'rank', header: '#', width: 48, render: (_row, i) => (
            <span className={`num ${i === 0 ? 'text-accent text-bright' : i < 3 ? 'text-amber' : 'text-muted'}`}>
              {(i ?? 0) + 1}
            </span>
          )},
          { key: 'name', header: 'Commander', render: (row) => (
            <span className="text-bright">{row.name}</span>
          )},
          { key: 'council', header: 'Council', render: (row) => (
            row.council
              ? <Badge variant="teal">{row.council.name}</Badge>
              : <span className="text-muted">—</span>
          )},
          { key: 'rating', header: 'Rating', right: true, render: (row) => (
            <span className="num text-accent">{row.rating}</span>
          )},
          { key: 'honor', header: 'Honor', right: true, render: (row) => (
            <span className="num text-amber">{row.honor}</span>
          )},
          { key: 'production', header: 'Production', right: true, render: (row) => (
            <span className="num">{row.production.toLocaleString()}</span>
          )},
        ]}
        rows={players}
        emptyMsg="No ranked players yet."
      />
    </div>
  );
}
