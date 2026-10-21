<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ColorSwatches from '@/components/catalog/ColorSwatches.vue'
import FrameIllustration, { type FrameView } from '@/components/catalog/FrameIllustration.vue'
import ProductCard from '@/components/catalog/ProductCard.vue'
import {
  CATEGORY_INFO,
  FILTER_GROUPS,
  GENDER_LABELS,
  STORE_PERKS,
  WIDTH_LABELS,
} from '@/data/catalog-labels'
import { getProduct, getRelated } from '@/services/catalog'
import { useFavoritesStore } from '@/stores/favorites'
import type { FaceWidth, FilterKey, Product } from '@/types/catalog'
import { formatPrice } from '@/utils/format'

const props = defineProps<{ slug: string }>()

const route = useRoute()
const router = useRouter()
const favorites = useFavoritesStore()

const product = ref<Product | null>(null)
const related = ref<Product[]>([])
const loading = ref(true)
const loadFailed = ref(false)
let lastRequest = 0

async function load(slug: string) {
  const request = ++lastRequest
  loading.value = true
  loadFailed.value = false
  try {
    const found = await getProduct(slug)
    const others = found ? await getRelated(found) : []
    if (request !== lastRequest) return
    product.value = found
    if (!found) document.title = 'Modelo no encontrado | Óptica Núñez'
    related.value = others
  } catch {
    if (request === lastRequest) loadFailed.value = true
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(() => props.slug, load, { immediate: true })

// Color y ancho arrancan desde la URL (links del catálogo) y se guardan en ella al cambiar.
const variantId = ref('')
const width = ref<FaceWidth>('medio')

watch(product, (p) => {
  if (!p) return
  variantId.value = (p.variants.find((v) => v.id === route.query.color) ?? p.variants[0])!.id
  width.value = (p.sizes.find((s) => s.width === route.query.ancho) ?? p.sizes[0])!.width
  activeSlide.value = 0
  trackEl.value?.scrollTo({ left: 0 })
  guideOpen.value = false
  document.title = `${p.name} | Óptica Núñez`
})

watch([variantId, width], ([color, ancho]) => {
  if (!product.value || !color) return
  if (route.query.color === color && route.query.ancho === ancho) return
  router.replace({ query: { ...route.query, color, ancho } })
})

const variant = computed(
  () => product.value?.variants.find((v) => v.id === variantId.value) ?? product.value?.variants[0],
)
const size = computed(
  () => product.value?.sizes.find((s) => s.width === width.value) ?? product.value?.sizes[0],
)
const category = computed(() => (product.value ? CATEGORY_INFO[product.value.category] : null))
const isFavorite = computed(() => !!product.value && favorites.isFavorite(product.value.id))
const stamp = computed(() =>
  size.value ? `${size.value.lensWidth} □ ${size.value.bridge} ${size.value.templeLength}` : '',
)
const frameWidth = computed(() =>
  size.value ? size.value.lensWidth * 2 + size.value.bridge + 10 : 0,
)

function optionLabel(key: FilterKey, value: string) {
  return FILTER_GROUPS.find((g) => g.key === key)?.options.find((o) => o.value === value)?.label
}

const linkQuery = computed(() => ({ color: variantId.value, ancho: width.value }))
const buyLink = computed(() => ({
  name: 'lentes',
  params: { slug: props.slug },
  query: linkQuery.value,
}))
const tryOnLink = computed(() => ({
  name: 'probador',
  params: { slug: props.slug },
  query: linkQuery.value,
}))

// Galería: una pista con scroll-snap. En celular se desliza con el dedo;
// en escritorio las miniaturas la mueven.
type Slide = { key: string; label: string; view?: FrameView; src?: string }

const slides = computed<Slide[]>(() => {
  const photos = (variant.value?.images ?? []).map((src, i) => ({
    key: src,
    label: `Foto ${i + 1}`,
    src,
  }))
  return [
    ...photos,
    { key: 'frente', label: 'De frente', view: 'frente' as const },
    { key: 'medidas', label: 'Medidas', view: 'medidas' as const },
    { key: 'perfil', label: 'De costado', view: 'perfil' as const },
  ]
})

const trackEl = ref<HTMLElement>()
const activeSlide = ref(0)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function goToSlide(index: number) {
  const track = trackEl.value
  if (!track) return
  activeSlide.value = index
  track.scrollTo({
    left: index * track.clientWidth,
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
  })
}

function onTrackScroll() {
  const track = trackEl.value
  if (track && track.clientWidth)
    activeSlide.value = Math.round(track.scrollLeft / track.clientWidth)
}

function showMeasures() {
  goToSlide(slides.value.findIndex((s) => s.key === 'medidas'))
}

const guideOpen = ref(false)

// Barra fija de compra en celular: aparece cuando el botón principal ya quedó arriba.
// Se calcula en cada scroll (no con IntersectionObserver) porque un salto de scroll
// puede pasar el botón de abajo a arriba sin cruzar el borde y no avisaría.
const ctaEl = ref<HTMLElement>()
const showStickyBar = ref(false)
let frame = 0

function updateStickyBar() {
  frame = 0
  const rect = ctaEl.value?.getBoundingClientRect()
  showStickyBar.value = !!rect && rect.bottom < 0
}

function onWindowScroll() {
  if (!frame) frame = requestAnimationFrame(updateStickyBar)
}

onMounted(() => window.addEventListener('scroll', onWindowScroll, { passive: true }))
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <main class="page">
    <p v-if="loading && !product" class="status">Cargando modelo</p>

    <div v-else-if="loadFailed" class="missing">
      <h1>No pudimos cargar este modelo</h1>
      <p>Revisá tu conexión e intentá de nuevo.</p>
      <button type="button" class="solid-button" @click="load(slug)">Reintentar</button>
    </div>

    <div v-else-if="!product || !variant || !size || !category" class="missing">
      <h1>No encontramos este modelo</h1>
      <p>Puede que ya no esté disponible. Mirá los otros modelos del catálogo.</p>
      <RouterLink to="/anteojos-de-sol" class="solid-button">Ver anteojos de sol</RouterLink>
    </div>

    <template v-else>
      <div class="product">
        <section class="gallery" :aria-label="`Imágenes de ${product.name}`">
          <ul class="thumbs">
            <li v-for="(slide, index) in slides" :key="slide.key">
              <button
                type="button"
                class="thumb"
                :aria-label="`Ver ${slide.label.toLowerCase()}`"
                :aria-current="activeSlide === index"
                @click="goToSlide(index)"
              >
                <img v-if="slide.src" :src="slide.src" alt="" />
                <FrameIllustration
                  v-else
                  :view="slide.view === 'perfil' ? 'perfil' : 'frente'"
                  :shape="product.shape"
                  :material="product.material"
                  :frame-color="variant.frameColor"
                  :lens-tint="variant.lensTint"
                />
                <svg
                  v-if="slide.view === 'medidas'"
                  class="thumb-mark"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m4 15 11-11 5 5-11 11zM8 11l2 2M11 8l2 2" />
                </svg>
              </button>
            </li>
            <li v-if="variant.tryOnModelUrl">
              <RouterLink :to="tryOnLink" class="thumb thumb-try">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"
                  />
                  <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
                </svg>
                Probar
              </RouterLink>
            </li>
          </ul>

          <div class="stage">
            <div class="tools">
              <button
                type="button"
                class="tool"
                aria-label="Ver medidas del armazón"
                @click="showMeasures"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m4 15 11-11 5 5-11 11zM8 11l2 2M11 8l2 2" />
                </svg>
              </button>
              <RouterLink v-if="variant.tryOnModelUrl" :to="tryOnLink" class="try-on">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"
                  />
                  <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
                </svg>
                Probar con la cámara
              </RouterLink>
            </div>

            <div ref="trackEl" class="track" @scroll.passive="onTrackScroll">
              <figure
                v-for="slide in slides"
                :key="slide.key"
                class="slide"
                :class="`slide-${slide.view ?? 'foto'}`"
              >
                <img
                  v-if="slide.src"
                  :src="slide.src"
                  :alt="`${product.name} en ${variant.colorName}`"
                />
                <FrameIllustration
                  v-else
                  :view="slide.view"
                  :shape="product.shape"
                  :material="product.material"
                  :frame-color="variant.frameColor"
                  :lens-tint="variant.lensTint"
                  :measures="size"
                />
                <figcaption v-if="slide.view === 'medidas'" class="stamp-caption">
                  <span class="stamp">{{ stamp }}</span>
                  <span class="stamp-legend">Lente, puente y patilla en milímetros</span>
                </figcaption>
              </figure>
            </div>

            <div class="dots" aria-hidden="true">
              <span
                v-for="(slide, index) in slides"
                :key="slide.key"
                class="dot"
                :class="{ active: activeSlide === index }"
              />
            </div>
          </div>
        </section>

        <section class="panel" aria-labelledby="product-name">
          <nav aria-label="Ruta de navegación" class="breadcrumb">
            <RouterLink to="/">Inicio</RouterLink>
            <span aria-hidden="true">/</span>
            <RouterLink :to="category.path">{{ category.title }}</RouterLink>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{{ product.name }}</span>
          </nav>

          <div class="title-row">
            <h1 id="product-name" class="name">{{ product.name }}</h1>
            <button
              type="button"
              class="favorite"
              :aria-pressed="isFavorite"
              :aria-label="isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'"
              @click="favorites.toggle(product.id)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
                />
              </svg>
            </button>
          </div>
          <p class="price">Desde {{ formatPrice(product.price) }}</p>
          <p class="installments">Pagá en cuotas con Mercado Pago</p>

          <div class="field">
            <p class="field-label">
              Color <span class="field-value">{{ variant.colorName }}</span>
            </p>
            <ColorSwatches
              v-model="variantId"
              :variants="product.variants"
              :product-name="product.name"
            />
          </div>

          <div class="field">
            <div class="field-head">
              <p id="width-label" class="field-label">Ancho</p>
              <button
                type="button"
                class="link-button"
                aria-controls="width-guide"
                :aria-expanded="guideOpen"
                @click="guideOpen = !guideOpen"
              >
                Cómo elegir el ancho
              </button>
            </div>
            <div class="widths" role="radiogroup" aria-labelledby="width-label">
              <label v-for="option in product.sizes" :key="option.width" class="width-option">
                <input
                  v-model="width"
                  class="visually-hidden"
                  type="radio"
                  name="ancho"
                  :value="option.width"
                />
                <span>{{ WIDTH_LABELS[option.width] }}</span>
              </label>
            </div>
            <div v-show="guideOpen" id="width-guide" class="guide">
              <p class="stamp">{{ stamp }}</p>
              <p>
                Buscá estos tres números en la patilla de un anteojo que te quede bien: ancho del
                lente, puente y largo de la patilla, en milímetros. Si los tuyos son parecidos, este
                ancho es para vos.
              </p>
            </div>
          </div>

          <div ref="ctaEl" class="cta">
            <RouterLink :to="buyLink" class="buy">Elegir lentes y comprar</RouterLink>
            <ul class="perks">
              <li v-for="perk in STORE_PERKS" :key="perk">{{ perk }}</li>
            </ul>
          </div>

          <div class="included">
            <h2>Incluido en {{ formatPrice(product.price) }}</h2>
            <ul>
              <li>Armazón {{ product.name }} en {{ variant.colorName.toLowerCase() }}</li>
              <li v-for="item in category.included" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="details">
            <details open>
              <summary>
                Medidas
                <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <dl>
                <div>
                  <dt>Ancho del lente</dt>
                  <dd>{{ size.lensWidth }} mm</dd>
                </div>
                <div>
                  <dt>Puente</dt>
                  <dd>{{ size.bridge }} mm</dd>
                </div>
                <div>
                  <dt>Largo de patilla</dt>
                  <dd>{{ size.templeLength }} mm</dd>
                </div>
                <div>
                  <dt>Alto del lente</dt>
                  <dd>{{ size.lensHeight }} mm</dd>
                </div>
                <div>
                  <dt>Ancho total aproximado</dt>
                  <dd>{{ frameWidth }} mm</dd>
                </div>
              </dl>
            </details>
            <details>
              <summary>
                Material y forma
                <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <dl>
                <div>
                  <dt>Material</dt>
                  <dd>{{ optionLabel('material', product.material) }}</dd>
                </div>
                <div>
                  <dt>Forma</dt>
                  <dd>{{ optionLabel('forma', product.shape) }}</dd>
                </div>
                <div>
                  <dt>Pensado para</dt>
                  <dd>{{ GENDER_LABELS[product.gender] }}</dd>
                </div>
              </dl>
            </details>
            <details>
              <summary>
                Cristales
                <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p>{{ category.lenses }}</p>
            </details>
          </div>
        </section>
      </div>

      <section v-if="related.length" class="related" aria-labelledby="related-title">
        <h2 id="related-title">Otros modelos que te pueden gustar</h2>
        <ul class="related-list">
          <li v-for="item in related" :key="item.id">
            <ProductCard :product="item" />
          </li>
        </ul>
      </section>

      <div class="sticky-bar" :class="{ visible: showStickyBar }" :inert="!showStickyBar">
        <div class="sticky-info">
          <p class="sticky-name">{{ product.name }}</p>
          <p class="sticky-price">Desde {{ formatPrice(product.price) }}</p>
        </div>
        <RouterLink :to="buyLink" class="buy">Elegir lentes</RouterLink>
      </div>
    </template>
  </main>
</template>

<style scoped>
.page {
  padding-bottom: 96px;
}

.status {
  min-height: 60vh;
  padding: 48px var(--gutter);
  color: var(--color-ink-soft);
}

.missing {
  display: grid;
  gap: 12px;
  justify-items: start;
  max-width: 52ch;
  padding: 80px var(--gutter);
}

.missing h1 {
  font-size: var(--step-3);
}

.missing p {
  color: var(--color-ink-soft);
}

.solid-button {
  margin-top: 8px;
  padding: 12px 22px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-ink);
  color: var(--color-paper);
  font-weight: 600;
  text-decoration: none;
}

/* Estructura: galería + panel de compra */
.product {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 440px;
  align-items: start;
}

.gallery {
  position: sticky;
  top: var(--header-height);
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 24px;
  height: min(calc(100vh - var(--header-height)), 760px);
  min-height: 480px;
  padding: 28px 32px 28px var(--gutter);
  background: var(--color-tile);
}

.thumbs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  scrollbar-width: none;
}

