import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const TEMP_WORDS = [
  'Goal', 'Pitch', 'Striker', 'Keeper', 'Header', 'Volley', 'Corner', 'Pass',
  'Cross', 'Dribble', 'Tackle', 'Winger', 'Sweeper', 'Final', 'Cup', 'Group',
];
// Crockford-ish base32 without ambiguous characters (no I, L, O, 0, 1).
const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A short, human-readable single-use password, e.g. "Goal-7Q4K". */
export function generateTempPassword(): string {
  const word = TEMP_WORDS[randomInt(TEMP_WORDS.length)];
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += TEMP_CHARS[randomInt(TEMP_CHARS.length)];
  return `${word}-${suffix}`;
}
