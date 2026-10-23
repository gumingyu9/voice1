// 발음(음운 규칙 적용 후의 음절) → 음성 세그먼트(실제로 나는 소리 단위).
// 같은 자모도 위치에 따라 다른 소리가 된다(변이음): 모음 사이 ㄱ은 [g], 받침 ㄱ은 터뜨리지 않는 [k̚],
// 모음 사이 ㄹ은 혀를 한 번 튕기는 [ɾ], 받침 ㄹ은 옆으로 흘리는 [l], ㅣ 앞 ㅅ은 [ɕ].

import type { Syllable } from './hangul.ts'
import type { Token } from './g2p.ts'

export type Place = 'lab' | 'alv' | 'pal' | 'vel' | 'glot'
export type Laryngeal = 'lax' | 'tense' | 'asp'
export type SegKind = 'vowel' | 'glide' | 'stop' | 'affricate' | 'fricative' | 'nasal' | 'liquid' | 'h' | 'pause'
export type VowelKey = 'a' | 'e' | 'ʌ' | 'o' | 'u' | 'ɯ' | 'i'

/** 장애음(막힘·마찰) 내부 단계 길이 (ms, 말 속도 5음절/초 기준) */
export interface ObstruentPhases {
  closure: number // 완전히 막힌 구간
  burst: number // 터지는 순간
  fric: number // 좁은 틈 마찰
  asp: number // 성대가 떨기 전 숨이 나가는 구간 (VOT 의 대부분)
}

export interface Segment {
  kind: SegKind
  ipa: string
  jamo: string
  dur: number // ms
  syl: number // 전체 음절 번호 (pause 는 직전 음절)
  word: number
  vowel?: VowelKey
  place?: Place
  lar?: Laryngeal
  position?: 'onset' | 'coda'
  voiced?: boolean // 유성음 사이 예사소리의 유성음화
  flap?: boolean
  phases?: ObstruentPhases
  pause?: 'comma' | 'period' | 'question' | 'exclaim' | 'breath'
}

// ── 모음 ──
const NUCLEUS: Record<string, [glide: '' | 'j' | 'w' | 'ɰ', vowel: VowelKey]> = {
  ㅏ: ['', 'a'], ㅐ: ['', 'e'], ㅔ: ['', 'e'], ㅓ: ['', 'ʌ'], ㅗ: ['', 'o'], ㅜ: ['', 'u'], ㅡ: ['', 'ɯ'], ㅣ: ['', 'i'],
  ㅑ: ['j', 'a'], ㅒ: ['j', 'e'], ㅖ: ['j', 'e'], ㅕ: ['j', 'ʌ'], ㅛ: ['j', 'o'], ㅠ: ['j', 'u'],
  ㅘ: ['w', 'a'], ㅙ: ['w', 'e'], ㅚ: ['w', 'e'], ㅞ: ['w', 'e'], ㅝ: ['w', 'ʌ'], ㅟ: ['w', 'i'],
  ㅢ: ['ɰ', 'i'],
}
const VOWEL_JAMO: Record<VowelKey, string> = { a: 'ㅏ', e: 'ㅔ', ʌ: 'ㅓ', o: 'ㅗ', u: 'ㅜ', ɯ: 'ㅡ', i: 'ㅣ' }