.thumb {
  position: relative;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  padding: 8px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-paper);
}

.thumb[aria-current='true'] {
  border-color: var(--color-ink);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.thumb-mark {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
}

.thumb-try {
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  color: var(--color-accent);
}

.thumb-try svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.stage {
  position: relative;
  min-width: 0;
}

.tools {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  display: flex;
  gap: 10px;
}

.tool {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--color-paper);
}

.tool svg,
.try-on svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.try-on {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 20px 0 16px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-weight: 600;
  text-decoration: none;
}

.try-on:hover {
  background: var(--color-accent-strong);
}

.track {
  display: flex;
  height: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.track::-webkit-scrollbar {
  display: none;
}

.slide {
  display: grid;
  flex: 0 0 100%;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  justify-items: center;
  gap: 20px;
  margin: 0;
  padding: 56px 6% 32px;
  scroll-snap-align: center;
}

.slide :deep(.frame) {
  width: min(100%, 620px);
}

.slide-perfil :deep(.frame) {
  width: min(90%, 540px);
}

.slide img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.stamp-caption {
  display: grid;
  justify-items: center;
  gap: 4px;
}

.stamp {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 1.2rem + 1.5vw, 2.4rem);
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.stamp-legend {
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}

.dots {
  display: none;
}

/* Panel de compra */
.panel {
  display: grid;
  gap: 24px;
  padding: 28px var(--gutter) 48px 40px;
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}

.breadcrumb a {
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.breadcrumb [aria-current] {
  color: var(--color-ink);
  font-weight: 500;
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: -16px;
}

.name {
  font-size: var(--step-3);
}

.favorite {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--color-line);
  border-radius: 50%;
  background: var(--color-paper);
}

.favorite svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 1.6;
}

