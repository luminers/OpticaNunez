# Óptica Núñez — contexto del proyecto

Tienda online para la óptica de la familia. Objetivo: llevar la óptica al mercado online con catálogo, compra con Mercado Pago y un **probador virtual a escala real** como funcionalidad estrella. Toda la conversación y la UI son en español.

## Stack

- **Frontend:** Vue 3 + Vite + TypeScript, Vue Router, Pinia. (Se evaluó Nuxt 3 por SEO; por ahora Vue puro. Si el SEO del catálogo se vuelve prioridad, reconsiderar migrar a Nuxt.)
- **Backend:** Supabase — Postgres (catálogo, pedidos, clientes), Auth (clientes + panel admin), Storage (fotos, modelos 3D, recetas), Edge Functions (lógica sensible).
- **Pagos:** Mercado Pago (Checkout Pro o Bricks). La creación de preferencias y el webhook de confirmación van **solo** en Edge Functions; el frontend solo usa la public key. La access token nunca toca el cliente.
- **Probador virtual (hecho, 2D):** MediaPipe Face Landmarker `@mediapipe/tasks-vision@1.0.1` (versión fija; wasm y modelo `public/models/face_landmarker.task` servidos desde el sitio, sin CDN). Escala real con el diámetro horizontal del iris (11,7 mm). El frente se dibuja en canvas desde las medidas del producto (`sizes`) y la forma de [frame-geometry](src/data/frame-geometry.ts). Futuro: Three.js + `.glb` reemplazando solo [drawGlasses](src/tryon/drawGlasses.ts).

## Referencias de diseño

La web se basa en estas dos páginas (bloquean descargas automáticas; usar las capturas en [referencias/](referencias/)):

- https://www.warbyparker.com/sunglasses — estética general y catálogo
- https://www.lenscrafters.com/lc-us/virtual-try-on — navegación y probador virtual

Qué tomar de cada una:

- **Warby Parker:** estética cálida y limpia (titulares serif + texto sans), hero a pantalla completa con CTAs en píldora, franja de beneficios, sidebar de filtros ocultable con contador de modelos, tarjeta de producto con fondo crema redondeado, favorito, **botón "Probar" en la tarjeta**, swatches de color y "Elegir lentes y comprar".
- **LensCrafters:** barra utilitaria superior (local, ayuda, carrusel de avisos, guardados, cuenta), mega-menú de 3 columnas (categorías con avatar, destacados, promo), franja promocional, badges en tarjetas, miniaturas por variante de color, y una página "Probador virtual" que es el catálogo filtrado a modelos probables.

Menú propuesto: Recetados · Sol · Lentes de contacto · Marcas · Turno examen visual · Obras sociales · Promos.
Beneficios propuestos: cuotas sin interés con Mercado Pago, envío, cambios, obras sociales.

## Modelo de datos (borrador)

Producto → variantes de color (cada una con fotos y modelo 3D para el probador) + `sizes` (anchos en que se fabrica, cada uno con lente/puente/patilla/alto en mm; el probador los usa para la escala real) + badges + atributos filtrables (forma, material, ancho de cara, género). Tipos en [src/types/catalog.ts](src/types/catalog.ts).

## Pendientes / preguntas abiertas

- Capturas faltantes: probador de LensCrafters con la cámara abierta; flujo "Elegir lentes" de Warby Parker (tipo de lente → graduación → pago).
- Confirmar con la óptica los beneficios de `STORE_PERKS` en [catalog-labels](src/data/catalog-labels.ts) (envío a todo el país, retiro en el local) y el texto "Pagá en cuotas con Mercado Pago" de la ficha.
- País de operación (afecta Mercado Pago, envíos y normativa de venta de lentes recetados).
- ¿Solo armazones/sol o también lentes graduados con carga de receta?
- Tamaño aproximado del catálogo (impacta el costo de modelos 3D).
- Envío, retiro en local o ambos.

## Estado

