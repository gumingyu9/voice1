// 엔진 A 문장 렌더링 점검: 세그먼트 종류별 음량, 길이, 음높이 범위.  실행: node scripts/check-speech.ts
import { DEFAULT_VALUES } from '../src/params/schema.ts'
import { renderSpeech, FRAME_MS } from '../src/engine/speech/render.ts'

const FS = 48000
const texts = process.argv.slice(2).length ? process.argv.slice(2) : ['안녕하세요', '국물이 맛있어요.', '사과 세 개 주세요?', '까치가 학교 앞에서 짖어요', '오늘 날씨가 정말 좋네요!']
const db = (x: number) => (10 * Math.log10(x + 1e-12)).toFixed(1)

const byKind: Record<string, { e: number; n: number }> = {}
for (const text of texts) {
  const r = renderSpeech(text, DEFAULT_VALUES, { sampleRate: FS })
  let nan = 0, peak = 0
  for (const x of r.audio) { if (!Number.isFinite(x)) nan++; peak = Math.max(peak, Math.abs(x)) }
  const segs = r.plan.segments
  for (const s of segs) {
    const a = Math.floor((s.start / 1000) * FS), b = Math.floor((s.end / 1000) * FS)
    let e = 0; for (let i = a; i < b; i++) e += r.audio[i] ** 2
    const key = s.kind === 'pause' ? 'pause' : `${s.kind}${s.lar ? '/' + s.lar : ''}${s.voiced ? '/v' : ''}`
    byKind[key] ??= { e: 0, n: 0 }; byKind[key].e += e; byKind[key].n += b - a
  }
  const f0s = r.frames.filter((_, k) => r.voicing[k] > 0.9).map((f) => f.f0)
  const sylls = new Set(segs.filter((s) => s.kind !== 'pause').map((s) => s.syl)).size
  console.log(`${text} → [${r.g2p.pronunciation}]  ${segs.map((s) => s.ipa).join('')}`)
  console.log(`   dur=${r.plan.duration.toFixed(0)}ms syl=${sylls} rate=${(sylls / (segs.filter(s=>s.kind!=='pause').reduce((a,s)=>a+s.end-s.start,0)/1000)).toFixed(2)}/s f0=${Math.min(...f0s).toFixed(0)}–${Math.max(...f0s).toFixed(0)}Hz peak=${peak.toFixed(2)} nan=${nan} frames=${r.frames.length}x${FRAME_MS}ms`)
}
console.log('\n종류별 평균 음량(dB):')
for (const [k, v] of Object.entries(byKind).sort()) console.log(' ', k.padEnd(20), db(v.e / v.n))
