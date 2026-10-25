-- =====================================================================
-- Getclient: complete Supabase schema (v2)
-- Project: nfdzcjwncbpsruieaxis (Getclient only)
--
-- One file that replaces the old schema.sql and every add-on migration.
--
--   * KEEPS ALL DATA. No table is dropped or emptied, and no existing row
--     is changed. Tables are created only if missing; new columns are added
--     only if missing. Only views, functions, triggers and policies are
--     replaced, and none of those hold data.
--   * Touches only gc_ objects and the gc-photos / gc-docs storage buckets.
--   * Safe to re-run.
--
-- Run it AFTER deploying the edge functions in supabase/functions
-- (submit-quote, submit-listing, check-badge, gc-mailer), because it switches
-- quote requests and new listings over to them. See README, "Going live".
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "pg_net";

do $$ begin create type gc_status as enum ('pending','approved','rejected','suspended'); exception when duplicate_object then null; end $$;
do $$ begin create type gc_tier   as enum ('none','blue','gold'); exception when duplicate_object then null; end $$;


-- ===================================================================== tables

-- ------------------------------------------------------------ taxonomy
create table if not exists gc_categories (
  slug text primary key, name text not null, blurb text, sort int default 0
);
create table if not exists gc_locations (
  slug text primary key, name text not null, province text not null,
  province_slug text not null, lat numeric, lng numeric
);

-- ------------------------------------------------------------- listings
create table if not exists gc_listings (
  id             uuid primary key default gen_random_uuid(),
  public_id      text unique not null default 'gc-' || lpad((floor(random()*999999))::text, 6, '0'),
  slug           text unique,
  name           text not null,
  tagline        text,
  description    text not null check (char_length(description) >= 50),
  category       text references gc_categories(slug),
  subcategory    text,
  city           text references gc_locations(slug),
  province       text,
  address        text,
  founded        int,
  employees      text,
  phone          text not null,
  email          text not null,
  website        text,
  contact_name   text,
  contact_role   text,
  cipc           text,
  requested_plan text default 'basic',
  tier           gc_tier default 'none',
  status         gc_status default 'pending',
  -- what was actually checked. Never settable by the applicant.
  check_identity        boolean default false,
  check_cipc            boolean default false,
  check_insurance       boolean default false,
  check_trading_history boolean default false,
  check_reviews         boolean default false,
  verified_at    timestamptz,
  verified_by    uuid references auth.users(id),
  sponsored       boolean default false,
  sponsored_until date,
  consent_terms  boolean default false,
  consent_review boolean default false,
  created_at  timestamptz default now(),
  reviewed_at timestamptz,
  updated_at  timestamptz default now()
);

-- columns added over time (no-ops if they already exist)
alter table gc_listings add column if not exists paid_plan         text;
alter table gc_listings add column if not exists paid_at           timestamptz;
alter table gc_listings add column if not exists docs_complete     boolean default false;
alter table gc_listings add column if not exists discount_code     text;
alter table gc_listings add column if not exists badge_url         text;
alter table gc_listings add column if not exists badge_verified_at timestamptz;
alter table gc_listings add column if not exists badge_check       jsonb;
alter table gc_listings add column if not exists reject_reason     text;
alter table gc_listings add column if not exists reject_fix        text;

comment on column gc_listings.badge_verified_at is
  'When the Listed on Getclient badge was last found on the business website. Required before approval.';

create index if not exists gc_idx_status on gc_listings(status);
create index if not exists gc_idx_cat    on gc_listings(category);
create index if not exists gc_idx_city   on gc_listings(city);
create index if not exists gc_idx_trgm   on gc_listings
  using gin ((name || ' ' || coalesce(tagline,'') || ' ' || description) gin_trgm_ops);

-- ---------------------------------------------------------- star ratings
-- Stars only. No free text anywhere in this table, by design.
create table if not exists gc_ratings (
  id         uuid primary key default gen_random_uuid(),
  listing_id text not null references gc_listings(public_id) on delete cascade on update cascade,
  stars      smallint not null check (stars between 1 and 5),
  rater_key  text not null,          -- anonymous per-device key from the browser
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (listing_id, rater_key)     -- one rating per person per business
);
create index if not exists gc_idx_rate on gc_ratings(listing_id);

-- ------------------------------------------------------------- quotes
create table if not exists gc_quotes (
  id           uuid primary key default gen_random_uuid(),
  business_id  text references gc_listings(public_id) on delete set null on update cascade,
  name         text not null,
  email        text not null,
  phone        text,
  details      text not null,
  created_at   timestamptz default now(),
  responded_at timestamptz          -- powers the published response rate
);
create index if not exists gc_idx_quote on gc_quotes(business_id);

-- ------------------------------------------------------------- photos (Blue and Gold only)
create table if not exists gc_photos (
  id         uuid primary key default gen_random_uuid(),
  listing_id text not null references gc_listings(public_id) on delete cascade on update cascade,
  path       text not null,          -- object path inside the gc-photos bucket
  caption    text,
  sort       int default 0,
  created_at timestamptz default now()
);
create index if not exists gc_idx_photo on gc_photos(listing_id, sort);

-- ------------------------------------------------------------- services (Blue: 8, Gold: 12)
create table if not exists gc_services (
  id          uuid primary key default gen_random_uuid(),
  listing_id  text not null references gc_listings(public_id) on delete cascade on update cascade,
  name        text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 280),
  price_from  text check (char_length(price_from) <= 40),
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists gc_services_listing on gc_services (listing_id, sort);

-- ----------------------------------------------------------- payments
create table if not exists gc_payments (
  id          uuid primary key default gen_random_uuid(),
  listing_id  text references gc_listings(public_id) on delete set null on update cascade,
  plan        text,
  amount      int,                    -- cents, ZAR (R499 / R1,299 per month)
  reference   text unique not null,
  channel     text,
  status      text default 'pending_verification',
  created_at  timestamptz default now(),
  verified_at timestamptz
);
alter table gc_payments add column if not exists discount_code text;
alter table gc_payments add column if not exists discount_pct  int;

-- ------------------------------------------------- verification documents
create table if not exists gc_documents (
  id          uuid primary key default gen_random_uuid(),
  listing_id  text not null references gc_listings(public_id) on delete cascade on update cascade,
  kind        text not null check (kind in ('cipc','id','sars','insurance','other')),
  path        text not null,
  filename    text,
  uploaded_at timestamptz default now(),
  reviewed_at timestamptz,
  deleted_at  timestamptz         -- set when the file is purged after verification
);
create index if not exists gc_idx_doc on gc_documents(listing_id);

-- ------------------------------------------------------- discount codes
create table if not exists gc_discounts (
  code        text primary key,
  percent     int not null check (percent between 1 and 100),
  applies_to  text not null check (applies_to in ('blue','gold','any')),
  active      boolean default true,
  max_uses    int,                       -- null = unlimited
  used        int default 0,
  expires_at  timestamptz,
  note        text,
  created_at  timestamptz default now()
);

-- ------------------------------------------------------- badge telemetry
create table if not exists gc_badge_events (
  id bigserial primary key,
  public_id text not null,
  referrer text,
  created_at timestamptz default now()
);
create index if not exists gc_idx_badge on gc_badge_events(public_id, created_at desc);

