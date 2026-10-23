import { useState } from 'react'
import { ANATOMY_LABELS, PARAM_BY_ID, PARAMS, type AnatomyPart } from '../params/schema'

interface Props {
  selectedId: string
  onSelect: (id: string) => void
}

const ALL_PARTS = Object.keys(ANATOMY_LABELS) as AnatomyPart[]

export function Stage({ selectedId, onSelect }: Props) {
  const [part, setPart] = useState<AnatomyPart | null>(null)
  const selected = PARAM_BY_ID[selectedId]
  const related = new Set<AnatomyPart>(selected?.anatomy ?? [])
  const partParams = part ? PARAMS.filter((p) => p.anatomy.includes(part)) : []

  return (
    <div className="stage">
      <section className="stage-box">
        <h2>해부도</h2>
        <p className="placeholder-text">단면도 SVG는 P1에서 추가</p>
        <p className="hint">
          선택한 파라미터: <strong>{selected?.label}</strong> — 부위를 누르면 연결된 파라미터가 나타납니다.
        </p>
        <ul className="chips">
          {ALL_PARTS.map((a) => (
            <li key={a}>
              <button
                type="button"
                className={`chip group-${selected?.group}${related.has(a) ? ' related' : ''}${part === a ? ' active' : ''}`}
                onClick={() => setPart(part === a ? null : a)}
                aria-pressed={part === a}
              >
                {ANATOMY_LABELS[a]}
              </button>
            </li>
          ))}
        </ul>
        {part && (
          <div className="part-params">
            <h3>{ANATOMY_LABELS[part]}와 연결된 파라미터</h3>
            <ul className="chips">
              {partParams.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`chip group-${p.group}${p.id === selectedId ? ' related' : ''}`}
                    onClick={() => onSelect(p.id)}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="stage-box">
        <h2>음향 시각화</h2>
        <p className="placeholder-text">음원 × 필터 = 결과 스펙트럼, 스펙트로그램, 모음 사각도 — P1에서 추가</p>
      </section>
    </div>
  )
}
