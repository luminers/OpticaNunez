<script setup lang="ts">
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ColorSwatches from '@/components/catalog/ColorSwatches.vue'
import FrameIllustration from '@/components/catalog/FrameIllustration.vue'
import { WIDTH_LABELS } from '@/data/catalog-labels'
import { getCatalog, getProduct } from '@/services/catalog'
import { drawGlasses, drawMeasureOverlay, type GlassesStyle } from '@/tryon/drawGlasses'
import type { TryOn3D } from '@/tryon/three/TryOn3D'
import {
  computePose,
  irisAxes,
  fitVerdict,
  frameTotalWidthMm,
  PoseSmoother,
  type FacePose,
} from '@/tryon/pose'
import type { FaceWidth, Product } from '@/types/catalog'
import { formatPrice } from '@/utils/format'

const props = defineProps<{ slug: string }>()

const route = useRoute()
const router = useRouter()

// --- Producto, color y ancho (igual que en la ficha: viven en la URL) ---

const product = ref<Product | null>(null)
const others = ref<Product[]>([])
const loading = ref(true)
const loadFailed = ref(false)
let lastRequest = 0

async function load(slug: string) {
  const request = ++lastRequest
  loading.value = true
  loadFailed.value = false
  try {
    const found = await getProduct(slug)
    const sameCategory = found ? await getCatalog(found.category) : []
    if (request !== lastRequest) return
    product.value = found
    others.value = sameCategory.filter((p) => p.id !== found?.id)
    document.title = found
      ? `Probador: ${found.name} | Óptica Núñez`
      : 'Modelo no encontrado | Óptica Núñez'
  } catch {
    if (request === lastRequest) loadFailed.value = true
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(() => props.slug, load, { immediate: true })

const variantId = ref('')
const width = ref<FaceWidth>('medio')

watch(product, (p) => {
  if (!p) return
  variantId.value = (p.variants.find((v) => v.id === route.query.color) ?? p.variants[0])!.id
  width.value = (p.sizes.find((s) => s.width === route.query.ancho) ?? p.sizes[0])!.width
})

watch([variantId, width], ([color, ancho]) => {
  if (!product.value || !color) return
  if (route.query.color === color && route.query.ancho === ancho) return
  router.replace({ query: { ...route.query, color, ancho } })
})

const variant = computed(
  () => product.value?.variants.find((v) => v.id === variantId.value) ?? product.value?.variants[0],
)
const size = computed(
  () => product.value?.sizes.find((s) => s.width === width.value) ?? product.value?.sizes[0],
)
const stamp = computed(() =>
  size.value ? `${size.value.lensWidth} □ ${size.value.bridge} ${size.value.templeLength}` : '',
)
const frameWidth = computed(() => (size.value ? frameTotalWidthMm(size.value) : 0))
const productLink = computed(() => ({
  name: 'producto',
  params: { slug: props.slug },
  query: { color: variantId.value, ancho: width.value },
}))
const buyLink = computed(() => ({ ...productLink.value, name: 'lentes' }))

// El bucle de dibujo lee este estilo sin pasar por la reactividad en cada cuadro.
let glassesStyle: GlassesStyle | null = null
watch(
  [product, variant, size],
  ([p, v, s]) => {
    glassesStyle =
      p && v && s
        ? {
            shape: p.shape,
            material: p.material,
            frameColor: v.frameColor,
            lensTint: v.lensTint,
            size: s,
          }
        : null
  },
  { immediate: true },
)

function tryOther(other: Product) {
  router.replace({ name: 'probador', params: { slug: other.slug } })
}

// --- Cámara y detección ---

type Phase = 'intro' | 'starting' | 'running' | 'error'
type CameraError = 'denied' | 'notfound' | 'busy' | 'insecure' | 'unsupported' | 'model'

const ERROR_COPY: Record<CameraError, { title: string; body: string; retry: boolean }> = {
  denied: {
    title: 'La cámara está bloqueada',
    body: 'Habilitala desde el ícono de la barra de direcciones (el candado o la cámara) y volvé a intentar.',
    retry: true,
  },
  notfound: {
    title: 'No encontramos una cámara',
    body: 'Conectá una cámara o abrí esta página desde tu celular.',
    retry: true,
  },
  busy: {
    title: 'La cámara está en uso',
    body: 'Cerrá las otras aplicaciones que la estén usando (videollamadas, por ejemplo) y volvé a intentar.',
    retry: true,
  },
  insecure: {
    title: 'El probador necesita una conexión segura',
    body: 'La cámara solo funciona en páginas con https. Abrí la dirección segura del sitio.',
    retry: false,
  },
  unsupported: {
    title: 'Tu navegador no permite usar la cámara',
    body: 'Probá con una versión actual de Chrome, Safari, Edge o Firefox.',
    retry: false,
  },
  model: {
    title: 'No pudimos cargar el probador',
    body: 'Revisá tu conexión a internet y volvé a intentar.',
    retry: true,
  },
}

const phase = ref<Phase>('intro')
const cameraError = ref<CameraError | null>(null)
const errorCopy = computed(() => (cameraError.value ? ERROR_COPY[cameraError.value] : null))

const videoEl = ref<HTMLVideoElement>()
const canvasEl = ref<HTMLCanvasElement>()
const landmarker = shallowRef<FaceLandmarker | null>(null)
let stream: MediaStream | null = null
let frameRequest = 0

const showMeasures = ref(false)
const faceVisible = ref(false)
const tooFar = ref(false)
const measures = ref<{ pupillaryDistanceMm: number; faceWidthMm: number } | null>(null)
const photoSaved = ref(false)

function cameraErrorFrom(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  return 'unsupported'
}

async function startCamera() {
  cameraError.value = null
  if (!window.isSecureContext) return fail('insecure')
  if (!navigator.mediaDevices?.getUserMedia) return fail('unsupported')
  phase.value = 'starting'
  if (draw3d) ensureEngine3d()

  // El modelo se empieza a descargar mientras la persona responde el permiso.
  const landmarkerReady = landmarker.value
    ? Promise.resolve(landmarker.value)
    : import('@/tryon/landmarker').then((m) => m.createFaceLandmarker())

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
  } catch (error) {
    landmarkerReady.catch(() => {})
    return fail(cameraErrorFrom(error))
  }

  try {
    landmarker.value = await landmarkerReady
  } catch {
    stopCamera()
    return fail('model')
  }

  const video = videoEl.value!
  video.srcObject = stream
  await video.play()
  phase.value = 'running'
  smoother.reset()
  engine3d?.reset()
  frameRequest = requestAnimationFrame(renderFrame)
}

function fail(kind: CameraError) {
  cameraError.value = kind
  phase.value = 'error'
}

function stopCamera() {
  cancelAnimationFrame(frameRequest)
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}

onBeforeUnmount(() => {
  stopCamera()
  landmarker.value?.close()
  unmounted = true
  engine3d?.dispose()
})

// Armazón 3D (en evaluación): por ahora solo en estos modelos. `?motor=2d` o `?motor=3d`
// fuerza uno u otro para comparar. Three.js se descarga recién al activar la cámara, y si el
// dispositivo no tiene WebGL se sigue con el dibujo 2D.
const TRYON_3D_SLUGS = new Set(['palermo'])
const use3d = computed(
  () =>
    route.query.motor === '3d' || (route.query.motor !== '2d' && TRYON_3D_SLUGS.has(props.slug)),
)
let draw3d = false
let engine3d: TryOn3D | null = null
let engine3dLoading: Promise<void> | null = null
let unmounted = false

function ensureEngine3d() {
  if (engine3d || engine3dLoading) return
  engine3dLoading = import('@/tryon/three/TryOn3D')
    .then(({ TryOn3D }) => {
      const engine = new TryOn3D()
      if (unmounted) engine.dispose()
      else engine3d = engine
    })
    .catch((error) => console.warn('[probador] Sin armazón 3D, se usa el dibujo 2D', error))
}

watch(
  use3d,
  (on) => {
    draw3d = on
    if (on && phase.value !== 'intro') ensureEngine3d()
  },
  { immediate: true },
)

// Bucle por cuadro: detección + dibujo. El estado reactivo se actualiza unas 4 veces por segundo.
const smoother = new PoseSmoother()
let pose: FacePose | null = null
let lastVideoTime = -1
let lastFaceAt = 0
let lastUiUpdate = 0
// Con ?debug=1 se registran en consola los ejes del iris y la pose, para calibrar en dispositivos reales.
const debug = route.query.debug === '1'
let lastDebugLog = 0

function renderFrame(now: number) {
  frameRequest = requestAnimationFrame(renderFrame)
  const video = videoEl.value
  const canvas = canvasEl.value
  const detector = landmarker.value
  if (!video || !canvas || !detector || video.readyState < 2) return

  const w = video.videoWidth
  const h = video.videoHeight
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime
    const result = detector.detectForVideo(video, now)
    const landmarks = result.faceLandmarks[0]
    if (landmarks) {
      const matrix = result.facialTransformationMatrixes?.[0]?.data
      pose = smoother.update(computePose(landmarks, w, h, true, matrix), now)
      if (matrix) engine3d?.track(matrix, now)
      lastFaceAt = now
      if (debug && now - lastDebugLog > 1000) {
        lastDebugLog = now
        const motor = draw3d && engine3d ? '3d' : '2d'
        console.info('[probador]', JSON.stringify({ motor, iris: irisAxes(landmarks, w, h), pose }))
      }
    } else if (now - lastFaceAt > 400) {
      pose = null
      smoother.reset()
      engine3d?.reset()
    }
  }

  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, w, h)
  ctx.restore()
  if (pose && glassesStyle) {
    if (draw3d && engine3d) engine3d.setStyle(glassesStyle)
    if (draw3d && engine3d?.render(pose, w, h)) {
      // El 3D se calcula sin espejar: se espeja igual que el video.
      ctx.save()
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(engine3d.canvas, 0, 0, w, h)
      ctx.restore()
      if (showMeasures.value) drawMeasureOverlay(ctx, pose, glassesStyle.size)
    } else drawGlasses(ctx, pose, glassesStyle, { showMeasures: showMeasures.value })
  }

  if (now - lastUiUpdate > 250) {
    lastUiUpdate = now
    faceVisible.value = !!pose
    // Con el iris por debajo de ~1,6 % del ancho la cara está muy lejos para medir bien.
    tooFar.value = !!pose && pose.irisPx < w * 0.016
    measures.value =
      pose && smoother.measuresReady
        ? {
            pupillaryDistanceMm: Math.round(pose.pupillaryDistanceMm),
            faceWidthMm: Math.round(pose.faceWidthMm),
          }
        : null
  }
}

