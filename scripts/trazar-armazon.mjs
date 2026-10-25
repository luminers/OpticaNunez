// Traza la forma real de un armazón desde la foto técnica de frente (planilla de carga) y
// la lleva a las medidas del calibre. Devuelve el `frame.geometry` del producto, en el
// sistema de src/data/frame-geometry.ts, y el color medido del armazón.
//
//   node scripts/trazar-armazon.mjs --foto frente.jpg --A 50 --P 21 --B 43 --F 140 [--debug trazo.png]
//
// Cómo funciona: separa el armazón (oscuro) del papel; los dos agujeros claros más grandes
// rodeados por el armazón son los lentes. Del contorno de cada lente (envolvente convexa) y
// del borde exterior del frente se promedian las dos mitades, así la foto no tiene que ser
// perfectamente simétrica. Al final se ajusta a las medidas: lente A × B, puente P, frente F.
// Necesita armazón más oscuro que el fondo (para armazones claros, fondo oscuro e --invertir).

import fs from 'node:fs'
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '')
  const next = process.argv[i + 1]
  args[key] = next === undefined || next.startsWith('--') ? true : (i++, next)
}
for (const k of ['foto', 'A', 'P', 'B', 'F'])
  if (!args[k]) throw new Error(`Falta --${k}. Uso: --foto f.jpg --A 50 --P 21 --B 43 --F 140`)
const A = +args.A,
  P = +args.P,
  B = +args.B,
  F = +args.F

// --- Imagen y máscara ---

const img = jpeg.decode(fs.readFileSync(args.foto), { useTArray: true })
const W = img.width,
  H = img.height
const lum = new Float32Array(W * H)
for (let i = 0; i < W * H; i++)
  lum[i] = (img.data[i * 4] + img.data[i * 4 + 1] + img.data[i * 4 + 2]) / 3

// Umbral de Otsu sobre la luminancia: separa armazón de papel sin tocar números a mano.
function otsu() {
  const hist = Array.from({ length: 256 }, () => 0)
  for (const l of lum) hist[Math.round(l)]++
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0,
    wB = 0,
    best = 0,
    th = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB || wB === W * H) continue
    sumB += t * hist[t]
    const mB = sumB / wB,
      mF = (sum - sumB) / (W * H - wB)
    const between = wB * (W * H - wB) * (mB - mF) ** 2
    if (between > best) {
      best = between
      th = t
    }
  }
  return th
}
const threshold = otsu()
const dark = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) dark[i] = lum[i] < threshold !== !!args.invertir ? 1 : 0

/** Región conexa (4 vecinos) con el mismo valor que la semilla. */
function flood(mask, seed) {
  const val = mask[seed]
  const out = new Uint8Array(W * H)
  const stack = [seed]
  out[seed] = 1
  let touchesBorder = false,
    area = 0
  while (stack.length) {
    const p = stack.pop()
    area++
    const x = p % W,
      y = (p / W) | 0
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesBorder = true
    for (const q of [p - 1, p + 1, p - W, p + W]) {
      if (q < 0 || q >= W * H || Math.abs((q % W) - x) > 1) continue
      if (!out[q] && mask[q] === val) {
        out[q] = 1
        stack.push(q)
      }
    }
  }
  return { mask: out, touchesBorder, area }
}

const bbox = (mask) => {
  let x0 = W,
    x1 = 0,
    y0 = H,
    y1 = 0
  for (let i = 0; i < W * H; i++)
    if (mask[i]) {
      const x = i % W,
        y = (i / W) | 0
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
  return { x0, x1, y0, y1 }
}
// Lentes: las dos regiones claras más grandes que no tocan el borde de la foto ni son el
// papel del fondo (más ancho que media foto).
const seen = new Uint8Array(W * H)
const holes = []
for (let p = 0; p < W * H; p += 7) {
  if (dark[p] || seen[p]) continue
  const region = flood(dark, p)
  for (let i = 0; i < W * H; i++) if (region.mask[i]) seen[i] = 1
  if (region.touchesBorder || region.area < W * H * 0.005) continue
  const box = bbox(region.mask)
  if (box.x1 - box.x0 < W * 0.45) holes.push(region)
}
holes.sort((a, b) => b.area - a.area)
if (holes.length < 2)
  throw new Error('No se encontraron los dos lentes. ¿El fondo contrasta con el armazón?')

let [holeL, holeR] = holes.slice(0, 2).map((h) => ({ ...h, box: bbox(h.mask) }))
if (holeL.box.x0 > holeR.box.x0) [holeL, holeR] = [holeR, holeL]
const cx = (holeL.box.x1 + holeR.box.x0) / 2
const holeH = (holeL.box.y1 - holeL.box.y0 + holeR.box.y1 - holeR.box.y0) / 2
const cy = (holeL.box.y0 + holeL.box.y1 + holeR.box.y0 + holeR.box.y1) / 4

// Armazón: la región oscura que toca el lente izquierdo por su lado de adentro.
const bridgeRow = Math.round(cy)
let bridgeSeed = -1
for (let x = holeL.box.x1; x < holeR.box.x0; x++)
  if (dark[bridgeRow * W + x]) {
    bridgeSeed = bridgeRow * W + x
    break
  }
if (bridgeSeed < 0) throw new Error('No se encontró el aro entre los lentes.')
const frame = flood(dark, bridgeSeed).mask
const solid = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) solid[i] = frame[i] || holeL.mask[i] || holeR.mask[i] ? 1 : 0

