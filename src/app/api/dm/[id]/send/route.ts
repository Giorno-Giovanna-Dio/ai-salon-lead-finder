import { NextRequest, NextResponse } from 'next/server';
import { getDmService } from '@/lib/dm-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let textOnly = false;
    try {
      const body = await request.json().catch(() => ({}));
      textOnly = body?.textOnly === true;
    } catch {
      // ignore
    }
    const dmService = getDmService();
    const success = await dmService.sendDm(id, { textOnly });

    return NextResponse.json({
      success: true,
      data: { sent: success },
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
