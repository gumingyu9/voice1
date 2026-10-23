import { useState } from 'react'
import { VOWELS, type Vowel } from '../engine/mapping'

interface Props {
  onResetAll: () => void
  vowel: Vowel
  setVowel: (v: Vowel) => void
  playing: boolean
  onTogglePlay: () => void
  onSpeak: (text: string) => void
  text: string
  setText: (t: string) => void
}

export function TopBar({ onResetAll, vowel, setVowel, playing, onTogglePlay, onSpeak, text, setText }: Props) {
  const [engine, setEngine] = useState<'A' | 'B'>('A')

  return (
    <header className="topbar">
      <h1>Voice Lab — 목소리 실험실</h1>

      <div className="topbar-controls">
        <input
          type="text"
          className="text-input"
          value={text}
          maxLength={50}
          placeholder="단어나 문장을 입력하세요"
          aria-label="합성할 텍스트"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSpeak(text)
          }}
        />
        <button type="button" className="primary" onClick={() => onSpeak(text)} disabled={!text.trim()} title="입력한 문장을 지금 설정으로 말하기 (Enter)">
          ▶ 재생
        </button>

        <div className="segmented" role="group" aria-label="엔진 선택">
          <button type="button" className={engine === 'A' ? 'active' : undefined} onClick={() => setEngine('A')}>
            A 해부학
          </button>
          <button type="button" disabled title="자연음 서버 미연결" onClick={() => setEngine('B')}>
            B 자연음
          </button>
        </div>

        <label className="vowel-select">
          지속 모음
          <select value={vowel} onChange={(e) => setVowel(e.target.value as Vowel)}>
            {VOWELS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={playing ? 'primary' : undefined} onClick={onTogglePlay} aria-pressed={playing}>
          {playing ? '■ 정지' : '▶ 지속 모음 재생'}
        </button>

        <button type="button" onClick={onResetAll}>
          전체 초기화
        </button>
      </div>
    </header>
  )
}
