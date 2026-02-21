import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { LeadStatus } from '@prisma/client';

const VALID_STATUSES: LeadStatus[] = ['DISCOVERED', 'DM_PREPARED', 'DM_SENT', 'RESPONDED', 'CONVERTED'];

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _req.json().catch(() => ({}));

    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as LeadStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing status' },
        { status: 400 }
      );
    }

    const lead = await db.lead.update({
      where: { id },
      data: { status: body.status as LeadStatus },
    });

    return NextResponse.json({ success: true, data: lead });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
