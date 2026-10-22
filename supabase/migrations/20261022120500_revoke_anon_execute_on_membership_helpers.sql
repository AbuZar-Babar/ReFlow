-- Follow-up to 20261022120000_enable_rls_and_close_member_self_join.
--
-- Revoking EXECUTE from PUBLIC is not enough on Supabase: the anon and
-- authenticated roles also receive explicit grants from the default
-- privileges, so the helper functions stayed callable by anon. They return
-- false for an anonymous caller (auth.uid() is null), but there is no reason
-- to expose them.
--
-- Also pins the search_path of the updated_at trigger function, which was the
-- last "function_search_path_mutable" warning on the project.

revoke all on function public.is_org_member(uuid) from anon;
revoke all on function public.is_org_admin(uuid) from anon;
revoke all on function public.org_has_members(uuid) from anon;
revoke all on function public.is_run_visible(uuid) from anon;

alter function public.touch_updated_at() set search_path = '';
