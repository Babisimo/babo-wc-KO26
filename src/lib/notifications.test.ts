import { describe, it, expect, vi, beforeEach } from 'vitest';

const { count } = vi.hoisted(() => ({ count: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { user: { count } } }));

import { getAdminNotificationCount } from './notifications';

describe('getAdminNotificationCount', () => {
  beforeEach(() => count.mockReset());

  it('counts users awaiting approval', async () => {
    count.mockResolvedValue(3);
    expect(await getAdminNotificationCount()).toBe(3);
    expect(count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
  });

  it('returns 0 when nothing is pending', async () => {
    count.mockResolvedValue(0);
    expect(await getAdminNotificationCount()).toBe(0);
  });
});
