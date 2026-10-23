import { useEffect, useRef, useState } from 'react'
import { MAGMA_LUT } from './util.ts'

interface Props {
  analyser: AnalyserNode | null
  active: boolean
  /** 세로축 상한 (Hz). 기본 5000 */
  maxHz?: number
}

const DB_MIN = -100
const DB_MAX = -20
const WAVE_H = 44
const SPEC_H = 190
/** 한 프레임에 왼쪽으로 밀리는 CSS 픽셀 수 (60fps 기준 약 90px/s) */
const SCROLL_CSS_PX = 1.5

const LUT = MAGMA_LUT
const BG: [number, number, number] = [LUT[0], LUT[1], LUT[2]]

function fillBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = `rgb(${BG[0]} ${BG[1]} ${BG[2]})`
  ctx.fillRect(0, 0, w, h)
}

export function LiveSpectrogram({ analyser, active, maxHz = 5000 }: Props) {
  const specRef = useRef<HTMLCanvasElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef(false)
  const [drawn, setDrawn] = useState(false)

  // 크기 맞춤 (HiDPI). 크기가 바뀌어도 기존 이미지는 늘려서 유지한다.
  useEffect(() => {
    const spec = specRef.current
    const wave = waveRef.current
    if (!spec || !wave) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(1, Math.round(spec.clientWidth * dpr))
      const hs = Math.max(1, Math.round(spec.clientHeight * dpr))
      const hw = Math.max(1, Math.round(wave.clientHeight * dpr))
      if (spec.width !== w || spec.height !== hs) {
        const old = document.createElement('canvas')
        old.width = spec.width
        old.height = spec.height
        old.getContext('2d')?.drawImage(spec, 0, 0)
        spec.width = w
        spec.height = hs
        const ctx = spec.getContext('2d')
        if (ctx) {
          fillBg(ctx, w, hs)
          if (old.width > 0 && old.height > 0) ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, w, hs)
        }
      }
      if (wave.width !== w || wave.height !== hw) {
        wave.width = w
        wave.height = hw
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(spec)
    return () => ro.disconnect()
  }, [])

  // 그리기 루프: 재생 중일 때만 돈다
  useEffect(() => {
    if (!active || !analyser) return
    const spec = specRef.current
    const wave = waveRef.current
    if (!spec || !wave) return
    const sctx = spec.getContext('2d')
    const wctx = wave.getContext('2d')
    if (!sctx || !wctx) return

    const freqData = new Float32Array(analyser.frequencyBinCount)
    const timeData = new Float32Array(analyser.fftSize)
    const nyquist = analyser.context.sampleRate / 2
    let raf = 0

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const w = spec.width
      const h = spec.height
      if (w < 2 || h < 2) return
      const dpr = window.devicePixelRatio || 1
      const step = Math.max(1, Math.round(SCROLL_CSS_PX * dpr))

      analyser.getFloatFrequencyData(freqData)
      analyser.getFloatTimeDomainData(timeData)

      // 스펙트로그램: 왼쪽으로 밀고 새 열을 오른쪽 끝에 그린다
      sctx.drawImage(spec, -step, 0)
      const img = sctx.createImageData(step, h)
      const top = Math.min(freqData.length - 1, (maxHz / nyquist) * freqData.length)
      for (let y = 0; y < h; y++) {
        const pos = (1 - (y + 0.5) / h) * top // 아래쪽이 0Hz
        const i0 = Math.floor(pos)
        const i1 = Math.min(freqData.length - 1, i0 + 1)
        const k = pos - i0
        const db = freqData[i0] * (1 - k) + freqData[i1] * k
        const t = Number.isFinite(db) ? Math.min(1, Math.max(0, (db - DB_MIN) / (DB_MAX - DB_MIN))) : 0
        const li = Math.round(t * 255) * 3
        for (let s = 0; s < step; s++) {
          const o = (y * step + s) * 4
          img.data[o] = LUT[li]
          img.data[o + 1] = LUT[li + 1]
          img.data[o + 2] = LUT[li + 2]
          img.data[o + 3] = 255
        }
      }
      sctx.putImageData(img, w - step, 0)

      // 파형 띠
      const ww = wave.width
      const wh = wave.height
      const cs = getComputedStyle(wave)
      wctx.clearRect(0, 0, ww, wh)
      wctx.strokeStyle = cs.getPropertyValue('--viz-wave').trim() || '#3b82c4'
      wctx.lineWidth = Math.max(1, dpr)
      wctx.beginPath()
      const n = timeData.length
      for (let px = 0; px < ww; px++) {
        const i = Math.floor((px / ww) * n)
        const v = Math.max(-1, Math.min(1, timeData[i] * 2.5))
        const yy = wh / 2 - (v * wh) / 2 * 0.92
        if (px === 0) wctx.moveTo(px, yy)
        else wctx.lineTo(px, yy)
      }
      wctx.stroke()

      if (!drawnRef.current) {
        drawnRef.current = true
        setDrawn(true)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [analyser, active, maxHz])

  const ticks: number[] = []
  const tickStep = maxHz <= 2500 ? 500 : 1000
  for (let f = 0; f <= maxHz + 1; f += tickStep) ticks.push(f)

  return (
    <figure className="viz-fig viz-spectro">
      <div className="viz-spectro-grid">
        <div className="viz-spectro-side" style={{ height: WAVE_H }}>
          <span className="viz-tick viz-spectro-wavelabel">파형</span>
        </div>
        <canvas ref={waveRef} className="viz-spectro-wave" style={{ height: WAVE_H }} aria-label="실시간 파형" />
        <div className="viz-spectro-side viz-spectro-ticks" style={{ height: SPEC_H }}>
          {ticks.map((f) => {
            const p = (1 - f / maxHz) * 100
            const tr = f === 0 ? 'translateY(-100%)' : f >= maxHz ? 'translateY(0)' : 'translateY(-50%)'
            return (
              <span key={f} className="viz-tick viz-spectro-tick" style={{ top: `${p}%`, transform: tr }}>
                {f / 1000}
              </span>
            )
          })}
          <span className="viz-tick viz-spectro-unit">kHz</span>
        </div>
        <div className="viz-spectro-wrap" style={{ height: SPEC_H }}>
          <canvas ref={specRef} className="viz-spectro-canvas" aria-label="실시간 스펙트로그램" />
          {!drawn && <div className="viz-spectro-hint">재생하면 실시간 스펙트로그램이 표시됩니다</div>}
        </div>
      </div>
    </figure>
  )
}
