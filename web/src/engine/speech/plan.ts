// 운율 계획: 세그먼트 길이(말 속도·끝 늘이기·호흡 쉼)와 음높이 궤적(억양)을 정한다.
//
// 서울말 억양 모델(단순화): 띄어쓰기 단위 = 강세구(AP). 강세구는 보통 "낮-높-…-낮-높" 으로 오르내리고,
// 첫 소리가 된소리·거센소리·ㅅ·ㅎ 이면 "높게" 시작한다. 쉼 직전 마지막 음절은 경계 억양
// (평서문은 내림, 의문문은 올림)을 받는다. 문장이 진행될수록 전체 음높이는 조금씩 내려간다(하강).

import type { ParamValues } from '../../params/schema.ts'
import type { Segment } from '../ko/phonetics.ts'

export interface TimedSegment extends Segment {
  start: number // ms
  end: number
}

export interface PitchPoint {
  t: number // ms
  st: number // 평균 음높이 대비 반음
}

export interface SpeechPlan {
  segments: TimedSegment[]
  pitch: PitchPoint[]
  duration: number
  /** 쉼 직전(억양구 끝) 음절 번호 */
  phraseFinal: Set<number>
}

const BREATH_PAUSE = 260

function isPause(s: Segment) {
  return s.kind === 'pause'
}

/** 호흡 단위(breathGroup 음절)를 넘기 전에 단어 경계에서 숨 쉬는 쉼을 넣는다 */
function insertBreaths(segs: Segment[], breathGroup: number): Segment[] {
  const sylsOfWord = new Map<number, Set<number>>()
  for (const s of segs) if (!isPause(s)) (sylsOfWord.get(s.word) ?? sylsOfWord.set(s.word, new Set()).get(s.word)!).add(s.syl)
  const out: Segment[] = []
  let count = 0
  let prevWord = -1
  for (const s of segs) {
    if (isPause(s)) {
      count = 0
      out.push(s)
      continue
    }
    if (s.word !== prevWord) {
      const n = sylsOfWord.get(s.word)!.size
      if (count > 0 && count + n > breathGroup) {
        out.push({ kind: 'pause', ipa: '‖', jamo: '', dur: BREATH_PAUSE, syl: s.syl - 1, word: prevWord, pause: 'breath' })
        count = 0
      }
      count += n
      prevWord = s.word
    }
    out.push(s)
  }
  return out
}

function scalePhases(s: Segment, k: number, force: number) {
  s.dur *= k
  if (!s.phases) return
  const p = s.phases
  // 자음 세기: 터짐·기식 구간이 길어지고 막힘이 단단해진다
  const f = 0.6 + 0.4 * force
  p.closure *= k
  p.fric *= k
  p.asp *= k * f
  p.burst = Math.max(3, p.burst * f)
  s.dur = p.closure + p.burst + p.fric + p.asp
}

export function planSpeech(input: Segment[], v: ParamValues): SpeechPlan {
  const segs: Segment[] = insertBreaths(
    input.map((s) => ({ ...s, phases: s.phases && { ...s.phases } })),
    v.breathGroup,
  )
  const force = v.consonantForce / 100

  // ── 길이: 목표 말 속도에 맞추되 자음은 덜, 모음은 더 늘고 준다 ──
  const syllables = new Set(segs.filter((s) => !isPause(s)).map((s) => s.syl))
  const target = (syllables.size * 1000) / v.rate
  const vowelBase = segs.filter((s) => s.kind === 'vowel').reduce((a, s) => a + s.dur, 0)
  const consBase = segs.filter((s) => !isPause(s) && s.kind !== 'vowel').reduce((a, s) => a + s.dur, 0)
  const consK = Math.pow(target / (vowelBase + consBase), 0.6)
  for (const s of segs) if (!isPause(s) && s.kind !== 'vowel') scalePhases(s, consK, force)
  const consTotal = segs.filter((s) => !isPause(s) && s.kind !== 'vowel').reduce((a, s) => a + s.dur, 0)
  const vowelK = Math.max(0.35, (target - consTotal) / vowelBase)
  for (const s of segs) {
    if (s.kind === 'vowel') s.dur *= vowelK
    if (isPause(s)) s.dur *= Math.min(1.6, Math.max(0.6, Math.sqrt(5 / v.rate)))
  }

  // 억양구 끝 음절 늘이기, 강세구 끝 음절 약간 늘이기
  const phraseFinal = new Set<number>()
  segs.forEach((s, i) => {
    if (isPause(s) && i > 0) phraseFinal.add(segs[i - 1].syl)
  })
  const wordFinalSyl = new Map<number, number>()
  for (const s of segs) if (!isPause(s)) wordFinalSyl.set(s.word, Math.max(wordFinalSyl.get(s.word) ?? -1, s.syl))
  const apFinal = new Set(wordFinalSyl.values())
  for (const s of segs) {
    if (isPause(s) || (s.kind !== 'vowel' && s.position !== 'coda')) continue
    if (phraseFinal.has(s.syl)) s.dur *= 1.35
    else if (apFinal.has(s.syl)) s.dur *= 1.08
  }

  // ── 시간 배치 ──
  let t = 40 // 앞 여백
  const timed: TimedSegment[] = segs.map((s) => {
    const ts = { ...s, start: t, end: t + s.dur }
    t += s.dur
    return ts
  })

  return { segments: timed, pitch: buildPitch(timed, v, phraseFinal), duration: t, phraseFinal }
}