-- badge.js reports the website it is shown on; reviewers use it as proof
create table if not exists gc_badge_pings (
  domain      text not null,
  listing_id  text not null default '',
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  hits        int not null default 1,
  primary key (domain, listing_id)
);

-- -------------------------------------------------------------- admins
create table if not exists gc_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, role text default 'reviewer'
);

-- private settings read by triggers (mailer address and secret); never exposed
create table if not exists gc_private_settings (key text primary key, value text not null);

-- fingerprint / face sign-in for reviewers (passkeys). Only the admin-passkey
-- edge function reads or writes these; the browser has no access.
create table if not exists gc_passkeys (
  id          text primary key,          -- credential id (base64url)
  user_id     uuid not null references auth.users(id) on delete cascade,
  public_key  text not null,             -- base64url
  counter     bigint not null default 0,
  transports  text[],
  device      text,
  created_at  timestamptz not null default now(),
  last_used   timestamptz
);
create index if not exists gc_passkeys_user on gc_passkeys(user_id);
create table if not exists gc_passkey_challenges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,   -- null for sign-in
  kind       text not null check (kind in ('register', 'login')),
  challenge  text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------- smart quote matching
-- A client posts one job; it is offered to up to three verified businesses at a
-- time. A business sees the job, then accepts or declines; the client's contact
-- details are released only on acceptance. Declined and unanswered offers pass
-- to the next best match automatically.
create table if not exists gc_jobs (
  id                uuid primary key default gen_random_uuid(),
  ref               text unique not null default 'J-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7)),
  category          text not null references gc_categories(slug),
  city              text not null references gc_locations(slug),
  service           text not null check (char_length(service) between 2 and 80),
  details           text not null check (char_length(details) between 20 and 2000),
  timing            text not null check (timing in ('urgent', 'week', 'month', 'flexible')),
  budget            text check (char_length(budget) <= 60),
  client_name       text not null check (char_length(client_name) between 2 and 120),
  client_email      text,
  client_phone      text,
  consent           boolean not null default false,
  source            text not null default 'web' check (source in ('web', 'whatsapp')),
  client_token_hash text not null,
  status            text not null default 'matching' check (status in ('matching', 'matched', 'no_match', 'closed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  closed_at         timestamptz,
  check (client_email is not null or client_phone is not null)
);
create index if not exists gc_jobs_status on gc_jobs(status, created_at desc);
create index if not exists gc_jobs_email  on gc_jobs(lower(client_email), created_at desc);

create table if not exists gc_leads (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references gc_jobs(id) on delete cascade,
  listing_id     text not null references gc_listings(public_id) on delete cascade on update cascade,
  rank           int  not null,
  nearby         boolean not null default false,    -- same province, not the same town
  relevance      real not null default 0,           -- 0..1 match between the job and the business's services
  status         text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'expired', 'withdrawn')),
  token_hash     text not null unique,
  offered_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  responded_at   timestamptz,
  decline_reason text check (char_length(decline_reason) <= 200),
  unique (job_id, listing_id)                       -- never offered to the same business twice
);
create index if not exists gc_leads_listing on gc_leads(listing_id, offered_at desc);
create index if not exists gc_leads_open    on gc_leads(status, expires_at) where status = 'offered';

