import Link from 'next/link';
import { Compass, Home, Lock } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 border border-primary/20 text-primary shadow-glow-sm">
        <Compass className="h-12 w-12 stroke-[1.5]" />
      </div>

      <p className="section-label mb-2">404 — Tidak Ditemukan</p>
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
        Halaman Tidak Ditemukan
      </h1>
      <p className="max-w-md text-foreground/60 leading-relaxed mb-8">
        Halaman yang Anda tuju tidak tersedia, telah dipindahkan, atau Anda tidak memiliki akses ke tautan ini.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow hover:bg-primary/90 transition"
        >
          <Home className="h-4 w-4" />
          Kembali ke Beranda
        </Link>
        <Link
          href="/staff"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground/80 hover:bg-muted/10 transition"
        >
          <Lock className="h-4 w-4" />
          Workspace Staf
        </Link>
      </div>
    </main>
  );
}
