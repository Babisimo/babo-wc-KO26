import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateTempPassword } from './auth-helpers';

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).not.toBe('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('generateTempPassword', () => {
  it('produces a Word-XXXX shaped string', () => {
    expect(generateTempPassword()).toMatch(/^[A-Za-z]+-[A-Z0-9]{4}$/);
  });
});