-- ------------------------------------------------- business owners
-- An owner is linked to a listing by proving they control the listing's email.
create table if not exists gc_owners (
  user_id    uuid not null references auth.users(id) on delete cascade,
  listing_id text not null references gc_listings(public_id) on delete cascade on update cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- profile views and badge clicks, one row per visitor per listing per day
create table if not exists gc_events (
  listing_id text not null references gc_listings(public_id) on delete cascade on update cascade,
  kind       text not null check (kind in ('view', 'badge_click', 'website_click', 'phone_click', 'whatsapp_click')),
  day        date not null default current_date,
  visitor    text not null,
  primary key (listing_id, kind, day, visitor)
);

-- ------------------------------------------------- WhatsApp sign-up
create table if not exists gc_wa_sessions (
  phone      text primary key,
  step       text not null default 'start',
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table if not exists gc_wa_seen (
  message_id text primary key,
  created_at timestamptz not null default now()
);

-- Child keys follow a renamed public_id (re-pointed in case an older table
-- was created without ON UPDATE CASCADE). Data is not touched.
alter table gc_ratings  drop constraint if exists gc_ratings_listing_id_fkey;
alter table gc_ratings  add  constraint gc_ratings_listing_id_fkey
  foreign key (listing_id) references gc_listings(public_id) on delete cascade on update cascade;
alter table gc_quotes   drop constraint if exists gc_quotes_business_id_fkey;
alter table gc_quotes   add  constraint gc_quotes_business_id_fkey
  foreign key (business_id) references gc_listings(public_id) on delete set null on update cascade;
alter table gc_photos   drop constraint if exists gc_photos_listing_id_fkey;
alter table gc_photos   add  constraint gc_photos_listing_id_fkey
  foreign key (listing_id) references gc_listings(public_id) on delete cascade on update cascade;
alter table gc_payments drop constraint if exists gc_payments_listing_id_fkey;
alter table gc_payments add  constraint gc_payments_listing_id_fkey
  foreign key (listing_id) references gc_listings(public_id) on delete set null on update cascade;


-- ===================================================================== seeds
-- Reference data only. Existing rows are never overwritten.
insert into gc_categories (slug, name, blurb) values
  ('contractors-and-trades','Contractors & Trades','Builders, electricians, plumbers, roofers and renovation teams.'),
  ('healthcare-and-medical','Healthcare & Medical','Practices, clinics, allied health and home care providers.'),
  ('legal-services','Legal Services','Attorneys, conveyancers, labour specialists and mediators.'),
  ('digital-and-tech','Digital & Tech','Web, software, IT support, SEO and paid media specialists.'),
  ('creative-services','Creative Services','Photography, video, branding, print and event production.'),
  ('finance-and-accounting','Finance & Accounting','Accountants, tax practitioners, bookkeepers and brokers.'),
  ('transport-and-logistics','Transport & Logistics','Movers, couriers, freight, fleet and vehicle services.'),
  ('food-and-hospitality','Food & Hospitality','Caterers, venues, accommodation and mobile kitchens.'),
  ('real-estate','Real Estate','Agencies, rental managers, valuers and property inspectors.'),
  ('home-and-garden','Home & Garden','Landscaping, cleaning, pest control, pools and security.'),
  ('education-and-training','Education & Training','Tutors, driving schools, skills academies and corporate training.'),
  ('business-services','Business Services','Company registration, HR, compliance, admin and consulting.')
on conflict (slug) do nothing;

insert into gc_locations (slug, name, province, province_slug, lat, lng) values
  ('cape-town','Cape Town','Western Cape','western-cape',-33.9249,18.4241),
  ('johannesburg','Johannesburg','Gauteng','gauteng',-26.2041,28.0473),
  ('pretoria','Pretoria','Gauteng','gauteng',-25.7479,28.2293),
  ('durban','Durban','KwaZulu-Natal','kwazulu-natal',-29.8587,31.0218),
  ('gqeberha','Gqeberha','Eastern Cape','eastern-cape',-33.9608,25.6022),
  ('bloemfontein','Bloemfontein','Free State','free-state',-29.0852,26.1596),
  ('east-london','East London','Eastern Cape','eastern-cape',-33.0292,27.8546),
  ('polokwane','Polokwane','Limpopo','limpopo',-23.9045,29.4689),
  ('mbombela','Mbombela','Mpumalanga','mpumalanga',-25.4753,30.9694),
  ('kimberley','Kimberley','Northern Cape','northern-cape',-28.7282,24.7499),
  ('rustenburg','Rustenburg','North West','north-west',-25.6672,27.2424),
  ('stellenbosch','Stellenbosch','Western Cape','western-cape',-33.9321,18.8602),
  ('kuils-river','Kuils River','Western Cape','western-cape',-33.9333,18.6833)
on conflict (slug) do nothing;

-- Discount codes are not seeded here: they already live in gc_discounts and a
-- code in a public file can be used by anyone. Add new ones in the SQL editor.

-- mailer settings for the status emails (secret generated once, kept on re-runs)
insert into gc_private_settings (key, value) values
  ('mailer_url', 'https://nfdzcjwncbpsruieaxis.supabase.co/functions/v1/gc-mailer'),
  ('mailer_hook_secret', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- Digitalx's services (only if none are stored yet)
insert into gc_services (listing_id, name, description, price_from, sort)
select 'gc-000001', s.name, s.descr, s.price, s.n
from (values
  (1, 'Web development', 'Fast, mobile-first websites and online stores that bring in enquiries.', 'From R3,990'),
  (2, 'Domains and hosting', 'Domains, hosting, SSL and business email, looked after.', 'From R150/month'),
  (3, 'Custom software', 'Web apps, portals and dashboards built around your business.', 'Quoted in writing'),
  (4, 'Company registration', 'Your Pty Ltd registered with CIPC, plus SARS registration and annual returns.', 'From R990'),
  (5, 'Startup bundles', 'Registration, website, hosting and growth support, packaged together.', 'From R499/month')
) as s(n, name, descr, price)
where exists (select 1 from gc_listings where public_id = 'gc-000001')
  and not exists (select 1 from gc_services where listing_id = 'gc-000001');


-- ===================================================================== functions

create or replace function gc_slugify(txt text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(txt,'')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function gc_set_slug() returns trigger language plpgsql as $$
declare base text; try text; n int := 1;
begin
  if new.slug is null or new.slug = '' then
    base := gc_slugify(new.name); try := base;
    while exists (select 1 from gc_listings where slug = try and id <> new.id) loop
      n := n + 1; try := base || '-' || n;
    end loop;
    new.slug := try;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- an applicant must never be able to grant themselves a badge
create or replace function gc_guard_tier() returns trigger language plpgsql as $$
begin
  if auth.role() = 'anon' then
    new.tier := 'none'; new.status := 'pending'; new.sponsored := false;
    new.check_identity := false; new.check_cipc := false; new.check_insurance := false;
    new.check_trading_history := false; new.check_reviews := false;
    new.verified_at := null; new.verified_by := null;
    new.badge_verified_at := null;
  end if;
  return new;
end $$;

create or replace function gc_touch_rating() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- SECURITY DEFINER so it reads gc_admins without re-entering RLS (no recursion)
create or replace function gc_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gc_admins where user_id = auth.uid());
$$;

-- what documents each tier requires, so the form and the reviewer agree
create or replace function gc_required_docs(p_tier text)
returns text[] language sql immutable as $$
  select case p_tier
    when 'blue' then array['cipc','id']
    when 'gold' then array['cipc','id','sars','insurance']
    else array[]::text[] end;
$$;

-- Every listing approved from now on must show the badge on its website.
-- Listings approved before this rule keep their status.
create or replace function gc_require_badge() returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and coalesce(old.status::text, '') <> 'approved'
     and new.badge_verified_at is null then
    raise exception 'badge not verified: the Listed on Getclient badge must be found on % before approval',
      coalesce(new.website, 'the business website')
      using hint = 'Run "Check badge" in the reviewer panel first.';
  end if;
  return new;
end $$;

-- photos: Blue up to 6, Gold up to 20, Basic none
create or replace function gc_photo_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare plan text; n int; cap int;
begin
  select coalesce(nullif(l.tier::text, 'none'), l.requested_plan, 'basic') into plan
    from gc_listings l where l.public_id = new.listing_id;
  cap := case plan when 'gold' then 20 when 'blue' then 6 else 0 end;
  if cap = 0 then raise exception 'photos are a Blue and Gold feature'; end if;
  select count(*) into n from gc_photos where listing_id = new.listing_id;
  if n >= cap then raise exception 'photo limit reached (% for this tier)', cap; end if;
  return new;
end $$;

-- called by badge.js on every page view of a badge; records the website domain
create or replace function gc_badge_ping(p_id text default '') returns void
language plpgsql security definer set search_path = public as $$
declare origin text; dom text;
begin
  origin := coalesce(current_setting('request.headers', true)::json ->> 'origin', '');
  dom := lower(regexp_replace(origin, '^https?://(www\.)?([^/:]+).*$', '\2'));
  if dom = '' or dom = origin or dom in ('getclient.co.za', 'localhost', '127.0.0.1') then return; end if;
  insert into gc_badge_pings (domain, listing_id) values (dom, left(coalesce(p_id, ''), 20))
  on conflict (domain, listing_id) do update set last_seen = now(), hits = gc_badge_pings.hits + 1;
end $$;

-- emails the applicant when a reviewer approves, rejects or suspends a listing
create or replace function gc_notify_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'suspended') then
    select value into u from gc_private_settings where key = 'mailer_url';
    select value into s from gc_private_settings where key = 'mailer_hook_secret';
    perform net.http_post(
      url := u,
      body := jsonb_build_object('event', 'listing_status', 'public_id', new.public_id,
                                 'status', new.status, 'old_status', old.status),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-gc-hook', s)
    );
  end if;
  return new;
end $$;

-- The only way to write a rating. Touches only the caller's own row.
create or replace function gc_rate(p_listing text, p_stars int, p_key text)
returns table (avg_rating numeric, rating_count int)
language plpgsql security definer set search_path = public as $$
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'stars must be between 1 and 5'; end if;
  if p_key is null or char_length(p_key) < 8 then raise exception 'invalid rater key'; end if;
  if not exists (select 1 from gc_listings l where l.public_id = p_listing and l.status = 'approved') then
    raise exception 'listing not found';
  end if;
  insert into gc_ratings (listing_id, stars, rater_key) values (p_listing, p_stars, p_key)
  on conflict (listing_id, rater_key) do update set stars = excluded.stars, updated_at = now();
  return query select round(avg(r.stars)::numeric, 1), count(*)::int from gc_ratings r where r.listing_id = p_listing;
end $$;

-- The single source of truth for what a plan costs (per month), with or without a code.
create or replace function gc_price(p_plan text, p_code text default null)
returns table (plan text, base int, discount_pct int, amount int, code text, valid boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare v_base int; d gc_discounts%rowtype;
begin
  v_base := case lower(coalesce(p_plan, '')) when 'blue' then 49900 when 'gold' then 129900 else 0 end;
  if p_code is null or btrim(p_code) = '' then
    return query select p_plan, v_base, 0, v_base, null::text, true, null::text; return;
  end if;
  select * into d from gc_discounts where upper(gc_discounts.code) = upper(btrim(p_code));
  if d.code is null then
    return query select p_plan, v_base, 0, v_base, null::text, false, 'That code was not recognised.';
  elsif not d.active then
    return query select p_plan, v_base, 0, v_base, null::text, false, 'That code is no longer active.';
  elsif d.expires_at is not null and d.expires_at < now() then
    return query select p_plan, v_base, 0, v_base, null::text, false, 'That code has expired.';
  elsif d.max_uses is not null and d.used >= d.max_uses then
    return query select p_plan, v_base, 0, v_base, null::text, false, 'That code has been fully redeemed.';
  elsif d.applies_to <> 'any' and d.applies_to <> lower(p_plan) then
    return query select p_plan, v_base, 0, v_base, null::text, false,
                        'That code only applies to ' || initcap(d.applies_to) || ' Verified.';
  elsif v_base = 0 then
    return query select p_plan, v_base, 0, v_base, null::text, false, 'There is nothing to discount on a free listing.';
  else
    return query select p_plan, v_base, d.percent, greatest(0, v_base - round(v_base * d.percent / 100.0)::int),
                        d.code, true, null::text;
  end if;
end $$;

-- counted only once a payment (or a 100% comp) actually completes
create or replace function gc_redeem(p_code text)
returns void language sql security definer set search_path = public as $$
  update gc_discounts set used = used + 1 where upper(code) = upper(btrim(p_code));
$$;

-- New listings arrive only through the submit-listing edge function (Turnstile and
-- badge checked first), which calls this with the service role. Fields are
-- whitelisted: a request cannot set tier, status, sponsored or any check.
create or replace function gc_submit_listing(p jsonb)
returns table (public_id text, name text, email text)
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_pid  text;
  v_desc text := btrim(coalesce(p->>'description', ''));
  v_name text := btrim(coalesce(p->>'name', ''));
  v_mail text := btrim(coalesce(p->>'email', ''));
begin
  if v_name = '' then raise exception 'A business name is required.'; end if;
  if char_length(v_desc) < 50 then raise exception 'The description must be at least 50 characters.'; end if;
  if v_mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'A valid email address is required.'; end if;
  if nullif(btrim(coalesce(p->>'website', '')), '') is null then
    raise exception 'A website is required: every listing displays the Listed on Getclient badge.';
  end if;
  if coalesce((p->>'consent_terms')::boolean, false) is not true
     or coalesce((p->>'consent_review')::boolean, false) is not true then
    raise exception 'Both declarations must be accepted.';
  end if;

  insert into gc_listings (
    name, tagline, description, category, subcategory, city, province, address,
    founded, employees, phone, email, website, contact_name, contact_role, cipc,
    requested_plan, discount_code, docs_complete, consent_terms, consent_review,
    status, tier, sponsored,
    check_identity, check_cipc, check_insurance, check_trading_history, check_reviews
  ) values (
    v_name,
    nullif(btrim(coalesce(p->>'tagline', '')), ''),
    v_desc,
    nullif(p->>'category', ''),
    nullif(btrim(coalesce(p->>'subcategory', '')), ''),
    nullif(p->>'city', ''),
    nullif(p->>'province', ''),
    nullif(btrim(coalesce(p->>'address', '')), ''),
    nullif(p->>'founded', '')::int,
    nullif(p->>'employees', ''),
    btrim(coalesce(p->>'phone', '')),
    v_mail,
    nullif(btrim(coalesce(p->>'website', '')), ''),
    nullif(btrim(coalesce(p->>'contact_name', '')), ''),
    nullif(btrim(coalesce(p->>'contact_role', '')), ''),
    nullif(btrim(coalesce(p->>'cipc', '')), ''),
    coalesce(nullif(p->>'requested_plan', ''), 'basic'),
    nullif(upper(btrim(coalesce(p->>'discount_code', ''))), ''),
    coalesce((p->>'docs_complete')::boolean, false),
    true, true,
    'pending', 'none', false,
    false, false, false, false, false
  )
  returning id, gc_listings.public_id into v_id, v_pid;

  return query select v_pid, v_name, v_mail;
end $$;

-- attach a completed payment to the listing it paid for
create or replace function gc_attach_payment(p_reference text, p_listing text)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan text; v_paid timestamptz;
begin
  update gc_payments set listing_id = p_listing where reference = p_reference and listing_id is null
  returning plan, verified_at into v_plan, v_paid;
  -- if verify-payment already confirmed it, carry the paid plan onto the listing
  if v_paid is not null then
    update gc_listings set paid_plan = v_plan, paid_at = v_paid where public_id = p_listing;
  end if;
end $$;


-- ===================================================================== triggers
drop trigger if exists gc_trg_slug       on gc_listings;
create trigger gc_trg_slug before insert or update on gc_listings for each row execute function gc_set_slug();
drop trigger if exists gc_trg_guard      on gc_listings;
create trigger gc_trg_guard before insert on gc_listings for each row execute function gc_guard_tier();
drop trigger if exists gc_require_badge  on gc_listings;
create trigger gc_require_badge before update of status on gc_listings for each row execute function gc_require_badge();
drop trigger if exists gc_notify_status  on gc_listings;
create trigger gc_notify_status after update of status on gc_listings for each row execute function gc_notify_status();
drop trigger if exists gc_trg_rating     on gc_ratings;
create trigger gc_trg_rating before update on gc_ratings for each row execute function gc_touch_rating();
drop trigger if exists gc_photo_rules    on gc_photos;
create trigger gc_photo_rules before insert on gc_photos for each row execute function gc_photo_rules();


-- ===================================================================== views
-- Views hold no data; they are rebuilt so their columns are always current.
drop view if exists gc_ratings_summary cascade;
create view gc_ratings_summary as
select listing_id, round(avg(stars)::numeric, 1) as avg_rating, count(*)::int as rating_count
from gc_ratings group by listing_id;

-- Everything the public website reads. Only approved listings, and never
-- CIPC numbers, contact names, documents or payment details.
drop view if exists gc_listings_public cascade;
create view gc_listings_public as
select
  l.public_id as id, l.slug, l.name, l.tagline, l.description,
  l.category, c.name as category_name, l.subcategory,
  l.city, loc.name as city_name, l.province, l.address, l.founded, l.employees,
  l.phone, l.email, l.website,
  l.tier,
  case l.tier when 'gold' then 2 when 'blue' then 1 else 0 end as tier_rank,
  -- Gold carries sponsored placement automatically
  (l.tier = 'gold' or (l.sponsored and coalesce(l.sponsored_until, current_date) >= current_date)) as sponsored,
  l.check_identity, l.check_cipc, l.check_insurance, l.check_trading_history, l.check_reviews, l.verified_at,
  lower(l.name || ' ' || coalesce(l.tagline,'') || ' ' || l.description || ' ' || coalesce(l.subcategory,'')) as search_text,
  r.avg_rating, coalesce(r.rating_count, 0) as rating_count,
  (select p.path from gc_photos p where p.listing_id = l.public_id order by p.sort limit 1) as cover_photo,
  -- share of quote requests and job offers the business answered (an expired offer counts as no answer)
  (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where answered) / count(*)) end
     from (select q.responded_at is not null as answered from gc_quotes q where q.business_id = l.public_id
           union all
           select ld.status in ('accepted', 'declined') from gc_leads ld
            where ld.listing_id = l.public_id and ld.status in ('accepted', 'declined', 'expired')) x) as response_rate,
  l.created_at
from gc_listings l
left join gc_categories c      on c.slug = l.category
left join gc_locations  loc    on loc.slug = l.city
left join gc_ratings_summary r on r.listing_id = l.public_id
where l.status = 'approved';

drop view if exists gc_badge_status cascade;
create view gc_badge_status as
select public_id as id, slug, name, tier, status = 'approved' as listed, '/b/' || slug || '/' as url, verified_at
from gc_listings where status = 'approved';

drop view if exists gc_documents_admin cascade;
create view gc_documents_admin as
select d.listing_id, l.name, l.requested_plan, l.status,
       array_agg(d.kind order by d.kind) as kinds, count(*) as n, max(d.uploaded_at) as last_upload
from gc_documents d join gc_listings l on l.public_id = d.listing_id
where d.deleted_at is null
group by d.listing_id, l.name, l.requested_plan, l.status;


-- ===================================================================== storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gc-photos', 'gc-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- PRIVATE: identity documents and tax certificates (POPIA special personal information)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gc-docs', 'gc-docs', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp'];

