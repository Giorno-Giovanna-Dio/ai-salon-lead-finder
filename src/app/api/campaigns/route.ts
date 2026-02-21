import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function parseHashtags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.replace(/^#/, '').trim())
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/[\s,，、]+/)
      .map((s) => s.replace(/^#/, '').trim())
      .filter(Boolean);
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json(
        { success: false, error: '請填寫任務名稱' },
        { status: 400 }
      );
    }

    const hashtags = parseHashtags(body.hashtags);
    if (hashtags.length === 0) {
      return NextResponse.json(
        { success: false, error: '請至少輸入一個 Hashtag' },
        { status: 400 }
      );
    }

    const minFollowers =
      typeof body.minFollowers === 'number'
        ? Math.max(0, body.minFollowers)
        : typeof body.minFollowers === 'string'
          ? Math.max(0, parseInt(body.minFollowers, 10) || 3000)
          : 3000;
    const maxFollowers =
      typeof body.maxFollowers === 'number'
        ? Math.max(minFollowers, body.maxFollowers)
        : typeof body.maxFollowers === 'string'
          ? Math.max(minFollowers, parseInt(body.maxFollowers, 10) || 100000)
          : 100000;
    const maxLeads =
      typeof body.maxLeads === 'number'
        ? Math.max(1, body.maxLeads)
        : typeof body.maxLeads === 'string'
          ? Math.max(1, parseInt(body.maxLeads, 10) || 100)
          : 100;
    const isActive = body.isActive !== false;
    const schedule =
      typeof body.schedule === 'string' && body.schedule.trim()
        ? body.schedule.trim()
        : null;

    const campaign = await db.campaign.create({
      data: {
        name,
        hashtags,
        minFollowers,
        maxFollowers,
        maxLeads,
        isActive,
        schedule,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: campaign.id, name: campaign.name },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
