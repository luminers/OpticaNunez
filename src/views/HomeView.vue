<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FrameBlueprint from '@/components/home/FrameBlueprint.vue'
import TryOnIllustration from '@/components/home/TryOnIllustration.vue'
import FrameIllustration from '@/components/catalog/FrameIllustration.vue'
import ProductCard from '@/components/catalog/ProductCard.vue'
import { CATEGORY_INFO } from '@/data/catalog-labels'
import { getCatalog, getFeatured } from '@/services/catalog'
import type { Category, Product } from '@/types/catalog'

const catalogs = ref<Record<Category, Product[]>>({ sol: [], recetados: [] })

// Si falla la carga, la home se sigue viendo: sin plano y sin contadores.
Promise.all([getCatalog('sol'), getCatalog('recetados')])
  .then(([sol, recetados]) => (catalogs.value = { sol, recetados }))
  .catch(() => {})

const featuredCategory = ref<Category>('sol')
const featured = ref<Product[]>([])
let lastRequest = 0

watch(
  featuredCategory,
  async (category) => {
    const request = ++lastRequest
    try {
      const data = await getFeatured(category, 4)
      if (request === lastRequest) featured.value = data
    } catch {
      if (request === lastRequest) featured.value = []
    }
  },
  { immediate: true },
)

const categories = computed(() =>
  (['sol', 'recetados'] as Category[]).map((category) => {
    const products = catalogs.value[category]
    const cover = products[0]
    return {
      category,
      ...CATEGORY_INFO[category],
      cover,
      variant: cover?.variants[0],
      count: products.length,
    }
  }),
)

const CATEGORY_PITCH: Record<Category, string> = {
  sol: 'Filtro UV400 en todos los modelos. También los armamos con tu graduación.',
  recetados: 'Elegí el armazón y cargá tu receta. Los cristales los armamos en el taller.',
}

const BENEFITS = [
  { icon: 'cuotas', text: 'Cuotas sin interés con Mercado Pago' },
  { icon: 'envio', text: 'Envío a domicilio' },
  { icon: 'cambios', text: 'Cambios sin vueltas' },
  { icon: 'obra-social', text: 'Aceptamos obras sociales' },
]

const TRY_ON_STEPS = [
  'Tocá Probar en un modelo y permití el acceso a la cámara.',
  'Medimos tu rostro tomando como referencia el iris, que mide unos 11,7 mm en casi todas las personas.',
  'Ves el armazón sobre tu cara con sus medidas reales y cambiás de color al instante.',
]

const SERVICES = [
  {
    title: 'Examen visual',
    text: 'Pedí turno para controlar tu vista en el local. Si ya tenés receta, la cargás al comprar.',
    link: { label: 'Pedir turno', to: '/turnos' },
  },
  {
    title: 'Obras sociales',
    text: 'Consultá qué te cubre tu obra social en armazones y cristales antes de elegir.',
    link: { label: 'Ver obras sociales', to: '/obras-sociales' },
  },
  {
    title: 'Taller propio',
    text: 'Armamos los cristales en nuestro taller y ajustamos el armazón sin cargo en el local.',
    link: { label: 'Ver anteojos recetados', to: '/anteojos-recetados' },
  },
]
</script>

