# Getclient

South Africa's verified business directory: [getclient.co.za](https://getclient.co.za).
Blue and white, with a South African accent: the national colours appear only as a thin ribbon.

The site is a static build. Listings, ratings, quotes, payments and the reviewer panel all
run against the existing Supabase project, and the build only **reads** the
`gc_listings_public` view. Existing rows are never changed; the migration below only adds.

## Tiers

| | Basic (free) | Blue Verified (R499 / year) | Gold Verified (R1,299 / year) |
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
Do the steps **in this order** (the migration switches off the old direct writes).

1. **Email (Resend).** Create an account at resend.com, verify the domain you will send from
   (e.g. getclient.co.za) and create an API key.
2. **Deploy the functions.** With the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase login
   supabase link --project-ref nfdzcjwncbpsruieaxis
   supabase functions deploy submit-quote submit-listing check-badge gc-mailer
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
4. **Run the migration.** Paste `supabase/migrations/20261019000000_tiers_badges_email.sql` into the
   SQL editor and run it (or `supabase db push`).
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

Optional: to show quote requests in `/admin/`, give your reviewer accounts read access to
`gc_quotes` (an RLS select policy that matches how `gc_admins` identifies reviewers).

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
