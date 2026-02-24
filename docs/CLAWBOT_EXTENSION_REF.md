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

---

## OpenClaw 發送 DM 流程（如何找到「圖片按鈕」）

OpenClaw 的執行流程可以簡化成：

1. **getSnapshot(profile)**  
   向 OpenClaw 要目前頁面的「文字版 DOM」 snapshot，裡面每一行可能帶 `[ref=e數字]`，每個 ref 對應畫面上一個可操作元素（按鈕、輸入框等）。

2. **用關鍵字找 ref**  
   我們在 snapshot 裡搜尋「和某個關鍵字同一行」的 ref，例如找「私訊」→ 得到某個 ref → 用那個 ref 去點擊。  
   **圖片按鈕**：在 DM 視窗（snapshot 最後約 250 行）裡找含有 `photo|camera|image|gallery|attach|圖片|相片|附加|媒體|圖|相簿` 等關鍵字的那一行，該行的 `[ref=eXX]` 就是我們用來點擊或上傳的 ref。

3. **下指令**  
   - `click(ref)`：點擊該 ref 對應的元素  
   - `type(ref, "文字")`：在該 ref 的輸入框打字  
   - `upload(本機路徑, ref)` 或 `upload(本機路徑, ref, { useInputRef: true })`：把檔案送給該 ref（按鈕會開檔案選擇；若 ref 是 `<input type="file">` 則直接設檔）  
   - `pressKey('Enter')`：整頁按 Enter。**有附圖時**：流程改為 **先傳文字，再傳圖片**（共兩則訊息）。圖片放入訊息框後，會先對「訊息」輸入框 ref 做 **type 換行**（`type ref "\n"`）觸發送出，再備援整頁 `press Enter`（因整頁 Enter 有時送不到該輸入框）。
   - **傳圖後送出**：上傳圖片、等 3 秒（**不按 Escape**，避免關閉 DM 對話框導致「先退出再重開、圖片沒送出」），依序嘗試：(1) **先找「傳送」按鈕（紙飛機）** 並點擊；(2) 若找不到或點擊失敗，再試重用傳文字時的輸入框 ref → type 換行 → Enter；(3) 若仍失敗才 getSnapshot 找新 ref。日誌會印 `wait 3s then find send button`、`click send button (紙飛機) ref=eXXX` 或 `send button ref not found`。

4. **為什麼找不到圖片按鈕？**  
   IG 畫面上的「山/太陽圖示」在 snapshot 裡可能被標成別的名字（例如只有 `button`、或英文 `media`）。若我們用的關鍵字都沒出現，就會找不到 ref。

**除錯方式**：發送附圖 DM 時，程式會把「OpenClaw 看到的對話框」snapshot 與 ref 報告寫到暫存檔，檔名含**時間戳**（例如 `openclaw-dm-panel-snapshot-20260224113045.txt`），每次發送會產生新檔，方便保留多筆對照。

- **Snapshot 檔內容（可看出 OpenClaw 看到的對話框與 ref）**：
  1. **開頭**：點開 DM 後、傳圖前的「DM 視窗」snapshot 尾段（約最後 250 行）。
  2. **傳圖等待後**：上傳圖片並等待後，用來找「傳送鈕／訊息輸入框」的那段 snapshot（對話框尾段；若走 fallback 才會寫入）。
  3. **選到的 ref**：`messageInputForImage`、`messageInputFresh`（程式用這兩個 ref 去點擊／輸入）。
  4. **此區所有 ref 列表**：該段 snapshot 裡出現的每一個 `[ref=eXXX]` 不重複列表，可對照上方 snapshot 看每個 ref 對應哪一行。
- **步驟日誌（不再是 black box）**：每次發送時，server 終端機會印出 `[OpenClaw DM]` 開頭的日誌，例如：
  - **去哪裡看**：在 **你跑 `npm run dev`（或 `pnpm dev`）的那個終端機**。也就是啟動 Next 的同一視窗，發送 DM 時日誌會印在那裡，捲到最後幾行或搜尋 `OpenClaw DM` 即可。
  - 範例：
  - `[OpenClaw DM] start | profile=openclaw target=@xxx hasImage=true`
  - `[OpenClaw DM] open_dm | click profile 發送訊息 ref=e214`
  - `[OpenClaw DM] text_phase | messageInputRef=e595 -> click`、`text_phase done`
  - `[OpenClaw DM] image_phase | fileInputRef=... attachRef=...`、`messageInputForImage=e595`、`click e595`、`pressKey Enter x2`、`image_phase done`
  - 若出錯會印 `[OpenClaw DM] error | <OpenClaw 回報的錯誤內容>`
  - 用 `grep "OpenClaw DM"` 或看終端最後幾行即可對照「卡在哪一步、用了哪個 ref」。
- **Snapshot 暫存檔路徑**：預設在 **`/tmp/`**（macOS/Linux），檔名格式為 `openclaw-dm-panel-snapshot-YYYYMMDDHHmmss.txt`。日誌會印出 `[OpenClaw DM] dm_panel_saved | path=...`，該 path 就是檔案位置。
- **怎麼看**：
  - 終端機：`open /tmp`（macOS 用 Finder 開 /tmp）、`ls -t /tmp/openclaw-dm-panel-snapshot-*.txt` 列出檔案（最新在前）、`cat /tmp/openclaw-dm-panel-snapshot-*.txt` 看內容。
  - 錯誤訊息裡也會印出當次寫入的完整路徑，直接複製貼到終端或編輯器開啟即可。
