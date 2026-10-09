-- حساب المكتب: المكتب جهة تملك المشاريع والطلبات والتقارير، وتحته مدير ومهندسون.
-- طُبّق على أربع دفعات (الجداول، الدوال، النقل، قواعد الوصول) بلا حذف: القواعد القديمة عُدّلت بـ alter policy.
-- كل مهندس يرى كل طلبات مكتبه؛ والمدير يدعو ويوقف ويعيد التسمية.

create table if not exists public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.office_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  role text not null check (role in ('manager','engineer')),
  status text not null default 'active' check (status in ('active','disabled')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now()
);
create index if not exists office_members_office on public.office_members(office_id);
create table if not exists public.office_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  office_id uuid not null references public.offices(id) on delete cascade,
  email text not null,
  role text not null default 'engineer' check (role in ('manager','engineer')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists office_invites_office on public.office_invites(office_id);

alter table public.offices enable row level security;
alter table public.office_members enable row level security;
alter table public.office_invites enable row level security;

alter table public.projects add column if not exists office_id uuid references public.offices(id) on delete set null;
alter table public.requests add column if not exists office_id uuid references public.offices(id) on delete set null;
alter table public.boq_requests add column if not exists office_id uuid references public.offices(id) on delete set null;
create index if not exists projects_office on public.projects(office_id);
create index if not exists requests_office on public.requests(office_id);
create index if not exists boq_requests_office on public.boq_requests(office_id);

-- ———— دوال المساعدة
create or replace function public.my_office() returns uuid
language sql stable security definer set search_path = public as $$
  select office_id from public.office_members where user_id = auth.uid() and status = 'active';
$$;
create or replace function public.is_office_mgr() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.office_members where user_id = auth.uid() and status = 'active' and role = 'manager');
$$;
-- العضو الموقوف لا يرى حتى ما رفعه بنفسه: التقارير ملك المكتب
create or replace function public.not_disabled() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.office_members where user_id = auth.uid() and status = 'disabled');
$$;
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p
   where p.id = auth.uid() and p.status = 'approved'
     and not exists (select 1 from public.office_members m where m.user_id = p.id and m.status = 'disabled');
$$;

