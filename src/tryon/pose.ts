// Cálculo de pose y escala real a partir de los 478 puntos de MediaPipe Face Landmarker.
// Todo en píxeles de la imagen ya espejada (como se ve en pantalla, tipo selfie).

/** Diámetro horizontal del iris visible en adultos: casi constante entre personas. */
export const IRIS_DIAMETER_MM = 11.7

// Índices del modelo con iris (478 puntos).
const LEFT_IRIS = { center: 468, ring: [469, 470, 471, 472] }
const RIGHT_IRIS = { center: 473, ring: [474, 475, 476, 477] }
const NOSE_TIP = 1
// Puntos del contorno a la altura de las sienes, donde apoyan las patillas.
const TEMPLE_LEFT = 127
const TEMPLE_RIGHT = 356

export interface Landmark {
  x: number
  y: number
  z?: number
}

export interface Point {
  x: number
  y: number
}

export interface FacePose {
  /** Punto medio entre las pupilas. */
  center: Point
  /** Inclinación de la cabeza (radianes, sentido horario positivo). */
  roll: number
  /** Giro izquierda/derecha (radianes, positivo cuando la nariz apunta a la derecha de la pantalla). */
  yaw: number
  /** Cabeceo (radianes, positivo mirando hacia arriba). */
  pitch: number
  /** Píxeles por milímetro sobre el plano de la cara. */
  pxPerMm: number
  /** Diámetro del iris en píxeles: sirve para saber si la persona está muy lejos. */
  irisPx: number
  /** Distancia pupilar en mm, corregida por el giro. */
  pupillaryDistanceMm: number
  /** Ancho de la cara a la altura de las sienes, en mm. */
  faceWidthMm: number
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function toPixels(landmarks: Landmark[], width: number, height: number, mirrored: boolean) {
  return (index: number): Point => {
    const p = landmarks[index]
    if (!p) throw new Error(`Falta el punto ${index}: se necesita el modelo con iris (478 puntos)`)
    return { x: (mirrored ? 1 - p.x : p.x) * width, y: p.y * height }
  }
}

/**
 * Diámetro del iris: el mayor entre el eje horizontal y el vertical del anillo.
 * En la práctica gana el horizontal (el vertical lo recortan los párpados), que es
 * el que corresponde a los 11,7 mm.
 */
function irisDiameter(at: (i: number) => Point, ring: number[]) {
  const [a, b, c, d] = ring.map(at) as [Point, Point, Point, Point]
  return Math.max(distance(a, c), distance(b, d))
}

/** Ejes del iris de cada ojo, en píxeles. Para diagnóstico y calibración (`?debug=1`). */
export function irisAxes(landmarks: Landmark[], width: number, height: number) {
  const at = toPixels(landmarks, width, height, false)
  const axes = (ring: number[]) => {
    const [a, b, c, d] = ring.map(at) as [Point, Point, Point, Point]
    return { horizontal: distance(a, c), vertical: distance(b, d) }
  }
  return { left: axes(LEFT_IRIS.ring), right: axes(RIGHT_IRIS.ring) }
}

/**
 * Giro y cabeceo desde la matriz de la cabeza de MediaPipe (`facialTransformationMatrixes`).
 * La matriz lleva la cara canónica (que mira hacia +Z) al espacio de la cámara: X hacia la
 * derecha de la imagen sin espejar, Y hacia arriba y la cara en Z negativo. Viene en orden
 * por columnas, como la usa Three.js. Los ángulos se miden contra la línea que va de la cara
 * a la cámara, no contra el eje de la cámara: una cara en el borde del cuadro que mira a la
 * cámara se ve de frente.
 */
export function headAngles(matrix: number[], mirrored = true) {
  const [fx, fy, fz] = [matrix[8]!, matrix[9]!, matrix[10]!]
  const [tx, ty, tz] = [matrix[12]!, matrix[13]!, matrix[14]!]
  const yaw = Math.atan2(fx, fz) - Math.atan2(-tx, -tz)
  const pitch = Math.atan2(fy, Math.hypot(fx, fz)) - Math.atan2(-ty, Math.hypot(tx, tz))
  return { yaw: mirrored ? -yaw : yaw, pitch }
}

/** Giro aproximado sin matriz: la nariz se corre hacia un lado respecto de las sienes. */
function estimatedYaw(nose: Point, templeA: Point, templeB: Point) {
  const toA = distance(nose, templeA)
  const toB = distance(nose, templeB)
  const asymmetry = (toA - toB) / (toA + toB)
  return Math.asin(Math.max(-0.95, Math.min(0.95, asymmetry * 1.6)))
}

export function computePose(
  landmarks: Landmark[],
  width: number,
  height: number,
  mirrored = true,
  matrix?: number[],
): FacePose {
  const at = toPixels(landmarks, width, height, mirrored)
  const leftPupil = at(LEFT_IRIS.center)
  const rightPupil = at(RIGHT_IRIS.center)
  const [first, second] =
    leftPupil.x <= rightPupil.x ? [leftPupil, rightPupil] : [rightPupil, leftPupil]

  // Al girar la cabeza el iris lejano se achica en perspectiva: se usa el más grande.
  const irisPx = Math.max(irisDiameter(at, LEFT_IRIS.ring), irisDiameter(at, RIGHT_IRIS.ring))
  const pxPerMm = irisPx / IRIS_DIAMETER_MM

  const templeA = at(TEMPLE_LEFT)
  const templeB = at(TEMPLE_RIGHT)
  const { yaw, pitch } =
    matrix && matrix.length >= 16
      ? headAngles(matrix, mirrored)
      : { yaw: estimatedYaw(at(NOSE_TIP), templeA, templeB), pitch: 0 }
  const yawCos = Math.max(Math.cos(yaw), 0.5)

  return {
    // Punto medio entre las pupilas. El corrimiento del armazón al girar lo agrega el dibujo.
    center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    // La inclinación sale de la línea de las pupilas en la imagen: es la que se ve en pantalla.
    roll: Math.atan2(second.y - first.y, second.x - first.x),
    yaw,
    pitch,
    pxPerMm,
    irisPx,
    pupillaryDistanceMm: distance(first, second) / yawCos / pxPerMm,
    faceWidthMm: distance(templeA, templeB) / yawCos / pxPerMm,
  }
}

const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt))

