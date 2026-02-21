#!/usr/bin/env npx tsx
/**
 * 使用 OpenClaw 執行單一搜尋任務並將潛在客戶寫入 DB
 * 使用方式：npx tsx src/crawler/run-campaign-openclaw.ts <campaignId>
 * 需設定環境變數：OPENCLAW_PROJECT_ROOT, DATABASE_URL
 */

import { db } from '../lib/db';
import { runHashtagSearchForCampaign } from '../lib/openclaw-hashtag-search';
import { getCrawler } from './instagram-crawler';

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId) {
    console.error('用法: npx tsx src/crawler/run-campaign-openclaw.ts <campaignId>');
    process.exit(1);
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    console.error('Campaign not found:', campaignId);
    process.exit(1);
  }

  if (!campaign.isActive) {
    console.error('Campaign is not active');
    process.exit(1);
  }

  const account = await db.instagramAccount.findFirst({
    where: { isLoggedIn: true, status: 'ACTIVE' },
    orderBy: { lastUsedAt: 'asc' },
  });
  const browserProfile = account?.browserProfile || 'openclaw';

  console.log(`[OpenClaw] 執行任務: ${campaign.name}`);
  console.log(`[OpenClaw] Hashtags: ${campaign.hashtags.join(', ')}`);
  console.log(`[OpenClaw] Browser profile: ${browserProfile}`);

  const profiles = await runHashtagSearchForCampaign(campaign, {
    browserProfile,
    maxProfiles: campaign.maxLeads,
  });

  console.log(`[OpenClaw] 找到 ${profiles.length} 個符合條件的個人資料`);

  const crawler = getCrawler();
  let leadsCreated = 0;
  for (const profile of profiles) {
    const leadId = await crawler.analyzeAndCreateLead(profile, campaign.id);
    if (leadId) leadsCreated++;
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`[OpenClaw] 建立 ${leadsCreated} 個潛在客戶`);

  await db.activityLog.create({
    data: {
      action: 'CAMPAIGN_COMPLETED',
      metadata: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        profilesFound: profiles.length,
        leadsCreated,
      },
    },
  });

  await db.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[OpenClaw] Error:', err);
  await db.$disconnect();
  process.exit(1);
});
