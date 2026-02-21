/**
 * 使用 OpenClaw 檢查 Instagram Direct inbox，解析對話列表並寫入 Response、AI 分類
 */

import { db } from '@/lib/db';
import { navigate, getSnapshot, isOpenClawAvailable, sleep } from './openclaw-adapter';
import { classifyResponseSentiment } from './ai';
import type { Sentiment } from '@prisma/client';

export interface InboxConversation {
  username: string;
  lastMessage: string;
}

/**
 * 從 OpenClaw snapshot 解析 inbox 對話列表（用戶名 + 最後一則訊息）
 * 依常見結構：含 [ref=...] 的行與鄰近文字，或符合用戶名格式的行與下一行訊息
 */
export function parseInboxSnapshot(snapshot: string): InboxConversation[] {
  const lines = snapshot.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const conversations: InboxConversation[] = [];
  const usernameRe = /^@?([a-zA-Z0-9_.]{1,30})$/;
  const refRe = /\[ref=(e\d+)\]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const clean = line.replace(refRe, '').trim();
    const userMatch = clean.match(usernameRe);
    if (userMatch && clean.length >= 2 && clean.length <= 30) {
      const username = userMatch[1].replace(/^@/, '');
      const nextLine = lines[i + 1];
      const lastMessage = nextLine && nextLine.length > 0 && nextLine.length < 500
        ? nextLine.replace(refRe, '').trim()
        : '';
      if (lastMessage && !lastMessage.match(usernameRe)) {
        conversations.push({ username, lastMessage });
        i++;
        continue;
      }
      conversations.push({ username, lastMessage: '' });
    }
  }

  return conversations;
}

/**
 * 對單一帳號（browser profile）檢查 inbox：導向 Direct、擷取 snapshot、解析、對應 Lead/DmMessage、建立 Response 並 AI 分類
 */
export async function checkInboxForAccount(browserProfile: string): Promise<{
  processed: number;
  created: number;
  errors: string[];
}> {
  const result = { processed: 0, created: 0, errors: [] as string[] };

  if (!isOpenClawAvailable()) {
    result.errors.push('OpenClaw 未設定');
    return result;
  }

  const profile = browserProfile || 'openclaw';

  navigate('https://www.instagram.com/direct/inbox/', profile);
  await sleep(4000);

  const snapshot = getSnapshot(profile);
  const conversations = parseInboxSnapshot(snapshot);

  for (const { username, lastMessage } of conversations) {
    if (!lastMessage) continue;

    try {
      const lead = await db.lead.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
        include: { dmMessages: { where: { status: 'SENT' }, take: 1, orderBy: { sentAt: 'desc' } } },
      });
      if (!lead || lead.dmMessages.length === 0) continue;

      const dmMessage = lead.dmMessages[0];
      const existing = await db.response.findFirst({
        where: { dmMessageId: dmMessage.id, messageContent: lastMessage },
      });
      if (existing) continue;

      const { sentiment, isPositive } = await classifyResponseSentiment(lastMessage);

      await db.response.create({
        data: {
          leadId: lead.id,
          dmMessageId: dmMessage.id,
          messageContent: lastMessage,
          receivedAt: new Date(),
          sentiment: sentiment as Sentiment,
          isPositive,
        },
      });

      await db.lead.update({
        where: { id: lead.id },
        data: { status: 'RESPONDED' },
      });

      result.processed++;
      result.created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`@${username}: ${msg}`);
    }
  }

  return result;
}

/**
 * 對所有已登入帳號執行 inbox 檢查
 */
export async function checkInboxAllAccounts(): Promise<{
  byProfile: Record<string, { processed: number; created: number; errors: string[] }>;
  totalCreated: number;
}> {
  const accounts = await db.instagramAccount.findMany({
    where: { isLoggedIn: true },
    select: { browserProfile: true },
  });

  const byProfile: Record<string, { processed: number; created: number; errors: string[] }> = {};
  let totalCreated = 0;

  for (const { browserProfile } of accounts) {
    const res = await checkInboxForAccount(browserProfile);
    byProfile[browserProfile] = res;
    totalCreated += res.created;
    await sleep(2000);
  }

  return { byProfile, totalCreated };
}
