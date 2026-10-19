// Cloudflare Turnstile server-side validation (siteverify).
// TURNSTILE_SECRET: the widget's secret key, set as a Supabase function secret.
// TURNSTILE_HOSTNAMES: comma-separated hostnames the token must come from.
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token: unknown, expectedAction: string, remoteip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET') || '';
  const hostnames = new Set(
    (Deno.env.get('TURNSTILE_HOSTNAMES') || 'getclient.co.za,www.getclient.co.za')
      .split(',').map((h) => h.trim()).filter(Boolean),
  );
  if (typeof token !== 'string' || !token || token.length > 2048 || !secret || hostnames.size === 0) return false;

  const idempotency_key = crypto.randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(SITEVERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, remoteip, idempotency_key }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new Error(`siteverify ${r.status}`);
      const result = await r.json();
      if (!result.success || result.action !== expectedAction || !hostnames.has(result.hostname)) {
        console.warn('turnstile rejected', expectedAction, result['error-codes'], result.hostname);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('turnstile attempt failed', attempt, String(e));
      await new Promise((ok) => setTimeout(ok, Math.pow(2, attempt) * 1000));
    }
  }
  return false;
}
