import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { PageHeader, SectionTitle, DataTable, Badge, Empty } from '../components/ui.js';
import { useToastFn } from '../hooks/useToastContext.js';

interface Relation {
  id: number;
  player1: number;
  player2: number;
  relation: number;
  time: string;
}

interface DiplomaticMessage {
  id: number;
  type: number;
  senderId: number;
  receiverId: number;
  time: string;
  status: number;
}

const RELATION_LABELS: Record<number, string> = {
  '-2': 'War',
  '-1': 'Hostile',
  0: 'Neutral',
  1: 'Friendly',
  2: 'Truce',
  3: 'Non-Aggression Pact',
  4: 'Alliance',
};

const RELATION_VARIANTS: Record<number, 'red' | 'amber' | 'muted' | 'green' | 'teal' | 'accent' | 'purple'> = {
  '-2': 'red',
  '-1': 'amber',
  0: 'muted',
  1: 'green',
  2: 'teal',
  3: 'accent',
  4: 'purple',
};

const ACTION_LABELS: Record<number, string> = {
  1: 'Declare War',
  2: 'Offer Truce',
  3: 'Offer Pact',
  4: 'Offer Alliance',
  5: 'Break Alliance',
  6: 'Cancel Pact',
};

export function DiplomacyPage() {
  const qc = useQueryClient();
  const toast = useToastFn();

  const { data: relData } = useQuery({
    queryKey: ['diplomacy', 'relations'],
    queryFn: () => api.get<{ data: Relation[] }>('/diplomacy/relations'),
  });

  const { data: msgData } = useQuery({
    queryKey: ['diplomacy', 'messages'],
    queryFn: () => api.get<{ data: DiplomaticMessage[] }>('/diplomacy/messages'),
  });

  const takeAction = useMutation({
    mutationFn: (args: { targetPlayerId: number; action: number }) =>
      api.post('/diplomacy/action', args),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['diplomacy'] });
      toast(`Diplomatic action sent: ${ACTION_LABELS[vars.action] ?? 'Action'}`, 'success');
    },
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/diplomacy/messages/${id}/read`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['diplomacy', 'messages'] });
      toast('Message marked as read', 'success');
    },
  });

  const relations = relData?.data ?? [];
  const messages = msgData?.data ?? [];
  const unread = messages.filter((m) => m.status === 0);

  return (
    <div className="page">
      <PageHeader
        title="Diplomacy"
        subtitle="Manage relations and communications with other empires"
      />

      <div className="mb-24">
        <SectionTitle>
          Inbox{unread.length > 0 && (
            <Badge variant="accent" >{unread.length}</Badge>
          )}
        </SectionTitle>

        {messages.length === 0 ? (
          <Empty message="No diplomatic messages." />
        ) : (
          <DataTable
            columns={[
              { key: 'from', header: 'From', render: (row) => (
                <span className="text-bright">Player #{row.senderId}</span>
              )},
              { key: 'type', header: 'Type', render: (row) => (
                <span>{ACTION_LABELS[row.type] ?? `Type ${row.type}`}</span>
              )},
              { key: 'time', header: 'Time', render: (row) => (
                <span className="text-muted text-sm">{new Date(row.time).toLocaleString()}</span>
              )},
              { key: 'status', header: 'Status', render: (row) => (
                row.status === 0
                  ? <Badge variant="amber">Unread</Badge>
                  : <Badge variant="muted">Read</Badge>
              )},
              { key: 'action', header: '', render: (row) => (
                row.status === 0 ? (
                  <button
                    className="btn btn--sm"
                    onClick={() => markRead.mutate(row.id)}
                  >
                    Mark Read
                  </button>
                ) : null
              )},
            ]}
            rows={messages}
            emptyMsg="No messages."
          />
        )}
      </div>

      <div>
        <SectionTitle>Relations</SectionTitle>

        {relations.length === 0 ? (
          <Empty message="No diplomatic relations yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'player', header: 'Player', render: (row) => (
                <span className="text-bright">
                  Player #{row.player1} / #{row.player2}
                </span>
              )},
              { key: 'status', header: 'Status', render: (row) => (
                <Badge variant={RELATION_VARIANTS[row.relation] ?? 'muted'}>
                  {RELATION_LABELS[row.relation] ?? String(row.relation)}
                </Badge>
              )},
              { key: 'since', header: 'Since', render: (row) => (
                <span className="text-muted text-sm">{new Date(row.time).toLocaleDateString()}</span>
              )},
              { key: 'actions', header: 'Actions', render: (row) => (
                <div className="flex gap-4">
                  {row.relation !== -2 && (
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => takeAction.mutate({ targetPlayerId: row.player2, action: 1 })}
                    >
                      War
                    </button>
                  )}
                  {row.relation === -2 && (
                    <button
                      className="btn btn--sm"
                      onClick={() => takeAction.mutate({ targetPlayerId: row.player2, action: 2 })}
                    >
                      Truce
                    </button>
                  )}
                  {row.relation === 3 && (
                    <button
                      className="btn btn--sm"
                      onClick={() => takeAction.mutate({ targetPlayerId: row.player2, action: 6 })}
                    >
                      Cancel Pact
                    </button>
                  )}
                  {row.relation === 4 && (
                    <button
                      className="btn btn--sm"
                      onClick={() => takeAction.mutate({ targetPlayerId: row.player2, action: 5 })}
                    >
                      Break Alliance
                    </button>
                  )}
                </div>
              )},
            ]}
            rows={relations}
            emptyMsg="No relations."
          />
        )}
      </div>
    </div>
  );
}
