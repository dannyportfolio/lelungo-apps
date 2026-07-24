'use client';

import { useState } from 'react';
import { Search, MapPin, Calendar, DollarSign } from 'lucide-react';
import { Button } from './ui/button';

export function SmartSearchBar() {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fields = [
    { id: 'from',   label: 'From',   icon: <MapPin className="w-4 h-4" />, placeholder: 'Jakarta (CGK)' },
    { id: 'to',     label: 'To',     icon: <MapPin className="w-4 h-4" />, placeholder: 'Tokyo (NRT)' },
    { id: 'date',   label: 'Date',   icon: <Calendar className="w-4 h-4" />, placeholder: 'Add dates', type: 'text' },
    { id: 'budget', label: 'Budget', icon: <DollarSign className="w-4 h-4" />, placeholder: 'Optional max', type: 'text' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto bg-card/80 backdrop-blur-2xl border border-border rounded-2xl p-2 sm:p-3 shadow-card transition-all duration-300 relative z-20">
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {fields.map((field, idx) => (
          <div
            key={field.id}
            className={`flex-1 relative flex items-center px-4 py-3 rounded-xl transition-all duration-300 w-full ${
              focusedField === field.id
                ? 'bg-background shadow-[0_0_0_2px_hsl(var(--primary)/0.2)]'
                : 'hover:bg-muted/10'
            }`}
          >
            <div className={`mr-3 transition-colors ${focusedField === field.id ? 'text-primary' : 'text-foreground/40'}`}>
              {field.icon}
            </div>
            <div className="flex flex-col w-full text-left">
              <label htmlFor={field.id} className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 mb-0.5 cursor-text">
                {field.label}
              </label>
              <input
                id={field.id}
                type={field.type || 'text'}
                placeholder={field.placeholder}
                className="w-full bg-transparent border-none outline-none text-sm font-semibold text-foreground placeholder:text-foreground/40"
                onFocus={() => setFocusedField(field.id)}
                onBlur={() => setFocusedField(null)}
              />
            </div>

            {/* Separator */}
            {idx !== fields.length - 1 && (
              <div className="hidden sm:block absolute right-0 top-1/4 bottom-1/4 w-[1px] bg-border" />
            )}
          </div>
        ))}
        
        {/* Search Button */}
        <div className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2">
          <Button 
            size="lg" 
            className="w-full sm:w-auto h-[60px] px-8 rounded-xl animate-pulse-slow relative overflow-hidden group"
            onClick={async () => {
              try {
                // Fetching /api/deals, which now safely returns 200 without timeout
                const res = await fetch('/api/deals');
                if (res.ok) {
                  // In a real app we'd dispatch these to a context or state
                  console.log('Deals loaded successfully', await res.json());
                }
              } catch (err) {
                console.error(err);
              }
            }}
          >
            {/* Subtle sweep effect on hover inside the button */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]" />
            <Search className="w-5 h-5 mr-2 relative z-10" />
            <span className="relative z-10 font-bold">Search Deals</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
