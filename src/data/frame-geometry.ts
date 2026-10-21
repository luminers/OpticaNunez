import type { FrameShape } from '@/types/catalog'

/**
 * Forma del lente izquierdo y piezas del frente, en el sistema del dibujo
 * (viewBox 240×104, centro del puente en x = 120). La mitad derecha se espeja.
 *
 * `outer`/`inner`/`top`/`bottom` son los bordes del lente: el probador los usa para
 * llevar la forma a las medidas reales del armazón en milímetros.
 */
export interface FrameGeometry {
  lens: string
  bridge: string
  temple: string
  outer: number
  inner: number
  top: number
  bottom: number
}

export const FRAME_GEOMETRY: Record<FrameShape, FrameGeometry> = {
  redondo: {
    lens: 'M 34 50 A 36 36 0 1 1 106 50 A 36 36 0 1 1 34 50 Z',
    bridge: 'M 104 40 Q 112 33 120 33',
    temple: 'M 37 36 L 8 32',
    outer: 34,
    inner: 106,
    top: 14,
    bottom: 86,
  },
  cuadrado: {
    lens: 'M 44 16 H 96 Q 108 16 108 28 V 72 Q 108 84 96 84 H 44 Q 32 84 32 72 V 28 Q 32 16 44 16 Z',
    bridge: 'M 108 36 Q 114 30 120 30',
    temple: 'M 32 26 L 6 24',
    outer: 32,
    inner: 108,
    top: 16,
    bottom: 84,
  },
  rectangular: {
    lens: 'M 38 26 H 100 Q 110 26 110 36 V 66 Q 110 76 100 76 H 38 Q 28 76 28 66 V 36 Q 28 26 38 26 Z',
    bridge: 'M 110 40 Q 115 35 120 35',
    temple: 'M 28 34 L 4 32',
    outer: 28,
    inner: 110,
    top: 26,
    bottom: 76,
  },
  aviador: {
    lens: 'M 30 26 Q 70 16 108 28 Q 110 58 94 76 Q 74 94 50 80 Q 30 64 30 26 Z',
    bridge: 'M 106 34 Q 113 29 120 29 M 102 22 L 120 21',
    temple: 'M 31 28 L 4 26',
    outer: 30,
    inner: 108,
    top: 21,
    bottom: 86,
  },
  'ojo-de-gato': {
    lens: 'M 18 22 Q 62 28 108 34 Q 108 70 78 80 Q 44 88 32 62 Q 26 42 18 22 Z',
    bridge: 'M 107 40 Q 114 34 120 34',
    temple: 'M 19 23 L 2 20',
    outer: 18,
    inner: 108,
    top: 22,
    bottom: 82,
  },
}
