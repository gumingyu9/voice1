import { PARAM_BY_ID } from './params/schema'
import { useParams } from './state/useParams'
import { ExplainCard } from './ui/ExplainCard'
import { ParamPanel } from './ui/ParamPanel'
import { Stage } from './ui/Stage'
import { TopBar } from './ui/TopBar'

export function App() {
  const { values, setValue, resetValue, resetAll, selectedId, setSelectedId, showAdvanced, setShowAdvanced } = useParams()

  // 숨겨진 고급 파라미터가 선택되면 패널에서도 보이도록 펼친다
  const select = (id: string) => {
    if (PARAM_BY_ID[id]?.advanced) setShowAdvanced(true)
    setSelectedId(id)
  }

  return (
    <div className="app">
      <TopBar onResetAll={resetAll} />
      <main className="layout">
        <aside className="col-params" aria-label="파라미터">
          <ParamPanel
            values={values}
            setValue={setValue}
            resetValue={resetValue}
            selectedId={selectedId}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            onSelect={select}
          />
        </aside>
        <section className="col-stage" aria-label="시각화">
          <Stage selectedId={selectedId} onSelect={select} />
        </section>
        <aside className="col-explain" aria-label="설명">
          <ExplainCard selectedId={selectedId} values={values} onChange={setValue} />
        </aside>
      </main>
    </div>
  )
}
