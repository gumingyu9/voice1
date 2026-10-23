import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pronounce } from './g2p.ts';

// Expected standard pronunciations (표준 발음법), written in Hangul.
// Only cases a syllable-level rule engine can produce, with one unambiguous answer.
// Skipped on purpose: 사이시옷 compounds, ㄴ첨가 (솜이불), verb-stem tensification
// after ㄴ/ㅁ (신고), Sino-Korean ㄹ tensification (발전), 읽고/밟다-type exceptions,
// and anything with two accepted pronunciations (맛있다, 강의, 협의, ...).

type Rule =
  | 'liaison'
  | 'coda_neutralization'
  | 'cluster_simplification'
  | 'nasalization'
  | 'liquid_nasalization'
  | 'lateralization'
  | 'tensification'
  | 'aspiration'
  | 'h_deletion'
  | 'palatalization'
  | 'ui';

type Case = [text: string, expected: string, rule: Rule];

const CASES: Case[] = [
  // 연음: coda moves to an empty onset (double codas split, the second consonant moves)
  ['음악', '으막', 'liaison'],
  ['먹어', '머거', 'liaison'],
  ['한국어', '한구거', 'liaison'],
  ['밥을', '바블', 'liaison'],
  ['옷이', '오시', 'liaison'],
  ['꽃이', '꼬치', 'liaison'],
  ['빛이', '비치', 'liaison'],
  ['앞에', '아페', 'liaison'],
  ['밖에', '바께', 'liaison'],
  ['낮에', '나제', 'liaison'],
  ['부엌에', '부어케', 'liaison'],
  ['닭이', '달기', 'liaison'],
  ['닭을', '달글', 'liaison'],
  ['흙이', '흘기', 'liaison'],
  ['읽어', '일거', 'liaison'],
  ['앉아', '안자', 'liaison'],
  ['값이', '갑씨', 'liaison'],
  ['값을', '갑쓸', 'liaison'],
  ['없어', '업써', 'liaison'],
  ['삶이', '살미', 'liaison'],
  ['젊은', '절믄', 'liaison'],
  ['넓이', '널비', 'liaison'],
  ['읊어', '을퍼', 'liaison'],

  // 7종성 중화: ㄱㄴㄷㄹㅁㅂㅇ only
  ['부엌', '부억', 'coda_neutralization'],
  ['밖', '박', 'coda_neutralization'],
  ['옷', '옫', 'coda_neutralization'],
  ['낮', '낟', 'coda_neutralization'],
  ['꽃', '꼳', 'coda_neutralization'],
  ['빛', '빋', 'coda_neutralization'],
  ['앞', '압', 'coda_neutralization'],
  ['잎', '입', 'coda_neutralization'],

  // 자음군 단순화
  ['닭', '닥', 'cluster_simplification'],
  ['흙', '흑', 'cluster_simplification'],
  ['몫', '목', 'cluster_simplification'],
  ['값', '갑', 'cluster_simplification'],
  ['삶', '삼', 'cluster_simplification'],
  ['여덟', '여덜', 'cluster_simplification'],
  ['앉다', '안따', 'cluster_simplification'],
  ['넓다', '널따', 'cluster_simplification'],
  ['얇다', '얄따', 'cluster_simplification'],
  ['핥다', '할따', 'cluster_simplification'],
  ['읽다', '익따', 'cluster_simplification'],
  ['읊다', '읍따', 'cluster_simplification'],
  ['없다', '업따', 'cluster_simplification'],
  ['닭장', '닥짱', 'cluster_simplification'],

  // 비음화: obstruent coda + ㄴ/ㅁ
  ['국물', '궁물', 'nasalization'],
  ['부엌문', '부엉문', 'nasalization'],
  ['먹는', '멍는', 'nasalization'],
  ['읽는', '잉는', 'nasalization'],
  ['작년', '장년', 'nasalization'],
  ['밥물', '밤물', 'nasalization'],
  ['입는', '임는', 'nasalization'],
  ['십만', '심만', 'nasalization'],
  ['합니다', '함니다', 'nasalization'],
  ['값만', '감만', 'nasalization'],
  ['닫는', '단는', 'nasalization'],
  ['믿는', '민는', 'nasalization'],
  ['있는', '인는', 'nasalization'],
  ['갔는데', '간는데', 'nasalization'],
  ['꽃말', '꼰말', 'nasalization'],
  ['낱말', '난말', 'nasalization'],
  ['앞마당', '암마당', 'nasalization'],
  ['놓는', '논는', 'nasalization'],
  ['좋네요', '존네요', 'nasalization'],

  // ㄹ 비음화: ㄹ after a non-ㄹ coda becomes ㄴ (then the coda nasalizes if obstruent)
  ['심리', '심니', 'liquid_nasalization'],
  ['정리', '정니', 'liquid_nasalization'],
  ['종로', '종노', 'liquid_nasalization'],
  ['항로', '항노', 'liquid_nasalization'],
  ['담력', '담녁', 'liquid_nasalization'],
  ['음력', '음녁', 'liquid_nasalization'],
  ['침략', '침냑', 'liquid_nasalization'],
  ['대통령', '대통녕', 'liquid_nasalization'],
  ['협력', '혐녁', 'liquid_nasalization'],
  ['십리', '심니', 'liquid_nasalization'],
  ['백로', '뱅노', 'liquid_nasalization'],
  ['막론', '망논', 'liquid_nasalization'],

  // 유음화: ㄴ+ㄹ and ㄹ+ㄴ become ㄹㄹ
  ['신라', '실라', 'lateralization'],
  ['칼날', '칼랄', 'lateralization'],
  ['난로', '날로', 'lateralization'],
  ['설날', '설랄', 'lateralization'],
  ['달님', '달림', 'lateralization'],
  ['실내', '실래', 'lateralization'],
  ['천리', '철리', 'lateralization'],
  ['논리', '놀리', 'lateralization'],
  ['관련', '괄련', 'lateralization'],
  ['연락', '열락', 'lateralization'],
  ['편리', '펼리', 'lateralization'],
  ['닳는', '달른', 'lateralization'],
  ['뚫네', '뚤레', 'lateralization'],

  // 경음화: ㄱㄷㅂㅅㅈ become tense after an obstruent coda
  ['학교', '학꾜', 'tensification'],
  ['학생', '학쌩', 'tensification'],
  ['약국', '약꾹', 'tensification'],
  ['책상', '책쌍', 'tensification'],
  ['식당', '식땅', 'tensification'],
  ['국밥', '국빱', 'tensification'],
  ['국수', '국쑤', 'tensification'],
  ['부엌과', '부억꽈', 'tensification'],
  ['옷장', '옫짱', 'tensification'],
  ['낮잠', '낟짬', 'tensification'],
  ['꽃다발', '꼳따발', 'tensification'],
  ['있다', '읻따', 'tensification'],
  ['값도', '갑또', 'tensification'],
  ['먹다', '먹따', 'tensification'],
  ['듣다', '듣따', 'tensification'],
  ['믿고', '믿꼬', 'tensification'],
  ['입술', '입쑬', 'tensification'],
  ['접시', '접씨', 'tensification'],
  ['합격', '합껵', 'tensification'],
  ['갑자기', '갑짜기', 'tensification'],
  ['앞길', '압낄', 'tensification'],
  ['앞뒤', '압뛰', 'tensification'],

  // 격음화: ㅎ + ㄱㄷㅈ or obstruent + ㅎ merge into an aspirate
  ['좋고', '조코', 'aspiration'],
  ['좋다', '조타', 'aspiration'],
  ['좋지', '조치', 'aspiration'],
  ['놓다', '노타', 'aspiration'],
  ['닿다', '다타', 'aspiration'],
  ['낳고', '나코', 'aspiration'],
  ['싫다', '실타', 'aspiration'],
  ['앓다', '알타', 'aspiration'],
  ['많다', '만타', 'aspiration'],
  ['많고', '만코', 'aspiration'],
  ['축하', '추카', 'aspiration'],
  ['각하', '가카', 'aspiration'],
  ['입학', '이팍', 'aspiration'],
  ['급행', '그팽', 'aspiration'],
  ['맏형', '마텽', 'aspiration'],
  ['옷하고', '오타고', 'aspiration'],
  ['부엌하고', '부어카고', 'aspiration'],
  ['먹히다', '머키다', 'aspiration'],
  ['잡히다', '자피다', 'aspiration'],
  ['읽히다', '일키다', 'aspiration'],
  ['앉히다', '안치다', 'aspiration'],

  // ㅎ 탈락: ㅎ (incl. ㄶ ㅀ) before a vowel is silent
  ['좋아', '조아', 'h_deletion'],
  ['놓이다', '노이다', 'h_deletion'],
  ['쌓이다', '싸이다', 'h_deletion'],
  ['낳은', '나은', 'h_deletion'],
  ['닿아', '다아', 'h_deletion'],
  ['많아', '마나', 'h_deletion'],
  ['많이', '마니', 'h_deletion'],
  ['않은', '아는', 'h_deletion'],
  ['싫어', '시러', 'h_deletion'],
  ['옳은', '오른', 'h_deletion'],
  ['끓이다', '끄리다', 'h_deletion'],

  // 구개음화: ㄷ ㅌ (ㄾ) + 이/히 -> ㅈ ㅊ
  ['같이', '가치', 'palatalization'],
  ['굳이', '구지', 'palatalization'],
  ['곧이', '고지', 'palatalization'],
  ['해돋이', '해도지', 'palatalization'],
  ['미닫이', '미다지', 'palatalization'],
  ['밭이', '바치', 'palatalization'],
  ['솥이', '소치', 'palatalization'],
  ['끝이', '끄치', 'palatalization'],
  ['붙이다', '부치다', 'palatalization'],
  ['굳히다', '구치다', 'palatalization'],
  ['닫히다', '다치다', 'palatalization'],
  ['걷히다', '거치다', 'palatalization'],

  // ㅢ: stays 의 only as the first syllable; after a consonant onset it is 이
  ['의사', '의사', 'ui'],
  ['의자', '의자', 'ui'],
  ['의미', '의미', 'ui'],
  ['의견', '의견', 'ui'],
  ['희망', '히망', 'ui'],
  ['희다', '히다', 'ui'],
  ['흰색', '힌색', 'ui'],
  ['유희', '유히', 'ui'],
  ['무늬', '무니', 'ui'],
  ['띄어쓰기', '띠어쓰기', 'ui'],
  ['씌우다', '씨우다', 'ui'],
  ['틔우다', '티우다', 'ui'],

  // Whole phrases: spaces are kept, rules apply inside each word
  ['안녕하세요', '안녕하세요', 'liaison'],
  ['감사합니다', '감사함니다', 'nasalization'],
  ['국물이 맛있어요', '궁무리 마시써요', 'liaison'],
  ['학교에 갑니다', '학꾜에 감니다', 'tensification'],
  ['저는 학생입니다', '저는 학쌩임니다', 'tensification'],
  ['좋은 아침이에요', '조은 아치미에요', 'h_deletion'],
  ['같이 가요', '가치 가요', 'palatalization'],
  ['한국어를 배워요', '한구거를 배워요', 'liaison'],
  ['꽃이 피었어요', '꼬치 피어써요', 'liaison'],
  ['밥을 먹었어요', '바블 머거써요', 'liaison'],
  ['책을 읽어요', '채글 일거요', 'liaison'],
  ['오늘 날씨가 좋네요', '오늘 날씨가 존네요', 'nasalization'],
  ['많이 드세요', '마니 드세요', 'h_deletion'],
  ['희망이 있어요', '히망이 이써요', 'ui'],
];

for (const [text, expected, rule] of CASES) {
  test(`${rule}: ${text} -> ${expected}`, () => {
    assert.equal(pronounce(text), expected);
  });
}