<template>
  <main class="home">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-text">
        <h1 id="hero-title">Anteojos a tu medida, elegidos desde casa</h1>
        <p class="lead">
          Cada armazón trae tres medidas grabadas en la patilla. Mirá cómo cambian según la forma y
          después probátelos con la cámara, a tamaño real.
        </p>
        <div class="ctas">
          <RouterLink to="/anteojos-de-sol" class="pill pill-solid">Ver anteojos de sol</RouterLink>
          <RouterLink to="/anteojos-recetados" class="pill pill-outline"
            >Ver anteojos recetados</RouterLink
          >
        </div>
      </div>
      <FrameBlueprint v-if="catalogs.sol.length" class="hero-blueprint" :products="catalogs.sol" />
    </section>

    <ul class="benefits" aria-label="Beneficios">
      <li v-for="benefit in BENEFITS" :key="benefit.icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <template v-if="benefit.icon === 'cuotas'">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M3 10h18M7 15h4" />
          </template>
          <template v-else-if="benefit.icon === 'envio'">
            <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
            <circle cx="7" cy="17.5" r="1.5" />
            <circle cx="17" cy="17.5" r="1.5" />
          </template>
          <template v-else-if="benefit.icon === 'cambios'">
            <path d="M4 9h13l-3-3M20 15H7l3 3" />
          </template>
          <template v-else>
            <path d="M12 3.5 19 6v5.5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6l7-2.5Z" />
            <path d="M12 9v6M9 12h6" />
          </template>
        </svg>
        {{ benefit.text }}
      </li>
    </ul>

    <section class="categories" aria-label="Categorías">
      <RouterLink v-for="item in categories" :key="item.category" :to="item.path" class="category">
        <div class="category-media">
          <FrameIllustration
            v-if="item.cover && item.variant"
            :shape="item.cover.shape"
            :material="item.cover.material"
            :frame-color="item.variant.frameColor"
            :lens-tint="item.variant.lensTint"
          />
        </div>
        <div class="category-text">
          <h2>{{ item.title }}</h2>
          <p>{{ CATEGORY_PITCH[item.category] }}</p>
          <span class="category-link">{{
            item.count ? `Ver los ${item.count} modelos` : 'Ver modelos'
          }}</span>
        </div>
      </RouterLink>
    </section>

    <section class="try-on" aria-labelledby="try-on-title">
      <div class="try-on-text">
        <h2 id="try-on-title">Probátelos con la cámara, a tamaño real</h2>
        <p class="try-on-lead">
          El probador virtual no superpone una foto cualquiera: calcula el tamaño de tu cara y te
          muestra cada armazón con sus medidas de verdad.
        </p>
        <ol class="steps">
          <li v-for="step in TRY_ON_STEPS" :key="step">{{ step }}</li>
        </ol>
        <RouterLink
          :to="{ path: '/anteojos-de-sol', query: { destacado: 'probador' } }"
          class="pill pill-light"
          >Ver modelos para probar</RouterLink
        >
        <p class="privacy">La imagen de la cámara se procesa en tu navegador y no se guarda.</p>
      </div>
      <div class="try-on-art">
        <TryOnIllustration />
      </div>
    </section>

    <section class="featured" aria-labelledby="featured-title">
      <div class="featured-head">
        <h2 id="featured-title">Los más elegidos</h2>
        <div class="tabs" role="group" aria-label="Categoría">
          <button
            v-for="category in ['sol', 'recetados'] as Category[]"
            :key="category"
            type="button"
            class="tab"
            :aria-pressed="featuredCategory === category"
            @click="featuredCategory = category"
          >
            {{ category === 'sol' ? 'Sol' : 'Recetados' }}
          </button>
        </div>
      </div>
      <div class="grid">
        <ProductCard v-for="product in featured" :key="product.id" :product="product" />
      </div>
      <RouterLink :to="CATEGORY_INFO[featuredCategory].path" class="pill pill-outline see-all">
        Ver todos los {{ CATEGORY_INFO[featuredCategory].title.toLowerCase() }}
      </RouterLink>
    </section>

    <section class="services" aria-labelledby="services-title">
      <h2 id="services-title">También en el local</h2>
      <ul class="service-list">
        <li v-for="service in SERVICES" :key="service.title" class="service">
          <h3>{{ service.title }}</h3>
          <p>{{ service.text }}</p>
          <RouterLink :to="service.link.to" class="service-link">{{
            service.link.label
          }}</RouterLink>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.home {
  display: grid;
  gap: clamp(56px, 8vw, 104px);
  padding: 16px var(--gutter) clamp(56px, 8vw, 104px);
}

/* Hero */

.hero {
  display: grid;
  gap: 32px;
  align-items: center;
  padding: clamp(28px, 5vw, 64px);
  border-radius: 28px;
  background: var(--color-tile);
}

.hero-text {
  display: grid;
  gap: 20px;
  justify-items: start;
}

h1 {
  max-width: 13ch;
  font-size: clamp(2.6rem, 1.6rem + 4vw, 5rem);
  line-height: 1.02;
  letter-spacing: -0.01em;
}

.lead {
  max-width: 44ch;
  font-size: var(--step-1);
  line-height: 1.45;
  color: var(--color-ink-soft);
}

.ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
}

.pill {
  display: inline-block;
  padding: 13px 22px;
  border-radius: var(--radius-pill);
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}

.pill-solid {
  background: var(--color-ink);
  color: var(--color-paper);
}

.pill-solid:hover {
  background: #000;
}