const verdict = computed(() =>
  measures.value ? fitVerdict(frameWidth.value, measures.value.faceWidthMm) : null,
)

// Si no le queda bien, se sugiere el ancho siguiente o el anterior cuando existe.
const suggestedWidth = computed(() => {
  const p = product.value
  if (!p || !verdict.value || verdict.value === 'justo') return null
  const index = p.sizes.findIndex((s) => s.width === width.value)
  const next = p.sizes[verdict.value === 'angosto' ? index + 1 : index - 1]
  return next?.width ?? null
})

function savePhoto() {
  canvasEl.value?.toBlob(
    (blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `optica-nunez-${props.slug}.jpg`
      link.click()
      URL.revokeObjectURL(url)
      photoSaved.value = true
      setTimeout(() => (photoSaved.value = false), 2500)
    },
    'image/jpeg',
    0.92,
  )
}
</script>

<template>
  <main class="page">
    <p v-if="loading && !product" class="status">Cargando probador</p>

    <div v-else-if="loadFailed" class="missing">
      <h1>No pudimos cargar este modelo</h1>
      <p>Revisá tu conexión e intentá de nuevo.</p>
      <button type="button" class="solid-button" @click="load(slug)">Reintentar</button>
    </div>

    <div v-else-if="!product || !variant || !size" class="missing">
      <h1>No encontramos este modelo</h1>
      <p>Puede que ya no esté disponible. Elegí otro del catálogo para probártelo.</p>
      <RouterLink to="/anteojos-de-sol" class="solid-button">Ver anteojos de sol</RouterLink>
    </div>

    <div v-else class="tryon">
      <section class="stage" :class="`stage-${phase}`" aria-label="Probador con cámara">
        <video ref="videoEl" class="video" playsinline muted />
        <canvas
          v-show="phase === 'running'"
          ref="canvasEl"
          class="canvas"
          role="img"
          :aria-label="`Vista de la cámara con el ${product.name} puesto`"
        />

        <div v-if="phase === 'intro' || phase === 'starting'" class="intro">
          <FrameIllustration
            class="intro-frame"
            view="medidas"
            :shape="product.shape"
            :material="product.material"
            :frame-color="variant.frameColor"
            :lens-tint="variant.lensTint"
            :measures="size"
          />
          <h1 class="intro-title">Probate el {{ product.name }} a tamaño real</h1>
          <p class="intro-text">
            La cámara mide tu cara y te muestra el armazón con sus medidas reales,
            {{ stamp }}. La imagen no sale de tu dispositivo.
          </p>
          <button
            type="button"
            class="camera-button"
            :disabled="phase === 'starting'"
            @click="startCamera"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"
              />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {{ phase === 'starting' ? 'Preparando la cámara' : 'Activar cámara' }}
          </button>
          <p class="intro-tip">Para medir bien: buena luz, de frente y a unos 40 cm.</p>
        </div>

        <div v-if="phase === 'error' && errorCopy" class="intro" role="alert">
          <h1 class="intro-title">{{ errorCopy.title }}</h1>
          <p class="intro-text">{{ errorCopy.body }}</p>
          <button v-if="errorCopy.retry" type="button" class="camera-button" @click="startCamera">
            Volver a intentar
          </button>
        </div>

        <template v-if="phase === 'running'">
          <p class="stage-stamp" aria-hidden="true">{{ stamp }}</p>
          <p v-if="!faceVisible" class="hint" role="status">Mirá de frente a la cámara</p>
          <p v-else-if="tooFar" class="hint" role="status">Acercate un poco a la cámara</p>
          <p v-if="photoSaved" class="hint hint-ok" role="status">Foto descargada</p>
        </template>
      </section>

      <section class="panel" aria-labelledby="tryon-name">
        <RouterLink :to="productLink" class="back">Volver a la ficha</RouterLink>
        <div class="heading">
          <h2 id="tryon-name" class="name">{{ product.name }}</h2>
          <p class="price">Desde {{ formatPrice(product.price) }}</p>
        </div>

        <div class="field">
          <p class="field-label">
            Color <span class="field-value">{{ variant.colorName }}</span>
          </p>
          <ColorSwatches
            v-model="variantId"
            :variants="product.variants"
            :product-name="product.name"
          />
        </div>

        <div class="field">
          <p id="tryon-width-label" class="field-label">Ancho</p>
          <div class="widths" role="radiogroup" aria-labelledby="tryon-width-label">
            <label v-for="option in product.sizes" :key="option.width" class="width-option">
              <input
                v-model="width"
                class="visually-hidden"
                type="radio"
                name="tryon-ancho"
                :value="option.width"
              />
              <span>{{ WIDTH_LABELS[option.width] }}</span>
            </label>
          </div>
        </div>

        <div class="fit" aria-live="polite">
          <h3 class="fit-title">Cómo te queda</h3>
          <p v-if="phase !== 'running'" class="fit-note">
            Activá la cámara y te decimos si este ancho es para vos.
          </p>
          <p v-else-if="!measures" class="fit-note">
            Midiendo tu cara. Quedate quieto un segundo, mirando a la cámara.
          </p>
          <template v-else>
            <p class="verdict" :class="`verdict-${verdict}`">
              <template v-if="verdict === 'justo'">Este ancho te queda a medida.</template>
              <template v-else-if="verdict === 'angosto'">Este ancho te queda angosto.</template>
              <template v-else>Este ancho te queda grande.</template>
            </p>
            <button
              v-if="suggestedWidth"
              type="button"
              class="link-button"
              @click="width = suggestedWidth"
            >
              Probar el ancho {{ WIDTH_LABELS[suggestedWidth].toLowerCase() }}
            </button>
            <dl class="fit-data">
              <div>
                <dt>Ancho del armazón</dt>
                <dd>{{ frameWidth }} mm</dd>
              </div>
              <div>
                <dt>Tu cara, a la altura de las sienes</dt>
                <dd>{{ measures.faceWidthMm }} mm</dd>
              </div>
              <div>
                <dt>Tu distancia pupilar</dt>
                <dd>{{ measures.pupillaryDistanceMm }} mm</dd>
              </div>
            </dl>
            <p class="fit-note">
              Son medidas aproximadas, calculadas con la cámara. En el local te las confirmamos.
            </p>
          </template>
        </div>

        <label class="toggle">
          <input v-model="showMeasures" type="checkbox" :disabled="phase !== 'running'" />
          Mostrar el ancho sobre el armazón
        </label>

        <div class="actions">
          <button
            type="button"
            class="outline-button"
            :disabled="phase !== 'running' || !faceVisible"
            @click="savePhoto"
          >
            Sacar foto
          </button>
          <RouterLink :to="buyLink" class="solid-button">Elegir lentes y comprar</RouterLink>
        </div>
      </section>

      <section v-if="others.length" class="others" aria-labelledby="others-title">
        <h2 id="others-title" class="others-title">Probar otro modelo</h2>
        <ul class="others-list">
          <li v-for="other in others" :key="other.id">
            <button type="button" class="other" @click="tryOther(other)">
              <FrameIllustration
                :shape="other.shape"
                :material="other.material"
                :frame-color="other.variants[0]!.frameColor"
                :lens-tint="other.variants[0]!.lensTint"
              />
              <span>{{ other.name }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>

<style scoped>
.page {
  padding-bottom: 72px;
}

.status {
  min-height: 60vh;
  padding: 48px var(--gutter);
  color: var(--color-ink-soft);
}

.missing {
  display: grid;
  gap: 12px;
  justify-items: start;
  max-width: 52ch;
  padding: 80px var(--gutter);
}

.missing h1 {
  font-size: var(--step-3);
}

.missing p {
  color: var(--color-ink-soft);
}

.tryon {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  grid-template-areas:
    'stage panel'
    'others others';
  gap: 32px 40px;
  padding: 24px var(--gutter) 0;
}

/* Escenario: cámara o pantalla de inicio */
.stage {
  position: relative;
  grid-area: stage;
  display: grid;
  place-items: center;
  height: min(calc(100svh - var(--header-height) - 48px), 720px);
  min-height: 420px;
  overflow: hidden;
  border-radius: var(--radius-tile);
  background: var(--color-tile);
}

.stage-running {
  background: var(--color-ink);
}

.video {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.intro {
  display: grid;
  gap: 16px;
  justify-items: center;
  max-width: 46ch;
  padding: 32px 24px;
  text-align: center;
}

.intro-frame {
  width: min(100%, 360px);
  margin-bottom: 8px;
}

.intro-title {
  font-size: var(--step-3);
}

.intro-text {
  color: var(--color-ink-soft);
}

.intro-tip {
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}

.camera-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 14px 26px 14px 22px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-weight: 600;
}

.camera-button:hover:not(:disabled) {
  background: var(--color-accent-strong);
}

.camera-button:disabled {
  opacity: 0.7;
  cursor: progress;
}

.camera-button svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linejoin: round;
}

