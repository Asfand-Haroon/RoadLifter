import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RoadLifter — Freight Marketplace',
  description: 'Connect truck drivers with shippers. Real-time live map showing nearby loads and trucks. The smarter way to move freight.',
  keywords: 'freight marketplace, truck loads, shipping, logistics, freight broker, truck driver',
  openGraph: {
    title: 'RoadLifter — Freight Marketplace',
    description: 'Connect truck drivers with shippers on a live map',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
