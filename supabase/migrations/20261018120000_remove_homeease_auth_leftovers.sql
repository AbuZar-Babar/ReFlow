-- 2026-10-18: Remove objects accidentally applied from the HomeEase project
-- Situation: HomeEase SQL was pasted into the Reflow project by mistake.
--   - `on_auth_user_created` fired `handle_new_user()`, which inserts into
--     public.profiles / worker_profiles / reviews -- none of which exist in
--     this project. Every new signup failed with "relation does not exist".
--   - `tr_auto_confirm_new_users` duplicated email auto-confirmation via a
--     trigger; auto-confirm is now handled by project auth config
--     (mailer_autoconfirm = true), not by a trigger.
-- Applied live to project oiozlhpogpwlnedzueia on 2026-10-18 (verified:
-- no triggers remain on auth.users; only touch_updated_at remains in public).
-- Idempotent: safe to re-run.

-- HomeEase auth triggers (blocked all new signups)
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists tr_auto_confirm_new_users on auth.users;

-- HomeEase functions (referenced tables that do not exist in this project)
drop function if exists public.handle_new_user();
drop function if exists public.auto_confirm_new_users();
drop function if exists public.sync_worker_rating();

-- public.touch_updated_at() is generic and intentionally kept.
