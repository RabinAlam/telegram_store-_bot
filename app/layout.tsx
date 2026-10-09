import './globals.css';
import Providers from './providers';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'TZ Store', description: 'TZ Store — Telegram Mini App' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="mx-auto w-full max-w-md px-3 pb-28 pt-[env(safe-area-inset-top)]">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
