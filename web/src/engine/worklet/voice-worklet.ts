// 실시간 지속 모음용 AudioWorklet. 메인 스레드가 보낸 프레임을 목표값으로 삼아 계속 소리를 낸다.

import type { FrameParams } from '../dsp/frame.ts'
import { Synth } from '../dsp/synth.ts'

export interface ComfortOptions {
  /** 끊어 듣기: onSec 동안 소리 내고 offSec 동안 쉼을 반복 */
  pulse: boolean
  /** 부드러운 소리: 고역을 살짝 줄이고 음높이를 미세하게 흔든다 */
  soft: boolean
}

export const PULSE_ON_SEC = 1.5
export const PULSE_OFF_SEC = 1.0

export type WorkletMessage =
  | { type: 'frame'; frame: FrameParams }
  | { type: 'gate'; on: boolean }
  | { type: 'comfort'; options: ComfortOptions }

// AudioWorkletGlobalScope 전역 (DOM lib 에 타입이 없어 최소한만 선언)
declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

const FADE_SEC = 0.03
const PULSE_FADE_SEC = 0.08

class VoiceProcessor extends AudioWorkletProcessor {
  private synth = new Synth(sampleRate, 0.025, (Math.random() * 2 ** 31) | 0)
  private gate = 0 // 0..1 현재 페이드 값
  private gateTarget = 0
  private gateStep = 1 / (FADE_SEC * sampleRate)
  private pulse = false
  private pulseClock = 0 // 끊어 듣기 주기 안에서의 위치 (샘플)
  private soft = false
  private lpY = 0
  // 부드러운 소리용 1차 저역통과 (~3.5kHz, −6dB/oct)
  private lpA = Math.exp((-2 * Math.PI * 3500) / sampleRate)

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<WorkletMessage>) => {
      const m = e.data
      if (m.type === 'frame') this.synth.setTarget(m.frame)
      else if (m.type === 'gate') {
        this.gateTarget = m.on ? 1 : 0
        this.pulseClock = 0
      } else {
        this.pulse = m.options.pulse
        this.soft = m.options.soft
        this.synth.setDrift(m.options.soft ? 12 : 0)
        this.gateStep = 1 / ((this.pulse ? PULSE_FADE_SEC : FADE_SEC) * sampleRate)
      }
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0][0]
    if (this.gate === 0 && this.gateTarget === 0) {
      out.fill(0)
    } else {
      this.synth.process(out)
      const onLen = PULSE_ON_SEC * sampleRate
      const cycle = onLen + PULSE_OFF_SEC * sampleRate
      for (let i = 0; i < out.length; i++) {
        let target = this.gateTarget
        if (this.pulse && target > 0) {
          if (this.pulseClock >= onLen) target = 0
          this.pulseClock = (this.pulseClock + 1) % cycle
        }
        if (this.gate < target) this.gate = Math.min(target, this.gate + this.gateStep)
        else if (this.gate > target) this.gate = Math.max(target, this.gate - this.gateStep)
        if (this.soft) {
          this.lpY = out[i] * (1 - this.lpA) + this.lpY * this.lpA
          out[i] = this.lpY * 1.3
        }
        out[i] *= this.gate
      }
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out)
    return true
  }
}

registerProcessor('voice-processor', VoiceProcessor)
