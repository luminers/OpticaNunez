import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import simdBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import simdLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import noSimdBinary from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url'
import noSimdLoader from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url'

// El motor y el modelo se sirven desde el propio sitio: versión fija y sin depender de un CDN.
// BASE_URL respeta la subcarpeta del sitio (en GitHub Pages: /OpticaNunez/).
const MODEL_URL = `${import.meta.env.BASE_URL}models/face_landmarker.task`

async function fileset() {
  const simd = await FilesetResolver.isSimdSupported()
  return simd
    ? { wasmLoaderPath: simdLoader, wasmBinaryPath: simdBinary }
    : { wasmLoaderPath: noSimdLoader, wasmBinaryPath: noSimdBinary }
}

/** Crea el detector facial; prueba con GPU y, si el dispositivo no la soporta, usa CPU. */
export async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const wasm = await fileset()
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    minFaceDetectionConfidence: 0.6,
    minFacePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  })
  try {
    return await FaceLandmarker.createFromOptions(wasm, options('GPU'))
  } catch {
    return await FaceLandmarker.createFromOptions(wasm, options('CPU'))
  }
}
