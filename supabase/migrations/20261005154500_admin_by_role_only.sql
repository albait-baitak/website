-- بعد إلغاء تأكيد البريد: لا اعتماد تلقائي لأي بريد. المدير يُعرف بدوره في ملف الحساب فقط،
-- ويُرفع حساب المدير الأول يدوياً من قاعدة البيانات بعد تسجيله.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  rr text := m->>'requested_role';
begin
  if rr not in ('office','contractor','owner') then rr := null; end if;
  insert into public.profiles(id, email, full_name, office_name, engineer, phone, city, requested_role, registered_at, status)
  values (new.id, new.email,
          left(nullif(trim(m->>'full_name'),''),120),
          left(nullif(trim(m->>'office_name'),''),160),
          case when rr = 'office' then left(nullif(trim(m->>'full_name'),''),120) end,
          left(nullif(trim(m->>'phone'),''),30),
          left(nullif(trim(m->>'city'),''),60),
          rr,
          case when rr is not null then now() end,
          'pending')
  on conflict do nothing;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
