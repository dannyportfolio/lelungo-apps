import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QA Dashboard | Lelungo',
  description: 'Premium QA and Test Results Dashboard',
};

const QADashboard = dynamic(() => import('@/internal/qa/QADashboard'), {
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-[#0B0F1A] text-white">
      Loading QA Environment...
    </div>
  ),
});

export default function QAPageWrapper() {
  if (process.env.NEXT_PUBLIC_ENABLE_QA !== 'true') {
    notFound();
  }

  return <QADashboard />;
}