-- مكتب جديد لمستخدم بلا مكتب، وهو مديره
create or replace function public.ensure_office(p_uid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o uuid; nm text;
begin
  select office_id into o from public.office_members where user_id = p_uid;
  if o is not null then return o; end if;
  select coalesce(nullif(trim(office_name),''), nullif(trim(full_name),''), email) into nm from public.profiles where id = p_uid;
  insert into public.offices(name, created_by) values (coalesce(nm,'مكتب'), p_uid) returning id into o;
  insert into public.office_members(user_id, office_id, role) values (p_uid, o, 'manager');
  return o;
end $$;

-- ———— ملكية المكتب تُضبط في الخادم لا من المتصفح
create or replace function public.set_office_id() returns trigger
language plpgsql security definer set search_path = public as $$
declare po uuid;
begin
  if tg_table_name = 'projects' then
    if auth.uid() is not null then new.office_id := public.my_office(); end if;
  else
    if new.project_id is not null then select office_id into po from public.projects where id = new.project_id; end if;
    if po is not null then new.office_id := po;
    elsif auth.uid() is not null then new.office_id := public.my_office(); end if;
  end if;
  return new;
end $$;
create or replace trigger t_projects_office before insert on public.projects for each row execute function public.set_office_id();
create or replace trigger t_requests_office before insert on public.requests for each row execute function public.set_office_id();
create or replace trigger t_boq_office before insert on public.boq_requests for each row execute function public.set_office_id();
-- لا يُنقل عنصر من مكتب إلى آخر بتحديث
create or replace function public.keep_office_id() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then new.office_id := old.office_id; end if;
  return new;
end $$;
create or replace trigger t_projects_keep_office before update on public.projects for each row execute function public.keep_office_id();

-- اعتماد مكتب أو مصمم ينشئ له مكتبه
create or replace function public.office_on_approve() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and new.role in ('office','designer','admin') then perform public.ensure_office(new.id); end if;
  return new;
end $$;
create or replace trigger t_profile_office after insert or update of status, role on public.profiles for each row execute function public.office_on_approve();

-- ———— نقل الحسابات القائمة: كل حساب مكتب أو مصمم أو صاحب مشاريع صار مدير مكتبه
do $$
declare u uuid;
begin
  for u in
    select id from public.profiles where status = 'approved' and role in ('office','designer','admin')
    union select user_id from public.projects where user_id is not null
    union select user_id from public.requests where user_id is not null
  loop
    perform public.ensure_office(u);
  end loop;
end $$;
update public.projects p set office_id = m.office_id from public.office_members m where m.user_id = p.user_id and p.office_id is null;
update public.requests q set office_id = coalesce((select office_id from public.projects where id = q.project_id), m.office_id) from public.office_members m where m.user_id = q.user_id and q.office_id is null;
update public.boq_requests b set office_id = coalesce((select office_id from public.projects where id = b.project_id), m.office_id) from public.office_members m where m.user_id = b.user_id and b.office_id is null;

-- ———— قواعد الوصول
create policy offices_select on public.offices for select to authenticated using (id = (select public.my_office()) or (select public.is_admin()));
create policy office_members_select on public.office_members for select to authenticated using (office_id = (select public.my_office()) or user_id = (select auth.uid()) or (select public.is_admin()));
create policy office_invites_select on public.office_invites for select to authenticated using (((select public.is_office_mgr()) and office_id = (select public.my_office())) or (select public.is_admin()));

alter policy projects_select on public.projects using (
  (user_id = (select auth.uid()) and (select public.not_disabled())) or office_id = (select public.my_office()) or (select public.is_admin()));
alter policy projects_update on public.projects using (
  (user_id = (select auth.uid()) and (select public.not_disabled())) or office_id = (select public.my_office()) or (select public.is_admin()))
  with check ((user_id = (select auth.uid()) and (select public.not_disabled())) or office_id = (select public.my_office()) or (select public.is_admin()));

alter policy requests_select on public.requests using (
  (user_id = (select auth.uid()) and (select public.not_disabled())) or office_id = (select public.my_office()) or (select public.is_admin()));
alter policy requests_insert on public.requests with check (
  user_id = (select auth.uid()) and status = 'submitted'
  and (select public.my_role()) = any (array['office','designer','admin'])
  and public.under_quota('fahs')
  and (project_id is null or exists (select 1 from public.projects p where p.id = requests.project_id
        and (p.user_id = (select auth.uid()) or p.office_id = (select public.my_office())))));

alter policy reports_select on public.reports using (
  (select public.is_admin()) or (published and exists (select 1 from public.requests r where r.id = reports.request_id
     and ((r.user_id = (select auth.uid()) and (select public.not_disabled())) or r.office_id = (select public.my_office())))));

alter policy boq_req_select on public.boq_requests using (
  (user_id = (select auth.uid()) and (select public.not_disabled())) or office_id = (select public.my_office()) or (select public.is_admin()));
alter policy boq_req_insert on public.boq_requests with check (
  user_id = (select auth.uid()) and status = 'submitted'
  and (select public.my_role()) = any (array['office','designer','admin'])
  and public.under_quota('boq')
  and exists (select 1 from public.requests q join public.projects p on p.id = q.project_id
      where q.id = boq_requests.request_id and (p.user_id = (select auth.uid()) or p.office_id = (select public.my_office()))));

alter policy boq_docs_select on public.boq_docs using (
  (select public.is_admin()) or (published and exists (select 1 from public.boq_requests b where b.id = boq_docs.boq_id
     and ((b.user_id = (select auth.uid()) and (select public.not_disabled())) or b.office_id = (select public.my_office())))));

alter policy gap_insert on public.gap_log with check (
  (select public.is_admin()) or exists (select 1 from public.requests r where r.id = gap_log.request_id
     and ((r.user_id = (select auth.uid()) and (select public.not_disabled())) or r.office_id = (select public.my_office()))));
alter policy gap_select on public.gap_log using (
  (select public.is_admin()) or exists (select 1 from public.requests r where r.id = gap_log.request_id
     and ((r.user_id = (select auth.uid()) and (select public.not_disabled())) or r.office_id = (select public.my_office()))));

alter policy fb_own_insert on public.report_feedback with check (
  user_id = (select auth.uid()) and exists (select 1 from public.requests q where q.id = report_feedback.request_id
     and ((q.user_id = (select auth.uid()) and (select public.not_disabled())) or q.office_id = (select public.my_office()))));

-- حد الاستخدام الشهري للمكتب كله
create or replace function public.under_quota(kind text default 'fahs') returns boolean
language plpgsql stable security definer set search_path = public as $$
declare lim int; used int; m0 timestamptz; o uuid;
begin
  if public.is_admin() then return true; end if;
  m0 := (date_trunc('month', now() at time zone 'Asia/Riyadh')) at time zone 'Asia/Riyadh';
  o := public.my_office();
  if kind = 'boq' then
    select (value)::text::int into lim from public.app_settings where key = 'boq_monthly_limit';
    select count(*) into used from public.boq_requests where created_at >= m0 and (case when o is not null then office_id = o else user_id = auth.uid() end);
    return used < coalesce(lim, 5);
  end if;
  select (value)::text::int into lim from public.app_settings where key = 'monthly_limit';
  select count(*) into used from public.requests where created_at >= m0 and (case when o is not null then office_id = o else user_id = auth.uid() end);
  return used < coalesce(lim, 20);
end $$;

-- ———— واجهة الفريق
create or replace function public.office_team() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o uuid := public.my_office(); mgr boolean := public.is_office_mgr(); res jsonb;
begin
  if o is null then return null; end if;
  select jsonb_build_object(
    'office', (select jsonb_build_object('id', id, 'name', name) from offices where id = o),
    'me', jsonb_build_object('id', auth.uid(), 'role', (select role from office_members where user_id = auth.uid())),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'role', m.role, 'status', m.status, 'joined_at', m.joined_at,
        'name', coalesce(p.engineer, p.full_name, p.email), 'email', p.email, 'phone', case when mgr then p.phone end,
        'reqs', (select count(*) from requests r where r.office_id = o and r.user_id = m.user_id))
        order by m.role desc, m.joined_at)
      from office_members m join profiles p on p.id = m.user_id where m.office_id = o), '[]'::jsonb),
    'invites', case when mgr then coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role, 'token', i.token,
        'created_at', i.created_at, 'expires_at', i.expires_at) order by i.created_at desc)
      from office_invites i where i.office_id = o and i.used_at is null and i.revoked_at is null and i.expires_at > now()), '[]'::jsonb) end
  ) into res;
  return res;
