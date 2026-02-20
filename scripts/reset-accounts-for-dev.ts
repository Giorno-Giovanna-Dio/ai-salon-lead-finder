/**
 * 開發用：重置所有 Instagram 帳號的今日發送數與上次使用時間，
 * 讓 getAvailableAccount() 能再次選到帳號（避免「All accounts are cooling down」）。
 * 使用方式：npx tsx scripts/reset-accounts-for-dev.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.instagramAccount.updateMany({
    data: {
      todaySent: 0,
      lastUsedAt: null,
    },
  });
  console.log('✅ 已重置', result.count, '個帳號（todaySent=0, lastUsedAt=null）');
  console.log('   可重新執行 API 測試或發送 DM。');
}

main()
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Can't reach database server")) {
      console.error('❌ 無法連線到資料庫');
      console.error('');
      console.error('請檢查：');
      console.error('  1. 網路是否正常（可開瀏覽器試開 https://supabase.com）');
      console.error('  2. Supabase 專案是否已暫停（免費方案閒置會暫停，到 Dashboard 按 Resume）');
      console.error('  3. .env 的 DATABASE_URL 是否正確');
      console.error('');
      console.error('原始錯誤：', msg);
    } else {
      console.error('❌', e);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
