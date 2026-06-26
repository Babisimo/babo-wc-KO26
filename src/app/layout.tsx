import type { Metadata } from 'next';
import { Big_Shoulders, Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import 'flag-icons/css/flag-icons.min.css';
import Nav from './Nav';
import LangProvider from './_components/LangProvider';
import { auth, type AppSession } from '@/lib/auth';
import { getAdminNotificationCount } from '@/lib/notifications';
import { getPoolStats } from '@/app/actions/pool';

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
  const signedIn = !!session?.user?.id;
  // Only admins see the badge, so only pay for the count query when admin.
  // The pool pill is signed-in only, so skip its query for signed-out visitors.
  const [adminNotifications, pool] = await Promise.all([
    isAdmin ? getAdminNotificationCount() : Promise.resolve(0),
    signedIn ? getPoolStats() : Promise.resolve(null),
  ]);
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body>
        <LangProvider>
          <Nav signedIn={signedIn} isAdmin={isAdmin} adminNotifications={adminNotifications} pool={pool} />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
