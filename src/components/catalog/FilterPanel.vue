<script setup lang="ts">
import type { FilterGroup, FilterKey } from '@/types/catalog'

type GroupWithCounts = Omit<FilterGroup, 'options'> & {
  options: { value: string; label: string; count: number; checked: boolean }[]
}

defineProps<{ groups: GroupWithCounts[]; resultCount: number }>()
defineEmits<{ toggle: [key: FilterKey, value: string]; close: [] }>()
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <h2 class="panel-title">Filtros</h2>
      <button type="button" class="close" aria-label="Cerrar filtros" @click="$emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <details v-for="group in groups" :key="group.key" class="group" open>
      <summary>
        {{ group.label }}
        <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <ul class="options">
        <li v-for="option in group.options" :key="option.value">
          <label class="option">
            <input
              type="checkbox"
              :checked="option.checked"
              @change="$emit('toggle', group.key, option.value)"
            />
            <span class="option-label">{{ option.label }}</span>
            <span class="count">{{ option.count }}</span>
          </label>
        </li>
      </ul>
    </details>

    <button type="button" class="show-results" @click="$emit('close')">
      Ver {{ resultCount }} {{ resultCount === 1 ? 'modelo' : 'modelos' }}
    </button>
  </div>
</template>

<style scoped>
.panel-head {
  display: none;
}

.group {
  border-top: 1px solid var(--color-line);
}

.group:last-of-type {
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

.group[open] .chevron {
  transform: rotate(180deg);
}

.options {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0 0 16px;
  list-style: none;
}

.option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  cursor: pointer;
}

.option input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--color-accent);
}

.option-label {
  flex: 1;
}

.count {
  font-size: var(--step--1);
  color: var(--color-ink-soft);
  font-variant-numeric: tabular-nums;
}

.show-results {
  display: none;
}

@media (max-width: 899px) {
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
  }

  .panel-title {
    font-size: var(--step-2);
  }

  .close {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    background: none;
  }

  .close svg {
    width: 22px;
    height: 22px;
    stroke: currentColor;
    stroke-width: 1.6;
  }

  .show-results {
    display: block;
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding: 14px;
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--color-ink);
    color: var(--color-paper);
    font-weight: 600;
  }
}
</style>
