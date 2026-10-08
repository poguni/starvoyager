// 별빛 탐사선 - 구글 시트 제출용 Google Apps Script
// 이 코드는 결과를 받는 '시트'에 연결된 스크립트(확장 프로그램 > Apps Script)에 붙여넣는다.
// 보낸 데이터의 kind('미션' 또는 '도감')에 따라 같은 시트의 '미션' 탭 또는 '도감' 탭에 1행을 추가한다.

// 기획서 10-3 '미션' 탭 컬럼 순서
var MISSION_HEADERS = [
  '제출시각', '학년', '반', '번호', '이름', '탐사', '문항',
  '처음 예측', '예측 정답 여부', '최종 답', '최종 정답 여부',
  '한 줄 정리', '한 줄 정리 정답 여부', '소요 시간(초)', '메모'
];

// 기획서 10-4 '도감' 탭 컬럼 순서
var JOURNAL_HEADERS = [
  '제출시각', '학년', '반', '번호', '이름', '행성',
  '색깔(처음)', '색깔(최종)', '색깔 정답',
  '표면(처음)', '표면(최종)', '표면 정답',
  '고리(처음)', '고리(최종)', '고리 정답',
  '그 밖의 특징(최종)', '특징 정답', '착륙 시도 여부', '소요 시간(초)'
];

// 기획서 10-3 문항 값. 흥미 체크는 흥미1~흥미5(docs/결정기록.md 2026-10-07)
var ALLOWED_ITEMS = [
  '1-1', '1-2', '1-3', '1-4',
  '2-1', '2-2', '2-3',
  '3-1', '3-2', '3-3', '3-4',
  '4-1', '4-2', '4-3', '4-4', '4-5', '4-6',
  'C-1', 'C-2',
  '흥미1', '흥미2', '흥미3', '흥미4', '흥미5'
];
var ALLOWED_PLANETS = ['수성', '금성', '지구', '화성', '목성', '토성', '천왕성', '해왕성'];
var ALLOWED_OX = ['', 'O', 'X'];
var ALLOWED_YN = ['', '예', '아니요'];
var MAX_TEXT = 200;

function doGet() {
  // 시트 내용은 절대 돌려주지 않는다.
  return ContentService.createTextOutput('정상 작동 중');
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: '보낸 내용을 읽을 수 없어요.' });
  }

  var check = validate_(data);
  if (!check.ok) {
    return jsonOut_({ ok: false, error: check.error });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonOut_({ ok: false, error: '지금 제출이 몰려 있어요. 잠시 뒤에 다시 눌러 주세요.' });
  }
  try {
    var v = check.value;
    var sheet = v.kind === '도감' ? getSheet_('도감', JOURNAL_HEADERS) : getSheet_('미션', MISSION_HEADERS);
    sheet.appendRow(v.kind === '도감' ? toJournalRow_(v) : toMissionRow_(v));
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: '시트에 기록하지 못했어요.' });
  } finally {
    lock.releaseLock();
  }
}

// 탭이 없으면 만들고, 비어 있으면 머리글을 넣는다.
function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// 입력 검증. 통과하면 {ok:true, value:정리된 값}, 실패하면 {ok:false, error}
function validate_(d) {
  if (!d || typeof d !== 'object') {
    return fail_('보낸 내용을 읽을 수 없어요.');
  }

  var student = validateStudent_(d);
  if (!student.ok) return student;

  var seconds = secondsField_(d.seconds);
  if (seconds === null) return fail_('소요 시간이 올바르지 않아요.');

  if (d.kind === '미션') return validateMission_(d, student.value, seconds);
  if (d.kind === '도감') return validateJournal_(d, student.value, seconds);
  return fail_('알 수 없는 종류예요.');
}

// 학년·반·번호·이름. src/student/studentInfo.js의 validateStudentInfo와 같은 규칙이어야 한다.
function validateStudent_(d) {
  var grade = intInRange_(d.grade, 1, 6);
  if (grade === null) return fail_('학년은 1~6 숫자로 적어 주세요.');

  var cls = intInRange_(d.class, 1, 20);
  if (cls === null) return fail_('반은 1~20 숫자로 적어 주세요.');

  var num = intInRange_(d.number, 1, 40);
  if (num === null) return fail_('번호는 1~40 숫자로 적어 주세요.');

  var name = typeof d.name === 'string' ? d.name.trim() : '';
  if (name.length < 1 || name.length > 10) return fail_('이름은 1~10글자로 적어 주세요.');

  return { ok: true, value: { grade: grade, cls: cls, num: num, name: name } };
}

