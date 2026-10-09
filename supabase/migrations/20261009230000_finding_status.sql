-- التقرير التفاعلي للفريق: حالة مشتركة لكل ملاحظة في كل إصدار
create table if not exists public.finding_status (
  request_id uuid not null references public.requests(id) on delete cascade,
  item text not null check (length(item) between 1 and 80),
  status text not null check (status in ('open','doing','fixed','disputed')),
  note text check (note is null or length(note) <= 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (request_id, item)
);
alter table public.finding_status enable row level security;

-- من يرى تقرير هذا الطلب: صاحبه غير الموقوف، أو أي عضو نشط في مكتبه
create or replace function public.can_team_req(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from requests r join reports p on p.request_id = r.id and p.published
    where r.id = rid
      and ((r.user_id = auth.uid() and public.not_disabled())
        or (r.office_id is not null and r.office_id = public.my_office())));
$$;

create policy fs_select on public.finding_status for select to authenticated
  using ((select public.is_admin()) or public.can_team_req(request_id));

-- الكتابة عبر الدالة وحدها، فيُسجَّل الكاتب والوقت من الخادم
create or replace function public.finding_set(rid uuid, it text, st text, nt text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare row finding_status;
begin
  if auth.uid() is null or not public.can_team_req(rid) then raise exception 'not_allowed'; end if;
  if st not in ('open','doing','fixed','disputed') then raise exception 'bad_status'; end if;
  if st = 'disputed' and coalesce(btrim(nt), '') = '' then raise exception 'note_required'; end if;
  insert into finding_status as f (request_id, item, status, note, updated_by, updated_at)
    values (rid, it, st, nullif(btrim(nt), ''), auth.uid(), now())
  on conflict (request_id, item) do update
    set status = excluded.status, note = excluded.note, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  returning * into row;
  return jsonb_build_object('item', row.item, 's', row.status, 'note', row.note, 'at', row.updated_at,
    'by', (select coalesce(p.engineer, p.full_name, p.email) from profiles p where p.id = row.updated_by));
end $$;

-- قراءة حالات إصدار مع اسم من عدّلها
create or replace function public.finding_list(rid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.can_team_req(rid) or public.is_admin() then coalesce(jsonb_agg(jsonb_build_object(
      'item', f.item, 's', f.status, 'note', f.note, 'at', f.updated_at,
      'by', coalesce(p.engineer, p.full_name, p.email))), '[]'::jsonb) end
  from finding_status f left join profiles p on p.id = f.updated_by where f.request_id = rid;
$$;

revoke all on function public.finding_set(uuid,text,text,text) from public, anon;
revoke all on function public.finding_list(uuid) from public, anon;
revoke all on function public.can_team_req(uuid) from public, anon;
grant execute on function public.finding_set(uuid,text,text,text) to authenticated;
grant execute on function public.finding_list(uuid) to authenticated;
grant execute on function public.can_team_req(uuid) to authenticated;
grant select on public.finding_status to authenticated;
