import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { formatNumber } from '@/lib/utils';
import { ExternalLink, Star, Users as UsersIcon, Image as ImageIcon } from 'lucide-react';

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: {
      campaign: true,
      dmMessages: {
        include: {
          images: true,
          account: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      responses: {
        orderBy: { receivedAt: 'desc' },
      },
    },
  });

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <a
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        ← 返回客戶列表
      </a>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Profile Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Profile Card */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-3xl font-bold mb-4">
                {lead.username.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold">@{lead.username}</h2>
              <p className="text-muted-foreground mt-1">{lead.fullName}</p>
              <a
                href={lead.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
              >
                在 Instagram 查看
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">粉絲數</span>
                <span className="font-semibold">{formatNumber(lead.followersCount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">貼文數</span>
                <span className="font-semibold">{lead.postsCount}</span>
              </div>
            </div>

            {lead.biography && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-2">Bio</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {lead.biography}
                </p>
              </div>
            )}

            {lead.contactMethods && Object.keys(lead.contactMethods as object).length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-2">聯絡方式</p>
                <div className="space-y-1 text-sm">
                  {(lead.contactMethods as any).email && (
                    <p>📧 {(lead.contactMethods as any).email}</p>
                  )}
                  {(lead.contactMethods as any).phone && (
                    <p>📱 {(lead.contactMethods as any).phone}</p>
                  )}
                  {(lead.contactMethods as any).line && (
                    <p>💬 {(lead.contactMethods as any).line}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Analysis & DM */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI Analysis */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">AI 分析結果</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">推薦分數</span>
                  <span className="text-2xl font-bold text-primary">
                    {lead.score.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-green-500"
                    style={{ width: `${(lead.score / 10) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">推薦原因</p>
                <ul className="space-y-1">
                  {lead.reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Star className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* DM Section */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">發送 DM</h3>
            
            {lead.dmMessages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">尚未生成 DM</p>
                <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  生成 AI DM
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  ✨ DM 編輯與發送功能開發中...
                </p>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium mb-2">即將提供：</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 3 種風格的 AI 生成 DM</li>
                    <li>• 文字編輯器</li>
                    <li>• 多圖片上傳（最多 10 張）</li>
                    <li>• DM 預覽</li>
                    <li>• 一鍵發送</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Send History */}
          {lead.dmMessages.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">發送歷史</h3>
              <div className="space-y-3">
                {lead.dmMessages.map((dm) => (
                  <div
                    key={dm.id}
                    className="flex items-start gap-3 rounded-lg bg-muted p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {dm.style === 'PROFESSIONAL' && '專業風格'}
                          {dm.style === 'FRIENDLY' && '親切風格'}
                          {dm.style === 'VALUE_FOCUSED' && '價值導向'}
                        </span>
                        {dm.sentAt && (
                          <span className="text-xs text-muted-foreground">
                            · {formatDateTime(dm.sentAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {dm.content.substring(0, 100)}...
                      </p>
                      {dm.images.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          {dm.images.length} 張圖片
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        dm.status === 'SENT' && 'bg-green-100 text-green-800',
                        dm.status === 'APPROVED' && 'bg-blue-100 text-blue-800',
                        dm.status === 'AI_GENERATED' && 'bg-gray-100 text-gray-800'
                      )}>
                        {dm.status === 'SENT' && '已發送'}
                        {dm.status === 'APPROVED' && '已確認'}
                        {dm.status === 'AI_GENERATED' && 'AI生成'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Responses */}
          {lead.responses.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">客戶回應</h3>
              <div className="space-y-3">
                {lead.responses.map((response) => (
                  <div
                    key={response.id}
                    className="rounded-lg bg-green-50 border border-green-200 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">
                        {response.isPositive ? '😊 正面回應' : '回應'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(response.receivedAt)}
                      </span>
                    </div>
                    <p className="text-sm">{response.messageContent}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
