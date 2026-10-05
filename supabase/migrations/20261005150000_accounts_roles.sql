-- دخول واحد للموقع: كل حساب جديد ينتظر اعتماد المشرف، والمشرف يحدد نوعه، والنوع يحدد ما يظهر له
alter table public.profiles
  add column full_name text,
  add column city text,
  add column requested_role text check (requested_role in ('office','contractor','owner')),
  add column role text check (role in ('admin','office','contractor','owner')),
  add column status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  add column registered_at timestamptz,
  add column notified_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid,
  add column review_note text;

-- المشرفون الجذريون معتمدون تلقائياً
update public.profiles p set role = 'admin', status = 'approved', reviewed_at = now()
  where exists (select 1 from public.admin_emails a where lower(a.email) = lower(p.email));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare root boolean;
begin
  root := exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email));
  insert into public.profiles(id, email, role, status, reviewed_at)
  values (new.id, new.email, case when root then 'admin' end, case when root then 'approved' else 'pending' end, case when root then now() end)
  on conflict do nothing;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- نوع الحساب المعتمد للمستخدم الحالي (فارغ إن لم يُعتمد)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'approved';
$$;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_emails a where lower(a.email) = lower(coalesce(auth.jwt()->>'email','')))
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role = 'admin');
$$;

-- المستخدم يعدّل بياناته فقط، لا نوعه ولا حالته
revoke update on public.profiles from authenticated, anon;
grant update (full_name, office_name, engineer, phone, city, requested_role, registered_at) on public.profiles to authenticated;

-- اعتماد الحسابات من المشرف
create or replace function public.admin_review_user(p_id uuid, p_status text, p_role text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('pending','approved','rejected','suspended') then raise exception 'bad_status'; end if;
  if p_status = 'approved' and (p_role is null or p_role not in ('admin','office','contractor','owner')) then raise exception 'role_required'; end if;
  if exists (select 1 from public.profiles p join public.admin_emails a on lower(a.email) = lower(p.email) where p.id = p_id) then raise exception 'root_admin'; end if;
  update public.profiles
     set status = p_status,
         role = case when p_status = 'approved' then p_role else role end,
         reviewed_at = now(), reviewed_by = auth.uid(), review_note = p_note
   where id = p_id;
end; $$;
revoke execute on function public.admin_review_user(uuid, text, text, text) from public, anon;
grant execute on function public.admin_review_user(uuid, text, text, text) to authenticated;

-- طلبات الفحص للمكاتب المعتمدة فقط
alter policy requests_insert on public.requests with check (
  user_id = (select auth.uid()) and status = 'submitted' and (select public.my_role()) in ('office','admin')
);
alter policy plans_insert_own on storage.objects
  with check (bucket_id = 'plans' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.my_role()) in ('office','admin'));
