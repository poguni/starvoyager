// 탐사 도감 상태(기획서 8장). DOM과 분리한 순수 모듈.
//   행성 카드: 아직(todo) → 작성 중(editing) → 기록하기 → 판정
//     · 모두 맞으면 완성(done)
//     · 틀린 칸이 있으면 다시 고치기(retry): 맞은 칸은 잠기고 틀린 칸만 고칠 수 있다(1번)
//     · 고친 뒤에도 틀리면 교과서 정답으로 완성(revealed에 바꿔 적은 칸)
//   '그 밖의 특징'은 틀린 특징을 하나도 고르지 않았으면 정답이다.
//   카드가 완성되면 기획서 10-4 '도감' 탭 한 행을 onComplete로 내보낸다.
//   완성 카드에는 탐사 2 창작 C-1의 행성 랩(네 줄)이 붙을 수 있다(rap, 마지막에 만든 것).
//   태양 카드: 태양을 가까이 보고(sunExplored) 탐사 1 한 줄 정리(sunSummary)를 마치면 채워진다.
import { PLANETS, bodyById } from './world.js';
import { ANSWERS, FIELDS } from '../data/planetFacts.js';

export const PLANET_IDS = PLANETS.map((p) => p.id);
const SINGLE = ['color', 'surface', 'ring'];

const emptyPicks = () => ({ color: null, surface: null, ring: null, features: [] });
const freshCard = () => ({ status: 'todo', picks: emptyPicks(), first: null, wrongPicks: null, revealed: [], order: null, seconds: 0, rap: null });
const copyPicks = (p) => ({ ...p, features: [...p.features] });

// 칸 하나가 맞았는지
export function isFieldCorrect(planetId, field, value) {
  const answer = ANSWERS[planetId];
  if (field === 'features') return value.every((f) => answer.features.includes(f));
  return value === answer[field];
}

function judge(planetId, picks) {
  return FIELDS.map((f) => f.id).filter((id) => !isFieldCorrect(planetId, id, picks[id]));
}

const OPTION_SET = Object.fromEntries(FIELDS.map((f) => [f.id, new Set(f.options)]));