// --- Bordes del frente, columna por columna ---

const holeAt = (x) => (x <= cx ? holeL : holeR)
function holeEdge(x, fromTop) {
  const h = holeAt(x).mask
  if (fromTop) {
    for (let y = 0; y < H; y++) if (h[y * W + x]) return y - 1
  } else for (let y = H - 1; y >= 0; y--) if (h[y * W + x]) return y + 1
  return -1
}
const overLens = (x) => {
  const b = holeAt(x).box
  return x >= b.x0 && x <= b.x1
}
/** Recorre la columna desde un punto del frente hasta salir del armazón. */
function run(x, y, dir) {
  if (y < 0 || !solid[y * W + x]) return -1
  while (y + dir >= 0 && y + dir < H && solid[(y + dir) * W + x]) y += dir
  return y
}
const rawTop = (x) => (overLens(x) ? run(x, holeEdge(x, true), -1) : -1)

// Sobre los lentes el borde de arriba es limpio; a los costados se cruzan las patillas, así
// que ahí se usa la recta ajustada sobre el tramo central de cada lente.
function topLine(hole) {
  const { x0, x1 } = hole.box
  const pts = []
  for (let x = Math.round(x0 + (x1 - x0) * 0.2); x <= x1 - (x1 - x0) * 0.2; x++) {
    const y = rawTop(x)
    if (y >= 0) pts.push([x, y])
  }
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length
  let sxy = 0,
    sxx = 0
  for (const [x, y] of pts) {
    sxy += (x - mx) * (y - my)
    sxx += (x - mx) ** 2
  }
  return (x) => my + (sxy / sxx) * (x - mx)
}
const lineL = topLine(holeL),
  lineR = topLine(holeR)
const line = (x) => (x <= cx ? lineL : lineR)(x)

/**
 * Fuera de los lentes (puente y laterales): un punto del tramo de armazón más largo bajo la
 * línea de arriba. El más largo y no el primero: con la cámara un poco alta se ve el canto
 * superior del puente, y su borde deja rayitas oscuras que no son el frente.
 */
function startBelowLine(x) {
  const from = Math.max(Math.round(line(x)) - 2, 0)
  let best = -1,
    bestLen = 0,
    runStart = -1
  for (let y = from; y <= from + holeH * 0.4 && y < H; y++) {
    if (solid[y * W + x]) {
      if (runStart < 0) runStart = y
      if (y - runStart + 1 > bestLen) {
        bestLen = y - runStart + 1
        best = runStart
      }
    } else runStart = -1
  }
  return best
}
function topAt(x) {
  if (overLens(x)) return rawTop(x)
  const y = run(x, startBelowLine(x), -1)
  return y < 0 ? -1 : Math.max(y, Math.round(line(x)))
}
function bottomAt(x) {
  return run(x, overLens(x) ? holeEdge(x, false) : startBelowLine(x), 1)
}

const columns = []
for (let x = 0; x < W; x++) {
  const t = topAt(x),
    b = bottomAt(x)
  if (t >= 0 && b >= 0) columns.push({ x, t, b })
}
const xl = columns[0].x,
  xr = columns.at(-1).x

// --- A milímetros (provisorio: escala por el ancho del frente) y simetría ---

const sxPx = F / (xr - xl)
const syPx = B / holeH
const toMm = (x, y) => [(x - cx) * sxPx, -(y - cy) * syPx]

