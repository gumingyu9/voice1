import { useMemo } from 'react'
import type { Harmonic, SourceFilterSpectrum } from '../engine/analysis.ts'
import { clamp, fmtDb, n1 } from './util.ts'

interface Props {
  spectrum: SourceFilterSpectrum
  /** 가로축 상한 (Hz). 기본 5000 */
  maxHz?: number
}

// 고정 dB 스케일: 파라미터를 바꿀 때 막대가 "움직이는 것"이 보이도록 눈금을 고정한다.
const SRC_MIN = -80
const SRC_MAX = -10
const FLT_MIN = -20
const FLT_MAX = 40

const W = 640
const ML = 46
const MR = 14
const PLOT_W = W - ML - MR
const TITLE_H = 20
const ROW_H = 96
const GAP = 40
const TOP = 4
const AXIS_H = 44
const H = TOP + 3 * (TITLE_H + ROW_H) + 2 * GAP + AXIS_H

interface RowGeom {
  title: number
  top: number
  bottom: number
}
const ROWS: RowGeom[] = [0, 1, 2].map((i) => {
  const title = TOP + i * (TITLE_H + ROW_H + GAP)
  return { title, top: title + TITLE_H, bottom: title + TITLE_H + ROW_H }
})

function interp(curve: Harmonic[], f: number): number {
  if (curve.length === 0) return FLT_MIN
  if (f <= curve[0].freq) return curve[0].db
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].freq >= f) {
      const a = curve[i - 1]
      const b = curve[i]
      const k = (f - a.freq) / Math.max(1e-9, b.freq - a.freq)
      return a.db + (b.db - a.db) * k
    }
  }
  return curve[curve.length - 1].db
}

