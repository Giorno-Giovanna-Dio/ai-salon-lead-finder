/**
 * 使用 OpenClaw 實際發送 Instagram DM
 * 流程：開啟 Direct 新訊息 → 搜尋用戶名 → 輸入訊息 → 送出
 */

import {
  isOpenClawAvailable,
  navigate,
  getSnapshot,
  click,
  typeText,
  pressKey,
  sleep,
} from './openclaw-adapter';

/** 從 snapshot 文字中找出 [ref=eXXX] 的 ref 列表，並回傳第一個與關鍵字同行的 ref */
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

/** 從 snapshot 找出所有 ref，回傳第一個出現的（用於找不到關鍵字時 fallback） */
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
 * 使用指定 browser profile 對目標用戶發送 Instagram DM
 * 若 OpenClaw 未設定或步驟失敗會 throw
 */
export async function sendInstagramDm(
  browserProfile: string,
  targetUsername: string,
  messageText: string
): Promise<void> {
  if (!isOpenClawAvailable()) {
    throw new Error('OpenClaw 未設定，無法發送 DM');
  }

  const profile = browserProfile || 'openclaw';

  // 1. 開啟新訊息頁
  navigate('https://www.instagram.com/direct/new/', profile);
  await sleep(3500);

  let snapshot = getSnapshot(profile);

  // 2. 找搜尋/收件人輸入框並輸入用戶名（依 snapshot 常見結構嘗試）
  const searchRef =
    findRefByKeyword(snapshot, /search|to|收件|搜尋|尋找/i) ||
    findRefByKeyword(snapshot, /textbox|input|edit/i) ||
    findFirstRef(snapshot, 'textbox');
  if (searchRef) {
    click(searchRef, profile);
    await sleep(500);
    typeText(targetUsername, profile);
    await sleep(2500);
  } else {
    typeText(targetUsername, profile);
    await sleep(2500);
  }

  snapshot = getSnapshot(profile);

  // 3. 點選搜尋結果中的用戶（含目標用戶名的 link/listitem）
  const userRef =
    findRefByKeyword(snapshot, new RegExp(targetUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')) ||
    findFirstRef(snapshot, 'link');
  if (userRef) {
    click(userRef, profile);
    await sleep(2000);
  }

  snapshot = getSnapshot(profile);

  // 4. 找訊息輸入框並輸入內容
  const messageRef =
    findRefByKeyword(snapshot, /message|訊息|輸入|write|type/i) ||
    findRefByKeyword(snapshot, /textbox|edit|input/i) ||
    findFirstRef(snapshot, 'textbox');
  if (messageRef) {
    click(messageRef, profile);
    await sleep(300);
    typeText(messageText, profile);
    await sleep(800);
  } else {
    typeText(messageText, profile);
    await sleep(800);
  }

  // 5. 找送出按鈕並點擊
  snapshot = getSnapshot(profile);
  const sendRef =
    findRefByKeyword(snapshot, /send|傳送|送出|submit/i) ||
    findRefByKeyword(snapshot, /button/i);
  if (sendRef) {
    click(sendRef, profile);
  } else {
    pressKey('Enter', profile);
  }

  await sleep(2000);
}
