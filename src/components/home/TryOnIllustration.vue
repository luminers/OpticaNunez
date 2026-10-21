<script setup lang="ts">
// Esquema de lo que hace el probador: detecta el rostro, mide el iris y apoya el armazón a escala.
// Puntos de referencia sobre el contorno, como los que devuelve Face Landmarker.
const LANDMARKS = [
  [74, 150],
  [70, 190],
  [78, 232],
  [98, 270],
  [128, 298],
  [160, 308],
  [192, 298],
  [222, 270],
  [242, 232],
  [250, 190],
  [246, 150],
]
</script>

<template>
  <svg class="face-scan" viewBox="0 0 320 360" aria-hidden="true" focusable="false">
    <g class="viewfinder">
      <path d="M 20 60 V 28 Q 20 20 28 20 H 60" />
      <path d="M 260 20 H 292 Q 300 20 300 28 V 60" />
      <path d="M 300 300 V 332 Q 300 340 292 340 H 260" />
      <path d="M 60 340 H 28 Q 20 340 20 332 V 300" />
    </g>

    <g class="face">
      <ellipse cx="160" cy="180" rx="92" ry="128" />
      <path d="M 160 176 Q 154 214 162 228 Q 158 232 150 230" />
      <path d="M 132 262 Q 160 276 188 262" />
      <path d="M 102 140 Q 122 130 144 138 M 176 138 Q 198 130 218 140" />
    </g>

    <g class="eyes">
      <path d="M 100 172 Q 122 158 144 172 Q 122 184 100 172 Z" />
      <path d="M 176 172 Q 198 158 220 172 Q 198 184 176 172 Z" />
      <circle cx="122" cy="172" r="8" />
      <circle class="measured" cx="198" cy="172" r="8" />
    </g>

    <g class="frame">
      <rect x="86" y="148" width="66" height="50" rx="12" />
      <rect x="168" y="148" width="66" height="50" rx="12" />
      <path d="M 152 164 Q 160 157 168 164" />
      <path d="M 86 158 L 66 154 M 234 158 L 254 154" />
    </g>

    <g class="landmarks">
      <circle v-for="[x, y] in LANDMARKS" :key="`${x}-${y}`" :cx="x" :cy="y" r="2" />
    </g>

    <g class="callout">
      <path d="M 190 172 H 206" />
      <path d="M 206 172 L 232 112 H 248" />
      <text x="252" y="116">11,7 mm</text>
    </g>
  </svg>
</template>

<style scoped>
.face-scan {
  display: block;
  width: 100%;
  height: auto;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.viewfinder {
  stroke-width: 2.5;
}

.face {
  stroke-width: 1.5;
  opacity: 0.55;
}

.eyes {
  stroke-width: 1.5;
  opacity: 0.8;
}

.eyes .measured {
  opacity: 1;
  stroke-width: 2;
}

.frame {
  stroke-width: 4;
}

.landmarks {
  fill: currentColor;
  stroke: none;
  opacity: 0.6;
}

.callout {
  stroke-width: 1.2;
}

.callout text {
  fill: currentColor;
  stroke: none;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  text-anchor: start;
}
</style>
