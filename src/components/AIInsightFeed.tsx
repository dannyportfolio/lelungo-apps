'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Brain, ArrowRight, ShieldCheck, Clock, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AIInsight, MOCK_INSIGHTS } from '@/lib/mock-data';

const ITEMS_PER_PAGE = 3;

// ============================================================================
// INDIVIDUAL CARD COMPONENT
// ============================================================================
function AIInsightCard({ insight }: { insight: AIInsight }) {
  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high':   return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'medium': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'low':    return 'text-green-500 bg-green-500/10 border-green-500/20';
      default:       return 'text-foreground/50 bg-card border-border';
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="glass-card p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between group cursor-default hover:shadow-card-hover"
    >
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="good" className="bg-brand-500/10 text-brand-500 border-brand-500/20 flex items-center gap-1.5 px-2 py-1">
            <Brain className="w-3.5 h-3.5" />
            AI Confidence: {insight.confidence}%
          </Badge>
          <div className={`text-xs font-semibold px-2 py-1 rounded-md border flex items-center gap-1.5 ${getUrgencyColor(insight.urgencyLevel)}`}>
            <Clock className="w-3.5 h-3.5" />
            {insight.urgency}
          </div>
        </div>
        
        <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2 group-hover:text-primary transition-colors">
          {insight.title}
        </h3>
        
        <div className="flex items-center gap-2 text-sm text-foreground/60">
          <ShieldCheck className="w-4 h-4 text-primary/70" />
          <p>{insight.reason}</p>
        </div>
      </div>

      <div className="w-full md:w-auto">
        <Button className="w-full md:w-auto group-hover:bg-primary/90 transition-all" data-testid="ai-insight-view-deal">
          View Deal
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </motion.article>
  );
}

// ============================================================================
// FEED COMPONENT (INFINITE SCROLL)
// ============================================================================
export function AIInsightFeed() {
  const [displayedInsights, setDisplayedInsights] = useState<AIInsight[]>(() =>
    MOCK_INSIGHTS.slice(0, ITEMS_PER_PAGE),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Fetch more logic (simulates network delay and loops mock data)
  const fetchMore = useCallback(() => {
    if (isLoading) return;
    setIsLoading(true);

    setTimeout(() => {
      const nextStartIndex = page * ITEMS_PER_PAGE;
      
      // We loop the mock data array if we run out to simulate "infinite"
      const newItems = Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => {
        const sourceIndex = (nextStartIndex + i) % MOCK_INSIGHTS.length;
        const item = MOCK_INSIGHTS[sourceIndex];
        // Ensure unique keys by appending the loop index
        return { ...item, id: `${item.id}-page-${page}` };
      });

      setDisplayedInsights((prev) => [...prev, ...newItems]);
      setPage((prev) => prev + 1);
      setIsLoading(false);
    }, 800);
  }, [isLoading, page]);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [fetchMore]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
      {displayedInsights.map((insight) => (
        <AIInsightCard key={insight.id} insight={insight} />
      ))}
      
      {/* Invisible loader element at the bottom */}
      <div ref={loaderRef} className="h-20 w-full flex items-center justify-center mt-4">
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-foreground/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Scanning for more insights...</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
