import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { RunCampaignButton } from '@/components/campaigns/run-campaign-button';

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const campaign = await db.campaign.findUnique({
    where: { id: params.id },
    include: { _count: { select: { leads: true } } },
  });

  if (!campaign) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回搜尋任務
      </Link>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            建立於 {formatDateTime(campaign.createdAt)}
          </p>
        </div>

        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Hashtags</dt>
            <dd className="font-medium">{campaign.hashtags.join(', ')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">粉絲數範圍</dt>
            <dd className="font-medium">
              {campaign.minFollowers.toLocaleString()} - {campaign.maxFollowers.toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">已找到潛在客戶</dt>
            <dd className="font-medium">{campaign._count.leads} 個</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">狀態</dt>
            <dd>
              <span
                className={
                  campaign.isActive
                    ? 'text-green-600 font-medium'
                    : 'text-muted-foreground'
                }
              >
                {campaign.isActive ? '執行中' : '已暫停'}
              </span>
            </dd>
          </div>
        </dl>

        <RunCampaignButton campaignId={campaign.id} />
      </div>
    </div>
  );
}
