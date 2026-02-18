import { NextRequest, NextResponse } from 'next/server';
import { getCrawler } from '@/crawler/instagram-crawler';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const crawler = getCrawler();
    const result = await crawler.runCampaign(params.id);

    return NextResponse.json({
      success: true,
      data: result,
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
