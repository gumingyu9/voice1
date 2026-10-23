// 음원–필터 합성기 본체. 실시간(AudioWorklet)과 오프라인 렌더링(단어 재생, 테스트)에서 함께 쓴다.
//
//   [LF 성대 펄스 × 흔들림/떨림/프라이] + [성문 잡음] → 기울기 필터 → 비강 영점·극점 → F6..F1 공명기 → 이득
//
// 파라미터는 setTarget() 으로 목표값만 주고, 32샘플마다 지수 스무딩해 계수를 갱신한다(지퍼 잡음 방지).

import { cloneFrame, N_FORMANTS, type FrameParams } from './frame.ts'
import { LfTableCache, lfTiming, TABLE_SIZE } from './glottal.ts'
import { AntiResonator, Resonator } from './resonator.ts'

const BLOCK = 32

/** 결정적 난수 (재현 가능한 렌더링을 위해) */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Synth {
  readonly fs: number
  private cur: FrameParams | null = null
  private target: FrameParams | null = null
  private smoothK: number

  private tables = new LfTableCache()
  private table: Float32Array
  private rand: () => number

  // 음원 상태
  private phase = 0 // 0..1 주기 내 위치
  private inc = 0 // 샘플당 위상 증가
  private periodAmp = 1
  private periodIndex = 0
  private tremorPhase = 0
  // 청취 편의용 느린 음높이 흔들림 (cent). 사람 목소리는 완전히 일정하지 않다
  private driftCents = 0
  private drift = 0
  private driftRaw = 0
  private te = 0.6
  private tiltY = 0
  private noiseHp = 0
  private noisePrev = 0

  private nasalZero = new AntiResonator()
  private nasalPole = new Resonator()
  private formants: Resonator[] = Array.from({ length: N_FORMANTS }, () => new Resonator())
  private blockPos = BLOCK

  constructor(fs: number, smoothingSec = 0.02, seed = 1) {
    this.fs = fs
    this.smoothK = 1 - Math.exp(-BLOCK / (smoothingSec * fs))
    this.rand = mulberry32(seed)
    this.table = this.tables.get(1)
  }

  setSmoothing(sec: number): void {
    this.smoothK = sec <= 0 ? 1 : 1 - Math.exp(-BLOCK / (sec * this.fs))
  }

  /** 느린 무작위 음높이 흔들림의 최대 폭 (cent). 0 이면 끔 */
  setDrift(cents: number): void {
    this.driftCents = cents
  }

  setTarget(frame: FrameParams): void {
    this.target = cloneFrame(frame)
    if (!this.cur) {
      this.cur = cloneFrame(frame)
      this.updateCoefficients()
      this.startPeriod()
    }
  }

  /** 근사 정규분포 (평균 0, 표준편차 1) */
  private gauss(): number {
    return (this.rand() + this.rand() + this.rand() + this.rand() - 2) * Math.sqrt(3)
  }

  private updateCoefficients(): void {
    const f = this.cur!
    for (let i = 0; i < N_FORMANTS; i++) this.formants[i].set(f.formants[i], f.bandwidths[i], this.fs)
    this.nasalPole.set(f.fnp, f.bnp, this.fs)
    this.nasalZero.set(f.fnz, f.bnz, this.fs)
  }

  private smooth(): void {
    const c = this.cur!
    const t = this.target!
    const k = this.smoothK
    const s = (a: number, b: number) => a + (b - a) * k
    c.f0 = s(c.f0, t.f0)
    c.av = s(c.av, t.av)
    c.ah = s(c.ah, t.ah)
    c.rd = s(c.rd, t.rd)
    c.tilt = s(c.tilt, t.tilt)
    c.jitter = s(c.jitter, t.jitter)
    c.shimmer = s(c.shimmer, t.shimmer)
    c.creak = s(c.creak, t.creak)
    c.tremorRate = s(c.tremorRate, t.tremorRate)
    c.tremorDepth = s(c.tremorDepth, t.tremorDepth)
    for (let i = 0; i < N_FORMANTS; i++) {
      c.formants[i] = s(c.formants[i], t.formants[i])
      c.bandwidths[i] = s(c.bandwidths[i], t.bandwidths[i])
    }
    c.fnp = s(c.fnp, t.fnp)
    c.bnp = s(c.bnp, t.bnp)
    c.fnz = s(c.fnz, t.fnz)
    c.bnz = s(c.bnz, t.bnz)
    c.gain = s(c.gain, t.gain)
    this.updateCoefficients()
  }

  /** 새 성대 주기 시작: 이번 주기의 길이·세기·펄스 모양을 정한다 */
  private startPeriod(): void {
    const f = this.cur!
    const odd = this.periodIndex++ % 2 === 1
    const c = f.creak

    // 떨림(비브라토/트레몰로): 주기 시작 시점의 위상으로 음높이를 정한다
    const vib = Math.pow(2, (f.tremorDepth / 1200) * Math.sin(2 * Math.PI * this.tremorPhase))
    // 보컬 프라이: 음높이를 ~45Hz 쪽으로 끌어내리고, 주기를 번갈아 길고 짧게(이중 주기)
    // 느린 무작위 흔들림: 평균으로 되돌아가는 랜덤 워크(τ 0.5초)를 한 번 더 부드럽게(τ 0.3초) 거른다
    if (this.driftCents > 0) {
      const dt = 1 / f.f0
      this.driftRaw += -this.driftRaw * (dt / 0.5) + 0.7 * Math.sqrt((2 * dt) / 0.5) * this.gauss()
      this.drift += (this.driftRaw - this.drift) * (dt / 0.3)
    } else this.drift = this.driftRaw = 0
    const drift = Math.pow(2, (this.driftCents * this.drift) / 1200)
    let freq = (f.f0 * (1 - c) + 45 * c) * vib * drift
    freq *= 1 + 0.15 * c * (odd ? -1 : 1)
    // local jitter = 인접 주기 차이 평균 ≈ 1.128σ
    const jit = f.jitter + 0.06 * c
    freq *= 1 + (jit / 1.128) * this.gauss()
    freq = Math.min(1200, Math.max(20, freq))
    this.inc = freq / this.fs

    let amp = 1 + (f.shimmer / 1.128) * this.gauss()
    if (c > 0 && odd) amp *= 1 - 0.7 * c
    this.periodAmp = Math.max(0.05, amp)

    // 프라이일수록 성대가 더 꽉 닫힌다
    const rd = f.rd * (1 - 0.5 * c)
    this.table = this.tables.get(rd)
    this.te = lfTiming(rd).te // 기식음 변조용 열림 구간
  }

  /** out 을 채운다 (기존 내용은 덮어씀). setTarget 이 한 번도 호출되지 않았으면 무음 */
  process(out: Float32Array, offset = 0, length = out.length - offset): void {
    if (!this.cur) {
      out.fill(0, offset, offset + length)
      return
    }
    const fs = this.fs
    for (let n = offset; n < offset + length; n++) {
      if (this.blockPos >= BLOCK) {
        this.blockPos = 0
        this.smooth()
      }
      this.blockPos++
      const f = this.cur

      // ── 음원 ──
      const pos = this.phase * TABLE_SIZE
      const i0 = pos | 0
      const frac = pos - i0
      const t = this.table
      const voiced = (t[i0] + (t[(i0 + 1) % TABLE_SIZE] - t[i0]) * frac) * this.periodAmp * f.av

      // 성문 잡음: 성대가 열린 구간에서 더 크게 (Klatt 방식 50% 변조)
      const white = this.rand() * 2 - 1
      this.noiseHp = 0.95 * (this.noiseHp + white - this.noisePrev) // ~400Hz 고역통과
      this.noisePrev = white
      const noise = this.noiseHp * f.ah * (this.phase < this.te ? 1 : 0.5)

      // 스펙트럼 기울기 (부드러운 발성일수록 고역 감쇠)
      const src = voiced + noise
      this.tiltY = src * (1 - f.tilt) + this.tiltY * f.tilt

      // ── 필터 (성도) ──
      let y = this.nasalPole.process(this.nasalZero.process(this.tiltY))
      for (let k = N_FORMANTS - 1; k >= 0; k--) y = this.formants[k].process(y)

      out[n] = Math.tanh(y * f.gain)

      // ── 시간 진행 ──
      this.tremorPhase += f.tremorRate / fs
      if (this.tremorPhase >= 1) this.tremorPhase -= 1
      this.phase += this.inc
      if (this.phase >= 1) {
        this.phase -= 1
        this.startPeriod()
      }
    }
  }
}
