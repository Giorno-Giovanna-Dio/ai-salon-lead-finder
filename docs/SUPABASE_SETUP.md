# Supabase 設定指南

## 步驟 1: 登入 Supabase

前往 [Supabase Dashboard](https://supabase.com/dashboard)

## 步驟 2: 確認專案

確認您已選擇專案：**AI-Salon-Lead-Automation**

## 步驟 3: 獲取 DATABASE_URL

1. 點擊左側選單的 **⚙️ Project Settings**
2. 選擇 **Database** 標籤
3. 找到 **Connection string** 區域
4. 點擊 **URI** 標籤
5. 複製完整的連線字串，應該像這樣：
   ```
   postgresql://postgres:aisalonleadautomation@db.xxxxx.supabase.co:5432/postgres
   ```
6. 貼到 `.env` 檔案的 `DATABASE_URL=`

## 步驟 4: 獲取 Supabase API 資訊

1. 點擊左側選單的 **⚙️ Project Settings**
2. 選擇 **API** 標籤

### 4.1 Project URL
- 在頁面上方可以看到 **Project URL**
- 複製它（例如：`https://xxxxx.supabase.co`）
- 貼到 `.env` 檔案的 `NEXT_PUBLIC_SUPABASE_URL=`

### 4.2 API Keys

在 **Project API keys** 區域，您會看到兩個 key：

#### anon public key
- 這個 key 是公開的，可以在前端使用
- 複製 **anon** / **public** key
- 貼到 `.env` 檔案的 `NEXT_PUBLIC_SUPABASE_ANON_KEY=`

#### service_role key（⚠️ 重要：保密！）
- 這個 key 有完整權限，只能在後端使用
- 點擊 👁️ 圖示顯示 **service_role** key
- 複製它
- 貼到 `.env` 檔案的 `SUPABASE_SERVICE_KEY=`
- ⚠️ **絕對不要**把這個 key 放到前端程式碼或提交到 git

## 步驟 5: 建立 Storage Bucket（圖片儲存）

1. 點擊左側選單的 **🗄️ Storage**
2. 點擊 **New bucket**
3. 填寫：
   - **Name**: `dm-images`
   - **Public bucket**: ✅ 勾選（圖片需要公開訪問）
   - **File size limit**: 5 MB（可選）
   - **Allowed MIME types**: `image/*`（可選）
4. 點擊 **Create bucket**

## 步驟 6: 建立 .env 檔案

複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

然後填入您從 Supabase 獲取的資訊。

## 步驟 7: 初始化資料庫

安裝依賴並初始化資料庫：

```bash
# 安裝依賴
npm install

# 生成 Prisma client
npm run db:generate

# 推送資料庫 schema 到 Supabase
npm run db:push
```

## 完成！✅

設定完成後，您可以：

1. 查看資料庫：
   ```bash
   npm run db:studio
   ```
   這會在瀏覽器開啟 Prisma Studio，您可以直接查看和編輯資料。

2. 測試連線：
   ```bash
   npm run dev
   ```

## 常見問題

### Q: 找不到 Project URL 或 API Keys？
A: 確保您在正確的專案中。在 Supabase Dashboard 右上角可以切換專案。

### Q: DATABASE_URL 連線失敗？
A: 確認密碼是否正確（`aisalonleadautomation`），並且沒有特殊字元需要 URL encode。

### Q: Storage bucket 建立失敗？
A: 檢查 bucket 名稱是否已存在，或重新整理頁面再試一次。

## 安全提醒 🔒

1. ✅ `.env` 已加入 `.gitignore`，不會被提交到 git
2. ⚠️ 絕對不要把 `SUPABASE_SERVICE_KEY` 暴露在前端
3. ✅ 使用 `NEXT_PUBLIC_` 前綴的變數才能在前端使用
4. 🔄 如果不小心洩漏了 key，立即到 Supabase Dashboard 重新生成

## 下一步

設定完成後，繼續開發：
- [開發指南](../README.md)
- [資料庫 Schema](../prisma/schema.prisma)
- [API 文件](./API.md)（待建立）
