import { NextRequest, NextResponse } from 'next/server';
import { clickEventSchema } from '@/modules/analytics/click-event';

// ============================================================
// POST /api/track-click
// Tracks affiliate click in Supabase then returns redirect URL
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const result = clickEventSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid click event' },
        { status: 400 },
      );
    }

    const { product_type, destination, deal_id, price } = result.data;

    // ── Store click in Supabase ──────────────────────────────
    // Only runs if Supabase env vars are configured
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-project-id.supabase.co' &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your-service-role-key-here'
    ) {
      const { createAdminClient } = await import('@/lib/supabase/server');
      const supabase = createAdminClient();

      const { error } = await supabase.from('clicks').insert({
        product_type,
        destination,
        deal_id,
        price,
        user_agent: request.headers.get('user-agent') || null,
        referrer: request.headers.get('referer') || null,
      });

      if (error) {
        // Log but don't fail — never block the user from booking
        console.error('[track-click] Supabase insert error:', error.message);
      }
    } else {
      // Supabase not configured — log to console in dev
      // Intentionally no payload logging: analytics input is untrusted and may
      // later contain tenant or visitor metadata.
    }

    return NextResponse.json({ ok: true, tracked: true }, { status: 200 });

  } catch (err) {
    console.error('[track-click] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
