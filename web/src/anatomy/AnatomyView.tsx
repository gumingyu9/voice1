import type { ReactNode } from 'react'
import { ANATOMY_LABELS, DEFAULT_VALUES, type AnatomyPart, type ParamValues } from '../params/schema'
import {
  LUMEN_BACK,
  LUMEN_FRONT,
  TRACHEA_C,
  arrToPose,
  arrowHead,
  arrowUp,
  buildGeometry,
  poseTarget,
  type Pt,
} from './geometry'
import { useSmoothed } from './hooks'
import { VocalFoldInset } from './VocalFoldInset'

interface Props {
  values: ParamValues
  highlight: AnatomyPart[]
  onPartClick: (p: AnatomyPart) => void
  vowel: string
  playing: boolean
}

const HEAD_OUTLINE =
  'M50,540C58,470 118,430 136,392L136,300C134,292 132,288 132,288L96,266L76,262L76,204L62,198L56,184' +
  'C50,178 40,176 33,164C30,156 36,148 44,138C52,128 58,120 62,112C60,90 70,60 100,38' +
  'C140,14 240,10 300,50C340,90 344,170 316,220C304,242 302,262 302,300L302,400C304,430 340,440 352,480L360,540Z'
const BRAIN =
  'M72,120C72,64 130,34 195,34C265,34 318,76 318,140C318,170 302,188 282,196C262,176 240,152 214,138L150,128C110,126 80,126 72,120Z'

interface Slot {
  side: 'L' | 'R'
  y: number
}
const SLOTS: Record<AnatomyPart, Slot> = {
  lips: { side: 'L', y: 176 },
  teeth: { side: 'L', y: 206 },
  tongue: { side: 'L', y: 236 },
  jaw: { side: 'L', y: 268 },
  epilarynx: { side: 'L', y: 304 },
  larynx: { side: 'L', y: 334 },
  vocalFolds: { side: 'L', y: 364 },
  lungs: { side: 'L', y: 452 },
  nasalCavity: { side: 'R', y: 108 },
  velum: { side: 'R', y: 146 },
  vocalTract: { side: 'R', y: 196 },
  pharynx: { side: 'R', y: 238 },
}

const textWidth = (s: string) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 12 : 6.5), 0) + 14

function Part({
  id,
  on,
  onPick,
  children,
}: {
  id: AnatomyPart
  on: boolean
  onPick: (p: AnatomyPart) => void
  children: ReactNode
}) {
  return (
    <g
      className={`an-part an-${id}${on ? ' hl' : ''}`}
      data-part={id}
      role="button"
      tabIndex={0}
      aria-label={ANATOMY_LABELS[id]}
      aria-pressed={on}
      onClick={() => onPick(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPick(id)
        }
      }}
    >
      <title>{ANATOMY_LABELS[id]}</title>
      {children}
    </g>
  )
}

function Callout({ text, slot, anchor }: { text: string; slot: Slot; anchor: Pt }) {
  const w = textWidth(text)
  const x = slot.side === 'L' ? 24 - w : 252
  const edge: Pt = [slot.side === 'L' ? 24 : 252, slot.y]
  return (
    <g className="an-callout">
      <line x1={edge[0]} y1={edge[1]} x2={anchor[0]} y2={anchor[1]} />
      <circle cx={anchor[0]} cy={anchor[1]} r="2.6" />
      <rect x={x} y={slot.y - 10} width={w} height="20" rx="10" />
      <text x={x + w / 2} y={slot.y + 4} textAnchor="middle">
        {text}
      </text>
    </g>
  )
}