// 저장된 값을 믿지 않고 모양을 확인해 되살린다.
function restoreCard(saved) {
  const card = freshCard();
  if (!saved || typeof saved !== 'object') return card;
  const pickOk = (p) => p && typeof p === 'object'
    && SINGLE.every((k) => p[k] === null || OPTION_SET[k].has(p[k]))
    && Array.isArray(p.features) && p.features.every((f) => OPTION_SET.features.has(f));
  if (!['todo', 'editing', 'retry', 'done'].includes(saved.status) || !pickOk(saved.picks)) return card;
  card.status = saved.status;
  card.picks = copyPicks(saved.picks);
  card.first = pickOk(saved.first) ? copyPicks(saved.first) : null;
  card.wrongPicks = saved.wrongPicks && typeof saved.wrongPicks === 'object' ? saved.wrongPicks : null;
  card.revealed = Array.isArray(saved.revealed) ? saved.revealed.filter((f) => FIELDS.some((x) => x.id === f)) : [];
  card.order = Number.isInteger(saved.order) ? saved.order : null;
  card.seconds = Number.isFinite(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0;
  card.rap = Array.isArray(saved.rap) && saved.rap.length > 0 && saved.rap.every((t) => typeof t === 'string') ? [...saved.rap] : null;
  if (card.status === 'done' && card.order === null) card.status = 'editing';
  if (card.status === 'retry' && (!card.first || !card.wrongPicks)) card.status = 'editing';
  return card;
}

export function createJournal({ initial = {}, hasLanded = () => false, onComplete = () => {} } = {}) {
  const cards = Object.fromEntries(PLANET_IDS.map((id) => [id, restoreCard(initial.cards?.[id])]));
  const sun = { explored: initial.sun?.explored === true, summary: typeof initial.sun?.summary === 'string' ? initial.sun.summary : null };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());

  const doneCount = () => PLANET_IDS.filter((id) => cards[id].status === 'done').length;

  // 지금 고를 수 있는 칸인지(완성 카드는 잠김, 다시 고치기에서는 틀린 칸만)
  function canEdit(id, field) {
    const card = cards[id];
    if (card.status === 'done') return false;
    if (card.status === 'retry') return field in card.wrongPicks;
    return true;
  }

  function complete(id, card, revealed) {
    card.status = 'done';
    card.revealed = revealed;
    card.order = doneCount(); // 이 카드를 포함한 완성 개수 = 완성 순서
    onComplete(resultRow(id));
  }

  // 기획서 10-4 '도감' 탭 한 행(submitQueue.buildPayload가 받는 모양)
  function resultRow(id) {
    const card = cards[id];
    const final = card.picks;
    const first = card.first ?? final;
    return {
      종류: '도감',
      행성: bodyById(id).name,
      색깔처음: first.color, 색깔최종: final.color, 색깔정답: isFieldCorrect(id, 'color', final.color),
      표면처음: first.surface, 표면최종: final.surface, 표면정답: isFieldCorrect(id, 'surface', final.surface),
      고리처음: first.ring, 고리최종: final.ring, 고리정답: isFieldCorrect(id, 'ring', final.ring),
      특징최종: [...final.features], 특징정답: isFieldCorrect(id, 'features', final.features),
      착륙시도여부: hasLanded(id),
      소요시간: Math.round(card.seconds)
    };
  }

  return {
    // 화면에 보여 줄 카드 정보(복사본)
    getCard(id) {
      const card = cards[id];
      return { ...card, picks: copyPicks(card.picks), first: card.first && copyPicks(card.first), revealed: [...card.revealed], rap: card.rap && [...card.rap] };
    },
    // 완성 카드에 적히는 값: 고른 값, 정답을 공개한 칸은 교과서 정답
    recordOf(id) {
      const card = cards[id];
      const answer = ANSWERS[id];
      const out = copyPicks(card.picks);
      for (const f of card.revealed) out[f] = f === 'features' ? [...answer.features] : answer[f];
      return out;
    },
    canEdit,
    // 칸 고르기: 하나 고르기 칸은 바꾸고, 그 밖의 특징은 넣었다 뺐다 한다.
    pick(id, field, value) {
      if (!canEdit(id, field) || !OPTION_SET[field]?.has(value)) return false;
      const card = cards[id];
      if (field === 'features') {
        const i = card.picks.features.indexOf(value);
        if (i >= 0) card.picks.features.splice(i, 1);
        else card.picks.features.push(value);
      } else {
        card.picks[field] = value;
      }
      if (card.status === 'todo') card.status = 'editing';
      emit();
      return true;
    },
    // 기록하기를 누를 수 있는지: 하나 고르기 세 칸을 모두 골랐을 때
    canSubmit: (id) => cards[id].status !== 'done' && SINGLE.every((k) => cards[id].picks[k] !== null),
    // 판정. 'done' | 'retry' | 'revealed' | null(누를 수 없음)
    submit(id) {
      const card = cards[id];
      if (!this.canSubmit(id)) return null;
      const wrong = judge(id, card.picks);
      let result;
      if (card.status !== 'retry') {
        card.first = copyPicks(card.picks);
        if (wrong.length === 0) { complete(id, card, []); result = 'done'; }
        else {
          card.status = 'retry';
          // 틀린 칸에서 고른 값(화면에서 그 보기에 '다시 봐요'를 붙인다)
          card.wrongPicks = Object.fromEntries(wrong.map((f) => [f, f === 'features'
            ? card.picks.features.filter((x) => !ANSWERS[id].features.includes(x))
            : card.picks[f]]));
          result = 'retry';
        }
      } else {
        complete(id, card, wrong);
        result = wrong.length === 0 ? 'done' : 'revealed';
      }
      emit();
      return result;
    },
    // 카드가 펼쳐져 있던 시간을 더한다(완성 전까지).
    addTime(id, seconds) {
      const card = cards[id];
      if (card.status !== 'done' && seconds > 0) card.seconds += seconds;
    },
    count: doneCount,
    doneIds: () => PLANET_IDS.filter((id) => cards[id].status === 'done'),
    // 행성 랩(완성 카드에만)
    setRap(id, lines) {
      if (cards[id]?.status !== 'done') return;
      cards[id].rap = [...lines];
      emit();
    },
    total: PLANET_IDS.length,
    resultRow,

    // 태양 카드
    markSunExplored() { if (!sun.explored) { sun.explored = true; emit(); } },
    setSunSummary(text) { sun.summary = text; emit(); },
    getSun: () => ({ ...sun, done: sun.explored && sun.summary !== null }),

    serialize: () => ({ cards: JSON.parse(JSON.stringify(cards)), sun: { ...sun } }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
