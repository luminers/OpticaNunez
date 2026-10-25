<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { STORE_INFO, storeField, todayStatus, whatsappUrl } from '@/data/store-info'
import { useFavoritesStore } from '@/stores/favorites'

const favorites = useFavoritesStore()

// Publica la altura real del header en --header-height para que los elementos fijos
// (filtros, galería) se acomoden debajo aunque cambien la fuente o el ancho de pantalla.
const headerEl = ref<HTMLElement>()
const resizeObserver = new ResizeObserver(([entry]) => {
  const height = entry?.borderBoxSize[0]?.blockSize
  if (height) document.documentElement.style.setProperty('--header-height', `${height}px`)
})

onMounted(() => headerEl.value && resizeObserver.observe(headerEl.value))
onBeforeUnmount(() => resizeObserver.disconnect())

// Barra del local: dirección, si está abierto hoy y WhatsApp. Sin datos cargados no se muestra.
const address = storeField(
  STORE_INFO.street && STORE_INFO.city ? `${STORE_INFO.street}, ${STORE_INFO.city}` : null,
)
const status = todayStatus() ?? storeField(null)
const whatsapp = whatsappUrl() ?? (import.meta.env.DEV ? '#' : null)
const showStoreBar = Boolean(address || status || whatsapp)

// Las secciones sin vista todavía caen en la página "en construcción".
const NAV_LINKS = [
  { label: 'Recetados', to: '/anteojos-recetados' },
  { label: 'Sol', to: '/anteojos-de-sol' },
  { label: 'Marcas', to: '/marcas' },
  { label: 'Obras sociales', to: '/obras-sociales' },
  { label: 'Promociones', to: '/promociones' },
]
</script>

<template>
  <header ref="headerEl" class="header">
    <div v-if="showStoreBar" class="store-bar">
      <component
        :is="STORE_INFO.mapsUrl ? 'a' : 'span'"
        v-if="address"
        :href="STORE_INFO.mapsUrl ?? undefined"
        class="store-address"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
          <circle cx="12" cy="10" r="2.3" />
        </svg>
        <span class="store-address-text">Local en {{ address }}</span>
      </component>
      <span v-if="status" class="store-status" :class="{ open: status.startsWith('Abierto') }">{{
        status
      }}</span>
      <a v-if="whatsapp" :href="whatsapp" class="store-whatsapp" target="_blank" rel="noopener"
        ><span class="store-whatsapp-long">Escribinos por </span>WhatsApp</a
      >
    </div>

    <div class="bar">
      <RouterLink to="/" class="logo">
        <img src="@/assets/logo-optica-nunez.svg" alt="Óptica Nuñez" />
      </RouterLink>

      <div class="actions">
        <RouterLink to="/cuenta" class="sign-in">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="9" r="3.5" />
            <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
          </svg>
          <span class="sign-in-label">Ingresar</span>
        </RouterLink>
        <RouterLink to="/buscar" class="icon" aria-label="Buscar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </RouterLink>
        <RouterLink
          to="/favoritos"
          class="icon"
          :aria-label="favorites.count ? `Favoritos (${favorites.count})` : 'Favoritos'"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
            />
          </svg>
          <span v-if="favorites.count" class="counter" aria-hidden="true">{{
            favorites.count
          }}</span>
        </RouterLink>
        <RouterLink to="/carrito" class="icon" aria-label="Carrito">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 4h2.2l2.3 11h10.2l2-8H6.4" />
            <circle cx="9" cy="19" r="1.3" />
            <circle cx="17" cy="19" r="1.3" />
          </svg>
        </RouterLink>
      </div>
    </div>

    <nav aria-label="Principal">
      <ul class="nav">
        <li v-for="link in NAV_LINKS" :key="link.to">
          <RouterLink :to="link.to" class="nav-link">{{ link.label }}</RouterLink>
        </li>
      </ul>
    </nav>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: 0 var(--gutter);
  background: var(--color-paper);
  border-bottom: 1px solid var(--color-line);
}

.store-bar {
  display: flex;
  align-items: center;
  gap: 8px 24px;
  margin: 0 calc(var(--gutter) * -1);
  padding: 7px var(--gutter);
  background: var(--color-ink);
  color: var(--color-paper);
  font-size: var(--step--1);
}

.store-bar a {
  text-decoration: none;
}

.store-bar a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.store-address {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.store-address-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.store-bar svg {
  width: 15px;
  height: 15px;
}

.store-status {
  margin-left: auto;
  white-space: nowrap;
}

.store-status.open::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 7px;
  border-radius: 50%;
  background: #9cc6ec;
  vertical-align: 1px;
}

.store-whatsapp {
  font-weight: 600;
  white-space: nowrap;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
}

.logo {
  display: block;
  min-width: 0;
}

.logo img {
  display: block;
  height: clamp(36px, 28px + 2vw, 48px);
  width: auto;
  max-width: 100%;
}

.actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sign-in {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 6px;
  padding: 7px 14px 7px 10px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  font-weight: 500;
  text-decoration: none;
}

.sign-in:hover {
  border-color: var(--color-ink);
}

.icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.counter {
  position: absolute;
  top: 4px;
  right: 2px;
  min-width: 17px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
  text-align: center;
}

.nav {
  display: flex;
  gap: 26px;
  margin: 0;
  padding: 10px 0 0;
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-link {
  display: block;
  min-width: 24px;
  text-align: center;
  padding: 6px 0 12px;
  border-bottom: 2px solid transparent;
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
}

.nav-link:hover,
.nav-link.router-link-active {
  border-bottom-color: var(--color-ink);
}

@media (max-width: 599px) {
  .store-address {
    display: none;
  }

  .store-status {
    margin-left: 0;
  }

  .store-whatsapp {
    margin-left: auto;
  }

  .store-whatsapp-long {
    display: none;
  }

  .bar {
    gap: 8px;
  }

  .actions {
    gap: 0;
  }

  .sign-in {
    width: 36px;
    height: 36px;
    margin: 0;
    padding: 0;
    justify-content: center;
    border: 0;
  }

  .sign-in-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .icon {
    width: 36px;
    height: 36px;
  }
}
</style>
