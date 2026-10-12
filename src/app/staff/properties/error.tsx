'use client';

export default function PropertiesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center">
      <section className="rounded-3xl border border-border bg-card p-8">
        <p className="section-label">Tidak tersedia</p>
        <h1 className="mt-2 text-2xl font-black">Property belum dapat ditampilkan</h1>
        <p className="mt-3 text-sm text-foreground/60">
          Akses mungkin tidak tersedia atau data telah berubah.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
        >
          Coba lagi
        </button>
      </section>
    </main>
  );
}
