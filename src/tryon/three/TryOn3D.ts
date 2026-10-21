import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { FRAME_AHEAD_OF_PUPILS_MM, type GlassesStyle } from '../drawGlasses'
import { OneEuroFilter, type FacePose } from '../pose'
import { buildGlasses, type BuiltGlasses } from './buildGlasses'

// Probador 3D: dibuja el armazón con Three.js en un canvas aparte, que la vista copia encima
// del video. Todo se calcula en la imagen sin espejar (como la ve MediaPipe) y en mm; la
// vista espeja el resultado junto con el video.
//
// - Rotación: la matriz de la cabeza de MediaPipe (giro, cabeceo e inclinación reales).
// - Posición y escala: el punto entre las pupilas y los px/mm del iris. El armazón se ubica
//   a la profundidad en la que, con la cámara virtual, mide lo mismo que en la imagen.
// - Oclusor: un elipsoide invisible del tamaño de la cabeza que tapa la patilla del lado
//   lejano y la parte de atrás de las dos.

/** Campo de visión vertical de la cámara virtual de MediaPipe: la matriz se estima con él. */
const MEDIAPIPE_VERTICAL_FOV_DEG = 63
/**
 * Campo de visión de la cámara con la que se dibuja, medido en la diagonal de la imagen (las
 * cámaras frontales de celulares y notebooks rondan 70–80°). Con los 63° verticales de
 * MediaPipe la cámara virtual queda a ~15 cm de la cara y la perspectiva se exagera: la
 * cabeza tapa casi toda la patilla.
 */
const DIAGONAL_FOV_DEG = 75
/** Inclinación del frente (la parte de abajo más cerca de la cara), como en un armazón calzado. */
const PANTOSCOPIC_TILT = THREE.MathUtils.degToRad(7)
/** Cabeza aproximada respecto del punto entre las pupilas, en mm. El ancho sale de la medición. */
const HEAD = { centerY: 22, centerZ: -88, radiusY: 115, radiusZ: 90 }
const FACE_WIDTH_RANGE_MM: [number, number] = [115, 165]
/** Tramo de la patilla antes de la curva de la oreja: se usa para abrirla o cerrarla. */
const TEMPLE_REACH_MM = 100
const FORWARD = new THREE.Vector3(0, 0, -1)
const deg = THREE.MathUtils.degToRad

/** Suaviza la rotación con un filtro One Euro por componente del cuaternión. */
class RotationSmoother {
  // beta por unidad de cuaternión por segundo (≈ la mitad de la velocidad angular en rad/s).
  private readonly filters = [0, 1, 2, 3].map(() => new OneEuroFilter(1, 3))
  private readonly last = new THREE.Quaternion()
  private ready = false

  update(next: THREE.Quaternion, time: number) {
    // q y -q son la misma rotación: se elige la más cercana para no interpolar al revés.
    if (this.ready && this.last.dot(next) < 0) next.set(-next.x, -next.y, -next.z, -next.w)
    const [x, y, z, w] = this.filters.map((f, i) => f.filter(next.toArray()[i]!, time)) as [
      number,
      number,
      number,
      number,
    ]
    this.last.set(x, y, z, w).normalize()
    this.ready = true
  }

  get value(): THREE.Quaternion | null {
    return this.ready ? this.last : null
  }

  reset() {
    this.ready = false
    for (const filter of this.filters) filter.reset()
  }
}

