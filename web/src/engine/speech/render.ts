// 텍스트 → 음성 렌더링 (엔진 A).
//   정규화 → 발음 규칙(G2P) → 음성 세그먼트 → 운율 계획 → 5ms 프레임 궤적 → 음원–필터 합성
// 모든 단계의 중간 결과를 함께 돌려줘 화면에서 과정을 보여줄 수 있게 한다.

import type { ParamValues } from '../../params/schema.ts'
import { cloneFrame, type FrameParams } from '../dsp/frame.ts'
import { Synth } from '../dsp/synth.ts'
import { g2p, type G2PResult } from '../ko/g2p.ts'
import { normalizeKorean } from '../ko/normalize.ts'
import { toSegments, type Place, type VowelKey } from '../ko/phonetics.ts'
import { frameFor, transformFormants, VOWEL_FORMANTS } from '../mapping.ts'
import { planSpeech, type SpeechPlan, type TimedSegment } from './plan.ts'

export const FRAME_MS = 5

export interface SpeechRender {
  normalized: string
  g2p: G2PResult
  plan: SpeechPlan
  frames: FrameParams[] // FRAME_MS 간격
  voicing: number[] // 프레임별 유성 정도 0..1 (음높이 곡선 표시용)
  audio: Float32Array
  sampleRate: number
}

type F3 = [number, number, number]

const VOWEL_BASE: Record<VowelKey, F3> = {
  a: VOWEL_FORMANTS['ㅏ'], e: VOWEL_FORMANTS['ㅔ'], ʌ: VOWEL_FORMANTS['ㅓ'], o: VOWEL_FORMANTS['ㅗ'],
  u: VOWEL_FORMANTS['ㅜ'], ɯ: VOWEL_FORMANTS['ㅡ'], i: VOWEL_FORMANTS['ㅣ'],
}
const GLIDE_BASE: Record<string, F3> = { j: [280, 2250, 2950], w: [300, 700, 2300], ɥ: [280, 1800, 2300], ɰ: [360, 1450, 2450] }

/**
 * 자음 위치에서의 포먼트 목표(locus): 막히는 자리에 따라 인접 모음의 F2·F3 가 끌려가는 곳.
 * 입술 → F2·F3 내려감, 혀끝(치조) → F2 ~1.8kHz 로, 혀몸(연구개) → F2·F3 가 가까워짐("연구개 핀치").
 */
function locus(place: Place, vf: F3, kind: string): F3 {
  const f1 = kind === 'liquid' ? 360 : kind === 'nasal' ? 260 : 250
  switch (place) {
    case 'lab': return [f1, 0.7 * vf[1] + 150, 0.92 * vf[2]]
    case 'alv': return kind === 'liquid' ? [f1, 0.4 * vf[1] + 750, 2700] : [f1, 0.4 * vf[1] + 1050, 2650]
    case 'pal': return [f1, 0.25 * vf[1] + 1650, 2900]
    case 'vel': { const f2 = 0.8 * vf[1] + 300; return [f1, f2, Math.max(f2 + 400, 0.95 * vf[2])] }
    default: return vf
  }
}

/** 비음의 반공명(영점) 위치: 입 안 막힌 공간이 길수록(입술) 낮다 */
const NASAL_ZERO: Record<string, number> = { lab: 1000, alv: 1600, vel: 2600, pal: 2000, glot: 1600 }
/** 마찰·파열 잡음의 중심 주파수 (성인 남성 기준) */
const BURST_F: Record<string, number> = { lab: 1200, alv: 4200, pal: 3200, vel: 2000, glot: 1500 }

// 잡음 크기 보정값 (scripts/check-speech 로 측정해 맞춤)
const AMP = { fric: 0.05, fricTense: 0.07, affric: 0.045, burst: 0.25, aspStrong: 0.6, aspLax: 0.4, aspTense: 0.12, h: 0.3 }

interface Keypoint {
  t: number
  f: F3
}

function neighborVowel(segs: TimedSegment[], i: number, dir: 1 | -1): F3 {
  for (let j = i + dir; j >= 0 && j < segs.length; j += dir) {
    const s = segs[j]
    if (s.kind === 'pause') break
    if (s.kind === 'vowel') return VOWEL_BASE[s.vowel!]
  }
  return VOWEL_BASE['ʌ']
}

