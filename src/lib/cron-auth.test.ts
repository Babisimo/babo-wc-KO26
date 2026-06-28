import { describe, it, expect } from 'vitest';
import { isAuthorizedCron } from '@/lib/cron-auth';

describe('isAuthorizedCron', () => {
  it('accepts a matching Bearer token', () => {
    expect(isAuthorizedCron('Bearer s3cret', 's3cret')).toBe(true);
  });
  it('rejects a wrong token', () => {
    expect(isAuthorizedCron('Bearer nope', 's3cret')).toBe(false);
  });
  it('rejects a missing header', () => {
    expect(isAuthorizedCron(null, 's3cret')).toBe(false);
    expect(isAuthorizedCron(undefined, 's3cret')).toBe(false);
  });
  it('fails closed when no secret is configured', () => {
    expect(isAuthorizedCron('Bearer anything', undefined)).toBe(false);
    expect(isAuthorizedCron('Bearer ', '')).toBe(false);
  });
});
