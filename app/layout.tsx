import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, DM_Sans } from 'next/font/google';
import './globals.css';

const serif = DM_Serif_Display({ subsets: ['latin'], weight: ['400'], variable: '--font-display' });
const sans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Golden Hour | APIVerve Template',
  description: 'Golden hour, blue hour, sunrise and sunset for any place and day. An APIVerve template.'
};

export const viewport: Viewport = { themeColor: '#1c1230' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
