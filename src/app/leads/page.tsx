import { db } from '@/lib/db';
import Link from 'next/link';
import { ExternalLink, Star, LayoutGrid } from 'lucide-react';
import { formatNumber, formatDateTime } from '@/lib/utils';

export default async function LeadsPage() {
  const leads = await db.lead.findMany({
    include: {
      campaign: {
        select: { name: true },
      },
      _count: {
        select: { dmMessages: true, responses: true },
      },
    },
    orderBy: { score: 'desc' },
    take: 50,
  });

  const statusConfig = {
    DISCOVERED: { label: '已發現', color: 'bg-blue-100 text-blue-800' },
    DM_PREPARED: { label: 'DM已準備', color: 'bg-yellow-100 text-yellow-800' },
    DM_SENT: { label: '已發送', color: 'bg-green-100 text-green-800' },
    RESPONDED: { label: '已回應', color: 'bg-purple-100 text-purple-800' },
    CONVERTED: { label: '已成交', color: 'bg-pink-100 text-pink-800' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">潛在客戶</h1>
          <p className="text-muted-foreground mt-2">
            AI 分析的客戶列表 · 共 {leads.length} 位
          </p>
        </div>
        <Link
          href="/leads/board"
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <LayoutGrid className="h-4 w-4" />
          看板檢視
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">尚無潛在客戶</h3>
          <p className="text-muted-foreground mb-4">
            建立搜尋任務來發現潛在客戶
          </p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            建立搜尋任務
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">客戶</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">分數</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">粉絲數</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">狀態</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">來源</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">發現時間</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-3 hover:opacity-90 transition-opacity"
                      >
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-semibold">
                          {lead.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">@{lead.username}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {lead.fullName}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold">{lead.score.toFixed(1)}</span>
                        <span className="text-muted-foreground">/10</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">{formatNumber(lead.followersCount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                        statusConfig[lead.status].color
                      )}>
                        {statusConfig[lead.status].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {lead.campaign.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(lead.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        查看詳情
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