drop policy if exists "gc photos public read"  on storage.objects;
create policy "gc photos public read"  on storage.objects for select using (bucket_id = 'gc-photos');
drop policy if exists "gc photos upload"       on storage.objects;
create policy "gc photos upload"       on storage.objects for insert with check (bucket_id = 'gc-photos');
drop policy if exists "gc photos admin delete" on storage.objects;
create policy "gc photos admin delete" on storage.objects for delete using (bucket_id = 'gc-photos' and gc_is_admin());
drop policy if exists "gc docs upload"         on storage.objects;
create policy "gc docs upload"         on storage.objects for insert with check (bucket_id = 'gc-docs');
drop policy if exists "gc docs admin read"     on storage.objects;
create policy "gc docs admin read"     on storage.objects for select using (bucket_id = 'gc-docs' and gc_is_admin());
drop policy if exists "gc docs admin delete"   on storage.objects;
create policy "gc docs admin delete"   on storage.objects for delete using (bucket_id = 'gc-docs' and gc_is_admin());


-- ===================================================================== row level security
alter table gc_categories       enable row level security;
alter table gc_locations        enable row level security;
alter table gc_listings         enable row level security;
alter table gc_ratings          enable row level security;
alter table gc_quotes           enable row level security;
alter table gc_photos           enable row level security;
alter table gc_services         enable row level security;
alter table gc_payments         enable row level security;
alter table gc_documents        enable row level security;
alter table gc_discounts        enable row level security;
alter table gc_badge_events     enable row level security;
alter table gc_badge_pings      enable row level security;   -- no policies: no direct access
alter table gc_admins           enable row level security;
alter table gc_private_settings enable row level security;   -- no policies: no direct access
alter table gc_passkeys           enable row level security;   -- no policies: edge function only
alter table gc_passkey_challenges enable row level security; -- no policies: edge function only

