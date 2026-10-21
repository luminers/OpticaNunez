<script setup lang="ts">
import { computed, useId } from 'vue'
import { FRAME_GEOMETRY } from '@/data/frame-geometry'
import type { FrameMaterial, FrameShape } from '@/types/catalog'

// Dibujo del armazón mientras no haya fotos reales.
// Frente y medidas: se dibuja la mitad izquierda (viewBox 240×104) y se espeja.

export type FrameView = 'frente' | 'medidas' | 'perfil'

const props = withDefaults(
  defineProps<{
    shape: FrameShape
    material: FrameMaterial
    frameColor: string
    lensTint?: string
    view?: FrameView
    /** Requerido en la vista de medidas, en milímetros. */
    measures?: { lensWidth: number; bridge: number }
  }>(),
  { view: 'frente', lensTint: undefined, measures: undefined },
)

const uid = useId()
const careyId = `carey-${uid}`
const clipId = `lens-${uid}`

const geometry = computed(() => FRAME_GEOMETRY[props.shape])
const stroke = computed(() =>
  props.frameColor === 'carey' ? `url(#${careyId})` : props.frameColor,
)
const isMetal = computed(() => props.material === 'metal')
const strokeWidth = computed(() => (isMetal.value ? 3 : 7))
const lensFill = computed(() => props.lensTint ?? '#dbe7e8')
const lensOpacity = computed(() => (props.lensTint ? 0.9 : 0.4))
const viewBox = computed(() => (props.view === 'medidas' ? '0 -30 240 134' : '0 0 240 104'))
const showMeasures = computed(() => props.view === 'medidas' && props.measures)
</script>

<template>
  <svg class="frame" :viewBox="viewBox" aria-hidden="true" focusable="false">
    <defs>
      <pattern :id="careyId" patternUnits="userSpaceOnUse" width="26" height="22">
        <rect width="26" height="22" fill="#5a2e14" />
        <ellipse cx="6" cy="6" rx="6" ry="4" fill="#a8652c" />
        <ellipse cx="19" cy="15" rx="7" ry="5" fill="#c58a45" opacity="0.8" />
        <ellipse cx="18" cy="4" rx="3" ry="2" fill="#2e1608" />
        <ellipse cx="7" cy="17" rx="3.5" ry="2.5" fill="#2e1608" />
      </pattern>
      <clipPath :id="clipId">
        <path :d="geometry.lens" />
      </clipPath>
    </defs>

    <ellipse cx="120" cy="98" rx="92" ry="3" fill="#1d2b2a" opacity="0.07" />

    <template v-if="view === 'perfil'">
      <path
        d="M 44 34 L 196 38 Q 214 40 222 66"
        fill="none"
        :stroke="stroke"
        :stroke-width="isMetal ? 3 : 6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <rect
        x="30"
        :y="isMetal ? 24 : 20"
        :width="isMetal ? 6 : 14"
        height="62"
        rx="5"
        :fill="stroke"
      />
      <rect x="38" y="30" width="10" height="7" rx="2" :fill="stroke" />
    </template>

    <template v-else>
      <g
        v-for="side in ['izquierda', 'derecha']"
        :key="side"
        :transform="side === 'derecha' ? 'translate(240 0) scale(-1 1)' : undefined"
      >
        <path :d="geometry.lens" :fill="lensFill" :fill-opacity="lensOpacity" />
        <path
          :clip-path="`url(#${clipId})`"
          d="M 14 80 L 78 0 L 96 0 L 32 80 Z"
          fill="#ffffff"
          opacity="0.18"
        />
        <g
          fill="none"
          :stroke="stroke"
          :stroke-width="strokeWidth"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path :d="geometry.lens" />
          <path :d="geometry.bridge" />
          <path :d="geometry.temple" />
        </g>
      </g>

      <g v-if="showMeasures" class="dims">
        <g fill="none" stroke="currentColor" stroke-width="0.8">
          <path
            :d="`M ${geometry.outer} -12 H ${geometry.inner} M ${geometry.outer} -16 V -8 M ${geometry.inner} -16 V -8 M ${240 - geometry.inner} -16 V -8 M ${geometry.inner} -12 H ${240 - geometry.inner}`"
          />
          <path
            stroke-dasharray="2 2"
            opacity="0.6"
            :d="`M ${geometry.outer} -8 V ${geometry.top} M ${geometry.inner} -8 V ${geometry.top} M ${240 - geometry.inner} -8 V ${geometry.top}`"
          />
        </g>
        <text :x="(geometry.outer + geometry.inner) / 2" y="-18" text-anchor="middle">
          {{ measures?.lensWidth }} mm
        </text>
        <text x="120" y="-18" text-anchor="middle">{{ measures?.bridge }}</text>
      </g>
    </template>
  </svg>
</template>

<style scoped>
.frame {
  display: block;
  width: 100%;
  height: auto;
}

.dims {
  color: var(--color-ink-soft);
}

.dims text {
  fill: currentColor;
  font-family: var(--font-body);
  font-size: 9px;
  font-weight: 600;
}
</style>
