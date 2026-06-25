import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth-helpers';
import { loginRejectionReason } from '@/lib/auth-status';

/**
 * Typed session shape for this app.
 * next-auth v5 beta does not support stable module augmentation, so consumers
 * cast `auth()` results to this type.
 */
export interface AppSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin: boolean;
  };
  expires: string;
}

// Keep people signed in effectively forever (rolled on activity); they leave by logging out.
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: TEN_YEARS },
  jwt: { maxAge: TEN_YEARS },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? '').toLowerCase();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        // Approval gate: only APPROVED users may authenticate.
        if (loginRejectionReason(user.status) !== null) return null;
        return { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin };
      },
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jwt: ({ token, user }: any) => {
      if (user) {
        token.uid = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: ({ session, token }: any) => {
      if (session.user) {
        session.user.id = token.uid;
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
});
