// WhatsApp Business Platform (Meta Cloud API). Function secrets:
//   WHATSAPP_TOKEN       permanent access token (System User token)
//   WHATSAPP_PHONE_ID    the phone number ID of the Getclient WhatsApp number
//   WHATSAPP_APP_SECRET  the Meta app secret (verifies incoming webhooks)
//   WHATSAPP_VERIFY_TOKEN any long random string, also entered in the Meta webhook settings
//   WHATSAPP_TEMPLATE_UPDATE (optional) approved template name for messages sent
//                        more than 24 hours after the person last wrote to us
const GRAPH = 'https://graph.facebook.com/v21.0';

export const waReady = () => !!(Deno.env.get('WHATSAPP_TOKEN') && Deno.env.get('WHATSAPP_PHONE_ID'));

/** South African number in WhatsApp's format: 27821234567 */
export function waNumber(raw: string | null | undefined): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^27\d{9}$/.test(d)) return d;
  if (/^0\d{9}$/.test(d)) return '27' + d.slice(1);
  return null;
}

async function post(body: Record<string, unknown>) {
  if (!waReady()) return false;
  const r = await fetch(`${GRAPH}/${Deno.env.get('WHATSAPP_PHONE_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  });
  if (!r.ok) console.error('whatsapp send failed', r.status, await r.text());
  return r.ok;
}

/** Free-form text: works within 24 hours of the person's last message to us. */
export const waText = (to: string, text: string) =>
  post({ to, type: 'text', text: { body: text.slice(0, 4000), preview_url: true } });

/**
 * A notification that may fall outside the 24-hour window: tries free-form text,
 * then the approved update template (one {{1}} body parameter) if configured.
 */
export async function waNotify(to: string, text: string) {
  if (await waText(to, text)) return true;
  const tpl = Deno.env.get('WHATSAPP_TEMPLATE_UPDATE');
  if (!tpl) return false;
  return post({
    to, type: 'template',
    template: { name: tpl, language: { code: 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: text.slice(0, 900) }] }] },
  });
}

/** Checks Meta's X-Hub-Signature-256 header against the raw request body. */
export async function waSignatureOk(raw: string, header: string | null): Promise<boolean> {
  const secret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!secret || !header || !header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const hex = Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
