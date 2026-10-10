-- إفادة الفحص الفني: ورقة يصدرها المكتب لعميله حين يخلو القسم النظامي من المخالفات المانعة،
-- ويتحقق منها أي أحد برقمها. الحكم يُحسب هنا في الخادم من التقرير المنشور، لا من المتصفح.

-- البنود النظامية التي تدخل الإفادة، مولّدة من refs/rules_v2.json بـ tools/build_ifada_rules.py
create table if not exists public.ifada_rules (
  code text primary key,
  src text not null,
  mand boolean not null default true,
  pending boolean not null default false
);
create table if not exists public.ifada_sources (
  id text primary key,
  title text not null,
  publisher text not null,
  edition text not null,
  ord int not null default 0
);
alter table public.ifada_rules enable row level security;
alter table public.ifada_sources enable row level security;

create table if not exists public.ifada (
  code text primary key,
  request_id uuid not null unique references public.requests(id) on delete cascade,
  project_label text not null check (length(btrim(project_label)) between 3 and 120),
  office_label text not null,
  rev int not null default 1,
  files_fp text not null,
  counts jsonb not null,
  sources jsonb not null,
  out_scope jsonb not null,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null default now()
);
alter table public.ifada enable row level security;
create policy ifada_select on public.ifada for select to authenticated
  using ((select public.is_admin()) or public.can_team_req(request_id));

insert into public.app_settings(key, value) values ('ifada_open', 'false'::jsonb) on conflict (key) do nothing;

