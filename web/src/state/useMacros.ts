import { useCallback, useEffect, useRef, useState } from 'react'
import { ALL_MACROS, applyMacro, EMOTIONS, MACROS, type ParamChange } from '../params/macros'
import { PRESETS, presetValues } from '../params/presets'
import { DEFAULT_VALUES, type ParamValues } from '../params/schema'

export interface ChangeSet {
  /** "무엇이 바뀌었나" 상자의 제목 */
  source: string
  changes: ParamChange[]
  at: number
}

const MACRO_BY_ID = Object.fromEntries(ALL_MACROS.map((m) => [m.id, m]))
const zeroPositions = (): Record<string, number> => Object.fromEntries(MACROS.map((m) => [m.id, 0]))

/** 같은 파라미터의 변경을 합친다: 처음 값 → 마지막 값, 결국 제자리면 뺀다. */
function mergeChanges(a: ParamChange[], b: ParamChange[]): ParamChange[] {
  const map = new Map<string, ParamChange>()
  for (const c of [...a, ...b]) {
    const prev = map.get(c.id)
    map.set(c.id, prev ? { id: c.id, from: prev.from, to: c.to } : c)
  }
  return [...map.values()].filter((c) => c.from !== c.to)
}

function diffValues(before: ParamValues, after: ParamValues): ParamChange[] {
  return Object.keys(after)
    .filter((id) => before[id] !== after[id])
    .map((id) => ({ id, from: before[id], to: after[id] }))
}

const MERGE_WINDOW_MS = 1500 // 슬라이더를 끄는 동안의 연속 변경은 하나로 합친다
const RECENT_MS = 3500 // 파라미터 슬라이더의 ↑/↓ 배지 표시 시간

export function useMacros(values: ParamValues, setValues: (next: ParamValues) => void) {
  const [positions, setPositions] = useState<Record<string, number>>(zeroPositions)
  const [emotion, setEmotionState] = useState<string | null>(null)
  const [presetId, setPresetId] = useState<string | null>(null)
  const [last, setLast] = useState<ChangeSet | null>(null)
  /** 슬라이더 하이라이트용: 마지막 매크로 동작으로 바뀐 파라미터. 몇 초 뒤 사라진다. */
  const [recent, setRecent] = useState<{ dirs: Map<string, 'up' | 'down'>; at: number } | null>(null)

  // 같은 이벤트 안에서 연달아 호출돼도 최신 값을 쓰도록 ref 로 들고 있는다
  const valuesRef = useRef(values)
  const positionsRef = useRef(positions)
  const emotionRef = useRef(emotion)
  const lastRef = useRef<ChangeSet | null>(null)
  useEffect(() => {
    valuesRef.current = values
  }, [values])

  useEffect(() => {
    if (!recent) return
    const t = window.setTimeout(() => setRecent(null), RECENT_MS)
    return () => window.clearTimeout(t)
  }, [recent])

  const commit = useCallback(
    (source: string, next: ParamValues, changes: ParamChange[], merge: boolean) => {
      valuesRef.current = next
      setValues(next)
      const now = Date.now()
      const prev = lastRef.current
      const merged = merge && prev && prev.source === source && now - prev.at < MERGE_WINDOW_MS ? mergeChanges(prev.changes, changes) : changes
      const set = { source, changes: merged, at: now }
      lastRef.current = set
      setLast(set)
      const dirs = new Map<string, 'up' | 'down'>()
      for (const c of merged) dirs.set(c.id, c.to > c.from ? 'up' : 'down')
      setRecent({ dirs, at: now })
    },
    [setValues],
  )

  const setPos = (next: Record<string, number>) => {
    positionsRef.current = next
    setPositions(next)
  }
  const setEmo = (id: string | null) => {
    emotionRef.current = id
    setEmotionState(id)
  }

  const moveMacro = useCallback(
    (id: string, to: number) => {
      const macro = MACRO_BY_ID[id]
      if (!macro) return
      const clamped = Math.min(macro.max, Math.max(macro.min, to))
      const from = positionsRef.current[id] ?? 0
      if (clamped === from) return
      const res = applyMacro(valuesRef.current, macro, from, clamped)
      setPos({ ...positionsRef.current, [id]: clamped })
      setPresetId(null)
      commit(`‘${macro.label}’을 움직이자`, res.values, res.changes, true)
    },
    [commit],
  )

  const setEmotion = useCallback(
    (id: string | null) => {
      if (id === emotionRef.current) return
      let v = valuesRef.current
      let changes: ParamChange[] = []
      const cur = emotionRef.current ? MACRO_BY_ID[emotionRef.current] : null
      if (cur) {
        const undo = applyMacro(v, cur, 1, 0)
        v = undo.values
        changes = undo.changes
      }
      const next = id ? MACRO_BY_ID[id] : null
      if (next) {
        const res = applyMacro(v, next, 0, 1)
        v = res.values
        changes = mergeChanges(changes, res.changes)
      }
      setEmo(id)
      setPresetId(null)
      commit(next ? `감정 ‘${next.label}’을 고르자` : '감정을 ‘중립’으로 돌리자', v, changes, false)
    },
    [commit],
  )

  const applyPreset = useCallback(
    (id: string) => {
      const p = PRESETS.find((x) => x.id === id)
      if (!p) return
      const next = presetValues(p)
      const changes = diffValues(valuesRef.current, next)
      setPos(zeroPositions())
      setEmo(null)
      setPresetId(id)
      commit(`프리셋 ‘${p.label}’을 고르자`, next, changes, false)
    },
    [commit],
  )

  const randomVoice = useCallback(() => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const round = (x: number) => Math.round(x * 100) / 100
    // 나이: 60% 는 성인 근처, 나머지는 전 범위
    const age = Math.random() < 0.6 ? rnd(-0.2, 0.3) : rnd(-1, 1)
    const pos: Record<string, number> = {
      age: round(age),
      gender: round(rnd(-1, 1)),
      size: round(rnd(-0.7, 0.7)),
      health: Math.random() < 0.7 ? 0 : round(rnd(0, 0.5)),
    }
    let v: ParamValues = { ...DEFAULT_VALUES }
    for (const m of MACROS) v = applyMacro(v, m, 0, pos[m.id]).values
    const changes = diffValues(valuesRef.current, v)
    setPos(pos)
    setEmo(null)
    setPresetId(null)
    commit('무작위 목소리를 만들자', v, changes, false)
  }, [commit])

  const resetMacros = useCallback(() => {
    setPos(zeroPositions())
    setEmo(null)
    setPresetId(null)
    lastRef.current = null
    setLast(null)
    setRecent(null)
  }, [])

  const dismiss = useCallback(() => {
    lastRef.current = null
    setLast(null)
  }, [])

  return { positions, emotion, presetId, last, recent, moveMacro, setEmotion, applyPreset, randomVoice, resetMacros, dismiss, emotions: EMOTIONS }
}

export type MacrosState = ReturnType<typeof useMacros>
