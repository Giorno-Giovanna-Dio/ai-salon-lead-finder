/**
 * 把「第一個已登入」的 Instagram 帳號的 browserProfile 改成 openclaw，
 * 這樣 run-campaign-openclaw 會用你已在 OpenClaw 裡登入 IG 的那個 profile。
 * （browserProfile 是唯一欄位，所以只改一筆）
 * 使用：npx tsx scripts/set-openclaw-profile.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const one = await prisma.instagramAccount.findFirst({
    where: { isLoggedIn: true },
    orderBy: { lastUsedAt: 'asc' },
  });
  if (!one) {
    console.log('沒有已登入的帳號，略過');
    return;
  }
  await prisma.instagramAccount.update({
    where: { id: one.id },
    data: { browserProfile: 'openclaw' },
  });
  console.log('已將帳號', one.username, '的 browserProfile 設為 openclaw');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
