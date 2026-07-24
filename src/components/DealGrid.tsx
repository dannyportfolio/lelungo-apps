'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DealCard } from './DealCard';
import { FilterBar } from './FilterBar';
import { SkeletonCard } from './SkeletonCard';
import { enrichDeals } from '@/lib/insight-engine';
import { MOCK_DEALS } from '@/lib/mock-data';
import type { FilterType } from '@/types';
import { SearchX } from 'lucide-react';
import { useInViewAnimation, staggerContainerVariants } from '@/hooks/use-in-view-animation';

export function DealGrid() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [isChanging, setIsChanging] = useState(false);
  const currentFilterRef = useRef<FilterType>('all');
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { ref, isInView } = useInViewAnimation();

  // Enrich all deals with insights (memoized — only runs once)
  const allDeals = useMemo(() => enrichDeals(MOCK_DEALS), []);

  const handleFilterChange = (newFilter: FilterType) => {
    if (currentFilterRef.current === newFilter) return;

    currentFilterRef.current = newFilter;
    setFilter(newFilter);
    setIsChanging(true);

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = setTimeout(() => {
      setIsChanging(false);
      transitionTimerRef.current = null;
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const filteredDeals = filter === 'all'
    ? allDeals
    : allDeals.filter((d) => d.productType === filter);

  return (
    <div className="w-full">
      <FilterBar
        active={filter}
        onChange={handleFilterChange}
        counts={{
          all:    allDeals.length,
          flight: allDeals.filter((d) => d.productType === 'flight').length,
          hotel:  allDeals.filter((d) => d.productType === 'hotel').length,
        }}
      />

      {/* Grid */}
      <div ref={ref} className="mt-8 min-h-[400px]">
        <AnimatePresence mode="wait">
          {isChanging ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </motion.div>
          ) : filteredDeals.length > 0 ? (
            <motion.div
              key="grid"
              variants={staggerContainerVariants}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filteredDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-24 text-center"
            >
              <SearchX className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
              <p className="font-semibold text-foreground/70">No deals found</p>
              <p className="text-sm text-foreground/50 mt-1">Try a different filter</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