export function AnatomyView({ values, highlight, onPartClick, vowel, playing }: Props) {
  const hl = new Set(highlight)
  const v = (id: string) => values[id] ?? DEFAULT_VALUES[id]
  const sib = hl.has('teeth') ? v('sibilance') : null
  const pose = arrToPose(useSmoothed(poseTarget(vowel, v('articulation'), sib), 150))
  const g = buildGeometry(values, pose)
  const on = (p: AnatomyPart) => hl.has(p)

  const nas = g.nasality
  const loud = g.loud
  const ringOpacity = (g.ring / 100) * 0.7
  const flowW = 3 + 11 * (loud / 100)

  const anchors: Record<AnatomyPart, Pt> = {
    lips: g.lipAnchor,
    teeth: [85, 200],
    tongue: g.tongueAnchor,
    jaw: g.jawAnchor,
    epilarynx: [LUMEN_FRONT + 6, g.fy - 24],
    larynx: [152, g.fy - 12],
    vocalFolds: [197, g.fy],
    lungs: [TRACHEA_C - 44, g.lungTop + 58],
    nasalCavity: [120, 156],
    velum: g.velumAnchor,
    vocalTract: g.centerline[4],
    pharynx: [LUMEN_BACK + 5, 196],
  }
  const labelFor = (p: AnatomyPart) => (p === 'vocalTract' ? `성도 ${g.vtl.toFixed(1)} cm` : ANATOMY_LABELS[p])

  const cl = g.centerline
  const clEnd = cl[cl.length - 1]
  const clPrev = cl[cl.length - 2]

  return (
    <div className="anatomy">
      <figure className="anatomy-fig">
        <svg className="an-svg" viewBox="-80 0 440 510" role="group" aria-label="머리와 목의 시상면 단면도">
          <defs>
            <pattern id="an-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="an-hatch-line" />
            </pattern>
            <radialGradient id="an-glow">
              <stop offset="0" className="an-glow-stop" stopOpacity="0.95" />
              <stop offset="1" className="an-glow-stop" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ── 배경(비클릭 장식) ── */}
          <path d={HEAD_OUTLINE} className="an-head" />
          <path d={BRAIN} className="an-brain" />
          <path d="M120,60C150,40 200,42 230,70M150,100C190,80 250,88 290,120M250,50C290,70 306,110 300,150" className="an-gyri" />
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x="240" y={150 + i * 26} width="32" height="21" rx="5" className="an-vert" />
          ))}
          <path d="M284,196L284,520" className="an-cord" />
          <rect x={LUMEN_BACK} y={g.fy + 26} width="12" height="500" rx="4" className="an-esoph" />

          {/* ── 비강 ── */}
          <Part id="nasalCavity" on={on('nasalCavity')} onPick={onPartClick}>
            <path d={g.nasal} className="s k-lumen" />
            <path d="M84,168C104,158 134,160 164,154M88,152C112,146 142,148 174,142" className="an-turb" />
            {nas < 0 && (
              <g opacity={0.3 + 0.6 * Math.min(1, -nas)}>
                <path d={g.nasal} fill="url(#an-hatch)" className="ns" />
              </g>
            )}
            {nas < -0.02 && (
              <text x="112" y="163" className="an-blocked" textAnchor="middle">
                막힘
              </text>
            )}
          </Part>

          {/* ── 성도 내강(구강+인두) ── */}
          <Part id="vocalTract" on={on('vocalTract')} onPick={onPartClick}>
            <path d={g.lumen} className="s k-lumen ns" />
          </Part>

          {/* ── 턱 ── */}
          <Part id="jaw" on={on('jaw')} onPick={onPartClick}>
            <path d={g.jawSkin} className="s k-skin ns" />
            <path d={g.jawEdge} className="an-edge" />
            <path d={g.mandible} className="s k-bone" opacity="0.6" />
            <path d={g.ramus} className="an-ramus" />
            <circle cx={g.tmj[0]} cy={g.tmj[1]} r="4" className="s k-bone" />
          </Part>

          {/* ── 혀 ── */}
          <Part id="tongue" on={on('tongue')} onPick={onPartClick}>
            <path d={g.tongue} className="s k-tongue" />
          </Part>

          {/* ── 연구개 ── */}
          <Part id="velum" on={on('velum')} onPick={onPartClick}>
            <path d={g.velum} className="s k-velum" />
          </Part>
          <path d={g.palate} className="an-palate" />

          {/* ── 인두(뒷벽) ── */}
          <Part id="pharynx" on={on('pharynx')} onPick={onPartClick}>
            <rect
              x={LUMEN_BACK}
              y={g.pharynxBand.y1}
              width="10"
              height={g.pharynxBand.y2 - g.pharynxBand.y1}
              rx="4"
              className="s k-muscle"
            />
            {Array.from({ length: Math.max(0, Math.floor((g.pharynxBand.y2 - g.pharynxBand.y1 - 12) / 22)) }, (_, i) => (
              <path
                key={i}
                d={`M${LUMEN_BACK + 1.5},${g.pharynxBand.y1 + 16 + i * 22}q3.5,4.5 7,0`}
                className="an-stripe"
              />
            ))}
          </Part>

          {/* ── 후두개 위 공간 ── */}
          <Part id="epilarynx" on={on('epilarynx')} onPick={onPartClick}>
            <ellipse cx={TRACHEA_C} cy={g.fy - 20} rx="30" ry="34" fill="url(#an-glow)" opacity={Math.min(1, ringOpacity * 1.4)} className="ns" />
            <path d={g.epilBack} className="s k-muscle" />
            <path d={g.epilFront} className="s k-muscle" />
            <path d={g.epiglottis} className="s k-cart" />
          </Part>

          {/* ── 후두: 갑상연골, 반지연골, 피열연골, 설골 ── */}
          <Part id="larynx" on={on('larynx')} onPick={onPartClick}>
            <path d={g.strap} className="an-strap" />
            <path d={`M184,${g.hy + 4}L184,${g.fy - 36}`} className="an-membrane" />
            <path d={g.thyroid} className="s k-cart" />
            <path d={g.cricoid} className="s k-cart" />
            <ellipse cx={g.arytenoid[0]} cy={g.arytenoid[1]} rx="5.5" ry="8" className="s k-cart" />
            <path d={g.hyoid} className="s k-bone" />
          </Part>

          {/* ── 성대(정중 단면) ── */}
          <Part id="vocalFolds" on={on('vocalFolds')} onPick={onPartClick}>
            <path d={g.fold} className="s k-fold" />
            <circle cx="200" cy={g.fy} r="9" className="an-fold-halo" />
          </Part>

          {/* ── 기관 + 폐 ── */}
          <Part id="lungs" on={on('lungs')} onPick={onPartClick}>
            <rect
              x={LUMEN_FRONT}
              y={g.fy + 2}
              width={LUMEN_BACK - LUMEN_FRONT}
              height={Math.max(0, g.lungTop - g.fy - 2)}
              className="s k-lumen ns"
            />
            <path
              d={`M${LUMEN_FRONT},${g.fy + 2}L${LUMEN_FRONT},${g.lungTop}M${LUMEN_BACK},${g.fy + 2}L${LUMEN_BACK},${g.lungTop}`}
              className="an-trachea-wall"
            />
            {g.rings.map((y) => (
              <rect key={y} x={LUMEN_FRONT - 7} y={y} width="8" height="5" rx="2.5" className="s k-cart" strokeWidth="0.8" />
            ))}
            <path d={g.lobeL} className="s k-lung" />
            <path d={g.lobeR} className="s k-lung" />
            <path d={g.bronchi} className="an-bronchi-out" />
            <path d={g.bronchi} className="an-bronchi-in" />
          </Part>

          {/* ── 이(앞니) ── */}
          <Part id="teeth" on={on('teeth')} onPick={onPartClick}>
            <path d={g.upperTooth} className="s k-tooth" />
            <path d={g.lowerTooth} className="s k-tooth" />
          </Part>

          {/* ── 입술 ── */}
          <Part id="lips" on={on('lips')} onPick={onPartClick}>
            <path d={g.upperLip} className="s k-lip" />
            <path d={g.lowerLip} className="s k-lip" />
          </Part>

          {/* ── 오버레이(클릭 통과) ── */}
          <g className="an-overlay">
            {/* 성도 중심선 / 치수선 */}
            <path d={g.centerlinePath} className={on('vocalTract') ? 'an-cl hl' : 'an-cl'} />
            {on('vocalTract') && (
              <>
                <path d={arrowHead(cl[0], [cl[0][0] - cl[1][0], cl[0][1] - cl[1][1]], 9)} className="an-cl-head" />
                <path d={arrowHead(clEnd, [clEnd[0] - clPrev[0], clEnd[1] - clPrev[1]], 9)} className="an-cl-head" />
              </>
            )}

            {/* 폐 → 기관 공기 흐름 */}
            <path
              d={arrowUp(TRACHEA_C, g.lungTop + 12, g.fy + 26, flowW)}
              className={`an-air${on('lungs') ? ' hl' : ''}${playing ? ' playing' : ''}`}
            />

            {/* 비음 공기 흐름 */}
            {nas > 0.03 && (
              <g className={`an-nasal-flow${playing ? ' playing' : ''}`} opacity={0.3 + 0.6 * nas}>
                <path d={g.nasalFlow} fill="none" strokeWidth={1.5 + 4 * nas} />
                <path d={arrowHead(g.nasalFlowTip, g.nasalFlowDir, 6 + 5 * nas)} />
              </g>
            )}

            {/* 치찰음 틈 */}
            {sib !== null && (
              <g className="an-gap">
                <ellipse cx={g.gap[0] + 1} cy={g.gap[1] + 1} rx="6" ry="4.5" />
                <circle cx={g.gap[0] - 9} cy={g.gap[1] - 3} r="1.2" />
                <circle cx={g.gap[0] - 13} cy={g.gap[1] - 6} r="1.2" />
                <circle cx={g.gap[0] - 13} cy={g.gap[1]} r="1.2" />
              </g>
            )}

            {/* 호출선 라벨 */}
            {highlight.map((p) => (
              <Callout key={p} text={labelFor(p)} slot={SLOTS[p]} anchor={anchors[p]} />
            ))}
          </g>
        </svg>
      </figure>

      <figure className="anatomy-inset">
        <figcaption>성대 — 위에서 본 모습</figcaption>
        <VocalFoldInset
          values={values}
          playing={playing}
          highlighted={on('vocalFolds')}
          onClick={() => onPartClick('vocalFolds')}
        />
        <p className="an-inset-note">
          {playing ? '실제보다 훨씬 느리게 보여주는 애니메이션' : '재생하면 성대가 열리고 닫힙니다'}
        </p>
      </figure>
    </div>
  )
}
