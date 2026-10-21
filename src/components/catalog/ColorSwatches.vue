<script setup lang="ts">
import { useId } from 'vue'
import type { ProductVariant } from '@/types/catalog'

defineProps<{ variants: ProductVariant[]; productName: string }>()
const selectedId = defineModel<string>({ required: true })

const groupName = `color-${useId()}`

const CAREY_SWATCH =
  'radial-gradient(circle at 30% 30%, #c58a45 0 22%, transparent 24%), radial-gradient(circle at 70% 65%, #a8652c 0 26%, transparent 28%), #4a2510'

function swatchBackground(variant: ProductVariant) {
  return variant.frameColor === 'carey' ? CAREY_SWATCH : variant.frameColor
}
</script>

<template>
  <fieldset class="swatches">
    <legend class="visually-hidden">Color de {{ productName }}</legend>
    <label v-for="variant in variants" :key="variant.id" class="swatch">
      <input
        v-model="selectedId"
        class="visually-hidden"
        type="radio"
        :name="groupName"
        :value="variant.id"
      />
      <span class="dot" :style="{ background: swatchBackground(variant) }" />
      <span class="visually-hidden">{{ variant.colorName }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.swatches {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

.swatch {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  cursor: pointer;
  /* Contiene al radio oculto: si no, se posiciona contra la página y escapa de los carruseles. */
  position: relative;
}

.swatch:has(input:checked) {
  border-color: var(--color-ink);
}

.swatch:has(input:focus-visible) {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(29 43 42 / 0.18);
}
</style>
