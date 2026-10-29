-- Pronorm Estimator — Supabase security-advisor hygiene (2026-10-29)
-- Run once in Supabase → SQL Editor for project eojrpahkbdrbdizgrvew. Safe to re-run.
alter function public.handle_new_user() set search_path = public;
alter function public.is_admin() set search_path = public;
-- handle_new_user is a trigger function; it should not be callable over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
