// CORS and JSON helpers shared by the Getclient edge functions.
const ALLOWED = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') || 'https://getclient.co.za,https://www.getclient.co.za')
    .split(',').map((s) => s.trim()).filter(Boolean),
);

export function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.has(o) || o.startsWith('http://localhost:') ? o : 'https://getclient.co.za',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

export function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '';
}

export const clean = (v: unknown, max = 500): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
