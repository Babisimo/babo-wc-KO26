'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { signOut } from '@/lib/auth';
import { hashPassword } from '@/lib/auth-helpers';
import { validateUsername, validateName } from '@/lib/profile';
import { checkUsernameAllowed } from '@/lib/username-filter';

/** Sign the current user out and return home. */
export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

const SignupSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignupState = { error?: string } | undefined;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const uname = validateUsername(String(formData.get('username') ?? ''));
  if (!uname.ok) return { error: uname.error };
  const allowed = checkUsernameAllowed(uname.value);
  if (!allowed.ok) return { error: allowed.error };
  const first = validateName(String(formData.get('firstName') ?? ''), 'First name');
  if (!first.ok) return { error: first.error };
  const last = validateName(String(formData.get('lastName') ?? ''), 'Last name');
  if (!last.ok) return { error: last.error };

  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return { error: 'An account with that email already exists.' };
  }
  if (await db.user.findFirst({ where: { username: { equals: uname.value, mode: 'insensitive' } } })) {
    return { error: 'That username is taken.' };
  }

  const isBootstrapAdmin = email === process.env.ADMIN_EMAIL?.toLowerCase();
  if (!process.env.ADMIN_EMAIL) {
    console.warn('[signup] ADMIN_EMAIL not set — no user will be auto-approved as admin.');
  }

  await db.user.create({
    data: {
      name: `${first.value} ${last.value}`,
      username: uname.value,
      firstName: first.value,
      lastName: last.value,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      isAdmin: isBootstrapAdmin,
      status: isBootstrapAdmin ? 'APPROVED' : 'PENDING',
      approvedAt: isBootstrapAdmin ? new Date() : null,
    },
  });
  return undefined; // success; UI redirects to /login?registered=1
}
