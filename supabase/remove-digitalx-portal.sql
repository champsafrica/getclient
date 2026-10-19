-- =====================================================================
-- Remove the Digitalx Client Portal from Supabase project nfdzcjwncbpsruieaxis
-- and leave only Getclient. ONE-TIME CLEAN-UP: run it once, then never again.
--
-- PERMANENT. This deletes every portal table and its data (clients, orders,
-- invoices, documents, team, notifications, requests, activity, discounts and
-- anything else not named gc_), the portal's database functions, views and
-- types, its storage policies, and every login that is not a Getclient
-- reviewer. Back up first (see the instructions).
--
-- Kept: every gc_ table, view and function, the gc-photos and gc-docs
-- buckets, Postgres extensions, and the logins listed in gc_admins.
--
-- Run it in TWO PARTS in the Supabase SQL editor:
--   PART 1 (preview, changes nothing): run it, read the list.
--   PART 2 (delete): run it only when the list is right.
-- =====================================================================


-- =====================================================================
-- PART 1: PREVIEW. Read-only. Lists exactly what PART 2 will remove.
-- =====================================================================
with ext as (                       -- objects that belong to extensions are never touched
  select objid from pg_depend where deptype = 'e'
),
targets as (
  select 1 as step, 'view' as kind, c.relname as name,
         format('drop %s if exists public.%I cascade', case c.relkind when 'm' then 'materialized view' else 'view' end, c.relname) as statement
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm') and c.relname not like 'gc\_%'
    and c.oid not in (select objid from ext)
  union all
  select 2, 'table', c.relname, format('drop table if exists public.%I cascade', c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'f') and c.relname not like 'gc\_%'
    and c.oid not in (select objid from ext)
  union all
  select 3, 'function', p.oid::regprocedure::text, format('drop %s if exists %s cascade', case p.prokind when 'p' then 'procedure' else 'function' end, p.oid::regprocedure)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname not like 'gc\_%'
    and p.oid not in (select objid from ext)
  union all
  select 4, 'type', t.typname, format('drop type if exists public.%I cascade', t.typname)
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname not like 'gc\_%' and t.typname not like '\_%'
    and t.typtype in ('e', 'd', 'c') and (t.typrelid = 0 or (select relkind from pg_class where oid = t.typrelid) = 'c')
    and t.oid not in (select objid from ext)
  union all
  select 5, 'sequence', c.relname, format('drop sequence if exists public.%I cascade', c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'S' and c.relname not like 'gc\_%'
    and c.oid not in (select objid from ext)
  union all
  select 6, 'storage policy', pol.policyname, format('drop policy if exists %I on storage.objects', pol.policyname)
  from pg_policies pol
  where pol.schemaname = 'storage' and pol.tablename = 'objects' and pol.policyname not like 'gc %'
  union all
  select 7, 'login trigger', tg.tgname, format('drop trigger if exists %I on auth.users', tg.tgname)
  from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth' and c.relname = 'users' and not tg.tgisinternal and tg.tgname not like 'gc\_%'
)
select step, kind, name, statement from targets
union all
select 8, 'login to delete', u.email, '(deleted in PART 2)'
from auth.users u where u.id not in (select user_id from gc_admins)
union all
select 9, 'storage bucket (delete in dashboard)', b.id, 'Storage > ' || b.id || ' > empty, then delete'
from storage.buckets b where b.id not in ('gc-photos', 'gc-docs')
union all
select 10, 'other schema (check by hand)', s.nspname, 'not removed automatically'
from pg_namespace s
where s.nspname not in ('public', 'auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'realtime', '_realtime',
                        'supabase_functions', 'supabase_migrations', 'vault', 'pgsodium', 'pgsodium_masks', 'net', 'cron',
                        'pgbouncer', '_analytics', 'information_schema', 'pgtle', 'topology', 'tiger', 'tiger_data', 'dbdev')
  and s.nspname not like 'pg\_%'
union all
select 11, 'KEEP: Getclient reviewer login', u.email, 'kept'
from auth.users u where u.id in (select user_id from gc_admins)
order by 1, 3;


-- =====================================================================
-- PART 2: DELETE. Runs as one transaction: if anything goes wrong, or if any
-- Getclient object would be lost, nothing is deleted at all.
-- =====================================================================
do $$
declare
  gc_tables_before int;
  gc_rows_before   bigint;
  gc_tables_after  int;
  r record;
  n int := 0;
begin
  -- 1. only ever run on the Getclient project
  if to_regclass('public.gc_listings') is null or to_regclass('public.gc_admins') is null then
    raise exception 'Stopped: the Getclient tables are not here. Wrong project?';
  end if;
  if not exists (select 1 from gc_admins) then
    raise exception 'Stopped: gc_admins is empty. Add your Getclient reviewer login first, or you will be locked out of /admin/.';
  end if;
  select count(*) into gc_tables_before from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r' and c.relname like 'gc\_%';
  select count(*) into gc_rows_before from gc_listings;

  -- 2. portal views, tables, functions, types, sequences in public
  for r in
    with ext as (select objid from pg_depend where deptype = 'e')
    select 1 as step, format('drop %s if exists public.%I cascade', case c.relkind when 'm' then 'materialized view' else 'view' end, c.relname) as statement
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('v', 'm') and c.relname not like 'gc\_%' and c.oid not in (select objid from ext)
    union all
    select 2, format('drop table if exists public.%I cascade', c.relname)
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('r', 'p', 'f') and c.relname not like 'gc\_%' and c.oid not in (select objid from ext)
    union all
    select 3, format('drop %s if exists %s cascade', case p.prokind when 'p' then 'procedure' else 'function' end, p.oid::regprocedure)
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname not like 'gc\_%' and p.oid not in (select objid from ext)
    union all
    select 4, format('drop type if exists public.%I cascade', t.typname)
    from pg_type t join pg_namespace s on s.oid = t.typnamespace
    where s.nspname = 'public' and t.typname not like 'gc\_%' and t.typname not like '\_%'
      and t.typtype in ('e', 'd', 'c') and (t.typrelid = 0 or (select relkind from pg_class where oid = t.typrelid) = 'c')
      and t.oid not in (select objid from ext)
    union all
    select 5, format('drop sequence if exists public.%I cascade', c.relname)
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'S' and c.relname not like 'gc\_%' and c.oid not in (select objid from ext)
    order by 1
  loop
    execute r.statement; n := n + 1;
  end loop;

  -- 3. portal storage policies and login triggers
  for r in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and policyname not like 'gc %' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname); n := n + 1;
  end loop;
  for r in select tg.tgname from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'auth' and c.relname = 'users' and not tg.tgisinternal and tg.tgname not like 'gc\_%' loop
    execute format('drop trigger if exists %I on auth.users', r.tgname); n := n + 1;
  end loop;

  -- 4. logins that are not Getclient reviewers
  update gc_listings set verified_by = null
   where verified_by is not null and verified_by not in (select user_id from gc_admins);
  delete from auth.users where id not in (select user_id from gc_admins);

  -- 5. prove Getclient is intact, or undo everything
  select count(*) into gc_tables_after from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r' and c.relname like 'gc\_%';
  if gc_tables_after <> gc_tables_before or (select count(*) from gc_listings) <> gc_rows_before
     or to_regclass('public.gc_listings_public') is null or to_regprocedure('public.gc_rate(text,integer,text)') is null
     or to_regprocedure('public.gc_submit_listing(jsonb)') is null or to_regprocedure('public.gc_is_admin()') is null then
    raise exception 'Stopped and undone: a Getclient object would have been lost. Nothing was deleted.';
  end if;
  perform 1 from gc_listings_public limit 1;

  raise notice 'Done: % portal objects removed. Getclient: % tables, % listings, all intact.', n, gc_tables_after, gc_rows_before;
end $$;

-- Afterwards, confirm only Getclient is left (should list gc_ names only):
--   select table_name from information_schema.tables where table_schema = 'public' order by 1;
--   select email from auth.users;
