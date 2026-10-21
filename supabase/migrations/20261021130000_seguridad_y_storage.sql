-- Endurecimiento del catálogo y bucket de Storage para fotos y modelos 3D.

-- RLS ya bloquea la escritura (no hay políticas de insert/update/delete), pero además se
-- quitan los permisos: si algún día se agrega una política por error, la web igual no
-- puede escribir. La carga del catálogo se hace con el rol de servicio (panel de Supabase).
revoke insert, update, delete, truncate, references, trigger
  on public.products, public.product_variants, public.product_sizes
  from anon, authenticated;

-- La función del trigger no tiene por qué poder llamarse desde la API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- rls_auto_enable() la crea Supabase: es el event trigger que activa RLS en cada tabla
-- nueva de public. Se conserva, pero sin exponerla por /rest/v1/rpc (el event trigger
-- sigue funcionando: no depende del permiso EXECUTE).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Bucket público de solo lectura: fotos de producto y modelos .glb del probador.
-- Público = se sirve por URL directa (/storage/v1/object/public/catalogo/...). No se crea
-- ninguna política sobre storage.objects, así que la API no permite listar ni subir:
-- los archivos se cargan desde el panel. Las recetas irán en otro bucket, privado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogo',
  'catalogo',
  true,
  20 * 1024 * 1024,
  array['image/webp', 'image/avif', 'image/jpeg', 'image/png', 'model/gltf-binary']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
