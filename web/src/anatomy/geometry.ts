// 해부도용 순수 기하 계산. 파라미터 값 → SVG path 문자열/좌표.
// 좌표계: 시상면 그림 viewBox 기준 (얼굴이 왼쪽을 향함). 단위는 그림 픽셀.
import { DEFAULT_VALUES, type ParamValues } from '../params/schema'

export type Pt = [number, number]

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const n1 = (v: number) => String(Math.round(v * 10) / 10)
const P = (p: Pt) => `${n1(p[0])},${n1(p[1])}`

/** Catmull-Rom → cubic Bezier 구간들(현재 점에서 이어 붙이는 "C…" 문자열만). */
function segs(pts: Pt[], closed: boolean, k: number): string {
  const n = pts.length
  const get = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)])
  const count = closed ? n : n - 1
  let d = ''
  for (let i = 0; i < count; i++) {
    const p0 = get(i - 1)
    const p1 = get(i)
    const p2 = get(i + 1)
    const p3 = get(i + 2)
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * k) / 6, p1[1] + ((p2[1] - p0[1]) * k) / 6]
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * k) / 6, p2[1] - ((p3[1] - p1[1]) * k) / 6]
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`
  }
  return d
}
export const curveTo = (pts: Pt[], k = 1) => segs(pts, false, k)
export const smoothOpen = (pts: Pt[], k = 1) => `M${P(pts[0])}${segs(pts, false, k)}`
export const smoothClosed = (pts: Pt[], k = 1) => `M${P(pts[0])}${segs(pts, true, k)}Z`
export const polyline = (pts: Pt[]) => `M${pts.map(P).join('L')}`
export const polygon = (pts: Pt[]) => `${polyline(pts)}Z`

// ── 고정 해부 좌표 ───────────────────────────────────────────
export const TRACHEA_C = 202 // 기관·성도 중심선 x
export const LUMEN_FRONT = 190 // 후두 앞벽 x
export const LUMEN_BACK = 214 // 인두 뒷벽(내강) x
const PIVOT: Pt = [230, 198] // 턱관절

/** 입천장(경구개) 윗선 — 구강 내강의 천장 */
const ROOF: Pt[] = [
  [80, 199],
  [90, 196.5],
  [104, 190],
  [130, 185],
  [166, 187],
]
export function palateY(x: number): number {
  if (x <= ROOF[0][0]) return ROOF[0][1]
  for (let i = 1; i < ROOF.length; i++) {
    if (x <= ROOF[i][0]) {
      const [x0, y0] = ROOF[i - 1]
      const [x1, y1] = ROOF[i]
      return lerp(y0, y1, (x - x0) / (x1 - x0))
    }
  }
  return ROOF[ROOF.length - 1][1]
}

// ── 모음 자세 ────────────────────────────────────────────────
export interface Pose {
  px: number // 혀 등 최고점 x (작을수록 전설)
  py: number // 혀 등 최고점 y (클수록 낮음)
  tipX: number
  tipY: number
  rootX: number // 혀뿌리 앞면 x (클수록 인두가 좁아짐)
  jaw: number // 턱 벌림(앞니 위치에서 아래로 내려오는 px)
  round: number // 모음에 의한 입술 오므림 추가량
}
export const POSE_KEYS: (keyof Pose)[] = ['px', 'py', 'tipX', 'tipY', 'rootX', 'jaw', 'round']

const NEUTRAL: Pose = { px: 150, py: 224, tipX: 90, tipY: 220, rootX: 180, jaw: 11, round: 0 }
const VOWEL_POSES: Record<string, Pose> = {
  ㅣ: { px: 126, py: 198, tipX: 90, tipY: 213, rootX: 166, jaw: 3, round: 0 },
  ㅔ: { px: 132, py: 210, tipX: 90, tipY: 216, rootX: 172, jaw: 11, round: 0 },
  ㅏ: { px: 164, py: 246, tipX: 94, tipY: 240, rootX: 192, jaw: 24, round: 0 },
  ㅓ: { px: 166, py: 226, tipX: 92, tipY: 226, rootX: 188, jaw: 14, round: 0 },
  ㅗ: { px: 164, py: 212, tipX: 92, tipY: 222, rootX: 188, jaw: 8, round: 0.55 },
  ㅜ: { px: 176, py: 200, tipX: 94, tipY: 226, rootX: 190, jaw: 5, round: 0.8 },
  ㅡ: { px: 154, py: 198, tipX: 90, tipY: 222, rootX: 178, jaw: 5, round: 0 },
}

/** 목표 자세(배열). articulation(%)은 중립(슈와) 자세로부터의 변위를 배율로 키우거나 줄인다. */
export function poseTarget(vowel: string, articulation: number, sibilance: number | null): number[] {
  const t = VOWEL_POSES[vowel] ?? NEUTRAL
  const s = articulation / 100
  const p: Pose = { ...NEUTRAL }
  for (const k of POSE_KEYS) {
    p[k] = k === 'round' ? t[k] : NEUTRAL[k] + (t[k] - NEUTRAL[k]) * s
  }
  p.py = Math.max(p.py, 193)
  p.jaw = clamp(p.jaw, 1.5, 30)
  p.rootX = clamp(p.rootX, 160, 194)
  p.tipY = Math.min(p.tipY, 244)
  if (sibilance !== null) {
    // 치찰음: 혀끝이 앞니~치경 쪽 좁은 틈. 값이 클수록 틈이 앞쪽(앞니)에 가깝다.
    const xc = lerp(114, 90, clamp((sibilance - 3) / 6, 0, 1))
    p.tipX = xc - 2
    p.tipY = palateY(xc) + 3.5
    p.px = 138
    p.py = 219
    p.rootX = 180
    p.jaw = 6
  }
  return POSE_KEYS.map((k) => p[k])
}
export function arrToPose(a: number[]): Pose {
  const p = { ...NEUTRAL }
  POSE_KEYS.forEach((k, i) => {
    p[k] = a[i]
  })
  return p
}

/** 혀 등 윤곽 y(x) */
export function dorsumY(p: Pose, x: number): number {
  let y: number
  if (x <= p.px) {
    const t = clamp((x - p.tipX) / (p.px - p.tipX), 0, 1)
    y = p.tipY + (p.py - p.tipY) * (1 - Math.pow(1 - t, 1.7))
  } else {
    const t = clamp((x - p.px) / (p.rootX - p.px), 0, 1)
    y = p.py + 26 * (1 - Math.sqrt(1 - t * t))
  }
  return x < 168 ? Math.max(y, palateY(x) + 3) : y
}

// ── 파라미터 → 기하 ──────────────────────────────────────────
export interface Geo {
  fy: number // 성대 y
  hy: number // 설골 y
  lungTop: number
  lungScale: number
  loud: number
  vtl: number
  pose: Pose
  rot: (x: number, y: number) => Pt // 턱 회전 적용
  // 입
  lipE: number
  upperLip: string
  lowerLip: string
  lipAnchor: Pt
  mouthOpen: number
  // 형태
  lumen: string
  nasal: string
  nasalFlow: string
  nasalFlowTip: Pt
  nasalFlowDir: Pt
  nasality: number
  velum: string
  velumAnchor: Pt
  tongue: string
  tongueAnchor: Pt
  jawSkin: string
  jawEdge: string
  mandible: string
  ramus: string
  tmj: Pt
  jawAnchor: Pt
  upperTooth: string
  lowerTooth: string
  palate: string
  centerline: Pt[]
  centerlinePath: string
  gap: Pt // 치찰음 틈 위치
  // 목
  pharynxBand: { y1: number; y2: number }
  epilBack: string
  epilFront: string
  epiglottis: string
  ringD: number
  ring: number
  thyroid: string
  cricoid: string
  hyoid: string
  strap: string
  arytenoid: Pt
  fold: string
  foldTh: number
  // 폐
  lobeL: string
  lobeR: string
  bronchi: string
  rings: number[]
}

const val = (values: ParamValues, id: string) => values[id] ?? DEFAULT_VALUES[id]

export function buildGeometry(values: ParamValues, pose: Pose): Geo {
  const vtl = val(values, 'vtl')
  const lh = val(values, 'larynxHeight')
  const loud = val(values, 'loudness')
  const nas = val(values, 'nasality')
  const f0 = val(values, 'f0')

  // 성도 길이·후두 높이 → 후두(성대) 위치. 폐·기관은 vtl 만큼 따라 내려간다.
  const dv = (vtl - 17) * 5
  const fy = 335 + dv - lh * 18
  const hy = fy - 50
  const lungTop = 400 + dv
  const lungScale = 1 + 0.12 * (loud / 100)

  // 턱 회전
  const ang = -pose.jaw / (PIVOT[0] - 72)
  const cs = Math.cos(ang)
  const sn = Math.sin(ang)
  const rot = (x: number, y: number): Pt => {
    const dx = x - PIVOT[0]
    const dy = y - PIVOT[1]
    return [PIVOT[0] + dx * cs - dy * sn, PIVOT[1] + dx * sn + dy * cs]
  }

  // 입술
  const lipE = clamp(val(values, 'lipShape') + pose.round, -1, 1)
  const pos = Math.max(lipE, 0)
  const neg = Math.max(-lipE, 0)
  const xf = 62 - pos * 13 + neg * 5
  const t = 11 + pos * 4 - neg * 4.5
  const sq = Math.min(pos * 4, Math.max((pose.jaw - 3) / 2, 0))
  const yU = 208 + sq
  const lt0 = 210 - sq
  const upperLip = smoothClosed([
    [58, 178],
    [xf + 0.5, 193],
    [xf - 0.5, yU - 5],
    [xf + 3, yU + 0.5],
    [xf + t - 1, yU],
    [xf + t + 4, yU - 9],
    [82, 190],
    [72, 178],
  ])
  const ll: Pt[] = [
    [xf + 4, lt0 - 0.5],
    [xf + t, lt0],
    [xf + t + 5, lt0 + 9],
    [xf + t + 3, lt0 + 21],
    [xf + 3, lt0 + 22],
    [xf - 1, lt0 + 11],
  ]
  const lowerLip = smoothClosed(ll.map(([x, y]) => rot(x, y)))
  const yL = rot(xf + 4, lt0)[1]
  const lipAnchor: Pt = [xf + 3, 196]
  const xl = 80

  // 턱 피부(하안면) — 입 바닥 선(F)이 내강과의 경계
  const floor: Pt[] = [rot(78, 210), rot(92, 224), rot(108, 236), rot(128, 246), rot(150, 253)]
  const E: Pt = [136, 298 + pose.jaw * 0.22]
  const outer: Pt[] = [
    rot(78, 210),
    rot(66, 214),
    rot(63, 224),
    rot(66, 232),
    rot(62, 246),
    rot(66, 262),
    rot(86, 272),
    rot(112, 278),
    E,
  ]
  const jawSkin = `M${P(outer[0])}${curveTo(outer)}${curveTo([E, [152, 289], [160, 270], floor[4]])}L${P(floor[3])}L${P(floor[2])}L${P(floor[1])}Z`
  const jawEdge = `M${P(outer[1])}${curveTo(outer.slice(1))}`
  const mandPts: Pt[] = [rot(76, 247), rot(71, 259), rot(86, 266), rot(130, 270), rot(178, 269), rot(206, 264)]
  const mandible = smoothClosed(
    [...mandPts, rot(190, 252), rot(150, 250), rot(112, 247), rot(88, 238)],
    0.9,
  )
  const ramus = polyline([rot(206, 264), rot(220, 232), PIVOT])
  const jawAnchor = rot(72, 258)

  const upperTooth = smoothClosed(
    [
      [78, 188],
      [89, 188],
      [88.5, 205],
      [84, 209.5],
      [79.5, 207],
    ],
    0.5,
  )
  const lowerTooth = smoothClosed(
    [rot(80, 211), rot(85, 209.5), rot(89, 213), rot(89, 229), rot(81, 230)],
    0.5,
  )

  // 혀
  const { px, py, tipX, tipY, rootX } = pose
  const ry = py + 26
  const hb = clamp(hy, ry + 16, ry + 34)
  const dorsumXs = [0, 0.3, 0.65, 1].map((f) => lerp(tipX, px, f))
  const backXs = [0.4, 0.75, 1].map((f) => lerp(px, rootX, f))
  const dorsum: Pt[] = [...dorsumXs, ...backXs].map((x) => [x, dorsumY(pose, x)])
  const tongueBase: Pt[] = [
    [rootX - 1, ry + 14],
    [rootX - 5, hb - 8],
    [rootX - 16, hb],
    rot(150, 261),
    rot(118, 255),
    rot(98, 245),
    [tipX - 4, tipY + 10],
  ]
  const tongue = smoothClosed([...dorsum, ...tongueBase], 0.9)
  const tongueAnchor: Pt = [px, py + 10]

  // 구개·연구개·비강
  const palate = polygon([
    [72, 181],
    [88, 180],
    [130, 178],
    [166, 179],
    [166, 187],
    [130, 185],
    [104, 190],
    [90, 196.5],
    [82, 198],
  ])
  const nasalAng = ((-8 + (nas > 0 ? nas * 54 : nas * 4)) * Math.PI) / 180
  const vl = 50
  const vp: Pt = [164, 184]
  const vtpl: Pt[] = [
    [-8, -6],
    [10, -7],
    [28, -6.5],
    [44, -5.5],
    [vl, -4],
    [vl + 4, -0.5],
    [vl + 3, 3.5],
    [vl - 8, 6],
    [30, 6.5],
    [10, 6.5],
    [-8, 6],
  ]
  const ca = Math.cos(nasalAng)
  const sa = Math.sin(nasalAng)
  const vpts = vtpl.map(([u, v]): Pt => [vp[0] + u * ca - v * sa, vp[1] + u * sa + v * ca])
  const velum = smoothClosed(vpts, 0.9)
  const velumAnchor: Pt = [vp[0] + 30 * ca, vp[1] + 30 * sa]

  const nasal = [
    'M58,168',
    'C66,152 92,141 122,138',
    'L150,134',
    'C174,130 204,130 214,136',
    'L214,183',
    'L166,183',
    'L166,180',
    'L130,178',
    'L100,177',
    'C80,177 66,174 58,168',
    'Z',
  ].join('')
  // 비음 공기 흐름(콧구멍 쪽으로)
  const nasalFlow = `M209,${n1(190 + Math.max(nas, 0) * 22)}C213,178 206,163 188,161C150,158 100,160 72,166`
  const nasalFlowTip: Pt = [60, 165]
  const nasalFlowDir: Pt = [-1, 0.35]

  // 내강(성도): 입술 안쪽 → 천장 → 인두 뒷벽 → 후두 앞벽 → 혀뿌리/입 바닥
  const roofPts: Pt[] = [[xl, yU - 1], ...ROOF]
  const lumen = [
    smoothOpen(roofPts, 0.8),
    `L166,183L${LUMEN_BACK},183L${LUMEN_BACK},${n1(fy)}L${LUMEN_FRONT},${n1(fy)}L${LUMEN_FRONT},${n1(hb)}`,
    `L${P([rootX - 8, hb - 6])}`,
    `L${P([floor[4][0], floor[4][1] + 4])}`,
    `L${P([floor[3][0], floor[3][1] + 4])}L${P([floor[2][0], floor[2][1] + 4])}L${P([floor[1][0], floor[1][1] + 4])}`,
    `L${P([floor[0][0], floor[0][1]])}L${P([xl, yL])}Z`,
  ].join('')

  // 성도 중심선 (성대 → 인두 → 구강 → 입술)
  const mid = (x: number) => (palateY(x) + dorsumY(pose, x)) / 2
  const xc = (rootX + LUMEN_BACK) / 2
  const bY = fy - 30
  const centerline: Pt[] = [
    [TRACHEA_C, fy - 4],
    [TRACHEA_C, bY],
    [xc, Math.min(ry + 6, bY - 12)],
    [xc, Math.min(py - 6, ry - 6)],
    [px + 14, mid(px + 14)],
    [px - 22, mid(px - 22)],
    [tipX + 10, mid(tipX + 10)],
    [xl + 2, (yU + yL) / 2],
  ]
  const centerlinePath = smoothOpen(centerline, 0.9)

  const gap: Pt = [tipX + 4, tipY - 4]

  // 인두 벽 / 후두개 위 공간(ring) / 후두
  const ring = val(values, 'ring')
  const ringD = (ring / 100) * 7
  const y1 = fy - 40
  const d = ringD
  const epilBack = `M${LUMEN_BACK + 10},${y1}L${LUMEN_BACK},${y1}C${LUMEN_BACK},${y1 + 10} ${LUMEN_BACK - d},${y1 + 8} ${LUMEN_BACK - d},${y1 + 18}L${LUMEN_BACK - d},${fy - 10}C${LUMEN_BACK - d},${fy - 4} ${LUMEN_BACK},${fy - 6} ${LUMEN_BACK},${fy - 2}L${LUMEN_BACK + 10},${fy - 2}Z`
  const epilFront = `M${LUMEN_FRONT - 10},${y1}L${LUMEN_FRONT},${y1}C${LUMEN_FRONT},${y1 + 10} ${LUMEN_FRONT + d},${y1 + 8} ${LUMEN_FRONT + d},${y1 + 18}L${LUMEN_FRONT + d},${fy - 10}C${LUMEN_FRONT + d},${fy - 4} ${LUMEN_FRONT},${fy - 6} ${LUMEN_FRONT},${fy - 2}L${LUMEN_FRONT - 10},${fy - 2}Z`
  const epiglottis = smoothClosed([
    [184, fy - 28],
    [187, fy - 46],
    [196, fy - 61],
    [204, fy - 60],
    [197, fy - 44],
    [194, fy - 26],
  ])
  const thyroid = smoothClosed(
    [
      [186, fy - 34],
      [170, fy - 32],
      [160, fy - 18],
      [163, fy - 5],
      [174, fy + 8],
      [186, fy + 8],
    ],
    0.8,
  )
  const cricoid = `${smoothClosed(
    [
      [213, fy - 14],
      [225, fy - 14],
      [225, fy + 26],
      [213, fy + 26],
    ],
    0.3,
  )}${smoothClosed(
    [
      [183, fy + 12],
      [193, fy + 12],
      [193, fy + 25],
      [183, fy + 25],
    ],
    0.3,
  )}`
  const hyoid = smoothClosed([
    [160, hy - 4],
    [176, hy - 9],
    [189, hy - 3],
    [189, hy + 4],
    [176, hy],
    [160, hy + 3],
  ])
  const strap = polyline([[rootX - 14, hb - 4], [172, hy - 4]])
  const arytenoid: Pt = [209, fy - 8]

  // 성대 (f0 가 높을수록 얇게)
  const u = Math.log(f0 / 50) / Math.log(12)
  const foldTh = lerp(7, 2.5, clamp(u, 0, 1))
  const fold = `M${LUMEN_FRONT},${n1(fy - foldTh)}L204,${n1(fy - foldTh * 0.5)}Q210,${n1(fy)} 204,${n1(fy + foldTh * 0.5)}L${LUMEN_FRONT},${n1(fy + foldTh)}Z`

  // 폐·기관지
  const sc = lungScale
  const lobePts: Pt[] = [
    [-6, 14],
    [-30, 18],
    [-56, 36],
    [-72, 62],
    [-70, 82],
    [-52, 90],
    [-20, 90],
    [-4, 80],
    [-2, 50],
  ]
  const toAbs = (sign: number) =>
    smoothClosed(lobePts.map(([x, y]): Pt => [TRACHEA_C + sign * x * sc, lungTop + 44 + (y - 44) * sc]), 0.9)
  const bronchi = `M${TRACHEA_C},${n1(lungTop - 2)}L${TRACHEA_C},${n1(lungTop + 8)}M${TRACHEA_C},${n1(lungTop + 8)}Q${TRACHEA_C - 14},${n1(lungTop + 10)} ${TRACHEA_C - 30},${n1(lungTop + 30)}M${TRACHEA_C},${n1(lungTop + 8)}Q${TRACHEA_C + 14},${n1(lungTop + 10)} ${TRACHEA_C + 30},${n1(lungTop + 30)}`
  const rings: number[] = []
  for (let y = fy + 36; y < lungTop - 8; y += 10) rings.push(y)

  return {
    fy, hy, lungTop, lungScale, loud, vtl, pose, rot,
    lipE, upperLip, lowerLip, lipAnchor, mouthOpen: yL - yU,
    lumen, nasal, nasalFlow, nasalFlowTip, nasalFlowDir, nasality: nas,
    velum, velumAnchor, tongue, tongueAnchor, jawSkin, jawEdge, mandible, ramus, tmj: PIVOT, jawAnchor,
    upperTooth, lowerTooth, palate, centerline, centerlinePath, gap,
    pharynxBand: { y1: 134, y2: y1 }, epilBack, epilFront, epiglottis, ringD, ring, thyroid, cricoid, hyoid, strap, arytenoid,
    fold, foldTh,
    lobeL: toAbs(-1), lobeR: toAbs(1), bronchi, rings,
  }
}

/** 위로 향하는 블록 화살표 */
export function arrowUp(cx: number, yBase: number, yTip: number, w: number): string {
  const hh = Math.min(14, Math.max(8, (yBase - yTip) * 0.4))
  const hw = w / 2 + 4.5
  return polygon([
    [cx - w / 2, yBase],
    [cx - w / 2, yTip + hh],
    [cx - hw, yTip + hh],
    [cx, yTip],
    [cx + hw, yTip + hh],
    [cx + w / 2, yTip + hh],
    [cx + w / 2, yBase],
  ])
}

/** 임의 방향 화살촉 */
export function arrowHead(tip: Pt, dir: Pt, size: number): string {
  const len = Math.hypot(dir[0], dir[1]) || 1
  const dx = dir[0] / len
  const dy = dir[1] / len
  const bx = tip[0] - dx * size
  const by = tip[1] - dy * size
  return polygon([tip, [bx - dy * size * 0.55, by + dx * size * 0.55], [bx + dy * size * 0.55, by - dx * size * 0.55]])
}

// ── 성대 위에서 본 그림 ──────────────────────────────────────
export function foldInsetGeometry(values: ParamValues, o: number) {
  const f0 = val(values, 'f0')
  const breath = val(values, 'breathiness') / 100
  const u = clamp(Math.log(f0 / 50) / Math.log(12), 0, 1)
  const w0 = lerp(26, 11, u)
  const Y0 = 34
  const Y1 = 114
  const N = 14
  const half = (t: number) => o * 30 * Math.pow(t, 0.8) + breath * 24 * smoothstep(0.3, 1, t)
  const med: Pt[] = []
  const lat: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const y = lerp(Y0, Y1, t)
    const h = half(t)
    const w = w0 * (0.7 + 0.3 * Math.sin(Math.PI * clamp(t * 0.9 + 0.05, 0, 1)))
    med.push([h, y])
    lat.push([h + w, y + (1 - t) * 8])
  }
  const side = (sign: number) =>
    polygon([...med.map(([h, y]): Pt => [80 + sign * h, y]), ...[...lat].reverse().map(([h, y]): Pt => [80 + sign * h, y])])
  const hp = half(1)
  const glottis = polygon([
    [80, Y0 - 1],
    ...med.map(([h, y]): Pt => [80 - h, y]),
    [80 - hp, 124],
    [80 + hp, 124],
    ...[...med].reverse().map(([h, y]): Pt => [80 + h, y]),
  ])
  return { left: side(-1), right: side(1), glottis, aryL: [80 - hp - 13, 121] as Pt, aryR: [80 + hp + 13, 121] as Pt }
}
