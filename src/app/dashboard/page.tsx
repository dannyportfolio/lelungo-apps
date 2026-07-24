'use client';

import { Navbar } from '@/components/Navbar';
import { enrichDeals } from '@/lib/insight-engine';
import { MOCK_DEALS } from '@/lib/mock-data';
import { useMemo } from 'react';
import {
  MousePointerClick, Plane, Hotel, TrendingUp,
  BarChart3, MapPin, Star,
} from 'lucide-react';
import { formatIDR } from '@/lib/insight-engine';

// Simple bar component
function MiniBar({ pct, color = 'bg-brand-500' }: { pct: number; color?: string }) {
  return (
    <div className="h-2 bg-card rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatCard({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-foreground/70 font-medium">{label}</p>
        <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-black text-gradient">{value}</p>
      {sub && <p className="text-xs text-foreground/50 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const deals = useMemo(() => enrichDeals(MOCK_DEALS), []);

  // Compute analytics from mock data
  const flights = deals.filter((d) => d.productType === 'flight');
  const hotels  = deals.filter((d) => d.productType === 'hotel');
  const avgDiscount = Math.round(
    deals.reduce((sum, d) => sum + d.insight.discountPct, 0) / deals.length,
  );
  const rareDealCount = deals.filter((d) =>
    d.insight.tag === 'Rare Deal' || d.insight.tag === 'Flash Sale',
  ).length;

  // Top deals by discount
  const topDeals = [...deals]
    .sort((a, b) => b.insight.discountPct - a.insight.discountPct)
    .slice(0, 5);

  // Destinations breakdown
  const destMap = deals.reduce<Record<string, number>>((acc, d) => {
    acc[d.destination] = (acc[d.destination] || 0) + 1;
    return acc;
  }, {});
  const destinations = Object.entries(destMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="section-label mb-1">Analytics</p>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-brand-400" />
            Deal Dashboard
          </h1>
          <p className="text-foreground/70 text-sm mt-1">
            Real-time analytics from click tracking data. Connect Supabase for live stats.
          </p>
        </div>

        {/* ── Overview stats ─────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<MousePointerClick className="w-4 h-4" />}
            label="Total Deals"
            value={deals.length}
            sub={`${rareDealCount} rare or flash`}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Avg. Discount"
            value={`${avgDiscount}%`}
            sub="Across all deals"
          />
          <StatCard
            icon={<Plane className="w-4 h-4" />}
            label="Flight Deals"
            value={flights.length}
            sub={`${Math.round((flights.length / deals.length) * 100)}% of total`}
          />
          <StatCard
            icon={<Hotel className="w-4 h-4" />}
            label="Hotel Deals"
            value={hotels.length}
            sub={`${Math.round((hotels.length / deals.length) * 100)}% of total`}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* ── Top deals by discount ──────────────── */}
          <div className="glass-card p-6">
            <h2 className="font-bold mb-5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              Top Deals by Discount
            </h2>
            <div className="space-y-4">
              {topDeals.map((deal, i) => (
                <div key={deal.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-foreground/50 w-4">{i + 1}.</span>
                      <span className="font-medium truncate">{deal.title}</span>
                      <span className={`badge text-[10px] px-1.5 py-0.5 ${deal.insight.tagColor}`}>
                        {deal.insight.tag}
                      </span>
                    </div>
                    <span className="text-brand-400 font-bold flex-shrink-0 ml-2">
                      -{deal.insight.discountPct}%
                    </span>
                  </div>
                  <MiniBar pct={deal.insight.discountPct} />
                  <div className="flex justify-between text-xs text-foreground/50 mt-1">
                    <span>{formatIDR(deal.price)}</span>
                    <span className="line-through">{formatIDR(deal.insight.normalPrice)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Destinations breakdown ─────────────── */}
          <div className="glass-card p-6">
            <h2 className="font-bold mb-5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-400" />
              Destinations
            </h2>
            <div className="space-y-3">
              {destinations.map(([dest, count]) => {
                const dealGroup = deals.filter((d) => d.destination === dest);
                const minPrice = Math.min(...dealGroup.map((d) => d.price));
                const maxDiscount = Math.max(...dealGroup.map((d) => d.insight.discountPct));
                return (
                  <div key={dest}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium">{dest}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-foreground/70">{count} deals</span>
                        <span className="text-brand-400 font-semibold">up to -{maxDiscount}%</span>
                      </div>
                    </div>
                    <MiniBar
                      pct={(count / deals.length) * 100}
                      color="bg-gradient-to-r from-brand-600 to-brand-400"
                    />
                    <p className="text-xs text-foreground/50 mt-1">From {formatIDR(minPrice)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Deal tag breakdown ─────────────────── */}
        <div className="glass-card p-6 mb-6">
          <h2 className="font-bold mb-5 flex items-center gap-2">
            <Star className="w-4 h-4 text-brand-400" />
            Deal Quality Breakdown
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {['Rare Deal', 'Flash Sale', 'Hot Deal', 'Last Seats', 'Good Deal', 'Fair Price'].map((tag) => {
              const count = deals.filter((d) => d.insight.tag === tag).length;
              const pct   = Math.round((count / deals.length) * 100);
              return (
                <div key={tag} className="bg-card rounded-xl p-4 text-center border border-border">
                  <p className="text-2xl font-black text-gradient">{count}</p>
                  <p className="text-xs font-semibold text-foreground/70 mt-1">{tag}</p>
                  <p className="text-xs text-foreground/50 mt-0.5">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </>
  );
}
