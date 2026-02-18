import { db } from './db';
import { InstagramAccount, AccountStatus } from '@prisma/client';

export class AccountManager {
  /**
   * 取得可用的帳號（輪換邏輯）
   * 規則：
   * 1. 帳號必須是 ACTIVE 狀態且已登入
   * 2. 今日發送數 < 每日限制
   * 3. 距離上次使用時間 >= 6 小時（4 個帳號輪流）
   * 4. 選擇最久沒使用的帳號
   */
  async getAvailableAccount(): Promise<InstagramAccount | null> {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    const account = await db.instagramAccount.findFirst({
      where: {
        status: 'ACTIVE',
        isLoggedIn: true,
        todaySent: {
          lt: db.$queryRaw`COALESCE(daily_limit, 100)`,
        },
        OR: [
          { lastUsedAt: null },
          { lastUsedAt: { lt: sixHoursAgo } },
        ],
      },
      orderBy: [
        { lastUsedAt: 'asc' }, // 最久沒使用的優先
      ],
    });

    return account;
  }

  /**
   * 標記帳號已使用
   */
  async markAccountUsed(accountId: string): Promise<void> {
    await db.instagramAccount.update({
      where: { id: accountId },
      data: {
        lastUsedAt: new Date(),
        todaySent: {
          increment: 1,
        },
      },
    });
  }

  /**
   * 重置所有帳號的每日計數器（應在 Cron job 中每天執行）
   */
  async resetDailyCounters(): Promise<void> {
    await db.instagramAccount.updateMany({
      data: {
        todaySent: 0,
      },
    });
  }

  /**
   * 更新帳號狀態
   */
  async updateAccountStatus(
    accountId: string,
    status: AccountStatus
  ): Promise<void> {
    await db.instagramAccount.update({
      where: { id: accountId },
      data: { status },
    });
  }

  /**
   * 檢查帳號是否需要冷卻
   * 如果今日發送數達到限制，設為 COOLING
   */
  async checkAndCooldown(accountId: string): Promise<void> {
    const account = await db.instagramAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) return;

    if (account.todaySent >= account.dailyLimit) {
      await this.updateAccountStatus(accountId, 'COOLING');
    }
  }

  /**
   * 取得所有帳號狀態統計
   */
  async getAccountsStats() {
    const accounts = await db.instagramAccount.findMany();
    
    const stats = {
      total: accounts.length,
      active: accounts.filter(a => a.status === 'ACTIVE' && a.isLoggedIn).length,
      paused: accounts.filter(a => a.status === 'PAUSED').length,
      blocked: accounts.filter(a => a.status === 'BLOCKED').length,
      cooling: accounts.filter(a => a.status === 'COOLING').length,
      todayTotal: accounts.reduce((sum, a) => sum + a.todaySent, 0),
      todayLimit: accounts.reduce((sum, a) => sum + a.dailyLimit, 0),
    };

    return stats;
  }

  /**
   * 取得下一次可以發送 DM 的時間
   */
  async getNextAvailableTime(): Promise<Date | null> {
    const accounts = await db.instagramAccount.findMany({
      where: {
        status: 'ACTIVE',
        isLoggedIn: true,
        todaySent: {
          lt: db.$queryRaw`COALESCE(daily_limit, 100)`,
        },
      },
      orderBy: { lastUsedAt: 'asc' },
    });

    if (accounts.length === 0) {
      // 沒有可用帳號，檢查最早可用的時間
      const earliestAccount = await db.instagramAccount.findFirst({
        where: {
          status: 'COOLING',
          isLoggedIn: true,
        },
        orderBy: { lastUsedAt: 'asc' },
      });

      if (earliestAccount?.lastUsedAt) {
        const nextTime = new Date(earliestAccount.lastUsedAt.getTime() + 6 * 60 * 60 * 1000);
        return nextTime;
      }

      return null;
    }

    const account = accounts[0];
    if (!account.lastUsedAt) {
      return new Date(); // 立即可用
    }

    const sixHoursLater = new Date(account.lastUsedAt.getTime() + 6 * 60 * 60 * 1000);
    return sixHoursLater > new Date() ? sixHoursLater : new Date();
  }
}

// Singleton instance
let accountManagerInstance: AccountManager | null = null;

export function getAccountManager(): AccountManager {
  if (!accountManagerInstance) {
    accountManagerInstance = new AccountManager();
  }
  return accountManagerInstance;
}

export default AccountManager;
