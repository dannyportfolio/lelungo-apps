import type { Metadata } from 'next';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { getThemeScript } from '@/lib/theme';
import { Footer } from '@/components/Footer';
import { HydrationErrorBoundary } from '@/components/HydrationErrorBoundary';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

export const revalidate = 3600; // ISR caching

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Lelungo — Discover Hidden Travel Deals',
  description: 'Find cheap flights, hotels, and hidden travel deals powered by AI.',
  keywords: ['travel deals', 'cheap flights', 'hotel discounts', 'travel affiliate', 'AI travel'],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Lelungo — Discover Hidden Travel Deals',
    description: 'Find cheap flights, hotels, and hidden travel deals powered by AI.',
    url: '/',
    siteName: 'Lelungo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lelungo — Discover Hidden Travel Deals',
    description: 'Find cheap flights, hotels, and hidden travel deals powered by AI.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeScript() }} />
      </head>
      <body className="font-sans bg-background text-foreground antialiased min-h-screen flex flex-col">
        <HydrationErrorBoundary />
        <ThemeProvider>
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
