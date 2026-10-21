-- Catálogo: productos, variantes de color y medidas por ancho.
-- Los valores permitidos coinciden con los tipos de src/types/catalog.ts.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  category text not null check (category in ('sol', 'recetados')),
  -- Pesos enteros, sin centavos.
  price integer not null check (price >= 0),
  shape text not null
    check (shape in ('redondo', 'cuadrado', 'rectangular', 'aviador', 'ojo-de-gato')),
  material text not null check (material in ('acetato', 'metal')),
  gender text not null check (gender in ('mujer', 'hombre', 'unisex')),
  badges text[] not null default '{}' check (badges <@ array['nuevo', 'mas-vendido']),
  featured_rank integer not null default 0,
  -- Los productos inactivos no se muestran en la web pero se conservan para pedidos viejos.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_rank_idx on public.products (category, featured_rank)
  where active;

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- Código de artículo legible; es el que viaja en las URLs (?color=palermo-negro).
  sku text not null unique check (sku ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  color_name text not null,
  color_family text not null check (
    color_family in (
      'negro', 'carey', 'transparente', 'miel', 'dorado', 'plateado', 'verde', 'azul', 'rosa'
    )
  ),
  -- Color CSS del armazón, o 'carey' para el patrón de carey.
  frame_color text not null,
  -- Color del cristal en anteojos de sol; null = lente transparente.
  lens_tint text,
  -- URLs públicas de Supabase Storage, en orden.
  images text[] not null default '{}',
  -- Modelo .glb para el probador virtual; null = no se puede probar.
  try_on_model_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id, position);

-- Medidas en milímetros, las mismas que vienen grabadas en la patilla (52 □ 19 145).
create table public.product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  width text not null check (width in ('angosto', 'medio', 'ancho')),
  lens_width smallint not null check (lens_width between 30 and 80),
  bridge smallint not null check (bridge between 10 and 30),
  temple_length smallint not null check (temple_length between 100 and 170),
  lens_height numeric(4, 1) not null check (lens_height between 20 and 70),
  unique (product_id, width)
);

-- updated_at automático
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Seguridad: la web solo puede leer productos activos. No hay políticas de escritura:
-- la carga del catálogo se hace desde el panel de Supabase o, más adelante, desde el
-- panel de administración con un rol propio.
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_sizes enable row level security;

create policy "Productos activos visibles para todos"
  on public.products for select
  to anon, authenticated
  using (active);

create policy "Variantes de productos activos visibles para todos"
  on public.product_variants for select
  to anon, authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and p.active
  ));

create policy "Medidas de productos activos visibles para todos"
  on public.product_sizes for select
  to anon, authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and p.active
  ));
