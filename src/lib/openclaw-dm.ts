/**
 * 使用 OpenClaw 實際發送 Instagram DM
 *
 * 流程：
 * 1. 導航到 profile → 點「發送訊息」→ 進入 DM 視窗
 * 2. 【純文字】無附圖：在訊息輸入框輸入文字 → 按 Enter 送出
 * 3. 【有附圖】先傳文字，再傳圖片（共兩則訊息）：
 *    - 先在同一輸入框輸入文字 → Enter 送出（第一則）
 *    - 再點「傳送圖片的 icon」或 file input → 上傳圖片 → 圖片放入訊息框後按 Enter 送出（第二則）
 *    - 實測：圖片已出現在對話框時，只要按 Enter 即可送出
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  isOpenClawAvailable,
  resolveOpenClawProfile,
  navigate,
  getSnapshot,
  click,
  typeTextInElement,
  pressKey,
  sleep,
  uploadFiles,
} from './openclaw-adapter';

const LOG_PREFIX = '[OpenClaw DM]';

function log(step: string, detail: string) {
  console.log(`${LOG_PREFIX} ${step} | ${detail}`);
}

/** 從 snapshot 文字中找出 [ref=eXXX]，回傳第一個與關鍵字同行的 ref */
function findRefByKeyword(snapshot: string, keyword: string | RegExp): string | null {
  const lines = snapshot.split('\n');
  const re = /\[ref=(e\d+)\]/g;
  for (const line of lines) {
    const match = typeof keyword === 'string' ? line.includes(keyword) : keyword.test(line);
    if (!match) continue;
    const refMatch = line.match(re);
    if (refMatch) return refMatch[0].replace('[ref=', '').replace(']', '');
  }
  return null;
}

/** 從 snapshot 找出所有 ref，回傳第一個出現的 */
function findFirstRef(snapshot: string, preferTag?: string): string | null {
  const re = /\[ref=(e\d+)\]/g;
  const lines = snapshot.split('\n');
  for (const line of lines) {
    if (preferTag && !line.toLowerCase().includes(preferTag.toLowerCase())) continue;
    const m = line.match(re);
    if (m) return m[0].replace('[ref=', '').replace(']', '');
  }
  const any = snapshot.match(re);
  return any ? any[0].replace('[ref=', '').replace(']', '') : null;
}

/**
 * 只從 profile 頁「頭部」找「發送訊息」按鈕的 ref（不搜貼文區），避免誤點貼文。
 * 頭部 = 前 HEADER_LINES 行（IG 頭部含大頭照、簡介、追蹤／發送訊息按鈕，約 150 行內）。
 */
const PROFILE_HEADER_LINES = 150;

/**
 * 點選「私訊」後，右下角 DM 視窗通常在 DOM/snapshot 的尾段。
 * 只取 snapshot 最後 DM_PANEL_TAIL_LINES 行來找輸入框、附加圖示、送出按鈕，避免選到背後 profile 的貼文。
 */
const DM_PANEL_TAIL_LINES = 250;

/**
 * 除錯：每次發送附圖 DM 時會把 DM 視窗 snapshot 寫入暫存檔（檔名含時間戳），方便對照畫面找「圖片按鈕」的 ref。
 * 若設定了 OPENCLAW_DM_DEBUG_SNAPSHOT 則寫入該路徑；否則寫入 /tmp/openclaw-dm-panel-snapshot-YYYYMMDDHHmmss.txt
 */
function getDmDebugSnapshotPath(): string {
  if (process.env.OPENCLAW_DM_DEBUG_SNAPSHOT?.trim()) {
    return process.env.OPENCLAW_DM_DEBUG_SNAPSHOT.trim();
  }
  const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return path.join(os.tmpdir(), `openclaw-dm-panel-snapshot-${ts}.txt`);
}