export function SourceFilterView({ spectrum, maxHz = 5000 }: Props) {
  const x = (f: number) => ML + (clamp(f, 0, maxHz) / maxHz) * PLOT_W
  const y = (row: RowGeom, db: number, lo: number, hi: number) =>
    row.top + ROW_H * (1 - (clamp(db, lo, hi) - lo) / (hi - lo))

  const xTicks = useMemo(() => {
    const step = maxHz <= 2500 ? 500 : 1000
    const out: number[] = []
    for (let f = 0; f <= maxHz + 1; f += step) out.push(f)
    return out
  }, [maxHz])

  const { source, filter, output, formants, noiseDb } = spectrum

  const filterPath = useMemo(() => {
    const pts = filter.filter((p) => p.freq <= maxHz)
    if (pts.length === 0) return { line: '', area: '' }
    const row = ROWS[1]
    const coords = pts.map((p) => `${n1(x(p.freq))},${n1(y(row, p.db, FLT_MIN, FLT_MAX))}`)
    const line = 'M' + coords.join('L')
    const area = `${line}L${n1(x(pts[pts.length - 1].freq))},${row.bottom}L${n1(x(pts[0].freq))},${row.bottom}Z`
    return { line, area }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, maxHz])

  const envelope = useMemo(() => {
    const row = ROWS[2]
    return output
      .filter((p) => p.freq <= maxHz)
      .map((p) => `${n1(x(p.freq))},${n1(y(row, p.db, SRC_MIN, SRC_MAX))}`)
      .join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output, maxHz])

  const dbTicks = (lo: number, hi: number, step: number) => {
    const t: number[] = []
    for (let v = lo; v <= hi; v += step) t.push(v)
    return t
  }

  const renderFrame = ({ row, lo, hi, ticks, color, title }: { row: RowGeom; lo: number; hi: number; ticks: number[]; color: string; title: string }) => {
    return (
      <g>
        <rect x={ML} y={row.title + 4} width={9} height={9} rx={2} fill={color} />
        <text x={ML + 15} y={row.title + 13} className="viz-title">{title}</text>
        <text x={ML - 6} y={row.title + 13} textAnchor="end" className="viz-tick">dB</text>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={ML} x2={ML + PLOT_W} y1={y(row, v, lo, hi)} y2={y(row, v, lo, hi)} className={v === lo ? 'viz-axis-line' : 'viz-grid'} />
            <text x={ML - 6} y={y(row, v, lo, hi) + 3.5} textAnchor="end" className="viz-tick">{fmtDb(v)}</text>
          </g>
        ))}
        {xTicks.map((f) => (
          <line key={f} x1={x(f)} x2={x(f)} y1={row.top} y2={row.bottom} className="viz-grid" />
        ))}
      </g>
    )
  }

  const noiseVisible = noiseDb > SRC_MIN
  const noiseY = y(ROWS[0], noiseDb, SRC_MIN, SRC_MAX)
  const shownFormants = formants.filter((f) => f <= maxHz)

  return (
    <figure className="viz-fig">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="음원 × 필터 = 결과 3단 스펙트럼" className="viz-svg">
        {/* 1단: 음원 */}
        {renderFrame({ row: ROWS[0], lo: SRC_MIN, hi: SRC_MAX, ticks: dbTicks(-80, -20, 20), color: "var(--viz-source)", title: "성대가 만든 소리 (음원)" })}
        {source.filter((p) => p.freq <= maxHz && p.db > SRC_MIN).map((p) => (
          <line key={p.freq} x1={x(p.freq)} x2={x(p.freq)} y1={ROWS[0].bottom} y2={y(ROWS[0], p.db, SRC_MIN, SRC_MAX)} className="viz-stem" style={{ stroke: 'var(--viz-source)' }} />
        ))}
        {noiseVisible && (
          <g>
            <line x1={ML} x2={ML + PLOT_W} y1={noiseY} y2={noiseY} className="viz-noise-line" />
            <text x={ML + PLOT_W - 4} y={Math.max(ROWS[0].top + 10, noiseY - 4)} textAnchor="end" className="viz-label viz-noise-text">숨소리 잡음</text>
          </g>
        )}

        <text x={ML + PLOT_W / 2} y={ROWS[0].bottom + GAP / 2 + 11} textAnchor="middle" className="viz-op">×</text>

        {/* 2단: 필터 */}
        {renderFrame({ row: ROWS[1], lo: FLT_MIN, hi: FLT_MAX, ticks: dbTicks(-20, 40, 20), color: "var(--viz-filter)", title: "성도의 울림 (필터)" })}
        <path d={filterPath.area} className="viz-filter-area" />
        <path d={filterPath.line} className="viz-filter-line" />
        {shownFormants.map((f, i) => {
          const cy = y(ROWS[1], interp(filter, f), FLT_MIN, FLT_MAX)
          return (
            <g key={i}>
              <line x1={x(f)} x2={x(f)} y1={cy} y2={ROWS[1].bottom} className="viz-guide" />
              <circle cx={x(f)} cy={cy} r={3.6} className="viz-marker" />
              <text x={x(f)} y={Math.max(ROWS[1].top + 9, cy - 8)} textAnchor="middle" className="viz-label viz-formant-text">F{i + 1}</text>
            </g>
          )
        })}

        <text x={ML + PLOT_W / 2} y={ROWS[1].bottom + GAP / 2 + 11} textAnchor="middle" className="viz-op">=</text>

        {/* 3단: 결과 */}
        {renderFrame({ row: ROWS[2], lo: SRC_MIN, hi: SRC_MAX, ticks: dbTicks(-80, -20, 20), color: "var(--viz-out)", title: "입 밖으로 나온 소리 (결과)" })}
        {shownFormants.map((f, i) => (
          <line key={i} x1={x(f)} x2={x(f)} y1={ROWS[2].top} y2={ROWS[2].bottom} className="viz-guide" />
        ))}
        {output.filter((p) => p.freq <= maxHz && p.db > SRC_MIN).map((p) => (
          <line key={p.freq} x1={x(p.freq)} x2={x(p.freq)} y1={ROWS[2].bottom} y2={y(ROWS[2], p.db, SRC_MIN, SRC_MAX)} className="viz-stem" style={{ stroke: 'var(--viz-out)' }} />
        ))}
        <polyline points={envelope} className="viz-envelope" />

        {/* 공통 x 축 */}
        {xTicks.map((f) => (
          <g key={f}>
            <line x1={x(f)} x2={x(f)} y1={ROWS[2].bottom} y2={ROWS[2].bottom + 4} className="viz-axis-line" />
            <text x={x(f)} y={ROWS[2].bottom + 16} textAnchor="middle" className="viz-tick">{f / 1000}</text>
          </g>
        ))}
        <text x={ML + PLOT_W / 2} y={ROWS[2].bottom + 34} textAnchor="middle" className="viz-axis-title">주파수 (kHz)</text>
      </svg>
      <figcaption className="viz-caption">배음 간격 = 음높이(F0), 봉우리 위치 = 포먼트(성도 모양)</figcaption>
    </figure>
  )
}
