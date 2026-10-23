// Text normalizer: arbitrary user input -> Hangul-only text for the Korean G2P.
// Pure and dependency-free; imported directly by Node, hence no TS-only syntax.

/** Soft input limit for the UI. Not enforced by normalizeKorean itself. */
export const MAX_INPUT_CHARS = 50;

// ---- Number tables --------------------------------------------------------

const SINO_DIGITS = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const PHONE_DIGITS = ['공', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SMALL_UNITS = ['', '십', '백', '천']; // index = position inside a 4-digit group
const BIG_UNITS = ['', '만', '억', '조']; // index = 4-digit group from the right

const NATIVE_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];

const LETTER_NAMES: Record<string, string> = {
  A: '에이', B: '비', C: '씨', D: '디', E: '이', F: '에프', G: '지', H: '에이치',
  I: '아이', J: '제이', K: '케이', L: '엘', M: '엠', N: '엔', O: '오', P: '피',
  Q: '큐', R: '알', S: '에스', T: '티', U: '유', V: '브이', W: '더블유', X: '엑스',
  Y: '와이', Z: '제트',
};

const MAX_CARDINAL_DIGITS = 16; // up to 9999조 9999억 9999만 9999

// ---- Number reading -------------------------------------------------------

function digitByDigit(digits: string, names: string[]): string {
  return [...digits].map((d) => names[Number(d)]).join('');
}

// One 4-digit group ("0123" -> 백이십삼). 일 is dropped before 십/백/천.
function readGroup(group: string): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    const d = Number(group[i]);
    const pos = 3 - i;
    if (d === 0) continue;
    out += d === 1 && pos > 0 ? SMALL_UNITS[pos] : SINO_DIGITS[d] + SMALL_UNITS[pos];
  }
  return out;
}

// Sino-Korean cardinal for a digit string without sign or commas.
function sinoCardinal(digits: string): string {
  const trimmed = digits.replace(/^0+/, '');
  if (trimmed === '') return '영';
  const padded = trimmed.padStart(Math.ceil(trimmed.length / 4) * 4, '0');
  let out = '';
  for (let g = 0; g * 4 < padded.length; g++) {
    const text = readGroup(padded.slice(g * 4, g * 4 + 4));
    if (text === '') continue;
    const unit = BIG_UNITS[padded.length / 4 - 1 - g];
    // 10000 = 만, not 일만 (only for the leading group).
    out += g === 0 && unit && text === '일' ? unit : text + unit;
  }
  return out;
}

// Integer part: very long or phone-like (leading 0) strings are read digit by digit.
function readInteger(digits: string): string {
  if (digits.length > MAX_CARDINAL_DIGITS) return digitByDigit(digits, PHONE_DIGITS);
  if (digits.length >= 7 && digits.startsWith('0')) return digitByDigit(digits, PHONE_DIGITS);
  return sinoCardinal(digits);
}

// Native numeral in attributive form, for 1..99 (한, 두, 세, 네, 스무 ...).
function nativeAttributive(n: number): string {
  if (n === 20) return '스무';
  return NATIVE_TENS[Math.floor(n / 10)] + NATIVE_ONES[n % 10];
}

// ---- Number matching ------------------------------------------------------

// Hyphenated digit groups: 010-1234-5678. Read digit by digit when phone-like.
const HYPHEN_DIGITS_RE = /\d+(?:-\d+)+/g;

// Counters that take native numerals. Longest alternatives first; 개월 and 달러 are Sino.
const COUNTERS = '시간|번째|마리|그릇|사람|개(?!월)|명|살|시|잔|권|장|병|달(?!러)';

// sign? integer(with commas)? decimals? percent? (space? counter)?
const NUMBER_RE = new RegExp(
  '(?:(?<![0-9A-Za-z가-힣])(?<sign>[-−]))?' +
    '(?<int>\\d{1,3}(?:,\\d{3})+|\\d+)' +
    '(?:\\.(?<frac>\\d+))?' +
    '(?<pct>%)?' +
    `(?:(?<space> ?)(?<counter>${COUNTERS}))?`,
  'g',
);

interface NumberGroups {
  sign?: string;
  int: string;
  frac?: string;
  pct?: string;
  space?: string;
  counter?: string;
}

function readNumbers(text: string): string {
  const hyphenated = text.replace(HYPHEN_DIGITS_RE, (m) => {
    const digits = m.replaceAll('-', '');
    const phoneLike = m.startsWith('0') || digits.length >= 7;
    if (!phoneLike) return m; // e.g. "10-20": left for the generic pass
    return m.split('-').map((part) => digitByDigit(part, PHONE_DIGITS)).join(' ');
  });

  return hyphenated.replace(NUMBER_RE, (...args) => {
    const g = args[args.length - 1] as NumberGroups;
    const digits = g.int.replaceAll(',', '');
    const suffix = g.counter ? (g.space ?? '') + g.counter : '';

    // Native numeral: plain integer 1..99 directly before a counter.
    const plain = !g.sign && !g.frac && !g.pct && !g.int.includes(',');
    const n = Number(digits);
    if (g.counter && plain && digits.length <= 2 && n >= 1) {
      return nativeAttributive(n) + suffix;
    }

    let out = readInteger(digits);
    if (g.frac) out += '점' + digitByDigit(g.frac, SINO_DIGITS);
    if (g.sign) out = '마이너스' + out;
    if (g.pct) out += '퍼센트';
    return out + suffix;
  });
}

// ---- Symbols, punctuation, whitespace -------------------------------------

// A run of phrase marks collapses to one; the strongest ending wins.
function collapsePunctuation(run: string): string {
  if (run.includes('?')) return '?';
  if (run.includes('!')) return '!';
  if (run.includes('.')) return '.';
  return ',';
}

export function normalizeKorean(text: string): string {
  let s = text.normalize('NFKC').trim(); // full-width forms, "…" -> "..."

  s = readNumbers(s);
  s = s.replaceAll('%', '퍼센트');
  s = s.replace(/[A-Za-z]/g, (c) => LETTER_NAMES[c.toUpperCase()]);

  s = s
    .replace(/[~;:\r\n]+/g, ',') // soft pauses
    .replaceAll('。', '.')
    .replaceAll('、', ',')
    .replace(/[-–—/_]/g, ' ') // dashes and slashes separate words
    .replace(/[^가-힣\s.,?!]/g, ''); // drop everything but Hangul, space, marks

  s = s
    .replace(/\s+/g, ' ')
    .replace(/ ?[.,?!](?: ?[.,?!])*/g, collapsePunctuation)
    .replace(/^[\s.,?!]+/, ''); // nothing to pause before

  return s.trim();
}
