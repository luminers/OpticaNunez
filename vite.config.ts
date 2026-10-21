import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // `npm run build:pages`: el sitio vive en https://luminers.github.io/OpticaNunez/
  base: mode === 'pages' ? '/OpticaNunez/' : '/',
  plugins: [
    vue(),
    vueDevTools(),
    // `npm run dev:celular`: https con certificado propio y visible en la red local,
    // para probar la cámara desde el teléfono (los navegadores solo la habilitan con https).
    ...(mode === 'celular' ? [basicSsl({ name: 'optica-nunez-dev' })] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
