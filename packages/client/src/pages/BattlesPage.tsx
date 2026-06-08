import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { ApiResponse, BattleListResponse } from '@magellanwars/shared';
import { PageHeader, SkeletonTable, DataTable } from '../components/ui.js';

export function BattlesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['battles'],
    queryFn: () => api.get<ApiResponse<BattleListResponse>>('/battle?pageSize=20'),
  });

  if (isLoading) return (
    <div className="page">
      <PageHeader title="Battle Records" />
      <SkeletonTable rows={5} cols={5} />
    </div>
  );

  const battles = data?.data.battles ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Battle Records"
        subtitle={`${battles.length} recent engagements`}
      />

      <DataTable
        columns={[
          { key: 'attacker', header: 'Attacker' },
          { key: 'defender', header: 'Defender' },
          { key: 'winner', header: 'Winner', render: (row) => (
            <span className="text-accent text-bright">
              {row.winner === row.attackerId ? row.attackerName : row.defenderName}
            </span>
          )},
          { key: 'location', header: 'Location', render: (row) => (
            <span className="text-muted">{row.battleFieldName}</span>
          )},
          { key: 'time', header: 'Time', render: (row) => (
            <span className="text-muted text-sm">{new Date(row.time).toLocaleString()}</span>
          )},
        ]}
        rows={battles.map((b) => ({
          ...b,
          attacker: b.attackerName,
          defender: b.defenderName,
          location: b.battleFieldName,
          time: b.time,
        }))}
        emptyMsg="No battle records found."
      />
    </div>
  );
}
