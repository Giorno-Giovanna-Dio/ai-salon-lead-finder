import { spawnSync } from 'child_process';
import path from 'path';
import { db } from '../lib/db';
import { getAIService } from '../lib/ai';
import { isOpenClawAvailable, getOpenClawProjectRoot } from '../lib/openclaw-adapter';
import { Campaign } from '@prisma/client';

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
  contactMethods: {
    email?: string;
    phone?: string;
    line?: string;
  };
}

export interface CrawlerResult {
  profilesFound: number;
  profilesAnalyzed: number;
  leadsCreated: number;
  errors: string[];
}

export class InstagramCrawler {
  private ai = getAIService();

  /**
   * 執行搜尋任務
   */
  async runCampaign(campaignId: string): Promise<CrawlerResult> {
    const result: CrawlerResult = {
      profilesFound: 0,
      profilesAnalyzed: 0,
      leadsCreated: 0,
      errors: [],
    };

    try {
      const campaign = await db.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (!campaign.isActive) {
        throw new Error('Campaign is not active');
      }

      await db.activityLog.create({
        data: {
          action: 'CAMPAIGN_STARTED',
          metadata: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            hashtags: campaign.hashtags,
          },
        },
      });

      if (isOpenClawAvailable()) {
        const scriptPath = path.join(process.cwd(), 'src', 'crawler', 'run-campaign-openclaw.ts');
        console.log(`[OpenClaw] 開始執行 run-campaign-openclaw.ts (campaignId: ${campaignId})，輸出如下…`);
        const child = spawnSync(
          'npx',
          ['tsx', scriptPath, campaignId],
          {
            env: { ...process.env },
            stdio: 'inherit',
            timeout: 10 * 60 * 1000,
          }
        );
        if (child.status === 0) {
          const logs = await db.activityLog.findMany({
            where: { action: 'CAMPAIGN_COMPLETED' },
            orderBy: { timestamp: 'desc' },
            take: 10,
          });
          const completed = logs.find(
            (log) => (log.metadata as { campaignId?: string })?.campaignId === campaignId
          );
          const meta = completed?.metadata as { profilesFound?: number; leadsCreated?: number } | undefined;
          if (meta) {
            result.profilesFound = meta.profilesFound ?? 0;
            result.leadsCreated = meta.leadsCreated ?? 0;
            result.profilesAnalyzed = result.profilesFound;
          }
        } else {
          result.errors.push(child.error?.message || 'OpenClaw 腳本執行失敗');
        }
      } else {
        const fs = require('fs');
        const root = getOpenClawProjectRoot();
        const exists = root ? fs.existsSync(root) : false;
        console.log(`Starting campaign: ${campaign.name} (OpenClaw 未啟用，僅記錄日誌)`);
        console.log(`  OPENCLAW_PROJECT_ROOT=${process.env.OPENCLAW_PROJECT_ROOT || '(未設定)'}`);
        console.log(`  解析路徑: ${root || '(空)'}，存在: ${exists} (若為 false 請檢查 .env 路徑與拼字，例如 clawdbot 不是 clawbot)`);
      }
      
    } catch (error: any) {
      result.errors.push(error.message);
      
      await db.activityLog.create({
        data: {
          action: 'ERROR',
          metadata: {
            error: error.message,
            campaignId,
          },
        },
      });
    }

