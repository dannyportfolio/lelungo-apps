'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ExternalLink, Plane, Hotel, Star, Clock, Flame, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { EnrichedDeal } from '@/types';
import { formatIDR } from '@/lib/insight-engine';
import { formatNumber } from '@/lib/format';
import { HydrationGuard } from './HydrationGuard';

interface DealCardProps {
  deal: EnrichedDeal;
}

export function DealCard({ deal }: DealCardProps) {
  const [loading, setLoading] = useState(false);
  const { insight } = deal;

  const [imgSrc, setImgSrc] = useState(deal.image);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);

    void fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_type: deal.productType,
        destination: deal.destination,
        deal_id: deal.id,
        price: deal.price,
      }),
    }).catch(() => {
      // Analytics must never block the outbound affiliate action.
    });

    setTimeout(() => {
      window.open(deal.affiliateUrl, '_blank', 'noopener,noreferrer');
      setLoading(false);
    }, 80);
  };

  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
      }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="glass-card relative flex flex-col group cursor-pointer hover:shadow-card-hover overflow-hidden transition-all duration-300 border border-border/50"
      onClick={handleClick}
      data-testid="deal-card"
    >
      {/* ── High Quality Image (Parallax) ──────────── */}
      <div className="relative h-60 w-full overflow-hidden bg-muted/20">
        <motion.div className="absolute inset-[-10%] w-[120%] h-[120%]">
          <Image
            src={imgSrc || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80'}
            alt={deal.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onError={() => setImgSrc('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80')}
          />
        </motion.div>
        
        {/* Premium Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top Left: Premium Discount Badge */}
        {insight.discountPct > 0 && (
          <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-glow-sm tracking-wider uppercase border border-red-500/50">
            {insight.discountPct}% OFF
          </div>
        )}

        {/* Top Right: Tag */}
        <div className="absolute top-3 right-3">
          <span className="bg-black/60 backdrop-blur-md text-white/90 text-[10px] font-bold px-2.5 py-1 rounded-md border border-white/10 uppercase tracking-widest">
            {insight.tag}
          </span>
        </div>

        {/* Bottom Image Info */}
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium mb-1 drop-shadow-md">
            {deal.productType === 'flight' ? <Plane className="w-3.5 h-3.5" /> : <Hotel className="w-3.5 h-3.5" />}
            {deal.productType === 'flight' ? `${deal.originCode} → ${deal.destinationCode}` : deal.destination}
          </div>
          <h3 className="font-bold text-xl leading-tight drop-shadow-md group-hover:text-primary-foreground transition-colors">
            {deal.title}
          </h3>
        </div>
      </div>

      {/* ── Body Content ──────────────────────────── */}
      <div className="p-5 flex flex-col flex-1 bg-card">
        
        {/* Meta Info */}
        <div className="flex items-center justify-between mb-4">
          {deal.productType === 'hotel' && deal.rating ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                <Star className="w-3 h-3 fill-primary text-primary" />
                <span className="text-xs font-bold text-primary">{deal.rating}</span>
              </div>
              <HydrationGuard fallback={<span className="text-xs text-foreground/50">0 reviews</span>}>
                <span className="text-xs text-foreground/50">{deal.reviewCount ? formatNumber(deal.reviewCount) : 0} reviews</span>
              </HydrationGuard>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs text-foreground/60 font-medium">
              {deal.airline && <span>{deal.airline}</span>}
              {deal.duration && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {deal.duration}</span>
              )}
            </div>
          )}
        </div>

        {/* ── FOMO Indicators ─────────────────────── */}
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 mb-5 space-y-2">
          {insight.seatsLeft && insight.seatsLeft <= 5 && (
            <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
              <Flame className="w-3.5 h-3.5" />
              Only {insight.seatsLeft} {deal.productType === 'hotel' ? 'rooms' : 'seats'} left
            </div>
          )}
          {insight.bookedToday && (
            <div className="flex items-center gap-2 text-foreground/70 text-xs font-semibold">
              <Users className="w-3.5 h-3.5" />
              Booked {insight.bookedToday} times today
            </div>
          )}
        </div>

        {/* Push price to bottom */}
        <div className="mt-auto">
          {/* ── Pricing Hierarchy ─────────────────── */}
          <div className="mb-4">
            {insight.normalPrice > deal.price && (
              <p className="text-sm font-medium text-foreground/40 line-through mb-0.5">
                {formatIDR(insight.normalPrice)}
              </p>
            )}
            <div className="flex items-end gap-2">
              <p className="text-3xl sm:text-4xl font-black text-foreground tracking-tight leading-none">
                {formatIDR(deal.price)}
              </p>
            </div>
            <p className="text-xs font-medium text-foreground/50 mt-1.5">
              {deal.productType === 'hotel' ? 'per night' : 'per person'} • via {deal.affiliatePartner}
            </p>
          </div>

          {/* ── Interactive CTA ───────────────────── */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            disabled={loading}
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className="relative w-full overflow-hidden bg-primary text-primary-foreground font-bold py-3.5 rounded-xl shadow-glow transition-all hover:bg-primary/90 hover:shadow-glow-active flex items-center justify-center group/btn"
            data-testid="cta-book"
          >
            {/* Ripple sweep effect via pseudo-element */}
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
            
            <span className="relative z-10 flex items-center gap-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Book Now
                  <ExternalLink className="w-4 h-4 opacity-80" />
                </>
              )}
            </span>
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
