import { db } from '@/lib/db';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { DeleteCampaignButton } from '@/components/campaigns/delete-campaign-button';

export default async function CampaignsPage() {
  const campaigns = await db.campaign.findMany({
    include: {
      _count: {
        select: { leads: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">搜尋任務</h1>
          <p className="text-muted-foreground mt-2">
            管理您的 Instagram 搜尋任務
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          建立新任務
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">尚無搜尋任務</h3>
          <p className="text-muted-foreground mb-4">
            建立您的第一個搜尋任務，開始尋找潛在客戶
          </p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            建立任務
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{campaign.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDateTime(campaign.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      campaign.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {campaign.isActive ? '執行中' : '已暫停'}
                  </span>
                  <DeleteCampaignButton
                    campaignId={campaign.id}
                    campaignName={campaign.name}
                    variant="icon"
                  />
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Hashtags:</span>
                  <span className="font-medium">
                    {campaign.hashtags.slice(0, 2).join(', ')}
                    {campaign.hashtags.length > 2 && ` +${campaign.hashtags.length - 2}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">粉絲範圍:</span>
                  <span className="font-medium">
                    {campaign.minFollowers.toLocaleString()} - {campaign.maxFollowers.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">已找到:</span>
                  <span className="font-medium text-blue-600">
                    {campaign._count.leads} 個潛在客戶
                  </span>
                </div>
              </div>

              <Link
                href={`/campaigns/${campaign.id}`}
                className="inline-flex w-full items-center justify-center rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
              >
                查看詳情
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function Search({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