export class TryOn3D {
  readonly canvas = document.createElement('canvas')
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 10, 3000)
  private focalPx = 1
  private readonly head = new THREE.Group()
  private readonly occluder: THREE.Mesh
  private readonly rotation = new RotationSmoother()
  private readonly headMatrix = new THREE.Matrix4()
  private readonly ray = new THREE.Vector3()
  private readonly rayRotation = new THREE.Quaternion()
  private glasses: BuiltGlasses | null = null
  private styleKey = ''

  /** Lanza un error si el dispositivo no tiene WebGL: la vista sigue con el dibujo 2D. */
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true })
    this.renderer.setClearColor(0x000000, 0)

    // Reflejos de un ambiente interior genérico, más una luz desde arriba y adelante.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    const light = new THREE.DirectionalLight(0xffffff, 1.1)
    light.position.set(0.3, 1, 1)
    this.scene.add(light)

    // Solo escribe profundidad: no se ve, pero tapa lo que queda detrás de la cabeza.
    this.occluder = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 28),
      new THREE.MeshBasicMaterial({ colorWrite: false }),
    )
    this.occluder.renderOrder = -1
    this.occluder.position.set(0, HEAD.centerY, HEAD.centerZ)
    this.head.add(this.occluder)
    this.scene.add(this.head)
  }

  setStyle(style: GlassesStyle) {
    const key = JSON.stringify(style)
    if (key === this.styleKey) return
    this.styleKey = key
    if (this.glasses) {
      this.head.remove(this.glasses.group)
      this.glasses.dispose()
    }
    this.glasses = buildGlasses(style)
    this.glasses.group.position.z = FRAME_AHEAD_OF_PUPILS_MM
    this.glasses.group.rotation.x = PANTOSCOPIC_TILT
    this.head.add(this.glasses.group)
  }

  /** Con cada detección nueva: la matriz de MediaPipe (16 números, por columnas). */
  track(matrix: number[], timeMs: number) {
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    this.headMatrix.fromArray(matrix).decompose(position, rotation, scale)
    this.rotation.update(rotation, timeMs / 1000)
  }

  /**
   * Dibuja el armazón para la pose ya suavizada. `pose` viene en la imagen espejada (como
   * la usa el dibujo 2D). Devuelve false si todavía no hay rotación para dibujar.
   */
  render(pose: FacePose, width: number, height: number) {
    const rotation = this.rotation.value
    if (!rotation || !this.glasses) return false

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false)
      this.focalPx = Math.hypot(width, height) / 2 / Math.tan(deg(DIAGONAL_FOV_DEG) / 2)
      this.camera.aspect = width / height
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / 2 / this.focalPx))
      this.camera.updateProjectionMatrix()
    }

    // Profundidad a la que 1 mm mide pxPerMm en pantalla, y el punto entre las pupilas ahí.
    const focalPx = this.focalPx
    const depth = focalPx / pose.pxPerMm
    const x = width - pose.center.x - width / 2
    const y = -(pose.center.y - height / 2)
    this.head.position.set((x / focalPx) * depth, (y / focalPx) * depth, -depth)

    // MediaPipe mide la rotación con su cámara: lo que se ve en la imagen es la rotación
    // respecto de la línea de mirada hacia la cara. Se la pasa a la línea de esta cámara, así
    // una cara cerca del borde del cuadro no queda girada de más.
    const mediapipeFocal = height / 2 / Math.tan(deg(MEDIAPIPE_VERTICAL_FOV_DEG) / 2)
    const toRay = (focal: number) =>
      this.rayRotation.setFromUnitVectors(
        FORWARD,
        this.ray.set(x / focal, y / focal, -1).normalize(),
      )
    this.head.quaternion
      .copy(toRay(mediapipeFocal))
      .invert()
      .premultiply(toRay(focalPx))
      .multiply(rotation)

    // Cabeza del ancho medido; las patillas se abren o cierran hasta apoyarse en ella.
    const headHalf = THREE.MathUtils.clamp(pose.faceWidthMm, ...FACE_WIDTH_RANGE_MM) / 2
    this.occluder.scale.set(headHalf - 1.5, HEAD.radiusY, HEAD.radiusZ)
    for (const temple of this.glasses.temples) {
      const reach = headHalf + temple.thickness / 2 + 0.5 - temple.hingeX
      const splay = Math.asin(THREE.MathUtils.clamp(reach / TEMPLE_REACH_MM, -0.2, 0.2))
      // La inclinación del frente se compensa para que la patilla siga horizontal.
      temple.pivot.rotation.set(-PANTOSCOPIC_TILT, -temple.side * splay, 0)
    }

    this.renderer.render(this.scene, this.camera)
    return true
  }

  /** La cara se perdió: la próxima detección arranca sin arrastrar la rotación anterior. */
  reset() {
    this.rotation.reset()
  }

  dispose() {
    this.glasses?.dispose()
    this.occluder.geometry.dispose()
    ;(this.occluder.material as THREE.Material).dispose()
    this.scene.environment?.dispose()
    this.renderer.dispose()
  }
}
