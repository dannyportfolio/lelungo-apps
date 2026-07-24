'use client';

import { Plane, Hotel, LayoutGrid } from 'lucide-react';
import clsx from 'clsx';
import type { FilterType } from '@/types';
import type { ReactNode } from 'react';

interface FilterBarProps {
  active: FilterType;
  onChange: (filter: FilterType) => void;
  counts: { all: number; flight: number; hotel: number };
}

const FILTERS: { id: FilterType; label: string; icon: ReactNode }[] = [
  { id: 'all',    label: 'All Deals', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'flight', label: 'Flights',   icon: <Plane className="w-4 h-4" /> },
  { id: 'hotel',  label: 'Hotels',    icon: <Hotel className="w-4 h-4" /> },
];

export function FilterBar({ active, onChange, counts }: FilterBarProps) {
  const handleClick = (id: FilterType) => {
    onChange(id);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTERS.map((f) => {
        const count = counts[f.id as keyof typeof counts];
        const isActive = active === f.id;
        return (
          <button
            key={f.id}
            id={`filter-${f.id}`}
            data-testid={`filter-${f.id}`}
            onClick={() => handleClick(f.id)}
            data-active={isActive}
            aria-pressed={isActive}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-w-fit',
              'border transition-colors transition-transform duration-200',
              'will-change-transform [backface-visibility:hidden] [transform:translateZ(0)] antialiased',
              'data-[active=true]:scale-95 data-[active=true]:shadow-inner',
              isActive
                ? 'bg-primary text-white border-primary shadow-md dark:shadow-lg'
                : 'bg-card text-foreground/70 border-border hover:text-foreground hover:border-primary/40',
            )}
          >
            {f.icon}
            {f.label}
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded-md font-bold',
              isActive 
                ? 'bg-white text-primary dark:bg-white/20 dark:text-white' 
                : 'bg-background text-foreground/50',
            )}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
