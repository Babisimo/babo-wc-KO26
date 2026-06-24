import type { Metadata } from 'next';
import { Big_Shoulders, Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import Nav from './Nav';

const display = Big_Shoulders({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-display' });
const body = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'WC26 Knockout Bracket',
  description: 'World Cup 2026 knockout-stage bracket pool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
