import { db } from '@/lib/db';
import { Users, Send, MessageCircle, TrendingUp } from 'lucide-react';

async function getStats() {
  const [
    totalLeads,
    dmsSent,
    responses,
    todayResponses,
  ] = await Promise.all([
    db.lead.count(),
    db.dmMessage.count({ where: { status: 'SENT' } }),
    db.response.count(),
    db.response.count({
      where: {
        receivedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  const responseRate = dmsSent > 0 ? ((responses / dmsSent) * 100).toFixed(1) : '0';

  return {
    totalLeads,
    dmsSent,
    responses,
    todayResponses,
    responseRate,
  };
}

export default async function Home() {
  const stats = await getStats();

  const cards = [
    {
      title: '潛在客戶',
      value: stats.totalLeads,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: '已發送 DM',
      value: stats.dmsSent,
      icon: Send,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: '總回應數',
      value: stats.responses,
      icon: MessageCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: '今日回應',
      value: `${stats.todayResponses}/10`,
      subtitle: '目標進度',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">儀表板</h1>
        <p className="text-muted-foreground mt-2">
          AI 驅動的 B2B 客戶開發系統 - 成本↓97% · 效率↑100x
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.subtitle}
                  </p>
                )}
              </div>
              <div className={cn('rounded-full p-3', card.bgColor)}>
                <card.icon className={cn('h-6 w-6', card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">效能指標</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">回應率</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.responseRate}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">成本節省</p>
            <p className="text-2xl font-bold text-blue-600">97.1%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">效率提升</p>
            <p className="text-2xl font-bold text-purple-600">100x</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">快速開始</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <a
            href="/campaigns/new"
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted transition-colors"
          >
            <Search className="h-8 w-8 text-blue-600" />
            <div>
              <p className="font-semibold">建立搜尋任務</p>
              <p className="text-sm text-muted-foreground">
                設定 hashtags 開始尋找潛在客戶
              </p>
            </div>
          </a>
          <a
            href="/leads"
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted transition-colors"
          >
            <Users className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-semibold">查看潛在客戶</p>
              <p className="text-sm text-muted-foreground">
                瀏覽 AI 分析的客戶列表
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
