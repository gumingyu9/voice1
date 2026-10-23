// 실시간 지속 모음용 AudioWorklet. 메인 스레드가 보낸 프레임을 목표값으로 삼아 계속 소리를 낸다.

import type { FrameParams } from '../dsp/frame.ts'
import { Synth } from '../dsp/synth.ts'

export type WorkletMessage = { type: 'frame'; frame: FrameParams } | { type: 'gate'; on: boolean }

// AudioWorkletGlobalScope 전역 (DOM lib 에 타입이 없어 최소한만 선언)
declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

const FADE_SEC = 0.03

class VoiceProcessor extends AudioWorkletProcessor {
  private synth = new Synth(sampleRate, 0.025, (Math.random() * 2 ** 31) | 0)
  private gate = 0 // 0..1 현재 페이드 값
  private gateTarget = 0
  private gateStep = 1 / (FADE_SEC * sampleRate)

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<WorkletMessage>) => {
      const m = e.data
      if (m.type === 'frame') this.synth.setTarget(m.frame)
      else this.gateTarget = m.on ? 1 : 0
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0][0]
    if (this.gate === 0 && this.gateTarget === 0) {
      out.fill(0)
    } else {
      this.synth.process(out)
      for (let i = 0; i < out.length; i++) {
        if (this.gate < this.gateTarget) this.gate = Math.min(this.gateTarget, this.gate + this.gateStep)
        else if (this.gate > this.gateTarget) this.gate = Math.max(this.gateTarget, this.gate - this.gateStep)
        out[i] *= this.gate
      }
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out)
    return true
  }
}

registerProcessor('voice-processor', VoiceProcessor)
