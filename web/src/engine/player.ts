// 메인 스레드 쪽 오디오 제어. AudioContext 는 브라우저 정책상 사용자 클릭 이후에 만든다.

import type { FrameParams } from './dsp/frame.ts'
import type { ComfortOptions, WorkletMessage } from './worklet/voice-worklet.ts'
import workletUrl from './worklet/voice-worklet.ts?worker&url'

export class VoicePlayer {
  private ctx: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private loading: Promise<void> | null = null
  private stopTimer: number | undefined
  private master: GainNode | null = null
  private volume = 0.4
  private comfort: ComfortOptions = { pulse: false, soft: true }
  /** 지속 모음 자동 정지까지의 시간(ms). 0 이면 끔 */
  autoStopMs = 8000
  analyser: AnalyserNode | null = null
  playing = false
  onPlayingChange: ((playing: boolean) => void) | null = null

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000
  }

  private async ensure(): Promise<void> {
    if (this.node) return
    this.loading ??= (async () => {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      await ctx.audioWorklet.addModule(workletUrl)
      const node = new AudioWorkletNode(ctx, 'voice-processor', { outputChannelCount: [1] })
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0.6
      // 음량은 분석기 뒤에서 조절 → 스펙트로그램은 음량과 무관하게 보인다
      const master = ctx.createGain()
      master.gain.value = volumeToGain(this.volume)
      node.connect(analyser)
      analyser.connect(master)
      master.connect(ctx.destination)
      this.ctx = ctx
      this.node = node
      this.analyser = analyser
      this.master = master
      this.post({ type: 'comfort', options: this.comfort })
    })()
    await this.loading
  }

  private post(m: WorkletMessage): void {
    this.node?.port.postMessage(m)
  }

  /** 0..1 */
  setVolume(v: number): void {
    this.volume = v
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volumeToGain(v), this.ctx.currentTime, 0.03)
  }

  setComfort(options: ComfortOptions): void {
    this.comfort = options
    this.post({ type: 'comfort', options })
  }

  /** 소리 상태와 무관하게 목표 프레임만 갱신 (재생 중이면 즉시 들린다) */
  update(frame: FrameParams): void {
    this.post({ type: 'frame', frame })
  }

  async start(frame: FrameParams): Promise<void> {
    await this.ensure()
    await this.ctx!.resume()
    window.clearTimeout(this.stopTimer)
    this.update(frame)
    this.post({ type: 'gate', on: true })
    this.setPlaying(true)
    if (this.autoStopMs > 0) this.stopTimer = window.setTimeout(() => this.stop(), this.autoStopMs)
  }

  stop(): void {
    window.clearTimeout(this.stopTimer)
    this.post({ type: 'gate', on: false })
    this.setPlaying(false)
  }

  /** "비교 듣기": 잠깐만 재생 */
  async playFor(frame: FrameParams, ms: number): Promise<void> {
    if (this.playing) {
      this.update(frame)
      return
    }
    await this.start(frame)
    window.clearTimeout(this.stopTimer)
    this.stopTimer = window.setTimeout(() => this.stop(), ms)
  }

  private setPlaying(p: boolean): void {
    if (this.playing === p) return
    this.playing = p
    this.onPlayingChange?.(p)
  }
}

/** 지각 음량에 가깝도록 제곱 곡선 */
function volumeToGain(v: number): number {
  return v * v
}

export const player = new VoicePlayer()
