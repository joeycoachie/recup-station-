-- Consent (Malaysia PDPA), 20 Oct 2026. Run once in the RECUP.STN Supabase project → SQL Editor.
-- Safe to run twice. Until it runs, check-ins still work: the extra fields are simply not stored.
--
-- Stores, per runner: which consent wording they ticked, when, the host studio (?host= on the
-- check-in link) and whether they agreed to share their results with that host.

alter table runners add column if not exists consent_version text not null default '';
alter table runners add column if not exists consent_at timestamptz;
alter table runners add column if not exists host text not null default '';
alter table runners add column if not exists share_with_host boolean not null default false;

-- Same as recup_station.sql §3, plus the four consent fields.
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
                       archetype, knowledge, fuel, squat, grade, protocol, status, campaign,
                       consent_version, consent_at, host, share_with_host)
  values (p ->> 'id', v_code, coalesce((p ->> 'ts')::timestamptz, now()), p ->> 'source', left(trim(p ->> 'name'), 80),
          coalesce(p ->> 'contactMethod', 'NONE'),
          regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g'), left(coalesce(p ->> 'instagram', ''), 40),
          coalesce(p ->> 'region', ''), coalesce(p ->> 'frequency', ''), coalesce(p ->> 'pain', ''),
          coalesce(p ->> 'archetype', ''), coalesce(p ->> 'knowledge', ''), coalesce(p ->> 'fuel', ''),
          coalesce(p ->> 'squat', ''), coalesce(p ->> 'grade', ''), coalesce(p ->> 'protocol', 'N02'),
          case when p ->> 'source' = 'DIAGNOSTIC_ONLINE' then 'RESERVED' else 'CHECKED_IN' end,
          left(coalesce(p ->> 'campaign', ''), 60),
          left(coalesce(p ->> 'consentVersion', ''), 30),
          nullif(p ->> 'consentAt', '')::timestamptz,
          left(coalesce(p ->> 'host', ''), 60),
          coalesce((p ->> 'shareWithHost')::boolean, false));
  return json_build_object('id', p ->> 'id', 'code', v_code);
end $$;

revoke all on function create_runner(jsonb) from public;
grant execute on function create_runner(jsonb) to anon, authenticated;
