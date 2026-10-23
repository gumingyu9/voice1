import { useState } from 'react'
import { RULE_INFO } from '../engine/ko/g2p'
import type { SpeechRender } from '../engine/speech/render'
import { PARAM_BY_ID } from '../params/schema'
import { SpeechTimeline } from '../viz'

interface Props {
  speech: SpeechRender
  /** 합성에 쓴 입력 문장 (정규화 전) */
  text?: string
  onReplay: () => void
  onSelectParam: (id: string) => void
  /** 재생 시작 시각 (performance.now() ms) — 재생 위치선용 */
  playStartedAt?: number | null
  playing?: boolean
}

const paramLabel = (id: string) => PARAM_BY_ID[id]?.label

export function SpeechPanel({ speech, text, onReplay, onSelectParam, playStartedAt, playing }: Props) {
  const rules = speech.g2p.rules
  // 같은 문장 결과에 대해서만 펼침 상태를 유지한다
  const [open, setOpen] = useState<{ rules: typeof rules; i: number } | null>(null)
  const openIdx = open && open.rules === rules ? open.i : null
  const shownText = text?.trim()
  const showNormalized = !!shownText && shownText !== speech.normalized

  return (
    <section className="stage-box sp-panel" aria-label="문장 분석">
      <h2>문장 분석</h2>

      <div className="sp-pipeline">
        <ol className="sp-steps">
          {shownText && (
            <li>
              <span className="sp-step-name">입력</span>
              <span className="sp-step-val">{shownText}</span>
            </li>
          )}
          {showNormalized && (
            <li>
              <span className="sp-step-name">정규화</span>
              <span className="sp-step-val">{speech.normalized}</span>
            </li>
          )}
          <li>
            <span className="sp-step-name">발음</span>
            <span className="sp-step-val sp-pron">[{speech.g2p.pronunciation}]</span>
          </li>
        </ol>
        <button type="button" className="sp-replay" onClick={onReplay}>
          ▶ 다시 듣기
        </button>
      </div>

      <div className="sp-block">
        <h3>적용된 발음 규칙</h3>
        {rules.length === 0 ? (
          <p className="hint">적용된 규칙 없음 — 쓴 대로 읽힙니다</p>
        ) : (
          <>
            <ul className="chips">
              {rules.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={`chip sp-rule${openIdx === i ? ' active' : ''}`}
                    aria-expanded={openIdx === i}
                    onClick={() => setOpen(openIdx === i ? null : { rules, i })}
                  >
                    <strong>{RULE_INFO[r.rule].name}</strong>
                    <span className="sp-rule-change">
                      {r.before} → {r.after}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {openIdx !== null && rules[openIdx] && (
              <p className="sp-rule-desc" role="note">
                <strong>{RULE_INFO[rules[openIdx].rule].name}</strong> — {RULE_INFO[rules[openIdx].rule].desc}
              </p>
            )}
          </>
        )}
      </div>

      <div className="sp-block">
        <h3>소리 단위와 소리의 모양</h3>
        <SpeechTimeline speech={speech} onSelectParam={onSelectParam} paramLabel={paramLabel} playStartedAt={playStartedAt} playing={playing} />
      </div>
    </section>
  )
}