/** Interpola y(x) en una lista de puntos [x, y] con x creciente. */
function interp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++)
    if (pts[i][0] >= x) {
      const [x0, y0] = pts[i - 1],
        [x1, y1] = pts[i]
      return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  return pts.at(-1)[1]
}
/** Promedia la mitad izquierda (espejada) con la derecha, cada 0,5 mm desde el centro. */
function symmetric(key) {
  const left = columns
    .filter((c) => c.x <= cx)
    .map((c) => toMm(c.x, c[key]))
    .map(([x, y]) => [-x, y])
    .reverse()
  const right = columns.filter((c) => c.x >= cx).map((c) => toMm(c.x, c[key]))
  const max = Math.min(left.at(-1)[0], right.at(-1)[0])
  const out = []
  for (let x = 0; x <= max + 1e-6; x += 0.5) out.push([x, (interp(left, x) + interp(right, x)) / 2])
  return out
}
/** Quita los dientes del umbral: mediana y después promedio, en ventanas de pocos mm. */
function smooth(pts) {
  const window = (i, r) => pts.slice(Math.max(i - r, 0), i + r + 1).map((p) => p[1])
  const median = pts.map((p, i) => {
    const ys = window(i, 3).sort((a, b) => a - b)
    return [p[0], ys[ys.length >> 1]]
  })
  return median.map((p, i) => {
    const near = median.slice(Math.max(i - 2, 0), i + 3)
    return [p[0], near.reduce((s, q) => s + q[1], 0) / near.length]
  })
}
const topEdge = smooth(symmetric('t')),
  bottomEdge = smooth(symmetric('b'))

// Lente: envolvente convexa de cada agujero, en polar desde su centro, promediando las dos.
function hull(mask) {
  const pts = []
  for (let i = 0; i < W * H; i++) if (mask[i]) pts.push([i % W, (i / W) | 0])
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = [],
    upper = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop()
    lower.push(p)
  }
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}
const RAYS = 180
function radial(polygon) {
  const xs = polygon.map((p) => p[0]),
    ys = polygon.map((p) => p[1])
  const c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  const r = []
  for (let k = 0; k < RAYS; k++) {
    const a = (2 * Math.PI * k) / RAYS,
      d = [Math.cos(a), Math.sin(a)]
    let best = 0
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length]
      const e = [q[0] - p[0], q[1] - p[1]],
        f = [p[0] - c[0], p[1] - c[1]]
      const den = d[0] * e[1] - d[1] * e[0]
      if (Math.abs(den) < 1e-9) continue
      const t = (f[0] * e[1] - f[1] * e[0]) / den,
        u = (f[0] * d[1] - f[1] * d[0]) / den
      if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t)
    }
    r.push(best)
  }
  return { c, r }
}
// Lente derecho tal cual y el izquierdo espejado: los dos del lado +x.
const right = radial(hull(holeR.mask).map(([x, y]) => toMm(x, y)))
const left = radial(
  hull(holeL.mask)
    .map(([x, y]) => toMm(x, y))
    .map(([x, y]) => [-x, y]),
)
const lensC = [(right.c[0] + left.c[0]) / 2, (right.c[1] + left.c[1]) / 2]
const lens = right.r.map((r, k) => {
  const a = (2 * Math.PI * k) / RAYS,
    rr = (r + left.r[k]) / 2
  return [lensC[0] + rr * Math.cos(a), lensC[1] + rr * Math.sin(a)]
})

// --- Ajuste a las medidas: lente A × B, puente P, frente F ---

const lx0 = Math.min(...lens.map((p) => p[0])),
  lx1 = Math.max(...lens.map((p) => p[0]))
const ly0 = Math.min(...lens.map((p) => p[1])),
  ly1 = Math.max(...lens.map((p) => p[1]))
const traced = {
  lensWidth: lx1 - lx0,
  lensHeight: ly1 - ly0,
  bridge: 2 * lx0,
  frontWidth: 2 * topEdge.at(-1)[0],
}
const edgeMax = topEdge.at(-1)[0]
// x por tramos: puente → P/2, lente → A, lateral → hasta F/2. y: el lente mide B.
const fitX = (x) =>
  x <= lx0
    ? (x * P) / 2 / lx0
    : x <= lx1
      ? P / 2 + ((x - lx0) * A) / (lx1 - lx0)
      : P / 2 + A + ((x - lx1) * (F / 2 - P / 2 - A)) / (edgeMax - lx1)
