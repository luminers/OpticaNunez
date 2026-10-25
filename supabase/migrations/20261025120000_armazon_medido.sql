-- Armazones reales medidos (planilla de carga): forma trazada de la foto de frente, ancho
-- total medido con calibre, terminación del color y material inyectado (TR90, plástico).

alter table public.products drop constraint products_material_check;
alter table public.products add constraint products_material_check
  check (material in ('acetato', 'metal', 'inyectado'));

-- Réplica del armazón (tipo FrameModel en src/types/catalog.ts): geometry (paths del dibujo,
-- generados con scripts/trazar-armazon.mjs), frontDepth, templeHeight y templeThickness en mm.
-- null = se usa la forma genérica de `shape`.
alter table public.products add column frame_model jsonb
  check (frame_model is null or jsonb_typeof(frame_model) = 'object');

-- Ancho total del frente medido (F); null = se estima con lente, puente y laterales.
alter table public.product_sizes add column front_width numeric(4, 1)
  check (front_width between 100 and 180);

-- Terminación del armazón: el probador 3D cambia el brillo. null = brillante.
alter table public.product_variants add column finish text
  check (finish in ('brillante', 'semimate', 'mate'));
