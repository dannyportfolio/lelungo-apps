'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plane, BarChart3, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { motion, useScroll } from 'framer-motion';
import { ThemeToggle } from './theme-toggle';

const links = [
  { href: '/',          label: 'Explore' },
  { href: '/dashboard', label: 'Dashboard', icon: <BarChart3 className="w-3.5 h-3.5" /> },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    return scrollY.on('change', (latest) => {
      setIsScrolled(latest > 20);
    });
  }, [scrollY]);

  return (
    <motion.header 
      className={clsx(
        "sticky top-0 z-50 w-full transition-all duration-300",
        isScrolled ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm" : "bg-transparent border-b border-transparent"
      )}
    >
      {/* Scroll Progress Bar */}
      <motion.div 
        className="absolute top-0 left-0 right-0 h-[2px] bg-primary origin-left z-[60]"
        style={{ scaleX: scrollYProgress }}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
            <Plane className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg tracking-tight">
            <span className="text-foreground">Le</span><span className="text-gradient">lungo</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  pathname === l.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/70 hover:text-foreground hover:bg-muted/10',
                )}
              >
                {l.icon}
                {l.label}
              </Link>
            ))}
          </nav>
          
          <ThemeToggle />

          {/* Mobile toggle */}
          <button
            className="sm:hidden btn-ghost p-2 text-foreground/70"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <motion.nav 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sm:hidden absolute top-full left-0 right-0 w-full z-[100] border-t border-border bg-background/95 backdrop-blur-2xl py-2 px-4 shadow-2xl pb-6"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium my-0.5 transition-colors',
                pathname === l.href
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/70 hover:text-foreground hover:bg-muted/10',
              )}
            >
              {l.icon}
              {l.label}
            </Link>
          ))}
        </motion.nav>
      )}
    </motion.header>
  );
}
