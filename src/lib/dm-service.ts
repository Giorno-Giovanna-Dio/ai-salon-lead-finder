import { db } from './db';
import { supabaseAdmin } from './supabase';
import { getAIService } from './ai';
import { getAccountManager } from './account-manager';
import { Lead, DmStyle } from '@prisma/client';
import { randomDelay } from './utils';

export interface DmGenerationOptions {
  style: DmStyle;
  includeImages?: boolean;
  customContext?: string;
}

export interface DmSendOptions {
  dmMessageId: string;
  images?: File[];
  customContent?: string;
}

export class DmService {
  private ai = getAIService();
  private accountManager = getAccountManager();

  /**
   * 生成 3 種風格的 DM 訊息
   */
  async generateDmMessages(
    lead: Lead,
    campaignContext?: string
  ): Promise<{ professional: string; friendly: string; valueFocused: string }> {
    const companyInfo = {
      name: process.env.COMPANY_NAME || '龍蝦配 ClawMatch',
      service: process.env.SERVICE_DESCRIPTION || 'AI 驅動的美容美髮業 B2B 配對服務',
    };

    const prompt = `你是一位專業的 B2B 業務開發專家，專注於美容美髮產業。

目標客戶資訊：
- Instagram: @${lead.username}
- 姓名: ${lead.fullName}
- 粉絲數: ${lead.followersCount}
- Bio: ${lead.biography || '無'}
- AI 推薦原因: ${lead.reasons.join(', ')}

公司資訊：
- 公司名稱: ${companyInfo.name}
- 服務內容: ${companyInfo.service}
${campaignContext ? `- 活動背景: ${campaignContext}` : ''}

請生成 3 種不同風格的 Instagram DM 訊息，每個訊息限制在 300 字以內，直接給我訊息內容，不要標題：

1. 專業風格：正式、專業、強調數據和成果
2. 親切風格：友善、輕鬆、建立關係為主
3. 價值導向：直接說明能帶來的價值和解決的問題

請以 JSON 格式回應：
{
  "professional": "...",
  "friendly": "...",
  "valueFocused": "..."
}`;

    const result = await this.ai.generateJSON<{
      professional: string;
      friendly: string;
      valueFocused: string;
    }>(prompt);

    return result;
  }

  /**
   * 儲存 AI 生成的 DM 訊息到資料庫
   */
  async saveDmMessages(
    leadId: string,
    messages: { professional: string; friendly: string; valueFocused: string }
  ): Promise<string[]> {
    const dmIds: string[] = [];

    for (const [style, content] of Object.entries(messages)) {
      const dm = await db.dmMessage.create({
        data: {
          leadId,
          style: style.toUpperCase() as DmStyle,
          content,
          status: 'AI_GENERATED',
        },
      });
      dmIds.push(dm.id);
    }

    return dmIds;
  }

  /**
   * 依使用者上傳的文案建立一則 DM（不呼叫 AI）
   */
  async createDmFromUserContent(
    leadId: string,
    content: string,
    style?: DmStyle
  ): Promise<string> {
    if (!content?.trim()) {
      throw new Error('Content is required');
    }
    const dm = await db.dmMessage.create({
      data: {
        leadId,
        content: content.trim(),
        style: style ?? null,
        status: 'USER_EDITED',
      },
    });
    return dm.id;
  }

