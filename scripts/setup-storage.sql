-- Supabase Storage Bucket 設定腳本
-- 在 Supabase Dashboard > SQL Editor 執行此腳本

-- 建立 dm-images bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('dm-images', 'dm-images', true)
ON CONFLICT (id) DO NOTHING;

-- 設定 bucket 權限（允許所有人讀取，但只有認證用戶可上傳）
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'dm-images' );

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'dm-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'dm-images' )
WITH CHECK ( bucket_id = 'dm-images' );

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
USING ( bucket_id = 'dm-images' );
