/**
 * 使用 OpenClaw 執行 Hashtag 搜尋並回傳符合條件的 Instagram 個人資料
 * 供 run-campaign-openclaw 腳本與 runCampaign 使用
 */

import type { Campaign } from '@prisma/client';
import {
  isOpenClawAvailable,
  navigate,
  getSnapshot,
  sleep,
} from './openclaw-adapter';

export interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  profilePictureUrl: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified: boolean;
  isBusinessAccount: boolean;
  contactMethods: { email?: string; phone?: string; line?: string };
}

function parseCount(countStr: string): number {
  const cleaned = countStr.replace(/,/g, '').trim();
  if (cleaned.includes('萬')) {
    const num = parseFloat(cleaned.replace('萬', ''));
    return Math.round(num * 10000);
  }
  const multiplierMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*([KMkm])?/);
  if (!multiplierMatch) return 0;
  let num = parseFloat(multiplierMatch[1]);
  const multiplier = multiplierMatch[2]?.toUpperCase();
  if (multiplier === 'K') num *= 1000;
  if (multiplier === 'M') num *= 1000000;
  return Math.round(num);
}

function extractProfileFromSnapshot(
  snapshot: string,
  username: string
): Omit<InstagramProfile, 'username' | 'profilePictureUrl' | 'followingCount' | 'isVerified' | 'contactMethods'> {
  const followersMatch = snapshot.match(
    /(\d+(?:\.\d+)?[萬KMkm]?)位粉絲|(\d+(?:,\d+)*)\s*followers/i
  );
  let followersCount = 0;
  if (followersMatch) {
    const countStr = followersMatch[1] || followersMatch[2];
    followersCount = parseCount(countStr || '');
  }
  const postsMatch = snapshot.match(/"(\d+)"\s*貼文|(\d+)\s*posts/i);
  const postsCount = postsMatch ? parseInt(postsMatch[1] || postsMatch[2], 10) : 0;
  const isBusinessAccount =
    snapshot.includes('專業儀表板') ||
    snapshot.includes('Professional dashboard') ||
    snapshot.includes('數位創作者') ||
    snapshot.includes('Digital creator');
  const nameMatch = snapshot.match(/heading\s+"([^"]+)"/);
  const fullName = nameMatch ? nameMatch[1] : username;
  const bioMatch = snapshot.match(/button\s+"([^"]{30,500})"/);
  const biography = bioMatch ? bioMatch[1] : '';
  return {
    fullName,
    biography,
    followersCount,
    postsCount,
    isBusinessAccount,
  };
}

/**
 * 使用 OpenClaw 搜尋 Hashtag，回傳符合粉絲數範圍的個人資料
 * 需在已設定 OPENCLAW_PROJECT_ROOT 且該專案已安裝 openclaw 的環境執行
 */
export async function runHashtagSearchForCampaign(
  campaign: Campaign,
  options: { browserProfile?: string; maxProfiles?: number }
): Promise<InstagramProfile[]> {
  if (!isOpenClawAvailable()) {
    throw new Error('OpenClaw 未設定或不可用（請設定 OPENCLAW_PROJECT_ROOT）');
  }

  const profile = options.browserProfile || 'openclaw';
  const maxProfiles = options.maxProfiles ?? Math.min(campaign.maxLeads, 20);
  const results: InstagramProfile[] = [];
  const visited = new Set<string>();

  const debug = process.env.OPENCLAW_DEBUG === '1';

  for (const tag of campaign.hashtags.slice(0, 5)) {
    if (results.length >= maxProfiles) break;

    const hashtagUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
    try {
      navigate(hashtagUrl, profile);
      await sleep(3000);
    } catch (e) {
      if (debug) console.log(`[OpenClaw] #${tag} navigate 失敗:`, e);
      continue;
    }

    let snapshot: string;
    try {
      snapshot = getSnapshot(profile);
    } catch (e) {
      if (debug) console.log(`[OpenClaw] #${tag} getSnapshot 失敗:`, e);
      continue;
    }

    const mentionedUsers: string[] = [];
    const mentionMatches = snapshot.matchAll(/@([a-zA-Z0-9_.]{3,30})/g);
    for (const match of mentionMatches) {
      const u = match[1];
      if (
        !/^\d+$/.test(u) &&
        !['instagram', 'facebook', 'gmail', 'yahoo', 'hotmail'].includes(u.toLowerCase()) &&
        !visited.has(u)
      ) {
        mentionedUsers.push(u);
      }
    }
    const uniqueMentions = [...new Set(mentionedUsers)].slice(0, 10);

    console.log(`[OpenClaw] #${tag} snapshot 長度=${snapshot.length}，@mentions 原始=${mentionedUsers.length}，過濾後=${uniqueMentions.length}`);
    if (uniqueMentions.length === 0 && snapshot.length > 0 && snapshot.length <= 800) {
      console.log(`[OpenClaw] #${tag} snapshot 預覽: ${snapshot.slice(0, 400).replace(/\n/g, ' ')}…`);
    }

    for (const username of uniqueMentions) {
      if (results.length >= maxProfiles) break;
      if (visited.has(username)) continue;
      visited.add(username);

      try {
        navigate(`https://www.instagram.com/${username}/`, profile);
        await sleep(2000);
        const profileSnapshot = getSnapshot(profile);
        const extracted = extractProfileFromSnapshot(profileSnapshot, username);

        if (extracted.followersCount < campaign.minFollowers) {
          if (debug) console.log(`[OpenClaw] @${username} 粉絲 ${extracted.followersCount} < min ${campaign.minFollowers}，略過`);
          continue;
        }
        if (extracted.followersCount > campaign.maxFollowers) {
          if (debug) console.log(`[OpenClaw] @${username} 粉絲 ${extracted.followersCount} > max ${campaign.maxFollowers}，略過`);
          continue;
        }

        results.push({
          username,
          fullName: extracted.fullName,
          biography: extracted.biography,
          profilePictureUrl: '',
          followersCount: extracted.followersCount,
          followingCount: 0,
          postsCount: extracted.postsCount,
          isVerified: false,
          isBusinessAccount: extracted.isBusinessAccount,
          contactMethods: {},
        });
      } catch {
        // skip profile on error
      }
      await sleep(1500 + Math.random() * 1000);
    }
  }

  return results;
}