.pill-outline {
  border: 1px solid var(--color-ink);
  font-weight: 500;
}

.pill-outline:hover {
  background: var(--color-paper);
}

@media (min-width: 960px) {
  .hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    gap: clamp(40px, 5vw, 80px);
    min-height: min(640px, calc(100svh - var(--header-height) - 32px));
  }
}

/* Beneficios */

.benefits {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 24px;
  margin: calc(clamp(56px, 8vw, 104px) * -0.55) 0 0;
  padding: 0 4px;
  list-style: none;
  font-weight: 500;
}

.benefits li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.benefits svg {
  flex: none;
  width: 24px;
  height: 24px;
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (min-width: 900px) {
  .benefits {
    grid-template-columns: repeat(4, auto);
    justify-content: space-between;
  }
}

/* Categorías */

.categories {
  display: grid;
  gap: 20px;
}

@media (min-width: 760px) {
  .categories {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.category {
  display: grid;
  gap: 18px;
  text-decoration: none;
}

.category-media {
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 10;
  padding: 14% 16%;
  border-radius: var(--radius-tile);
  background: var(--color-tile);
}

.category-media > * {
  width: 100%;
}

.category-text {
  display: grid;
  gap: 6px;
  justify-items: start;
  padding: 0 4px;
}

.category h2 {
  font-size: var(--step-3);
}

.category p {
  max-width: 48ch;
  color: var(--color-ink-soft);
}

.category-link {
  margin-top: 6px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}

.category:hover .category-link {
  text-decoration-thickness: 2px;
}

/* Probador */

.try-on {
  display: grid;
  gap: 40px;
  align-items: center;
  padding: clamp(32px, 6vw, 80px);
  border-radius: 28px;
  background: var(--color-accent);
  color: var(--color-on-accent);
}

@media (min-width: 900px) {
  .try-on {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  }
}

.try-on-text {
  display: grid;
  gap: 20px;
  justify-items: start;
}

.try-on h2 {
  max-width: 18ch;
  font-size: clamp(2.2rem, 1.5rem + 2.8vw, 3.6rem);
  line-height: 1.05;
}

.try-on-lead {
  max-width: 48ch;
  font-size: var(--step-1);
  line-height: 1.45;
  opacity: 0.85;
}

.steps {
  display: grid;
  gap: 14px;
  max-width: 52ch;
  margin: 8px 0 10px;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.steps li {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 14px;
  align-items: baseline;
  counter-increment: step;
}

.steps li::before {
  content: counter(step);
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgb(255 255 255 / 0.45);
  border-radius: 50%;
  font-family: var(--font-display);
  font-size: 1.2rem;
  line-height: 1;
  translate: 0 -2px;
}

.pill-light {
  background: var(--color-paper);
  color: var(--color-accent);
}

.pill-light:hover {
  background: var(--color-tile);
}

.privacy {
  font-size: var(--step--1);
  opacity: 0.75;
}

.try-on-art {
  justify-self: center;
  width: min(100%, 380px);
}

.try-on :focus-visible {
  outline-color: var(--color-paper);
}

/* Más elegidos */

.featured {
  display: grid;
  gap: 28px;
}

.featured-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.featured h2,
.services h2 {
  font-size: var(--step-3);
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-tile);
}

.tab {
  padding: 7px 18px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  font-weight: 500;
}

.tab[aria-pressed='true'] {
  background: var(--color-paper);
  font-weight: 600;
}

.grid {
  display: grid;
  gap: 40px 24px;
}

@media (min-width: 560px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.see-all {
  justify-self: center;
}

/* Servicios */

.services {
  display: grid;
  gap: 28px;
  padding-top: clamp(40px, 6vw, 72px);
  border-top: 1px solid var(--color-line);
}

.service-list {
  display: grid;
  gap: 32px;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 860px) {
  .service-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
  }

  .service + .service {
    padding-left: 32px;
    border-left: 1px solid var(--color-line);
  }

  .service:not(:last-child) {
    padding-right: 32px;
  }
}

.service {
  display: grid;
  gap: 8px;
  align-content: start;
  justify-items: start;
}

.service h3 {
  font-size: 1.75rem;
}

.service p {
  max-width: 40ch;
  color: var(--color-ink-soft);
}

.service-link {
  margin-top: 6px;
  font-weight: 600;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}

.service-link:hover {
  text-decoration-thickness: 2px;
}
</style>
