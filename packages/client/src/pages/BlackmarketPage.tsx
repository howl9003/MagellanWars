import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { PageHeader, Card, Badge, SectionTitle, SkeletonCard, Empty } from '../components/ui.js';
import { useToastFn } from '../hooks/useToastContext.js';

interface Auction {
  id: number;
  type: number;
  item: number;
  winner: number;
  price: number;
  openedAt: string;
  expireAt: string;
  closedAt: string | null;
  numberOfPlanet: number;
  bids: Array<{ id: number; amount: number; bidderId: number }>;
  _count: { bids: number };
}

const ITEM_TYPE_LABELS: Record<number, string> = { 1: 'Tech', 2: 'Project', 3: 'Component' };

const ITEM_TYPE_VARIANTS: Record<number, 'accent' | 'purple' | 'teal'> = {
  1: 'accent',
  2: 'purple',
  3: 'teal',
};

function timeLeft(expireAt: string): string {
  const ms = new Date(expireAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function BlackmarketPage() {
  const qc = useQueryClient();
  const toast = useToastFn();
  const [bidAmounts, setBidAmounts] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['blackmarket'],
    queryFn: () => api.get<{ data: Auction[] }>('/blackmarket'),
    refetchInterval: 30_000,
  });

  const placeBid = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      api.post(`/blackmarket/${id}/bid`, { amount }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['blackmarket'] });
      setBidAmounts((prev) => { const next = { ...prev }; delete next[vars.id]; return next; });
      toast('Bid placed successfully!', 'success');
    },
  });

  if (isLoading) return (
    <div className="page">
      <PageHeader title="Black Market" subtitle="Bid on rare technologies and components" />
      <div className="grid-auto">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={4} />
        <SkeletonCard rows={4} />
      </div>
    </div>
  );

  const auctions = data?.data ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Black Market"
        subtitle={`${auctions.length} active auction${auctions.length !== 1 ? 's' : ''} — refreshes every 30s`}
      />

      {auctions.length === 0 ? (
        <Empty message="No active auctions at this time." />
      ) : (
        <div className="grid-auto">
          {auctions.map((a) => {
            const topBid = a.bids[0];
            const minBid = topBid ? topBid.amount + 1 : a.price;
            const expired = new Date(a.expireAt).getTime() <= Date.now();
            const typeLabel = ITEM_TYPE_LABELS[a.type] ?? `Type ${a.type}`;
            const typeVariant = ITEM_TYPE_VARIANTS[a.type] ?? 'muted';

            return (
              <Card key={a.id} glow={!expired}>
                <div className="flex-between mb-8">
                  <Badge variant={typeVariant}>{typeLabel}</Badge>
                  <span className={`text-sm ${expired ? 'text-red' : 'text-muted'}`}>
                    {timeLeft(a.expireAt)}
                  </span>
                </div>

                <p className="text-bright mb-8">
                  Item #{a.item}
                </p>

                <div className="flex gap-16 mb-12">
                  <div>
                    <div className="text-xs text-muted uppercase">Current Bid</div>
                    <div className="num text-accent">
                      {(topBid?.amount ?? a.price).toLocaleString()}
                      <span className="text-muted text-xs"> prod</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted uppercase">Bids</div>
                    <div className="num">{a._count.bids}</div>
                  </div>
                </div>

                {!expired && (
                  <div className="flex gap-8">
                    <div className="field" style={{ flex: 1, margin: 0 }}>
                      <input
                        type="number"
                        min={minBid}
                        placeholder={`Min ${minBid.toLocaleString()}`}
                        value={bidAmounts[a.id] ?? ''}
                        onChange={(e) =>
                          setBidAmounts((prev) => ({ ...prev, [a.id]: e.target.value }))
                        }
                      />
                    </div>
                    <button
                      className="btn btn--primary"
                      disabled={placeBid.isPending}
                      onClick={() =>
                        placeBid.mutate({ id: a.id, amount: parseInt(bidAmounts[a.id] ?? '0', 10) })
                      }
                    >
                      Bid
                    </button>
                  </div>
                )}

                {expired && (
                  <Badge variant="muted">Auction ended</Badge>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
