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

    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === 'string' ? body.content : '';
    const styleInput = body.style;

    const style: DmStyle | undefined =
      typeof styleInput === 'string' && VALID_STYLES.includes(styleInput as DmStyle)
        ? (styleInput as DmStyle)
        : undefined;

    const dmService = getDmService();
    const dmId = await dmService.createDmFromUserContent(lead.id, content, style);

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
