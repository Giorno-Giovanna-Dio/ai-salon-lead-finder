#!/usr/bin/env bun
/**
 * Hair Lead Finder - Real Crawler
 *
 * Uses the actual OpenClaw browser CLI to crawl Instagram
 * and analyze profiles with LLM.
 */

import { execSync } from "child_process";
import OpenAI from "openai";

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(color: keyof typeof colors, ...args: unknown[]): void {
  console.log(colors[color], ...args, colors.reset);
}

// Configuration
const CONFIG = {
  hashtags: ["台北美髮", "新竹美髮", "台中美髮"], // Multiple hashtags
  maxProfiles: 5,
  minFollowers: 500,
  maxFollowers: 100000,
  companyName: "預約通 BookingPro",
  serviceDescription: "我們提供美容美髮業專用的線上預約系統，讓顧客可以 24 小時線上預約",
};

// Project root for CLI commands
const PROJECT_ROOT = "/Users/davidchung/Desktop/coding_projects/clawdbot_hair_domain";

/**
 * Execute OpenClaw browser command
 */
function browserCmd(cmd: string, timeout = 30000): string {
  try {
    const fullCmd = `cd ${PROJECT_ROOT} && pnpm openclaw browser --browser-profile openclaw ${cmd}`;
    log("dim", `  $ ${cmd}`);
    const result = execSync(fullCmd, {
      timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result;
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    console.error("Browser command failed:", err.stderr || err.message);
    throw error;
  }
}

/**
 * Wait for a specified time
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Navigate to a URL
 */
async function navigate(url: string): Promise<void> {
  try {
    browserCmd(`navigate "${url}"`, 60000);
  } catch {
    log("yellow", `  ⚠️ Navigation blocked, trying via address bar...`);
    // If blocked, use click on search and type URL
  }
  await sleep(2000);
}

/**
 * Get page snapshot
 */
function getSnapshot(): string {
  return browserCmd("snapshot", 30000);
}

/**
 * Click an element by ref
 */
function click(ref: string): void {
  browserCmd(`click ${ref}`, 15000);
}

/**
 * Extract profile data from snapshot
 */
function extractProfileFromSnapshot(snapshot: string, username: string): {
  fullName: string;
  biography: string;
  followersCount: number;
  postsCount: number;
  isBusinessAccount: boolean;
} {
  // Parse follower count
  const followersMatch = snapshot.match(/(\d+(?:\.\d+)?[萬KMkm]?)位粉絲|(\d+(?:,\d+)*)\s*followers/i);
  let followersCount = 0;
  if (followersMatch) {
    const countStr = followersMatch[1] || followersMatch[2];
    followersCount = parseCount(countStr);
  }

  // Parse posts count
  const postsMatch = snapshot.match(/"(\d+)"\s*貼文|(\d+)\s*posts/i);
  const postsCount = postsMatch ? parseInt(postsMatch[1] || postsMatch[2]) : 0;

  // Check for business indicators
  const isBusinessAccount = snapshot.includes("專業儀表板") ||
    snapshot.includes("Professional dashboard") ||
    snapshot.includes("數位創作者") ||
    snapshot.includes("Digital creator");

  // Extract full name (usually in heading)
  const nameMatch = snapshot.match(/heading\s+"([^"]+)"/);
  const fullName = nameMatch ? nameMatch[1] : username;

  // Extract biography
  const bioMatch = snapshot.match(/button\s+"([^"]{30,500})"/);
  const biography = bioMatch ? bioMatch[1] : "";

  return {
    fullName,
    biography,
    followersCount,
    postsCount,
    isBusinessAccount,
  };
}

/**
 * Parse count string (e.g., "60.3萬" -> 603000)
 */
function parseCount(countStr: string): number {
  const cleaned = countStr.replace(/,/g, "").trim();

  if (cleaned.includes("萬")) {
    const num = parseFloat(cleaned.replace("萬", ""));
    return Math.round(num * 10000);
  }

  const multiplierMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*([KMkm])?/);
  if (!multiplierMatch) return 0;

  let num = parseFloat(multiplierMatch[1]);
  const multiplier = multiplierMatch[2]?.toUpperCase();

  if (multiplier === "K") num *= 1000;
  if (multiplier === "M") num *= 1000000;

  return Math.round(num);
}