    return result;
  }

  /**
   * 使用 OpenClaw 搜尋 Instagram（待實作）
   */
  private async searchInstagram(campaign: Campaign): Promise<InstagramProfile[]> {
    // TODO: OpenClaw 整合
    // 1. 啟動 OpenClaw browser
    // 2. 登入 Instagram（使用可用帳號）
    // 3. 搜尋 hashtags
    // 4. 篩選粉絲數範圍
    // 5. 爬取個人資料
    
    throw new Error('OpenClaw integration not implemented yet');
  }

  /**
   * 分析個人資料並創建 Lead
   */
  async analyzeAndCreateLead(
    profile: InstagramProfile,
    campaignId: string
  ): Promise<string | null> {
    try {
      // 檢查是否已存在
      const existing = await db.lead.findFirst({
        where: { username: profile.username },
      });

      if (existing) {
        console.log(`Lead already exists: @${profile.username}`);
        return null;
      }

      // 使用 AI 分析
      const analysis = await this.analyzeProfile(profile);

      // 只有分數 >= 7 才創建 Lead
      if (analysis.score < 7) {
        console.log(`Profile @${profile.username} scored ${analysis.score}, skipping`);
        return null;
      }

      // 創建 Lead（Lead 模型無 isBusinessAccount 欄位；上方已檢查 existing）
      const lead = await db.lead.create({
        data: {
          campaignId,
          username: profile.username,
          fullName: profile.fullName || profile.username,
          biography: profile.biography,
          profileUrl: `https://instagram.com/${profile.username}`,
          followersCount: profile.followersCount,
          postsCount: profile.postsCount,
          contactMethods: profile.contactMethods ?? {},
          score: analysis.score,
          reasons: analysis.reasons,
          isLikelyOwner: analysis.score >= 7,
          status: 'DISCOVERED',
        },
      });

      console.log(`✅ Created lead: @${profile.username} (score: ${analysis.score})`);

      // 記錄活動
      await db.activityLog.create({
        data: {
          action: 'LEAD_CREATED',
          metadata: {
            leadId: lead.id,
            username: profile.username,
            score: analysis.score,
            campaignId,
          },
        },
      });

      return lead.id;

    } catch (error: any) {
      console.error(`Error analyzing profile @${profile.username}:`, error);
      return null;
    }
  }

  /**
   * 使用 AI 分析個人資料
   */
  private async analyzeProfile(profile: InstagramProfile): Promise<{
    score: number;
    reasons: string[];
  }> {
    const prompt = `你是一位專業的 B2B 業務開發專家，專注於美容美髮產業。

請分析以下 Instagram 個人資料，判斷是否為潛在的美容美髮業客戶（美髮沙龍、美容院等）：

個人資料：
- Username: @${profile.username}
- 姓名: ${profile.fullName}
- Bio: ${profile.biography}
- 粉絲數: ${profile.followersCount}
- 貼文數: ${profile.postsCount}
- 商業帳號: ${profile.isBusinessAccount ? '是' : '否'}

評分標準：
- 10分：完美目標客戶（明顯是美容美髮業者，活躍經營）
- 8-9分：優質潛在客戶（很可能是目標客戶）
- 7分：值得嘗試（有一些相關特徵）
- 6分以下：不符合（個人帳號、其他行業等）

請以 JSON 格式回應：
{
  "score": 8.5,
  "reasons": [
    "Bio 中提到「美髮沙龍」",
    "粉絲數在目標範圍內 (${profile.followersCount})",
    "使用商業帳號"
  ]
}

注意：
- reasons 應該是具體的、可觀察的理由
- 不要編造不存在的資訊
- 如果資訊不足，保守評分`;

    try {
      const result = await this.ai.generateJSON<{
        score: number;
        reasons: string[];
      }>(prompt);
      return result;
    } catch (e) {
      console.warn(`AI 分析 @${profile.username} 無效 JSON，使用 fallback`);
      return {
        score: 5,
        reasons: ['AI 回應格式異常，保守略過'],
      };
    }
  }

  /**
   * 批次分析多個 profiles
   */
  async batchAnalyze(
    profiles: InstagramProfile[],
    campaignId: string
  ): Promise<{ leadIds: string[]; rejected: number }> {
    const leadIds: string[] = [];
    let rejected = 0;

    for (const profile of profiles) {
      const leadId = await this.analyzeAndCreateLead(profile, campaignId);
      
      if (leadId) {
        leadIds.push(leadId);
      } else {
        rejected++;
      }

      // 避免 API rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { leadIds, rejected };
  }
}

// Singleton instance
let crawlerInstance: InstagramCrawler | null = null;

export function getCrawler(): InstagramCrawler {
  if (!crawlerInstance) {
    crawlerInstance = new InstagramCrawler();
  }
  return crawlerInstance;
}

export default InstagramCrawler;
