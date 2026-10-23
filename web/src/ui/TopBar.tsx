import { useState } from 'react'

interface Props {
  onResetAll: () => void
}

const VOWELS = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ', 'ㅔ']

export function TopBar({ onResetAll }: Props) {
  const [text, setText] = useState('')
  const [engine, setEngine] = useState<'A' | 'B'>('A')
  const [vowel, setVowel] = useState(VOWELS[0])

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
        />
        <button type="button" className="primary" disabled title="P2에서 구현">
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
          <select value={vowel} onChange={(e) => setVowel(e.target.value)}>
            {VOWELS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled title="P1에서 구현" aria-pressed="false">
          지속 모음 재생
        </button>

        <button type="button" onClick={onResetAll}>
          전체 초기화
        </button>
      </div>
    </header>
  )
}
