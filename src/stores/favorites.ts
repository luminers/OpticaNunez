import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'optica-nunez:favoritos'

function readStored(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

// Guarda en el navegador; cuando haya login se sincroniza con Supabase.
export const useFavoritesStore = defineStore('favorites', () => {
  const ids = ref<string[]>(readStored())
  const count = computed(() => ids.value.length)

  function isFavorite(productId: string) {
    return ids.value.includes(productId)
  }

  function toggle(productId: string) {
    ids.value = isFavorite(productId)
      ? ids.value.filter((id) => id !== productId)
      : [...ids.value, productId]
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.value))
    } catch {
      // Sin almacenamiento disponible los favoritos duran solo esta visita.
    }
  }

  return { ids, count, isFavorite, toggle }
})