// ── 자음 ──
interface ConsDef {
  kind: SegKind
  place: Place
  lar?: Laryngeal
  ipa: string
}
const CONS: Record<string, ConsDef> = {
  ㄱ: { kind: 'stop', place: 'vel', lar: 'lax', ipa: 'k' },
  ㄲ: { kind: 'stop', place: 'vel', lar: 'tense', ipa: 'k͈' },
  ㅋ: { kind: 'stop', place: 'vel', lar: 'asp', ipa: 'kʰ' },
  ㄷ: { kind: 'stop', place: 'alv', lar: 'lax', ipa: 't' },
  ㄸ: { kind: 'stop', place: 'alv', lar: 'tense', ipa: 't͈' },
  ㅌ: { kind: 'stop', place: 'alv', lar: 'asp', ipa: 'tʰ' },
  ㅂ: { kind: 'stop', place: 'lab', lar: 'lax', ipa: 'p' },
  ㅃ: { kind: 'stop', place: 'lab', lar: 'tense', ipa: 'p͈' },
  ㅍ: { kind: 'stop', place: 'lab', lar: 'asp', ipa: 'pʰ' },
  ㅈ: { kind: 'affricate', place: 'pal', lar: 'lax', ipa: 'tɕ' },
  ㅉ: { kind: 'affricate', place: 'pal', lar: 'tense', ipa: 't͈ɕ' },
  ㅊ: { kind: 'affricate', place: 'pal', lar: 'asp', ipa: 'tɕʰ' },
  ㅅ: { kind: 'fricative', place: 'alv', lar: 'lax', ipa: 's' },
  ㅆ: { kind: 'fricative', place: 'alv', lar: 'tense', ipa: 's͈' },
  ㅎ: { kind: 'h', place: 'glot', ipa: 'h' },
  ㅁ: { kind: 'nasal', place: 'lab', ipa: 'm' },
  ㄴ: { kind: 'nasal', place: 'alv', ipa: 'n' },
  ㅇ: { kind: 'nasal', place: 'vel', ipa: 'ŋ' },
  ㄹ: { kind: 'liquid', place: 'alv', ipa: 'l' },
}

const VOICED_KINDS: SegKind[] = ['vowel', 'glide', 'nasal', 'liquid']
const FRONT_HIGH = new Set(['i', 'j'])

/** 기본 길이표 (ms). 실제 길이는 운율 단계에서 말 속도에 맞춰 늘이고 줄인다 */
const DUR = {
  vowel: 110,
  vowelAfterGlide: 95,
  glide: 45,
  nasalOnset: 55,
  nasalCoda: 70,
  flap: 25,
  lateralCoda: 70,
  lateralOnset: 45,
  codaStop: 60,
  h: 60,
  hVoiced: 40,
  pause: { comma: 220, period: 420, question: 420, exclaim: 420, breath: 260 },
}

function stopPhases(lar: Laryngeal, voiced: boolean, wordInitial: boolean): ObstruentPhases {
  if (lar === 'tense') return { closure: 90, burst: 8, fric: 0, asp: 10 }
  if (lar === 'asp') return { closure: 80, burst: 8, fric: 0, asp: 75 }
  if (voiced) return { closure: 35, burst: 5, fric: 0, asp: 0 }
  return { closure: wordInitial ? 30 : 45, burst: 8, fric: 0, asp: 45 }
}

function affricatePhases(lar: Laryngeal, voiced: boolean): ObstruentPhases {
  if (lar === 'tense') return { closure: 80, burst: 5, fric: 45, asp: 0 }
  if (lar === 'asp') return { closure: 70, burst: 5, fric: 50, asp: 55 }
  if (voiced) return { closure: 30, burst: 4, fric: 25, asp: 0 }
  return { closure: 40, burst: 5, fric: 40, asp: 25 }
}

function fricativePhases(lar: Laryngeal): ObstruentPhases {
  return lar === 'tense' ? { closure: 0, burst: 0, fric: 110, asp: 0 } : { closure: 0, burst: 0, fric: 75, asp: 20 }
}

const sumPhases = (p: ObstruentPhases) => p.closure + p.burst + p.fric + p.asp

