import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { FRAME_GEOMETRY } from '@/data/frame-geometry'
import {
  careyCanvas,
  PUPIL_ABOVE_LENS_CENTER,
  RIM_MM,
  startPoint,
  TEMPLE_STUB_MM,
  type GlassesStyle,
} from '../drawGlasses'

// Armazón 3D generado desde las medidas del producto y la forma de frame-geometry.
// Sistema del armazón: 1 unidad = 1 mm, origen entre las pupilas, x hacia la derecha de la
// imagen, y hacia arriba, z hacia la cámara. El frente queda en z = 0 y las patillas van
// hacia -z. El grupo que lo contiene lo corre hacia adelante de los ojos.

/** Espesor del frente de acetato (de adelante hacia atrás). */
const ACETATE_DEPTH_MM = 4
const BEVEL_MM = 0.5
/** Curvatura horizontal del frente (wrap): los laterales quedan ~7 mm atrás del puente. */
const WRAP_RADIUS_MM = 350
/** Curvatura del cristal (base 6 aprox.): hace que los reflejos se muevan como en uno real. */
const LENS_CURVE_RADIUS_MM = 150
/** Tramo final de la patilla que baja detrás de la oreja. */
const TEMPLE_TIP_MM = 32
const TEMPLE_TIP_BEND = THREE.MathUtils.degToRad(38)
/** Las patillas bajan apenas desde la bisagra hasta la oreja. */
const TEMPLE_DROOP = THREE.MathUtils.degToRad(3)
const TEMPLE_SECTION: Record<GlassesStyle['material'], { thickness: number; height: number }> = {
  acetato: { thickness: 2.6, height: 5.5 },
  metal: { thickness: 1.2, height: 1.8 },
}
/** Tamaño de la muestra de carey en mm sobre el armazón. */
const CAREY_TILE_MM = 25

export interface Temple {
  /** Pivote en la bisagra: se gira en y para que la patilla llegue a la cabeza. */
  pivot: THREE.Group
  side: -1 | 1
  /** Distancia lateral de la bisagra al centro, en mm. */
  hingeX: number
  thickness: number
}

export interface BuiltGlasses {
  group: THREE.Group
  temples: Temple[]
  dispose: () => void
}

const v2 = (x: number, y: number) => new THREE.Vector2(x, y)

function signedArea(points: THREE.Vector2[]) {
  let area = 0
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]!
    area += p.x * q.y - q.x * p.y
  })
  return area / 2
}

/** Corre una curva hacia afuera (`d` > 0) o hacia adentro, por la normal de cada punto. */
function offsetCurve(points: THREE.Vector2[], d: number, closed: boolean) {
  return points.map((p, i) => {
    const prev = points[closed ? (i - 1 + points.length) % points.length : Math.max(i - 1, 0)]!
    const next = points[closed ? (i + 1) % points.length : Math.min(i + 1, points.length - 1)]!
    const t = next.clone().sub(prev).normalize()
    // Para una curva antihoraria, la derecha del recorrido es el exterior.
    return v2(p.x + t.y * d, p.y - t.x * d)
  })
}

/** Contorno del lente izquierdo en mm, antihorario, desde el path SVG del dibujo. */
function lensContour(svgPath: string, toMm: (x: number, y: number) => THREE.Vector2) {
  const svg = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${svgPath}"/></svg>`,
  )
  const shape = SVGLoader.createShapes(svg.paths[0]!)[0]!
  const points = shape
    .getSpacedPoints(160)
    .slice(0, -1)
    .map((p) => toMm(p.x, p.y))
  return signedArea(points) < 0 ? points.reverse() : points
}

const mirrorX = (points: THREE.Vector2[]) => points.map((p) => v2(-p.x, p.y)).reverse()

/** Curvatura del frente: cuanto más lejos del puente, más atrás. */
function wrap(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    position.setZ(i, position.getZ(i) - (x * x) / (2 * WRAP_RADIUS_MM))
  }
  geometry.computeVertexNormals()
  return geometry
}

const wrapZ = (x: number) => -(x * x) / (2 * WRAP_RADIUS_MM)

/** Las UV de una extrusión están en mm: se llevan al tamaño de la muestra de carey. */
function uvInTiles(geometry: THREE.BufferGeometry) {
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) / CAREY_TILE_MM, uv.getY(i) / CAREY_TILE_MM)
  return geometry
}

/** Pieza de acetato: una forma plana extruida hacia atrás, con el frente en z = 0. */
function acetatePiece(shape: THREE.Shape) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: ACETATE_DEPTH_MM - 2 * BEVEL_MM,
    bevelEnabled: true,
    bevelThickness: BEVEL_MM,
    bevelSize: BEVEL_MM,
    bevelSegments: 2,
    curveSegments: 4,
  })
  geometry.translate(0, 0, -(ACETATE_DEPTH_MM - BEVEL_MM))
  return wrap(uvInTiles(geometry))
}

