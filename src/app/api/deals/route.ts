import { NextResponse } from 'next/server';
import { MOCK_DEALS } from '@/lib/mock-data';
import { enrichDeals } from '@/lib/insight-engine';

export async function GET() {
  try {
    // Enrich deals to include dynamic insights (discounts, tag, etc)
    const enrichedDeals = enrichDeals(MOCK_DEALS);
    
    // Return instantly with status 200 to fix the 504 Timeout Bug
    return NextResponse.json({ deals: enrichedDeals }, { status: 200 });
  } catch (error) {
    console.error('[deals] Failed to enrich mock deals:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}
