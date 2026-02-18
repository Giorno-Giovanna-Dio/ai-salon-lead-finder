import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 開始建立測試資料...');

  // 1. 建立測試 Campaign
  const campaign = await prisma.campaign.create({
    data: {
      name: '台北美髮沙龍搜尋',
      hashtags: ['台北美髮', '髮廊', '美髮沙龍', 'taipeihairstyle'],
      minFollowers: 3000,
      maxFollowers: 50000,
      isActive: true,
    },
  });
  console.log('✅ Campaign 建立完成');

  // 2. 建立測試 Instagram 帳號
  const accounts = await Promise.all([
    prisma.instagramAccount.create({
      data: {
        username: 'clawmatch_1',
        browserProfile: 'profile-1',
        dailyLimit: 100,
        todaySent: 15,
        isLoggedIn: true,
        status: 'ACTIVE',
      },
    }),
    prisma.instagramAccount.create({
      data: {
        username: 'clawmatch_2',
        browserProfile: 'profile-2',
        dailyLimit: 100,
        todaySent: 28,
        isLoggedIn: true,
        status: 'ACTIVE',
      },
    }),
    prisma.instagramAccount.create({
      data: {
        username: 'clawmatch_3',
        browserProfile: 'profile-3',
        dailyLimit: 100,
        todaySent: 42,
        isLoggedIn: true,
        status: 'ACTIVE',
      },
    }),
    prisma.instagramAccount.create({
      data: {
        username: 'clawmatch_4',
        browserProfile: 'profile-4',
        dailyLimit: 100,
        todaySent: 65,
        isLoggedIn: false,
        status: 'PAUSED',
      },
    }),
  ]);
  console.log('✅ 4 個 Instagram 帳號建立完成');

  // 3. 建立測試 Leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        campaignId: campaign.id,
        username: 'salon_beauty_taipei',
        fullName: '美麗時尚髮廊',
        biography: '台北東區質感髮廊 ✨ 剪髮/染髮/燙髮 專業造型師團隊',
        profileUrl: 'https://instagram.com/salon_beauty_taipei',
        followersCount: 8500,
        postsCount: 342,
        score: 9.2,
        reasons: [
          'Bio 明確提到「髮廊」',
          '粉絲數 8,500 在理想範圍',
          '使用商業帳號',
          '貼文數量活躍 (342)',
        ],
        status: 'DISCOVERED',
        contactMethods: {
          phone: '02-2771-xxxx',
          line: '@salonbeauty',
        },
      },
    }),
    prisma.lead.create({
      data: {
        campaignId: campaign.id,
        username: 'hair_studio_101',
        fullName: 'Studio 101 髮藝空間',
        biography: '信義區髮型設計 | 韓系造型專家 🇰🇷',
        profileUrl: 'https://instagram.com/hair_studio_101',
        followersCount: 12300,
        postsCount: 589,
        score: 8.8,
        reasons: [
          '專注於髮型設計',
          '粉絲數 12,300',
          '高活躍度 (589 貼文)',
          '韓系造型有特色',
        ],
        status: 'DISCOVERED',
      },
    }),
    prisma.lead.create({
      data: {
        campaignId: campaign.id,
        username: 'modern_salon_tw',
        fullName: '摩登髮廊 Modern Salon',
        biography: '台北中山區 🎨 專業剪染燙護 預約制',
        profileUrl: 'https://instagram.com/modern_salon_tw',
        followersCount: 5600,
        postsCount: 198,
        score: 8.5,
        reasons: [
          '明確的髮廊品牌',
          '粉絲數適中 (5,600)',
          '提供完整服務（剪染燙護）',
        ],
        status: 'DM_PREPARED',
      },
    }),
  ]);
  console.log('✅ 3 個測試 Leads 建立完成');

  // 4. 為第三個 Lead 建立 DM
  await prisma.dmMessage.create({
    data: {
      leadId: leads[2].id,
      accountId: accounts[0].id,
      style: 'FRIENDLY',
      content: `嗨！摩登髮廊團隊您好 👋

我是龍蝦配 ClawMatch 的夥伴，專注於美容美髮產業的數位行銷。

看到您們在 Instagram 上的作品真的很精彩！想跟您分享一個可以幫助髮廊快速找到更多目標客戶的 AI 配對系統。

不知道是否方便聊聊？😊`,
      status: 'APPROVED',
    },
  });
  console.log('✅ DM 訊息建立完成');

  // 5. 建立一些回應資料
  const dm = await prisma.dmMessage.findFirst({
    where: { status: 'APPROVED' },
  });

  if (dm) {
    await prisma.response.create({
      data: {
        dmMessageId: dm.id,
        leadId: dm.leadId,
        messageContent: '你好！聽起來很有趣，可以多了解一下嗎？',
        receivedAt: new Date(),
        isPositive: true,
        sentiment: 'POSITIVE',
        isProcessed: false,
      },
    });
    console.log('✅ Response 建立完成');
  }

  // 6. 建立活動日誌
  await Promise.all([
    prisma.activityLog.create({
      data: {
        type: 'CAMPAIGN_STARTED',
        details: {
          campaignId: campaign.id,
          campaignName: campaign.name,
        },
      },
    }),
    prisma.activityLog.create({
      data: {
        type: 'LEAD_CREATED',
        details: {
          leadId: leads[0].id,
          username: leads[0].username,
          score: leads[0].score,
        },
      },
    }),
  ]);
  console.log('✅ ActivityLog 建立完成');

  console.log('\n🎉 測試資料建立完成！');
  console.log('\n📊 總結:');
  console.log(`- 1 個搜尋任務`);
  console.log(`- 4 個 Instagram 帳號`);
  console.log(`- 3 個潛在客戶`);
  console.log(`- 1 個 DM 訊息`);
  console.log(`- 1 個客戶回應`);
  console.log(`- 2 筆活動日誌`);
  console.log('\n✅ 現在可以訪問 http://localhost:3001 查看資料！');
}

main()
  .catch((e) => {
    console.error('❌ 錯誤:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
