// One-time link tokens. The raw token goes in the link; only its SHA-256 is stored
// (the database computes the same hash with gc_token_hash()).
export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function tokenHash(token: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return Array.from(d).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const TIMING: Record<string, string> = {
  urgent: 'Urgent (within 24 hours)', week: 'This week', month: 'This month', flexible: 'Flexible',
};
