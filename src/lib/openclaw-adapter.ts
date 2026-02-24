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

/** OpenClaw 實際存在的 profile（Gateway 回報）；DB 可能是 profile-1、profile-2，需對應到此 */
const OPENCLAW_KNOWN_PROFILES = ['openclaw', 'chrome'];

export function resolveOpenClawProfile(browserProfile?: string): string {
  const p = browserProfile?.trim() || 'openclaw';
  return OPENCLAW_KNOWN_PROFILES.includes(p) ? p : 'openclaw';
}

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

/** 可透過 OPENCLAW_CMD_TIMEOUT_MS 覆寫（毫秒），預設 60 秒，避免 spawnSync ETIMEDOUT */
const DEFAULT_TIMEOUT = Math.max(
  30000,
  parseInt(process.env.OPENCLAW_CMD_TIMEOUT_MS || '60000', 10) || 60000
);

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
  const profile = resolveOpenClawProfile(options?.browserProfile);
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const fullCmd = `cd "${root}" && pnpm openclaw browser --browser-profile ${profile} ${cmd}`;
  try {
    const result = execSync(fullCmd, {
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (err: unknown) {
    const e = err as { message?: string; stderr?: string | Buffer; stdout?: string | Buffer };
    const stderr = typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString?.() ?? '');
    const stdout = typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString?.() ?? '');
    const maxLen = 3000;
    const parts: string[] = [e.message ?? 'Command failed'];
    if (stderr) parts.push(`--- stderr ---\n${stderr}`);
    if (stdout) parts.push(`--- stdout ---\n${stdout}`);
    const full = parts.join('\n');
    throw new Error(full.length > maxLen ? full.slice(0, maxLen) + '\n... (truncated)' : full);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 導向指定 URL */
export function navigate(url: string, browserProfile?: string): void {
  const navTimeout = Math.max(DEFAULT_TIMEOUT, 90000);
  runOpenClawCommand(`navigate "${url}"`, {
    timeout: navTimeout,
    browserProfile,
  });
}

/** 取得目前頁面 snapshot（文字） */
export function getSnapshot(browserProfile?: string): string {
  return runOpenClawCommand('snapshot', { timeout: DEFAULT_TIMEOUT, browserProfile });
}

/** 點擊元素 ref */
export function click(ref: string, browserProfile?: string): void {
  runOpenClawCommand(`click ${ref}`, { timeout: DEFAULT_TIMEOUT, browserProfile });
}

/** 按下鍵盤 */
export function pressKey(key: string, browserProfile?: string): void {
  runOpenClawCommand(`press ${key}`, { timeout: 10000, browserProfile });
}

/**
 * 在指定 ref 元素內輸入文字
 * OpenClaw 語法：type <ref> "text"（必須同時提供 ref 和 text）
 * @see https://docs.openclaw.ai/cli/browser
 */
export function typeTextInElement(ref: string, text: string, browserProfile?: string): void {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  runOpenClawCommand(`type ${ref} "${escaped}"`, { timeout: DEFAULT_TIMEOUT, browserProfile });
}

/** @deprecated 請改用 typeTextInElement(ref, text)。OpenClaw type 必須指定 ref。 */
export function typeText(text: string, browserProfile?: string): void {
  throw new Error(
    'OpenClaw type 需要 ref，請使用 typeTextInElement(ref, text)。例如：typeTextInElement(searchRef, "要輸入的文字", profile)'
  );
}

/**
 * 上傳本機檔案到目前頁面
 * - useInputRef: true 時，ref 為 <input type="file"> 的 ref，直接對該 input 設檔（Discord/Playwright 做法，不需開檔案對話框）
 * - useInputRef: false 時，ref 為「附加」按鈕，會 arm 上傳並點擊該 ref 觸發檔案選擇
 * OpenClaw 語法：upload <paths...> --ref <ref> 或 upload <paths...> --input-ref <ref>
 */
export function uploadFiles(
  localPaths: string[],
  ref: string,
  browserProfile?: string,
  options?: { useInputRef?: boolean }
): void {
  if (localPaths.length === 0) return;
  const quoted = localPaths.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(' ');
  const flag = options?.useInputRef ? '--input-ref' : '--ref';
  runOpenClawCommand(`upload ${quoted} ${flag} ${ref}`, {
    timeout: Math.max(DEFAULT_TIMEOUT, 90000),
    browserProfile,
  });
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