/**
 * Filtro One Euro (Casiez y otros, 2012): un pasa bajos cuyo corte sube con la velocidad.
 * Con la cara quieta filtra fuerte (no tiembla); en movimiento casi no filtra (no se atrasa).
 */
export class OneEuroFilter {
  private value: number | null = null
  private speed = 0
  private time = 0
  private readonly minCutoff: number
  private readonly beta: number
  private readonly speedCutoff: number

  /**
   * @param minCutoff corte en reposo (Hz): más bajo, menos temblor.
   * @param beta cuánto sube el corte por unidad de velocidad: más alto, menos retraso.
   */
  constructor(minCutoff: number, beta: number, speedCutoff = 1) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.speedCutoff = speedCutoff
  }

  /** `time` en segundos; `unit` pasa la velocidad a la unidad en que está pensado `beta`. */
  filter(next: number, time: number, unit = 1) {
    if (this.value === null) {
      this.value = next
      this.time = time
      return next
    }
    const dt = Math.max(time - this.time, 1e-3)
    this.time = time
    this.speed += alpha(this.speedCutoff, dt) * ((next - this.value) / dt - this.speed)
    const cutoff = this.minCutoff + this.beta * Math.abs(this.speed / unit)
    this.value += alpha(cutoff, dt) * (next - this.value)
    return this.value
  }

  reset() {
    this.value = null
    this.speed = 0
  }
}

/**
 * Suaviza la pose entre cuadros para que el armazón no tiemble ni se atrase.
 * Posición, ángulos y escala pasan por filtros One Euro; las medidas, por un promedio
 * lento (no deberían cambiar).
 */
export class PoseSmoother {
  private pose: FacePose | null = null
  private framesStable = 0
  // Posición: beta por mm/s de la cara (moviéndose a 100 mm/s el corte llega a ~6 Hz).
  private readonly x = new OneEuroFilter(1, 0.05)
  private readonly y = new OneEuroFilter(1, 0.05)
  // Ángulos: beta por rad/s (un giro rápido, ~3 rad/s, corta a ~5,5 Hz).
  private readonly roll = new OneEuroFilter(1, 1.5)
  private readonly yaw = new OneEuroFilter(1, 1.5)
  private readonly pitch = new OneEuroFilter(1, 1.5)
  // Escala: beta por cambio relativo por segundo. Casi fija, salvo al acercarse o alejarse.
  private readonly iris = new OneEuroFilter(0.4, 2)
  private readonly settle: number

  constructor(settle = 0.08) {
    this.settle = settle
  }

  /** `timeMs` es la marca de tiempo del cuadro (la de `requestAnimationFrame`). */
  update(next: FacePose, timeMs: number): FacePose {
    // Un salto grande (otra persona, la cabeza salió y volvió) reinicia el suavizado.
    if (this.pose && Math.abs(next.pxPerMm - this.pose.pxPerMm) / this.pose.pxPerMm > 0.35)
      this.reset()
    const prev = this.pose
    const t = timeMs / 1000
    const pxPerMm = prev?.pxPerMm ?? next.pxPerMm
    const irisPx = this.iris.filter(next.irisPx, t, prev?.irisPx ?? next.irisPx)
    const settle = (key: 'pupillaryDistanceMm' | 'faceWidthMm') =>
      prev ? prev[key] + (next[key] - prev[key]) * this.settle : next[key]

    this.pose = {
      center: {
        x: this.x.filter(next.center.x, t, pxPerMm),
        y: this.y.filter(next.center.y, t, pxPerMm),
      },
      roll: this.roll.filter(next.roll, t),
      yaw: this.yaw.filter(next.yaw, t),
      pitch: this.pitch.filter(next.pitch, t),
      irisPx,
      pxPerMm: irisPx / IRIS_DIAMETER_MM,
      pupillaryDistanceMm: settle('pupillaryDistanceMm'),
      faceWidthMm: settle('faceWidthMm'),
    }
    this.framesStable++
    return this.pose
  }

  /** Las medidas se muestran recién cuando hubo suficientes cuadros para estabilizarse. */
  get measuresReady() {
    return this.framesStable >= 20
  }

  reset() {
    this.pose = null
    this.framesStable = 0
    for (const filter of [this.x, this.y, this.roll, this.yaw, this.pitch, this.iris])
      filter.reset()
  }
}

export type FitVerdict = 'angosto' | 'justo' | 'grande'

/**
 * Compara el ancho total del armazón con el ancho de la cara en las sienes.
 * Un armazón bien elegido queda dentro de ±6 mm.
 */
export function fitVerdict(frameWidthMm: number, faceWidthMm: number): FitVerdict {
  const diff = frameWidthMm - faceWidthMm
  if (diff < -6) return 'angosto'
  if (diff > 6) return 'grande'
  return 'justo'
}

/** Ancho total del frente: dos lentes, el puente y los dos laterales (~5 mm cada uno). */
export function frameTotalWidthMm(size: { lensWidth: number; bridge: number }) {
  return size.lensWidth * 2 + size.bridge + 10
}