const yMid = (ly0 + ly1) / 2
const fitY = (y) => ((y - yMid) * B) / (ly1 - ly0)
const fit = ([x, y]) => [fitX(x), fitY(y)]

const lensMm = lens.map(fit),
  topMm = topEdge.map(fit),
  bottomMm = bottomEdge.map(fit)
const atX = (pts, x) => interp(pts, x)
const lensMidX = P / 2 + A / 2
const measured = {
  aroArriba: atX(topMm, lensMidX) - B / 2,
  aroAbajo: -B / 2 - atX(bottomMm, lensMidX),
  lateral: F / 2 - P / 2 - A,
  puenteArriba: atX(topMm, 0) - B / 2,
  puenteAbajo: atX(bottomMm, 0),
}

// --- Al sistema del dibujo (viewBox 240 × 104, puente en x = 120, lente izquierdo) ---

const K = 228 / F // unidades del dibujo por mm: el frente ocupa casi todo el ancho
const vb = ([x, y]) => [+(120 - x * K).toFixed(2), +(52 - y * K).toFixed(2)]
const path = (pts, close = true) =>
  pts.map((p, i) => `${i ? 'L' : 'M'} ${vb(p).join(' ')}`).join(' ') + (close ? ' Z' : '')
// Mitad izquierda del frente: borde de arriba desde el puente hacia afuera y vuelta por abajo,
// con el lente como agujero (recorrido en sentido contrario).
// Cada mitad pasa 0,4 mm del centro: encimadas no dejan una raya en el medio del puente.
const frontOutline = [
  [-0.4, topMm[0][1]],
  ...topMm,
  ...[...bottomMm].reverse(),
  [-0.4, bottomMm[0][1]],
]
const lensPath = path(lensMm)
const lensReversed = path([...lensMm].reverse())
const templeY = topMm.at(-1)[1] - 4.5
const geometry = {
  lens: lensPath,
  front: `${path(frontOutline)} ${lensReversed}`,
  bridge: '',
  temple: `M ${vb([F / 2 - 1.5, templeY]).join(' ')} L ${vb([F / 2 + 4, templeY]).join(' ')}`,
  outer: +(120 - (P / 2 + A) * K).toFixed(2),
  inner: +(120 - (P / 2) * K).toFixed(2),
  top: +(52 - (B / 2) * K).toFixed(2),
  bottom: +(52 + (B / 2) * K).toFixed(2),
}

// Color del armazón: mediana de la parte iluminada (cuartil más claro) del frente.
const samples = []
for (let i = 0; i < W * H; i++)
  if (frame[i]) {
    const x = i % W,
      y = (i / W) | 0
    if (y > line(x) + 3 && y < Math.max(holeL.box.y1, holeR.box.y1)) samples.push(i)
  }
samples.sort((a, b) => lum[a] - lum[b])
const lit = samples.slice(Math.floor(samples.length * 0.5), Math.floor(samples.length * 0.9))
const channel = (c) => {
  const v = lit.map((i) => img.data[i * 4 + c]).sort((a, b) => a - b)
  return v[v.length >> 1]
}
const hex = '#' + [0, 1, 2].map((c) => channel(c).toString(16).padStart(2, '0')).join('')

const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(1)]))
console.log(
  JSON.stringify(
    {
      geometry,
      frameColor: hex,
      control: { trazadoEnLaFoto: round(traced), resultadoMm: round(measured), umbral: threshold },
    },
    null,
    2,
  ),
)

// --- Imagen de control: contornos sobre la foto ---

if (args.debug) {
  const png = new PNG({ width: W, height: H })
  for (let i = 0; i < W * H * 4; i++) png.data[i] = (i & 3) === 3 ? 255 : img.data[i] * 0.55
  const toPx = ([x, y]) => [x / sxPx + cx, -y / syPx + cy]
  const dot = ([x, y], c) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const X = Math.round(x) + dx,
          Y = Math.round(y) + dy
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue
        png.data.set(c, (Y * W + X) * 4)
      }
  }
  for (const s of [-1, 1]) {
    for (const p of topEdge) dot(toPx([p[0] * s, p[1]]), [255, 70, 70])
    for (const p of bottomEdge) dot(toPx([p[0] * s, p[1]]), [70, 170, 255])
    for (const p of lens) dot(toPx([p[0] * s, p[1]]), [255, 220, 0])
  }
  fs.writeFileSync(args.debug, PNG.sync.write(png))
}
