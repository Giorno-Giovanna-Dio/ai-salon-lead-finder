/**
 * OpenClaw 整合介面
 * 透過 CLI 呼叫 OpenClaw browser（需在 OPENCLAW_PROJECT_ROOT 專案內安裝 openclaw）
 * 或透過 CRAWLER_API_URL 呼叫遠端 Worker（生產環境）
 * 若未設定 OPENCLAW_PROJECT_ROOT，會自動嘗試專案內 vendor/clawdbot_hair_domain（submodule）
 */

import { execSync } from 'child_process';
import path from 'path';
import type { Campaign } from '@prisma/client';

const pathFromEnv = process.env.OPENCLAW_PROJECT_ROOT?.trim() || '';
const defaultVendorPath = path.join(process.cwd(), 'vendor', 'clawdbot_hair_domain');

/** 實際使用的 OpenClaw 專案根目錄（含 submodule 預設路徑） */
export function getOpenClawProjectRoot(): string {
  if (pathFromEnv) return pathFromEnv;
  try {
    const fs = require('fs');
    if (fs.existsSync(defaultVendorPath)) return defaultVendorPath;
  } catch {
    // ignore
  }
  return '';
}

export const OPENCLAW_PROJECT_ROOT = getOpenClawProjectRoot();
export const CRAWLER_API_URL = process.env.CRAWLER_API_URL?.trim() || '';
export const CRAWLER_API_KEY = process.env.CRAWLER_API_KEY?.trim() || '';

/** 是否可使用 OpenClaw（本地路徑存在或已設定 Worker API） */
export function isOpenClawAvailable(): boolean {
  if (CRAWLER_API_URL) return true;
  const root = getOpenClawProjectRoot();
  if (!root) return false;
  try {
    const fs = require('fs');
    return fs.existsSync(root);
  } catch {
    return false;
  }
}

/** 取得目前使用的模式 */
export function getOpenClawMode(): 'worker' | 'local' | 'none' {
  if (CRAWLER_API_URL) return 'worker';
  if (OPENCLAW_PROJECT_ROOT) return 'local';
  return 'none';
}

// ---------------------------------------------------------------------------
// 本地模式：直接執行 OpenClaw CLI
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 30000;

/**
 * 在 OpenClaw 專案目錄下執行 browser 指令
 * @param cmd 指令字串，例如 navigate "https://instagram.com"
 * @param browserProfile 使用的 browser profile（對應一個 IG 帳號）
 */
export function runOpenClawCommand(
  cmd: string,
  options?: { timeout?: number; browserProfile?: string }
): string {
  const root = getOpenClawProjectRoot();
  if (!root) {
    throw new Error(
      'OpenClaw 未設定。請設定 OPENCLAW_PROJECT_ROOT 或加入 vendor/clawdbot_hair_domain submodule（見 docs/OPENCLAW_SUBMODULE.md）'
    );
  }
  const profile = options?.browserProfile || 'openclaw';
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const fullCmd = `cd "${root}" && pnpm openclaw browser --browser-profile ${profile} ${cmd}`;
  const result = execSync(fullCmd, {
    timeout,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 導向指定 URL */
export function navigate(url: string, browserProfile?: string): void {
  runOpenClawCommand(`navigate "${url}"`, {
    timeout: 60000,
    browserProfile,
  });
}

/** 取得目前頁面 snapshot（文字） */
export function getSnapshot(browserProfile?: string): string {
  return runOpenClawCommand('snapshot', { timeout: 30000, browserProfile });
}

/** 點擊元素 ref */
export function click(ref: string, browserProfile?: string): void {
  runOpenClawCommand(`click ${ref}`, { timeout: 15000, browserProfile });
}

/** 按下鍵盤 */
export function pressKey(key: string, browserProfile?: string): void {
  runOpenClawCommand(`press ${key}`, { timeout: 5000, browserProfile });
}

/** 在目前焦點元素輸入文字（若 OpenClaw 支援 type 指令） */
export function typeText(text: string, browserProfile?: string): void {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  runOpenClawCommand(`type "${escaped}"`, { timeout: 15000, browserProfile });
}

// ---------------------------------------------------------------------------
// Worker 模式：呼叫遠端 Crawler API（生產環境）
// ---------------------------------------------------------------------------

export interface CrawlerRunPayload {
  campaignId: string;
  hashtags: string[];
  minFollowers: number;
  maxFollowers: number;
  maxLeads: number;
}

export interface CrawlerRunResult {
  success: boolean;
  profilesFound?: number;
  leadsCreated?: number;
  error?: string;
}

/**
 * 透過 Crawler Worker API 執行搜尋任務（非同步，Worker 執行完可 callback 或輪詢）
 */
export async function runCampaignViaWorker(
  payload: CrawlerRunPayload
): Promise<{ jobId?: string; error?: string }> {
  if (!CRAWLER_API_URL) {
    return { error: 'CRAWLER_API_URL 未設定' };
  }
  const url = `${CRAWLER_API_URL.replace(/\/$/, '')}/run`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (CRAWLER_API_KEY) headers['Authorization'] = `Bearer ${CRAWLER_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || data.message || `HTTP ${res.status}` };
  }
  return { jobId: data.jobId };
}
