import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import { Instagram, Key, Database, Bell, Globe } from 'lucide-react';
import { isOpenClawAvailable, getOpenClawMode, OPENCLAW_PROJECT_ROOT } from '@/lib/openclaw-adapter';

export default async function SettingsPage() {
  const accounts = await db.instagramAccount.findMany({
    orderBy: { browserProfile: 'asc' },
  });

  const accountStatusColors = {
    ACTIVE: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    BLOCKED: 'bg-red-100 text-red-800',
    COOLING: 'bg-blue-100 text-blue-800',
  };

  const accountStatusLabels = {
    ACTIVE: '正常運作',
    PAUSED: '已暫停',
    BLOCKED: '已封鎖',
    COOLING: '冷卻中',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">系統設定</h1>
        <p className="text-muted-foreground mt-2">
          管理 Instagram 帳號、API 設定和系統參數
        </p>
      </div>

      {/* OpenClaw 整合狀態 */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">OpenClaw 整合</h2>
        </div>
        {isOpenClawAvailable() ? (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-green-600">
              <span className="h-2 w-2 rounded-full bg-green-600" />
              {getOpenClawMode() === 'worker' ? '已連線 Crawler Worker（生產環境）' : '本地 OpenClaw 可用'}
            </p>
            {getOpenClawMode() === 'local' && OPENCLAW_PROJECT_ROOT && (
              <p className="text-muted-foreground">
                專案路徑：<code className="rounded bg-muted px-1">{OPENCLAW_PROJECT_ROOT}</code>
              </p>
            )}
            <p className="text-muted-foreground mt-2">
              Instagram 登入：請在 OpenClaw 專案中使用 <code className="rounded bg-muted px-1">browser-profile profile-1</code> ～ <code className="rounded bg-muted px-1">profile-4</code> 依序登入 4 個帳號，登入完成後於下方「Instagram 帳號管理」標記已登入。
            </p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">未偵測到 OpenClaw。若要使用 Hashtag 搜尋與實際發送 DM，請：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>設定環境變數 <code className="rounded bg-muted px-1">OPENCLAW_PROJECT_ROOT</code> 指向已安裝 openclaw 的專案路徑，或</li>
              <li>設定 <code className="rounded bg-muted px-1">CRAWLER_API_URL</code> 連線至 Crawler Worker（生產環境）</li>
            </ul>
          </div>
        )}
      </div>

      {/* Instagram Accounts */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Instagram className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold">Instagram 帳號管理</h2>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
            + 新增帳號
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Instagram className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">尚未設定 Instagram 帳號</p>
            <p className="text-sm text-muted-foreground mb-4">
              建議設定 4 個帳號，實現 24 小時持續運作
            </p>
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              設定第一個帳號
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold">@{account.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.browserProfile}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.isLoggedIn ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-600"></span>
                        已登入
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-600">
                        <span className="h-2 w-2 rounded-full bg-red-600"></span>
                        未登入
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">今日已發送</span>
                    <span className="font-medium">
                      {account.todaySent}/{account.dailyLimit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">狀態</span>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      accountStatusColors[account.status]
                    )}>
                      {accountStatusLabels[account.status]}
                    </span>
                  </div>
                  {account.lastUsedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">最後使用</span>
                      <span>{formatDateTime(account.lastUsedAt)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="flex-1 text-xs rounded border px-3 py-1.5 hover:bg-muted">
                    測試連線
                  </button>
                  <button className="flex-1 text-xs rounded border px-3 py-1.5 hover:bg-muted">
                    重新登入
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Settings */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Key className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">API 設定</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Gemini API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIza..."
                defaultValue={process.env.GEMINI_API_KEY}
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                readOnly
              />
              <button className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                測試
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ✅ 已設定 · 使用模型: {process.env.GEMINI_MODEL || 'gemini-1.5-flash'}
            </p>
          </div>
        </div>
      </div>

      {/* Search Parameters */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold">搜尋參數預設值</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-2 block">最小粉絲數</label>
            <input
              type="number"
              defaultValue={3000}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">最大粉絲數</label>
            <input
              type="number"
              defaultValue={100000}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">每日回應目標</label>
            <input
              type="number"
              defaultValue={10}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">DM 發送間隔（分鐘）</label>
            <input
              type="number"
              defaultValue={3}
              min={2}
              max={5}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-6">
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            儲存設定
          </button>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
