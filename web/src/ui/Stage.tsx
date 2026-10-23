import { useMemo, useState } from 'react'
import { sourceFilterSpectrum } from '../engine/analysis'
import type { FrameParams } from '../engine/dsp/frame'
import type { SpeechRender } from '../engine/speech/render'
import { VOWEL_FORMANTS, VOWELS, vowelFormants } from '../engine/mapping'
import { player } from '../engine/player'
import { GlottalPulseView, LiveSpectrogram, SourceFilterView, VowelChart } from '../viz'
import { AnatomyView } from '../anatomy/AnatomyView'
import { ANATOMY_LABELS, PARAM_BY_ID, PARAMS, type AnatomyPart, type ParamValues } from '../params/schema'

interface Props {
  selectedId: string
  onSelect: (id: string) => void
  values: ParamValues
  vowel: string
  playing: boolean
  frame: FrameParams
  speech: SpeechRender | null
}

type VizTab = 'vowel' | 'pulse' | 'live'
const VIZ_TABS: { id: VizTab; label: string }[] = [
  { id: 'vowel', label: '모음 사각도' },
  { id: 'pulse', label: '성대 펄스' },
  { id: 'live', label: '실시간 스펙트로그램' },
]
const REFERENCE = VOWELS.map((v) => ({ vowel: v, f1: VOWEL_FORMANTS[v][0], f2: VOWEL_FORMANTS[v][1] }))

const ALL_PARTS = Object.keys(ANATOMY_LABELS) as AnatomyPart[]

export function Stage({ selectedId, onSelect, values, vowel, playing, frame, speech }: Props) {
  const [tab, setTab] = useState<VizTab>('vowel')
  const spectrum = useMemo(() => sourceFilterSpectrum(frame, 5000), [frame])
  const vowelPoints = useMemo(
    () => VOWELS.map((v) => { const f = vowelFormants(values, v).formants; return { vowel: v, f1: f[0], f2: f[1] } }),
    [values],
  )
  const [part, setPart] = useState<AnatomyPart | null>(null)
  const selected = PARAM_BY_ID[selectedId]
  const related = new Set<AnatomyPart>(selected?.anatomy ?? [])
  const highlight = [...new Set<AnatomyPart>([...related, ...(part ? [part] : [])])]
  const togglePart = (a: AnatomyPart) => setPart(part === a ? null : a)
  const partParams = part ? PARAMS.filter((p) => p.anatomy.includes(part)) : []

  return (
    <div className="stage">
      {speech && (
        <section className="stage-box">
          <h2>문장 분석</h2>
          <p>
            {speech.normalized} → [{speech.g2p.pronunciation}]
          </p>
        </section>
      )}
      <section className="stage-box anatomy-box">
        <h2>해부도</h2>
        <div className={`anatomy-wrap group-${selected?.group}`}>
          <AnatomyView values={values} highlight={highlight} onPartClick={togglePart} vowel={vowel} playing={playing} />
        </div>
        <p className="hint">
          선택한 파라미터: <strong>{selected?.label}</strong> — 부위를 누르면 연결된 파라미터가 나타납니다.
        </p>
        <ul className="chips">
          {ALL_PARTS.map((a) => (
            <li key={a}>
              <button
                type="button"
                className={`chip group-${selected?.group}${related.has(a) ? ' related' : ''}${part === a ? ' active' : ''}`}
                onClick={() => togglePart(a)}
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
        <h2>음향 — 음원 × 필터 = 결과</h2>
        <SourceFilterView spectrum={spectrum} maxHz={5000} />
      </section>

      <section className="stage-box">
        <div className="viz-tabs" role="tablist">
          {VIZ_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : undefined} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'vowel' && <VowelChart points={vowelPoints} reference={REFERENCE} current={vowel} />}
        {tab === 'pulse' && <GlottalPulseView rd={frame.rd} f0={frame.f0} />}
        {tab === 'live' && <LiveSpectrogram analyser={player.analyser} active={playing} maxHz={5000} />}
      </section>
    </div>
  )
}