/**
 * Analyze profile with LLM
 */
async function analyzeWithLLM(
  profile: {
    username: string;
    fullName: string;
    biography: string;
    followersCount: number;
    postsCount: number;
    isBusinessAccount: boolean;
  }
): Promise<{
  isLikelyOwner: boolean;
  score: number;
  reasons: string[];
  dmOptions: Array<{ style: string; content: string }>;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("yellow", "  ⚠️ No OPENAI_API_KEY, using heuristic analysis");
    // Simple heuristic
    const bio = profile.biography.toLowerCase();
    const isLikely = bio.includes("店長") || bio.includes("預約") ||
      bio.includes("hair") || bio.includes("美髮") ||
      bio.includes("salon") || profile.isBusinessAccount;
    return {
      isLikelyOwner: isLikely,
      score: isLikely ? 6 : 3,
      reasons: isLikely ? ["商業帳號/相關關鍵字"] : ["無明確店長標識"],
      dmOptions: [],
    };
  }

  const client = new OpenAI({ apiKey });

  const prompt = `分析這個 Instagram 帳號，判斷是否為美容美髮沙龍的店長/經營者：

用戶名：${profile.username}
顯示名稱：${profile.fullName}
Bio：${profile.biography}
追蹤者：${profile.followersCount}
貼文數：${profile.postsCount}
商業帳號：${profile.isBusinessAccount ? "是" : "否"}

我們的服務：${CONFIG.companyName} - ${CONFIG.serviceDescription}

請回傳 JSON：
{
  "isLikelyOwner": boolean,
  "score": number (0-10),
  "reasons": ["原因1", "原因2"],
  "dmOptions": [
    {"style": "professional", "content": "專業風格 DM (100-150字)"},
    {"style": "friendly", "content": "親切風格 DM (100-150字)"}
  ]
}

只回傳 JSON，不要其他文字。`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("LLM analysis failed:", error);
  }

  return {
    isLikelyOwner: false,
    score: 0,
    reasons: ["LLM 分析失敗"],
    dmOptions: [],
  };
}

/**
 * Main crawler function
 */