-- taxonomy: public read
drop policy if exists gc_read_cats on gc_categories;
create policy gc_read_cats on gc_categories for select using (true);
drop policy if exists gc_read_locs on gc_locations;
create policy gc_read_locs on gc_locations for select using (true);

-- listings: the public reads gc_listings_public; only reviewers read the table.
-- (The old gc_read_approved policy let anyone read CIPC numbers and contact
-- names of approved listings. Removed.)
drop policy if exists gc_read_approved on gc_listings;
drop policy if exists gc_admin_read    on gc_listings;
create policy gc_admin_read   on gc_listings for select using (gc_is_admin());
drop policy if exists gc_submit        on gc_listings;   -- no direct inserts: use submit-listing
drop policy if exists gc_admin_update  on gc_listings;
create policy gc_admin_update on gc_listings for update using (gc_is_admin()) with check (gc_is_admin());
drop policy if exists gc_admin_delete  on gc_listings;
create policy gc_admin_delete on gc_listings for delete using (gc_is_admin());

-- ratings: public read, written only through gc_rate()
drop policy if exists gc_rate_insert on gc_ratings;
drop policy if exists gc_rate_update on gc_ratings;
drop policy if exists gc_rate_read   on gc_ratings;
create policy gc_rate_read   on gc_ratings for select using (true);
drop policy if exists gc_rate_delete on gc_ratings;
create policy gc_rate_delete on gc_ratings for delete using (gc_is_admin());

-- quotes: written only by submit-quote (Turnstile checked); reviewers read them
drop policy if exists gc_quote_insert on gc_quotes;
drop policy if exists gc_quote_read   on gc_quotes;
create policy gc_quote_read   on gc_quotes for select using (gc_is_admin());
drop policy if exists gc_quote_update on gc_quotes;
create policy gc_quote_update on gc_quotes for update using (gc_is_admin()) with check (gc_is_admin());

-- photos: uploaded during an application (tier rules enforced by trigger)
drop policy if exists gc_photo_insert on gc_photos;
create policy gc_photo_insert on gc_photos for insert with check (true);
drop policy if exists gc_photo_read   on gc_photos;
create policy gc_photo_read   on gc_photos for select using (true);
drop policy if exists gc_photo_admin  on gc_photos;
create policy gc_photo_admin  on gc_photos for delete using (gc_is_admin());
drop policy if exists gc_photo_update on gc_photos;
create policy gc_photo_update on gc_photos for update using (gc_is_admin());

-- services: public read for approved Blue and Gold listings; reviewers manage them
drop policy if exists gc_services_read  on gc_services;
create policy gc_services_read  on gc_services for select
  using (exists (select 1 from gc_listings_public p where p.id = listing_id and p.tier in ('gold', 'blue')));
drop policy if exists gc_services_admin on gc_services;
create policy gc_services_admin on gc_services for all using (gc_is_admin()) with check (gc_is_admin());

-- payments: recorded by the checkout, read by reviewers; only verify-payment marks them paid
drop policy if exists gc_pay_insert on gc_payments;
create policy gc_pay_insert on gc_payments for insert with check (true);
drop policy if exists gc_pay_read   on gc_payments;
create policy gc_pay_read   on gc_payments for select using (gc_is_admin());

-- documents: applicants attach, only reviewers read
drop policy if exists gc_doc_insert on gc_documents;
create policy gc_doc_insert on gc_documents for insert with check (true);
drop policy if exists gc_doc_read   on gc_documents;
create policy gc_doc_read   on gc_documents for select using (gc_is_admin());
drop policy if exists gc_doc_update on gc_documents;
create policy gc_doc_update on gc_documents for update using (gc_is_admin());
drop policy if exists gc_doc_delete on gc_documents;
create policy gc_doc_delete on gc_documents for delete using (gc_is_admin());

-- discount codes: cannot be listed, only redeemed through gc_price()
drop policy if exists gc_disc_admin on gc_discounts;
create policy gc_disc_admin on gc_discounts for all using (gc_is_admin()) with check (gc_is_admin());

-- badge telemetry (legacy table)
drop policy if exists gc_badge_insert on gc_badge_events;
create policy gc_badge_insert on gc_badge_events for insert with check (true);
drop policy if exists gc_badge_read   on gc_badge_events;
create policy gc_badge_read   on gc_badge_events for select using (gc_is_admin());

