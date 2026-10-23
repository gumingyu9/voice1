import { useEffect, useRef, useState } from 'react'
import type { ParamValues } from '../params/schema'
import { clamp, lerp } from './geometry'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 숫자 벡터를 목표값 쪽으로 부드럽게(지수 감쇠, 약 ms) 따라가게 한다. */
export function useSmoothed(target: number[], ms = 150): number[] {
  const [cur, setCur] = useState(target)
  const curRef = useRef(target)
  const key = target.join(',')

  useEffect(() => {
    if (reducedMotion()) return
    const goal = key.split(',').map(Number)
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const a = 1 - Math.exp(-(now - last) / (ms / 3))
      last = now
      const next = curRef.current.map((c, i) => c + (goal[i] - c) * a)
      const done = next.every((n, i) => Math.abs(n - goal[i]) < 0.05)
      curRef.current = done ? goal : next
      setCur(curRef.current)
      if (!done) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [key, ms])

  return reducedMotion() ? target : cur
}

const val = (v: ParamValues, id: string) => v[id] ?? 0

/** Rd → 열림 비율(Open Quotient). 낮을수록 닫힘 구간이 길다. */
export function openQuotient(rd: number): number {
  return clamp(lerp(0.32, 0.95, (rd - 0.3) / 2.4), 0.3, 0.95)
}

/** 정지 상태(재생 안 함)의 중간 닫힘 자세. */
export function staticOpening(values: ParamValues): number {
  return 0.05 + 0.3 * openQuotient(val(values, 'phonation'))
}

/**
 * 재생 중 성대 열림 정도(0~1+)를 느린 화면 속도로 시뮬레이션한다.
 * 재생이 아니면 null 을 돌려주고 rAF 루프를 돌리지 않는다.
 */
export function useFoldOpening(values: ParamValues, playing: boolean): number | null {
  const [o, setO] = useState<number | null>(null)
  const valRef = useRef(values)

  useEffect(() => {
    valRef.current = values
  })

  useEffect(() => {
    if (!playing || reducedMotion()) return
    const s = { phase: 0, periodMul: 1, amp: 1, k: 0, time: 0, shown: -1 }
    const rnd = () => Math.random() * 2 - 1
    const newCycle = () => {
      const v = valRef.current
      const j = val(v, 'jitter') / 5
      const sh = val(v, 'shimmer') / 20
      const cr = val(v, 'creak') / 100
      s.k++
      s.periodMul = clamp(1 + rnd() * (j * 0.45 + cr * 0.5), 0.5, 2)
      let a = 1 + rnd() * sh * 0.7
      if (cr > 0 && s.k % 2 === 1) a *= 1 - 0.55 * cr
      s.amp = clamp(a, 0.15, 1.3)
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      s.time += dt
      const v = valRef.current
      const u = clamp(Math.log(val(v, 'f0') / 50) / Math.log(12), 0, 1)
      const cr = val(v, 'creak') / 100
      const rate = (1.5 + 4.5 * u) * (1 - 0.75 * cr)
      s.phase += (dt * rate) / s.periodMul
      if (s.phase >= 1) {
        s.phase -= 1
        newCycle()
      }
      const oq = lerp(openQuotient(val(v, 'phonation')), 0.45, cr)
      const tremor = 1 + (val(v, 'tremorDepth') / 100) * 0.5 * Math.sin(2 * Math.PI * val(v, 'tremorRate') * 0.35 * s.time)
      let open = 0
      if (s.phase < oq) open = Math.pow(Math.sin((Math.PI * s.phase) / oq), 1.3)
      open = open * s.amp * tremor + 0.04
      if (Math.abs(open - s.shown) > 0.004) {
        s.shown = open
        setO(open)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  return playing ? o : null
}
