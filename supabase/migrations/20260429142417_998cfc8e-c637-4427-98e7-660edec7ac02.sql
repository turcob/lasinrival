insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-cobros',
  'comprobantes-cobros',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.hoja_ruta_cobros
  add column if not exists foto_comprobante_path text,
  add column if not exists foto_comprobante_nombre text;

create policy "Usuarios autenticados pueden ver fotos de cobros"
on storage.objects
for select
to authenticated
using (bucket_id = 'comprobantes-cobros');

create policy "Usuarios autenticados pueden subir fotos de cobros"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'comprobantes-cobros');

create policy "Usuarios autenticados pueden reemplazar fotos de cobros"
on storage.objects
for update
to authenticated
using (bucket_id = 'comprobantes-cobros')
with check (bucket_id = 'comprobantes-cobros');

create policy "Usuarios autenticados pueden borrar fotos de cobros"
on storage.objects
for delete
to authenticated
using (bucket_id = 'comprobantes-cobros');