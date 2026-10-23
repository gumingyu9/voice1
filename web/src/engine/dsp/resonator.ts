// Klatt(1980) 2차 디지털 공명기 / 반공명기. 직류 이득 1 로 정규화되어 있어
// 직렬(cascade)로 연결하면 포먼트 진폭이 자연스럽게 결정된다.

export class Resonator {
  private a = 1
  private b = 0
  private c = 0
  private y1 = 0
  private y2 = 0
  bypass = false

  set(freq: number, bw: number, fs: number): void {
    // 나이퀴스트 근처 공명은 불안정하므로 건너뛴다
    this.bypass = freq <= 0 || freq >= fs * 0.45
    if (this.bypass) return
    const t = 1 / fs
    this.c = -Math.exp(-2 * Math.PI * bw * t)
    this.b = 2 * Math.exp(-Math.PI * bw * t) * Math.cos(2 * Math.PI * freq * t)
    this.a = 1 - this.b - this.c
  }

  process(x: number): number {
    if (this.bypass) return x
    const y = this.a * x + this.b * this.y1 + this.c * this.y2
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

export class AntiResonator {
  private a = 1
  private b = 0
  private c = 0
  private x1 = 0
  private x2 = 0
  bypass = false

  set(freq: number, bw: number, fs: number): void {
    this.bypass = freq <= 0 || freq >= fs * 0.45
    if (this.bypass) return
    const t = 1 / fs
    const c = -Math.exp(-2 * Math.PI * bw * t)
    const b = 2 * Math.exp(-Math.PI * bw * t) * Math.cos(2 * Math.PI * freq * t)
    const a = 1 - b - c
    this.a = 1 / a
    this.b = -b / a
    this.c = -c / a
  }

  process(x: number): number {
    if (this.bypass) return x
    const y = this.a * x + this.b * this.x1 + this.c * this.x2
    this.x2 = this.x1
    this.x1 = x
    return y
  }
}

/** 공명기 주파수 응답 크기 (시각화용, 선형) */
export function resonatorMagnitude(freq: number, bw: number, f: number, fs: number): number {
  const t = 1 / fs
  const c = -Math.exp(-2 * Math.PI * bw * t)
  const b = 2 * Math.exp(-Math.PI * bw * t) * Math.cos(2 * Math.PI * freq * t)
  const a = 1 - b - c
  // H(z) = a / (1 − b z^-1 − c z^-2), z = e^{jω}
  const w = 2 * Math.PI * f * t
  const re = 1 - b * Math.cos(w) - c * Math.cos(2 * w)
  const im = b * Math.sin(w) + c * Math.sin(2 * w)
  return Math.abs(a) / Math.hypot(re, im)
}
