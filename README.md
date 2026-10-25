# Getclient

South Africa's verified business directory: [getclient.co.za](https://getclient.co.za).
Blue and white, with a South African accent: the national colours appear only as a thin ribbon.

The site is a static build. Listings, ratings, quotes, payments and the reviewer panel all
run against the existing Supabase project, and the build only **reads** the
`gc_listings_public` view. The whole database setup is one file, `supabase/schema.sql`: re-runnable,
it only adds what is missing and never deletes or changes data. The Supabase project is used only by Getclient.

## Tiers

| | Basic (free) | Blue Verified (R499 / month) | Gold Verified (R1,299 / month) |
| --- | --- | --- | --- |
| Listed on Getclient badge on own website | Required | Required | Required |
| Description and contact details | Yes | Yes | Yes |
| Photos | No | Up to 6 | Up to 20 + cover |
| Services list | No | Up to 8 | Up to 12 |
| Quote requests (emailed to the owner, info@getclient.co.za copied) | No | Yes | Yes |
| Promotion | None | Blue Verified showcase on every page, under Gold | Ads on every page: top bar, featured block, first in every list, search, profile sidebars |

The full benefit table is on `/pricing/` and lives in `src/data/site.mjs` (`TIERS`).
Gold profile content kept in the repo (Digitalx's cover, services, phone lines) is in
`src/data/enrich.json`; services added to the `gc_services` table take over.

## Going live with badges, emails and Turnstile

The site works as soon as `dist/` is uploaded, but these features need the Supabase side:
badge checks, quote emails, welcome / approval / rejection emails, and Turnstile.
Do the steps **in this order** (the schema switches off the old direct writes).

1. **Email (Resend).** Create an account at resend.com, verify the domain you will send from
   (e.g. getclient.co.za) and create an API key.
2. **Deploy the functions.** With the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase login
   supabase link --project-ref nfdzcjwncbpsruieaxis
   supabase functions deploy submit-quote submit-listing check-badge gc-mailer admin-passkey verify-payment submit-job lead job-status whatsapp --use-api --no-verify-jwt
   ```
3. **Set the function secrets** in the Supabase dashboard → Edge Functions → Secrets
   (type them there; never paste secrets into chats, tickets or this repo):
   | Secret | Value |
   | --- | --- |
   | `TURNSTILE_SECRET` | The secret key of the Turnstile widget `0x4AAAAAAFavP5vcRoKQ-O30` (Cloudflare dashboard → Turnstile) |
   | `TURNSTILE_HOSTNAMES` | `getclient.co.za,www.getclient.co.za` |
   | `RESEND_API_KEY` | From step 1 |
   | `MAIL_FROM` | e.g. `Getclient <info@getclient.co.za>` |
   | `MAIL_CC` | `info@getclient.co.za` (the default) |
   | `MAILER_HOOK_SECRET` | From step 5 |
   | `PAYSTACK_SECRET_KEY` | Paystack → Settings → API Keys & Webhooks → live **secret** key (confirms payments) |
4. **Run the schema.** Back up first (Database → Backups, or `supabase db dump`). Then paste
   `supabase/schema.sql` into the SQL editor and run it. The checks at the bottom of the file confirm
   your listings, ratings, photos, quotes and payments are all still there.
5. **Connect the status emails.** In the SQL editor run
   `select value from public.gc_private_settings where key = 'mailer_hook_secret';`
   and save that value as the `MAILER_HOOK_SECRET` function secret.
6. **Turnstile hostnames.** In Cloudflare → Turnstile → the widget, make sure `getclient.co.za`
   and `www.getclient.co.za` are listed. Add `localhost` only while testing locally.
7. **Test** one real quote request and one listing on the live site: the business owner and
   info@getclient.co.za should both get the quote email, and the applicant a welcome email.

What changes once this is done:
* Every application (all tiers) must show the badge on its website; `submit-listing` refuses
  unpaid applications without it, and the database refuses to approve any listing until
  `badge_verified_at` is set ("Check badge" in `/admin/`).
* Photos can only be added to Blue and Gold listings (database trigger).
* Quote requests and listings are only accepted with a valid Turnstile token.

Reviewers are the users in `gc_admins`; they can read quote requests in `/admin/`. The public key can
no longer read the `gc_listings` table directly (it used to expose CIPC numbers and contact names);
the website reads `gc_listings_public` instead.

## Reviewer app (/admin/)

`/admin/` installs as its own app, **Getclient Admin**, with the G icon: Chrome or Android show
**Install**; on iPhone use Share → Add to Home Screen. After signing in with a password once, a
reviewer can turn on **fingerprint or face sign-in** for that device (a passkey). The device checks
the fingerprint or face; the `admin-passkey` edge function verifies the signed challenge and starts
a normal session. Passkeys work only on getclient.co.za (set `PASSKEY_RP_ID` / `PASSKEY_ORIGINS`
to test elsewhere). Removing someone from `gc_admins` also stops their fingerprint sign-in.

## Smart quote matching (/get-quotes/)

A client describes a job once (website or WhatsApp). `gc_match_job()` offers it to up to three
businesses at a time, chosen by these rules, in order:

1. **Hard filters:** approved Blue or Gold, same category, same town, or the same province when the
   town has fewer than three; has an email; never offered this job before.
2. **Accuracy:** if any business genuinely matches the service asked for (speciality, services or
   summary), only matching businesses are offered it. Loose matches are used only when nothing
   matches at all, and the business sees "possible match".
3. **Ranking:** same town before nearby, Gold before Blue, response rate, rating, fewest leads this
   week, then a stable tiebreak.
4. **The business confirms:** it accepts or declines from a one-click email link or the dashboard. The
   client's contact details are released only on acceptance. Declines and unanswered offers
   (4 hours for urgent jobs, 24 hours this week, 48 hours otherwise) pass to the next best match.
   `gc_lead_sweep()` runs every 10 minutes through pg_cron.

Every rule is covered by the database tests (52 checks). Response rate on profiles now counts job
offers answered as well as quote requests.

## Business owner dashboard (/dashboard/)

Owners sign in with a 6-digit code emailed to the address on their listing (Supabase email OTP).
`gc_claim_listings()` links them to every listing with that confirmed email. They can see 30-day
stats (profile views, badge clicks, website and phone clicks, job offers, quote requests, response
rate, and how their tier compares in their category), answer job offers, mark quote requests as
replied, edit their listing, manage services (Blue 8, Gold 12) and photos (Blue 6, Gold 20), and
check their badge. All changes go through `gc_owner_*` functions that check ownership and tier rules.

**Setup (Supabase dashboard):**
- **Authentication → Providers → Email:** keep Email enabled.
- **Authentication → Emails → SMTP Settings:** turn on custom SMTP with Resend. Host `smtp.resend.com`,
  port `465`, user `resend`, password = your Resend API key, sender `info@getclient.co.za`. Without
  this, Supabase's built-in email sends only a few sign-in codes an hour.
- **Authentication → Emails → Templates → Magic Link:** include the code, e.g.
  `<p>Your Getclient sign-in code is <b>{{ .Token }}</b></p><p>Or <a href="{{ .ConfirmationURL }}">sign in with this link</a>.</p>`
- **Authentication → URL Configuration:** Site URL `https://getclient.co.za`; add
  `https://getclient.co.za/dashboard/` to Redirect URLs.
- **Database → Extensions:** enable **pg_cron** (before running `supabase/schema.sql`), so unanswered
  job offers move on automatically.

## WhatsApp (sign up and get quotes)

People message the Getclient WhatsApp number. Reply **1** lists a business (free Basic; the badge
must still be on their website), **2** posts a job into the same matching as the website, and **3**
gives contact details. Businesses also get new job offers on WhatsApp, and clients who asked
on WhatsApp get the replies there.

**Setup (Meta):**
1. In [Meta for Developers](https://developers.facebook.com) create an app of type **Business**, add
   **WhatsApp**, and connect the Getclient number. The number must not be in use on the WhatsApp app.
2. Create a **System User** in Meta Business Settings with a **permanent token** that has
   `whatsapp_business_messaging`. Note the **Phone number ID** and the app's **App secret**.
3. Add these as Supabase function secrets: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`,
   `WHATSAPP_APP_SECRET`, and `WHATSAPP_VERIFY_TOKEN` (any long random text you make up).
4. In the app's WhatsApp → **Configuration**, set the webhook URL to
   `https://nfdzcjwncbpsruieaxis.supabase.co/functions/v1/whatsapp`, the verify token to the same
   `WHATSAPP_VERIFY_TOKEN`, and subscribe to **messages**.
5. Optional but recommended: create a **Utility** message template, e.g. `getclient_update`, with the
   body `{{1}}`. Once Meta approves it, add `WHATSAPP_TEMPLATE_UPDATE=getclient_update`. WhatsApp only
   allows free-form messages within 24 hours of the person's last message, and this template
   covers the rest (for example, a business accepting the next day).

## Quick start

```bash
npm install
npm run build     # pulls listings from Supabase and writes dist/
npm run serve     # http://localhost:4173, behaves like the production .htaccess
```

`npm run build:offline` rebuilds from the last pull (`.cache/listings.json`) without the network.

## Deploying

Upload the **contents of `dist/`** to the web root (`public_html` on cPanel). `dist/.htaccess`
handles Apache; `dist/_redirects` and `dist/_headers` cover Netlify and Cloudflare Pages.

Rebuild and redeploy whenever you like so search engines see new listings as static pages.
In between builds the site stays live: new approvals appear on category, city and home
pages straight away (`assets/live.js`), and `/b/<slug>/` falls back to a client-rendered profile.

## The "Listed on Getclient" badge

Every listed business displays the badge on its own website. It links to the business's
profile on getclient.co.za.

```html
<script src="https://getclient.co.za/badge.js" data-gc-id="gc-000001" async></script>
```

Optional attributes: `data-gc-theme="dark"`, `data-gc-size="compact"`,
`data-gc-layout="float-br|float-bl"`.

* Basic listings show **Listed on Getclient**. Blue and Gold listings show their tier as well.
* The script reads `/verify/<id>.json` (written at build time for every listing), then falls back
  to Supabase for listings approved since the last build. A removed listing's badge disappears.
* **Every badge code issued before the redesign keeps working.** The script attributes are
  unchanged, `/assets/seal-gold.svg` and `/assets/seal-blue.svg` are unchanged, and old
  plain-HTML badges that link to `/b/<listing id>/` are forwarded to the profile.
* Image versions for plain HTML and email: `/assets/badge/{listed|blue|gold}-{light|dark}.{svg|png}`.
* Builder with copy-paste codes: [/badge/](https://getclient.co.za/badge/). Every profile page
  also shows the owner their own code.

## Layout

| Path | What it is |
| --- | --- |
| `build.mjs` | The static build: every page, sitemap, badge records, `/b/<id>/` forwarders |
| `src/pages/` | Page templates (`directory.mjs` for listings, `content.mjs` for everything else) |
| `src/lib.mjs` | Header, footer, listing cards, seals, layout |
| `src/data/` | Categories, cities, provinces, contact details |
| `src/config.json` | Supabase URL, publishable key, Paystack public key (all public, browser-safe) |
| `src/static/` | Copied as-is: `theme.css`, `app.js`, `live.js`, `admin.js`, `badge.js`, brand assets, covers, server config |
| `supabase/` | Migration and edge functions (`submit-quote`, `submit-listing`, `check-badge`, `gc-mailer`) |
| `tools/brand.mjs` | Regenerates the logo, icons, seals and badge images (`npm run brand`) |
| `tools/serve.mjs` | Local preview server |

Brand: Getclient Blue `#1652F0`, Navy `#0B2A6F`, Ink `#071A47`, White. Font: Poppins.