export function toSegments(tokens: Token[]): Segment[] {
  const segs: Segment[] = []
  let syl = -1
  let word = -1
  const prevVoiced = () => {
    const p = segs[segs.length - 1]
    return !!p && p.word === word && VOICED_KINDS.includes(p.kind)
  }

  for (const t of tokens) {
    if (t.type === 'punct') {
      const pause = t.ch === ',' ? 'comma' : t.ch === '?' ? 'question' : t.ch === '!' ? 'exclaim' : 'period'
      const last = segs[segs.length - 1]
      if (last?.kind === 'pause') last.pause = pause
      else if (last) segs.push({ kind: 'pause', ipa: '‖', jamo: t.ch, dur: DUR.pause[pause], syl, word, pause })
      continue
    }
    word++
    t.syllables.forEach((s: Syllable, si: number) => {
      syl++
      const [glide, vowel] = NUCLEUS[s.nucleus]
      const nextFront = FRONT_HIGH.has(glide || vowel)

      // 초성
      if (s.onset) {
        const c = CONS[s.onset]
        const voiced = c.lar === 'lax' && prevVoiced()
        const base: Segment = { kind: c.kind, ipa: c.ipa, jamo: s.onset, dur: 0, syl, word, place: c.place, lar: c.lar, position: 'onset' }
        if (c.kind === 'stop') {
          base.voiced = voiced
          base.phases = stopPhases(c.lar!, voiced, si === 0)
          if (voiced) base.ipa = { vel: 'g', alv: 'd', lab: 'b' }[c.place as 'vel' | 'alv' | 'lab']
        } else if (c.kind === 'affricate') {
          base.voiced = voiced
          base.phases = affricatePhases(c.lar!, voiced)
          if (voiced) base.ipa = 'dʑ'
        } else if (c.kind === 'fricative') {
          base.phases = fricativePhases(c.lar!)
          if (nextFront) {
            base.place = 'pal'
            base.ipa = c.lar === 'tense' ? 'ɕ͈' : 'ɕ'
          }
        } else if (c.kind === 'h') {
          base.voiced = prevVoiced()
          base.ipa = base.voiced ? 'ɦ' : 'h'
          base.dur = base.voiced ? DUR.hVoiced : DUR.h
        } else if (c.kind === 'nasal') {
          base.dur = DUR.nasalOnset
        } else if (c.kind === 'liquid') {
          const afterLateral = segs[segs.length - 1]?.kind === 'liquid'
          base.flap = !afterLateral
          base.ipa = base.flap ? 'ɾ' : 'l'
          base.dur = base.flap ? DUR.flap : DUR.lateralOnset
        }
        if (base.phases) base.dur = sumPhases(base.phases)
        segs.push(base)
      }

      // 중성
      if (glide) {
        segs.push({ kind: 'glide', ipa: glide === 'w' && vowel === 'i' ? 'ɥ' : glide, jamo: s.nucleus, dur: DUR.glide, syl, word })
      }
      segs.push({ kind: 'vowel', ipa: vowel, jamo: VOWEL_JAMO[vowel], vowel, dur: glide ? DUR.vowelAfterGlide : DUR.vowel, syl, word })

      // 종성 (발음 규칙 적용 후이므로 ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ 중 하나)
      if (s.coda) {
        const c = CONS[s.coda]
        if (c.kind === 'stop') {
          segs.push({ kind: 'stop', ipa: c.ipa + '̚', jamo: s.coda, dur: DUR.codaStop, syl, word, place: c.place, lar: 'lax', position: 'coda', phases: { closure: DUR.codaStop, burst: 0, fric: 0, asp: 0 } })
        } else if (c.kind === 'nasal') {
          segs.push({ kind: 'nasal', ipa: c.ipa, jamo: s.coda, dur: DUR.nasalCoda, syl, word, place: c.place, position: 'coda' })
        } else if (c.kind === 'liquid') {
          segs.push({ kind: 'liquid', ipa: 'l', jamo: s.coda, dur: DUR.lateralCoda, syl, word, place: 'alv', position: 'coda' })
        }
      }
    })
  }
  if (segs.length && segs[segs.length - 1].kind !== 'pause') {
    segs.push({ kind: 'pause', ipa: '‖', jamo: '', dur: DUR.pause.period, syl, word, pause: 'period' })
  }
  return segs
}

export { DUR as BASE_DURATIONS }
