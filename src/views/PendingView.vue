<script setup lang="ts">
// Lugar reservado para las secciones que todavía no tienen vista.
defineProps<{ title?: string }>()
</script>

<template>
  <main class="pending">
    <h1>{{ title ?? 'Sección en construcción' }}</h1>
    <p>Esta sección todavía no está disponible. Mientras tanto, podés ver el catálogo.</p>
    <RouterLink to="/anteojos-de-sol" class="link">Ver anteojos de sol</RouterLink>
  </main>
</template>

<style scoped>
.pending {
  display: grid;
  gap: 16px;
  justify-items: start;
  max-width: 640px;
  padding: 80px var(--gutter);
}

h1 {
  font-size: var(--step-3);
}

.link {
  padding: 12px 20px;
  border-radius: var(--radius-pill);
  background: var(--color-ink);
  color: var(--color-paper);
  font-weight: 600;
  text-decoration: none;
}
</style>
