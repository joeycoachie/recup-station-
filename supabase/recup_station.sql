-- ============================================================================
-- RECUP STATION // SHARED DATABASE (Supabase)
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to run again.
--
-- One table, `runners`: every runner is one row with a member code (RS-XXXX).
-- The Diagnostic (IG link), the roadside iPad and the QR stand all write here;
-- the God Terminal and the booth iPad read it.
--
-- WHO CAN DO WHAT
--   Public pages (anon key)   → create_runner() to add a runner
--                               get_member(code) to open ONE card by its exact code
--   Staff emails (recup_staff) → read / search / update everything
--   Anyone else               → nothing (no phone numbers, no lists)
-- ============================================================================

-- 1. STAFF ---------------------------------------------------------------------
create table if not exists recup_staff (email text primary key);
insert into recup_staff (email) values ('joeytqw@gmail.com') on conflict do nothing;
alter table recup_staff enable row level security;

create or replace function recup_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from recup_staff where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 2. RUNNERS -------------------------------------------------------------------
create table if not exists runners (
  id             text primary key,                 -- made on the device, so offline retries never duplicate
  code           text unique not null,             -- RS-XXXX member code
  ts             timestamptz not null default now(),
  source         text not null check (source in ('DIAGNOSTIC_ONLINE', 'ROADSIDE_IPAD', 'QR_STAND')),
  name           text not null,
  contact_method text not null default 'NONE' check (contact_method in ('WHATSAPP', 'INSTAGRAM', 'EMAIL', 'NONE')),
  phone          text not null default '',
  email          text not null default '',
  instagram      text not null default '',
  region         text not null default '',
  frequency      text not null default '',
  pain           text not null default '',
  archetype      text not null default '',
  knowledge      text not null default '',
  fuel           text not null default '',
  squat          text not null default '',
  grade          text not null default '',
  protocol       text not null default 'N02',
  status         text not null default 'CHECKED_IN',
  cups           int  not null default 0,
  history        jsonb not null default '[]',      -- [{n, ts, product, paid, units}]
  pain_focus     text not null default '',         -- cup 2 question
  referral       text not null default '',         -- cup 3
  goal           text not null default '',         -- cup 4
  wearable       text not null default '',         -- cup 5
  manual_sent    text not null default '',
  campaign       text not null default '',
  notes          text not null default '',
  updated_at     timestamptz not null default now()
);
create index if not exists runners_ts_idx on runners (ts desc);

alter table runners enable row level security;
drop policy if exists "staff all" on runners;
create policy "staff all" on runners for all to authenticated
  using (recup_is_staff()) with check (recup_is_staff());