-- فحص الأهلية: يحسب الحكم والعدادات من نتائج التقرير المنشور
create or replace function public.ifada_check(rid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d jsonb; res jsonb; r record; x jsonb; v text; sev text;
  ok int := 0; na int := 0; minor int := 0; stop_n int := 0; major_n int := 0; unk_m int := 0; unk_o int := 0;
  pend int := 0; srcs jsonb := '{}'::jsonb; blockers jsonb := '[]'::jsonb; secs jsonb; outs jsonb := '[]'::jsonb;
begin
  select p.data into d from reports p where p.request_id = rid and p.published;
  if d is null then return jsonb_build_object('eligible', false, 'reason', 'not_published'); end if;
  res := coalesce(d->'results', '{}'::jsonb);
  for r in select * from ifada_rules loop
    if r.pending then pend := pend + 1; continue; end if;
    x := res->r.code; v := x->>'v'; sev := coalesce(x->>'sev', 'major');
    if v = 'ok' then ok := ok + 1;
    elsif v = 'na' then na := na + 1;
    elsif v = 'fail' and sev = 'minor' then minor := minor + 1;
    elsif v = 'fail' then
      if sev = 'stop' then stop_n := stop_n + 1; else major_n := major_n + 1; end if;
      blockers := blockers || jsonb_build_object('code', r.code, 'why', 'fail_'||sev);
      continue;
    elsif r.mand then unk_m := unk_m + 1; blockers := blockers || jsonb_build_object('code', r.code, 'why', 'unk'); continue;
    else unk_o := unk_o + 1; continue;
    end if;
    srcs := jsonb_set(srcs, array[r.src], to_jsonb(coalesce((srcs->>r.src)::int, 0) + 1));
  end loop;
  -- بنود إضافية في القسم النظامي كتبها المراجع
  for x in select * from jsonb_array_elements(coalesce(d->'extra', '[]'::jsonb)) loop
    if coalesce((x->>'l')::int, 1) = 1 and x->>'v' = 'fail' and coalesce(x->>'sev','major') in ('stop','major') then
      if x->>'sev' = 'stop' then stop_n := stop_n + 1; else major_n := major_n + 1; end if;
      blockers := blockers || jsonb_build_object('code', x->>'c', 'why', 'fail_'||coalesce(x->>'sev','major'));
    end if;
  end loop;
  secs := coalesce(d->'sections', '["reg","guide","arch"]'::jsonb);
  if secs ? 'guide' then outs := outs || '"الموجهات التصميمية"'::jsonb; end if;
  if secs ? 'arch' then outs := outs || '"جودة التصميم"'::jsonb; end if;
  if secs ? 'eng' then outs := outs || '"الفحص الهندسي للتخصصات"'::jsonb; end if;
  if secs ? 'cons' then outs := outs || '"اتساق اللوحات"'::jsonb; end if;
  return jsonb_build_object(
    'eligible', (secs ? 'reg') and stop_n = 0 and major_n = 0 and unk_m = 0 and (ok + na + minor) > 0,
    'has_reg', secs ? 'reg',
    'counts', jsonb_build_object('checked', ok + na + minor, 'ok', ok, 'na', na, 'minor', minor,
       'stop', stop_n, 'major', major_n, 'unk', unk_m, 'unk_opt', unk_o, 'pending', pend),
    'srcs', srcs, 'out', outs, 'blockers', blockers);
end $$;

-- رقم الإفادة: BB- وثمانية رموز عشوائية بلا حروف ملتبسة، فلا يُخمَّن رقم إفادة أحد
create or replace function public.ifada_code() returns text language plpgsql volatile set search_path = public, extensions as $$
declare a text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; b bytea := extensions.gen_random_bytes(8); s text := ''; i int;
begin
  for i in 0..7 loop s := s || substr(a, (get_byte(b, i) % length(a)) + 1, 1); end loop;
  return 'BB-' || substr(s,1,4) || '-' || substr(s,5,4);
end $$;

create or replace function public.ifada_row(f ifada) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', f.code, 'project', f.project_label, 'office', f.office_label, 'rev', f.rev,
    'fp', f.files_fp, 'counts', f.counts, 'sources', f.sources, 'out', f.out_scope, 'date', to_char(f.issued_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD'),
    'superseded', (select to_char(min(q2.created_at) at time zone 'Asia/Riyadh', 'YYYY-MM-DD') from requests q1 join requests q2
       on q2.project_id = q1.project_id and q2.rev > q1.rev and q2.status <> 'cancelled' where q1.id = f.request_id and q1.project_id is not null));
$$;

-- حالة الإفادة لطلب: هل الميزة مفتوحة لهذا المستخدم، وهل صدرت، وهل يستحقها التقرير
create or replace function public.ifada_get(rid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f ifada; q requests;
begin
  if auth.uid() is null or not (public.can_team_req(rid) or public.is_admin()) then return null; end if;
  select * into f from ifada where request_id = rid;
  select * into q from requests where id = rid;
  return jsonb_build_object(
    'open', public.is_admin() or coalesce((select value = 'true'::jsonb from app_settings where key = 'ifada_open'), false),
    'ifada', case when f.code is null then null else public.ifada_row(f) end,
    'check', public.ifada_check(rid),
    'suggest', btrim(concat_ws(' · ', nullif(q.project->>'type',''), nullif(q.project->>'floors',''),
       nullif(concat_ws('، ', nullif('حي '||nullif(q.project->>'district',''),'حي '), nullif(q.project->>'city','')), ''))));
end $$;

create or replace function public.ifada_issue(rid uuid, label text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb; q requests; f ifada; office text; srcs jsonb; outs jsonb; newcode text; tries int := 0;
begin
  if auth.uid() is null or not public.can_team_req(rid) then raise exception 'not_allowed'; end if;
  if not (public.is_admin() or coalesce((select value = 'true'::jsonb from app_settings where key = 'ifada_open'), false)) then raise exception 'not_open'; end if;
  label := btrim(regexp_replace(coalesce(label,''), '\s+', ' ', 'g'));
  if length(label) < 3 or length(label) > 120 then raise exception 'bad_label'; end if;
  if exists (select 1 from ifada where request_id = rid) then raise exception 'exists'; end if;
  c := public.ifada_check(rid);
  if not (c->>'eligible')::boolean then raise exception 'not_eligible'; end if;
  select * into q from requests where id = rid;
  office := coalesce((select o.name from offices o where o.id = q.office_id), nullif(btrim(q.office_name), ''), 'مكتب هندسي');
  select coalesce(jsonb_agg(jsonb_build_object('title', s.title, 'publisher', s.publisher, 'edition', s.edition, 'n', (c->'srcs'->>s.id)::int) order by s.ord), '[]'::jsonb)
    into srcs from ifada_sources s where c->'srcs' ? s.id;
  outs := c->'out';
  loop
    newcode := public.ifada_code(); tries := tries + 1;
    exit when not exists (select 1 from ifada i where i.code = newcode) or tries > 5;
  end loop;
  insert into ifada(code, request_id, project_label, office_label, rev, files_fp, counts, sources, out_scope, issued_by)
  values (newcode, rid, label, office, coalesce(q.rev, 1),
    upper(substr(md5(q.files::text), 1, 4) || '·' || substr(md5(q.files::text), 5, 4)),
    c->'counts', srcs, outs, auth.uid())
  returning * into f;
  return public.ifada_row(f);
end $$;

-- التحقق العام: يعرض ما طُبع في الإفادة وحالتها فقط
create or replace function public.ifada_verify(c text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when f.code is null then null else public.ifada_row(f) end
  from (select 1) one left join ifada f on f.code = upper(btrim(c));
$$;

revoke all on function public.ifada_check(uuid) from public, anon, authenticated;
revoke all on function public.ifada_code() from public, anon, authenticated;
revoke all on function public.ifada_row(ifada) from public, anon, authenticated;
revoke all on function public.ifada_get(uuid) from public, anon;
revoke all on function public.ifada_issue(uuid, text) from public, anon;
revoke all on function public.ifada_verify(text) from public;
grant execute on function public.ifada_get(uuid) to authenticated;
grant execute on function public.ifada_issue(uuid, text) to authenticated;
grant execute on function public.ifada_verify(text) to anon, authenticated;
grant select on public.ifada to authenticated;
