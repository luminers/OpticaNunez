// Cálculo de pose y escala real a partir de los 478 puntos de MediaPipe Face Landmarker.
// Todo en píxeles de la imagen ya espejada (como se ve en pantalla, tipo selfie).

/** Diámetro horizontal del iris visible en adultos: casi constante entre personas. */
export const IRIS_DIAMETER_MM = 11.7

// Índices del modelo con iris (478 puntos).
const LEFT_IRIS = { center: 468, ring: [469, 470, 471, 472] }
const RIGHT_IRIS = { center: 473, ring: [474, 475, 476, 477] }
const NOSE_TIP = 1
const BETWEEN_EYES = 168
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
  /** Giro izquierda/derecha estimado (radianes). */
  yaw: number
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

export function computePose(
  landmarks: Landmark[],
  width: number,
  height: number,
  mirrored = true,
): FacePose {
  const at = toPixels(landmarks, width, height, mirrored)
  const leftPupil = at(LEFT_IRIS.center)
  const rightPupil = at(RIGHT_IRIS.center)
  const [first, second] =
    leftPupil.x <= rightPupil.x ? [leftPupil, rightPupil] : [rightPupil, leftPupil]

  // Al girar la cabeza el iris lejano se achica en perspectiva: se usa el más grande.
  const irisPx = Math.max(irisDiameter(at, LEFT_IRIS.ring), irisDiameter(at, RIGHT_IRIS.ring))
  const pxPerMm = irisPx / IRIS_DIAMETER_MM

  // Giro: la nariz se corre hacia un lado respecto de las sienes.
  const templeA = at(TEMPLE_LEFT)
  const templeB = at(TEMPLE_RIGHT)
  const nose = at(NOSE_TIP)
  const toA = distance(nose, templeA)
  const toB = distance(nose, templeB)
  const asymmetry = (toA - toB) / (toA + toB)
  const yaw = Math.asin(Math.max(-0.95, Math.min(0.95, asymmetry * 1.6)))
  const yawCos = Math.max(Math.cos(yaw), 0.5)

  const center = {
    x: (first.x + second.x) / 2,
    // Se toma la altura de las pupilas, alineada con el entrecejo en horizontal.
    y: (first.y + second.y) / 2,
  }
  const bridge = at(BETWEEN_EYES)
  center.x = center.x * 0.5 + bridge.x * 0.5

  return {
    center,
    roll: Math.atan2(second.y - first.y, second.x - first.x),
    yaw,
    pxPerMm,
    irisPx,
    pupillaryDistanceMm: distance(first, second) / yawCos / pxPerMm,
    faceWidthMm: distance(templeA, templeB) / yawCos / pxPerMm,
  }
}

/**
 * Suaviza la pose entre cuadros para que el armazón no tiemble.
 * La posición sigue rápido; la escala y las medidas, lento (no deberían cambiar).
 */
export class PoseSmoother {
  private pose: FacePose | null = null
  private framesStable = 0
  private readonly follow: number
  private readonly settle: number

  constructor(follow = 0.55, settle = 0.08) {
    this.follow = follow
    this.settle = settle
  }

  update(next: FacePose): FacePose {
    const prev = this.pose
    if (!prev) {
      this.pose = next
      this.framesStable = 1
      return next
    }
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    // Un salto grande (otra persona, la cabeza salió y volvió) reinicia el suavizado.
    if (Math.abs(next.pxPerMm - prev.pxPerMm) / prev.pxPerMm > 0.35) {
      this.reset()
      return this.update(next)
    }
    this.pose = {
      center: {
        x: lerp(prev.center.x, next.center.x, this.follow),
        y: lerp(prev.center.y, next.center.y, this.follow),
      },
      roll: lerp(prev.roll, next.roll, this.follow),
      yaw: lerp(prev.yaw, next.yaw, this.follow),
      irisPx: lerp(prev.irisPx, next.irisPx, this.settle * 2),
      pxPerMm: lerp(prev.pxPerMm, next.pxPerMm, this.settle * 2),
      pupillaryDistanceMm: lerp(prev.pupillaryDistanceMm, next.pupillaryDistanceMm, this.settle),
      faceWidthMm: lerp(prev.faceWidthMm, next.faceWidthMm, this.settle),
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
