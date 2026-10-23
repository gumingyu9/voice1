import { useEffect, useMemo, useState } from 'react'
import { frameFor, type Vowel } from './engine/mapping'
import { player } from './engine/player'
import { PARAM_BY_ID } from './params/schema'
import { useListening } from './state/useListening'
import { useParams } from './state/useParams'
import { ExplainCard } from './ui/ExplainCard'
import { ListeningBar } from './ui/ListeningBar'
import { ParamPanel } from './ui/ParamPanel'
import { Stage } from './ui/Stage'
import { TopBar } from './ui/TopBar'

export function App() {
  const { values, setValue, resetValue, resetAll, selectedId, setSelectedId, showAdvanced, setShowAdvanced } = useParams()

  const [vowel, setVowel] = useState<Vowel>('ㅏ')
  const [playing, setPlaying] = useState(false)
  const listening = useListening()

  useEffect(() => {
    player.onPlayingChange = setPlaying
    return () => {
      player.onPlayingChange = null
    }
  }, [])

  // 슬라이더가 바뀔 때마다 합성기 목표 프레임 갱신 (재생 중이면 바로 들린다)
  const frame = useMemo(() => frameFor(values, vowel), [values, vowel])
  useEffect(() => player.update(frame), [frame])

  const togglePlay = () => (playing ? player.stop() : void player.start(frame))

  // 비교 듣기: 값을 바꾸고 1.2초 들려준다 (이미 재생 중이면 계속 재생)
  const compare = (id: string, v: number) => {
    setValue(id, v)
    void player.playFor(frameFor({ ...values, [id]: v }, vowel), 1200)
  }

  // 숨겨진 고급 파라미터가 선택되면 패널에서도 보이도록 펼친다
  const select = (id: string) => {
    if (PARAM_BY_ID[id]?.advanced) setShowAdvanced(true)
    setSelectedId(id)
  }

  return (
    <div className="app">
      <TopBar onResetAll={resetAll} vowel={vowel} setVowel={setVowel} playing={playing} onTogglePlay={togglePlay} />
      <ListeningBar settings={listening.settings} update={listening.update} />
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
          <Stage selectedId={selectedId} onSelect={select} values={values} vowel={vowel} playing={playing} frame={frame} />
        </section>
        <aside className="col-explain" aria-label="설명">
          <ExplainCard selectedId={selectedId} values={values} onCompare={compare} />
        </aside>
      </main>
    </div>
  )
}