.favorite[aria-pressed='true'] svg {
  fill: var(--color-accent);
  stroke: var(--color-accent);
}

.price {
  margin-bottom: -18px;
  font-size: var(--step-1);
  font-weight: 600;
}

.installments {
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink-soft);
}

.field {
  display: grid;
  gap: 12px;
}

.field-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.field-label {
  font-weight: 600;
}

.field-value {
  margin-left: 6px;
  font-weight: 400;
  color: var(--color-ink-soft);
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  font-size: var(--step--1);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.widths {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.width-option {
  position: relative;
}

.width-option span {
  display: grid;
  place-items: center;
  min-width: 104px;
  height: 48px;
  padding: 0 18px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.width-option input:checked + span {
  border: 1.5px solid var(--color-ink);
}

.width-option input:focus-visible + span {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.guide {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--color-tile);
  font-size: 0.9375rem;
}

.guide .stamp {
  font-size: 1.6rem;
}

.cta {
  display: grid;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--color-line);
}

.buy {
  display: block;
  padding: 15px 20px;
  border-radius: var(--radius-pill);
  background: var(--color-ink);
  color: var(--color-paper);
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}

.buy:hover {
  background: #2c3d3b;
}

.perks {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--step--1);
  font-weight: 500;
  color: var(--color-ink-soft);
}

.included {
  display: grid;
  gap: 10px;
  padding: 20px 22px;
  border-radius: 14px;
  background: var(--color-tile);
}

.included h2 {
  font-size: var(--step-2);
}

.included ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
}

