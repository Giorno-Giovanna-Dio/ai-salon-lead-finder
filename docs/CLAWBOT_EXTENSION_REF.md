# 參考：clawdbot hair-lead-finder-browser

專案 [clawdbot_hair_domain](https://github.com/Giorno-Giovanna-Dio/clawdbot_hair_domain) 底下的 **extensions/hair-lead-finder-browser** 已實作「用 OpenClaw 搜尋 hashtag → 點貼文/看 profile → snapshot → LLM 分析 → 鎖定適合的 IG 帳號」，與本專案目標一致，可作為實作與除錯參考。

## 如何參考（較推薦：不一定要 clone）

- **推薦：只參考、不 clone**  
  若只是要對照邏輯或複製正則／流程到本專案，直接看 GitHub 即可，不必 clone：
  - [extensions/hair-lead-finder-browser 目錄](https://github.com/Giorno-Giovanna-Dio/clawdbot_hair_domain/tree/main/extensions/hair-lead-finder-browser)
  - 需要時可看 [src/ 原始碼](https://github.com/Giorno-Giovanna-Dio/clawdbot_hair_domain/tree/main/extensions/hair-lead-finder-browser/src)（如 `ig-crawler.ts`、`real-crawler.ts`、`analyzer.ts`）。

- **需要 clone 的情況**：只有當你想「在本地跑 extension 的 demo（如 `bun run demo`）或把程式碼放在旁邊對照除錯」時才需要：
  ```bash
  git clone --depth 1 https://github.com/Giorno-Giovanna-Dio/clawdbot_hair_domain.git
  cd clawdbot_hair_domain/extensions/hair-lead-finder-browser && bun install && bun run demo
  ```

- **方式三（submodule）**：若本專案已用 `vendor/clawdbot_hair_domain`，extension 路徑為  
  `vendor/clawdbot_hair_domain/extensions/hair-lead-finder-browser/`

## 與本專案的對應

| 功能 | clawdbot extension | 本專案 |
|------|--------------------|--------|
| Hashtag 搜尋 | `ig-crawler.ts` `searchHashtag`、`real-crawler.ts` 雙策略 | `src/lib/openclaw-hashtag-search.ts` |
| 從 hashtag 頁取 @mentions | `real-crawler.ts` 用 `snapshot.matchAll(/@([a-zA-Z0-9_.]{3,30})/g)` 再直接造訪 profile | 已採用相同策略（`runHashtagSearchForCampaign`） |
| 從貼文取 ref / 點貼文 | `ig-crawler.ts` `extractPostRefs`、`extractUsernameFromPost`；`real-crawler.ts` 用 `link "..." [ref=eXXX]` + `/url: /p/` | 尚未實作「點貼文再取 username」的 fallback，可從 extension 複用 |
| Profile snapshot 解析 | `ig-crawler.ts` `extractProfileData`（followers/bio/fullName/parseCount）、`real-crawler.ts` `extractProfileFromSnapshot` | `openclaw-hashtag-search.ts` 的 `extractProfileFromSnapshot` 與 `parseCount` 邏輯已對齊 |
| 關閉貼文 modal | `ig-crawler.ts` `closeModal`（Escape 或點關閉） | 可參考加入，供未來「點貼文」流程使用 |

## 建議可再對齊的部分

1. **貼文 ref 解析**：若 @mentions 數量不足，可參考 `ig-crawler.ts` 的 `extractPostRefs` 與 `real-crawler.ts` 的 post ref 正則（`link "..." [ref=(e\d+)]` 搭配 `/url: /p/`、`/reel/`），在 `openclaw-hashtag-search.ts` 或 run-campaign 流程中加上「點貼文 → 從 modal snapshot 取 username → 造訪 profile」的 fallback。
2. **Snapshot 關鍵字**：extension 使用 `heading "..."`、`button "..."`、`link "..."` 等；若本專案 OpenClaw 輸出格式一致，可統一用相同正則以利維護。

本專案未直接依賴該 extension 的 npm 套件，僅在程式與文件上參考其流程與解析方式。

## 現在可以做的實測（本專案內）

不需 clone extension，在 **ai-salon-lead-finder** 裡即可做：

1. **起站與儀表板**：`npm run dev` → 開 `http://localhost:3000`，看儀表板、快速開始、看板入口。
2. **看板**：側欄「看板」或「潛在客戶」→「看板檢視」，拖曳卡片改狀態（會打 `PATCH /api/leads/[id]`）。
3. **搜尋任務**：建立 campaign（hashtags、粉絲範圍）→ 在任務詳情按「執行」；若有設 `OPENCLAW_PROJECT_ROOT` 且 OpenClaw 可用，會跑 hashtag 搜尋並寫入 Lead。
4. **潛在客戶與 DM**：在潛在客戶列表點進某位 → 編輯/建立 DM 文案 → 按發送；若 OpenClaw 可用會真的送 IG DM，否則僅更新 DB 狀態。
5. **檢查 inbox**：`POST /api/accounts/check-inbox`（或 `npx tsx scripts/check-inbox-openclaw.ts`，需先起 dev）會用 OpenClaw 開 Direct、解析對話、AI 分類並寫入 Response。

**無 OpenClaw 時**：3、4、5 的「實際爬蟲/送 DM/inbox」會跳過或失敗，但 1、2 與「建立任務、列表、看板、DM 文案編輯」都可正常測。

---

## 為什麼沒用 OpenClaw？如何真的啟用？

**原因**：按「執行」時會先檢查 `isOpenClawAvailable()`。目前為 `false` 代表：

- 沒有設定 `OPENCLAW_PROJECT_ROOT`，**且**
- 專案裡沒有 `vendor/clawdbot_hair_domain` 資料夾（或該路徑不存在）

所以程式只會寫日誌「OpenClaw 未設定，僅記錄日誌」，不會跑真實搜尋／送 DM／檢查 inbox。

**要真的用 OpenClaw，任選一種方式：**

### 方式 A：指定已安裝 OpenClaw 的專案路徑（推薦）

1. 在本機 clone（若尚未有）並安裝依賴，**請分開執行**（不要整行含註解一次貼）：
   ```bash
   cd /Users/davidchung/Desktop/coding_projects/clawdbot_hair_domain
   ```
   然後：
   ```bash
   pnpm install
   ```
2. 確認在該目錄能執行 OpenClaw（路徑請改成你的實際位置）：
   ```bash
   cd /Users/davidchung/Desktop/coding_projects/clawdbot_hair_domain
   pnpm openclaw browser --browser-profile openclaw navigate "https://www.instagram.com"
   ```
   若出現 `Command "openclaw" not found`，代表在**錯誤的目錄**（例如還在 ai-salon-lead-finder）或尚未在該目錄執行過 `pnpm install`。

3. **先啟動 Gateway（必做）**：`openclaw browser` 會連到本機 Gateway (ws://127.0.0.1:18789)，若沒開會出現 `gateway closed (1006)`。請**另開一個終端**，在 clawdbot_hair_domain 目錄執行並保持運行：
   ```bash
   cd /Users/davidchung/Desktop/coding_projects/clawdbot_hair_domain
   pnpm openclaw gateway --port 18789 --verbose
   ```
   看到 Gateway 已監聽後，再在**原終端**執行步驟 2 的 browser 指令。

4. 在 **ai-salon-lead-finder** 的 `.env` 加上（路徑改成你本機的實際路徑）：
   ```env
   OPENCLAW_PROJECT_ROOT=/Users/你的帳號/Desktop/coding_projects/clawdbot_hair_domain
   ```
5. 重啟 `npm run dev`，再按一次搜尋任務的「執行」。**執行前請確認 Gateway 已在另一終端運行**（步驟 3），否則會出現 `gateway closed (1006)`。此時會改跑 `run-campaign-openclaw.ts`，用 OpenClaw 做 hashtag 搜尋並寫入 Lead；送 DM、檢查 inbox 也會改用 OpenClaw。

### 方式 B：用 submodule 放在本專案裡

1. 在 ai-salon-lead-finder 根目錄：
   ```bash
   git submodule add https://github.com/Giorno-Giovanna-Dio/clawdbot_hair_domain.git vendor/clawdbot_hair_domain
   cd vendor/clawdbot_hair_domain && pnpm install
   ```
2. **不要**設 `OPENCLAW_PROJECT_ROOT`，程式會自動用 `vendor/clawdbot_hair_domain`。
3. 同樣要能在該目錄執行 `pnpm openclaw browser ...`，再重啟 dev 後測試。

**注意**：OpenClaw 需能開瀏覽器並操作 Instagram（例如已登入的 browser profile）；若專案用 `openclaw` 套件，請依該專案說明安裝並登入 IG。

---

## 兩件事要先對齊（避免「找到 0 個」）

### 1. Browser profile 名稱要一致

- **我們這邊**：ai-salon-lead-finder 從 DB 讀「要用哪個瀏覽器設定」→ 欄位叫 `browserProfile`（例如 seed 預設是 `profile-1`）。
- **OpenClaw 那邊**：clawdbot_hair_domain 執行時用的是 `--browser-profile openclaw`，代表它**實際存在的 profile 名稱**可能是 `openclaw`。
- **要一致**：我們送給 OpenClaw 的名稱必須是「OpenClaw 裡真的有建的那個」。若你手動測試時都是用 `openclaw`，就把 DB 裡要拿來跑任務的那個帳號的 `browserProfile` 改成 `openclaw`（見下方「改 DB」）；或反過來，在 OpenClaw 裡建一個叫 `profile-1` 的 profile，並用那個登入 IG。

**改 DB（讓第一個帳號用 openclaw）**：在專案目錄執行一次：
```bash
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.instagramAccount.updateMany({ data: { browserProfile: 'openclaw' }, where: { browserProfile: 'profile-1' } }).then(r => { console.log('Updated', r.count); p.\$disconnect(); });
"
```
（或手動用 Prisma Studio / SQL 把某筆的 `browserProfile` 改成 `openclaw`。）

### 2. 該 profile 要先在瀏覽器裡登入 Instagram

- 我們的腳本會用 OpenClaw 開「hashtag 頁」並讀畫面；若**沒登入 IG**，畫面會是登入頁，沒有 @ 帳號可抓，就會「找到 0 個」。
- **做法**：Gateway 開著時，在終端用**同一個 profile 名稱**（例如 `openclaw`）開一次 IG，手動登入：
  ```bash
  cd /Users/davidchung/Desktop/coding_projects/clawdbot_hair_domain
  pnpm openclaw browser --browser-profile openclaw navigate "https://www.instagram.com/"
  ```
  會跳出瀏覽器視窗 → 在裡面登入你的 IG 帳號 → 之後關掉視窗即可。下次跑「執行」時，腳本用同一個 profile 就會是已登入狀態。
