import { FRAME_GEOMETRY } from '@/data/frame-geometry'
import type { FrameMaterial, FrameShape, ProductSize } from '@/types/catalog'
import { frameTotalWidthMm, type FacePose } from './pose'

// Dibuja el frente del armazón sobre la cara, en milímetros reales.
// Sistema de trabajo: origen entre las pupilas, x hacia la derecha, y hacia abajo, 1 unidad = 1 mm.
// El motor 3D (tryon/three) usa las mismas medidas y constantes.

export interface GlassesStyle {
  shape: FrameShape
  material: FrameMaterial
  frameColor: string
  lensTint?: string
  size: Pick<ProductSize, 'lensWidth' | 'bridge' | 'lensHeight' | 'templeLength'>
}

export const RIM_MM: Record<FrameMaterial, number> = { acetato: 4.2, metal: 1.3 }
// En un armazón bien puesto la pupila queda un poco por encima del centro del lente.
export const PUPIL_ABOVE_LENS_CENTER = 0.08
export const TEMPLE_STUB_MM = 5
// El frente del armazón queda unos 15 mm por delante de las pupilas: al girar o cabecear
// se corre hacia donde apunta la nariz.
export const FRAME_AHEAD_OF_PUPILS_MM = 15
// Tamaño de la muestra de carey en unidades del viewBox (≈ 25 mm en un lente de 52).
const CAREY_TILE = 36
const CAREY_TILE_PX = 128

let careyTile: HTMLCanvasElement | null = null

/**
 * Carey: manchas irregulares de miel, ámbar y marrón oscuro sobre fondo tostado.
 * Se genera una vez con semilla fija para que el patrón no cambie entre cuadros.
 * La muestra empalma sin cortes, así que sirve también como textura repetida.
 */
export function careyCanvas(): HTMLCanvasElement {
  if (!careyTile) {
    careyTile = document.createElement('canvas')
    careyTile.width = CAREY_TILE_PX
    careyTile.height = CAREY_TILE_PX
    const t = careyTile.getContext('2d')!
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    t.fillStyle = '#5a2e14'
    t.fillRect(0, 0, CAREY_TILE_PX, CAREY_TILE_PX)
    const colors = ['#2e1608', '#2e1608', '#7a3f18', '#a8652c', '#c58a45', '#d9a35a']
    for (let i = 0; i < 70; i++) {
      const x = random() * CAREY_TILE_PX
      const y = random() * CAREY_TILE_PX
      const rx = 3 + random() * 14
      const ry = rx * (0.35 + random() * 0.5)
      const angle = random() * Math.PI
      t.globalAlpha = 0.45 + random() * 0.5
      t.fillStyle = colors[Math.floor(random() * colors.length)]!
      // Se dibuja también desplazada para que la muestra empalme sin cortes al repetirse.
      for (const dx of [-CAREY_TILE_PX, 0, CAREY_TILE_PX])
        for (const dy of [-CAREY_TILE_PX, 0, CAREY_TILE_PX]) {
          t.beginPath()
          t.ellipse(x + dx, y + dy, rx, ry, angle, 0, Math.PI * 2)
          t.fill()
        }
    }
  }
  return careyTile
}

function careyPattern(ctx: CanvasRenderingContext2D, unitsPerTile: number) {
  const pattern = ctx.createPattern(careyCanvas(), 'repeat')!
  pattern.setTransform(new DOMMatrix().scale(unitsPerTile / CAREY_TILE_PX))
  return pattern
}

function strokeStyle(ctx: CanvasRenderingContext2D, color: string, unitsPerTile: number) {
  return color === 'carey' ? careyPattern(ctx, unitsPerTile) : color
}

/** Primer punto de un path "M x y ..." del dibujo. */
export function startPoint(path: string): [number, number] {
  const [, x, y] = path.match(/M\s*([\d.]+)\s+([\d.]+)/) ?? []
  return [Number(x), Number(y)]
}

/** Lleva el contexto al plano del frente del armazón: origen entre las pupilas, en mm. */
function faceTransform(ctx: CanvasRenderingContext2D, pose: FacePose) {
  ctx.translate(pose.center.x, pose.center.y)
  ctx.rotate(pose.roll)
  ctx.translate(
    Math.sin(pose.yaw) * FRAME_AHEAD_OF_PUPILS_MM * pose.pxPerMm,
    -Math.sin(pose.pitch) * FRAME_AHEAD_OF_PUPILS_MM * pose.pxPerMm,
  )
  // Al girar la cabeza el frente se ve más angosto; al cabecear, más bajo.
  ctx.scale(pose.pxPerMm * Math.cos(pose.yaw), pose.pxPerMm * Math.cos(pose.pitch))
}

