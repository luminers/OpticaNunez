import type { Product, ProductVariant } from '@/types/catalog'

/** Se puede probar si tiene modelo 3D propio o la réplica medida del armazón real. */
export function canTryOn(product: Product, variant: ProductVariant) {
  return Boolean(variant.tryOnModelUrl || product.frame)
}
