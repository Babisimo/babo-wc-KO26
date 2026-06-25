import type { Metadata } from 'next';
import { Big_Shoulders, Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import 'flag-icons/css/flag-icons.min.css';
import Nav from './Nav';
import LangProvider from './_components/LangProvider';
import { auth, type AppSession } from '@/lib/auth';
import { getAdminNotificationCount } from '@/lib/notifications';

const display = Big_Shoulders({
  subsets: ['latin'],
  weight: ['600', '800'],
  variable: '--font-display',
  adjustFontFallback: false, // Big Shoulders has no fallback size-adjust metrics; silences the build warning
});
const body = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'WC26 Knockout Bracket',
  description: 'World Cup 2026 knockout-stage bracket pool',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = (await auth()) as AppSession | null;
  const isAdmin = !!session?.user?.isAdmin;
  // Only admins see the badge, so only pay for the count query when admin.
  const adminNotifications = isAdmin ? await getAdminNotificationCount() : 0;
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body>
        <LangProvider>
          <Nav signedIn={!!session?.user?.id} isAdmin={isAdmin} adminNotifications={adminNotifications} />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