/** Banda de ancho `width` a lo largo de una línea abierta (puente, laterales). */
function band(line: THREE.Vector2[], width: number) {
  const top = offsetCurve(line, -width / 2 + BEVEL_MM, false)
  const bottom = offsetCurve(line, width / 2 - BEVEL_MM, false)
  return new THREE.Shape([...top, ...bottom.reverse()])
}

/** Alambre de metal a lo largo de una línea, con el frente en z = 0. */
function wire(line: THREE.Vector2[], radius: number, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    line.map((p) => new THREE.Vector3(p.x, p.y, -radius)),
    closed,
  )
  return wrap(new THREE.TubeGeometry(curve, line.length * 2, radius, 8, closed))
}

/**
 * Cristal curvo: anillos concéntricos desde el contorno hasta el centro (los lentes son
 * convexos vistos desde su centro), con el borde metido en el aro y el centro adelante.
 */
function lensGeometry(contour: THREE.Vector2[], edgeZ: number, rings = 10) {
  const center = contour.reduce((c, p) => c.add(p), v2(0, 0)).divideScalar(contour.length)
  const n = contour.length
  const positions: number[] = []
  const normals: number[] = []
  const normal = new THREE.Vector3()
  for (let r = 0; r <= rings; r++) {
    const s = r / rings
    for (const p of contour) {
      const edge = p.clone().sub(center)
      const x = center.x + edge.x * s
      const y = center.y + edge.y * s
      const sag = (edge.lengthSq() * (1 - s * s)) / (2 * LENS_CURVE_RADIUS_MM)
      positions.push(x, y, edgeZ + sag + wrapZ(x))
      // Normal de la superficie (casquete esférico más el wrap), calculada y no promediada:
      // en el centro los anillos se juntan y el promedio dejaba reflejos en estrella.
      normal
        .set(
          (edge.x * s) / LENS_CURVE_RADIUS_MM + x / WRAP_RADIUS_MM,
          (edge.y * s) / LENS_CURVE_RADIUS_MM,
          1,
        )
        .normalize()
      normals.push(normal.x, normal.y, normal.z)
    }
  }
  const index: number[] = []
  for (let r = 0; r < rings; r++)
    for (let i = 0; i < n; i++) {
      const a = r * n + i
      const b = r * n + ((i + 1) % n)
      // Antihorario visto desde adelante (+z): la cara visible es la que mira a la cámara.
      index.push(a, a + n, b, b, a + n, b + n)
    }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(index)
  return geometry
}

/**
 * Patilla: una barra recta desde la bisagra hacia atrás (-z) que en el último tramo se
 * curva hacia abajo, detrás de la oreja. Se arma doblando una caja subdividida.
 */
function templeGeometry(length: number, thickness: number, height: number) {
  const geometry = new THREE.BoxGeometry(thickness, height, length, 1, 1, 48)
  geometry.translate(0, 0, -length / 2)
  const straight = length - TEMPLE_TIP_MM
  const k = TEMPLE_TIP_BEND / TEMPLE_TIP_MM
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    const s = -position.getZ(i)
    const y = position.getY(i)
    const u = Math.max(s - straight, 0)
    const angle = TEMPLE_DROOP + k * u
    // Recorrido de la línea media: recto con caída leve y después un arco.
    const along = Math.min(s, straight)
    let cy = -along * Math.sin(TEMPLE_DROOP)
    let cz = -along * Math.cos(TEMPLE_DROOP)
    if (u > 0) {
      cy += (Math.cos(angle) - Math.cos(TEMPLE_DROOP)) / k
      cz -= (Math.sin(angle) - Math.sin(TEMPLE_DROOP)) / k
    }
    // Se afina hacia la punta.
    const taper = 1 - 0.35 * Math.min(s / length, 1)
    position.setY(i, cy + y * taper * Math.cos(angle))
    position.setZ(i, cz - y * taper * Math.sin(angle))
    uv.setXY(i, s / CAREY_TILE_MM, (y + height / 2) / CAREY_TILE_MM)
  }
  geometry.computeVertexNormals()
  return geometry
}

/** Color CSS a color de three y opacidad (los acetatos cristal vienen como rgba). */
function parseColor(css: string) {
  const rgba = css.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/)
  if (rgba) {
    const [, r, g, b, a] = rgba.map(Number) as number[]
    return {
      color: new THREE.Color().setRGB(r! / 255, g! / 255, b! / 255, THREE.SRGBColorSpace),
      opacity: Number.isNaN(a) ? 1 : a!,
    }
  }
  return { color: new THREE.Color(css), opacity: 1 }
}

function frameMaterial(style: GlassesStyle) {
  if (style.material === 'metal') {
    return new THREE.MeshStandardMaterial({
      color: parseColor(style.frameColor).color,
      metalness: 1,
      roughness: 0.28,
    })
  }
  const material = new THREE.MeshPhysicalMaterial({
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  })
  if (style.frameColor === 'carey') {
    const map = new THREE.CanvasTexture(careyCanvas())
    map.colorSpace = THREE.SRGBColorSpace
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    material.map = map
  } else {
    const { color, opacity } = parseColor(style.frameColor)
    material.color = color
    if (opacity < 1) {
      material.transparent = true
      material.opacity = Math.max(opacity - 0.25, 0.35)
    }
  }
  return material
}

