<script setup lang="ts">
import { computed, ref } from 'vue'
import { FILTER_GROUPS } from '@/data/catalog-labels'
import type { FrameShape, Product } from '@/types/catalog'
import FrameIllustration from '@/components/catalog/FrameIllustration.vue'

// Plano del armazón con las tres medidas que trae grabadas la patilla (calibre □ puente patilla).
// Muestra un modelo real por forma, así las cifras salen del catálogo y no son decorativas.

const props = defineProps<{ products: Product[] }>()

// Borde izquierdo y derecho de la lente izquierda, en unidades del viewBox de FrameIllustration (240).
const LENS_SPAN: Record<FrameShape, [number, number]> = {
  redondo: [34, 106],
  cuadrado: [32, 108],
  rectangular: [28, 110],
  aviador: [30, 109],
  'ojo-de-gato': [18, 108],
}

const shapeOptions = computed(() =>
  FILTER_GROUPS.find((group) => group.key === 'forma')!.options.flatMap((option) => {
    const product = props.products.find((p) => p.shape === option.value)
    return product ? [{ shape: option.value as FrameShape, label: option.label, product }] : []
  }),
)

const selectedShape = ref<FrameShape>('cuadrado')
const current = computed(
  () => shapeOptions.value.find((o) => o.shape === selectedShape.value) ?? shapeOptions.value[0],
)
const variant = computed(() => current.value?.product.variants[0])
const size = computed(() => {
  const sizes = current.value?.product.sizes ?? []
  return sizes.find((s) => s.width === 'medio') ?? sizes[0]
})

const span = computed(() => LENS_SPAN[current.value?.shape ?? 'cuadrado'])
const toPercent = (x: number) => `${(x / 240) * 100}%`
</script>

<template>
  <figure v-if="current && variant && size" class="blueprint">
    <div class="drawing">
      <FrameIllustration
        :shape="current.product.shape"
        :frame="current.product.frame"
        :material="current.product.material"
        :frame-color="variant.frameColor"
        :lens-tint="variant.lensTint"
      />

      <div class="dimensions" aria-hidden="true">
        <svg viewBox="0 0 240 20" preserveAspectRatio="none">
          <path
            :d="`M ${span[0]} 10 H ${span[1]} M ${span[1]} 10 H ${240 - span[1]}`"
            vector-effect="non-scaling-stroke"
          />
          <path
            v-for="x in [span[0], span[1], 240 - span[1]]"
            :key="x"
            :d="`M ${x} 4 V 16`"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <span class="tag" :style="{ left: toPercent((span[0] + span[1]) / 2) }"
          >{{ size.lensWidth }} mm</span
        >
        <span class="tag" :style="{ left: '50%' }">{{ size.bridge }}</span>
      </div>
    </div>

    <figcaption>
      <dl class="readout">
        <div>
          <dt>Calibre</dt>
          <dd>{{ size.lensWidth }}</dd>
        </div>
        <div>
          <dt>Puente</dt>
          <dd>{{ size.bridge }}</dd>
        </div>
        <div>
          <dt>Patilla</dt>
          <dd>{{ size.templeLength }}</dd>
        </div>
      </dl>
      <p class="model">
        Modelo
        <RouterLink :to="{ name: 'producto', params: { slug: current.product.slug } }">{{
          current.product.name
        }}</RouterLink>
        en {{ variant.colorName.toLowerCase() }}. Así vienen grabadas las medidas en la patilla, en
        milímetros.
      </p>
    </figcaption>

    <div class="shapes" role="group" aria-label="Forma del armazón">
      <button
        v-for="option in shapeOptions"
        :key="option.shape"
        type="button"
        class="shape"
        :aria-pressed="option.shape === current.shape"
        @click="selectedShape = option.shape"
      >
        {{ option.label }}
      </button>
    </div>
  </figure>
</template>

<style scoped>
.blueprint {
  display: grid;
  gap: 22px;
  margin: 0;
}

/* Papel milimetrado muy tenue: es un plano, no una foto de producto. */
.drawing {
  padding: 10% 6% 9%;
  border-radius: 14px;
  background-color: var(--color-paper);
  background-image:
    linear-gradient(rgb(42 46 72 / 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgb(42 46 72 / 0.05) 1px, transparent 1px);
  background-size: 18px 18px;
  background-position: center;
}

.dimensions {
  position: relative;
  margin-top: 14px;
  padding-bottom: 24px;
}

.dimensions svg {
  display: block;
  width: 100%;
  height: 20px;
  fill: none;
  stroke: var(--color-ink-soft);
  stroke-width: 1;
}

.tag {
  position: absolute;
  top: 22px;
  translate: -50% 0;
  font-size: var(--step--1);
  font-variant-numeric: tabular-nums;
  color: var(--color-ink-soft);
  white-space: nowrap;
}

.readout {
  display: flex;
  align-items: flex-end;
  gap: clamp(14px, 3vw, 28px);
  margin: 0;
}

.readout div {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
}

/* El cuadrado entre calibre y puente es el que viene grabado en la patilla. Se dibuja con
   borde y no con el carácter □ porque Forum no lo trae y el reemplazo parece un glifo roto. */
.readout div:first-child dd::after {
  content: '';
  display: inline-block;
  width: 0.34em;
  height: 0.34em;
  margin-left: clamp(14px, 3vw, 28px);
  border: 0.045em solid currentColor;
  vertical-align: 0.17em;
}

.readout dt {
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}

.readout dd {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.6rem, 1.6rem + 3.6vw, 4.4rem);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.model {
  margin-top: 12px;
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}

.model a {
  color: var(--color-ink);
  font-weight: 500;
  text-underline-offset: 3px;
}

.shapes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.shape {
  padding: 7px 14px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-paper);
  font-size: var(--step--1);
  font-weight: 500;
}

.shape:hover {
  border-color: var(--color-ink);
}

.shape[aria-pressed='true'] {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: var(--color-paper);
}
</style>
