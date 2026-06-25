'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { signOut, auth, type AppSession } from '@/lib/auth';
import { sendNewSignupNotice } from '@/lib/email';
import { hashPassword, verifyPassword } from '@/lib/auth-helpers';
import { loginIssue } from '@/lib/auth-status';
import { validateUsername, validateName, MAX_USERNAME_CHANGES } from '@/lib/profile';
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

  const rawUsername = String(formData.get('username') ?? '');
  const uname = validateUsername(rawUsername);
  // Browser/Google autofill often drops the saved login email into a field tagged
  // autocomplete="username". Give a pointed message instead of the generic rule.
  if (!uname.ok) return { errorKey: rawUsername.includes('@') ? 'auth.err.usernameEmail' : 'auth.err.username' };
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

  const name = `${first.value} ${last.value}`;
  await db.user.create({
    data: {
      name,
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

  // Best-effort: tell admins someone is waiting for approval. The bootstrap admin
  // approves itself, so it never needs a notice. Never let email failure (or a
  // missing SMTP config) block a successful signup.
  if (!isBootstrapAdmin) {
    try {
      const h = await headers();
      const host = h.get('host') ?? '';
      const base =
        process.env.APP_URL?.replace(/\/+$/, '') ??
        `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
      await sendNewSignupNotice({ name, email }, `${base}/admin`);
    } catch (err) {
      console.error('[signup] failed to send admin notice:', err);
    }
  }
  return undefined; // success; UI redirects to /login?registered=1
}

/**
 * After a failed sign-in, work out a specific message to show. Re-checks the
 * password so we only reveal "pending"/"rejected" to someone who owns the
 * account; everyone else gets the generic "invalid" message.
 */
export async function diagnoseLoginIssue(
  email: string,
  password: string,
): Promise<'auth.invalid' | 'auth.pending' | 'auth.rejected'> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  const passwordOk = !!user && (await verifyPassword(password, user.passwordHash));
  switch (loginIssue(user, passwordOk)) {
    case 'pending':
      return 'auth.pending';
    case 'rejected':
      return 'auth.rejected';
    default:
      return 'auth.invalid';
  }
}

export type ChangeUsernameState = { ok?: boolean; errorKey?: StringKey } | undefined;

/** Change the signed-in user's username, capped at MAX_USERNAME_CHANGES lifetime changes. */
export async function changeUsername(_prev: ChangeUsernameState, formData: FormData): Promise<ChangeUsernameState> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) return { errorKey: 'bracket.err.notSignedIn' };

  const uname = validateUsername(String(formData.get('username') ?? ''));
  if (!uname.ok) return { errorKey: 'auth.err.username' };
  const allowed = checkUsernameAllowed(uname.value);
  if (!allowed.ok) return { errorKey: 'auth.err.usernameBlocked' };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, usernameChangeCount: true },
  });
  if (!user) return { errorKey: 'account.err.notFound' };

  if (user.username && user.username.toLowerCase() === uname.value.toLowerCase()) {
    return { errorKey: 'account.err.sameUsername' };
  }
  if (user.usernameChangeCount >= MAX_USERNAME_CHANGES) {
    return { errorKey: 'account.err.usedAll' };
  }
  if (await db.user.findFirst({
    where: { username: { equals: uname.value, mode: 'insensitive' }, NOT: { id: userId } },
  })) {
    return { errorKey: 'auth.err.usernameTaken' };
  }

  await db.user.update({
    where: { id: userId },
    data: { username: uname.value, usernameLower: uname.value.toLowerCase(), usernameChangeCount: { increment: 1 } },
  });
  return { ok: true };
}

export type ChangePasswordState = { ok?: boolean; errorKey?: StringKey } | undefined;

/** Change the signed-in user's password after confirming the current one. */
export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) return { errorKey: 'bracket.err.notSignedIn' };

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (next.length < 8) return { errorKey: 'reset.err.short' };
  if (next !== confirm) return { errorKey: 'reset.err.mismatch' };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { errorKey: 'account.err.notFound' };
  if (!(await verifyPassword(current, user.passwordHash))) return { errorKey: 'account.err.currentWrong' };

  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true };
}
