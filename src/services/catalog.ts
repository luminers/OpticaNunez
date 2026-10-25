import { MOCK_PRODUCTS } from '@/data/mock-products'
import { supabase } from '@/lib/supabase'
import type {
  Badge,
  Category,
  ColorFamily,
  FaceWidth,
  FrameFinish,
  FrameMaterial,
  FrameModel,
  FrameShape,
  Gender,
  Product,
} from '@/types/catalog'

// Lee de Supabase (tablas products + product_variants + product_sizes, ver
// supabase/migrations). Sin credenciales configuradas usa los datos de ejemplo.

const PRODUCT_SELECT = '*, product_variants(*), product_sizes(*)'
const WIDTH_ORDER: FaceWidth[] = ['angosto', 'medio', 'ancho']

interface ProductRow {
  id: string
  slug: string
  name: string
  category: Category
  price: number
  shape: FrameShape
  material: FrameMaterial
  gender: Gender
  badges: Badge[]
  featured_rank: number
  created_at: string
  // jsonb con la forma trazada y las medidas del armazón real (tipo FrameModel).
  frame_model: FrameModel | null
  product_variants: {
    sku: string
    color_name: string
    color_family: ColorFamily
    frame_color: string
    lens_tint: string | null
    images: string[]
    try_on_model_url: string | null
    finish: FrameFinish | null
    position: number
  }[]
  product_sizes: {
    width: FaceWidth
    lens_width: number
    bridge: number
    temple_length: number
    // numeric de Postgres llega como texto.
    lens_height: number | string
    front_width: number | string | null
  }[]
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: row.price,
    shape: row.shape,
    material: row.material,
    gender: row.gender,
    badges: row.badges,
    featuredRank: row.featured_rank,
    createdAt: row.created_at,
    frame: row.frame_model ?? undefined,
    variants: [...row.product_variants]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.sku,
        colorName: v.color_name,
        colorFamily: v.color_family,
        frameColor: v.frame_color,
        lensTint: v.lens_tint ?? undefined,
        images: v.images,
        tryOnModelUrl: v.try_on_model_url ?? undefined,
        finish: v.finish ?? undefined,
      })),
    sizes: [...row.product_sizes]
      .sort((a, b) => WIDTH_ORDER.indexOf(a.width) - WIDTH_ORDER.indexOf(b.width))
      .map((s) => ({
        width: s.width,
        lensWidth: s.lens_width,
        bridge: s.bridge,
        templeLength: s.temple_length,
        lensHeight: Number(s.lens_height),
        frontWidth: s.front_width == null ? undefined : Number(s.front_width),
      })),
  }
}

// Un producto sin variantes o sin medidas rompería la ficha: se descarta.
function isComplete(product: Product) {
  return product.variants.length > 0 && product.sizes.length > 0
}

export async function getCatalog(category: Category): Promise<Product[]> {
  if (!supabase) return MOCK_PRODUCTS.filter((product) => product.category === category)

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('category', category)
    .order('featured_rank')
    .returns<ProductRow[]>()
  if (error) throw error
  return data.map(toProduct).filter(isComplete)
}

/** Los primeros modelos de la categoría según el orden de destacados. */
export async function getFeatured(category: Category, limit = 4): Promise<Product[]> {
  const products = await getCatalog(category)
  return products.sort((a, b) => a.featuredRank - b.featuredRank).slice(0, limit)
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (!supabase) return MOCK_PRODUCTS.find((product) => product.slug === slug) ?? null

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .returns<ProductRow[]>()
    .maybeSingle()
  if (error) throw error
  const product = data ? toProduct(data) : null
  return product && isComplete(product) ? product : null
}

/** Modelos de la misma categoría, primero los de la misma forma. */
export async function getRelated(product: Product, limit = 4): Promise<Product[]> {
  const products = await getCatalog(product.category)
  return products
    .filter((p) => p.id !== product.id)
    .sort(
      (a, b) =>
        Number(b.shape === product.shape) - Number(a.shape === product.shape) ||
        a.featuredRank - b.featuredRank,
    )
    .slice(0, limit)
}
