// 결과를 구글 시트(Apps Script 웹앱)로 보낸다(기획서 10장). 실패하면 대기열에 남겨 두었다가 다시 보낸다.
// 결과 행은 두 종류다: '미션'(기획서 10-3) → 미션 탭, '도감'(기획서 10-4) → 도감 탭.
// 이름 등 학생 정보는 시트로 보내는 것 말고는(콘솔 로그·오류 메시지 등) 어디에도 남기지 않는다.
const WEBAPP_URL = import.meta.env.VITE_WEBAPP_URL ?? '';
const QUEUE_KEY = 'starvoyager:submitQueue';

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(list) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    // 저장이 막혀 있어도 이번 세션의 메모리 대기열은 그대로 유지된다.
  }
}

let memoryQueue = readQueue();
const listeners = new Set();
function notify() { listeners.forEach((fn) => fn(memoryQueue.length)); }

// 값이 없으면 빈 문자열로, 숫자(예: 찾은 개수)면 문자열로 바꾼다.
// Code.gs의 글자 칸 검사(textField_)가 문자열만 받기 때문이다.
function textOrEmpty(v) {
  return v === null || v === undefined ? '' : String(v);
}

// 여러 개 고른 값(그 밖의 특징)은 ', '로 이어 한 칸에 기록한다.
function listText(v) {
  return Array.isArray(v) ? v.join(', ') : textOrEmpty(v);
}

function studentFields(student) {
  return { grade: student.grade, class: student.cls, number: student.number, name: student.name };
}

// 결과 한 행을 제출 payload로 바꾼다. row.종류가 '도감'이면 도감 탭, 그 밖에는 미션 탭.
export function buildPayload(student, row) {
  if (row.종류 === '도감') {
    return {
      kind: '도감',
      ...studentFields(student),
      planet: row.행성,
      colorFirst: textOrEmpty(row.색깔처음), colorFinal: textOrEmpty(row.색깔최종), colorCorrect: row.색깔정답,
      surfaceFirst: textOrEmpty(row.표면처음), surfaceFinal: textOrEmpty(row.표면최종), surfaceCorrect: row.표면정답,
      ringFirst: textOrEmpty(row.고리처음), ringFinal: textOrEmpty(row.고리최종), ringCorrect: row.고리정답,
      featuresFinal: listText(row.특징최종), featuresCorrect: row.특징정답,
      landingTried: row.착륙시도여부,
      seconds: row.소요시간
    };
  }
  return {
    kind: '미션',
    ...studentFields(student),
    mission: row.탐사,
    item: row.문항,
    predicted: textOrEmpty(row.처음예측),
    predictedCorrect: row.예측정답여부,
    finalAnswer: textOrEmpty(row.최종답),
    finalCorrect: row.최종정답여부,
    summary: textOrEmpty(row.한줄정리),
    summaryCorrect: row.한줄정리정답여부,
    seconds: row.소요시간,
    memo: textOrEmpty(row.메모)
  };
}

async function post(payload) {
  if (!WEBAPP_URL) return { ok: false, error: '웹앱 주소가 설정되지 않았어요.' };
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 사전 요청(preflight) 없이 보내기 위함
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  return JSON.parse(text); // 형식이 다르면(예: 로그인 화면 HTML) 여기서 예외가 나고 실패로 처리된다.
}

// 결과 한 행을 바로 보내 본다. 성공하면 true, 실패하면 대기열에 넣고 false를 돌려준다.
export async function trySubmit(student, row) {
  const payload = buildPayload(student, row);
  try {
    const data = await post(payload);
    if (data.ok) return true;
  } catch {
    // 네트워크 오류 등 — 아래에서 대기열에 넣는다.
  }
  memoryQueue = [...memoryQueue, payload];
  writeQueue(memoryQueue);
  notify();
  return false;
}

// 대기열에 남은 항목을 다시 보낸다. 성공한 항목만 대기열에서 지운다.
export async function flushQueue() {
  if (memoryQueue.length === 0) return;
  const remaining = [];
  for (const payload of memoryQueue) {
    try {
      const data = await post(payload);
      if (!data.ok) remaining.push(payload);
    } catch {
      remaining.push(payload);
    }
  }
  memoryQueue = remaining;
  writeQueue(memoryQueue);
  notify();
}

export function queueSize() { return memoryQueue.length; }
export function onQueueChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue(); });
}