function validateMission_(d, s, seconds) {
  var mission = intInRange_(d.mission, 1, 4);
  if (mission === null) return fail_('탐사는 1~4 숫자여야 해요.');

  var item = typeof d.item === 'string' ? d.item : '';
  if (ALLOWED_ITEMS.indexOf(item) === -1) return fail_('알 수 없는 문항이에요.');

  var predicted = textField_(d.predicted);
  var predictedCorrect = oxField_(d.predictedCorrect);
  var finalAnswer = textField_(d.finalAnswer);
  var finalCorrect = oxField_(d.finalCorrect);
  var summary = textField_(d.summary);
  var summaryCorrect = oxField_(d.summaryCorrect);
  var memo = textField_(d.memo);

  if ([predicted, finalAnswer, summary, memo].indexOf(null) !== -1) {
    return fail_('글이 너무 길어요.');
  }
  if ([predictedCorrect, finalCorrect, summaryCorrect].indexOf(null) !== -1) {
    return fail_('정답 여부는 O 또는 X로 보내야 해요.');
  }

  return {
    ok: true,
    value: {
      kind: '미션', grade: s.grade, cls: s.cls, num: s.num, name: s.name,
      mission: mission, item: item,
      predicted: predicted, predictedCorrect: predictedCorrect,
      finalAnswer: finalAnswer, finalCorrect: finalCorrect,
      summary: summary, summaryCorrect: summaryCorrect,
      seconds: seconds, memo: memo
    }
  };
}

function validateJournal_(d, s, seconds) {
  var planet = typeof d.planet === 'string' ? d.planet : '';
  if (ALLOWED_PLANETS.indexOf(planet) === -1) return fail_('알 수 없는 행성이에요.');

  var texts = [
    textField_(d.colorFirst), textField_(d.colorFinal),
    textField_(d.surfaceFirst), textField_(d.surfaceFinal),
    textField_(d.ringFirst), textField_(d.ringFinal),
    textField_(d.featuresFinal)
  ];
  if (texts.indexOf(null) !== -1) return fail_('글이 너무 길어요.');

  var oxs = [oxField_(d.colorCorrect), oxField_(d.surfaceCorrect), oxField_(d.ringCorrect), oxField_(d.featuresCorrect)];
  if (oxs.indexOf(null) !== -1) return fail_('정답 여부는 O 또는 X로 보내야 해요.');

  var landingTried = ynField_(d.landingTried);
  if (landingTried === null) return fail_('착륙 시도 여부는 예 또는 아니요로 보내야 해요.');

  return {
    ok: true,
    value: {
      kind: '도감', grade: s.grade, cls: s.cls, num: s.num, name: s.name,
      planet: planet,
      colorFirst: texts[0], colorFinal: texts[1], colorCorrect: oxs[0],
      surfaceFirst: texts[2], surfaceFinal: texts[3], surfaceCorrect: oxs[1],
      ringFirst: texts[4], ringFinal: texts[5], ringCorrect: oxs[2],
      featuresFinal: texts[6], featuresCorrect: oxs[3],
      landingTried: landingTried, seconds: seconds
    }
  };
}

function toMissionRow_(v) {
  return [
    new Date(), v.grade, v.cls, v.num, safeCell_(v.name), v.mission, v.item,
    safeCell_(v.predicted), v.predictedCorrect, safeCell_(v.finalAnswer), v.finalCorrect,
    safeCell_(v.summary), v.summaryCorrect, v.seconds, safeCell_(v.memo)
  ];
}

function toJournalRow_(v) {
  return [
    new Date(), v.grade, v.cls, v.num, safeCell_(v.name), v.planet,
    safeCell_(v.colorFirst), safeCell_(v.colorFinal), v.colorCorrect,
    safeCell_(v.surfaceFirst), safeCell_(v.surfaceFinal), v.surfaceCorrect,
    safeCell_(v.ringFirst), safeCell_(v.ringFinal), v.ringCorrect,
    safeCell_(v.featuresFinal), v.featuresCorrect, v.landingTried, v.seconds
  ];
}

function fail_(msg) {
  return { ok: false, error: msg };
}

function intInRange_(x, min, max) {
  var n = (typeof x === 'string' && /^\d+$/.test(x.trim())) ? Number(x.trim()) : x;
  if (typeof n !== 'number' || n % 1 !== 0 || n < min || n > max) return null;
  return n;
}

// 비어 있으면 '', 0~7200초 숫자면 반올림한 값, 그 밖에는 null
function secondsField_(x) {
  if (x === undefined || x === null || x === '') return '';
  if (typeof x !== 'number' || !isFinite(x) || x < 0 || x > 7200) return null;
  return Math.round(x);
}

// 비어 있으면 '', 문자열이 아니거나 너무 길면 null
function textField_(x) {
  if (x === undefined || x === null) return '';
  if (typeof x !== 'string') return null;
  var t = x.trim();
  return t.length > MAX_TEXT ? null : t;
}

function oxField_(x) {
  if (x === undefined || x === null) return '';
  if (typeof x === 'boolean') return x ? 'O' : 'X';
  if (typeof x !== 'string' || ALLOWED_OX.indexOf(x) === -1) return null;
  return x;
}

function ynField_(x) {
  if (x === undefined || x === null) return '';
  if (typeof x === 'boolean') return x ? '예' : '아니요';
  if (typeof x !== 'string' || ALLOWED_YN.indexOf(x) === -1) return null;
  return x;
}

// 시트가 수식으로 해석하지 못하도록 =, +, -, @로 시작하면 앞에 작은따옴표를 붙인다.
function safeCell_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