- 若設定了環境變數 **`OPENCLAW_DM_DEBUG_SNAPSHOT`**，則寫入該路徑（不自動加時間戳），例如 `OPENCLAW_DM_DEBUG_SNAPSHOT=/Users/you/dm-debug.txt` 可固定寫到同一個檔方便比對。

請：

1. 再試一次「附圖 DM」讓它失敗（或等錯誤發生）。
2. 用錯誤訊息中的路徑開啟該檔案，對照你畫面上 DM 輸入列（表情、麥克風、**圖片**、送出等）。
3. 在 snapshot 裡找到「圖片按鈕」對應的那一行，看該行出現什麼關鍵字與 `[ref=eXX]`。
4. 把該關鍵字或 ref 規則回報或加進 `openclaw-dm.ts` 的 `findAttachImageRef` / `findFileInputRef`，下次就能對到正確按鈕。

- **傳送按鈕**：圖片在訊息框後，程式會先嘗試找「傳送」按鈕（關鍵字：傳送、送出、send、paper、plane、紙飛機）並點擊；若 snapshot 裡沒有這些字（例如只有圖示），可打開同一個 snapshot 暫存檔，找輸入列最右側紙飛機按鈕對應的那一行，把該行出現的關鍵字加進 `findSendButtonRef`。若仍偵測不到，會改為點「訊息」輸入框再按 Enter 送出。

### OpenClaw 瀏覽器 log 怎麼看

若你有開 `openclaw-browser-log/openclaw-*.log`（或 Gateway 的 log），格式是 **一行一筆 JSON**：`{"0":"訊息內容", "_meta":{ "date":"...", "logLevelName":"INFO" }, "time":"..." }`。重點欄位：

- **"0"**：實際日誌內容（可能是 snapshot 全文、或「clicked ref e215」、或錯誤訊息）。
- **browser.request ✗ errorMessage=... Element "e434" not found**：代表某次 `click e434` 時畫面已變（例如點到貼文、彈窗），該 ref 不存在。
- Snapshot 裡 DM 輸入列會出現：`textbox "訊息" [ref=eXXX]`、`button "新增相片或影片" [ref=eYYY]`、`button "語音片段"` 等。**「圖片按鈕」在 IG 網頁版多為「新增相片或影片」**，本專案已把此關鍵字加入辨識。

**Log 檔名含日期與時間**：若你可以在 OpenClaw 專案或 Gateway 端設定 log 輸出路徑，建議檔名除了日期外也壓上時間，方便對照當次執行，例如：`openclaw-YYYY-MM-DD-HH-mm-ss.log`（如 `openclaw-2026-02-24-11-44-30.log`）。實際檔名格式取決於 OpenClaw / Gateway 的設定，本專案不寫入該 log 檔。

### 點到貼文後出現 "Element eXXX not found or not visible"

Ref 是依 snapshot 當下畫面產生的；若過程中點到貼文或彈窗，畫面一換，同一個 ref 就對不到元素了。本專案已做兩件事：

- **排除貼文/留言區**：找「圖片按鈕」「訊息輸入框」時會略過含有 `發佈`、`留言`、`/p/`、`reel`、貼文、comment、讚 等關鍵字的行，降低誤選到貼文區按鈕的機率。
- **只點 DM 的「新增相片或影片」**：snapshot 裡很多元素都是 `[cursor=pointer]`（例如 profile 的「發送訊息」「追蹤」、側欄「訊息」「首頁」等）。本專案找附加圖鈕時會**優先只認**含「新增相片或影片」且為 `button` 或 `img` 的那一行，並排除 profile 區的發送訊息、追蹤、類似帳號、首頁、Reel、搜尋等，避免點到其他東西導致 ref 失效。
- **傳圖後不按 Escape**：上傳圖片後僅等待 3 秒即找傳送鈕點擊；**不按 Escape**，避免在 IG 網頁版關閉到 DM 對話框本身（會變成先退出對話框、再重開時圖片沒送出）。
- **點擊失敗時關閉彈窗**：若錯誤訊息含 "not found" 或 "not visible"，程式會自動按 **Escape** 關閉彈窗，並拋出「請再試一次發送」的提示，你只要重新按一次發送即可。

### OpenClaw 可以偵測「藍色的按鈕」嗎？

**不行。** OpenClaw 的 snapshot 來自頁面的 **無障礙樹（accessibility tree）／DOM**，只有元素類型、角色、名稱（例如 `button`、`傳送`、`Send`），**沒有顏色資訊**。所以無法用「藍色」來找按鈕。我們改為用 **findSendButtonRef** 依標籤找「傳送／送出／send／paper／plane／紙飛機」等，對應畫面上那顆藍色傳送鈕；傳圖後會**優先點擊該傳送按鈕**，若 snapshot 裡有對應的 button 就會被點到。

---

## 故障排除

### `page.goto: Page crashed`（導向 IG 時崩潰）

通常是 Chromium 在載入 Instagram 時崩潰，多為記憶體或 GPU/沙箱問題。

- **本專案**：送 DM 時改為**先導航到潛在客戶的 profile 頁**（較輕量）→ 點擊「私訊」按鈕 → 輸入內容 → 送出，避開直接載入 `/direct/new/`。若 profile 導航仍崩潰，會自動重試最多 3 次。
- **若仍常崩潰**：
  1. 關閉其他吃記憶體的程式，再試一次。
  2. 在 **clawdbot_hair_domain**（或你設的 OpenClaw 專案）裡，確認啟動 Chromium 時有加上穩定參數，例如：`--disable-dev-shm-usage`、`--no-sandbox`（依 OpenClaw 該專案的文件或設定調整）。
  3. 使用全新的 browser profile，或刪除該 profile 的 cache 後再登入 IG 一次。
