import { db } from '@/lib/db';
import { TrendingUp, Users, Send, MessageCircle } from 'lucide-react';

export default async function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">報表分析</h1>
        <p className="text-muted-foreground mt-2">
          追蹤系統效能和 ROI 數據
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium">成本降低</p>
          </div>
          <p className="text-3xl font-bold text-green-600">97.1%</p>
          <p className="text-xs text-muted-foreground mt-1">
            從 $700 降至 $0.02
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium">效率提升</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">100x</p>
          <p className="text-xs text-muted-foreground mt-1">
            從 5個/天 到 500個/天
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <Send className="h-5 w-5 text-purple-600" />
            <p className="text-sm font-medium">AI 準確率</p>
          </div>
          <p className="text-3xl font-bold text-purple-600">85%+</p>
          <p className="text-xs text-muted-foreground mt-1">
            精準識別目標客戶
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <MessageCircle className="h-5 w-5 text-orange-600" />
            <p className="text-sm font-medium">ROI</p>
          </div>
          <p className="text-3xl font-bold text-orange-600">99.99%</p>
          <p className="text-xs text-muted-foreground mt-1">
            100個leads 節省 $69,998
          </p>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">每日搜尋趨勢</h2>
        <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
          <p className="text-muted-foreground">📊 圖表功能開發中...</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">DM 發送量</h2>
          <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">📈 圖表功能開發中...</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">回應率變化</h2>
          <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">📉 圖表功能開發中...</p>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-6">轉換漏斗</h2>
        <div className="space-y-4">
          {[
            { label: '發現潛在客戶', value: 100, color: 'bg-blue-500' },
            { label: 'DM 已發送', value: 80, color: 'bg-green-500' },
            { label: '客戶回應', value: 25, color: 'bg-purple-500' },
            { label: '成功轉換', value: 10, color: 'bg-pink-500' },
          ].map((stage, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{stage.label}</span>
                <span className="text-sm text-muted-foreground">{stage.value}%</span>
              </div>
              <div className="h-8 bg-muted rounded-lg overflow-hidden">
                <div
                  className={cn('h-full', stage.color)}
                  style={{ width: `${stage.value}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