function buildPitch(segs: TimedSegment[], v: ParamValues, phraseFinal: Set<number>): PitchPoint[] {
  const R = v.f0Range
  const H = R / 2
  const L = -R / 2
  const points: PitchPoint[] = []

  // 억양구(쉼과 쉼 사이) 단위로 처리
  let i = 0
  while (i < segs.length) {
    while (i < segs.length && isPause(segs[i])) i++
    if (i >= segs.length) break
    const ipStart = i
    while (i < segs.length && !isPause(segs[i])) i++
    const ip = segs.slice(ipStart, i)
    const pauseType = segs[i]?.pause
    const t0 = ip[0].start
    const t1 = ip[ip.length - 1].end
    const decl = (t: number) => (-1.5 * (t - t0)) / Math.max(1, t1 - t0) + (pauseType === 'exclaim' ? 1.5 : 0)

    // 경계 억양: 문장 끝 억양 파라미터, '?' 면 반드시 올림
    let boundary = v.intonation < 0 ? L + v.intonation * R * 0.4 : v.intonation * R * 1.2
    if (pauseType === 'question') boundary = Math.max(boundary, 0.9 * R + 2)
    if (pauseType === 'comma' || pauseType === 'breath') boundary = Math.max(boundary, H * 0.6) // 이어짐을 알리는 살짝 올림

    const words = [...new Set(ip.map((s) => s.word))]
    words.forEach((w, wi) => {
      const wsegs = ip.filter((s) => s.word === w)
      const syls = [...new Set(wsegs.map((s) => s.syl))]
      const first = wsegs[0]
      const highStart = first.position === 'onset' && (first.lar === 'tense' || first.lar === 'asp' || first.kind === 'fricative' || first.kind === 'h')
      const T = highStart ? H : L
      const n = syls.length
      const downstep = -0.3 * wi
      syls.forEach((syl, k) => {
        const vowel = wsegs.find((s) => s.syl === syl && s.kind === 'vowel')
        if (!vowel) return
        const mid = (vowel.start + vowel.end) / 2
        if (phraseFinal.has(syl)) {
          points.push({ t: vowel.start, st: (k === 0 ? T : L * 0.5) + downstep + decl(vowel.start) })
          points.push({ t: vowel.end, st: boundary + decl(vowel.end) })
          return
        }
        let tone: number
        if (k === 0) tone = T
        else if (k === n - 1) tone = H
        else if (k === 1) tone = H
        else if (k === n - 2) tone = L
        else tone = H + ((L - H) * (k - 1)) / Math.max(1, n - 3) // 2번째 H 에서 끝에서 두 번째 L 로 내려감
        const at = k === n - 1 ? vowel.start + 0.75 * (vowel.end - vowel.start) : mid
        points.push({ t: at, st: tone + downstep + decl(at) })
      })
    })
  }
  return points.sort((a, b) => a.t - b.t)
}
