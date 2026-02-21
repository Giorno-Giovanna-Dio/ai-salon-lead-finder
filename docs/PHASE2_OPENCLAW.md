# Phase 2: OpenClaw 整合說明

## 已完成

### 1. OpenClaw 介面層（`src/lib/openclaw-adapter.ts`）
- **本地模式**：透過 `OPENCLAW_PROJECT_ROOT` 執行 OpenClaw CLI（`navigate`、`snapshot`、`click`、`pressKey`）
- **Worker 模式**：透過 `CRAWLER_API_URL` + `CRAWLER_API_KEY` 呼叫遠端 Crawler API（生產環境）
- `isOpenClawAvailable()`、`getOpenClawMode()` 供 UI 與流程判斷使用

### 2. Hashtag 搜尋整合
- **`src/lib/openclaw-hashtag-search.ts`**：依 campaign 的 hashtags、粉絲範圍執行搜尋，回傳 `InstagramProfile[]`
- **`src/crawler/run-campaign-openclaw.ts`**：可執行腳本，讀取 campaignId → 跑 Hashtag 搜尋 → 以現有 AI 分析建立 Lead 並寫入 DB
- **`POST /api/campaigns/[id]/run`**：當 `OPENCLAW_PROJECT_ROOT` 已設定時，會 spawn 上述腳本執行真實搜尋，完成後回傳 profilesFound / leadsCreated

### 3. Instagram 帳號登入說明
- **系統設定** 頁面新增「OpenClaw 整合」區塊：顯示是否偵測到 OpenClaw、專案路徑或 Worker 狀態
- 登入說明：請在 OpenClaw 專案中依序使用 `browser-profile profile-1` ～ `profile-4` 登入 4 個 IG 帳號，並在「Instagram 帳號管理」手動標記已登入（或日後接「檢查登入狀態」API）

### 4. 環境變數（`.env`）
- `OPENCLAW_PROJECT_ROOT`：本地 OpenClaw 專案路徑（需已安裝 `openclaw` 並可執行 `pnpm openclaw browser`）
- `CRAWLER_API_URL`、`CRAWLER_API_KEY`：生產環境 Crawler Worker 用（選填）

---

## 待實作（DM 發送與回應檢查）

### DM 發送（實際透過 OpenClaw 送 IG DM）
- **目前**：`dm-service.sendDm()` 會更新 DB 狀態並標記帳號使用，但 **未** 呼叫 OpenClaw 送真實 DM（程式內有 `// TODO: 呼叫 OpenClaw 實際發送 DM`）
- **建議**：在 `openclaw-adapter` 或獨立模組實作 `sendDmViaOpenClaw(browserProfile, targetUsername, messageText)`，流程約為：登入該 profile → 開啟 Instagram Direct → 對目標用戶發送訊息；再在 `dm-service.sendDm()` 中於更新 DB 後呼叫此函式

### 回應檢查（DM inbox 爬取與分類）
- **建議**：新增腳本或 API，例如 `check-inbox-openclaw.ts` 或 `POST /api/accounts/check-inbox`
  - 使用 OpenClaw 開啟 IG Direct inbox，取得新訊息
  - 對每則新訊息呼叫現有 AI 做情感/意圖分類，寫入 `Response` 並更新 Lead 狀態

---

## 使用方式

1. **設定環境**：在 `.env` 設定 `OPENCLAW_PROJECT_ROOT`（或生產環境設定 `CRAWLER_API_URL`）
2. **登入 IG**：在 OpenClaw 專案中依序以 profile-1～4 登入 4 個帳號
3. **執行搜尋任務**：在 Dashboard 建立任務後，於任務詳情頁按「執行任務」；若 OpenClaw 可用，會實際跑 Hashtag 搜尋並建立潛在客戶
4. **DM 發送**：目前仍僅更新 DB 狀態；實際發送需接上 OpenClaw 發送流程（見上方「待實作」）