async function main() {
  log("bright", "\n🌐 Hair Lead Finder - Real Instagram Crawler\n");

  const apiKey = process.env.OPENAI_API_KEY;
  log("cyan", `📋 設定:`);
  console.log(`   Hashtags: ${CONFIG.hashtags.join(", ")}`);
  console.log(`   最大搜尋: ${CONFIG.maxProfiles} 個`);
  console.log(`   LLM: ${apiKey ? "gpt-4o-mini ✅" : "Heuristic (無 API Key)"}`);
  console.log();

  const discoveredLeads: Array<{
    username: string;
    fullName: string;
    followersCount: number;
    score: number;
    reasons: string[];
  }> = [];

  const visitedProfiles = new Set<string>();

  // Search each hashtag
  for (const hashtag of CONFIG.hashtags) {
    log("blue", `🔍 搜尋 #${hashtag}...`);

    // Navigate to hashtag page
    const hashtagUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`;

    try {
      await navigate(hashtagUrl);
    } catch {
      log("red", `  ❌ 無法導航到 #${hashtag}，跳過...`);
      continue;
    }

    await sleep(3000);

    // Get snapshot of hashtag page
    let snapshot: string;
    try {
      snapshot = getSnapshot();
    } catch {
      log("red", `  ❌ 無法取得快照，跳過...`);
      continue;
    }

    // Strategy 1: Extract @mentions from the hashtag page directly
    // These are often real salon accounts tagged in posts
    const mentionedUsers: string[] = [];
    const mentionMatches = snapshot.matchAll(/@([a-zA-Z0-9_.]{3,30})/g);
    for (const match of mentionMatches) {
      const username = match[1];
      // Filter out common non-user patterns
      if (!username.match(/^\d+$/) && // Not just numbers
          !["instagram", "facebook", "gmail", "yahoo", "hotmail"].includes(username.toLowerCase()) &&
          !visitedProfiles.has(username)) {
        mentionedUsers.push(username);
      }
    }
    const uniqueMentions = [...new Set(mentionedUsers)].slice(0, 10);
    log("dim", `  找到 ${uniqueMentions.length} 個 @mentions`);

    // Visit mentioned profiles directly (more efficient than clicking posts)
    for (const username of uniqueMentions) {
      if (discoveredLeads.length >= CONFIG.maxProfiles) break;
      if (visitedProfiles.has(username)) continue;
      visitedProfiles.add(username);

      log("cyan", `  👤 直接訪問 @${username}...`);

      try {
        await navigate(`https://www.instagram.com/${username}/`);
        await sleep(2000);

        const profileSnapshot = getSnapshot();
        const profile = extractProfileFromSnapshot(profileSnapshot, username);

        log("dim", `    追蹤者: ${profile.followersCount.toLocaleString()}`);

        if (profile.followersCount < CONFIG.minFollowers) {
          log("dim", `    ⏭️ 追蹤者太少 (${profile.followersCount})`);
          continue;
        }
        if (profile.followersCount > CONFIG.maxFollowers) {
          log("dim", `    ⏭️ 追蹤者太多 (${profile.followersCount})`);
          continue;
        }

        log("magenta", `  🤖 AI 分析中...`);
        const analysis = await analyzeWithLLM({ username, ...profile });

        if (analysis.isLikelyOwner && analysis.score >= 5) {
          discoveredLeads.push({
            username,
            fullName: profile.fullName,
            followersCount: profile.followersCount,
            score: analysis.score,
            reasons: analysis.reasons,
          });

          log("green", `  🎯 發現潛在客戶！`);
          console.log(`      @${username} (${profile.fullName})`);
          console.log(`      分數: ${analysis.score}/10`);
          console.log(`      原因: ${analysis.reasons.join(", ")}`);
        } else {
          log("dim", `    ⏭️ 不符合條件 (分數: ${analysis.score})`);
        }

        await sleep(2000 + Math.random() * 2000);

      } catch (error) {
        console.error(`Error visiting @${username}:`, error);
        await sleep(1000);
      }
    }

    // Strategy 2: Also check posts if we need more leads
    if (discoveredLeads.length >= CONFIG.maxProfiles) continue;

    // Find clickable post refs - look for links with /p/ URLs (Instagram posts)
    // The format is: link "..." [ref=eXXX] followed by - /url: /p/...
    const postRefs: string[] = [];
    const lines = snapshot.split("\n");
    let lastRef: string | null = null;

    for (const line of lines) {
      // Capture ref from link lines
      const refMatch = line.match(/link\s+"[^"]+"\s+\[ref=(e\d+)\]/);
      if (refMatch) {
        lastRef = refMatch[1];
      }

      // If we see a /p/ URL, use the last captured ref
      if ((line.includes("/url: /p/") || line.includes("/url: /reel/")) && lastRef) {
        postRefs.push(lastRef);
        lastRef = null; // Reset to avoid duplicates
      }
    }

    // Remove duplicates and limit
    const uniqueRefs = [...new Set(postRefs)].slice(0, 5);
    log("dim", `  找到 ${uniqueRefs.length} 個貼文 refs`);

    // Click on posts and analyze profiles
    for (let i = 0; i < Math.min(uniqueRefs.length, CONFIG.maxProfiles); i++) {
      const ref = uniqueRefs[i];

      if (discoveredLeads.length >= CONFIG.maxProfiles) break;

      log("blue", `  📸 點擊貼文 ${i + 1}/${uniqueRefs.length} (ref: ${ref})...`);

      try {
        click(ref);
        await sleep(2000);

        // Get post snapshot to find username
        const postSnapshot = getSnapshot();

        // Extract username from post - look for profile link or @mention
        // Pattern 1: link "username" with /url: /username/
        // Pattern 2: @username in the description
        let username: string | null = null;

        // Look for profile link pattern: /url: /username/
        const profileUrlMatch = postSnapshot.match(/\/url:\s+\/([a-zA-Z0-9_.]+)\//);
        if (profileUrlMatch && !["p", "reel", "reels", "explore", "direct"].includes(profileUrlMatch[1])) {
          username = profileUrlMatch[1];
        }

        // Fallback: look for @username mention
        if (!username) {
          const mentionMatch = postSnapshot.match(/@([a-zA-Z0-9_.]{3,30})/);
          if (mentionMatch) {
            username = mentionMatch[1];
          }
        }

        // Fallback: look for heading with username
        if (!username) {
          const headingMatch = postSnapshot.match(/heading\s+"([a-zA-Z0-9_.]+)"/);
          if (headingMatch) {
            username = headingMatch[1];
          }
        }

        if (!username) {
          log("dim", `    ⏭️ 無法找到用戶名，跳過`);
          browserCmd("press Escape");
          await sleep(1000);
          continue;
        }
        if (visitedProfiles.has(username)) {
          log("dim", `    ⏭️ 已訪問過 @${username}，跳過`);
          browserCmd("press Escape");
          await sleep(1000);
          continue;
        }
        visitedProfiles.add(username);

        log("cyan", `  👤 分析 @${username}...`);

        // Close modal
        browserCmd("press Escape");
        await sleep(1000);

        // Navigate to profile
        await navigate(`https://www.instagram.com/${username}/`);
        await sleep(2000);

        // Get profile snapshot
        const profileSnapshot = getSnapshot();

        // Extract profile data
        const profile = extractProfileFromSnapshot(profileSnapshot, username);

        log("dim", `    追蹤者: ${profile.followersCount.toLocaleString()}`);

        // Check follower count filter
        if (profile.followersCount < CONFIG.minFollowers) {
          log("dim", `    ⏭️ 追蹤者太少 (${profile.followersCount})`);
          continue;
        }
        if (profile.followersCount > CONFIG.maxFollowers) {
          log("dim", `    ⏭️ 追蹤者太多 (${profile.followersCount})`);
          continue;
        }

        // Analyze with LLM
        log("magenta", `  🤖 AI 分析中...`);
        const analysis = await analyzeWithLLM({
          username,
          ...profile,
        });

        if (analysis.isLikelyOwner && analysis.score >= 5) {
          discoveredLeads.push({
            username,
            fullName: profile.fullName,
            followersCount: profile.followersCount,
            score: analysis.score,
            reasons: analysis.reasons,
          });

          log("green", `  🎯 發現潛在客戶！`);
          console.log(`      @${username} (${profile.fullName})`);
          console.log(`      分數: ${analysis.score}/10`);
          console.log(`      原因: ${analysis.reasons.join(", ")}`);

          if (analysis.dmOptions.length > 0) {
            console.log(`      DM 選項: ${analysis.dmOptions.length} 個`);
          }
        } else {
          log("dim", `    ⏭️ 不符合條件 (分數: ${analysis.score})`);
        }

        // Random delay
        await sleep(2000 + Math.random() * 2000);

        // Go back to hashtag page for next post
        await navigate(hashtagUrl);
        await sleep(2000);
        snapshot = getSnapshot();

      } catch (error) {
        console.error(`Error processing post:`, error);
        await sleep(1000);
      }
    }
  }

  // Summary
  console.log();
  log("bright", "═".repeat(50));
  log("green", `✅ 完成！發現 ${discoveredLeads.length} 個潛在客戶`);
  log("bright", "═".repeat(50));

  if (discoveredLeads.length > 0) {
    console.log();
    log("cyan", "📋 潛在客戶列表:");
    discoveredLeads.forEach((lead, i) => {
      console.log(`\n${i + 1}. @${lead.username}`);
      console.log(`   ${lead.fullName}`);
      console.log(`   追蹤者: ${lead.followersCount.toLocaleString()}`);
      console.log(`   分數: ${lead.score}/10`);
      console.log(`   原因: ${lead.reasons.join(", ")}`);
    });
  }

  console.log();
}

main().catch(console.error);
