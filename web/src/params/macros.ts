// 매크로(상위 개념) 슬라이더: 사람들이 "나이·성별·체격·감정"이라고 부르는 것이
// 실제로는 여러 저수준 파라미터의 조합임을 보여주기 위한 정의.
//
// 매크로 값이 Δm 만큼 움직이면 각 파라미터는 (계수 × Δm) 만큼 움직인다.
// - 'f0' 만 곱셈(로그) 계수: 1.75 = 매크로 1 단위당 음높이 ×1.75
// - 나머지는 파라미터 단위 그대로 더한다 (범위 밖은 잘린다)
// 음수 쪽과 양수 쪽 의미가 다른 매크로(나이: 어린이 ↔ 노년)는 neg/pos 계수를 따로 둔다.

import { PARAM_BY_ID, type ParamValues } from './schema.ts'

export type Coeffs = Partial<Record<string, number>>

export interface MacroDef {
  id: string
  label: string
  min: number
  max: number
  ends: [string, string]
  /** 값이 음수 방향일 때 1 단위당 변화 (|Δm| 기준) */
  neg: Coeffs
  /** 값이 양수 방향일 때 1 단위당 변화 */
  pos: Coeffs
  explain: string
}

export const MACROS: MacroDef[] = [
  {
    id: 'age', label: '나이', min: -1, max: 1, ends: ['어린이', '노년'],
    neg: { f0: 2.1, vtl: -5.5, f0Range: 2, rate: -0.5, breathiness: 5, articulation: -5 },
    pos: { f0: 1.08, jitter: 1.5, shimmer: 5, tremorRate: 5, tremorDepth: 25, breathiness: 15, creak: 10, rate: -1.2, loudness: -10, articulation: -10 },
    explain: '어릴수록 성대가 짧고 성도가 짧아 음높이와 포먼트가 모두 높다. 나이가 들면 성대 점막과 근육이 변해 흔들림·떨림·숨소리가 늘고 말이 느려진다.',
  },
  {
    id: 'gender', label: '성별 특성', min: -1, max: 1, ends: ['남성적', '여성적'],
    neg: { f0: 0.8, vtl: 1, breathiness: -5, f0Range: -1, larynxHeight: -0.3, phonation: -0.15 },
    pos: { f0: 1.75, vtl: -2.5, breathiness: 12, f0Range: 2, larynxHeight: 0.2, phonation: 0.3 },
    explain: '사춘기 이후 남성은 성대가 길고 두꺼워지고(음높이↓) 후두가 내려가 성도가 길어진다(포먼트↓). 음높이만 바꾸면 성별 인상이 반쯤만 바뀐다 — 성도 길이를 같이 움직여 보자.',
  },
  {
    id: 'size', label: '체격', min: -1, max: 1, ends: ['작음', '큼'],
    neg: { f0: 1.18, vtl: -2.5, loudness: -10 },
    pos: { f0: 1 / 1.18, vtl: 2.5, loudness: 10 },
    explain: '몸이 클수록 성도가 길어 포먼트가 낮고, 성대도 커서 음높이가 낮은 경향이 있다. 사람은 주로 포먼트로 상대의 체격을 짐작한다.',
  },
  {
    id: 'health', label: '목 상태', min: 0, max: 1, ends: ['건강', '쉰 목'],
    neg: {},
    pos: { jitter: 2.5, shimmer: 9, breathiness: 20, creak: 15, phonation: 0.2 },
    explain: '성대가 붓거나 지치면 진동이 불규칙해지고(주기·세기 흔들림) 완전히 닫히지 않아 숨소리가 섞인다.',
  },
]

/** 감정: 하나만 고르는 0..1 매크로 */
export const EMOTIONS: MacroDef[] = [
  {
    id: 'joy', label: '기쁨', min: 0, max: 1, ends: ['', ''], neg: {},
    pos: { f0: 1.2, f0Range: 4, rate: 0.6, loudness: 8, lipShape: -0.4, phonation: -0.1 },
    explain: '음높이와 억양 폭이 커지고 말이 빨라진다. 입꼬리가 올라가 입술이 펴지면서 포먼트도 살짝 올라간다(웃는 목소리).',
  },
  {
    id: 'anger', label: '화남', min: 0, max: 1, ends: ['', ''], neg: {},
    pos: { f0: 1.1, f0Range: 2, loudness: 20, phonation: -0.5, consonantForce: 35, rate: 0.4, ring: 20 },
    explain: '성대를 세게 붙여(눌린 발성) 고음 배음이 강해지고, 자음을 세게 터뜨린다.',
  },
  {
    id: 'sad', label: '슬픔', min: 0, max: 1, ends: ['', ''], neg: {},
    pos: { f0: 0.92, f0Range: -3, rate: -1.2, loudness: -12, breathiness: 15, phonation: 0.4, intonation: -0.3, articulation: -10 },
    explain: '억양이 평평해지고 느려지며, 성대 긴장이 풀려 숨 섞인 소리가 된다.',
  },
  {
    id: 'sleepy', label: '졸림', min: 0, max: 1, ends: ['', ''], neg: {},
    pos: { f0: 0.9, f0Range: -3.5, rate: -1.4, articulation: -25, creak: 30, breathiness: 10, loudness: -10 },
    explain: '혀와 턱을 덜 움직여 웅얼거리고, 문장 끝에서 성대가 늘어져 보컬 프라이가 나온다.',
  },
]

export const ALL_MACROS: MacroDef[] = [...MACROS, ...EMOTIONS]

export interface ParamChange {
  id: string
  from: number
  to: number
}

/**
 * 매크로를 from → to 로 움직였을 때의 새 파라미터 값과 바뀐 목록.
 * 음수 구간과 양수 구간을 지나가면 각 구간의 계수를 따로 적용한다.
 */
export function applyMacro(values: ParamValues, macro: MacroDef, from: number, to: number): { values: ParamValues; changes: ParamChange[] } {
  const negPart = Math.min(0, to) - Math.min(0, from) // 음수 구간에서 움직인 양 (부호 포함)
  const posPart = Math.max(0, to) - Math.max(0, from)
  const next = { ...values }
  const ids = new Set([...Object.keys(macro.neg), ...Object.keys(macro.pos)])
  const changes: ParamChange[] = []
  for (const id of ids) {
    const p = PARAM_BY_ID[id]
    if (!p) continue
    let v = next[id]
    // 음수 쪽 계수는 "−1 로 갈 때의 변화"로 정의되어 있으므로 부호를 뒤집어 적용
    const n = macro.neg[id]
    const q = macro.pos[id]
    if (id === 'f0') {
      if (n !== undefined) v *= Math.pow(n, -negPart)
      if (q !== undefined) v *= Math.pow(q, posPart)
    } else {
      if (n !== undefined) v += n * -negPart
      if (q !== undefined) v += q * posPart
    }
    v = Math.min(p.max, Math.max(p.min, Number((Math.round(v / p.step) * p.step).toFixed(6))))
    if (v !== values[id]) changes.push({ id, from: values[id], to: v })
    next[id] = v
  }
  return { values: next, changes }
}
