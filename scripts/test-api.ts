/**
 * API 測試腳本（sandbox）
 * 使用方式：先啟動 dev server (PORT=3001 npm run dev)，再執行 npx tsx scripts/test-api.ts
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3001';

async function request(
  method: 'GET' | 'POST',
  path: string,
  body?: object
): Promise<{ status: number; ok: boolean; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('🧪 API 測試開始，base:', BASE);
  console.log('');

  // 從 DB 拿測試用 id（需在專案內執行，有 Prisma）
  let campaignId: string | null = null;
  let leadId: string | null = null;
  let dmMessageId: string | null = null;
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const [c = null, l = null, d = null] = await Promise.all([
      prisma.campaign.findFirst().then((r) => r?.id ?? null),
      prisma.lead.findFirst().then((r) => r?.id ?? null),
      prisma.dmMessage.findFirst().then((r) => r?.id ?? null),
    ]);
    campaignId = c;
    leadId = l;
    dmMessageId = d;
    await prisma.$disconnect();
  } catch (e) {
    console.log('⚠️ 無法從 DB 取得 id（請先執行 seed），僅測試 GET /api/accounts/stats');
  }

  // 1. GET /api/accounts/stats
  console.log('1️⃣ GET /api/accounts/stats');
  const r1 = await request('GET', '/api/accounts/stats');
  console.log('   Status:', r1.status, r1.ok ? '✅' : '❌');
  if (r1.data && typeof r1.data === 'object' && 'data' in r1.data) {
    console.log('   Data:', JSON.stringify((r1.data as { data: unknown }).data, null, 2).split('\n').join('\n   '));
  } else if (!r1.ok && 'error' in (r1.data as object)) {
    console.log('   Error:', (r1.data as { error: string }).error);
  }
  console.log('');

  // 2. POST /api/campaigns/[id]/run
  if (campaignId) {
    console.log('2️⃣ POST /api/campaigns/:id/run');
    const r2 = await request('POST', `/api/campaigns/${campaignId}/run`);
    console.log('   Status:', r2.status, r2.ok ? '✅' : '❌');
    if (!r2.ok && r2.data && typeof r2.data === 'object' && 'error' in r2.data) {
      console.log('   Error:', (r2.data as { error: string }).error);
    }
    console.log('');
  }

  // 3. POST /api/leads/[id]/dm（使用者上傳文案建立 DM）
  if (leadId) {
    console.log('3️⃣ POST /api/leads/:id/dm');
    const r3 = await request('POST', `/api/leads/${leadId}/dm`, {
      content: '嗨！我們是龍蝦配 ClawMatch，想與您聊聊合作機會～',
    });
    console.log('   Status:', r3.status, r3.ok ? '✅' : '❌');
    if (r3.ok && r3.data && typeof r3.data === 'object' && 'data' in r3.data) {
      const data = (r3.data as { data: { dmId?: string } }).data;
      if (data.dmId) dmMessageId = data.dmId;
    }
    if (!r3.ok && r3.data && typeof r3.data === 'object' && 'error' in r3.data) {
      console.log('   Error:', (r3.data as { error: string }).error);
    }
    console.log('');
  }

  // 4. POST /api/dm/[id]/send
  if (dmMessageId) {
    console.log('4️⃣ POST /api/dm/:id/send');
    const r4 = await request('POST', `/api/dm/${dmMessageId}/send`);
    console.log('   Status:', r4.status, r4.ok ? '✅' : '❌');
    if (!r4.ok && r4.data && typeof r4.data === 'object' && 'error' in r4.data) {
      console.log('   Error:', (r4.data as { error: string }).error);
    }
    console.log('');
  } else {
    console.log('4️⃣ POST /api/dm/:id/send — 略過（無 dm 訊息 id，可先對某 lead 執行 POST /api/leads/:id/dm）');
    console.log('');
  }

  console.log('🧪 API 測試結束');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
