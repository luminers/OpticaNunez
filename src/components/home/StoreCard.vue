<script setup lang="ts">
import {
  STORE_INFO,
  isPlaceholder,
  storeField,
  weeklyHours,
  whatsappUrl,
} from '@/data/store-info'

// Ficha del local, armada como la placa de un consultorio: datos en filas, sin adornos.
const address = storeField(STORE_INFO.street)
const city = storeField(STORE_INFO.city)
const hours = STORE_INFO.hours.length ? weeklyHours() : null
const hoursPlaceholder = storeField(null)
const phone = storeField(STORE_INFO.phone)
const whatsapp = whatsappUrl('Hola, les escribo desde la tienda online.')
const optician = storeField(STORE_INFO.optician)
const license = storeField(STORE_INFO.license)
</script>

<template>
  <dl class="store-card">
    <div v-if="address" class="row">
      <dt>Dirección</dt>
      <dd>
        <component
          :is="STORE_INFO.mapsUrl ? 'a' : 'span'"
          :href="STORE_INFO.mapsUrl ?? undefined"
          :class="{ pending: isPlaceholder(address) }"
          >{{ address }}</component
        >
        <span v-if="city" class="sub" :class="{ pending: isPlaceholder(city) }">{{ city }}</span>
      </dd>
    </div>

    <div v-if="hours || hoursPlaceholder" class="row">
      <dt>Horarios</dt>
      <dd>
        <table v-if="hours" class="hours">
          <tbody>
            <tr v-for="row in hours" :key="row.days">
              <th scope="row">{{ row.days }}</th>
              <td>{{ row.hours }}</td>
            </tr>
          </tbody>
        </table>
        <span v-else class="pending">{{ hoursPlaceholder }}</span>
      </dd>
    </div>

    <div v-if="phone || whatsapp" class="row">
      <dt>Contacto</dt>
      <dd>
        <a
          v-if="phone && !isPlaceholder(phone)"
          :href="`tel:${phone.replace(/[^\d+]/g, '')}`"
          >{{ phone }}</a
        >
        <span v-else-if="phone" class="pending">{{ phone }}</span>
        <a v-if="whatsapp" :href="whatsapp" class="sub" target="_blank" rel="noopener"
          >WhatsApp</a
        >
      </dd>
    </div>

    <div v-if="optician" class="row">
      <dt>Óptico responsable</dt>
      <dd>
        <span class="signature" :class="{ pending: isPlaceholder(optician) }">{{ optician }}</span>
        <span v-if="license" class="sub" :class="{ pending: isPlaceholder(license) }"
          >Matrícula {{ license }}</span
        >
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.store-card {
  margin: 0;
  border-top: 2px solid var(--color-ink);
  border-bottom: 1px solid var(--color-ink);
}

.row {
  display: grid;
  gap: 4px 24px;
  padding: 16px 0;
}

.row + .row {
  border-top: 1px solid var(--color-line);
}

@media (min-width: 480px) {
  .row {
    grid-template-columns: 9.5rem minmax(0, 1fr);
  }
}

dt {
  color: var(--color-ink-soft);
  font-size: var(--step--1);
  padding-top: 3px;
}

dd {
  display: grid;
  gap: 2px;
  justify-items: start;
  margin: 0;
  font-size: 1.0625rem;
}

dd a {
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.sub {
  color: var(--color-ink-soft);
  font-size: var(--step-0);
}

.signature {
  font-family: var(--font-display);
  font-size: 1.5rem;
  line-height: 1.2;
}

.hours {
  border-collapse: collapse;
}

.hours th {
  padding: 0 20px 2px 0;
  font-weight: 400;
  text-align: left;
}

.hours td {
  padding: 0 0 2px;
  font-variant-numeric: tabular-nums;
}

/* Solo se ve en desarrollo: marca el dato que falta cargar. */
.pending {
  color: #b4441c;
  font-family: var(--font-body);
  font-size: var(--step-0);
}
</style>