function formantKeypoints(segs: TimedSegment[]): Keypoint[] {
  const kps: Keypoint[] = []
  segs.forEach((s, i) => {
    const d = s.end - s.start
    if (s.kind === 'vowel') {
      const f = VOWEL_BASE[s.vowel!]
      if (d < 40) kps.push({ t: s.start + d / 2, f })
      else kps.push({ t: s.start + 0.25 * d, f }, { t: s.end - 0.25 * d, f })
    } else if (s.kind === 'glide') {
      kps.push({ t: s.start + 0.3 * d, f: GLIDE_BASE[s.ipa] ?? GLIDE_BASE.j })
    } else if (s.kind === 'h') {
      kps.push({ t: s.start, f: neighborVowel(segs, i, 1) })
    } else if (s.kind !== 'pause') {
      const v = neighborVowel(segs, i, s.position === 'coda' ? -1 : 1)
      const f = locus(s.place ?? 'alv', v, s.kind)
      kps.push({ t: s.start, f }, { t: s.end, f })
    }
  })
  return kps.sort((a, b) => a.t - b.t)
}

function interpKeypoints(kps: Keypoint[], t: number, cursor: { i: number }): F3 {
  while (cursor.i < kps.length - 2 && kps[cursor.i + 1].t < t) cursor.i++
  const a = kps[cursor.i]
  const b = kps[Math.min(kps.length - 1, cursor.i + 1)]
  if (t <= a.t || a === b) return a.f
  if (t >= b.t) return b.f
  const k = (t - a.t) / (b.t - a.t)
  return [0, 1, 2].map((n) => a.f[n] + (b.f[n] - a.f[n]) * k) as F3
}

function pitchAt(plan: SpeechPlan, t: number): number {
  const p = plan.pitch
  if (!p.length) return 0
  if (t <= p[0].t) return p[0].st
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i].t) {
      const k = (t - p[i - 1].t) / (p[i].t - p[i - 1].t)
      return p[i - 1].st + (p[i].st - p[i - 1].st) * k
    }
  }
  return p[p.length - 1].st
}

