import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PitchPoint } from '../engine/speech/plan'
import { FRAME_MS, type SpeechRender } from '../engine/speech/render'
import { stftImage } from './fft'
import { describeSegment, KIND_LABEL, KIND_ORDER, PARAM_FOR_KIND } from './segInfo'
import { MAGMA_LUT } from './util'

interface Props {
  speech: SpeechRender
  /** 소리 단위·음높이 띠를 눌렀을 때 관련 파라미터 선택 */
  onSelectParam?: (id: string) => void
  /** 파라미터 id → 화면에 보이는 이름 (안내 문구용) */
  paramLabel?: (id: string) => string | undefined
  /** 재생을 시작한 시각 (performance.now() ms). 재생 중이면 재생 위치선이 움직인다 */
  playStartedAt?: number | null
  playing?: boolean
}

const GUT = 44 // 왼쪽 축 눈금 폭 (px)
const MIN_PX_PER_MS = 0.22 // 이보다 좁아지면 가로로 스크롤
const MAX_HZ = 5000
const STRIP_H = 40
const F0_H = 88
const SPEC_H = 170
const AXIS_H = 18

const FORMANT_COLORS = ['#4fd8ff', '#a6f26b', '#ffffff']

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  return s[s.length >> 1]
}

function pitchStAt(p: PitchPoint[], t: number): number {
  if (!p.length) return 0
  if (t <= p[0].t) return p[0].st
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i].t) return p[i - 1].st + ((p[i].st - p[i - 1].st) * (t - p[i - 1].t)) / (p[i].t - p[i - 1].t)
  }
  return p[p.length - 1].st
}

interface F0Info {
  lo: number
  hi: number
  ticks: number[]
  markers: { t: number; hz: number }[]
}

/** 음높이 곡선의 표시 범위와 AP 음높이 목표(Hz). 기준 주파수는 프레임 f0 와 계획(반음)의 비로 역산한다 */
function analyseF0(speech: SpeechRender): F0Info | null {
  const { frames, voicing, plan } = speech
  const ratios: number[] = []
  let min = Infinity
  let max = -Infinity
  for (let k = 0; k < frames.length; k++) {
    if (voicing[k] <= 0.5) continue
    ratios.push(frames[k].f0 / 2 ** (pitchStAt(plan.pitch, (k + 0.5) * FRAME_MS) / 12))
    min = Math.min(min, frames[k].f0)
    max = Math.max(max, frames[k].f0)
  }
  if (!ratios.length) return null
  const base = median(ratios)
  const markers = plan.pitch.map((p) => ({ t: p.t, hz: base * 2 ** (p.st / 12) }))
  for (const m of markers) {
    min = Math.min(min, m.hz)
    max = Math.max(max, m.hz)
  }
  const span = Math.max(max - min, 20)
  const step = [10, 20, 25, 50, 100].find((s) => Math.ceil(span / s) <= 4) ?? 100
  const lo = Math.max(0, Math.floor((min - span * 0.08) / step) * step)
  let hi = Math.ceil((max + span * 0.08) / step) * step
  if (hi - lo < 2 * step) hi = lo + 2 * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + 0.1; v += step) ticks.push(v)
  return { lo, hi, ticks, markers }
}