-- admins: a reviewer reads their own row (no recursion through gc_is_admin)
drop policy if exists gc_admins_read on gc_admins;
create policy gc_admins_read on gc_admins for select using (user_id = auth.uid());


-- ===================================================================== privileges
-- Browser (anon / signed-in) may: read the public views, rate, price, attach a
-- payment, ping the badge, and upload photos / documents / payment records.
-- Quote requests and new listings go only through the edge functions.
grant select on gc_listings_public, gc_badge_status, gc_ratings_summary to anon, authenticated;
grant select on gc_documents_admin to authenticated;

revoke insert on gc_listings from anon, authenticated;
revoke insert on gc_quotes   from anon, authenticated;
grant insert on gc_documents, gc_photos, gc_payments to anon, authenticated;
revoke update on gc_payments from anon, authenticated;
revoke all on gc_private_settings, gc_badge_pings, gc_passkeys, gc_passkey_challenges from anon, authenticated;

revoke all on function gc_is_admin()                    from public;
grant execute on function gc_is_admin()                 to anon, authenticated;
revoke all on function gc_rate(text, int, text)         from public;
grant execute on function gc_rate(text, int, text)      to anon, authenticated;
revoke all on function gc_price(text, text)             from public;
grant execute on function gc_price(text, text)          to anon, authenticated;
revoke all on function gc_attach_payment(text, text)    from public;
grant execute on function gc_attach_payment(text, text) to anon, authenticated;
revoke all on function gc_badge_ping(text)              from public;
grant execute on function gc_badge_ping(text)           to anon, authenticated;
revoke all on function gc_redeem(text)                  from public;
grant execute on function gc_redeem(text)               to service_role;
revoke all on function gc_submit_listing(jsonb)         from public, anon, authenticated;
grant execute on function gc_submit_listing(jsonb)      to service_role;


-- ===================================================================== smart quote matching
-- Sends an event to the gc-mailer edge function (emails, WhatsApp).
create or replace function gc_notify(p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  select value into u from gc_private_settings where key = 'mailer_url';
  select value into s from gc_private_settings where key = 'mailer_hook_secret';
  if u is null then return; end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('event', p_event) || coalesce(p_payload, '{}'::jsonb),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-gc-hook', s)
  );
end $$;

-- 64 hex characters from two random UUIDs; only its hash is ever stored
create or replace function gc_new_token() returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;
create or replace function gc_token_hash(p text) returns text language sql immutable as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;

-- how long a business has to answer before the job moves on
create or replace function gc_offer_window(p_timing text) returns interval language sql immutable as $$
  select case p_timing when 'urgent' then interval '4 hours' when 'week' then interval '24 hours' else interval '48 hours' end;
$$;

-- What a business sees about a lead. The client's contact details only once accepted.
create or replace function gc_lead_view(p_lead uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'lead_id', ld.id, 'status', ld.status, 'nearby', ld.nearby, 'offered_at', ld.offered_at,
    'match', case when ld.relevance >= 0.3 then 'strong' else 'possible' end,
    'expires_at', ld.expires_at, 'responded_at', ld.responded_at,
    'listing_id', l.public_id, 'listing_name', l.name, 'listing_slug', l.slug,
    'job', jsonb_build_object(
      'ref', j.ref, 'service', j.service, 'details', j.details, 'timing', j.timing, 'budget', j.budget,
      'category', c.name, 'city', loc.name, 'status', j.status, 'created_at', j.created_at,
      'client_first_name', split_part(btrim(j.client_name), ' ', 1)),
    'client', case when ld.status = 'accepted'
      then jsonb_build_object('name', j.client_name, 'email', j.client_email, 'phone', j.client_phone) end)
  from gc_leads ld
  join gc_jobs j on j.id = ld.job_id
  join gc_listings l on l.public_id = ld.listing_id
  left join gc_categories c on c.slug = j.category
  left join gc_locations loc on loc.slug = j.city
  where ld.id = p_lead;
$$;

-- Offers a job to the best available businesses until three are offered or have accepted.
--   Eligible: approved Blue or Gold, same category, same town or (when the town runs
--   short) same province, has an email, and not offered this job before.
--   Order:   1. strong match between the job and the business's speciality and services
--            2. same town before nearby   3. Gold before Blue   4. response rate
--            5. rating   6. fewer leads this week (fair spread)   7. stable tiebreak
create or replace function gc_match_job(p_job uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  j gc_jobs; prov text; active int; need int; added int := 0; c record; t text; lid uuid; next_rank int;
begin
  select * into j from gc_jobs where id = p_job for update;
  if not found or j.status = 'closed' then return 0; end if;
  select count(*) into active from gc_leads where job_id = j.id and status in ('offered', 'accepted');
  need := 3 - active;

  if need > 0 then
    select province_slug into prov from gc_locations where slug = j.city;
    select coalesce(max(rank), 0) into next_rank from gc_leads where job_id = j.id;
    for c in
      with svc as (select listing_id, string_agg(name, ' ') as names from gc_services group by listing_id),
      perf as (
        select listing_id,
               count(*) filter (where status in ('accepted', 'declined'))::numeric
                 / nullif(count(*) filter (where status in ('accepted', 'declined', 'expired')), 0) as rr,
               count(*) filter (where offered_at > now() - interval '7 days') as recent
        from gc_leads group by listing_id),
      cand as (
        select l.public_id, (l.city = j.city) as in_city,
               case l.tier when 'gold' then 2 when 'blue' then 1 else 0 end as tier_rank,
               greatest(
                 word_similarity(lower(j.service), lower(coalesce(l.subcategory, '') || ' ' || coalesce(svc.names, '') || ' ' || coalesce(l.tagline, ''))),
                 similarity(lower(j.service), lower(coalesce(l.subcategory, '')))
               )::real as rel,
               coalesce(p.rr, 0.5) as rr, coalesce(p.recent, 0) as recent, r.avg_rating
        from gc_listings l
        join gc_locations loc on loc.slug = l.city
        left join svc on svc.listing_id = l.public_id
        left join perf p on p.listing_id = l.public_id
        left join gc_ratings_summary r on r.listing_id = l.public_id
        where l.status = 'approved' and l.tier in ('gold', 'blue')
          and l.category = j.category
          and (l.city = j.city or loc.province_slug = prov)
          and coalesce(btrim(l.email), '') <> ''
          and not exists (select 1 from gc_leads x where x.job_id = j.id and x.listing_id = l.public_id))
      select * from cand
      -- accuracy: when any business genuinely matches the job, only matching
      -- businesses are offered it. Loose matches are used only when nothing
      -- matches at all, and are shown to the business as a "possible match".
      where rel >= 0.3
         or (not exists (select 1 from cand c2 where c2.rel >= 0.3)
             and not exists (select 1 from gc_leads x where x.job_id = j.id and x.relevance >= 0.3))
      order by (rel >= 0.3) desc, in_city desc, tier_rank desc, rr desc, avg_rating desc nulls last, recent asc,
               md5(j.id::text || public_id)
      limit need
    loop
      t := gc_new_token(); next_rank := next_rank + 1;
      insert into gc_leads (job_id, listing_id, rank, nearby, relevance, token_hash, expires_at)
      values (j.id, c.public_id, next_rank, not c.in_city, c.rel, gc_token_hash(t), now() + gc_offer_window(j.timing))
      returning id into lid;
      perform gc_notify('lead_offered', jsonb_build_object('lead_id', lid, 'token', t));
      added := added + 1;
    end loop;
  end if;

  if exists (select 1 from gc_leads where job_id = j.id and status = 'accepted') then
    update gc_jobs set status = 'matched', updated_at = now() where id = j.id and status <> 'matched';
  elsif not exists (select 1 from gc_leads where job_id = j.id and status = 'offered') then
    if j.status <> 'no_match' then
      update gc_jobs set status = 'no_match', updated_at = now() where id = j.id;
      perform gc_notify('job_no_match', jsonb_build_object('job_id', j.id));
    end if;
  end if;
  return added;
end $$;

-- A business accepts or declines an offer. Returns {ok, error?, lead}.
create or replace function gc_respond_lead(p_lead uuid, p_action text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ld gc_leads; js text;
begin
  if p_action not in ('accept', 'decline') then return jsonb_build_object('ok', false, 'error', 'Unknown action.'); end if;
  select * into ld from gc_leads where id = p_lead for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'This job could not be found.'); end if;
  select status into js from gc_jobs where id = ld.job_id;

  if ld.status = 'accepted' and p_action = 'accept' then
    return jsonb_build_object('ok', true, 'lead', gc_lead_view(ld.id));            -- already accepted
  end if;
  if ld.status <> 'offered' or js = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'This job is no longer available.', 'lead', gc_lead_view(ld.id));
  end if;
  if ld.expires_at < now() then
    update gc_leads set status = 'expired' where id = ld.id;
    perform gc_match_job(ld.job_id);
    return jsonb_build_object('ok', false, 'error', 'This offer expired and was passed to another business.', 'lead', gc_lead_view(ld.id));
  end if;

  if p_action = 'accept' then
    update gc_leads set status = 'accepted', responded_at = now() where id = ld.id;
    update gc_jobs set status = 'matched', updated_at = now() where id = ld.job_id;
    perform gc_notify('lead_accepted', jsonb_build_object('lead_id', ld.id));
  else
    update gc_leads set status = 'declined', responded_at = now(), decline_reason = left(nullif(btrim(p_reason), ''), 200) where id = ld.id;
    perform gc_match_job(ld.job_id);
  end if;
  return jsonb_build_object('ok', true, 'lead', gc_lead_view(ld.id));