.stage-stamp {
  position: absolute;
  top: 16px;
  left: 18px;
  font-family: var(--font-display);
  font-size: var(--step-2);
  letter-spacing: 0.04em;
  color: #ffffff;
  text-shadow: 0 1px 4px rgb(0 0 0 / 0.5);
}

.hint {
  position: absolute;
  bottom: 18px;
  left: 50%;
  translate: -50% 0;
  max-width: calc(100% - 32px);
  padding: 9px 18px;
  border-radius: var(--radius-pill);
  background: rgb(29 43 42 / 0.82);
  color: #ffffff;
  font-weight: 600;
  text-align: center;
}

.hint-ok {
  background: var(--color-accent);
}

/* Panel */
.panel {
  grid-area: panel;
  display: grid;
  align-content: start;
  gap: 22px;
}

.back {
  justify-self: start;
  font-size: var(--step--1);
  font-weight: 600;
  text-underline-offset: 3px;
}

.heading {
  display: grid;
  gap: 4px;
}

.name {
  font-size: var(--step-3);
}

.price {
  font-weight: 600;
}

.field {
  display: grid;
  gap: 12px;
}

.field-label {
  font-weight: 600;
}

.field-value {
  margin-left: 6px;
  font-weight: 400;
  color: var(--color-ink-soft);
}