/** 只取 snapshot 尾段（視為右下角 DM 視窗內容），後續只在此區找 ref */
function snapshotDmPanelOnly(snapshot: string): string {
  const lines = snapshot.split('\n');
  if (lines.length <= DM_PANEL_TAIL_LINES) return snapshot;
  return lines.slice(-DM_PANEL_TAIL_LINES).join('\n');
}

/** 從 snapshot 字串抽出所有 [ref=eXXX]，回傳不重複且排序的 ref 列表，方便除錯對照 */
function extractAllRefs(snap: string): string[] {
  const re = /\[ref=(e\d+)\]/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(snap)) !== null) set.add(m[1]);
  return [...set].sort();
}

/** 若該行屬於貼文／留言／modal 內容則排除，避免誤選到貼文的「發佈」等 ref */
const DM_EXCLUDE_POST_LINE = /\/p\/|\/reel\/|發佈|留言|comment|like|讚|分享|貼文|post\s|modal|彈窗/i;

/** 該行是否為貼文／Reel 連結（link 含 /url: .../p/ 或 /reel/），這類 ref 絕不能當成 DM 輸入框 */
const DM_POST_LINK_LINE = /\/url:\s*[^\s]*(\/p\/|\/reel\/)/i;

/** 該行是「訊息」分頁按鈕或側欄連結，不是 DM 輸入框，排除以免誤點 */
const DM_EXCLUDE_MESSAGE_TAB = /button\s*[^\[\]]*["']?(訊息|Message)["']?|link\s*["']?(訊息|Message)["']?.*(\/direct\/|\/inbox\/)/i;

function findProfileMessageButtonRef(snapshot: string): string | null {
  const re = /\[ref=(e\d+)\]/g;
  const lines = snapshot.split('\n');
  const headerLines = lines.slice(0, PROFILE_HEADER_LINES);
  const excludeLine = /留言|讚|分享|like|comment|\/p\/|reel\/|發佈/i;
  const messageLike = /message|私訊|傳送訊息|發送訊息|發送|メッセージ|send\s*message/i;
  for (const line of headerLines) {
    if (excludeLine.test(line)) continue;
    if (!messageLike.test(line)) continue;
    const refMatch = line.match(re);
    if (refMatch) return refMatch[0].replace('[ref=', '').replace(']', '');
  }
  // 若仍找不到：在頭部找「非追蹤」的 button（發送訊息通常在追蹤旁邊）
  for (const line of headerLines) {
    if (/追蹤|follow/i.test(line)) continue;
    if (!/button|link/i.test(line)) continue;
    if (excludeLine.test(line)) continue;
    const refMatch = line.match(re);
    if (refMatch) return refMatch[0].replace('[ref=', '').replace(']', '');
  }
  return null;
}

/**
 * 從 snapshot 找隱藏的 <input type="file"> 的 ref（Discord/Telegram/Playwright 做法：直接對 input 設檔，不開檔案對話框）
 * 常見 snapshot 會出現 input、file、accept、image 等關鍵字
 */
function findFileInputRef(snapshot: string): string | null {
  const re = /\[ref=(e\d+)\]/g;
  const sendLike = /send|傳送|送出|submit|paper|plane|紙飛機|飛行/i;
  const lines = snapshot.split('\n');
  for (const line of lines) {
    if (DM_EXCLUDE_POST_LINE.test(line)) continue;
    if (sendLike.test(line)) continue;
    const hasInput = /\binput\b|textbox|type\s*[=:]\s*["']?file/i.test(line);
    const hasFile = /\bfile\b|accept\s*[=:]|image\/|\.jpg|\.png|\.gif|\.webp/i.test(line);
    if (!hasInput || !hasFile) continue;
    const refMatch = line.match(re);
    if (refMatch) return refMatch[0].replace('[ref=', '').replace(']', '');
  }
  return null;
}

/** 排除 profile 區按鈕，避免誤選「發送訊息」「追蹤」等（這些在 snapshot 裡也是 button + cursor=pointer） */
const DM_EXCLUDE_PROFILE_BUTTON = /發送訊息|追蹤|類似帳號|follow|首頁|Reel|搜尋|探索|通知|新貼文|設定|選項/i;

/**
 * 從 snapshot 找 DM 視窗裡「圖片／附加」按鈕的 ref（IG 介面上為「新增相片或影片」）。
 * 只認 DM 輸入列的那顆按鈕，避免誤點 profile 或其他 cursor=pointer 元素。
 * 排除：送出鈕、麥克風、表情、訊息輸入框、以及 profile 區的發送訊息/追蹤等。
 */
function findAttachImageRef(snapshot: string): string | null {
  const re = /\[ref=(e\d+)\]/g;
  const sendLike = /send|傳送|送出|submit|paper|plane|紙飛機|飛行/i;
  const exclude = /mic|麥克風|voice|語音|emoji|表情|sticker|貼圖|訊息\.\.\.|message\.\.\.|textbox|placeholder/i;
  const lines = snapshot.split('\n');

  // 第一優先：IG 網頁版 DM 輸入列明確為 button "新增相片或影片" [ref=eXXX]，只認這顆避免點到其他
  const attachButtonExact = /新增相片或影片/;
  for (const line of lines) {
    if (DM_EXCLUDE_POST_LINE.test(line)) continue;
    if (DM_EXCLUDE_PROFILE_BUTTON.test(line)) continue;
    if (sendLike.test(line)) continue;
    if (exclude.test(line)) continue;
    if (!attachButtonExact.test(line)) continue;
    // 必須是 button 或 img（DM 那顆附加鈕在 snapshot 裡是 button … 或 img "新增相片或影片"）
    if (!/button|img/i.test(line)) continue;
    const refMatch = line.match(re);
    if (refMatch) return refMatch[0].replace('[ref=', '').replace(']', '');
  }

  // 備援：其他與圖片/附加相關的關鍵字（仍排除 profile 與貼文區）
  const imageLike =
    /新增相片或影片|photo|camera|image|gallery|attach|圖片|相片|相機|附加|媒體|plus|add|圖庫|相簿|album|media|mountain|山|sun/i;
  for (const line of lines) {
    if (DM_EXCLUDE_POST_LINE.test(line)) continue;
    if (DM_EXCLUDE_PROFILE_BUTTON.test(line)) continue;
    if (sendLike.test(line)) continue;
    if (exclude.test(line)) continue;
    if (!imageLike.test(line)) continue;
    const refMatch = line.match(re);
    if (refMatch) return refMatch[0].replace('[ref=', '').replace(']', '');
  }

  // 最後備援：尾段按鈕/圖示（排除 profile、送出、輸入）
  for (const line of lines) {
    if (DM_EXCLUDE_POST_LINE.test(line)) continue;
    if (DM_EXCLUDE_PROFILE_BUTTON.test(line)) continue;
    if (sendLike.test(line)) continue;
    if (exclude.test(line)) continue;
    if (!/button|img|graphic|icon/i.test(line)) continue;
    const refMatch = line.match(re);
    if (refMatch) return refMatch[0].replace('[ref=', '').replace(']', '');
  }
  return null;
}

/** OpenClaw 限定上傳路徑需在該目錄下，否則 upload 會拒絕 */
const OPENCLAW_UPLOAD_DIR = path.join(os.tmpdir(), 'openclaw', 'uploads');

/** 將圖片 URL 下載到暫存檔，回傳本機路徑陣列（需在 OpenClaw 允許的 upload 目錄內） */
async function downloadImageUrlsToTemp(urls: string[]): Promise<string[]> {
  fs.mkdirSync(OPENCLAW_UPLOAD_DIR, { recursive: true });
  const dir = OPENCLAW_UPLOAD_DIR;
  const paths: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下載圖片失敗 (${i + 1}/${urls.length}): ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const filePath = path.join(dir, `dm-${Date.now()}-${i}${ext}`);
    fs.writeFileSync(filePath, buf);
    paths.push(filePath);
  }
  return paths;
}

export interface SendInstagramDmResult {
  /** 文字是否已送出 */
  textSent: boolean;
  /** 是否有嘗試送圖（本則 DM 有附圖） */
  imageUrlsIncluded: number;
  /** 圖片階段是否完成且未拋錯（無法驗證 IG 是否真的收到） */
  imagePhaseSucceeded: boolean;
}

/**
 * 使用指定 browser profile 對目標用戶發送 Instagram DM
 * @param imageUrls 可選，DM 附圖的 Supabase 公開 URL
 * @returns 供判斷：純文字可依 return 視為成功；有附圖時需依 imagePhaseSucceeded 區分
 */
export async function sendInstagramDm(
  browserProfile: string,
  targetUsername: string,
  messageText: string,
  imageUrls?: string[]
): Promise<SendInstagramDmResult> {
  if (!isOpenClawAvailable()) {
    throw new Error('OpenClaw 未設定，無法發送 DM');
  }

  const imageCount = imageUrls?.length ?? 0;

  const profile = resolveOpenClawProfile(browserProfile);

  log('start', `profile=${profile} target=@${targetUsername} hasImage=${(imageUrls?.length ?? 0) > 0}`);

  // 1. 導航到潛在客戶的 IG profile（較輕量，避免 Page crashed）
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(targetUsername)}/`;
  const maxNavAttempts = 3;
  let lastNavError: Error | null = null;
  for (let attempt = 1; attempt <= maxNavAttempts; attempt++) {
    try {
      log('navigate', `attempt ${attempt}/${maxNavAttempts} ${profileUrl}`);
      navigate(profileUrl, profile);
      lastNavError = null;
      break;
    } catch (e) {
      lastNavError = e instanceof Error ? e : new Error(String(e));
      const msg = lastNavError.message || '';
      if (attempt < maxNavAttempts && (msg.includes('crashed') || msg.includes('page.goto'))) {
        await sleep(5000);
        continue;
      }
      throw lastNavError;
    }
  }
  if (lastNavError) throw lastNavError;
  await sleep(3500);

  let snapshot = getSnapshot(profile);

  // 2. 找「私訊」按鈕並點擊（只在頭部區找，避免誤點貼文）
  let messageButtonRef = findProfileMessageButtonRef(snapshot);
  if (!messageButtonRef) {
    const headerOnly = snapshot.split('\n').slice(0, PROFILE_HEADER_LINES).join('\n');
    messageButtonRef =
      findRefByKeyword(headerOnly, /message|私訊|傳送訊息|發送訊息|發送|メッセージ|send\s*message/i) ?? null;
  }
  if (!messageButtonRef) {
    throw new Error('找不到 profile 頁的「發送訊息」按鈕，請確認已登入 IG 且該用戶存在');
  }
  // 點擊前再取一次 snapshot，用頭部區重新取 ref 再點
  snapshot = getSnapshot(profile);
  messageButtonRef =
    findProfileMessageButtonRef(snapshot) ??
    findRefByKeyword(
      snapshot.split('\n').slice(0, PROFILE_HEADER_LINES).join('\n'),
      /message|私訊|傳送訊息|發送訊息|發送|メッセージ|send\s*message/i
    ) ??
    messageButtonRef;
  log('open_dm', `click profile 發送訊息 ref=${messageButtonRef}`);
  click(messageButtonRef, profile);
  await sleep(3500);

  snapshot = getSnapshot(profile);
  log('after_open_dm', `snapshot length=${snapshot.length}`);

  // 之後只 focus 在右下角 DM 視窗：只用 snapshot 尾段找 ref
  const dmPanel = snapshotDmPanelOnly(snapshot);

  /** 取一行中出現在關鍵字「之後」的第一個 ref，避免取到該行前面的 generic 容器（會點到貼文）。 */
  function refAfterKeyword(line: string, keyword: RegExp): string | null {
    const keywordMatch = line.match(keyword);
    if (!keywordMatch) return null;
    const keywordIndex = line.indexOf(keywordMatch[0]);
    const re = /\[ref=(e\d+)\]/g;
    for (const m of line.matchAll(re)) {
      if (m.index != null && m.index >= keywordIndex) return m[1];
    }
    return null;
  }

  /** 找 DM 訊息輸入框 ref。IG 網頁版為 textbox "訊息" [active] [ref=e595]。同一行可能先出現 generic [ref=e271]，再出現 textbox [ref=e595]；只取「在 textbox 或 訊息 之後」的 ref，才不會點到貼文。 */
  function findMessageInputRef(snap: string): string | null {
    const lines = snap.split('\n').filter((l) => !DM_EXCLUDE_POST_LINE.test(l));
    const re = /\[ref=(e\d+)\]/g;
    // 最優先：同一行有 textbox 且「訊息」。只取「在 textbox 或 訊息 之後」的 ref；若該行 ref 都在關鍵字前（如只有 e271）則略過，不取
    for (const line of lines) {
      if (!/textbox|text box/i.test(line) || !/訊息|Message/i.test(line)) continue;
      const afterTextbox = refAfterKeyword(line, /textbox|text box/i);
      if (afterTextbox) return afterTextbox;
      const afterMsg = refAfterKeyword(line, /訊息|Message/i);
      if (afterMsg) return afterMsg;
    }
    // 有 [active] 的 textbox（目前焦點）
    for (const line of lines) {
      if (!/\[active\]/.test(line) || !/textbox|text box/i.test(line)) continue;
      const afterTextbox = refAfterKeyword(line, /textbox|text box/i);
      if (afterTextbox) return afterTextbox;
      const all = [...line.matchAll(re)];
      if (all.length > 0) return all[all.length - 1][1];
    }
    const filtered = lines.join('\n');
    // 以下 fallback 可能選到貼文區：只接受「該行在關鍵字之後的 ref」，且排除貼文／Reel 連結行
    const fallbackRef = (keyword: RegExp, skipPostLink = true): string | null => {
      for (const line of lines) {
        if (skipPostLink && DM_POST_LINK_LINE.test(line)) continue;
        if (!keyword.test(line)) continue;
        const after = refAfterKeyword(line, keyword);
        if (after) return after;
      }
      return null;
    };
    return (
      fallbackRef(/textbox|text box/i) ||
      fallbackRef(/訊息\.\.\.|Message\.\.\.|placeholder/i) ||
      fallbackRef(/input|edit|write/i) ||
      findFirstRef(filtered, 'textbox') ||
      fallbackRef(/訊息|message/i)
    );
  }

  /** 找 DM 輸入列「傳送」按鈕 ref（紙飛機圖示）。IG 可能標為 傳送|送出|send|paper|plane 等，排除 profile 的「發送訊息」 */
  function findSendButtonRef(snap: string): string | null {
    const lines = snap.split('\n').filter((l) => !DM_EXCLUDE_POST_LINE.test(l));
    const exclude = /發送訊息|follow|追蹤|進入/i; // 不要選到 profile 或對話內的「進入」
    const sendLike = /傳送|送出|send|paper|plane|紙飛機|submit|寄出/i;
    const re = /\[ref=(e\d+)\]/g;
    for (const line of lines) {
      if (exclude.test(line)) continue;
      if (!/button|link/i.test(line)) continue;
      if (!sendLike.test(line)) continue;
      const m = line.match(re);
      if (m) return m[0].replace('[ref=', '').replace(']', '');
    }
    // 備援：輸入列最右側的 button 常是傳送鈕（紙飛機）。排除已知的 表情/語音/新增相片/GIF，取最後一個 button ref
    const knownInputButtons = /選擇表情符號|語音片段|新增相片或影片|選擇 GIF 或貼圖|textbox|訊息/i;
    const buttonRefs: string[] = [];
    for (const line of lines) {
      if (exclude.test(line)) continue;
      if (!/button.*\[ref=(e\d+)\]/.test(line)) continue;
      if (knownInputButtons.test(line)) continue;
      const m = line.match(re);
      if (m) buttonRefs.push(m[0].replace('[ref=', '').replace(']', ''));
    }
    if (buttonRefs.length > 0) return buttonRefs[buttonRefs.length - 1];
    return null;
  }

  if (!findMessageInputRef(dmPanel)) {
    throw new Error(
      '點擊後未進入私訊視窗（找不到訊息輸入框），可能誤點了貼文。請再試一次或改用無附圖的 DM。'
    );
  }

  let imagePhaseSucceeded = imageCount === 0;

  if (imageCount > 0 && imageUrls!.length > 0) {
    // ─── 有附圖：先傳文字（第一則），再傳圖片（第二則）。圖片放入訊息框後按 Enter 即可送出（實測確認）────
    const dmDebugPath = getDmDebugSnapshotPath();
    const dmPanelForAttach = snapshotDmPanelOnly(snapshot);
    try {
      fs.writeFileSync(dmDebugPath, dmPanelForAttach, 'utf-8');
    } catch {
      /* ignore */
    }
    log('dm_panel_saved', `path=${dmDebugPath}`);

    // 第一步：先傳文字（與純文字流程相同）
    const messageInputRefFirst = findMessageInputRef(dmPanelForAttach);
    if (!messageInputRefFirst) {
      throw new Error('點擊後未進入私訊視窗（找不到訊息輸入框），請再試一次或改用無附圖的 DM。');
    }
    log('text_phase', `messageInputRef=${messageInputRefFirst} -> click`);
    click(messageInputRefFirst, profile);
    await sleep(600);
    snapshot = getSnapshot(profile);
    const messageInputRefFresh = findMessageInputRef(snapshotDmPanelOnly(snapshot));
    if (!messageInputRefFresh) throw new Error('點擊輸入框後無法取得有效 ref');
    log('text_phase', `freshRef=${messageInputRefFresh} -> type then Enter`);
    typeTextInElement(messageInputRefFresh, messageText, profile);
    await sleep(500);
    click(messageInputRefFresh, profile);
    await sleep(400);
    pressKey('Enter', profile);
    await sleep(2500);
    log('text_phase', 'done');

    // 第二步：再傳圖片。找附加鈕或 file input，上傳後等圖片出現在對話框，按 Enter 送出
    snapshot = getSnapshot(profile);
    const dmPanelBeforeImage = snapshotDmPanelOnly(snapshot);
    const fileInputRef = findFileInputRef(dmPanelBeforeImage);
    const attachRef = findAttachImageRef(dmPanelBeforeImage);
    if (!fileInputRef && !attachRef) {
      const snippet = dmPanelBeforeImage.slice(0, 800).replace(/\n/g, ' ');
      throw new Error(
        `找不到 DM 的檔案輸入或傳送圖片 icon。DM 視窗 snapshot 已寫入：${dmDebugPath}，尾段預覽：${snippet.slice(0, 200)}…`
      );
    }
    log('image_phase', `fileInputRef=${fileInputRef ?? 'null'} attachRef=${attachRef ?? 'null'}`);
    const localPaths = await downloadImageUrlsToTemp(imageUrls!);
    // 下載圖片後再取一次 snapshot，用最新的 ref 做 upload+click（避免 ref 在等待期間失效）
    snapshot = getSnapshot(profile);
    const dmPanelForUpload = snapshotDmPanelOnly(snapshot);
    const fileInputRefFresh = findFileInputRef(dmPanelForUpload);
    const attachRefFresh = findAttachImageRef(dmPanelForUpload);
    const useFileInput = fileInputRefFresh ?? fileInputRef;
    const useAttachRef = attachRefFresh ?? attachRef;
    log('image_phase', `after download: fileInputRefFresh=${fileInputRefFresh ?? 'null'} attachRefFresh=${attachRefFresh ?? 'null'} -> use ${useFileInput ? 'fileInput' : 'attachRef'}`);
    try {
      if (useFileInput) {
        log('image_phase', `uploadFiles useInputRef=true ref=${useFileInput}`);
        uploadFiles(localPaths, useFileInput, profile, { useInputRef: true });
      } else if (useAttachRef) {
        log('image_phase', `uploadFiles + click attachRef=${useAttachRef}`);
        uploadFiles(localPaths, useAttachRef, profile);
        // 畫面可能更新導致 ref 失效，取最新 ref；僅在 ref 變了時才再執行一次 uploadFiles，否則只補 click
        snapshot = getSnapshot(profile);
        const dmAfterUpload = snapshotDmPanelOnly(snapshot);
        const attachRefAgain = findAttachImageRef(dmAfterUpload);
        const refToClick = attachRefAgain ?? useAttachRef;
        if (refToClick !== useAttachRef) {
          log('image_phase', `after uploadFiles: attachRefAgain=${refToClick} -> uploadFiles+click`);
          uploadFiles(localPaths, refToClick, profile);
        }
        click(refToClick, profile);
      } else {
        throw new Error('下載後找不到檔案輸入或附加鈕 ref，請再試一次');
      }
      // 圖片上傳好後等幾秒讓預覽出現，不按 Escape（Escape 會關閉 DM 對話框本身，導致「先退出再重開、圖片沒送出」）
      log('image_phase', 'wait 3s then find send button');
      await sleep(3000);
      // 優先一：找「傳送」按鈕（藍色紙飛機）並點擊，直接送出圖片；OpenClaw 無法依顏色辨識，只能依無障礙樹的 role/標籤（傳送|send|paper|plane 等）
      let imageSendDone = false;
      snapshot = getSnapshot(profile);
      const dmTailForSend = snapshotDmPanelOnly(snapshot);
      const sendButtonRef = findSendButtonRef(dmTailForSend);
      if (sendButtonRef) {
        try {
          log('image_phase', `click send button (紙飛機) ref=${sendButtonRef}`);
          click(sendButtonRef, profile);
          await sleep(2000);
          imageSendDone = true;
          log('image_phase', 'send button clicked');
        } catch (e) {
          log('image_phase', `send button click failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        log('image_phase', 'send button ref not found in snapshot');
      }
      // 優先二：用 text_phase 成功用的同一個輸入框 ref 再點一次、輸入換行、Enter
      if (!imageSendDone && messageInputRefFresh) {
        try {
          log('image_phase', `reuse text_phase ref=${messageInputRefFresh} -> click, type \\n, Enter`);
          click(messageInputRefFresh, profile);
          await sleep(600);
          typeTextInElement(messageInputRefFresh, '\n', profile);
          await sleep(500);
          click(messageInputRefFresh, profile);
          await sleep(400);
          pressKey('Enter', profile);
          await sleep(1500);
          imageSendDone = true;
          log('image_phase', 'reuse ref done');
        } catch (e) {
          log('image_phase', `reuse ref failed: ${e instanceof Error ? e.message : String(e)} -> fallback to snapshot`);
        }
      }
      if (!imageSendDone) {
      log('image_phase', 'getSnapshot -> find message input');
      snapshot = getSnapshot(profile);
      let dmTail = snapshotDmPanelOnly(snapshot);
      let messageInputForImage = findMessageInputRef(dmTail);
      if (!messageInputForImage) {
        log('image_phase', 'messageInput null, retry snapshot in 1s');
        await sleep(1000);
        snapshot = getSnapshot(profile);
        dmTail = snapshotDmPanelOnly(snapshot);
        messageInputForImage = findMessageInputRef(dmTail);
      }
      log('image_phase', `messageInputForImage=${messageInputForImage ?? 'null'} sendButtonRef=${findSendButtonRef(dmTail) ?? 'null'}`);
      // 寫入 Escape 後 OpenClaw 看到的對話框 snapshot 與選到的 ref，方便除錯
      try {
        const refReport = [
          '',
          '=== Escape 後（OpenClaw 看到的對話框，用於找輸入框）===',
          dmTail,
          '--- 選到的 ref ---',
          `messageInputForImage=${messageInputForImage ?? 'null'}`,
          `sendButtonRef=${findSendButtonRef(dmTail) ?? 'null'} (傳送/紙飛機)`,
        ].join('\n');
        fs.appendFileSync(dmDebugPath, refReport, 'utf-8');
      } catch {
        /* ignore */
      }
      if (messageInputForImage) {
        try {
          log('image_phase', `click ${messageInputForImage}`);
          click(messageInputForImage, profile);
          await sleep(600);
        } catch (e) {
          log('image_phase', `click failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      snapshot = getSnapshot(profile);
      const messageInputFresh = findMessageInputRef(snapshotDmPanelOnly(snapshot));
      log('image_phase', `messageInputFresh=${messageInputFresh ?? 'null'}`);
      try {
        const refsList = extractAllRefs(dmTail);
        fs.appendFileSync(
          dmDebugPath,
          `messageInputFresh=${messageInputFresh ?? 'null'}\n--- 此區所有 ref 列表（可對照上方 snapshot）---\n${refsList.join(', ')}\n`,
          'utf-8'
        );
      } catch {
        /* ignore */
      }
      if (messageInputFresh) {
        try {
          log('image_phase', `click ${messageInputFresh} then type \\n`);
          click(messageInputFresh, profile);
          await sleep(800);
          // 對「訊息」輸入框 ref 直接 type 換行，常能觸發送出（比整頁 press Enter 穩定）
          typeTextInElement(messageInputFresh, '\n', profile);
          await sleep(1500);
        } catch (e) {
          log('image_phase', `click/type failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      } // end if (!imageSendDone)
      // 備援：僅在未點到傳送鈕／未重用輸入框時才按 Enter（已點傳送鈕則跳過，避免多餘按鍵）
      if (!imageSendDone) {
        log('image_phase', 'pressKey Enter x2');
        pressKey('Enter', profile);
        await sleep(600);
        pressKey('Enter', profile);
        await sleep(2500);
      }
      imagePhaseSucceeded = true;
      log('image_phase', 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', msg);
      if (/not found|not visible|Element.*e\d+.*not/i.test(msg)) {
        try {
          pressKey('Escape', profile);
          await sleep(2000);
        } catch {
          /* ignore */
        }
        throw new Error(
          '剛剛可能點到貼文或彈窗，畫面已切換導致 ref 失效。已按 Escape 關閉彈窗，請再試一次發送。'
        );
      }
      throw err;
    } finally {
      localPaths.forEach((p) => {
        try {
          fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      });
    }
  } else {
    // ─── 純文字：輸入後按 Enter 送出 ────
    log('text_only', 'no image');
    const dmPanelForInput = snapshotDmPanelOnly(snapshot);
    const messageInputRef = findMessageInputRef(dmPanelForInput);
    if (!messageInputRef) {
      throw new Error('找不到 DM 訊息輸入框，請確認私訊視窗已開啟');
    }
    log('text_only', `ref=${messageInputRef} -> click, type, Enter`);
    click(messageInputRef, profile);
    await sleep(600);
    snapshot = getSnapshot(profile);
    const messageInputRefFresh = findMessageInputRef(snapshotDmPanelOnly(snapshot));
    if (!messageInputRefFresh) {
      throw new Error('點擊輸入框後無法取得有效 ref');
    }
    typeTextInElement(messageInputRefFresh, messageText, profile);
    await sleep(500);
    click(messageInputRefFresh, profile);
    await sleep(400);
    pressKey('Enter', profile);
    await sleep(2000);
    log('text_only', 'done');
  }

  log('result', `textSent=true imagePhaseSucceeded=${imagePhaseSucceeded}`);
  return {
    textSent: true,
    imageUrlsIncluded: imageCount,
    imagePhaseSucceeded,
  };
}