end $$;

-- The client closes their job: open offers are withdrawn.
create or replace function gc_close_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update gc_leads set status = 'withdrawn' where job_id = p_job and status = 'offered';
  update gc_jobs set status = 'closed', closed_at = now(), updated_at = now() where id = p_job and status <> 'closed';
end $$;

-- Every 10 minutes: unanswered offers expire and move to the next match;
-- jobs older than 30 days close.
create or replace function gc_lead_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; jid uuid; n int := 0;
begin
  with x as (update gc_leads set status = 'expired' where status = 'offered' and expires_at < now() returning job_id)
  select array_agg(distinct job_id) into ids from x;
  if ids is not null then
    foreach jid in array ids loop n := n + gc_match_job(jid); end loop;
  end if;
  for jid in select id from gc_jobs where status <> 'closed' and created_at < now() - interval '30 days' loop
    perform gc_close_job(jid);
  end loop;
  return n;
end $$;

do $$ begin
  begin
    create extension if not exists pg_cron;
  exception when others then raise notice 'pg_cron is not available here; enable it under Database > Extensions';
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gc-lead-sweep', '*/10 * * * *', 'select public.gc_lead_sweep()');
  end if;
end $$;


-- ===================================================================== business owners
create or replace function gc_is_owner(p_listing text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gc_owners where user_id = auth.uid() and listing_id = p_listing);
$$;

-- Links the signed-in user to every listing whose email they have proved they control.
create or replace function gc_claim_listings() returns setof text
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select lower(btrim(email)) into em from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if em is null then raise exception 'Confirm your email address first.'; end if;
  insert into gc_owners (user_id, listing_id)
    select auth.uid(), public_id from gc_listings
     where lower(btrim(email)) = em and status in ('approved', 'pending')
  on conflict do nothing;
  return query select listing_id from gc_owners where user_id = auth.uid() order by created_at;
end $$;