.widths {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.width-option {
  position: relative;
}

.width-option span {
  display: grid;
  place-items: center;
  min-width: 104px;
  height: 48px;
  padding: 0 18px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.width-option input:checked + span {
  border: 1.5px solid var(--color-ink);
}

.width-option input:focus-visible + span {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.fit {
  display: grid;
  gap: 10px;
  padding: 20px 22px;
  border-radius: 14px;
  background: var(--color-tile);
}

.fit-title {
  font-size: var(--step-2);
}

.verdict {
  font-weight: 600;
}

.verdict-justo {
  color: var(--color-accent);
}

.fit-data {
  display: grid;
  gap: 6px;
  margin: 4px 0 0;
}

.fit-data div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.fit-data dt {
  color: var(--color-ink-soft);
}

.fit-data dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.fit-note {
  font-size: var(--step--1);
  color: var(--color-ink-soft);
}

.link-button {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.toggle input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--color-accent);
}

.toggle:has(input:disabled) {
  color: var(--color-ink-soft);
  cursor: default;
}

.actions {
  display: grid;
  gap: 10px;
}

.solid-button,
.outline-button {
  display: block;
  padding: 14px 20px;
  border-radius: var(--radius-pill);
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}

.solid-button {
  border: 0;
  background: var(--color-ink);
  color: var(--color-paper);
}

.outline-button {
  border: 1px solid var(--color-line);
  background: var(--color-paper);
}

.outline-button:hover:not(:disabled) {
  border-color: var(--color-ink);
}

.outline-button:disabled {
  color: var(--color-ink-soft);
  cursor: default;
}

/* Otros modelos */
.others {
  grid-area: others;
  display: grid;
  gap: 16px;
  min-width: 0;
}

.others-title {
  font-size: var(--step-2);
}

.others-list {
  position: relative;
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 0 0 8px;
  overflow-x: auto;
  list-style: none;
  scrollbar-width: thin;
}

.other {
  display: grid;
  gap: 8px;
  justify-items: center;
  width: 150px;
  padding: 16px 14px 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: var(--color-tile);
  font-family: var(--font-display);
  font-size: var(--step-1);
}

.other:hover {
  border-color: var(--color-ink);
}

@media (max-width: 999px) {
  .tryon {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'stage'
      'panel'
      'others';
    gap: 24px;
    padding: 0 0 0;
  }

  /* Ancho completo; alto de un retrato 3:4 sin pasar el 72 % de la pantalla. */
  .stage {
    width: 100%;
    height: min(133.33vw, 72svh);
    min-height: 0;
    border-radius: 0;
  }

  .stage-intro,
  .stage-starting,
  .stage-error {
    height: auto;
  }

  .panel {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: 0 var(--gutter);
  }

  .others {
    padding: 0 0 0 var(--gutter);
  }

  .others-list {
    padding-right: var(--gutter);
  }
}

@media (max-width: 479px) {
  .width-option {
    flex: 1;
  }

  .width-option span {
    min-width: 0;
  }

  .other {
    width: 128px;
  }
}
</style>
