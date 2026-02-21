import { db } from '@/lib/db';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import { Bell } from 'lucide-react';

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CAMPAIGN_STARTED: '搜尋任務開始',
    CAMPAIGN_COMPLETED: '搜尋任務完成',
    DM_SENT: 'DM 已發送',
    ERROR: '發生錯誤',
  };
  return map[action] || action;
}

export default async function ActivityPage() {
  const logs = await db.activityLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">動態紀錄</h1>
        <p className="text-muted-foreground mt-2">系統操作與任務執行紀錄</p>
      </div>

      <div className="rounded-lg border bg-card">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            尚無動態
          </div>
        ) : (
          <ul className="divide-y">
            {logs.map((log) => {
              const meta = log.metadata as { campaignId?: string; campaignName?: string; error?: string } | null;
              const href = meta?.campaignId ? `/campaigns/${meta.campaignId}` : undefined;
              return (
                <li key={log.id}>
                  <div className="px-6 py-4">
                    {href ? (
                      <Link href={href} className="block hover:bg-muted/50 -mx-6 px-6 py-4 rounded-lg transition-colors">
                        <span className="font-medium">{actionLabel(log.action)}</span>
                        {meta?.campaignName && (
                          <span className="text-muted-foreground ml-2">· {meta.campaignName}</span>
                        )}
                        {meta?.error && (
                          <span className="block text-sm text-destructive mt-1">{meta.error}</span>
                        )}
                        <span className="block text-xs text-muted-foreground mt-1">
                          {formatDateTime(log.timestamp)}
                        </span>
                      </Link>
                    ) : (
                      <>
                        <span className="font-medium">{actionLabel(log.action)}</span>
                        {meta?.error && (
                          <span className="block text-sm text-destructive mt-1">{meta.error}</span>
                        )}
                        <span className="block text-xs text-muted-foreground mt-1">
                          {formatDateTime(log.timestamp)}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
