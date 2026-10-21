import { createRouter, createWebHistory } from 'vue-router'
import CatalogView from '@/views/CatalogView.vue'
import HomeView from '@/views/HomeView.vue'
import PendingView from '@/views/PendingView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'inicio', component: HomeView },
    { path: '/anteojos-de-sol', name: 'sol', component: CatalogView, props: { category: 'sol' } },
    {
      path: '/anteojos-recetados',
      name: 'recetados',
      component: CatalogView,
      props: { category: 'recetados' },
    },
    {
      path: '/producto/:slug',
      name: 'producto',
      component: () => import('@/views/ProductView.vue'),
      props: true,
    },
    {
      path: '/producto/:slug/lentes',
      name: 'lentes',
      component: PendingView,
      props: { title: 'Elegir lentes' },
    },
    {
      path: '/probador/:slug',
      name: 'probador',
      component: () => import('@/views/TryOnView.vue'),
      props: true,
    },
    { path: '/:pathMatch(.*)*', name: 'pendiente', component: PendingView },
  ],
  scrollBehavior(to, from) {
    // Cambiar filtros u orden no debe mover la página.
    return to.path === from.path ? false : { top: 0 }
  },
})

export default router