create or replace function gc_owner_update(p_listing text, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cur gc_listings; v_desc text; v_site text;
begin
  if not gc_is_owner(p_listing) then raise exception 'Not your listing.'; end if;
  select * into cur from gc_listings where public_id = p_listing;
  v_desc := case when p ? 'description' then btrim(p->>'description') else cur.description end;
  if char_length(v_desc) < 50 then raise exception 'The description must be at least 50 characters.'; end if;
  if p ? 'phone' and btrim(p->>'phone') = '' then raise exception 'A phone number is required.'; end if;
  v_site := case when p ? 'website' then nullif(btrim(p->>'website'), '') else cur.website end;
  if v_site is null then raise exception 'A website is required: every listing displays the Getclient badge.'; end if;
  update gc_listings set
    tagline      = case when p ? 'tagline'      then left(nullif(btrim(p->>'tagline'), ''), 120) else tagline end,
    description  = v_desc,
    subcategory  = case when p ? 'subcategory'  then left(nullif(btrim(p->>'subcategory'), ''), 80) else subcategory end,
    address      = case when p ? 'address'      then left(nullif(btrim(p->>'address'), ''), 200) else address end,
    phone        = case when p ? 'phone'        then left(btrim(p->>'phone'), 40) else phone end,
    employees    = case when p ? 'employees'    then left(nullif(btrim(p->>'employees'), ''), 20) else employees end,
    contact_name = case when p ? 'contact_name' then left(nullif(btrim(p->>'contact_name'), ''), 120) else contact_name end,
    contact_role = case when p ? 'contact_role' then left(nullif(btrim(p->>'contact_role'), ''), 80) else contact_role end,
    website      = v_site,
    -- a new website must show the badge again
    badge_verified_at = case when v_site is distinct from cur.website then null else badge_verified_at end,
    badge_url         = case when v_site is distinct from cur.website then null else badge_url end
  where public_id = p_listing;
end $$;

create or replace function gc_owner_set_services(p_listing text, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cap int; t text;
begin
  if not gc_is_owner(p_listing) then raise exception 'Not your listing.'; end if;
  select tier::text into t from gc_listings where public_id = p_listing;
  cap := case t when 'gold' then 12 when 'blue' then 8 else 0 end;
  if cap = 0 then raise exception 'Services are a Blue and Gold feature.'; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > cap then
    raise exception 'Up to % services on your tier.', cap;
  end if;
  delete from gc_services where listing_id = p_listing;
  insert into gc_services (listing_id, name, description, price_from, sort)
  select p_listing, left(btrim(e->>'name'), 80), left(nullif(btrim(e->>'description'), ''), 280),
         left(nullif(btrim(e->>'price_from'), ''), 40), (o - 1)::int
  from jsonb_array_elements(p) with ordinality as x(e, o)
  where char_length(btrim(coalesce(e->>'name', ''))) >= 2;
end $$;

create or replace function gc_owner_delete_photo(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  delete from gc_photos where id = p_id and gc_is_owner(listing_id) returning path into v_path;
  if v_path is null then raise exception 'Not your photo.'; end if;
  return v_path;
end $$;

create or replace function gc_owner_mark_quote(p_id uuid, p_answered boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  update gc_quotes set responded_at = case when p_answered then coalesce(responded_at, now()) end
   where id = p_id and gc_is_owner(business_id);
  if not found then raise exception 'Not your quote request.'; end if;
end $$;

create or replace function gc_owner_leads(p_listing text) returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not gc_is_owner(p_listing) then raise exception 'Not your listing.'; end if;
  return query select gc_lead_view(id) from gc_leads where listing_id = p_listing order by offered_at desc limit 200;
end $$;

create or replace function gc_owner_respond_lead(p_lead uuid, p_action text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lid text;
begin
  select listing_id into lid from gc_leads where id = p_lead;
  if lid is null or not gc_is_owner(lid) then raise exception 'Not your job offer.'; end if;
  return gc_respond_lead(p_lead, p_action, p_reason);
end $$;

-- Last 30 days for the owner's listing, plus the average for each tier in the
-- same category (what the dashboard uses to show what an upgrade would bring).
create or replace function gc_owner_stats(p_listing text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cat text; res jsonb;
begin
  if not gc_is_owner(p_listing) then raise exception 'Not your listing.'; end if;
  select category into cat from gc_listings where public_id = p_listing;
  select jsonb_build_object(
    'views',          (select count(*) from gc_events where listing_id = p_listing and kind = 'view' and day > current_date - 30),
    'badge_clicks',   (select count(*) from gc_events where listing_id = p_listing and kind = 'badge_click' and day > current_date - 30),
    'website_clicks', (select count(*) from gc_events where listing_id = p_listing and kind = 'website_click' and day > current_date - 30),
    'phone_clicks',   (select count(*) from gc_events where listing_id = p_listing and kind in ('phone_click', 'whatsapp_click') and day > current_date - 30),
    'quotes',         (select count(*) from gc_quotes where business_id = p_listing and created_at > now() - interval '30 days'),
    'leads_offered',  (select count(*) from gc_leads where listing_id = p_listing and offered_at > now() - interval '30 days'),
    'leads_accepted', (select count(*) from gc_leads where listing_id = p_listing and status = 'accepted' and offered_at > now() - interval '30 days'),
    'response_rate',  (select response_rate from gc_listings_public where id = p_listing),
    'category_views', (select jsonb_object_agg(tier, avg_views) from (
        select l.tier::text as tier, round(avg(coalesce(v.n, 0)), 1) as avg_views
        from gc_listings l
        left join (select listing_id, count(*) n from gc_events where kind = 'view' and day > current_date - 30 group by listing_id) v
               on v.listing_id = l.public_id
        where l.status = 'approved' and l.category = cat group by l.tier) t)
  ) into res;
  return res;
end $$;

-- Counts a profile view or click once per visitor per day.
create or replace function gc_track(p_listing text, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare h json; v text;
begin
  if p_kind not in ('view', 'badge_click', 'website_click', 'phone_click', 'whatsapp_click') then return; end if;
  if not exists (select 1 from gc_listings where public_id = p_listing and status = 'approved') then return; end if;
  h := coalesce(current_setting('request.headers', true), '{}')::json;
  v := md5(coalesce(h ->> 'x-forwarded-for', h ->> 'cf-connecting-ip', '') || '|' || coalesce(h ->> 'user-agent', ''));
  insert into gc_events (listing_id, kind, visitor) values (p_listing, p_kind, v) on conflict do nothing;
end $$;

-- RLS for the new tables (the browser reaches them only through the functions above)
alter table gc_jobs        enable row level security;
alter table gc_leads       enable row level security;
alter table gc_owners      enable row level security;
alter table gc_events      enable row level security;
alter table gc_wa_sessions enable row level security;
alter table gc_wa_seen     enable row level security;

drop policy if exists gc_jobs_admin   on gc_jobs;
create policy gc_jobs_admin   on gc_jobs   for select using (gc_is_admin());
drop policy if exists gc_leads_admin  on gc_leads;
create policy gc_leads_admin  on gc_leads  for select using (gc_is_admin());
drop policy if exists gc_owners_read  on gc_owners;
create policy gc_owners_read  on gc_owners for select using (user_id = auth.uid() or gc_is_admin());
drop policy if exists gc_events_admin on gc_events;
create policy gc_events_admin on gc_events for select using (gc_is_admin());

-- owners read their own listing (all columns) and the quote requests sent to it
drop policy if exists gc_owner_read   on gc_listings;
create policy gc_owner_read   on gc_listings for select using (gc_is_owner(public_id));
drop policy if exists gc_services_owner on gc_services;
create policy gc_services_owner on gc_services for select using (gc_is_owner(listing_id));
drop policy if exists gc_owner_quotes on gc_quotes;
create policy gc_owner_quotes on gc_quotes   for select using (gc_is_owner(business_id));

revoke all on gc_jobs, gc_leads, gc_events, gc_wa_sessions, gc_wa_seen from anon;
revoke insert, update, delete on gc_jobs, gc_leads, gc_owners, gc_events, gc_wa_sessions, gc_wa_seen from authenticated;
revoke all on gc_wa_sessions, gc_wa_seen from authenticated;
grant select on gc_jobs, gc_leads, gc_owners, gc_events to authenticated;

do $$
declare f text;
begin
  -- server-only (edge functions, cron)
  foreach f in array array['gc_notify(text,jsonb)', 'gc_new_token()', 'gc_lead_view(uuid)', 'gc_match_job(uuid)',
                           'gc_respond_lead(uuid,text,text)', 'gc_close_job(uuid)', 'gc_lead_sweep()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- signed-in owners
  foreach f in array array['gc_claim_listings()', 'gc_owner_update(text,jsonb)',
                           'gc_owner_set_services(text,jsonb)', 'gc_owner_delete_photo(uuid)', 'gc_owner_mark_quote(uuid,boolean)',
                           'gc_owner_leads(text)', 'gc_owner_respond_lead(uuid,text,text)', 'gc_owner_stats(text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- anyone: gc_is_owner is used by row security, and is simply false for the public
  execute 'revoke all on function gc_is_owner(text) from public';
  execute 'grant execute on function gc_is_owner(text) to anon, authenticated, service_role';
  -- anyone (profile views and clicks)
  execute 'revoke all on function gc_track(text,text) from public';
  execute 'grant execute on function gc_track(text,text) to anon, authenticated';
end $$;


-- ===================================================================== after running
-- 1. Copy the mailer secret into the gc-mailer function's MAILER_HOOK_SECRET:
--      select value from gc_private_settings where key = 'mailer_hook_secret';
-- 2. Check that nothing was lost (the numbers should match what you had before):
--      select status, count(*) from gc_listings group by status;
--      select count(*) from gc_listings_public;
--      select (select count(*) from gc_ratings) ratings, (select count(*) from gc_photos) photos,
--             (select count(*) from gc_quotes) quotes, (select count(*) from gc_payments) payments;
-- 3. Make someone a reviewer (their login must already exist in Authentication):
--      insert into gc_admins (user_id, email, role)
--      select id, email, 'owner' from auth.users where email = 'info@getclient.co.za'
--      on conflict (user_id) do nothing;
