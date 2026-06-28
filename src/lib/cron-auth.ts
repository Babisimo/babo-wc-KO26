// Guards the results-refresh cron route. Vercel Cron sends the configured
// `CRON_SECRET` as a Bearer token; we accept a request only when the secret is
// set AND the header matches exactly. A missing/empty secret denies everything,
// so a misconfigured deploy fails closed rather than exposing the endpoint.
export function isAuthorizedCron(authHeader: string | null | undefined, secret: string | undefined): boolean {
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
