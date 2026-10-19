// Fingerprint / face sign-in for Getclient reviewers (WebAuthn passkeys).
//
//   POST { action: 'register-options' }               Authorization: Bearer <reviewer session>
//   POST { action: 'register-verify', response, device }  same
//   POST { action: 'list' } / { action: 'remove', id }    same
//   POST { action: 'login-options' }                   no session needed
//   POST { action: 'login-verify', response, challenge_id }
//        -> { token_hash } which the browser exchanges for a normal session
//
// The fingerprint or face never leaves the device: the device signs a
// one-time challenge and this function checks the signature against the
// public key saved when the reviewer turned the feature on.
// Optional secrets: PASSKEY_RP_ID (default getclient.co.za),
// PASSKEY_ORIGINS (default https://getclient.co.za,https://www.getclient.co.za).
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from 'npm:@simplewebauthn/server@10.0.1';
import { isoBase64URL } from 'npm:@simplewebauthn/server@10.0.1/helpers';
import { cors, json, clean } from '../_shared/http.ts';
import { admin } from '../_shared/db.ts';

const RP_ID = Deno.env.get('PASSKEY_RP_ID') || 'getclient.co.za';
const ORIGINS = (Deno.env.get('PASSKEY_ORIGINS') || 'https://getclient.co.za,https://www.getclient.co.za')
  .split(',').map((s) => s.trim()).filter(Boolean);
const FIVE_MIN = 5 * 60 * 1000;

async function reviewer(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  const user = data && data.user;
  if (!user) return null;
  const { data: a } = await admin.from('gc_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return a ? user : null;
}

async function takeChallenge(id: string | null, userId: string | null, kind: string) {
  let q = admin.from('gc_passkey_challenges').select('*').eq('kind', kind).order('created_at', { ascending: false }).limit(1);
  q = id ? q.eq('id', id) : q.eq('user_id', userId);
  const { data } = await q;
  const c = data && data[0];
  if (!c) return null;
  await admin.from('gc_passkey_challenges').delete().eq('id', c.id);       // single use
  // tidy anything older than five minutes
  await admin.from('gc_passkey_challenges').delete().lt('created_at', new Date(Date.now() - FIVE_MIN).toISOString());
  return Date.now() - Date.parse(c.created_at) > FIVE_MIN ? null : c.challenge;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'bad_request' }, 400); }
  const action = clean(b.action, 30);

  try {
    /* ---------------- sign in with fingerprint / face ---------------- */
    if (action === 'login-options') {
      const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: 'required', allowCredentials: [] });
      const { data } = await admin.from('gc_passkey_challenges').insert({ kind: 'login', challenge: options.challenge }).select('id').single();
      return json(req, { options, challenge_id: data!.id });
    }

    if (action === 'login-verify') {
      const response = b.response as Record<string, unknown>;
      const expected = await takeChallenge(clean(b.challenge_id, 40), null, 'login');
      if (!expected || !response || typeof response.id !== 'string') return json(req, { error: 'expired', message: 'That took too long. Try again.' }, 400);
      const { data: pk } = await admin.from('gc_passkeys').select('*').eq('id', response.id).maybeSingle();
      if (!pk) return json(req, { error: 'unknown', message: 'This device is not set up for fingerprint or face sign-in. Sign in with your password, then turn it on.' }, 404);

      const v = await verifyAuthenticationResponse({
        // deno-lint-ignore no-explicit-any
        response: response as any, expectedChallenge: expected, expectedOrigin: ORIGINS, expectedRPID: RP_ID,
        requireUserVerification: true,
        authenticator: { credentialID: pk.id, credentialPublicKey: isoBase64URL.toBuffer(pk.public_key), counter: Number(pk.counter), transports: pk.transports || undefined },
      });
      if (!v.verified) return json(req, { error: 'failed', message: 'That fingerprint or face was not accepted.' }, 401);
      await admin.from('gc_passkeys').update({ counter: v.authenticationInfo.newCounter, last_used: new Date().toISOString() }).eq('id', pk.id);

      // still a reviewer?
      const { data: still } = await admin.from('gc_admins').select('user_id').eq('user_id', pk.user_id).maybeSingle();
      if (!still) return json(req, { error: 'not_reviewer', message: 'This account is no longer a Getclient reviewer.' }, 403);
      const { data: u } = await admin.auth.admin.getUserById(pk.user_id);
      const email = u && u.user && u.user.email;
      if (!email) return json(req, { error: 'no_user' }, 404);
      // a one-time sign-in token for this reviewer (no email is sent)
      const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      if (error || !link) return json(req, { error: 'session', message: 'Could not start a session.' }, 500);
      return json(req, { token_hash: link.properties.hashed_token, email });
    }

    /* ---------------- set up / manage, for a signed-in reviewer ---------------- */
    const user = await reviewer(req);
    if (!user) return json(req, { error: 'auth', message: 'Sign in as a Getclient reviewer first.' }, 401);

    if (action === 'register-options') {
      const { data: mine } = await admin.from('gc_passkeys').select('id,transports').eq('user_id', user.id);
      const options = await generateRegistrationOptions({
        rpName: 'Getclient Admin', rpID: RP_ID,
        userName: user.email || user.id, userDisplayName: user.email || 'Getclient reviewer',
        userID: new TextEncoder().encode(user.id),
        attestationType: 'none',
        excludeCredentials: (mine || []).map((m) => ({ id: m.id, transports: m.transports || undefined })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
      });
      await admin.from('gc_passkey_challenges').insert({ kind: 'register', user_id: user.id, challenge: options.challenge });
      return json(req, { options });
    }

    if (action === 'register-verify') {
      const response = b.response as Record<string, unknown>;
      const expected = await takeChallenge(null, user.id, 'register');
      if (!expected || !response) return json(req, { error: 'expired', message: 'That took too long. Try again.' }, 400);
      const v = await verifyRegistrationResponse({
        // deno-lint-ignore no-explicit-any
        response: response as any, expectedChallenge: expected, expectedOrigin: ORIGINS, expectedRPID: RP_ID,
        requireUserVerification: true,
      });
      if (!v.verified || !v.registrationInfo) return json(req, { error: 'failed', message: 'Setting up fingerprint or face sign-in did not complete.' }, 400);
      const info = v.registrationInfo;
      // deno-lint-ignore no-explicit-any
      const transports = ((response.response as any) || {}).transports || null;
      await admin.from('gc_passkeys').upsert({
        id: info.credentialID, user_id: user.id, public_key: isoBase64URL.fromBuffer(info.credentialPublicKey),
        counter: info.counter, transports, device: clean(b.device, 80) || null,
      });
      return json(req, { ok: true });
    }

    if (action === 'list') {
      const { data } = await admin.from('gc_passkeys').select('id,device,created_at,last_used').eq('user_id', user.id).order('created_at');
      return json(req, { passkeys: data || [] });
    }

    if (action === 'remove') {
      await admin.from('gc_passkeys').delete().eq('user_id', user.id).eq('id', clean(b.id, 600));
      return json(req, { ok: true });
    }

    return json(req, { error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('admin-passkey', action, e);
    return json(req, { error: 'server', message: String((e as Error).message || e).slice(0, 200) }, 400);
  }
});
