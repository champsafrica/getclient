-- Getclient: badge proof, tier rules, automatic emails, Turnstile-gated forms.
--
-- Run this AFTER deploying the edge functions in supabase/functions (see README,
-- "Going live"): it removes the browser's direct write access to quotes and
-- listing submissions, which from now on go through submit-quote and
-- submit-listing so Turnstile is checked on the server.
--
-- Everything here is additive. No existing row is changed or deleted.

create extension if not exists pg_net;
create extension if not exists pgcrypto;

/* ------------------------------------------------------------------ listings */
alter table public.gc_listings
  add column if not exists badge_url          text,
  add column if not exists badge_verified_at  timestamptz,
  add column if not exists badge_check        jsonb,
  add column if not exists reject_reason      text,
  add column if not exists reject_fix         text;

comment on column public.gc_listings.badge_verified_at is
  'When the Listed on Getclient badge was last found on the business website. Required before approval.';

-- Listings already approved before this rule keep their status. Every listing
-- approved from now on must have shown the badge on its website.
create or replace function public.gc_require_badge() returns trigger
language plpgsql as $$
begin
  if new.status = 'approved' and coalesce(old.status, '') <> 'approved'
     and new.badge_verified_at is null then
    raise exception 'badge not verified: the Listed on Getclient badge must be found on % before approval',
      coalesce(new.website, 'the business website')
      using hint = 'Run "Check badge" in the reviewer panel first.';
  end if;
  return new;
end $$;

drop trigger if exists gc_require_badge on public.gc_listings;
create trigger gc_require_badge before update of status on public.gc_listings
  for each row execute function public.gc_require_badge();

/* ------------------------------------------------------------------ services (Blue: 8, Gold: 12) */
create table if not exists public.gc_services (
  id          uuid primary key default gen_random_uuid(),
  listing_id  text not null,                -- gc_listings.public_id
  name        text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 280),
  price_from  text check (char_length(price_from) <= 40),
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists gc_services_listing on public.gc_services (listing_id, sort);
alter table public.gc_services enable row level security;

drop policy if exists gc_services_read on public.gc_services;
create policy gc_services_read on public.gc_services for select
  using (exists (select 1 from public.gc_listings_public p where p.id = listing_id and p.tier in ('gold', 'blue')));
-- Inserts come from submit-listing (service role) or the Supabase dashboard.

insert into public.gc_services (listing_id, name, description, price_from, sort)
select 'gc-000001', s.name, s.descr, s.price, s.n
from (values
  (1, 'Web development', 'Fast, mobile-first websites and online stores that bring in enquiries.', 'From R3,990'),
  (2, 'Domains and hosting', 'Domains, hosting, SSL and business email, looked after.', 'From R150/month'),
  (3, 'Custom software', 'Web apps, portals and dashboards built around your business.', 'Quoted in writing'),
  (4, 'Company registration', 'Your Pty Ltd registered with CIPC, plus SARS registration and annual returns.', 'From R990'),
  (5, 'Startup bundles', 'Registration, website, hosting and growth support, packaged together.', 'From R499/month')
) as s(n, name, descr, price)
where not exists (select 1 from public.gc_services where listing_id = 'gc-000001');

/* ------------------------------------------------------------------ photos: Blue and Gold only */
create or replace function public.gc_photo_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare plan text; n int; cap int;
begin
  select coalesce(nullif(l.tier, 'none'), l.requested_plan, 'basic') into plan
    from public.gc_listings l where l.public_id = new.listing_id;
  cap := case plan when 'gold' then 20 when 'blue' then 6 else 0 end;
  if cap = 0 then
    raise exception 'photos are a Blue and Gold feature';
  end if;
  select count(*) into n from public.gc_photos where listing_id = new.listing_id;
  if n >= cap then
    raise exception 'photo limit reached (% for this tier)', cap;
  end if;
  return new;
end $$;

drop trigger if exists gc_photo_rules on public.gc_photos;
create trigger gc_photo_rules before insert on public.gc_photos
  for each row execute function public.gc_photo_rules();

/* ------------------------------------------------------------------ badge pings */
-- badge.js reports the website it is shown on, so reviewers can see the badge is live.
create table if not exists public.gc_badge_pings (
  domain      text not null,
  listing_id  text not null default '',
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  hits        int not null default 1,
  primary key (domain, listing_id)
);
alter table public.gc_badge_pings enable row level security;   -- no direct access

create or replace function public.gc_badge_ping(p_id text default '') returns void
language plpgsql security definer set search_path = public as $$
declare origin text; dom text;
begin
  origin := coalesce(current_setting('request.headers', true)::json ->> 'origin', '');
  dom := lower(regexp_replace(origin, '^https?://(www\.)?([^/:]+).*$', '\2'));
  if dom = '' or dom = origin or dom in ('getclient.co.za', 'localhost', '127.0.0.1') then return; end if;
  insert into public.gc_badge_pings (domain, listing_id) values (dom, left(coalesce(p_id, ''), 20))
  on conflict (domain, listing_id) do update set last_seen = now(), hits = gc_badge_pings.hits + 1;
end $$;
grant execute on function public.gc_badge_ping(text) to anon, authenticated;

/* ------------------------------------------------------------------ automatic emails */
-- A private settings table the triggers read. Not exposed to the API.
create table if not exists public.gc_private_settings (key text primary key, value text not null);
alter table public.gc_private_settings enable row level security;
revoke all on public.gc_private_settings from anon, authenticated;

insert into public.gc_private_settings (key, value) values
  ('mailer_url', 'https://nfdzcjwncbpsruieaxis.supabase.co/functions/v1/gc-mailer'),
  ('mailer_hook_secret', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;
-- Copy the generated secret into the gc-mailer function's MAILER_HOOK_SECRET:
--   select value from public.gc_private_settings where key = 'mailer_hook_secret';

create or replace function public.gc_notify_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'suspended') then
    select value into u from public.gc_private_settings where key = 'mailer_url';
    select value into s from public.gc_private_settings where key = 'mailer_hook_secret';
    perform net.http_post(
      url := u,
      body := jsonb_build_object('event', 'listing_status', 'public_id', new.public_id,
                                 'status', new.status, 'old_status', old.status),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-gc-hook', s)
    );
  end if;
  return new;
end $$;

drop trigger if exists gc_notify_status on public.gc_listings;
create trigger gc_notify_status after update of status on public.gc_listings
  for each row execute function public.gc_notify_status();

/* ------------------------------------------------------------------ Turnstile-gated writes */
-- Quote requests and new listings now arrive only through the submit-quote and
-- submit-listing edge functions, which verify Turnstile first.
revoke insert on public.gc_quotes from anon, authenticated;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'gc_submit_listing' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
