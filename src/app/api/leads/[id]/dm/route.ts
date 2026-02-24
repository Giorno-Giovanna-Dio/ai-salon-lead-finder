import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDmService } from '@/lib/dm-service';
import { DmStyle } from '@prisma/client';

const VALID_STYLES = ['PROFESSIONAL', 'FRIENDLY', 'VALUE_FOCUSED'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lead = await db.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    let content = '';
    let styleInput: string | undefined;
    let imageFiles: File[] = [];
    let imageUrls: string[] = [];

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      content = (formData.get('content') as string) || '';
      styleInput = formData.get('style') as string | undefined;
      const files = formData.getAll('images') as File[];
      imageFiles = files.filter((f) => f && f.size > 0 && f.type.startsWith('image/'));
      const urlsRaw = formData.get('imageUrls');
      if (typeof urlsRaw === 'string') {
        try {
          const parsed = JSON.parse(urlsRaw) as unknown;
          imageUrls = Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
        } catch {
          /* ignore */
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      content = typeof body.content === 'string' ? body.content : '';
      styleInput = body.style;
      if (Array.isArray(body.imageUrls)) imageUrls = body.imageUrls.filter((u): u is string => typeof u === 'string');
    }

    const style: DmStyle | undefined =
      typeof styleInput === 'string' && VALID_STYLES.includes(styleInput as DmStyle)
        ? (styleInput as DmStyle)
        : undefined;

    const dmService = getDmService();
    const dmId = await dmService.createDmFromUserContent(
      lead.id,
      content,
      style,
      imageFiles.length > 0 ? imageFiles : undefined,
      imageUrls.length > 0 ? imageUrls : undefined
    );

    await db.lead.update({
      where: { id: lead.id },
      data: { status: 'DM_PREPARED' },
    });

    return NextResponse.json({
      success: true,
      data: { dmId },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
