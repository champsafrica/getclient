# Getclient

South Africa's verified business directory: [getclient.co.za](https://getclient.co.za).
Blue and white, with a South African accent: the national colours appear only as a thin ribbon.

The site is a static build. Listings, ratings, quotes, payments and the reviewer panel all
run against the existing Supabase project, and the build only **reads** the
`gc_listings_public` view. Nothing in this repository changes the data.

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
| `src/static/` | Copied as-is: `theme.css`, `app.js`, `live.js`, `badge.js`, brand assets, server config |
| `tools/brand.mjs` | Regenerates the logo, icons, seals and badge images (`npm run brand`) |
| `tools/serve.mjs` | Local preview server |

Brand: Getclient Blue `#1652F0`, Navy `#0B2A6F`, Ink `#071A47`, White. Font: Poppins.
