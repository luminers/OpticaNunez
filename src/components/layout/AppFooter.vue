<script setup lang="ts">
const COLUMNS = [
  {
    title: 'Comprar',
    links: [
      { label: 'Anteojos de sol', to: '/anteojos-de-sol' },
      { label: 'Anteojos recetados', to: '/anteojos-recetados' },
      { label: 'Lentes de contacto', to: '/lentes-de-contacto' },
      { label: 'Modelos para probar', to: '/anteojos-de-sol?destacado=probador' },
    ],
  },
  {
    title: 'En el local',
    links: [
      { label: 'Turno para examen visual', to: '/turnos' },
      { label: 'Obras sociales', to: '/obras-sociales' },
      { label: 'Promociones', to: '/promociones' },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Envíos y cambios', to: '/ayuda/envios' },
      { label: 'Medios de pago', to: '/ayuda/pagos' },
      { label: 'Contacto', to: '/contacto' },
    ],
  },
]

const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <div class="top">
      <div class="brand">
        <RouterLink to="/" class="logo">Óptica Núñez</RouterLink>
        <p>Óptica familiar con taller propio. Pagás con Mercado Pago, en cuotas sin interés.</p>
      </div>
      <nav v-for="column in COLUMNS" :key="column.title" :aria-label="column.title">
        <h2>{{ column.title }}</h2>
        <ul>
          <li v-for="link in column.links" :key="link.to">
            <RouterLink :to="link.to">{{ link.label }}</RouterLink>
          </li>
        </ul>
      </nav>
    </div>
    <p class="legal">© {{ year }} Óptica Núñez</p>
  </footer>
</template>

<style scoped>
.footer {
  padding: clamp(40px, 6vw, 64px) var(--gutter) 28px;
  background: var(--color-tile);
}

.top {
  display: grid;
  gap: 32px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

@media (min-width: 900px) {
  .top {
    grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr));
  }
}

.brand {
  display: grid;
  gap: 10px;
  align-content: start;
}

.brand p {
  max-width: 34ch;
  color: var(--color-ink-soft);
}

.logo {
  font-family: var(--font-display);
  font-size: 1.85rem;
  text-decoration: none;
}

h2 {
  margin-bottom: 12px;
  font-family: var(--font-body);
  font-size: var(--step-0);
  font-weight: 600;
}

ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

ul a {
  color: var(--color-ink-soft);
  text-decoration: none;
}

ul a:hover {
  color: var(--color-ink);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.legal {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--color-line);
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}
</style>