  /**
   * 上傳圖片到 Supabase Storage
   */
  async uploadImages(
    dmMessageId: string,
    images: File[]
  ): Promise<{ url: string; order: number }[]> {
    const uploadedImages: { url: string; order: number }[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const fileName = `${dmMessageId}/${i + 1}-${Date.now()}-${file.name}`;

      const { data, error } = await supabaseAdmin.storage
        .from('dm-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Failed to upload image ${i + 1}: ${error.message}`);
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('dm-images')
        .getPublicUrl(fileName);

      await db.dmImage.create({
        data: {
          dmMessageId,
          imageUrl: publicUrl,
          order: i + 1,
        },
      });

      uploadedImages.push({ url: publicUrl, order: i + 1 });
    }

    return uploadedImages;
  }

  /**
   * 更新 DM 內容（使用者編輯後）
   */
  async updateDmContent(
    dmMessageId: string,
    content: string
  ): Promise<void> {
    await db.dmMessage.update({
      where: { id: dmMessageId },
      data: { content },
    });
  }

  /**
   * 確認 DM（標記為已確認，準備發送）
   */
  async approveDm(dmMessageId: string): Promise<void> {
    await db.dmMessage.update({
      where: { id: dmMessageId },
      data: { status: 'APPROVED' },
    });
  }

  /**
   * 發送 DM
   * 注意：實際的 Instagram 發送需要 OpenClaw 整合
   * 這裡先標記為已發送，實際發送邏輯在 crawler 中
   */
  async sendDm(dmMessageId: string): Promise<boolean> {
    const dm = await db.dmMessage.findUnique({
      where: { id: dmMessageId },
      include: {
        lead: true,
        images: true,
      },
    });

    if (!dm) {
      throw new Error('DM message not found');
    }

    // 取得可用帳號
    const account = await this.accountManager.getAvailableAccount();
    if (!account) {
      throw new Error('No available Instagram account. All accounts are cooling down or reached daily limit.');
    }

    // 更新 DM 狀態
    await db.dmMessage.update({
      where: { id: dmMessageId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        accountId: account.id,
      },
    });

    // 更新 Lead 狀態
    await db.lead.update({
      where: { id: dm.leadId },
      data: { status: 'DM_SENT' },
    });

    // 標記帳號已使用
    await this.accountManager.markAccountUsed(account.id);

    // 記錄活動日誌
    await db.activityLog.create({
      data: {
        action: 'DM_SENT',
        metadata: {
          dmId: dm.id,
          leadId: dm.leadId,
          username: dm.lead.username,
          accountUsername: account.username,
        },
      },
    });

    // TODO: 呼叫 OpenClaw 實際發送 DM
    // await this.sendViaOpenClaw(account, dm);

    return true;
  }

  /**
   * 批次發送 DM（按照帳號輪換規則）
   */
  async batchSendDms(leadIds: string[], style: DmStyle): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const result = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const leadId of leadIds) {
      try {
        const lead = await db.lead.findUnique({ where: { id: leadId } });
        if (!lead) {
          result.failed++;
          result.errors.push(`Lead ${leadId} not found`);
          continue;
        }

        // 檢查是否已發送過
        const existingDm = await db.dmMessage.findFirst({
          where: {
            leadId,
            status: 'SENT',
          },
        });

        if (existingDm) {
          result.failed++;
          result.errors.push(`Already sent DM to @${lead.username}`);
          continue;
        }

        // 生成 DM
        const messages = await this.generateDmMessages(lead);
        const dmIds = await this.saveDmMessages(leadId, messages);

        // 選擇指定風格的 DM
        const dm = await db.dmMessage.findFirst({
          where: {
            id: { in: dmIds },
            style,
          },
        });

        if (!dm) {
          result.failed++;
          result.errors.push(`Failed to generate DM for @${lead.username}`);
          continue;
        }

        // 確認並發送
        await this.approveDm(dm.id);
        await this.sendDm(dm.id);

        result.sent++;

        // 隨機延遲 2-5 分鐘，模擬人類行為
        await randomDelay(2 * 60 * 1000, 5 * 60 * 1000);

      } catch (error: any) {
        result.failed++;
        result.errors.push(error.message);
      }
    }

    return result;
  }

  /**
   * 取得 DM 統計資訊
   */
  async getDmStats() {
    const [total, aiGenerated, approved, sent] = await Promise.all([
      db.dmMessage.count(),
      db.dmMessage.count({ where: { status: 'AI_GENERATED' } }),
      db.dmMessage.count({ where: { status: 'APPROVED' } }),
      db.dmMessage.count({ where: { status: 'SENT' } }),
    ]);

    return {
      total,
      aiGenerated,
      approved,
      sent,
      pending: aiGenerated + approved,
    };
  }
}

// Singleton instance
let dmServiceInstance: DmService | null = null;

export function getDmService(): DmService {
  if (!dmServiceInstance) {
    dmServiceInstance = new DmService();
  }
  return dmServiceInstance;
}

export default DmService;
