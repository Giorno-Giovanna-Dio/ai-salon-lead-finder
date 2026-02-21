'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, User, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { formatDateTime } from '@/lib/utils';

type ActivityItem = {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
};

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CAMPAIGN_STARTED: '搜尋任務開始',
    CAMPAIGN_COMPLETED: '搜尋任務完成',
    DM_SENT: 'DM 已發送',
    ERROR: '發生錯誤',
  };
  return map[action] || action;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetch('/api/activity?limit=10')
      .then((res) => res.json())
      .then((d) => d.success && d.data && setActivities(d.data))
      .catch(() => {});
  }, [open]);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        <h2 className="text-lg font-semibold">歡迎回來</h2>
        <p className="text-sm text-muted-foreground">開始您的客戶開發工作</p>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative rounded-full p-2 hover:bg-muted transition-colors"
              aria-label="通知"
            >
              <Bell className="h-5 w-5" />
              {activities.length > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="z-50 min-w-[280px] rounded-lg border bg-card p-2 shadow-lg"
            align="end"
            sideOffset={8}
          >
            <div className="px-2 py-1.5 text-sm font-semibold">最近動態</div>
            {activities.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                尚無動態
              </div>
            ) : (
              activities.slice(0, 8).map((log) => (
                <DropdownMenuItem key={log.id} asChild>
                  <Link
                    href={
                      (log.metadata as { campaignId?: string })?.campaignId
                        ? `/campaigns/${(log.metadata as { campaignId?: string }).campaignId}`
                        : '/'
                    }
                    className="block rounded-md px-2 py-2 text-sm hover:bg-muted cursor-pointer"
                    onClick={() => setOpen(false)}
                  >
                    <span className="font-medium">{actionLabel(log.action)}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(log.timestamp)}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuItem asChild>
              <Link
                href="/activity"
                className="flex items-center gap-1 rounded-md px-2 py-2 text-sm text-primary hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                查看全部
                <ExternalLink className="h-3 w-3" />
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button type="button" className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium">Admin</span>
        </button>
      </div>
    </header>
  );
}
