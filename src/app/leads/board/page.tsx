import { db } from '@/lib/db';
import Link from 'next/link';
import { LeadsBoard } from '@/components/leads/leads-board';
import { LayoutGrid, List } from 'lucide-react';

export default async function LeadsBoardPage() {
  const leads = await db.lead.findMany({
    include: {
      campaign: { select: { name: true } },
    },
    orderBy: { score: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">潛在客戶看板</h1>
          <p className="text-muted-foreground mt-2">
            拖曳卡片可更新狀態 · 共 {leads.length} 位
          </p>
        </div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <List className="h-4 w-4" />
          列表檢視
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">尚無潛在客戶</h3>
          <p className="text-muted-foreground mb-4">建立搜尋任務來發現潛在客戶</p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            建立搜尋任務
          </Link>
        </div>
      ) : (
        <LeadsBoard initialLeads={leads} />
      )}
    </div>
  );
}
