import type { CSSProperties } from 'react'
import { clamp, n1 } from './util.ts'

export interface VowelPoint {
  vowel: string
  f1: number
  f2: number
}

interface Props {
  points: VowelPoint[]
  reference: VowelPoint[]
  current: string
}

// 고전적인 모음 사각도: 가로 F2 (왼쪽이 높음), 세로 F1 (위쪽이 낮음), 둘 다 로그 스케일
const W = 440
const H = 384
const ML = 52
const MR = 14
const MT = 36
const MB = 48
const PLOT_W = W - ML - MR
const PLOT_H = H - MT - MB
const F2_LEFT = 3500
const F2_RIGHT = 500
const F1_TOP = 200
const F1_BOTTOM = 1300

const px = (f2: number) => ML + (Math.log(clamp(f2, F2_RIGHT, F2_LEFT) / F2_LEFT) / Math.log(F2_RIGHT / F2_LEFT)) * PLOT_W
const py = (f1: number) => MT + (Math.log(clamp(f1, F1_TOP, F1_BOTTOM) / F1_TOP) / Math.log(F1_BOTTOM / F1_TOP)) * PLOT_H

const ORDER = ['ㅣ', 'ㅔ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ']
const F2_TICKS = [500, 700, 1000, 1500, 2000, 3000]
const F1_TICKS = [200, 300, 500, 700, 1000]

function ordered(list: VowelPoint[]): VowelPoint[] {
  const out: VowelPoint[] = []
  for (const v of ORDER) {
    const p = list.find((q) => q.vowel === v)
    if (p) out.push(p)
  }
  return out
}

function polygon(list: VowelPoint[]): string {
  if (list.length < 2) return ''
  return 'M' + list.map((p) => `${n1(px(p.f2))},${n1(py(p.f1))}`).join('L') + 'Z'
}

/** d 속성은 CSS 속성으로도 줄 수 있어, 지원하는 브라우저에서는 모양이 부드럽게 변한다 */
const pathStyle = (d: string): CSSProperties => ({ d: `path("${d}")` }) as CSSProperties

export function VowelChart({ points, reference, current }: Props) {
  const refOrdered = ordered(reference)
  const curOrdered = ordered(points)
  const refPath = polygon(refOrdered)
  const curPath = polygon(curOrdered)

  return (
    <figure className="viz-fig">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="모음 사각도 (F1–F2 평면)" className="viz-svg">
        <rect x={ML} y={MT} width={PLOT_W} height={PLOT_H} className="viz-plot-bg" />
        {F2_TICKS.map((f) => (
          <g key={f}>
            <line x1={px(f)} x2={px(f)} y1={MT} y2={MT + PLOT_H} className="viz-grid" />
            <text x={px(f)} y={MT + PLOT_H + 14} textAnchor="middle" className="viz-tick">{f}</text>
          </g>
        ))}
        {F1_TICKS.map((f) => (
          <g key={f}>
            <line x1={ML} x2={ML + PLOT_W} y1={py(f)} y2={py(f)} className="viz-grid" />
            <text x={ML - 6} y={py(f) + 3.5} textAnchor="end" className="viz-tick">{f}</text>
          </g>
        ))}
        <rect x={ML} y={MT} width={PLOT_W} height={PLOT_H} className="viz-frame" />
        <text x={ML + PLOT_W / 2} y={H - 8} textAnchor="middle" className="viz-axis-title">F2 (혀 앞↔뒤)</text>
        <text transform={`translate(13 ${MT + PLOT_H / 2}) rotate(-90)`} textAnchor="middle" className="viz-axis-title">F1 (혀 높음↔낮음 / 입 벌림)</text>

        <path d={refPath} style={pathStyle(refPath)} className="viz-vspace viz-vspace-ref" />
        <path d={curPath} style={pathStyle(curPath)} className="viz-vspace viz-vspace-cur" />

        {refOrdered.map((p) => (
          <g key={p.vowel} className="viz-vpt" style={{ transform: `translate(${n1(px(p.f2))}px, ${n1(py(p.f1))}px)` }}>
            <circle r={5} className="viz-ref-dot" />
            <text y={17} textAnchor="middle" className="viz-vlabel viz-vlabel-ref">{p.vowel}</text>
          </g>
        ))}
        {curOrdered.map((p) => {
          const on = p.vowel === current
          return (
            <g key={p.vowel} className="viz-vpt" style={{ transform: `translate(${n1(px(p.f2))}px, ${n1(py(p.f1))}px)` }}>
              <circle r={on ? 9 : 5.5} className={on ? 'viz-cur-dot viz-cur-on' : 'viz-cur-dot'} />
              <text y={on ? -14 : -10} textAnchor="middle" className={on ? 'viz-vlabel viz-vlabel-on' : 'viz-vlabel'}>{p.vowel}</text>
            </g>
          )
        })}

        {/* 범례 */}
        <g transform="translate(52 4)">
          <circle cx={6} cy={8} r={5} className="viz-ref-dot" />
          <text x={17} y={12} className="viz-legend">기준: 성인 남성</text>
          <circle cx={136} cy={8} r={5.5} className="viz-cur-dot" />
          <text x={147} y={12} className="viz-legend">현재 목소리</text>
        </g>
      </svg>
    </figure>
  )
}
