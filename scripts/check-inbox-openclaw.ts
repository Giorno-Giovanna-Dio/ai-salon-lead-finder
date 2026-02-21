/**
 * 使用 OpenClaw 檢查所有已登入帳號的 Instagram Direct inbox，並將新回覆寫入 DB、AI 分類
 * 使用方式：先啟動 dev server，再執行 npx tsx scripts/check-inbox-openclaw.ts
 * 或直接呼叫 API：POST /api/accounts/check-inbox
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000';

async function main() {
  console.log('📬 檢查 inbox（OpenClaw）...', BASE);
  const res = await fetch(`${BASE}/api/accounts/check-inbox`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('❌', (data as { error?: string }).error ?? res.statusText);
    process.exit(1);
  }

  const payload = data as { success?: boolean; data?: { byProfile?: Record<string, { processed: number; created: number; errors: string[] }>; totalCreated?: number } };
  if (!payload.success || !payload.data) {
    console.error('❌ 回應格式異常', data);
    process.exit(1);
  }

  console.log('✅ 完成，新增回應數：', payload.data.totalCreated ?? 0);
  const byProfile = payload.data.byProfile ?? {};
  for (const [profile, stat] of Object.entries(byProfile)) {
    console.log(`   ${profile}: 處理 ${stat.processed}，新增 ${stat.created}`);
    stat.errors.forEach((e) => console.log('   ⚠️', e));
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
