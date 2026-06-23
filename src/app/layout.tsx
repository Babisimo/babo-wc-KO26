import type { Metadata } from 'next';
import './globals.css';
import Nav from './Nav';

export const metadata: Metadata = {
  title: 'WC26 Knockout Bracket',
  description: 'World Cup 2026 knockout-stage bracket pool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