-- 3. PUBLIC: add a runner --------------------------------------------------------
-- Returns the member code actually stored (a new one if the device's code was taken).
create or replace function create_runner(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(coalesce(p ->> 'code', ''));
  v_existing text;
  a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select code into v_existing from runners where id = p ->> 'id';
  if v_existing is not null then return json_build_object('id', p ->> 'id', 'code', v_existing); end if;

  if length(trim(coalesce(p ->> 'name', ''))) = 0 then raise exception 'Name required'; end if;
  if (p ->> 'contactMethod') = 'WHATSAPP' and length(regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g')) not between 10 and 13 then
    raise exception 'Invalid WhatsApp number';
  end if;

  while v_code !~ '^RS-[A-Z0-9]{4}$' or exists (select 1 from runners where code = v_code) loop
    v_code := 'RS-' || (select string_agg(substr(a, 1 + floor(random() * length(a))::int, 1), '') from generate_series(1, 4));
  end loop;

  insert into runners (id, code, ts, source, name, contact_method, phone, instagram, region, frequency, pain,
                       archetype, knowledge, fuel, squat, grade, protocol, status, campaign)
  values (p ->> 'id', v_code, coalesce((p ->> 'ts')::timestamptz, now()), p ->> 'source', left(trim(p ->> 'name'), 80),
          coalesce(p ->> 'contactMethod', 'NONE'),
          regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g'), left(coalesce(p ->> 'instagram', ''), 40),
          coalesce(p ->> 'region', ''), coalesce(p ->> 'frequency', ''), coalesce(p ->> 'pain', ''),
          coalesce(p ->> 'archetype', ''), coalesce(p ->> 'knowledge', ''), coalesce(p ->> 'fuel', ''),
          coalesce(p ->> 'squat', ''), coalesce(p ->> 'grade', ''), coalesce(p ->> 'protocol', 'N02'),
          case when p ->> 'source' = 'DIAGNOSTIC_ONLINE' then 'RESERVED' else 'CHECKED_IN' end,
          left(coalesce(p ->> 'campaign', ''), 60));
  return json_build_object('id', p ->> 'id', 'code', v_code);
end $$;

-- 4. PUBLIC: open ONE member card by its exact code (no phone / contact details) --
create or replace function get_member(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', id, 'code', code, 'name', split_part(name, ' ', 1), 'protocol', protocol, 'grade', grade,
    'squat', squat, 'archetype', archetype, 'status', status, 'cups', cups, 'history', history,
    'source', source, 'ts', ts)
  from runners where code = upper(trim(p_code));
$$;

revoke all on function create_runner(jsonb) from public;
revoke all on function get_member(text) from public;
grant execute on function create_runner(jsonb), get_member(text) to anon, authenticated;

-- ============================================================================
-- 5. CUP CLAIMS (added 2026-09-30) — runner taps "CLAIM CUP N" on their card,
--    staff tap ✓ on the God Terminal / booth iPad after pouring. Safe to re-run.
-- ============================================================================
create table if not exists cup_claims (
  id          uuid primary key default gen_random_uuid(),
  runner_id   text not null references runners(id) on delete cascade,
  code        text not null,
  cup_no      int  not null,
  product     text not null default 'N02',
  answers     jsonb not null default '{}',
  status      text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  paid        numeric(6,2),
  staff_email text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create unique index if not exists cup_claims_one_pending on cup_claims (runner_id) where status = 'PENDING';
create index if not exists cup_claims_created_idx on cup_claims (created_at desc);

alter table cup_claims enable row level security;
drop policy if exists "staff all" on cup_claims;
create policy "staff all" on cup_claims for all to authenticated
  using (recup_is_staff()) with check (recup_is_staff());

-- PUBLIC: claim the next cup by member code. One pending claim per runner;
-- claiming again just updates the drink / answers on the pending one.
create or replace function claim_cup(p_code text, p_product text, p_answers jsonb default '{}') returns json
language plpgsql security definer set search_path = public as $$
declare r runners%rowtype; c cup_claims%rowtype;
begin
  select * into r from runners where code = upper(trim(p_code));
  if r.id is null then raise exception 'Member code not found'; end if;
  if p_product not in ('FLUSH', 'N01', 'N02') then raise exception 'Unknown drink'; end if;
  update cup_claims set product = p_product, answers = coalesce(p_answers, '{}'), created_at = now()
    where runner_id = r.id and status = 'PENDING' returning * into c;
  if c.id is null then
    insert into cup_claims (runner_id, code, cup_no, product, answers)
    values (r.id, r.code, r.cups + 1, p_product, coalesce(p_answers, '{}')) returning * into c;
  end if;
  return json_build_object('id', c.id, 'cup_no', c.cup_no, 'status', c.status, 'product', c.product);
end $$;

-- PUBLIC: runner can cancel their own pending claim
create or replace function cancel_claim(p_code text) returns void
language sql security definer set search_path = public as $$
  delete from cup_claims where status = 'PENDING' and code = upper(trim(p_code));
$$;

-- get_member now also returns the latest claim from the last 12 hours
create or replace function get_member(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', r.id, 'code', r.code, 'name', split_part(r.name, ' ', 1), 'protocol', r.protocol, 'grade', r.grade,
    'squat', r.squat, 'archetype', r.archetype, 'status', r.status, 'cups', r.cups, 'history', r.history,
    'source', r.source, 'ts', r.ts,
    'claim', (select json_build_object('id', c.id, 'cup_no', c.cup_no, 'status', c.status, 'product', c.product, 'paid', c.paid)
              from cup_claims c where c.runner_id = r.id and c.created_at > now() - interval '12 hours'
              order by c.created_at desc limit 1))
  from runners r where r.code = upper(trim(p_code));
$$;

revoke all on function claim_cup(text, text, jsonb) from public;
revoke all on function cancel_claim(text) from public;
revoke all on function get_member(text) from public;
grant execute on function claim_cup(text, text, jsonb), cancel_claim(text), get_member(text) to anon, authenticated;