function lensMaterial(style: GlassesStyle) {
  return new THREE.MeshStandardMaterial({
    color: style.lensTint ?? '#dbe7e8',
    transparent: true,
    opacity: style.lensTint ? 0.84 : 0.1,
    roughness: 0.08,
    metalness: 0,
    envMapIntensity: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export function buildGlasses(style: GlassesStyle): BuiltGlasses {
  const g = FRAME_GEOMETRY[style.shape]
  const { lensWidth, bridge, lensHeight, templeLength } = style.size
  const rim = RIM_MM[style.material]
  const isMetal = style.material === 'metal'
  const lensCenterY = -lensHeight * PUPIL_ABOVE_LENS_CENTER

  // Del sistema del dibujo (viewBox, y hacia abajo) a mm del armazón (y hacia arriba).
  const sx = lensWidth / (g.inner - g.outer)
  const sy = lensHeight / (g.bottom - g.top)
  const toMm = (x: number, y: number) =>
    v2(-bridge / 2 - (g.inner - x) * sx, -(y - (g.top + g.bottom) / 2) * sy + lensCenterY)

  const frame = frameMaterial(style)
  const glass = lensMaterial(style)
  const group = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    group.add(mesh)
    return mesh
  }

  const left = lensContour(g.lens, toMm)
  const contours = [left, mirrorX(left)]

  // Aros y cristales.
  for (const contour of contours) {
    if (isMetal) add(wire(contour, rim / 2, true), frame)
    else {
      const shape = new THREE.Shape(offsetCurve(contour, rim / 2 - BEVEL_MM, true))
      shape.holes.push(new THREE.Path(offsetCurve(contour, -rim / 2 + BEVEL_MM, true)))
      add(acetatePiece(shape), frame)
    }
    // El borde va metido en el aro; el centro, abombado, queda casi al ras del frente.
    const lens = add(lensGeometry(contour, isMetal ? -rim : -ACETATE_DEPTH_MM * 0.65), glass)
    lens.renderOrder = 2
  }

  // Puente: la misma curva que el dibujo 2D, de un aro al otro.
  const innerTop = toMm(g.inner, g.top + (g.bottom - g.top) * 0.28)
  const bridgeTop = innerTop.y + lensHeight * 0.14
  const halfBridge = new THREE.QuadraticBezierCurve(
    innerTop,
    v2(-bridge / 4, bridgeTop),
    v2(0, bridgeTop),
  ).getPoints(12)
  const bridgeLine = [...halfBridge, ...mirrorX(halfBridge).slice(1)]
  if (isMetal) add(wire(bridgeLine, rim / 2), frame)
  else add(acetatePiece(band(bridgeLine, rim)), frame)

  if (style.shape === 'aviador') {
    // Barra doble del aviador.
    const barY = lensHeight * (0.47 - PUPIL_ABOVE_LENS_CENTER)
    const halfBar = [v2(-bridge / 2 - 3, barY), v2(0, barY + 0.4)]
    add(wire([...halfBar, v2(bridge / 2 + 3, barY)], rim / 2), frame)
  }

  // Laterales (donde arranca la patilla) y patillas.
  const [templeX, templeY] = startPoint(g.temple)
  const templeStart = toMm(templeX, templeY)
  const stubEnd = v2(templeStart.x - TEMPLE_STUB_MM, templeStart.y + 0.4)
  const { thickness, height } = TEMPLE_SECTION[style.material]
  const templeGeo = templeGeometry(templeLength, thickness, Math.min(height, rim * 1.4))
  geometries.push(templeGeo)
  const temples: Temple[] = []

  const leftStub = [v2(templeStart.x + 1, templeStart.y), stubEnd]
  for (const side of [-1, 1] as const) {
    const stub = side === -1 ? leftStub : mirrorX(leftStub)
    if (isMetal) add(wire(stub, rim / 2), frame)
    else add(acetatePiece(band(stub, rim * 1.4)), frame)

    // La bisagra queda detrás del lateral, con la patilla por dentro del borde exterior.
    const hingeX = -stubEnd.x - thickness / 2
    const pivot = new THREE.Group()
    pivot.position.set(side * hingeX, stubEnd.y, wrapZ(stubEnd.x) - ACETATE_DEPTH_MM + 0.5)
    pivot.add(new THREE.Mesh(templeGeo, frame))
    group.add(pivot)
    temples.push({ pivot, side, hingeX, thickness })
  }

  return {
    group,
    temples,
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      ;(frame as THREE.MeshStandardMaterial).map?.dispose()
      frame.dispose()
      glass.dispose()
    },
  }
}
