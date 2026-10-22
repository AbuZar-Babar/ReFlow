-- Enable Row Level Security on the tenant tables and close the membership
-- self-join hole.
--
-- Why the helper functions: the existing "Users can view members of their
-- organizations" policy selects from wf_organization_members inside a policy
-- on wf_organization_members. Once RLS is enabled that policy re-enters
-- itself and Postgres raises "infinite recursion detected in policy".
-- SECURITY DEFINER helpers evaluate the membership lookup as the table owner,
-- which bypasses RLS and breaks the cycle.
--
-- Also fixed here:
--   * wf_organizations had no UPDATE policy, so theme/settings saves would
--     silently stop persisting the moment RLS was switched on.
--   * The membership INSERT policy allowed any authenticated user to add
--     themselves as owner of any org. Self-insert is now limited to orgs that
--     have no members yet (the signup bootstrap), or an owner/admin adding
--     someone.
--   * anon held full CRUD on every table. Revoked.
--   * Four orgs still stored the plaintext runner token in
--     runner_metadata.token. Their runner_token_hash already matches
--     sha256(token), so only the plaintext copy is stripped.

-- 1. Membership helpers -----------------------------------------------------

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wf_organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wf_organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.org_has_members(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wf_organization_members m
    where m.org_id = target_org
  );
$$;

create or replace function public.is_run_visible(target_run uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wf_execution_runs r
    where r.id = target_run
      and public.is_org_member(r.org_id)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.org_has_members(uuid) from public;
revoke all on function public.is_run_visible(uuid) from public;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.org_has_members(uuid) to authenticated;
grant execute on function public.is_run_visible(uuid) to authenticated;

-- 2. wf_organizations -------------------------------------------------------

drop policy if exists "Users can view their organizations" on public.wf_organizations;
drop policy if exists "Users can create organizations" on public.wf_organizations;

create policy "Members can view their organizations"
  on public.wf_organizations
  for select
  to authenticated
  using (public.is_org_member(id));

-- Signup creates the org before the membership row, so this cannot require
-- membership. It does require a real session now that anon is revoked.
create policy "Authenticated users can create organizations"
  on public.wf_organizations
  for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Members can update their organizations"
  on public.wf_organizations
  for update
  to authenticated
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

-- 3. wf_organization_members ------------------------------------------------

drop policy if exists "Admins can add members" on public.wf_organization_members;
drop policy if exists "Users can view members of their organizations" on public.wf_organization_members;

create policy "Members can view org membership"
  on public.wf_organization_members
  for select
  to authenticated
  using (public.is_org_member(org_id) or user_id = auth.uid());

create policy "Bootstrap or admin can add members"
  on public.wf_organization_members
  for insert
  to authenticated
  with check (
    public.is_org_admin(org_id)
    or (user_id = auth.uid() and not public.org_has_members(org_id))
  );

create policy "Admins can update members"
  on public.wf_organization_members
  for update
  to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy "Admins can remove members"
  on public.wf_organization_members
  for delete
  to authenticated
  using (public.is_org_admin(org_id));

-- 4. Workflows, runs, artifacts --------------------------------------------

drop policy if exists "Users can manage workflows in their organization" on public.wf_workflows;
create policy "Members manage workflows"
  on public.wf_workflows
  for all
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "Users can manage runs in their organization" on public.wf_execution_runs;
create policy "Members manage runs"
  on public.wf_execution_runs
  for all
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "Users can manage artifacts in their organization" on public.wf_run_artifacts;
create policy "Members manage artifacts"
  on public.wf_run_artifacts
  for all
  to authenticated
  using (public.is_run_visible(run_id))
  with check (public.is_run_visible(run_id));

-- 5. Remove anonymous access ------------------------------------------------

revoke all on table public.wf_organizations       from anon;
revoke all on table public.wf_organization_members from anon;
revoke all on table public.wf_workflows           from anon;
revoke all on table public.wf_execution_runs      from anon;
revoke all on table public.wf_run_artifacts       from anon;

-- 6. Strip the plaintext runner token --------------------------------------

-- Only rows whose stored hash already matches the plaintext token are
-- touched. Anything else is left for a human to inspect rather than
-- silently breaking a paired runner.
update public.wf_organizations
set runner_metadata = runner_metadata - 'token'
where runner_metadata ? 'token'
  and coalesce(runner_token_hash, '') = encode(sha256(convert_to(runner_metadata->>'token', 'UTF8')), 'hex');

create unique index if not exists wf_organizations_runner_token_hash_key
  on public.wf_organizations (runner_token_hash)
  where runner_token_hash is not null;

-- 7. Turn RLS on ------------------------------------------------------------

alter table public.wf_organizations        enable row level security;
alter table public.wf_organization_members enable row level security;
alter table public.wf_workflows            enable row level security;
alter table public.wf_execution_runs       enable row level security;
alter table public.wf_run_artifacts        enable row level security;
