-- التسجيل بالبريد وكلمة المرور: بيانات التسجيل تصل في user_metadata وتُنقل إلى ملف الحساب
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  root boolean;
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  rr text := m->>'requested_role';
begin
  root := exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email));
  if rr not in ('office','contractor','owner') then rr := null; end if;
  insert into public.profiles(id, email, full_name, office_name, engineer, phone, city, requested_role, registered_at, role, status, reviewed_at)
  values (new.id, new.email,
          left(nullif(trim(m->>'full_name'),''),120),
          left(nullif(trim(m->>'office_name'),''),160),
          case when rr = 'office' then left(nullif(trim(m->>'full_name'),''),120) end,
          left(nullif(trim(m->>'phone'),''),30),
          left(nullif(trim(m->>'city'),''),60),
          rr,
          case when rr is not null then now() end,
          case when root then 'admin' end,
          case when root then 'approved' else 'pending' end,
          case when root then now() end)
  on conflict do nothing;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
