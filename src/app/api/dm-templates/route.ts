import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { DmStyle } from '@prisma/client';

const VALID_STYLES: DmStyle[] = ['PROFESSIONAL', 'FRIENDLY', 'VALUE_FOCUSED'];
const MAX_IMAGES = 10;
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** 上傳檔案到 dm-images 的指定前綴路徑，回傳公開 URL 陣列 */
async function uploadTemplateImages(prefix: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`圖片 ${file.name} 超過 ${MAX_SIZE_MB}MB 限制`);
    if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`不支援的格式：${file.name}`);
    const storagePath = `${prefix}/${i + 1}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabaseAdmin.storage.from('dm-images').upload(storagePath, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error(`上傳圖片失敗 (${i + 1}/${files.length}): ${error.message}`);
    const { data: { publicUrl } } = supabaseAdmin.storage.from('dm-images').getPublicUrl(storagePath);
    urls.push(publicUrl);
  }
  return urls;
}

export async function GET() {
  try {
    const templates = await db.dmTemplate.findMany({
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    });
    return NextResponse.json({
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        content: t.content,
        style: t.style,
        category: t.category,
        imageUrls: t.imageUrls ?? [],
        usageCount: t.usageCount,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let name = '';
    let content = '';
    let style: DmStyle = 'PROFESSIONAL';
    let category = 'general';
    let imageFiles: File[] = [];
    let imageUrlsInput: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = (formData.get('name') as string)?.trim() ?? '';
      content = (formData.get('content') as string)?.trim() ?? '';
      const styleVal = formData.get('style') as string | undefined;
      style = typeof styleVal === 'string' && VALID_STYLES.includes(styleVal as DmStyle) ? (styleVal as DmStyle) : 'PROFESSIONAL';
      category = ((formData.get('category') as string)?.trim()) || 'general';
      const files = formData.getAll('images') as File[];
      imageFiles = files.filter((f) => f && f.size > 0 && f.type.startsWith('image/'));
      const urlsRaw = formData.get('imageUrls');
      if (typeof urlsRaw === 'string') {
        try {
          const parsed = JSON.parse(urlsRaw) as unknown;
          if (Array.isArray(parsed)) imageUrlsInput = parsed.filter((u): u is string => typeof u === 'string');
        } catch {
          /* ignore */
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      name = typeof body.name === 'string' ? body.name.trim() : '';
      content = typeof body.content === 'string' ? body.content.trim() : '';
      const styleInput = body.style;
      style = typeof styleInput === 'string' && VALID_STYLES.includes(styleInput as DmStyle) ? (styleInput as DmStyle) : 'PROFESSIONAL';
      category = (typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'general');
      if (Array.isArray(body.imageUrls)) imageUrlsInput = body.imageUrls.filter((u): u is string => typeof u === 'string');
    }

    if (!name) return NextResponse.json({ success: false, error: '請填寫範本名稱' }, { status: 400 });
    if (!content) return NextResponse.json({ success: false, error: '請填寫範本內容' }, { status: 400 });
    if (imageFiles.length > MAX_IMAGES) return NextResponse.json({ success: false, error: `最多 ${MAX_IMAGES} 張圖片` }, { status: 400 });

    const template = await db.dmTemplate.create({
      data: { name, content, style, category, imageUrls: [] },
    });

    let imageUrls: string[] = [];
    if (imageFiles.length > 0) {
      const uploaded = await uploadTemplateImages(`templates/${template.id}`, imageFiles);
      imageUrls = [...uploaded, ...imageUrlsInput];
    } else {
      imageUrls = imageUrlsInput;
    }
    if (imageUrls.length > 0) {
      await db.dmTemplate.update({ where: { id: template.id }, data: { imageUrls } });
    }

    return NextResponse.json({
      success: true,
      data: { id: template.id, name: template.name, content: template.content, style: template.style, category: template.category, imageUrls },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
