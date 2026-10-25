<script setup lang="ts">
import { STORE_INFO, isPlaceholder, storeField } from '@/data/store-info'

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

// Datos que la ley de defensa del consumidor pide a toda tienda online en Argentina.
const legalName = storeField(STORE_INFO.legalName)
const cuit = storeField(STORE_INFO.cuit)
const address = storeField(
  STORE_INFO.street && STORE_INFO.city ? `${STORE_INFO.street}, ${STORE_INFO.city}` : null,
)
const optician = storeField(
  STORE_INFO.optician && STORE_INFO.license
    ? `${STORE_INFO.optician}, matrícula ${STORE_INFO.license}`
    : null,
)
const showDataFiscal = Boolean(STORE_INFO.dataFiscalUrl) || import.meta.env.DEV
</script>

<template>
  <footer class="footer">
    <div class="top">
      <div class="brand">
        <RouterLink to="/" class="logo">
          <img src="@/assets/logo-optica-nunez.svg" :alt="STORE_INFO.name" />
        </RouterLink>
        <p>Óptica familiar con taller propio. Pagás con Mercado Pago, en cuotas sin interés.</p>
        <p v-if="address" class="contact" :class="{ pending: isPlaceholder(address) }">
          {{ address }}
        </p>
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
    <div class="legal">
      <div class="legal-text">
        <p>
          © {{ year }} {{ STORE_INFO.name }}
          <template v-if="legalName">
            <br />
            <span :class="{ pending: isPlaceholder(legalName) }">{{ legalName }}</span>
          </template>
          <template v-if="cuit">
            <br />
            CUIT <span :class="{ pending: isPlaceholder(cuit) }">{{ cuit }}</span>
          </template>
        </p>
        <p v-if="optician">
          Óptico responsable:
          <span :class="{ pending: isPlaceholder(optician) }">{{ optician }}</span>
        </p>
      </div>

      <ul class="legal-links">
        <li><RouterLink to="/arrepentimiento" class="regret">Botón de arrepentimiento</RouterLink></li>
        <li>
          <a
            href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
            target="_blank"
            rel="noopener"
            >Defensa de las y los consumidores</a
          >
        </li>
        <li><RouterLink to="/terminos">Términos y condiciones</RouterLink></li>
        <li><RouterLink to="/privacidad">Privacidad</RouterLink></li>
      </ul>

      <a
        v-if="showDataFiscal"
        :href="STORE_INFO.dataFiscalUrl ?? undefined"
        class="data-fiscal"
        target="_blank"
        rel="noopener"
      >
        <span v-if="!STORE_INFO.dataFiscalUrl" class="pending">QR Data Fiscal [a completar]</span>
        <template v-else>Data Fiscal</template>
      </a>
    </div>
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

.logo img {
  display: block;
  height: 44px;
  width: auto;
  max-width: 100%;
}

.brand .contact {
  color: var(--color-ink);
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
  display: grid;
  gap: 20px;
  align-items: start;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--color-line);
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}

@media (min-width: 900px) {
  .legal {
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 2fr) auto;
  }
}

.legal-text {
  display: grid;
  gap: 6px;
}

.legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
}

.legal-links a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--color-line);
}

.legal-links a:hover {
  color: var(--color-ink);
  text-decoration-color: currentColor;
}

/* Tiene que estar a la vista y ser fácil de encontrar (Res. 424/2020). */
.legal-links .regret {
  color: var(--color-ink);
  font-weight: 600;
}

.data-fiscal {
  display: grid;
  place-items: center;
  width: 72px;
  min-height: 96px;
  padding: 6px;
  border: 1px solid var(--color-line);
  background: var(--color-paper);
  color: var(--color-ink);
  font-size: 11px;
  text-align: center;
  text-decoration: none;
}

/* Solo se ve en desarrollo: marca el dato que falta cargar. */
.pending {
  color: #b4441c;
}
</style>
