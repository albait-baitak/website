-- مشرفو المنصة بالبريد
create table public.admin_emails (email text primary key);
insert into public.admin_emails(email) values ('saya7motlaq@gmail.com');

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_emails a where lower(a.email) = lower(coalesce(auth.jwt()->>'email','')));
$$;

-- ملف المكتب
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  office_name text,
  engineer text,
  phone text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- طلبات الفحص
create sequence public.request_seq start 1001;
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default ('FQ-' || to_char(now() at time zone 'Asia/Riyadh','YYYYMMDD') || '-' || nextval('public.request_seq')),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  office_name text not null,
  engineer text not null,
  phone text not null,
  project jsonb not null default '{}'::jsonb,
  files jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in ('submitted','in_review','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.requests(user_id);

-- التقارير
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

-- مسودات التحليل الآلي
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  model text,
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index on public.analysis_runs(request_id);

-- سجل فجوة التصحيح
create table public.gap_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  reviewer_comment text not null,
  caught text check (caught in ('yes','partial','no')),
  rule_code text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- نسخ ملف القواعد
create table public.rulebooks (
  version text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger t_requests_upd before update on public.requests for each row execute function public.touch_updated();
create trigger t_reports_upd before update on public.reports for each row execute function public.touch_updated();

-- RLS
alter table public.admin_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.reports enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.gap_log enable row level security;
alter table public.rulebooks enable row level security;

create policy admin_emails_admin on public.admin_emails for select to authenticated using (public.is_admin());

create policy profiles_own_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy requests_select on public.requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy requests_insert on public.requests for insert to authenticated with check (user_id = auth.uid() and status = 'submitted');
create policy requests_admin_update on public.requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy reports_select on public.reports for select to authenticated using (
  public.is_admin() or (published and exists (select 1 from public.requests r where r.id = request_id and r.user_id = auth.uid()))
);
create policy reports_admin_ins on public.reports for insert to authenticated with check (public.is_admin());
create policy reports_admin_upd on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy runs_admin on public.analysis_runs for select to authenticated using (public.is_admin());

create policy gap_select on public.gap_log for select to authenticated using (
  public.is_admin() or exists (select 1 from public.requests r where r.id = request_id and r.user_id = auth.uid())
);
create policy gap_insert on public.gap_log for insert to authenticated with check (
  public.is_admin() or exists (select 1 from public.requests r where r.id = request_id and r.user_id = auth.uid())
);
create policy gap_admin_upd on public.gap_log for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy rulebooks_read on public.rulebooks for select to authenticated using (true);
create policy rulebooks_admin on public.rulebooks for insert to authenticated with check (public.is_admin());

-- مخزن المخططات الخاص
insert into storage.buckets (id, name, public, file_size_limit)
values ('plans','plans', false, 52428800) on conflict (id) do nothing;

create policy plans_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'plans' and (storage.foldername(name))[1] = auth.uid()::text);
create policy plans_select_own on storage.objects for select to authenticated
  using (bucket_id = 'plans' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy plans_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'plans' and public.is_admin());
