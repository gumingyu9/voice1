import type React from 'react'
import { useState } from 'react'
import { EMOTIONS, MACROS, type MacroDef } from '../params/macros'
import { PRESETS } from '../params/presets'
import { PARAM_BY_ID } from '../params/schema'
import type { MacrosState } from '../state/useMacros'
import { formatValue, formatWithUnit } from './format'

interface Props {
  macros: MacrosState
  onSelect: (id: string) => void
}

const fmtMacro = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2)

function MacroSlider({ macro, value, onMove }: { macro: MacroDef; value: number; onMove: (id: string, v: number) => void }) {
  const [open, setOpen] = useState(false)
  const span = macro.max - macro.min
  const pos = (value - macro.min) / span
  const zero = (0 - macro.min) / span
  const a = Math.min(pos, zero) * 100
  const b = Math.max(pos, zero) * 100
  return (
    <div className="param-row macro-row">
      <div className="param-head">
        <span className="param-label macro-label">{macro.label}</span>
        <button
          type="button"
          className={`info-btn${open ? ' on' : ''}`}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${macro.label} 설명 ${open ? '닫기' : '보기'}`}
          title="이 매크로는 무엇을 움직이나?"
        >
          ⓘ
        </button>
        <span className="param-value">{fmtMacro(value)}</span>
        <button
          type="button"
          className="reset-btn"
          onClick={() => onMove(macro.id, 0)}
          title="0으로 (움직였던 파라미터도 되돌아감)"
          aria-label={`${macro.label} 0으로`}
          style={{ visibility: value === 0 ? 'hidden' : 'visible' }}
        >
          ↺
        </button>
      </div>
      <input
        type="range"
        min={macro.min}
        max={macro.max}
        step={0.01}
        value={value}
        style={{ '--a': `${a}%`, '--b': `${b}%` } as React.CSSProperties}
        onChange={(e) => onMove(macro.id, Number(e.target.value))}
        onDoubleClick={() => onMove(macro.id, 0)}
        aria-label={macro.label}
        aria-valuetext={fmtMacro(value)}
      />
      <div className="param-ends">
        <span>{macro.ends[0]}</span>
        <span>{macro.ends[1]}</span>
      </div>
      {open && <p className="macro-explain">{macro.explain}</p>}
    </div>
  )
}

function ChangeBox({ macros, onSelect }: { macros: MacrosState; onSelect: (id: string) => void }) {
  const { last, dismiss } = macros
  if (!last) return null
  return (
    <section className="change-box" aria-live="polite">
      <header>
        <h3>
          {last.source} 바뀐 것 <span className="change-count">{last.changes.length}개</span>
        </h3>
        <button type="button" className="change-close" onClick={dismiss} aria-label="닫기" title="닫기">
          ✕
        </button>
      </header>
      {last.changes.length === 0 ? (
        <p className="hint">바뀐 파라미터가 없어요 (이미 같은 값이거나 범위 끝).</p>
      ) : (
        <ul>
          {last.changes.map((c) => {
            const p = PARAM_BY_ID[c.id]
            if (!p) return null
            const up = c.to > c.from
            return (
              <li key={c.id}>
                <button type="button" className="change-item" onClick={() => onSelect(c.id)} title={`${p.label} 선택`}>
                  <span className="change-label">{p.label}</span>
                  <span className="change-vals">
                    {formatValue(p, c.from)} → {formatWithUnit(p, c.to)}
                  </span>
                  <span className={`change-arrow ${up ? 'up' : 'down'}`} aria-label={up ? '올라감' : '내려감'}>
                    {up ? '↑' : '↓'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function MacroPanel({ macros, onSelect }: Props) {
  const { positions, emotion, presetId, moveMacro, setEmotion, applyPreset, randomVoice } = macros
  const [emoOpen, setEmoOpen] = useState(false)
  const preset = PRESETS.find((p) => p.id === presetId)
  const activeEmotion = EMOTIONS.find((e) => e.id === emotion)

  return (
    <>
      <section className="group group-macro" aria-label="한눈에 바꾸기">
        <header className="group-head">
          <h2>
            ⓪ 한눈에 바꾸기 <span className="group-organ">매크로</span>
          </h2>
          <p>나이·성별 같은 ‘인상’은 아래 파라미터 여러 개를 한꺼번에 움직인 결과예요. 움직여 보고, 무엇이 바뀌었는지 확인하세요.</p>
        </header>

        <div className="preset-row">
          <select value={presetId ?? ''} onChange={(e) => e.target.value && applyPreset(e.target.value)} aria-label="프리셋">
            <option value="">프리셋 선택…</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={randomVoice}>
            🎲 무작위 목소리
          </button>
        </div>
        {preset && <p className="preset-desc">{preset.description}</p>}

        {MACROS.map((m) => (
          <MacroSlider key={m.id} macro={m} value={positions[m.id] ?? 0} onMove={moveMacro} />
        ))}

        <div className="emotion-block">
          <div className="emotion-head">
            <span className="emotion-title">감정</span>
            {activeEmotion && (
              <button
                type="button"
                className={`info-btn${emoOpen ? ' on' : ''}`}
                onClick={() => setEmoOpen(!emoOpen)}
                aria-expanded={emoOpen}
                aria-label={`${activeEmotion.label} 설명 ${emoOpen ? '닫기' : '보기'}`}
              >
                ⓘ
              </button>
            )}
          </div>
          <div className="chips emotion-chips" role="group" aria-label="감정">
            <button type="button" className={`emo-chip${emotion === null ? ' active' : ''}`} aria-pressed={emotion === null} onClick={() => setEmotion(null)}>
              중립
            </button>
            {EMOTIONS.map((e) => (
              <button key={e.id} type="button" className={`emo-chip${emotion === e.id ? ' active' : ''}`} aria-pressed={emotion === e.id} onClick={() => setEmotion(e.id)}>
                {e.label}
              </button>
            ))}
          </div>
          {activeEmotion && emoOpen && <p className="macro-explain">{activeEmotion.explain}</p>}
        </div>
      </section>
      <ChangeBox macros={macros} onSelect={onSelect} />
    </>
  )
}
