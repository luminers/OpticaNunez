<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FilterPanel from '@/components/catalog/FilterPanel.vue'
import ProductCard from '@/components/catalog/ProductCard.vue'
import { useCatalogFilters } from '@/composables/useCatalogFilters'
import { CATEGORY_INFO, SORT_OPTIONS } from '@/data/catalog-labels'
import { getCatalog } from '@/services/catalog'
import type { Category, Product, SortKey } from '@/types/catalog'

const props = defineProps<{ category: Category }>()

const products = ref<Product[]>([])
const loading = ref(true)
const loadFailed = ref(false)
let lastRequest = 0

// Vacía la grilla mientras carga para no mostrar la categoría anterior, y descarta
// respuestas que lleguen tarde si la persona ya cambió de categoría.
async function load(category: Category) {
  const request = ++lastRequest
  products.value = []
  loading.value = true
  loadFailed.value = false
  try {
    const data = await getCatalog(category)
    if (request === lastRequest) products.value = data
  } catch {
    if (request === lastRequest) loadFailed.value = true
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(() => props.category, load, { immediate: true })

const { selected, sort, results, groups, activeChips, toggle, setSort, clearAll } =
  useCatalogFilters(products)

const info = computed(() => CATEGORY_INFO[props.category])
const descriptionExpanded = ref(false)
const countLabel = computed(() =>
  results.value.length === 1 ? '1 modelo' : `${results.value.length} modelos`,
)

// En escritorio los filtros arrancan visibles; en celular son un panel que se abre.
const desktopQuery = window.matchMedia('(min-width: 900px)')
const isDesktop = ref(desktopQuery.matches)
const filtersOpen = ref(desktopQuery.matches)

function onViewportChange(event: MediaQueryListEvent) {
  isDesktop.value = event.matches
  filtersOpen.value = event.matches
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !isDesktop.value) filtersOpen.value = false
}

onMounted(() => {
  desktopQuery.addEventListener('change', onViewportChange)
  window.addEventListener('keydown', onKeydown)
})

const filtersEl = ref<HTMLElement>()
const toggleEl = ref<HTMLButtonElement>()

// En celular el panel se comporta como un diálogo: bloquea el scroll del fondo,
// recibe el foco al abrirse y lo devuelve al botón al cerrarse.
watch([filtersOpen, isDesktop], async ([open, desktop], [wasOpen]) => {
  document.body.style.overflow = open && !desktop ? 'hidden' : ''
  if (desktop) return
  await nextTick()
  if (open) filtersEl.value?.querySelector<HTMLElement>('.close')?.focus()
  else if (wasOpen) toggleEl.value?.focus()
})

onBeforeUnmount(() => {
  desktopQuery.removeEventListener('change', onViewportChange)
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

function onSortChange(event: Event) {
  setSort((event.target as HTMLSelectElement).value as SortKey)
}
</script>

<template>
  <main class="catalog">
    <section class="intro">
      <nav aria-label="Ruta de navegación" class="breadcrumb">
        <RouterLink to="/">Inicio</RouterLink>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ info.title }}</span>
      </nav>
      <h1 class="title">{{ info.title }}</h1>
      <p class="description" :class="{ expanded: descriptionExpanded }">{{ info.description }}</p>
      <button
        type="button"
        class="text-button"
        :aria-expanded="descriptionExpanded"
        @click="descriptionExpanded = !descriptionExpanded"
      >
        {{ descriptionExpanded ? 'Leer menos' : 'Leer más' }}
      </button>
    </section>

    <div class="layout" :class="{ 'filters-hidden': !filtersOpen }">
      <aside
        id="catalog-filters"
        ref="filtersEl"
        class="filters"
        :class="{ open: filtersOpen }"
        aria-label="Filtros"
        :inert="!filtersOpen"
      >
        <FilterPanel
          :groups="groups"
          :result-count="results.length"
          @toggle="toggle"
          @close="filtersOpen = false"
        />
      </aside>
      <div v-if="filtersOpen && !isDesktop" class="backdrop" @click="filtersOpen = false" />

      <section class="results" aria-labelledby="results-count">
        <div class="toolbar">
          <div class="toolbar-start">
            <button
              ref="toggleEl"
              type="button"
              class="toggle-filters"
              aria-controls="catalog-filters"
              :aria-expanded="filtersOpen"
              @click="filtersOpen = !filtersOpen"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="10" cy="17" r="2" />
              </svg>
              {{ isDesktop ? (filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros') : 'Filtros' }}
            </button>
            <p id="results-count" class="count" aria-live="polite">
              {{ loading ? 'Cargando modelos' : countLabel }}
            </p>
          </div>
          <label class="sort">
            <span>Ordenar por</span>
            <select :value="sort" @change="onSortChange">
              <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <ul v-if="activeChips.length" class="chips" aria-label="Filtros activos">
          <li v-for="chip in activeChips" :key="`${chip.key}-${chip.value}`">
            <button
              type="button"
              class="chip"
              :aria-label="`Quitar filtro ${chip.label}`"
              @click="toggle(chip.key, chip.value)"
            >
              {{ chip.label }}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
            </button>
          </li>
          <li>
            <button type="button" class="text-button" @click="clearAll">Limpiar filtros</button>
          </li>
        </ul>

        <div v-if="loadFailed" class="empty">
          <h2>No pudimos cargar el catálogo</h2>
          <p>Revisá tu conexión e intentá de nuevo.</p>
          <button type="button" class="solid-button" @click="load(category)">Reintentar</button>
        </div>

        <ul v-else-if="results.length" class="grid">
          <li v-for="product in results" :key="product.id">
            <ProductCard :product="product" :preferred-colors="selected.color" />
          </li>
        </ul>

        <div v-else-if="!loading" class="empty">
          <h2>Ningún modelo coincide con estos filtros</h2>
          <p>Quitá alguno de los filtros activos para ver más opciones.</p>
          <button type="button" class="solid-button" @click="clearAll">Limpiar filtros</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.catalog {
  padding: 0 var(--gutter) 96px;
}

.intro {
  display: grid;
  gap: 10px;
  justify-items: start;
  max-width: 62ch;
  padding: 24px 0 28px;
}

.breadcrumb {
  display: flex;
  gap: 8px;
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

.title {
  font-size: var(--step-3);
}

.description {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  color: var(--color-ink-soft);
}

.description.expanded {
  display: block;
}

.text-button {
  padding: 0;
  border: 0;
  background: none;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 40px;
  align-items: start;
}

.layout.filters-hidden {
  grid-template-columns: minmax(0, 1fr);
}

/* Columnas de la grilla: ocultar los filtros suma una columna en escritorio. */
.layout {
  --columns: 1;
}

@media (min-width: 560px) {
  .layout {
    --columns: 2;
  }
}

@media (min-width: 900px) {
  .layout.filters-hidden {
    --columns: 3;
  }
}

@media (min-width: 1200px) {
  .layout {
    --columns: 3;
  }

  .layout.filters-hidden {
    --columns: 4;
  }
}

@media (min-width: 1800px) {
  .layout {
    --columns: 4;
  }

  .layout.filters-hidden {
    --columns: 5;
  }
}

.filters {
  position: sticky;
  top: calc(var(--header-height) + 16px);
  max-height: calc(100vh - var(--header-height) - 32px);
  overflow-y: auto;
  scrollbar-width: thin;
}

.filters:not(.open) {
  display: none;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding-bottom: 20px;
}

.toolbar-start {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toggle-filters {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  font-weight: 600;
}

.toggle-filters svg,
.chip svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.count {
  padding-left: 16px;
  border-left: 1px solid var(--color-line);
  color: var(--color-ink-soft);
}

.sort {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  font-weight: 600;
}

.sort span {
  white-space: nowrap;
}

/* Un select mide lo que su opción más larga; en pantallas muy angostas tiene que poder achicarse. */
.sort select {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  text-overflow: ellipsis;
  padding: 6px 4px;
  border: 0;
  background: none;
  font-weight: 600;
  cursor: pointer;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0 0 24px;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 6px 14px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-paper);
  font-size: var(--step--1);
  font-weight: 500;
}

.chip:hover {
  border-color: var(--color-ink);
}

.chip svg {
  width: 16px;
  height: 16px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  gap: 40px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.grid > li {
  display: flex;
}

.grid > li > * {
  flex: 1;
}

.empty {
  display: grid;
  gap: 12px;
  justify-items: start;
  max-width: 44ch;
  padding: 48px 0;
}

.empty h2 {
  font-size: var(--step-2);
}

.empty p {
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
}

@media (max-width: 899px) {
  .layout,
  .layout.filters-hidden {
    grid-template-columns: minmax(0, 1fr);
  }

  .filters {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    display: block;
    width: min(360px, 88vw);
    max-height: none;
    padding: 20px;
    background: var(--color-paper);
    transform: translateX(-100%);
    transition: transform 220ms ease;
  }

  .filters:not(.open) {
    display: block;
    visibility: hidden;
  }

  .filters.open {
    transform: none;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgb(29 43 42 / 0.4);
  }

  .toggle-filters {
    padding: 8px 16px 8px 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
  }

  .count {
    padding-left: 0;
    border-left: 0;
  }

  .sort span {
    font-weight: 400;
    color: var(--color-ink-soft);
  }
}
</style>
