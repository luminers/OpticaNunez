// Datos del local que dan respaldo a la tienda (header, home, ficha y footer).
// PENDIENTE: completarlos con la óptica. Un dato en null no se muestra en producción;
// en desarrollo aparece como "[a completar]" para ver dónde falta.

export interface OpeningHours {
  /** 0 = domingo … 6 = sábado */
  days: number[]
  open: string
  close: string
}

export const STORE_INFO = {
  name: 'Óptica Núñez',
  legalName: null as string | null,
  cuit: null as string | null,
  /** Año de apertura del local. */
  since: null as number | null,
  street: null as string | null,
  city: null as string | null,
  mapsUrl: null as string | null,
  phone: null as string | null,
  /** Solo números, con código de país: 5491112345678 */
  whatsapp: null as string | null,
  email: null as string | null,
  /** Óptico técnico responsable y su matrícula. */
  optician: null as string | null,
  license: null as string | null,
  hours: [] as OpeningHours[],
  /** Link del formulario "Data Fiscal" de ARCA (ex AFIP), con su QR. */
  dataFiscalUrl: null as string | null,
}

const PLACEHOLDER = '[a completar]'

/** El dato, el aviso en desarrollo o null (para ocultar con v-if) en producción. */
export function storeField(value: string | number | null): string | null {
  if (value !== null && value !== '') return String(value)
  return import.meta.env.DEV ? PLACEHOLDER : null
}

export function isPlaceholder(value: string | null) {
  return value === PLACEHOLDER
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function formatTime(time: string) {
  const [h, m] = time.split(':')
  return m === '00' ? `${Number(h)}` : `${Number(h)}:${m}`
}

function formatRange(ranges: OpeningHours[]) {
  return ranges.map((r) => `${formatTime(r.open)} a ${formatTime(r.close)} h`).join(' y ')
}

/** Horario de la semana, de lunes a domingo, agrupando días seguidos con el mismo horario. */
export function weeklyHours(): { days: string; hours: string }[] {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const rows: { from: number; to: number; hours: string }[] = []
  for (const day of order) {
    const ranges = STORE_INFO.hours.filter((h) => h.days.includes(day))
    const hours = ranges.length ? formatRange(ranges) : 'Cerrado'
    const last = rows.at(-1)
    if (last && last.hours === hours) last.to = day
    else rows.push({ from: day, to: day, hours })
  }
  return rows.map((row) => ({
    days:
      row.from === row.to
        ? DAY_NAMES[row.from]!
        : `${DAY_NAMES[row.from]} a ${DAY_NAMES[row.to]!.toLowerCase()}`,
    hours: row.hours,
  }))
}

/** "Abierto hasta las 20 h", "Abre a las 9 h", "Cerrado hoy" o null si no hay horarios. */
export function todayStatus(now = new Date()): string | null {
  if (!STORE_INFO.hours.length) return null
  const minutes = now.getHours() * 60 + now.getMinutes()
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h! * 60 + m!
  }
  const today = STORE_INFO.hours
    .filter((h) => h.days.includes(now.getDay()))
    .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))
  const current = today.find((h) => minutes >= toMinutes(h.open) && minutes < toMinutes(h.close))
  if (current) return `Abierto hasta las ${formatTime(current.close)} h`
  const next = today.find((h) => minutes < toMinutes(h.open))
  if (next) return `Hoy abre a las ${formatTime(next.open)} h`
  return 'Cerrado por hoy'
}

export function whatsappUrl(text?: string) {
  if (!STORE_INFO.whatsapp) return null
  const query = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${STORE_INFO.whatsapp}${query}`
}
