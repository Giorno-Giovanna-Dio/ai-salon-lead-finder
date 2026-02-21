import { NextResponse } from 'next/server';
import { checkInboxAllAccounts } from '@/lib/openclaw-inbox';

export async function POST() {
  try {
    const { byProfile, totalCreated } = await checkInboxAllAccounts();

    return NextResponse.json({
      success: true,
      data: {
        byProfile,
        totalCreated,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
