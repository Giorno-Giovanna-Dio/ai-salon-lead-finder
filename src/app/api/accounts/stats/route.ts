import { NextResponse } from 'next/server';
import { getAccountManager } from '@/lib/account-manager';

export async function GET() {
  try {
    const accountManager = getAccountManager();
    const stats = await accountManager.getAccountsStats();
    const nextAvailable = await accountManager.getNextAvailableTime();

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        nextAvailable,
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
