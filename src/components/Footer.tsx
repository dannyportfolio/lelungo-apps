import Link from 'next/link';
import { Plane, Twitter, Instagram } from 'lucide-react';

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

export function Footer() {
  return (
    <footer className="w-full bg-background border-t border-border mt-auto">
      <div className="max-w-[1200px] mx-auto py-12 px-6">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          
          {/* 1. BRAND SECTION */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
                <Plane className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-xl tracking-tight">
                <span className="text-foreground">Le</span><span className="text-gradient">lungo</span>
              </span>
            </Link>
            <p className="text-sm font-medium text-foreground/70 leading-relaxed max-w-xs mt-2">
              Discover hidden travel deals before everyone else. <span className="text-gradient font-bold">Smart insights for smarter trips.</span>
            </p>
          </div>

          {/* 2. PRODUCT LINKS */}
          <div className="flex flex-col gap-3">
            <h4 className="font-bold text-foreground mb-1 tracking-wide text-sm">Product</h4>
            <Link href="/" className="text-sm text-foreground/60 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] hover:underline w-fit">Explore Deals</Link>
            <Link href="/?filter=flight" className="text-sm text-foreground/60 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] hover:underline w-fit">Flights</Link>
            <Link href="/?filter=hotel" className="text-sm text-foreground/60 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] hover:underline w-fit">Hotels</Link>
            <Link href="/dashboard" className="text-sm text-foreground/60 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] hover:underline w-fit">AI Insights</Link>
          </div>

          {/* 3. COMPANY */}
          <div className="flex flex-col gap-3">
            <h4 className="font-bold text-foreground mb-1 tracking-wide text-sm">Company</h4>
            <Link href="#" className="text-sm text-foreground/60 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] hover:underline w-fit">About Us</Link>
            <Link href="#" className="text-sm text-foreground/60 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] hover:underline w-fit">Careers</Link>
            <Link href="#" className="text-sm text-foreground/60 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] hover:underline w-fit">Privacy Policy</Link>
            <Link href="#" className="text-sm text-foreground/60 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] hover:underline w-fit">Terms of Service</Link>
          </div>

          {/* 4. SOCIAL */}
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-foreground mb-1 tracking-wide text-sm">Follow Us</h4>
            <div className="flex items-center gap-4">
              <a href="#" className="text-foreground/50 hover:text-primary transition-all duration-200 hover:scale-110 hover:shadow-glow-active rounded-full">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-foreground/50 hover:text-primary transition-all duration-200 hover:scale-110 hover:shadow-glow-active rounded-full">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-foreground/50 hover:text-primary transition-all duration-200 hover:scale-110 hover:shadow-glow-active rounded-full">
                <TikTokIcon className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-foreground/40 font-medium">
            © 2026 Lelungo. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-foreground/40 font-medium">
            <span>Jakarta, ID</span>
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            <span>Operational</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