.details details {
  border-top: 1px solid var(--color-line);
}

.details details:last-child {
  border-bottom: 1px solid var(--color-line);
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

.chevron {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  transition: transform 160ms ease;
}

details[open] .chevron {
  transform: rotate(180deg);
}

details > p {
  padding-bottom: 18px;
  color: var(--color-ink-soft);
}

dl {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-bottom: 18px;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

dt {
  color: var(--color-ink-soft);
}

dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Relacionados */
.related {
  display: grid;
  gap: 28px;
  padding: 72px var(--gutter) 0;
}

.related h2 {
  font-size: var(--step-3);
}

.related-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 40px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.related-list > li {
  display: flex;
}

.related-list > li > * {
  flex: 1;
}

.sticky-bar {
  display: none;
}

@media (max-width: 1199px) {
  .product {
    grid-template-columns: minmax(0, 1fr) 380px;
  }

  .panel {
    padding-left: 32px;
  }

  .related-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Celular y tablet: todo en una columna, galería deslizable */
@media (max-width: 899px) {
  .product {
    grid-template-columns: minmax(0, 1fr);
  }

  .gallery {
    position: relative;
    top: 0;
    display: block;
    height: auto;
    min-height: 0;
    padding: 0;
  }

  .thumbs {
    display: none;
  }

  .tools {
    top: 14px;
    right: var(--gutter);
  }

  .track {
    height: auto;
    aspect-ratio: 4 / 3;
    max-height: 70vh;
  }

  .slide {
    padding: 64px var(--gutter) 40px;
  }

  .slide :deep(.frame) {
    width: min(88%, 520px);
  }

  .dots {
    position: absolute;
    bottom: 16px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-ink);
    opacity: 0.2;
  }

  .dot.active {
    opacity: 0.8;
  }

  .panel {
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
    padding: 24px var(--gutter) 32px;
  }

  /* Relacionados: carrusel horizontal de borde a borde */
  .related {
    grid-template-columns: minmax(0, 1fr);
    padding: 48px 0 0;
  }

  .related h2 {
    padding: 0 var(--gutter);
  }

  .related-list {
    position: relative;
    display: flex;
    gap: 16px;
    padding: 0 var(--gutter) 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--gutter);
    scrollbar-width: none;
  }

  .related-list > li {
    flex: 0 0 min(78%, 320px);
    scroll-snap-align: start;
  }

  .sticky-bar {
    position: fixed;
    inset: auto 0 0;
    z-index: 15;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px var(--gutter) calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-line);
    background: var(--color-paper);
    transform: translateY(100%);
    transition: transform 200ms ease;
  }

  .sticky-bar.visible {
    transform: none;
  }

  .sticky-info {
    min-width: 0;
  }

  .sticky-name {
    font-family: var(--font-display);
    font-size: var(--step-1);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sticky-price {
    font-size: var(--step--1);
    color: var(--color-ink-soft);
  }

  .sticky-bar .buy {
    flex: none;
    padding: 12px 22px;
  }
}

@media (max-width: 479px) {
  .try-on {
    height: 40px;
    padding: 0 16px 0 12px;
    font-size: var(--step--1);
  }

  .tool {
    width: 40px;
    height: 40px;
  }

  .track {
    aspect-ratio: 1 / 1;
  }

  .width-option {
    flex: 1;
  }

  .width-option span {
    min-width: 0;
  }
}
</style>
