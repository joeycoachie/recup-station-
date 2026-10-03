-- RECUP STATION // WIPE TRIAL DATA
-- Deletes EVERY runner, cup claim and Health Bar booking. Cannot be undone.
-- Keeps the tables, functions, security rules and your staff login.
-- Run once in Supabase → SQL Editor, before real runners start.

truncate table cup_claims, healthbar_bookings, runners;

-- Leftover table from the very first terminal version (if it exists)
do $$ begin
  if to_regclass('public.recup_leads') is not null then execute 'truncate table recup_leads'; end if;
end $$;

-- Should show 0 · 0 · 0
select (select count(*) from runners) as runners,
       (select count(*) from cup_claims) as cup_claims,
       (select count(*) from healthbar_bookings) as healthbar_bookings;