- **Home hecha:** [src/views/HomeView.vue](src/views/HomeView.vue) en `/`. Hero con plano del armazón y sus medidas reales (calibre □ puente patilla) que cambia por forma ([FrameBlueprint](src/components/home/FrameBlueprint.vue)), beneficios, accesos a categorías, banda del probador (verde botella), "Los más elegidos" (`getFeatured`) y servicios del local. Footer global en [AppFooter](src/components/layout/AppFooter.vue).
- **Catálogo hecho** (estilo Warby Parker): [src/views/CatalogView.vue](src/views/CatalogView.vue) en `/anteojos-de-sol` y `/anteojos-recetados`. Filtros y orden viven en la URL ([useCatalogFilters](src/composables/useCatalogFilters.ts)).
- **Supabase:** proyecto `gxkzugzmsjyjnpybunuc` (us-east-1). Esquema en [supabase/migrations/](supabase/migrations/) (products, product_variants con `sku` legible que viaja en `?color=`, product_sizes; RLS: solo lectura de productos activos, sin escritura pública). Datos de ejemplo en [supabase/seed.sql](supabase/seed.sql), generados desde [src/data/mock-products.ts](src/data/mock-products.ts). [src/services/catalog.ts](src/services/catalog.ts) lee de Supabase si `.env.local` tiene URL + clave; si no, usa los mocks. Productos sin variantes o sin medidas se descartan.
- **Supabase aplicado** (2026-10-21): migraciones `catalogo`, `seguridad_y_storage` y `cerrar_rls_auto_enable` (en el repo, las dos últimas juntas en `20261021130000_seguridad_y_storage.sql`). `anon`/`authenticated` solo tienen `SELECT` en el catálogo; la carga se hace con el rol de servicio (panel). Bucket público `catalogo` (fotos webp/avif/jpg/png y `.glb`, máx. 20 MB) sin políticas en `storage.objects`: se lee por URL pública, no se puede listar ni subir desde la web. Las recetas irán en un bucket **privado** aparte. `.env.local` usa la publishable key (`sb_publishable_…`). Advisors de seguridad en cero. Toda migración nueva: aplicarla con el MCP **y** guardarla en `supabase/migrations/`, y correr los advisors después.
- Sin fotos todavía: [FrameIllustration](src/components/catalog/FrameIllustration.vue) dibuja el armazón en SVG; si la variante tiene `images`, se usa la foto.
- **Ficha de producto hecha** (base Warby Parker, captura en [referencias/warby-ficha-producto.png](referencias/warby-ficha-producto.png)): [src/views/ProductView.vue](src/views/ProductView.vue) en `/producto/:slug`. Galería con vistas frente / medidas (dibujo acotado + notación de patilla 52 □ 19 145) / costado; color y ancho en la URL (`?color=&ancho=`); guía de ancho; detalles; relacionados. En celular: galería deslizable con puntos, barra fija "Elegir lentes" y relacionados en carrusel.
- La altura real del header se publica en `--header-height` (ResizeObserver en [AppHeader](src/components/layout/AppHeader.vue)); usarla para cualquier elemento sticky.
- Ojo: inputs con `.visually-hidden` (position absolute) necesitan un ancestro con `position: relative`, si no escapan de los carruseles y ensanchan la página en celular. Un `<select>` mide lo que su opción más larga: dentro de un flex darle `min-width: 0; flex: 1 1 auto`. Probar siempre hasta 280 px (Galaxy Fold del modo dispositivo de Chrome).
- **Probador hecho:** [src/views/TryOnView.vue](src/views/TryOnView.vue) en `/probador/:slug` (`?color=&ancho=`). Pose y medidas en [src/tryon/pose.ts](src/tryon/pose.ts) (funciones puras: escala, distancia pupilar, ancho de cara en sienes 127/356, suavizado, veredicto ±6 mm contra `frameTotalWidthMm`). Sacar foto, cota sobre el armazón, otros modelos sin apagar la cámara, errores de permiso/cámara/https. `?debug=1` loguea ejes del iris y pose para calibrar. La cámara necesita https (o localhost): en un celular por la red local no funciona sin certificado.
- Pendiente de calibrar: comparar la distancia pupilar del probador con el pupilómetro de la óptica en varias personas y ajustar `IRIS_DIAMETER_MM` si hay sesgo.
- El botón "Probar" sigue mostrándose solo si la variante tiene `tryOnModelUrl`, aunque el probador 2D funciona con cualquier producto que tenga medidas.
- Lugares reservados (rutas a `PendingView`): `/producto/:slug/lentes` (paso "Elegir lentes"), cuenta, búsqueda, favoritos, carrito y secciones del menú.
- Favoritos en Pinia + localStorage ([src/stores/favorites.ts](src/stores/favorites.ts)).

## Sistema visual

Tokens en [src/assets/main.css](src/assets/main.css). Fondo blanco, tarjetas salvia pálido `#EEF1EE`, tinta `#1D2B2A`, acento verde botella `#1F5C4E` (reservado para "Probar", la funcionalidad estrella). Tipografías (elegidas por parecido a LensCrafters): Forum (logo, títulos, nombres de modelo) + Figtree (texto, menú, botones, precios). Evitar: mayúsculas en etiquetas, flechas decorativas en botones, sombras y animaciones de hover en tarjetas.
