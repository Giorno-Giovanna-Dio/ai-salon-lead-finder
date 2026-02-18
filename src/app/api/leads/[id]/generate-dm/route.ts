import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDmService } from '@/lib/dm-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lead = await db.lead.findUnique({
      where: { id: params.id },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    const dmService = getDmService();
    const messages = await dmService.generateDmMessages(lead);
    const dmIds = await dmService.saveDmMessages(lead.id, messages);

    // 更新 Lead 狀態
    await db.lead.update({
      where: { id: lead.id },
      data: { status: 'DM_PREPARED' },
    });

    return NextResponse.json({
      success: true,
      data: {
        dmIds,
        messages,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
