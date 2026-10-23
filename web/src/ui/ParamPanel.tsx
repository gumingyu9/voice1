import { GROUPS, PARAMS } from '../params/schema'
import type { ParamsState } from '../state/useParams'
import type { MacrosState } from '../state/useMacros'
import { MacroPanel } from './MacroPanel'
import { ParamSlider } from './ParamSlider'

type Props = Pick<ParamsState, 'values' | 'setValue' | 'resetValue' | 'selectedId' | 'showAdvanced' | 'setShowAdvanced'> & {
  onSelect: (id: string) => void
  macros: MacrosState
}

export function ParamPanel({ values, setValue, resetValue, selectedId, showAdvanced, setShowAdvanced, onSelect, macros }: Props) {
  return (
    <div className="param-panel">
      <MacroPanel macros={macros} onSelect={onSelect} />
      <label className="advanced-toggle">
        <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
        고급 설정 보기
      </label>
      {GROUPS.map((g) => (
        <section key={g.id} className={`group group-${g.id}`}>
          <header className="group-head">
            <h2>
              {g.label} <span className="group-organ">{g.organ}</span>
            </h2>
            <p>{g.summary}</p>
          </header>
          {PARAMS.filter((p) => p.group === g.id && (showAdvanced || !p.advanced)).map((p) => (
            <ParamSlider
              key={p.id}
              param={p}
              value={values[p.id]}
              selected={p.id === selectedId}
              onChange={setValue}
              onReset={resetValue}
              onSelect={onSelect}
              recentDir={macros.recent?.dirs.get(p.id)}
              recentAt={macros.recent?.at}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