/** Solo la cota del ancho total, para dibujarla encima del armazón 3D. */
export function drawMeasureOverlay(
  ctx: CanvasRenderingContext2D,
  pose: FacePose,
  size: GlassesStyle['size'],
) {
  ctx.save()
  faceTransform(ctx, pose)
  drawMeasures(ctx, size, size.lensHeight * PUPIL_ABOVE_LENS_CENTER)
  ctx.restore()
}

export function drawGlasses(
  ctx: CanvasRenderingContext2D,
  pose: FacePose,
  style: GlassesStyle,
  options: { showMeasures?: boolean } = {},
) {
  const g = FRAME_GEOMETRY[style.shape]
  const { lensWidth, bridge, lensHeight } = style.size
  const rim = RIM_MM[style.material]
  const lensCenterY = lensHeight * PUPIL_ABOVE_LENS_CENTER

  // Escala del dibujo (unidades del viewBox) a milímetros.
  const sx = lensWidth / (g.inner - g.outer)
  const sy = lensHeight / (g.bottom - g.top)
  const toMm = (x: number, y: number) => ({
    x: -bridge / 2 - (g.inner - x) * sx,
    y: (y - (g.top + g.bottom) / 2) * sy + lensCenterY,
  })

  ctx.save()
  faceTransform(ctx, pose)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const lens = new Path2D(g.lens)
  const innerTop = toMm(g.inner, g.top + (g.bottom - g.top) * 0.28)
  const [templeX, templeY] = startPoint(g.temple)
  const templeStart = toMm(templeX, templeY)

  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)

    // Lente y aro, en el sistema del dibujo llevado a mm.
    ctx.save()
    ctx.transform(
      sx,
      0,
      0,
      sy,
      -bridge / 2 - g.inner * sx,
      -((g.top + g.bottom) / 2) * sy + lensCenterY,
    )
    ctx.globalAlpha = style.lensTint ? 0.84 : 0.1
    ctx.fillStyle = style.lensTint ?? '#dbe7e8'
    ctx.fill(lens)
    ctx.globalAlpha = 0.16
    ctx.save()
    ctx.clip(lens)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(14, 80)
    ctx.lineTo(78, 0)
    ctx.lineTo(96, 0)
    ctx.lineTo(32, 80)
    ctx.fill()
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2
    ctx.strokeStyle = strokeStyle(ctx, style.frameColor, CAREY_TILE)
    ctx.lineWidth = rim / ((sx + sy) / 2)
    ctx.stroke(lens)
    ctx.restore()

    // Puente (media parte) y lateral con el arranque de la patilla, ya en mm.
    ctx.strokeStyle = strokeStyle(ctx, style.frameColor, CAREY_TILE * ((sx + sy) / 2))
    ctx.lineWidth = rim
    ctx.beginPath()
    ctx.moveTo(innerTop.x, innerTop.y)
    ctx.quadraticCurveTo(
      -bridge / 4,
      innerTop.y - lensHeight * 0.14,
      0,
      innerTop.y - lensHeight * 0.14,
    )
    if (style.shape === 'aviador') {
      const barY = lensCenterY - lensHeight * 0.47
      ctx.moveTo(-bridge / 2 - 3, barY)
      ctx.lineTo(0, barY - 0.4)
    }
    ctx.moveTo(templeStart.x, templeStart.y)
    ctx.lineTo(templeStart.x - TEMPLE_STUB_MM, templeStart.y - 0.4)
    ctx.stroke()
    ctx.restore()
  }

  if (options.showMeasures) drawMeasures(ctx, style.size, lensCenterY)
  ctx.restore()
}

/** Cota del ancho total sobre el armazón, como en la vista de medidas de la ficha. */
function drawMeasures(
  ctx: CanvasRenderingContext2D,
  size: GlassesStyle['size'],
  lensCenterY: number,
) {
  const width = frameTotalWidthMm(size)
  const y = lensCenterY - size.lensHeight / 2 - 9
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 3
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(-width / 2, y)
  ctx.lineTo(width / 2, y)
  for (const x of [-width / 2, width / 2]) {
    ctx.moveTo(x, y - 2.5)
    ctx.lineTo(x, y + 2.5)
  }
  ctx.stroke()
  ctx.font = '600 4.2px Figtree, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`${width} mm`, 0, y - 1.5)
  ctx.restore()
}
