import type React from 'react'
import { fromPosition, toPosition, type ParamDef } from '../params/schema'
import { formatValue } from './format'

interface Props {
  param: ParamDef
  value: number
  selected: boolean
  onChange: (id: string, v: number) => void
  onReset: (id: string) => void
  onSelect: (id: string) => void
  /** 마지막 매크로 동작으로 이 파라미터가 바뀐 방향 (없으면 undefined) */
  recentDir?: 'up' | 'down'
  /** 그 동작의 시각: 바뀔 때마다 애니메이션을 다시 시작시키는 key */
  recentAt?: number
}

export function ParamSlider({ param: p, value, selected, onChange, onReset, onSelect, recentDir, recentAt }: Props) {
  const isDefault = value === p.default
  const [leftEnd, rightEnd] = p.ends ?? [formatValue(p, p.min), formatValue(p, p.max)]

  return (
    <div className={`param-row${selected ? ' selected' : ''}${recentDir ? ' recent' : ''}`}>
      {recentDir && <span key={recentAt} className="recent-pulse" aria-hidden="true" />}
      <div className="param-head">
        <button type="button" className="param-label" onClick={() => onSelect(p.id)} aria-pressed={selected}>
          {p.label}
          {p.speechOnly && (
            <span className="speech-tag" title="단어·문장 재생에서만 적용">
              문장
            </span>
          )}
        </button>
        <span className="param-value">
          {formatValue(p, value)}
          {p.unit && <span className="param-unit"> {p.unit}</span>}
          {recentDir && (
            <span key={recentAt} className={`recent-badge ${recentDir}`} aria-label={recentDir === 'up' ? '올라감' : '내려감'}>
              {recentDir === 'up' ? '↑' : '↓'}
            </span>
          )}
        </span>
        <button
          type="button"
          className="reset-btn"
          onClick={() => onReset(p.id)}
          title="기본값으로"
          aria-label={`${p.label} 기본값으로`}
          style={{ visibility: isDefault ? 'hidden' : 'visible' }}
        >
          ↺
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(toPosition(p, value) * 1000)}
        style={{ '--fill': `${toPosition(p, value) * 100}%` } as React.CSSProperties}
        onChange={(e) => onChange(p.id, fromPosition(p, Number(e.target.value) / 1000))}
        onFocus={() => onSelect(p.id)}
        aria-label={p.label}
        aria-valuetext={`${formatValue(p, value)} ${p.unit}`}
      />
      <div className="param-ends">
        <span>{leftEnd}</span>
        <span>{rightEnd}</span>
      </div>
    </div>
  )
}