export function SpeechTimeline({ speech, onSelectParam, paramLabel, playStartedAt, playing }: Props) {
  const { plan, frames, voicing } = speech
  const segs = plan.segments
  const T = frames.length * FRAME_MS

  // ── 폭: 컨테이너에 맞추되 너무 좁으면 가로 스크롤 ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setAvail(el.clientWidth)
    const ro = new ResizeObserver(() => setAvail(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = Math.max(avail, Math.ceil(T * MIN_PX_PER_MS + GUT), GUT + 40)
  const PW = W - GUT
  const x = (ms: number) => (ms / T) * PW

  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1)
  useEffect(() => {
    const on = () => setDpr(window.devicePixelRatio || 1)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // ── 스펙트로그램 ──
  const stft = useMemo(
    () => stftImage(speech.audio, speech.sampleRate, { hopMs: FRAME_MS, cols: frames.length, maxHz: MAX_HZ, rangeDb: 62 }),
    [speech, frames.length],
  )
  const specRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = specRef.current
    if (!cv) return
    cv.width = Math.max(1, Math.round(PW * dpr))
    cv.height = Math.max(1, Math.round(SPEC_H * dpr))
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const off = document.createElement('canvas')
    off.width = stft.cols
    off.height = stft.bins
    const octx = off.getContext('2d')
    if (!octx) return
    const img = octx.createImageData(stft.cols, stft.bins)
    for (let i = 0; i < stft.data.length; i++) {
      const li = stft.data[i] * 3
      img.data[i * 4] = MAGMA_LUT[li]
      img.data[i * 4 + 1] = MAGMA_LUT[li + 1]
      img.data[i * 4 + 2] = MAGMA_LUT[li + 2]
      img.data[i * 4 + 3] = 255
    }
    octx.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(off, 0, 0, stft.cols, stft.bins, 0, 0, cv.width, cv.height)
  }, [stft, PW, dpr])

  // 포먼트 점 (목소리가 있는 프레임만)
  const formantPaths = useMemo(() => {
    return [0, 1, 2].map((n) => {
      let d = ''
      for (let k = 0; k < frames.length; k++) {
        const f = frames[k].formants[n]
        if (voicing[k] <= 0.3 || !(f > 0) || f > MAX_HZ) continue
        d += `M${((((k + 0.5) * FRAME_MS) / T) * PW).toFixed(1)} ${((1 - f / MAX_HZ) * SPEC_H).toFixed(1)}h0`
      }
      return d
    })
  }, [frames, voicing, T, PW])

  // ── 음높이 ──
  const f0 = useMemo(() => analyseF0(speech), [speech])
  const f0Y = (hz: number) => 8 + (1 - (hz - f0!.lo) / (f0!.hi - f0!.lo)) * (F0_H - 16)
  const f0Path = useMemo(() => {
    if (!f0) return ''
    let d = ''
    let prev = -2
    for (let k = 0; k < frames.length; k++) {
      if (voicing[k] <= 0.5) continue
      const px = ((((k + 0.5) * FRAME_MS) / T) * PW).toFixed(1)
      const py = (8 + (1 - (frames[k].f0 - f0.lo) / (f0.hi - f0.lo)) * (F0_H - 16)).toFixed(1)
      d += `${k === prev + 1 ? 'L' : 'M'}${px} ${py}`
      prev = k
    }
    return d
  }, [f0, frames, voicing, T, PW])

  // ── 소리 단위 선택·설명 ──
  const [hover, setHover] = useState<number | null>(null)
  const [pin, setPin] = useState<{ sp: SpeechRender; i: number } | null>(null)
  const pinned = pin && pin.sp === speech ? pin.i : null
  const activeIdx = hover ?? pinned
  const active = activeIdx !== null ? segs[activeIdx] : undefined
  const desc = useMemo(() => (active ? describeSegment(active) : null), [active])
  const choose = (i: number) => {
    setPin({ sp: speech, i })
    onSelectParam?.(PARAM_FOR_KIND[segs[i].kind])
  }

  // ── 재생 위치선 ──
  const headRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    const head = headRef.current
    const sc = scrollRef.current
    if (!head) return
    if (playStartedAt == null) {
      head.style.display = 'none'
      return
    }
    let raf = 0
    const tick = () => {
      const el = performance.now() - playStartedAt
      if (el > T + 80 || el < 0 || !playingRef.current) {
        head.style.display = 'none'
        if (el > T + 80) return
      } else {
        const px = GUT + (el / T) * PW
        head.style.display = 'block'
        head.style.transform = `translateX(${px.toFixed(1)}px)`
        if (sc && sc.scrollWidth > sc.clientWidth + 1 && (px > sc.scrollLeft + sc.clientWidth - 24 || px < sc.scrollLeft + GUT)) {
          sc.scrollLeft = Math.max(0, px - GUT - 40)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playStartedAt, T, PW])

  const timeStep = T > 6000 ? 1000 : 500
  const timeTicks: number[] = []
  for (let t = 0; t <= T - 100; t += timeStep) timeTicks.push(t)
  const kindsUsed = new Set(segs.map((s) => s.kind))

  const bounds = [...new Set(segs.flatMap((s) => [s.start, s.end]))]
  const hint = active ? paramLabel?.(PARAM_FOR_KIND[active.kind]) : undefined

  return (
    <figure className="sp-timeline viz-fig">
      <ul className="sp-legend" aria-label="소리 단위 색깔 범례">
        {KIND_ORDER.filter((k) => kindsUsed.has(k)).map((k) => (
          <li key={k} className={`sp-legend-item k-${k}`}>
            <span className="sp-swatch" aria-hidden="true" />
            {KIND_LABEL[k]}
          </li>
        ))}
      </ul>

      <div className="sp-info" aria-live="polite">
        {desc && active ? (
          <>
            <div className="sp-info-head">
              <strong className="sp-info-title">{desc.title}</strong>
              <span className="sp-info-tags">{[...desc.tags.filter(Boolean), `${desc.ms}ms`].join(' · ')}</span>
            </div>
            <p className="sp-info-note">{desc.note}</p>
            {desc.phases.length > 0 && (
              <div className="sp-phases">
                <div className="sp-phasebar" role="img" aria-label={desc.phases.map((p) => `${p.label} ${p.ms}ms`).join(', ')}>
                  {desc.phases.map((p) => (
                    <span key={p.key} className={`sp-ph ph-${p.key}`} style={{ flexGrow: Math.max(p.ms, 2) }} />
                  ))}
                </div>
                <ul className="sp-phase-legend">
                  {desc.phases.map((p) => (
                    <li key={p.key}>
                      <span className={`sp-ph-dot ph-${p.key}`} aria-hidden="true" />
                      {p.label} {p.ms}ms
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hint && <p className="sp-info-hint">누르면 ‘{hint}’ 파라미터가 선택됩니다.</p>}
          </>
        ) : (
          <p className="sp-info-empty">소리 단위에 마우스를 올리거나 선택하면 어떤 소리인지 설명이 나옵니다.</p>
        )}
      </div>

      <div className="sp-scroll" ref={scrollRef}>
        <div className="sp-inner" style={{ width: W }}>
          {/* 소리 단위 띠 */}
          <div className="sp-row" style={{ height: STRIP_H }}>
            <div className="sp-gut"><span className="sp-gut-label">소리</span></div>
            <div className="sp-strip" style={{ width: PW }} role="group" aria-label="소리 단위">
              {segs.map((s, i) => {
                const w = x(s.end - s.start)
                const label = s.kind === 'pause' ? '쉼' : s.ipa
                const showLabel = w >= label.length * 7.5 + 6
                return (
                  <button
                    key={i}
                    type="button"
                    className={`sp-seg k-${s.kind}${activeIdx === i ? ' on' : ''}${pinned === i ? ' pinned' : ''}`}
                    style={{ left: x(s.start), width: Math.max(2, w) }}
                    aria-label={`${describeSegment(s).title}, ${KIND_LABEL[s.kind]}`}
                    aria-pressed={pinned === i}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => choose(i)}
                  >
                    {showLabel && <span className="sp-seg-label">{label}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 음높이 */}
          <div className="sp-row" style={{ height: F0_H }}>
            <div className="sp-gut">
              {f0 && f0.ticks.map((v) => (
                <span key={v} className="sp-tick" style={{ top: f0Y(v), transform: 'translateY(-50%)' }}>{v}</span>
              ))}
              <span className="sp-unit">Hz</span>
            </div>
            <div
              className="sp-f0 sp-clickable"
              style={{ width: PW }}
              role="button"
              tabIndex={0}
              aria-label={`음높이(억양) 곡선${paramLabel?.('f0Range') ? ` — 누르면 ‘${paramLabel('f0Range')}’ 선택` : ''}`}
              onClick={() => onSelectParam?.('f0Range')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectParam?.('f0Range')
                }
              }}
            >
              <svg width={PW} height={F0_H} className="sp-svg" aria-hidden="true">
                {f0 && f0.ticks.map((v) => <line key={v} className="viz-grid" x1={0} x2={PW} y1={f0Y(v)} y2={f0Y(v)} />)}
                {bounds.map((t) => <line key={t} className="sp-bound" x1={x(t)} x2={x(t)} y1={0} y2={F0_H} />)}
                {f0 && <path className="sp-f0-line" d={f0Path} />}
                {f0 && f0.markers.map((m, i) => (
                  <circle key={i} className="sp-f0-mark" cx={x(m.t)} cy={f0Y(m.hz)} r={3.2}>
                    <title>{`억양 목표 ${Math.round(m.hz)}Hz`}</title>
                  </circle>
                ))}
              </svg>
              {!f0 && <span className="sp-empty">목소리가 나는 구간이 없습니다</span>}
            </div>
          </div>

          {/* 스펙트로그램 */}
          <div className="sp-row" style={{ height: SPEC_H }}>
            <div className="sp-gut">
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <span
                  key={k}
                  className="sp-tick"
                  style={{ top: (1 - (k * 1000) / MAX_HZ) * SPEC_H, transform: k === 0 ? 'translateY(-100%)' : k === 5 ? 'none' : 'translateY(-50%)' }}
                >
                  {k}
                </span>
              ))}
              <span className="sp-unit">kHz</span>
            </div>
            <div className="sp-spec" style={{ width: PW, height: SPEC_H }}>
              <canvas ref={specRef} style={{ width: PW, height: SPEC_H }} aria-label="렌더링된 소리의 스펙트로그램 (0–5kHz)" role="img" />
              <svg width={PW} height={SPEC_H} className="sp-svg" aria-hidden="true">
                {bounds.map((t) => <line key={t} className="sp-bound sp-bound-spec" x1={x(t)} x2={x(t)} y1={0} y2={SPEC_H} />)}
                {formantPaths.map((d, n) => (
                  <g key={n}>
                    <path d={d} className="sp-dot-halo" />
                    <path d={d} className="sp-dot" style={{ stroke: FORMANT_COLORS[n] }} />
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* 시간 축 */}
          <div className="sp-row" style={{ height: AXIS_H }}>
            <div className="sp-gut" />
            <div className="sp-axis" style={{ width: PW }}>
              {timeTicks.map((t) => (
                <span key={t} className="sp-tick sp-time" style={{ left: x(t), transform: t === 0 ? 'none' : undefined }}>{t === 0 ? '0' : `${t / 1000}초`}</span>
              ))}
            </div>
          </div>

          <div className="sp-playhead" ref={headRef} aria-hidden="true" />
        </div>
      </div>

      <figcaption className="sp-notes">
        <p>
          <strong>음높이(억양)</strong> — 띄어쓰기마다 낮게 시작해 올라가고, 문장 끝에서 내려가거나(평서) 올라감(의문). 선은 실제 음높이, 동그라미는 계획한 억양 목표입니다.
        </p>
        <p className="sp-fmt-legend">
          <strong>스펙트로그램</strong> — 밝을수록 그 주파수의 소리가 셉니다. 점은 목소리가 나는 구간의 포먼트:
          {['F1', 'F2', 'F3'].map((f, n) => (
            <span key={f} className="sp-fmt-item">
              <span className="sp-fmt-dot" style={{ background: FORMANT_COLORS[n] }} aria-hidden="true" />
              {f}
            </span>
          ))}
        </p>
      </figcaption>
    </figure>
  )
}
