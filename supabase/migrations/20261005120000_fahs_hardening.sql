-- طُبق عبر execute_sql بصيغة alter policy؛ والنتيجة مطابقة لهذا الملف
-- تشديد الصلاحيات وتحسين أداء سياسات RLS
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create index if not exists gap_log_request_id_idx on public.gap_log(request_id);

drop policy profiles_own_select on public.profiles;
create policy profiles_own_select on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
drop policy profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy requests_select on public.requests;
create policy requests_select on public.requests for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy requests_insert on public.requests;
create policy requests_insert on public.requests for insert to authenticated with check (user_id = (select auth.uid()) and status = 'submitted');

drop policy reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated using (
  (select public.is_admin()) or (published and exists (select 1 from public.requests r where r.id = request_id and r.user_id = (select auth.uid())))
);

drop policy gap_select on public.gap_log;
create policy gap_select on public.gap_log for select to authenticated using (
  (select public.is_admin()) or exists (select 1 from public.requests r where r.id = request_id and r.user_id = (select auth.uid()))
);
drop policy gap_insert on public.gap_log;
create policy gap_insert on public.gap_log for insert to authenticated with check (
  (select public.is_admin()) or exists (select 1 from public.requests r where r.id = request_id and r.user_id = (select auth.uid()))
);
