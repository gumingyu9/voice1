import { useEffect, useMemo, useState } from 'react'
import { frameFor, type Vowel } from './engine/mapping'
import { player } from './engine/player'
import { renderSpeech, type SpeechRender } from './engine/speech/render'
import { PARAM_BY_ID, type ParamValues } from './params/schema'
import { useListening } from './state/useListening'
import { useMacros } from './state/useMacros'
import { useParams } from './state/useParams'
import { ExplainCard } from './ui/ExplainCard'
import { ListeningBar } from './ui/ListeningBar'
import { ParamPanel } from './ui/ParamPanel'
import { Stage } from './ui/Stage'
import { TopBar } from './ui/TopBar'

export function App() {
  const { values, setValue, setValues, resetValue, resetAll, selectedId, setSelectedId, showAdvanced, setShowAdvanced } = useParams()

  const macros = useMacros(values, setValues)
  const { resetMacros } = macros
  const handleResetAll = () => {
    resetAll()
    resetMacros()
  }

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

  // 문장 재생: 실제 출력 샘플레이트로 렌더링한 뒤 재생
  const [text, setText] = useState('안녕하세요')
  const [speech, setSpeech] = useState<SpeechRender | null>(null)
  const [spokenText, setSpokenText] = useState('')
  const [playStartedAt, setPlayStartedAt] = useState<number | null>(null)
  const speak = async (t: string, v: ParamValues = values) => {
    if (!t.trim()) return
    const sampleRate = await player.prepare()
    const r = renderSpeech(t, v, { sampleRate, soft: listening.settings.soft })
    setSpeech(r)
    setSpokenText(t)
    if (r.plan.segments.some((s) => s.kind !== 'pause')) {
      await player.playBuffer(r.audio, sampleRate)
      setPlayStartedAt(performance.now())
    }
  }
  const replay = async () => {
    if (!speech) return
    await player.playBuffer(speech.audio, speech.sampleRate)
    setPlayStartedAt(performance.now())
  }

  const togglePlay = () => (playing ? player.stop() : void player.start(frame))

  // 비교 듣기: 값을 바꾸고 1.2초 들려준다 (이미 재생 중이면 계속 재생)
  // 문장에서만 효과가 있는 파라미터는 입력한 문장으로 들려준다
  const compare = (id: string, v: number) => {
    setValue(id, v)
    if (PARAM_BY_ID[id]?.speechOnly) void speak(text || '안녕하세요', { ...values, [id]: v })
    else void player.playFor(frameFor({ ...values, [id]: v }, vowel), 1200)
  }

  // 숨겨진 고급 파라미터가 선택되면 패널에서도 보이도록 펼친다
  const select = (id: string) => {
    if (PARAM_BY_ID[id]?.advanced) setShowAdvanced(true)
    setSelectedId(id)
  }

  return (
    <div className="app">
      <TopBar onResetAll={handleResetAll} vowel={vowel} setVowel={setVowel} playing={playing} onTogglePlay={togglePlay} onSpeak={(t) => void speak(t)} text={text} setText={setText} />
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
            macros={macros}
          />
        </aside>
        <section className="col-stage" aria-label="시각화">
          <Stage selectedId={selectedId} onSelect={select} values={values} vowel={vowel} playing={playing} frame={frame} speech={speech} spokenText={spokenText} onReplay={() => void replay()} playStartedAt={playStartedAt} />
        </section>
        <aside className="col-explain" aria-label="설명">
          <ExplainCard selectedId={selectedId} values={values} onCompare={compare} />
        </aside>
      </main>
    </div>
  )
}
