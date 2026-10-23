import type React from 'react'
import { AUTO_STOP_SEC, type ListeningSettings } from '../state/useListening'

interface Props {
  settings: ListeningSettings
  update: (patch: Partial<ListeningSettings>) => void
}

const TOGGLES: { key: 'autoStop' | 'pulse' | 'soft'; label: string; title: string }[] = [
  { key: 'autoStop', label: `${AUTO_STOP_SEC}초 후 자동 정지`, title: '지속 모음을 켜 두어도 일정 시간 뒤 저절로 멈춥니다' },
  { key: 'pulse', label: '끊어 듣기', title: '1.5초 소리 내고 1초 쉬기를 반복합니다' },
  { key: 'soft', label: '부드러운 소리', title: '쨍한 고음역을 살짝 줄이고 음높이를 사람처럼 미세하게 흔듭니다' },
]

export function ListeningBar({ settings, update }: Props) {
  return (
    <div className="listening-bar" role="group" aria-label="청취 설정">
      <label className="volume">
        <span aria-hidden="true">🔊</span> 음량
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.volume * 100)}
          onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
          style={{ '--fill': `${settings.volume * 100}%`, '--accent': 'var(--primary)' } as React.CSSProperties}
          aria-label="음량"
        />
        <span className="volume-value">{Math.round(settings.volume * 100)}</span>
      </label>
      {TOGGLES.map((t) => (
        <label key={t.key} className="switch" title={t.title}>
          <input type="checkbox" checked={settings[t.key]} onChange={(e) => update({ [t.key]: e.target.checked })} />
          <span className="switch-track" aria-hidden="true" />
          {t.label}
        </label>
      ))}
    </div>
  )
}