end $$;

create or replace function public.office_invite(p_email text, p_role text default 'engineer') returns jsonb
language plpgsql security definer set search_path = public as $$
declare o uuid := public.my_office(); e text := lower(trim(p_email)); r public.office_invites;
begin
  if not public.is_office_mgr() then raise exception 'not_manager'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if p_role not in ('manager','engineer') then raise exception 'bad_role'; end if;
  if exists (select 1 from office_members m join profiles p on p.id = m.user_id where m.office_id = o and lower(p.email) = e) then raise exception 'already_member'; end if;
  if (select count(*) from office_invites where office_id = o and created_at > now() - interval '1 day') >= 30 then raise exception 'too_many'; end if;
  update office_invites set revoked_at = now() where office_id = o and lower(email) = e and used_at is null and revoked_at is null;
  insert into office_invites(office_id, email, role, created_by) values (o, e, p_role, auth.uid()) returning * into r;
  return jsonb_build_object('id', r.id, 'token', r.token, 'email', r.email, 'expires_at', r.expires_at);
end $$;

create or replace function public.office_invite_revoke(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_office_mgr() then raise exception 'not_manager'; end if;
  update office_invites set revoked_at = now() where id = p_id and office_id = public.my_office() and used_at is null;
end $$;

create or replace function public.office_member_set(p_user uuid, p_status text default null, p_role text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o uuid := public.my_office();
begin
  if not public.is_office_mgr() then raise exception 'not_manager'; end if;
  if p_user = auth.uid() then raise exception 'not_self'; end if;
  if not exists (select 1 from office_members where user_id = p_user and office_id = o) then raise exception 'not_member'; end if;
  if p_status is not null and p_status not in ('active','disabled') then raise exception 'bad_status'; end if;
  if p_role is not null and p_role not in ('manager','engineer') then raise exception 'bad_role'; end if;
  update office_members set status = coalesce(p_status, status), role = coalesce(p_role, role) where user_id = p_user and office_id = o;
end $$;

create or replace function public.office_rename(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare o uuid := public.my_office(); n text := left(nullif(trim(p_name),''), 160);
begin
  if not public.is_office_mgr() then raise exception 'not_manager'; end if;
  if n is null then raise exception 'bad_name'; end if;
  update offices set name = n where id = o;
  update profiles set office_name = n where id in (select user_id from office_members where office_id = o);
end $$;

-- صفحة الدعوة: اسم المكتب والبريد المدعو فقط، لحامل الرابط
create or replace function public.invite_info(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('office', o.name, 'email', i.email, 'role', i.role,
    'valid', i.used_at is null and i.revoked_at is null and i.expires_at > now(), 'used', i.used_at is not null)
  from office_invites i join offices o on o.id = i.office_id where i.token = p_token;
$$;

create or replace function public.accept_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i office_invites; me uuid := auth.uid(); em text; cur office_members; nm text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into i from office_invites where token = p_token for update;
  if i.id is null or i.revoked_at is not null or i.expires_at <= now() then raise exception 'invalid_invite'; end if;
  if i.used_at is not null then
    if i.used_by = me then return jsonb_build_object('ok', true, 'office_id', i.office_id); end if;
    raise exception 'invalid_invite';
  end if;
  select lower(email) into em from auth.users where id = me;
  if em is distinct from lower(i.email) then raise exception 'email_mismatch'; end if;
  select * into cur from office_members where user_id = me;
  if cur.user_id is not null and cur.office_id <> i.office_id then
    if exists (select 1 from office_members where office_id = cur.office_id and user_id <> me and status = 'active') then raise exception 'in_other_team'; end if;
    update office_members set office_id = i.office_id, role = i.role, status = 'active', invited_by = i.created_by, joined_at = now() where user_id = me;
  elsif cur.user_id is null then
    insert into office_members(user_id, office_id, role, invited_by) values (me, i.office_id, i.role, i.created_by);
  else
    update office_members set role = i.role, status = 'active' where user_id = me;
  end if;
  update office_invites set used_by = me, used_at = now() where id = i.id;
  select name into nm from offices where id = i.office_id;
  update profiles set office_name = nm, engineer = coalesce(engineer, full_name),
    requested_role = case when requested_role in ('office','designer') then requested_role else 'office' end,
    role = case when role in ('office','designer','admin') then role else 'office' end,
    status = 'approved', reviewed_at = coalesce(reviewed_at, now()), registered_at = coalesce(registered_at, now())
   where id = me;
  return jsonb_build_object('ok', true, 'office_id', i.office_id, 'office', nm);
end $$;

revoke all on function public.ensure_office(uuid) from public, anon, authenticated;
revoke all on function public.office_team() from public, anon;
revoke all on function public.office_invite(text, text) from public, anon;
revoke all on function public.office_invite_revoke(uuid) from public, anon;
revoke all on function public.office_member_set(uuid, text, text) from public, anon;
revoke all on function public.office_rename(text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.office_team(), public.office_invite(text, text), public.office_invite_revoke(uuid),
  public.office_member_set(uuid, text, text), public.office_rename(text), public.accept_invite(text) to authenticated;
grant execute on function public.invite_info(text) to anon, authenticated;

-- دوال المشغلات لا تُستدعى من الواجهة
revoke execute on function public.set_office_id() from public, anon, authenticated;
revoke execute on function public.office_on_approve() from public, anon, authenticated;
revoke execute on function public.keep_office_id() from public, anon, authenticated;
