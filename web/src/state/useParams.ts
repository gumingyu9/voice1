import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_VALUES, PARAM_BY_ID, PARAMS, type ParamValues } from '../params/schema'

/** step 단위로 반올림하고 min/max로 자른다 (부동소수점 잡음 제거 포함). */
function normalize(id: string, v: number): number {
  const p = PARAM_BY_ID[id]
  const decimals = (String(p.step).split('.')[1] ?? '').length
  const clamped = Math.min(p.max, Math.max(p.min, v))
  return Number(clamped.toFixed(decimals + 2))
}

/** URL 쿼리에서 알려진 id만 읽어 기본값과 합친다. */
function readFromUrl(): ParamValues {
  const values = { ...DEFAULT_VALUES }
  const query = new URLSearchParams(window.location.search)
  for (const [id, raw] of query) {
    if (!(id in PARAM_BY_ID) || raw.trim() === '') continue
    const n = Number(raw)
    if (Number.isFinite(n)) values[id] = normalize(id, n)
  }
  return values
}

function writeToUrl(values: ParamValues): void {
  const query = new URLSearchParams()
  for (const p of PARAMS) {
    if (values[p.id] !== p.default) query.set(p.id, String(values[p.id]))
  }
  const qs = query.toString()
  const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
  window.history.replaceState(null, '', url)
}

export function useParams() {
  const [values, setValues] = useState<ParamValues>(readFromUrl)
  const [selectedId, setSelectedId] = useState('f0')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // 값이 바뀌면 200ms 후 URL에 반영
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => writeToUrl(values), 200)
    return () => window.clearTimeout(timer.current)
  }, [values])

  const setValue = useCallback((id: string, v: number) => {
    if (!(id in PARAM_BY_ID)) return
    setValues((prev) => ({ ...prev, [id]: normalize(id, v) }))
  }, [])

  const resetValue = useCallback((id: string) => {
    setValues((prev) => ({ ...prev, [id]: DEFAULT_VALUES[id] }))
  }, [])

  const resetAll = useCallback(() => setValues({ ...DEFAULT_VALUES }), [])

  return { values, setValue, resetValue, resetAll, selectedId, setSelectedId, showAdvanced, setShowAdvanced }
}

export type ParamsState = ReturnType<typeof useParams>
