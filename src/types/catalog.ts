export type FrameShape = 'redondo' | 'cuadrado' | 'rectangular' | 'aviador' | 'ojo-de-gato'
import type { FrameGeometry } from '@/data/frame-geometry'

export type Category = 'sol' | 'recetados'
export type FrameMaterial = 'acetato' | 'metal' | 'inyectado'
export type FrameFinish = 'brillante' | 'semimate' | 'mate'
export type Gender = 'mujer' | 'hombre' | 'unisex'
export type FaceWidth = 'angosto' | 'medio' | 'ancho'
export type Badge = 'nuevo' | 'mas-vendido'
export type ColorFamily =
  'negro' | 'carey' | 'transparente' | 'miel' | 'dorado' | 'plateado' | 'verde' | 'azul' | 'rosa'

export interface ProductVariant {
  id: string
  colorName: string
  colorFamily: ColorFamily
  /** Color CSS del armazón, o 'carey' para el patrón de carey. */
  frameColor: string
  /** Color del cristal en anteojos de sol; sin valor = lente transparente. */
  lensTint?: string
  /** Fotos reales (Supabase Storage). Mientras esté vacío se muestra la ilustración. */
  images: string[]
  /** Modelo .glb para el probador virtual. */
  tryOnModelUrl?: string
  /** Terminación del armazón; sin valor se dibuja brillante. */
  finish?: FrameFinish
}

/**
 * Medidas en milímetros, las mismas que vienen grabadas en la patilla (52 □ 20 145).
 * El probador virtual las usa para mostrar el armazón a escala real.
 */
export interface ProductSize {
  width: FaceWidth
  lensWidth: number
  bridge: number
  templeLength: number
  lensHeight: number
  /** Ancho total del frente medido con calibre (F en la planilla). Sin valor se estima. */
  frontWidth?: number
}

/**
 * Réplica de un armazón real: la forma trazada de su foto de frente
 * (scripts/trazar-armazon.mjs) y las medidas de calibre que no están grabadas.
 */
export interface FrameModel {
  geometry: FrameGeometry
  /** Espesor del frente visto de costado (E). */
  frontDepth: number
  /** Alto de la patilla junto a la bisagra (H). */
  templeHeight: number
  /** Espesor de la patilla. */
  templeThickness: number
}

export interface Product {
  id: string
  slug: string
  name: string
  category: Category
  price: number
  shape: FrameShape
  material: FrameMaterial
  gender: Gender
  /** Anchos en los que se fabrica, del más angosto al más ancho. Nunca vacío. */
  sizes: ProductSize[]
  /** Forma y medidas del armazón real; sin valor se usa la forma genérica de `shape`. */
  frame?: FrameModel
  badges: Badge[]
  featuredRank: number
  createdAt: string
  variants: ProductVariant[]
}

export type FilterKey = 'destacado' | 'genero' | 'forma' | 'material' | 'color' | 'ancho'
export type SortKey = 'destacados' | 'novedades' | 'precio-asc' | 'precio-desc'

export interface FilterGroup {
  key: FilterKey
  label: string
  options: { value: string; label: string }[]
}
