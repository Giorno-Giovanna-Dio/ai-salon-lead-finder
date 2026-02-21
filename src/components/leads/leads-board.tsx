'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Star, GripVertical } from 'lucide-react';
import type { LeadStatus } from '@prisma/client';

const STATUS_ORDER: LeadStatus[] = ['DISCOVERED', 'DM_PREPARED', 'DM_SENT', 'RESPONDED', 'CONVERTED'];

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  DISCOVERED: { label: '已發現', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  DM_PREPARED: { label: 'DM已準備', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  DM_SENT: { label: '已發送', color: 'bg-green-100 text-green-800 border-green-200' },
  RESPONDED: { label: '已回應', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  CONVERTED: { label: '已成交', color: 'bg-pink-100 text-pink-800 border-pink-200' },
};

type Lead = {
  id: string;
  username: string;
  fullName: string | null;
  score: number;
  followersCount: number;
  status: LeadStatus;
  campaign: { name: string };
};

export function LeadsBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null);

  const byStatus = useCallback((status: LeadStatus) => leads.filter((l) => l.status === status), [leads]);

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(leadId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, newStatus: LeadStatus) => {
      e.preventDefault();
      setDropTarget(null);
      const leadId = e.dataTransfer.getData('text/plain');
      if (!leadId) return;
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.status === newStatus) return;

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );

      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          setLeads((prev) =>
            prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l))
          );
        }
      } catch {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l))
        );
      }
      setDraggingId(null);
    },
    [leads]
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[420px]">
      {STATUS_ORDER.map((status) => (
        <div
          key={status}
          onDragOver={(e) => handleDragOver(e, status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status)}
          className={`
            flex-shrink-0 w-64 rounded-xl border-2 transition-colors
            ${dropTarget === status ? 'border-primary bg-primary/5' : 'border-muted bg-muted/30'}
          `}
        >
          <div
            className={`sticky top-0 rounded-t-xl px-3 py-2 border-b ${STATUS_CONFIG[status].color}`}
          >
            <span className="font-semibold text-sm">{STATUS_CONFIG[status].label}</span>
            <span className="ml-2 text-xs opacity-80">({byStatus(status).length})</span>
          </div>
          <div className="p-2 space-y-2 min-h-[320px]">
            {byStatus(status).map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => handleDragStart(e, lead.id)}
                onDragEnd={handleDragEnd}
                className={`
                  rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing
                  hover:shadow-md transition-shadow
                  ${draggingId === lead.id ? 'opacity-50' : ''}
                `}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-sm hover:underline truncate block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{lead.username}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">{lead.fullName ?? '-'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs">{lead.score.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">
                        · {lead.followersCount.toLocaleString()} 粉絲
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{lead.campaign.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
