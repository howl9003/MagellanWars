import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  PageHeader,
  SectionTitle,
  Card,
  Stat,
  DataTable,
  Badge,
  Empty,
} from '../components/ui.js';
import { useToastFn } from '../hooks/useToastContext.js';

interface Council {
  id: number;
  name: string;
  slogan: string;
  speakerId: number;
  production: number;
  honor: number;
  _count?: { members: number };
}

interface CouncilDetail extends Council {
  members: Array<{ id: number; name: string; race: number; honor: number; rating: number }>;
}

export function CouncilPage() {
  const qc = useQueryClient();
  const toast = useToastFn();
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlogan, setNewSlogan] = useState('');
  const [donateAmount, setDonateAmount] = useState('');

  const { data: myCouncilData, error: myCouncilError } = useQuery({
    queryKey: ['council', 'me'],
    queryFn: () => api.get<{ data: CouncilDetail }>('/council/me'),
    retry: false,
  });

  const { data: allCouncils } = useQuery({
    queryKey: ['council', 'all'],
    queryFn: () => api.get<{ data: (Council & { _count: { members: number } })[] }>('/council'),
  });

  const createCouncil = useMutation({
    mutationFn: (data: { name: string; slogan: string }) => api.post('/council', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['council'] });
      setCreateMode(false);
      toast('Council founded successfully!', 'success');
    },
  });

  const donate = useMutation({
    mutationFn: (amount: number) => api.post('/council/me/donate', { amount }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['council'] });
      setDonateAmount('');
      toast('Donation sent to council pool!', 'success');
    },
  });

  const myCouncil = myCouncilData?.data;
  const notInCouncil = !myCouncil && !!myCouncilError;

  return (
    <div className="page">
      <PageHeader
        title="Council"
        subtitle="Alliance management and inter-empire cooperation"
      />

      {myCouncil ? (
        <div className="mb-24">
          <Card variant="purple" glow>
            <div className="flex-between mb-8">
              <div>
                <h2 className="text-bright mb-4">{myCouncil.name}</h2>
                <p className="text-muted text-sm">{myCouncil.slogan}</p>
              </div>
              <Badge variant="purple">{myCouncil.members.length} members</Badge>
            </div>

            <div className="flex gap-16 mb-12">
              <Stat label="Production Pool" value={myCouncil.production.toLocaleString()} />
              <Stat label="Honor" value={myCouncil.honor} color="amber" />
            </div>

            <SectionTitle>Members</SectionTitle>
            <DataTable
              columns={[
                { key: 'name', header: 'Commander', render: (row) => (
                  <span className="text-bright">{row.name}</span>
                )},
                { key: 'race', header: 'Race', render: (row) => (
                  <span className="text-muted">{row.race}</span>
                )},
                { key: 'honor', header: 'Honor', right: true, render: (row) => (
                  <span className="num text-amber">{row.honor}</span>
                )},
                { key: 'rating', header: 'Rating', right: true, render: (row) => (
                  <span className="num text-accent">{row.rating}</span>
                )},
              ]}
              rows={myCouncil.members}
            />

            <div className="flex gap-8 mt-12">
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <input
                  type="number"
                  placeholder="Donate production..."
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(e.target.value)}
                />
              </div>
              <button
                className="btn btn--primary"
                onClick={() => donate.mutate(parseInt(donateAmount, 10) || 0)}
                disabled={donate.isPending}
              >
                Donate
              </button>
            </div>
          </Card>
        </div>
      ) : notInCouncil ? (
        <div className="mb-24">
          <Card>
            <p className="text-muted mb-12">You are not in a council.</p>
            {createMode ? (
              <div>
                <SectionTitle>Found a Council</SectionTitle>
                <div className="field">
                  <label>Council Name</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter council name..."
                  />
                </div>
                <div className="field">
                  <label>Slogan</label>
                  <input
                    value={newSlogan}
                    onChange={(e) => setNewSlogan(e.target.value)}
                    placeholder="Enter slogan..."
                  />
                </div>
                <p className="text-muted text-sm mb-12">Cost: 1,000 production</p>
                <div className="flex gap-8">
                  <button
                    className="btn btn--primary"
                    onClick={() => createCouncil.mutate({ name: newName, slogan: newSlogan })}
                    disabled={createCouncil.isPending}
                  >
                    Create
                  </button>
                  <button
                    className="btn"
                    onClick={() => setCreateMode(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn--primary" onClick={() => setCreateMode(true)}>
                Found a Council
              </button>
            )}
          </Card>
        </div>
      ) : null}

      <div>
        <SectionTitle>All Councils</SectionTitle>
        {allCouncils?.data.length === 0 ? (
          <Empty message="No councils exist yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'name', header: 'Name', render: (row) => (
                <span className="text-bright">{row.name}</span>
              )},
              { key: 'members', header: 'Members', right: true, render: (row) => (
                <span className="num">{row._count.members}</span>
              )},
              { key: 'production', header: 'Production', right: true, render: (row) => (
                <span className="num">{row.production.toLocaleString()}</span>
              )},
              { key: 'honor', header: 'Honor', right: true, render: (row) => (
                <span className="num text-amber">{row.honor}</span>
              )},
              { key: 'apply', header: '', render: (row) => (
                notInCouncil ? (
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={() => { void api.post(`/council/${row.id}/apply`, {}); }}
                  >
                    Apply
                  </button>
                ) : null
              )},
            ]}
            rows={allCouncils?.data ?? []}
            emptyMsg="No councils found."
          />
        )}
      </div>
    </div>
  );
}
