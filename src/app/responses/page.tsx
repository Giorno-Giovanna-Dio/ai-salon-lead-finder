import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import { Target, TrendingUp } from 'lucide-react';

export default async function ResponsesPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayResponses, allResponses] = await Promise.all([
    db.response.findMany({
      where: {
        receivedAt: { gte: today },
      },
      include: {
        lead: true,
        dmMessage: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    }),
    db.response.findMany({
      include: {
        lead: true,
        dmMessage: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    }),
  ]);

  const dailyGoal = 10;
  const achievementRate = Math.min((todayResponses.length / dailyGoal) * 100, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">回應追蹤</h1>
        <p className="text-muted-foreground mt-2">
          追蹤客戶回應，達成每日業績目標
        </p>
      </div>

      {/* Daily Goal Progress */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-orange-600" />
            <div>
              <h2 className="text-lg font-semibold">今日回應進度</h2>
              <p className="text-sm text-muted-foreground">
                每日目標：{dailyGoal} 個店家回覆
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">
              {todayResponses.length}
              <span className="text-lg text-muted-foreground">/{dailyGoal}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {achievementRate.toFixed(0)}% 完成
            </p>
          </div>
        </div>

        <div className="relative h-4 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-green-500 transition-all duration-500"
            style={{ width: `${achievementRate}%` }}
          ></div>
        </div>

        {achievementRate >= 100 && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-green-800 font-semibold">
              🎉 恭喜！已達成今日目標
            </p>
          </div>
        )}

        {achievementRate < 100 && (
          <p className="mt-4 text-sm text-muted-foreground text-center">
            再加油！還差 {dailyGoal - todayResponses.length} 個回覆
          </p>
        )}
      </div>

      {/* Today's Responses */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">今日回應 ({todayResponses.length})</h3>
        
        {todayResponses.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">今日尚無回應</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayResponses.map((response) => (
              <div
                key={response.id}
                className={cn(
                  'rounded-lg border p-4',
                  response.sentiment === 'POSITIVE' && 'bg-green-50 border-green-200',
                  response.sentiment === 'NEUTRAL' && 'bg-gray-50 border-gray-200',
                  response.sentiment === 'NEGATIVE' && 'bg-red-50 border-red-200',
                  response.sentiment === 'NEEDS_REVIEW' && 'bg-yellow-50 border-yellow-200'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/leads/${response.leadId}`}
                      className="font-medium hover:underline"
                    >
                      @{response.lead.username}
                    </a>
                    <span className="text-sm text-muted-foreground">
                      {response.lead.fullName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {response.sentiment === 'POSITIVE' && <span>😊</span>}
                    {response.sentiment === 'NEUTRAL' && <span>😐</span>}
                    {response.sentiment === 'NEGATIVE' && <span>😞</span>}
                    {response.sentiment === 'NEEDS_REVIEW' && <span>❓</span>}
                    <span className="text-xs text-muted-foreground">
                      {new Date(response.receivedAt).toLocaleTimeString('zh-TW', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <p className="text-sm">{response.messageContent}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Responses */}
      {allResponses.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">所有回應 ({allResponses.length})</h3>
          <div className="space-y-2">
            {allResponses.slice(0, 20).map((response) => (
              <div
                key={response.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {response.sentiment === 'POSITIVE' && '😊'}
                    {response.sentiment === 'NEUTRAL' && '😐'}
                    {response.sentiment === 'NEGATIVE' && '😞'}
                    {response.sentiment === 'NEEDS_REVIEW' && '❓'}
                  </span>
                  <div>
                    <a
                      href={`/leads/${response.leadId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      @{response.lead.username}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(response.receivedAt)}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  response.isProcessed
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-green-100 text-green-600'
                )}>
                  {response.isProcessed ? '已處理' : '待處理'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function MessageCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
