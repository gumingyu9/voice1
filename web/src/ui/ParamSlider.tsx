import { fromPosition, toPosition, type ParamDef } from '../params/schema'
import { formatValue } from './format'

interface Props {
  param: ParamDef
  value: number
  selected: boolean
  onChange: (id: string, v: number) => void
  onReset: (id: string) => void
  onSelect: (id: string) => void
}

export function ParamSlider({ param: p, value, selected, onChange, onReset, onSelect }: Props) {
  const isDefault = value === p.default
  const [leftEnd, rightEnd] = p.ends ?? [formatValue(p, p.min), formatValue(p, p.max)]

  return (
    <div className={`param-row${selected ? ' selected' : ''}`}>
      <div className="param-head">
        <button type="button" className="param-label" onClick={() => onSelect(p.id)} aria-pressed={selected}>
          {p.label}
        </button>
        <span className="param-value">
          {formatValue(p, value)}
          {p.unit && <span className="param-unit"> {p.unit}</span>}
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
