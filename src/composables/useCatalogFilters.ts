import { computed, type Ref } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'
import { FILTER_GROUPS } from '@/data/catalog-labels'
import type { Badge, FilterKey, Product, SortKey } from '@/types/catalog'

const FILTER_KEYS = FILTER_GROUPS.map((group) => group.key)

// Dentro de un grupo las opciones se suman (OR); entre grupos se combinan (AND).
const MATCHERS: Record<FilterKey, (product: Product, value: string) => boolean> = {
  destacado: (p, v) =>
    v === 'probador' ? p.variants.some((x) => x.tryOnModelUrl) : p.badges.includes(v as Badge),
  genero: (p, v) => p.gender === v || p.gender === 'unisex',
  forma: (p, v) => p.shape === v,
  material: (p, v) => p.material === v,
  color: (p, v) => p.variants.some((x) => x.colorFamily === v),
  ancho: (p, v) => p.sizes.some((size) => size.width === v),
}

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  destacados: (a, b) => a.featuredRank - b.featuredRank,
  novedades: (a, b) => b.createdAt.localeCompare(a.createdAt),
  'precio-asc': (a, b) => a.price - b.price,
  'precio-desc': (a, b) => b.price - a.price,
}

const ALLOWED_VALUES = Object.fromEntries(
  FILTER_GROUPS.map((group) => [group.key, new Set(group.options.map((o) => o.value))]),
) as Record<FilterKey, Set<string>>

// Valores desconocidos (links viejos o mal copiados) se ignoran en vez de vaciar el catálogo.
function parseList(
  key: FilterKey,
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string[] {
  const raw = Array.isArray(value) ? value.join(',') : (value ?? '')
  return raw.split(',').filter((v) => ALLOWED_VALUES[key].has(v))
}

/** Filtros y orden del catálogo, guardados en la URL para poder compartirlos. */
export function useCatalogFilters(products: Ref<Product[]>) {
  const route = useRoute()
  const router = useRouter()

  const selected = computed(
    () =>
      Object.fromEntries(
        FILTER_KEYS.map((key) => [key, parseList(key, route.query[key])]),
      ) as Record<FilterKey, string[]>,
  )

  const sort = computed<SortKey>(() => {
    const value = route.query.orden
    return typeof value === 'string' && value in SORTERS ? (value as SortKey) : 'destacados'
  })

  function matches(product: Product, ignore?: FilterKey) {
    return FILTER_KEYS.every((key) => {
      const values = selected.value[key]
      return key === ignore || values.length === 0 || values.some((v) => MATCHERS[key](product, v))
    })
  }

  const results = computed(() =>
    products.value.filter((product) => matches(product)).sort(SORTERS[sort.value]),
  )

  // Cada opción cuenta cuántos modelos quedarían al sumarla a los demás filtros activos.
  const groups = computed(() =>
    FILTER_GROUPS.map((group) => ({
      ...group,
      options: group.options
        .map((option) => ({
          ...option,
          checked: selected.value[group.key].includes(option.value),
          count: products.value.filter(
            (p) => matches(p, group.key) && MATCHERS[group.key](p, option.value),
          ).length,
        }))
        .filter((option) => option.count > 0 || option.checked),
    })).filter((group) => group.options.length > 0),
  )

  const activeChips = computed(() =>
    FILTER_GROUPS.flatMap((group) =>
      selected.value[group.key].map((value) => ({
        key: group.key,
        value,
        label: group.options.find((o) => o.value === value)?.label ?? value,
      })),
    ),
  )

  function replaceQuery(patch: Record<string, string | undefined>) {
    router.replace({ query: { ...route.query, ...patch } })
  }

  function toggle(key: FilterKey, value: string) {
    const current = selected.value[key]
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    replaceQuery({ [key]: next.length ? next.join(',') : undefined })
  }

  function setSort(value: SortKey) {
    replaceQuery({ orden: value === 'destacados' ? undefined : value })
  }

  function clearAll() {
    replaceQuery(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])))
  }

  return { selected, sort, results, groups, activeChips, toggle, setSort, clearAll }
}
