import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

    const logs = await db.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: campaignId ? limit * 3 : limit,
    });

    const filtered = campaignId
      ? logs.filter(
          (l) => l.metadata && typeof l.metadata === 'object' && (l.metadata as { campaignId?: string }).campaignId === campaignId
        ).slice(0, limit)
      : logs;

    return NextResponse.json({
      success: true,
      data: filtered.map((log) => ({
        id: log.id,
        action: log.action,
        metadata: log.metadata,
        timestamp: log.timestamp,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
