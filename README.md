# Óptica Núñez — tienda online

Catálogo, ficha de producto y probador virtual a escala real con la cámara.
Vue 3 + Vite + TypeScript + Vue Router + Pinia + Supabase. Contexto completo del proyecto en [CLAUDE.md](CLAUDE.md).

**Online:** https://luminers.github.io/OpticaNunez/

## Arranque

```sh
npm install
cp .env.example .env.local   # completar URL y publishable key de Supabase
npm run dev
```

Sin credenciales en `.env.local` la web usa los datos de ejemplo de `src/data/mock-products.ts`.

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run dev:celular` — igual, pero con https y visible en la red local, para probar la cámara desde el teléfono
- `npm run build` — type-check + build de producción
- `npm run build:pages` — build para GitHub Pages (subcarpeta `/OpticaNunez/` + `404.html`)
- `npm run lint` — oxlint + eslint
- `npm run format` — prettier

## Publicación

Cada push a `main` compila y publica en GitHub Pages ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

## Base de datos

Esquema y políticas de seguridad en [supabase/migrations/](supabase/migrations/); datos de ejemplo en [supabase/seed.sql](supabase/seed.sql).
