'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

type ActivityItem = {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
};

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CAMPAIGN_STARTED: '任務開始',
    CAMPAIGN_COMPLETED: '任務完成',
    ERROR: '錯誤',
  };
  return map[action] || action;
}

export function OpenClawDemoPanel({ campaignId }: { campaignId: string }) {
  const [iframeOpen, setIframeOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const fetchLogs = () => {
      fetch(`/api/activity?campaignId=${campaignId}&limit=15`)
        .then((res) => res.json())
        .then((d) => d.success && d.data && setActivities(d.data))
        .catch(() => {});
    };
    fetchLogs();
    const t = setInterval(fetchLogs, 5000);
    return () => clearInterval(t);
  }, [campaignId]);

  return (
    <div className="space-y-4">
      {/* OpenClaw 執行說明（實際 IG 搜尋在獨立 browser 視窗，無法內嵌） */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setIframeOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        >
          <span className="font-medium">OpenClaw 執行說明</span>
          {iframeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {iframeOpen && (
          <div className="border-t p-4 bg-muted/30 space-y-3">
            <p className="text-sm text-muted-foreground">
              執行任務時，OpenClaw 會在<strong>您電腦上另開一個瀏覽器視窗</strong>進行 Instagram 搜尋，該視窗由 OpenClaw 直接控制，<strong>無法嵌進本網站</strong>。請在執行「執行任務」時留意本機是否彈出該 browser 視窗，即可看到即時搜尋畫面。
            </p>
          </div>
        )}
      </div>

      {/* 此任務最近執行紀錄 */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setLogsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        >
          <span className="font-medium">此任務最近執行紀錄</span>
          {logsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {logsOpen && (
          <ul className="border-t divide-y max-h-48 overflow-y-auto">
            {activities.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">尚無紀錄</li>
            ) : (
              activities.map((log) => (
                <li key={log.id} className="px-4 py-2 text-sm">
                  <span className="font-medium">{actionLabel(log.action)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(log.timestamp)}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
