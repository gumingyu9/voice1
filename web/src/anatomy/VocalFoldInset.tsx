import { ANATOMY_LABELS, type ParamValues } from '../params/schema'
import { foldInsetGeometry } from './geometry'
import { staticOpening, useFoldOpening } from './hooks'

interface Props {
  values: ParamValues
  playing: boolean
  highlighted: boolean
  onClick: () => void
}

/** 후두경 시점(위에서 본 모습). 앞쪽이 위. */
export function VocalFoldInset({ values, playing, highlighted, onClick }: Props) {
  const live = useFoldOpening(values, playing)
  const o = live ?? staticOpening(values)
  const g = foldInsetGeometry(values, o)

  return (
    <svg className="an-svg an-inset-svg" viewBox="0 0 160 184" role="img" aria-label="성대를 위에서 본 그림">
      <defs>
        <clipPath id="an-scope-clip">
          <circle cx="80" cy="80" r="76" />
        </clipPath>
      </defs>
      <g transform="translate(0 14)">
      <circle cx="80" cy="80" r="77" className="an-scope-ring" />
      <g clipPath="url(#an-scope-clip)">
        <rect width="160" height="160" className="an-scope-bg" />
        <path d="M24,38 Q80,-14 136,38 Q80,14 24,38Z" className="an-scope-epi" />
        <g
          className={`an-part an-vocalFolds${highlighted ? ' hl' : ''}`}
          data-part="vocalFolds"
          role="button"
          tabIndex={0}
          aria-label={ANATOMY_LABELS.vocalFolds}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick()
            }
          }}
        >
          <title>{ANATOMY_LABELS.vocalFolds}</title>
          <path d={g.glottis} className="an-scope-glottis" />
          <path d={g.left} className="s k-fold" strokeLinejoin="round" />
          <path d={g.right} className="s k-fold" strokeLinejoin="round" />
          <ellipse cx={g.aryL[0]} cy={g.aryL[1]} rx="10" ry="12" className="s k-cart" />
          <ellipse cx={g.aryR[0]} cy={g.aryR[1]} rx="10" ry="12" className="s k-cart" />
        </g>
      </g>
      </g>
      <text x="80" y="11" className="an-inset-lbl" textAnchor="middle">앞</text>
      <text x="80" y="181" className="an-inset-lbl" textAnchor="middle">뒤</text>
    </svg>
  )
}
