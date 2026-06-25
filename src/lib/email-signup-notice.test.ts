import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendMail, findMany } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));
vi.mock('@/lib/db', () => ({ db: { user: { findMany } } }));

import { sendNewSignupNotice } from './email';

describe('sendNewSignupNotice', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue(undefined);
    findMany.mockReset();
    process.env.GMAIL_USER = 'pool@example.com';
    process.env.GMAIL_APP_PASSWORD = 'secret';
  });

  it('emails every admin with the new user and a link to /admin', async () => {
    findMany.mockResolvedValue([{ email: 'a@x.com' }, { email: 'b@x.com' }]);

    await sendNewSignupNotice({ name: 'Jo Soto', email: 'jo@x.com' }, 'https://app.test/admin');

    expect(findMany).toHaveBeenCalledWith({ where: { isAdmin: true }, select: { email: true } });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const msg = sendMail.mock.calls[0][0];
    expect(msg.to).toEqual(['a@x.com', 'b@x.com']);
    expect(msg.text).toContain('Jo Soto');
    expect(msg.text).toContain('jo@x.com');
    expect(msg.text).toContain('https://app.test/admin');
  });

  it('does nothing when there are no admins', async () => {
    findMany.mockResolvedValue([]);
    await sendNewSignupNotice({ name: 'Jo', email: 'jo@x.com' }, 'https://app.test/admin');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does nothing when SMTP is not configured', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    findMany.mockResolvedValue([{ email: 'a@x.com' }]);
    await sendNewSignupNotice({ name: 'Jo', email: 'jo@x.com' }, 'https://app.test/admin');
    expect(sendMail).not.toHaveBeenCalled();
  });
});
