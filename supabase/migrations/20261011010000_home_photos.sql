-- صور «ما خلف الجدار» في مسقط بيتك: مجلد لكل مستخدم، لا يراه غيره
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('home','home',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy home_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'home' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy home_select_own on storage.objects for select to authenticated
  using (bucket_id = 'home' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy home_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'home' and (storage.foldername(name))[1] = (select auth.uid())::text);