/** 프레임 궤적 생성 */
export function buildFrames(plan: SpeechPlan, v: ParamValues): { frames: FrameParams[]; voicing: number[] } {
  const voice = frameFor(v, 'ㅏ')
  const segs = plan.segments
  const kps = formantKeypoints(segs)
  const n = Math.ceil((plan.duration + 60) / FRAME_MS)
  const frames: FrameParams[] = []
  const voicing: number[] = []
  const cursor = { i: 0 }
  let si = 0
  const hypo = Math.max(0, -v.nasality) // 코 막힘 정도
  const force = v.consonantForce / 100
  const sib = v.sibilance * 1000 * (17 / Math.max(6, v.vtl)) ** 0.5

  // 음높이 곡선을 45ms 이동평균으로 부드럽게
  const rawSt = Array.from({ length: n }, (_, k) => pitchAt(plan, k * FRAME_MS + FRAME_MS / 2))
  const st = rawSt.map((_, k) => {
    let a = 0
    let c = 0
    for (let j = Math.max(0, k - 4); j <= Math.min(n - 1, k + 4); j++) {
      a += rawSt[j]
      c++
    }
    return a / c
  })

  for (let k = 0; k < n; k++) {
    const t = k * FRAME_MS + FRAME_MS / 2
    while (si < segs.length - 1 && segs[si].end <= t) si++
    const s = segs[si]
    const inside = t >= s.start && t < s.end
    const f = cloneFrame(voice)
    const tf = transformFormants(v, kps.length ? interpKeypoints(kps, t, cursor) : VOWEL_BASE['ʌ'])
    f.formants = tf.formants
    f.bandwidths = tf.bandwidths
    const scale = 17 / tf.effectiveVtl
    let semi = st[k]
    let rd = voice.rd
    f.af = 0
    f.ab = 0

    if (!inside || s.kind === 'pause') {
      f.av = 0
      f.ah = 0
    } else {
      const rel = t - s.start
      const p = s.phases
      switch (s.kind) {
        case 'vowel':
        case 'glide': {
          // 앞 자음의 후두 상태가 모음 시작부의 음높이·발성에 남는다 (미세 운율)
          const onset = segs.slice(Math.max(0, si - 2), si).reverse().find((x) => x.position === 'onset' && x.syl === s.syl)
          if (onset && s.kind === 'vowel' && rel < 60) {
            const w = 1 - rel / 60
            if (onset.lar === 'tense') { semi += 1.5 * w; rd -= 0.4 * w }
            else if (onset.lar === 'asp') { semi += 1.5 * w; rd += 0.3 * w }
            else if (onset.lar === 'lax' && !onset.voiced) { semi -= 0.7 * w; rd += 0.4 * w }
          }
          break
        }
        case 'stop':
        case 'affricate':
        case 'fricative': {
          f.av = 0
          f.ah = 0
          const end1 = p!.closure
          const end2 = end1 + p!.burst
          const end3 = end2 + p!.fric
          const place = s.place ?? 'alv'
          if (rel < end1) {
            if (s.voiced) {
              // 유성 폐쇄: 목에서만 웅웅 울리는 소리 (고역 거의 없음)
              f.av = 0.3 * voice.av
              f.tilt = 0.92
            }
          } else if (rel < end2) {
            f.ab = AMP.burst * force * (s.lar === 'lax' && s.voiced ? 0.5 : 1)
            f.af = AMP.affric * force
            f.fricF = (place === 'vel' ? tf.formants[1] * 1.1 : BURST_F[place] * scale)
            f.fricBw = place === 'vel' ? 700 : 2500
            if (s.voiced) f.av = 0.4 * voice.av
          } else if (rel < end3) {
            const tense = s.lar === 'tense'
            f.af = (s.kind === 'affricate' ? AMP.affric : tense ? AMP.fricTense : AMP.fric) * force
            f.fricF = s.kind === 'affricate' ? BURST_F.pal * scale : place === 'pal' ? sib * 0.65 : sib
            f.fricBw = s.kind === 'affricate' ? 1800 : 2500
            if (s.voiced) f.av = 0.4 * voice.av
          } else {
            f.ah = (s.lar === 'asp' ? AMP.aspStrong : s.lar === 'tense' ? AMP.aspTense : AMP.aspLax) * force
          }
          break
        }
        case 'h':
          f.ah = AMP.h * force
          f.av = s.voiced ? 0.3 * voice.av : 0
          break
        case 'nasal': {
          // 입은 막히고 코로만 소리가 나간다: 낮은 공명 + 입 안 공간의 반공명
          f.av = voice.av * (0.26 - 0.1 * hypo)
          f.formants[0] = 260 * scale
          f.bandwidths[0] = 80
          for (let b = 1; b < f.bandwidths.length; b++) f.bandwidths[b] *= 2.5 - 1.2 * hypo
          f.fnp = 270
          f.bnp = 100
          f.fnz = NASAL_ZERO[s.place ?? 'alv'] * scale * (1 - hypo) + 270 * hypo // 코가 막히면 비음 공명이 사라진다
          f.bnz = 150
          f.tilt = Math.max(f.tilt, 0.35 + 0.5 * hypo)
          break
        }
        case 'liquid':
          f.av = voice.av * (s.flap ? 0.55 : 0.8)
          for (let b = 0; b < f.bandwidths.length; b++) f.bandwidths[b] *= 1.3
          break
      }
    }

    // 문장 끝에서만 강해지는 보컬 프라이
    if (s && !plan.phraseFinal.has(s.syl)) f.creak = voice.creak * 0.25
    f.f0 = voice.f0 * Math.pow(2, semi / 12)
    f.rd = Math.min(2.7, Math.max(0.3, rd))
    frames.push(f)
    voicing.push(Math.min(1, f.av / Math.max(voice.av, 1e-3)))
  }
  return { frames, voicing }
}

export interface RenderOptions {
  sampleRate: number
  soft?: boolean
}

export function renderSpeech(text: string, v: ParamValues, opts: RenderOptions): SpeechRender {
  const normalized = normalizeKorean(text)
  const g = g2p(normalized)
  const plan = planSpeech(toSegments(g.tokens), v)
  const { frames, voicing } = buildFrames(plan, v)

  const fs = opts.sampleRate
  const hop = Math.round((fs * FRAME_MS) / 1000)
  const audio = new Float32Array(frames.length * hop)
  const synth = new Synth(fs, 0.003, 7)
  if (opts.soft) synth.setDrift(8)
  frames.forEach((f, k) => {
    synth.setTarget(f)
    synth.process(audio, k * hop, hop)
  })
  if (opts.soft) {
    const a = Math.exp((-2 * Math.PI * 3500) / fs)
    let y = 0
    for (let i = 0; i < audio.length; i++) audio[i] = (y = audio[i] * (1 - a) + y * a) * 1.3
  }
  return { normalized, g2p: g, plan, frames, voicing, audio, sampleRate: fs }
}
