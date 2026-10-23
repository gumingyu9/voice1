// 엔진 A 오프라인 점검: 모음별 음량·안정성·음높이 측정.  실행: node scripts/check-synth.ts
import { DEFAULT_VALUES } from '../src/params/schema.ts'
import { Synth } from '../src/engine/dsp/synth.ts'
import { frameFor, VOWELS, type Vowel } from '../src/engine/mapping.ts'

const FS = 48000

function render(values: Record<string, number>, vowel: Vowel, sec = 1): Float32Array {
  const s = new Synth(FS, 0.02)
  s.setTarget(frameFor(values, vowel))
  const out = new Float32Array(FS * sec)
  s.process(out)
  return out.subarray(FS * 0.2)
}

function stats(x: Float32Array) {
  let sum = 0, peak = 0, nan = 0
  for (const v of x) { if (!Number.isFinite(v)) nan++; sum += v * v; peak = Math.max(peak, Math.abs(v)) }
  return { rmsDb: 10 * Math.log10(sum / x.length), peak, nan }
}

function pitch(x: Float32Array): number {
  let best = 0, bestLag = 0
  for (let lag = Math.floor(FS / 600); lag < FS / 40; lag++) {
    let c = 0
    for (let i = 0; i < 8000; i++) c += x[i] * x[i + lag]
    if (c > best) { best = c; bestLag = lag }
  }
  return FS / bestLag
}

function centroid(x: Float32Array): number {
  const N = 4096; let num = 0, den = 0
  for (let k = 1; k < N / 2; k += 2) {
    let re = 0, im = 0
    for (let n = 0; n < N; n++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N); const a = (2 * Math.PI * k * n) / N; re += x[n] * w * Math.cos(a); im -= x[n] * w * Math.sin(a) }
    const m = Math.hypot(re, im); num += m * k * FS / N; den += m
  }
  return num / den
}

const fmt = (o: object) => Object.entries(o).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(' ')
for (const v of VOWELS) console.log(v, fmt(stats(render(DEFAULT_VALUES, v))))
const cases: [string, Record<string, number>][] = [
  ['default', {}], ['f0=220', { f0: 220 }], ['loud=95', { loudness: 95 }], ['loud=5', { loudness: 5 }],
  ['vtl=11', { vtl: 11 }], ['vtl=20', { vtl: 20 }], ['breath=100', { breathiness: 100 }], ['rd=0.3', { phonation: 0.3 }], ['rd=2.7', { phonation: 2.7 }],
  ['creak=100', { creak: 100 }], ['ring=100', { ring: 100 }], ['nasal=1', { nasality: 1 }], ['f0=600,vtl=8', { f0: 600, vtl: 8 }], ['jit5 shim20', { jitter: 5, shimmer: 20 }],
]
for (const [name, o] of cases) {
  const x = render({ ...DEFAULT_VALUES, ...o }, 'ㅏ')
  console.log(name.padEnd(14), fmt(stats(x)), `pitch=${pitch(x).toFixed(0)} centroid=${centroid(x).toFixed(0)}`)
}
