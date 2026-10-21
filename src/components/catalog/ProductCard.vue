<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFavoritesStore } from '@/stores/favorites'
import { BADGE_LABELS } from '@/data/catalog-labels'
import { formatPrice } from '@/utils/format'
import type { Product } from '@/types/catalog'
import ColorSwatches from './ColorSwatches.vue'
import FrameIllustration from './FrameIllustration.vue'

const props = defineProps<{
  product: Product
  /** Familias de color filtradas: la tarjeta muestra primero la variante que coincide. */
  preferredColors?: string[]
}>()

const favorites = useFavoritesStore()

function pickVariantId() {
  const preferred = props.product.variants.find((v) =>
    props.preferredColors?.includes(v.colorFamily),
  )
  return (preferred ?? props.product.variants[0])?.id ?? ''
}

const selectedId = ref(pickVariantId())
// Se compara como texto: el array llega nuevo con cada cambio de filtros y no debe
// pisar el color que eligió la persona salvo que cambie el filtro de color.
watch(
  () => props.preferredColors?.join(),
  () => (selectedId.value = pickVariantId()),
)

const variant = computed(
  () => props.product.variants.find((v) => v.id === selectedId.value) ?? props.product.variants[0]!,
)
const isFavorite = computed(() => favorites.isFavorite(props.product.id))
const productLink = computed(() => ({
  name: 'producto',
  params: { slug: props.product.slug },
  query: { color: variant.value.id },
}))
const tryOnLink = computed(() => ({
  name: 'probador',
  params: { slug: props.product.slug },
  query: { color: variant.value.id },
}))
</script>

<template>
  <article class="card">
    <div class="media">
      <RouterLink :to="productLink" class="media-link" tabindex="-1" aria-hidden="true">
        <img
          v-if="variant.images[0]"
          :src="variant.images[0]"
          :alt="`${product.name} en ${variant.colorName}`"
          class="photo"
          loading="lazy"
        />
        <FrameIllustration
          v-else
          class="illustration"
          :shape="product.shape"
          :material="product.material"
          :frame-color="variant.frameColor"
          :lens-tint="variant.lensTint"
        />
      </RouterLink>

      <button
        type="button"
        class="favorite"
        :aria-pressed="isFavorite"
        :aria-label="
          isFavorite
            ? `Quitar ${product.name} de favoritos`
            : `Guardar ${product.name} en favoritos`
        "
        @click="favorites.toggle(product.id)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
          />
        </svg>
      </button>

      <p v-if="product.badges[0]" class="badge">{{ BADGE_LABELS[product.badges[0]] }}</p>

      <RouterLink v-if="variant.tryOnModelUrl" :to="tryOnLink" class="try-on">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"
          />
          <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
        </svg>
        Probar
      </RouterLink>
    </div>

    <div class="info">
      <h3 class="name">
        <RouterLink :to="productLink">{{ product.name }}</RouterLink>
      </h3>
      <p class="price">{{ formatPrice(product.price) }}</p>
    </div>

    <div class="colors">
      <ColorSwatches
        v-model="selectedId"
        :variants="product.variants"
        :product-name="product.name"
      />
      <p class="color-name">{{ variant.colorName }}</p>
    </div>

    <RouterLink :to="productLink" class="buy">Elegir lentes y comprar</RouterLink>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.media {
  position: relative;
  aspect-ratio: 5 / 4;
  border-radius: var(--radius-tile);
  background: var(--color-tile);
}

.media-link {
  display: grid;
  place-items: center;
  height: 100%;
  padding: 12% 11%;
}

.illustration,
.photo {
  width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.favorite {
  position: absolute;
  top: 12px;
  left: 12px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--color-paper);
}

.favorite svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 1.6;
}

.favorite[aria-pressed='true'] svg {
  fill: var(--color-accent);
  stroke: var(--color-accent);
}

.badge {
  position: absolute;
  top: 18px;
  right: 16px;
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--color-ink-soft);
}

.try-on {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px 7px 11px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--step--1);
  font-weight: 600;
  text-decoration: none;
}

.try-on:hover {
  background: var(--color-accent-strong);
}

.try-on svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.info {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
}

.name {
  font-size: 1.75rem;
}

.name a {
  text-decoration: none;
}

.name a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}

.price {
  font-weight: 600;
  white-space: nowrap;
}

.colors {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 2px;
}

.color-name {
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}

.buy {
  display: block;
  margin-top: auto;
  padding: 12px 16px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  text-align: center;
  text-decoration: none;
  font-weight: 500;
}

.buy:hover {
  border-color: var(--color-ink);
}
</style>
