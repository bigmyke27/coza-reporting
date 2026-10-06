-- COZA Departmental Reporting — database schema for Supabase (free tier).
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: it only creates what is missing and replaces functions/policies.

-- ─── Tables ────────────────────────────────────────────────────────────────

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  head_name text,
  report_types text[] not null default array['sunday','tuesday','dominion','home_training','evangelism','prayer_sat','prayer_sun'],
  created_at timestamptz not null default now()
);

-- One row per login. role: pending (awaiting approval), dept_admin, global_admin.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'pending' check (role in ('pending','dept_admin','global_admin')),
  department_id uuid references departments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  full_name text not null,
  instagram text,
  facebook text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists members_department_idx on members(department_id);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  report_type text not null,
  service_date date not null,
  notes jsonb not null default '{}'::jsonb,       -- text sections, keyed by section
  status text not null default 'draft' check (status in ('draft','submitted')),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (department_id, report_type, service_date)
);
create index if not exists reports_dept_date_idx on reports(department_id, service_date);

-- A member placed in a category of a section. One row per member per section,
-- which is what enforces "a name can only sit in one category".
create table if not exists report_entries (
  report_id uuid not null references reports(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  section text not null,
  category text,            -- null for counts sections
  value numeric,            -- counts sections (e.g. guests)
  remark text,
  primary key (report_id, section, member_id)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  title text not null,
  details text,
  due_date date not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists task_assignments (
  task_id uuid not null references tasks(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  done boolean not null default false,
  done_at timestamptz,
  primary key (task_id, member_id)
);

-- Admins added ahead of sign-up. When someone creates an account with an
-- invited email, they get that role and department straight away.
create table if not exists admin_invites (
  email text primary key check (email = lower(email)),
  full_name text,
  role text not null default 'dept_admin' check (role in ('dept_admin','global_admin')),
  department_id uuid references departments(id) on delete cascade,
  invited_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Columns added after the first release (no-ops on a fresh install).
alter table departments add column if not exists head_name text;

-- ─── Helper functions (security definer so policies can read profiles) ─────

create or replace function is_global_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'global_admin');
$$;

create or replace function can_access_department(dept uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'global_admin' or (role = 'dept_admin' and department_id = dept))
  );
$$;

-- New sign-ups get a pending profile. The very first account becomes global admin.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv admin_invites%rowtype;
begin
  select * into inv from admin_invites where email = lower(new.email);
  insert into profiles (id, email, full_name, role, department_id)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), inv.full_name, split_part(new.email, '@', 1)),
    case
      when inv.email is not null then inv.role
      when exists (select 1 from profiles where role = 'global_admin') then 'pending'
      else 'global_admin'
    end,
    inv.department_id
  );
  if inv.email is not null then
    delete from admin_invites where email = inv.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Save a report and all its entries in one transaction.
create or replace function save_report(p_report jsonb, p_entries jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  rid uuid;
begin
  insert into reports (id, department_id, report_type, service_date, notes, status, updated_at)
  values (
    coalesce((p_report->>'id')::uuid, gen_random_uuid()),
    (p_report->>'department_id')::uuid,
    p_report->>'report_type',
    (p_report->>'service_date')::date,
    coalesce(p_report->'notes', '{}'::jsonb),
    coalesce(p_report->>'status', 'draft'),
    now()
  )
  on conflict (id) do update set
    service_date = excluded.service_date,
    notes = excluded.notes,
    status = excluded.status,
    updated_at = now()
  returning id into rid;

  delete from report_entries where report_id = rid;
  insert into report_entries (report_id, member_id, section, category, value, remark)
  select rid, (e->>'member_id')::uuid, e->>'section', e->>'category',
         nullif(e->>'value','')::numeric, nullif(e->>'remark','')
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) e;

  return rid;
end;
$$;

-- ─── Row-level security ────────────────────────────────────────────────────

alter table departments enable row level security;
alter table profiles enable row level security;
alter table members enable row level security;
alter table reports enable row level security;
alter table report_entries enable row level security;
alter table tasks enable row level security;
alter table task_assignments enable row level security;
alter table admin_invites enable row level security;

drop policy if exists "read departments" on departments;
create policy "read departments" on departments for select to authenticated
  using (is_global_admin() or can_access_department(id));
drop policy if exists "global manages departments" on departments;
create policy "global manages departments" on departments for all to authenticated
  using (is_global_admin()) with check (is_global_admin());

drop policy if exists "read own or all profiles" on profiles;
create policy "read own or all profiles" on profiles for select to authenticated
  using (id = auth.uid() or is_global_admin());
drop policy if exists "global manages profiles" on profiles;
create policy "global manages profiles" on profiles for update to authenticated
  using (is_global_admin()) with check (is_global_admin());
drop policy if exists "global deletes profiles" on profiles;
create policy "global deletes profiles" on profiles for delete to authenticated
  using (is_global_admin() and id <> auth.uid());

drop policy if exists "dept members" on members;
create policy "dept members" on members for all to authenticated
  using (can_access_department(department_id)) with check (can_access_department(department_id));

drop policy if exists "dept reports" on reports;
create policy "dept reports" on reports for all to authenticated
  using (can_access_department(department_id)) with check (can_access_department(department_id));

drop policy if exists "dept report entries" on report_entries;
create policy "dept report entries" on report_entries for all to authenticated
  using (exists (select 1 from reports r where r.id = report_id and can_access_department(r.department_id)))
  with check (exists (select 1 from reports r where r.id = report_id and can_access_department(r.department_id)));

drop policy if exists "dept tasks" on tasks;
create policy "dept tasks" on tasks for all to authenticated
  using (can_access_department(department_id)) with check (can_access_department(department_id));

drop policy if exists "dept task assignments" on task_assignments;
create policy "dept task assignments" on task_assignments for all to authenticated
  using (exists (select 1 from tasks t where t.id = task_id and can_access_department(t.department_id)))
  with check (exists (select 1 from tasks t where t.id = task_id and can_access_department(t.department_id)));

drop policy if exists "global manages invites" on admin_invites;
create policy "global manages invites" on admin_invites for all to authenticated
  using (is_global_admin()) with check (is_global_admin());

-- ─── Starting data ─────────────────────────────────────────────────────────

insert into departments (name) values ('Childcare Guzape') on conflict (name) do nothing;
