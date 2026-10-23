import { useMemo } from 'react'
import { glottalPulse } from '../engine/dsp/glottal.ts'
import { clamp, n1 } from './util.ts'

interface Props {
  rd: number
  f0: number
}

const W = 640
const ML = 46
const MR = 14
const PLOT_W = W - ML - MR
const TITLE_H = 20
const PLOT_H = 84
const GAP = 14
const TOP = 4
const H = TOP + 2 * (TITLE_H + PLOT_H) + GAP + 54
const PERIODS = 2

const x = (t: number) => ML + (t / PERIODS) * PLOT_W

function buildPath(data: Float32Array, lo: number, hi: number, top: number): string {
  const n = data.length
  const parts: string[] = []
  const yOf = (v: number) => top + PLOT_H * (1 - (clamp(v, lo, hi) - lo) / (hi - lo))
  for (let p = 0; p < PERIODS; p++) {
    for (let i = 0; i < n; i++) {
      parts.push(`${n1(x(p + i / n))},${n1(yOf(data[i]))}`)
    }
  }
  parts.push(`${n1(x(PERIODS))},${n1(yOf(data[0]))}`)
  return 'M' + parts.join('L')
}

export function GlottalPulseView({ rd, f0 }: Props) {
  const geom = useMemo(() => {
    const { flow, derivative, timing } = glottalPulse(rd)
    const top1 = TOP + TITLE_H
    const top2 = top1 + PLOT_H + GAP + TITLE_H
    return {
      te: clamp(timing.te, 0, 1),
      top1,
      top2,
      flowPath: buildPath(flow, -0.06, 1.06, top1),
      derivPath: buildPath(derivative, -1.08, 1.08, top2),
    }
  }, [rd])

  const { te, top1, top2 } = geom
  const openPct = Math.round(te * 100)
  const periodMs = 1000 / f0
  const closedRects = Array.from({ length: PERIODS }, (_, p) => ({ x0: x(p + te), x1: x(p + 1) }))
  const openRects = Array.from({ length: PERIODS }, (_, p) => ({ x0: x(p), x1: x(p + te) }))
  const xTicks = [0, 0.5, 1, 1.5, 2]
  const zeroY = top2 + PLOT_H / 2

  return (
    <figure className="viz-fig">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="성문 펄스: 유량과 유량 변화율" className="viz-svg">
        {[top1, top2].map((top, idx) => (
          <g key={idx}>
            <rect x={ML} y={top} width={PLOT_W} height={PLOT_H} className="viz-plot-bg" />
            {closedRects.map((r, i) => (
              <rect key={i} x={r.x0} y={top} width={Math.max(0, r.x1 - r.x0)} height={PLOT_H} className="viz-closed" />
            ))}
            {[0, 1, 2].map((t) => (
              <line key={t} x1={x(t)} x2={x(t)} y1={top} y2={top + PLOT_H} className="viz-grid" />
            ))}
            <line x1={ML} x2={ML + PLOT_W} y1={top + PLOT_H} y2={top + PLOT_H} className="viz-axis-line" />
          </g>
        ))}

        <rect x={ML} y={TOP + 4} width={9} height={9} rx={2} fill="var(--viz-source)" />
        <text x={ML + 15} y={TOP + 13} className="viz-title">성문 유량 — 성대 사이로 흐르는 공기</text>
        <text x={ML + PLOT_W} y={TOP + 13} textAnchor="end" className="viz-label viz-closed-text">열림 {openPct}% / 닫힘 {100 - openPct}%</text>
        <path d={geom.flowPath} className="viz-curve" style={{ stroke: 'var(--viz-source)' }} />
        <text x={ML - 6} y={top1 + 4} textAnchor="end" className="viz-tick">많음</text>
        <text x={ML - 6} y={top1 + PLOT_H} textAnchor="end" className="viz-tick">0</text>
        {openRects.map((r, i) => (r.x1 - r.x0 > 40 ? <text key={i} x={(r.x0 + r.x1) / 2} y={top1 + PLOT_H - 6} textAnchor="middle" className="viz-label viz-dim">열림</text> : null))}
        {closedRects.map((r, i) => (r.x1 - r.x0 > 34 ? <text key={i} x={(r.x0 + r.x1) / 2} y={top1 + 16} textAnchor="middle" className="viz-label viz-dim">닫힘</text> : null))}

        <rect x={ML} y={top2 - TITLE_H + 4} width={9} height={9} rx={2} fill="var(--viz-out)" />
        <text x={ML + 15} y={top2 - TITLE_H + 13} className="viz-title">유량 변화율 — 실제 음원 파형</text>
        <line x1={ML} x2={ML + PLOT_W} y1={zeroY} y2={zeroY} className="viz-guide" />
        <path d={geom.derivPath} className="viz-curve" style={{ stroke: 'var(--viz-out)' }} />
        <text x={ML - 6} y={top2 + 8} textAnchor="end" className="viz-tick">+</text>
        <text x={ML - 6} y={zeroY + 3.5} textAnchor="end" className="viz-tick">0</text>
        <text x={ML - 6} y={top2 + PLOT_H} textAnchor="end" className="viz-tick">−</text>
        <text x={x(te) + 6} y={top2 + PLOT_H - 8} className="viz-label viz-dim">급격한 닫힘 = 배음의 원천</text>

        {xTicks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top2 + PLOT_H} y2={top2 + PLOT_H + 4} className="viz-axis-line" />
            <text x={x(t)} y={top2 + PLOT_H + 16} textAnchor="middle" className="viz-tick">{n1(t * periodMs)}</text>
          </g>
        ))}
        <text x={ML + PLOT_W / 2} y={top2 + PLOT_H + 34} textAnchor="middle" className="viz-axis-title">
          시간 (ms) — 한 주기 = {periodMs.toFixed(1)} ms (F0 {Math.round(f0)} Hz)
        </text>
      </svg>
    </figure>
  )
}
