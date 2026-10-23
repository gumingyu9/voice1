import { useEffect, useState } from 'react'
import { player } from '../engine/player'

// 청취 편의 설정. 목소리 파라미터가 아니라 "듣는 사람의 귀"를 위한 설정이라 URL 이 아닌 이 브라우저에만 저장한다.

export interface ListeningSettings {
  volume: number // 0..1
  autoStop: boolean
  pulse: boolean
  soft: boolean
}

const KEY = 'voice-lab:listening'
const DEFAULTS: ListeningSettings = { volume: 0.4, autoStop: true, pulse: false, soft: true }
export const AUTO_STOP_SEC = 8

function load(): ListeningSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ListeningSettings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function useListening() {
  const [settings, setSettings] = useState<ListeningSettings>(load)

  useEffect(() => {
    player.setVolume(settings.volume)
    player.autoStopMs = settings.autoStop ? AUTO_STOP_SEC * 1000 : 0
    player.setComfort({ pulse: settings.pulse, soft: settings.soft })
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // 저장 불가(사생활 보호 모드 등)여도 동작에는 문제 없음
    }
  }, [settings])

  const update = (patch: Partial<ListeningSettings>) => setSettings((s) => ({ ...s, ...patch }))
  return { settings, update }
}
