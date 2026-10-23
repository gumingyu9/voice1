// 시각화용 해석적 계산: 소리를 재생하지 않아도 "음원 × 필터 = 결과" 스펙트럼을 그릴 수 있다.

import { N_FORMANTS, type FrameParams } from './dsp/frame.ts'
import { buildLfTable } from './dsp/glottal.ts'
import { resonatorMagnitude } from './dsp/resonator.ts'

export { glottalPulse } from './dsp/glottal.ts'

const FS = 48000
const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9))

export interface Harmonic {
  freq: number
  db: number
}

export interface SourceFilterSpectrum {
  /** 성대 음원의 배음 (기울기 필터·이득 포함) */
  source: Harmonic[]
  /** 성대 잡음(기식음) 수준, 음원과 같은 기준의 dB */
  noiseDb: number
  /** 성도 필터 응답 곡선 */
  filter: Harmonic[]
  /** 각 배음이 필터를 통과한 결과 */
  output: Harmonic[]
  /** 포먼트 위치 (Hz) */
  formants: number[]
}

function tiltMagnitude(a: number, f: number): number {
  const w = (2 * Math.PI * f) / FS
  return (1 - a) / Math.hypot(1 - a * Math.cos(w), a * Math.sin(w))
}

/** 성도(필터)의 주파수 응답, 선형 크기 */
export function filterMagnitude(frame: FrameParams, f: number): number {
  let m = 1
  for (let i = 0; i < N_FORMANTS; i++) {
    if (frame.formants[i] < FS * 0.45) m *= resonatorMagnitude(frame.formants[i], frame.bandwidths[i], f, FS)
  }
  m *= resonatorMagnitude(frame.fnp, frame.bnp, f, FS) / resonatorMagnitude(frame.fnz, frame.bnz, f, FS)
  return m
}

const tableCache = new Map<number, Float32Array>()
function lfTable(rd: number): Float32Array {
  const key = Math.round(rd * 20)
  let t = tableCache.get(key)
  if (!t) {
    t = buildLfTable(key / 20, 1024)
    tableCache.set(key, t)
  }
  return t
}

/** 한 주기 펄스의 k번째 배음 크기 (푸리에 계수) */
function harmonicMagnitude(table: Float32Array, k: number): number {
  const N = table.length
  let re = 0
  let im = 0
  for (let n = 0; n < N; n++) {
    const a = (2 * Math.PI * k * n) / N
    re += table[n] * Math.cos(a)
    im -= table[n] * Math.sin(a)
  }
  return (2 * Math.hypot(re, im)) / N
}

export function sourceFilterSpectrum(frame: FrameParams, maxHz = 5000, curvePoints = 256): SourceFilterSpectrum {
  const table = lfTable(frame.rd)
  const gain = frame.gain * frame.av
  const source: Harmonic[] = []
  const output: Harmonic[] = []
  for (let k = 1; k * frame.f0 <= maxHz; k++) {
    const f = k * frame.f0
    const s = harmonicMagnitude(table, k) * tiltMagnitude(frame.tilt, f) * gain
    source.push({ freq: f, db: db(s) })
    output.push({ freq: f, db: db(s * filterMagnitude(frame, f)) })
  }
  const filter: Harmonic[] = []
  for (let i = 0; i < curvePoints; i++) {
    const f = 50 + ((maxHz - 50) * i) / (curvePoints - 1)
    filter.push({ freq: f, db: db(filterMagnitude(frame, f)) })
  }
  // 잡음 1Hz 대역당이 아닌 "배음 하나 폭(f0)" 에 들어가는 에너지로 환산해 배음과 비교 가능하게 한다
  const noiseDb = db(frame.ah * frame.gain * 0.5 * Math.sqrt((2 * frame.f0) / FS) * 4)
  return { source, noiseDb, filter, output, formants: frame.formants.filter((f) => f <= maxHz) }
}
