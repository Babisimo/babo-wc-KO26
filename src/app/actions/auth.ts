'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { signOut } from '@/lib/auth';
import { hashPassword } from '@/lib/auth-helpers';
import { validateUsername, validateName } from '@/lib/profile';
import { checkUsernameAllowed } from '@/lib/username-filter';
import type { StringKey } from '@/lib/i18n';

/** Sign the current user out and return home. */
export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

const SignupSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignupState = { errorKey?: StringKey } | undefined;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0];
    return { errorKey: field === 'password' ? 'auth.err.password' : 'auth.err.email' };
  }

  const uname = validateUsername(String(formData.get('username') ?? ''));
  if (!uname.ok) return { errorKey: 'auth.err.username' };
  const allowed = checkUsernameAllowed(uname.value);
  if (!allowed.ok) return { errorKey: 'auth.err.usernameBlocked' };
  const first = validateName(String(formData.get('firstName') ?? ''), 'First name');
  if (!first.ok) return { errorKey: 'auth.err.firstName' };
  const last = validateName(String(formData.get('lastName') ?? ''), 'Last name');
  if (!last.ok) return { errorKey: 'auth.err.lastName' };

  const email = parsed.data.email.toLowerCase();
  // NOTE: We intentionally return distinct "email exists" vs "username taken" messages.
  // For this small, admin-approved, invite-only pool the usability win outweighs the
  // low-value account-enumeration leak. Revisit if signup ever becomes public.
  if (await db.user.findUnique({ where: { email } })) {
    return { errorKey: 'auth.err.emailTaken' };
  }
  if (await db.user.findUnique({ where: { usernameLower: uname.value.toLowerCase() } })) {
    return { errorKey: 'auth.err.usernameTaken' };
  }

  const isBootstrapAdmin = email === process.env.ADMIN_EMAIL?.toLowerCase();
  if (!process.env.ADMIN_EMAIL) {
    console.warn('[signup] ADMIN_EMAIL not set — no user will be auto-approved as admin.');
  }

  await db.user.create({
    data: {
      name: `${first.value} ${last.value}`,
      username: uname.value,
      usernameLower: uname.value.toLowerCase(),
      firstName: first.value,
      lastName: last.value,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      isAdmin: isBootstrapAdmin,
      status: isBootstrapAdmin ? 'APPROVED' : 'PENDING',
      approvedAt: isBootstrapAdmin ? new Date() : null,
      credits: isBootstrapAdmin ? 1 : 0,
    },
  });
  return undefined; // success; UI redirects to /login?registered=1
}
