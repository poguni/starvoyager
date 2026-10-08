#!/usr/bin/env node
// 배포 주소를 QR 코드 PNG로 만든다(기획서 14장 10단계).
//
// 사용법:
//   npm run qr                                        # 기본 주소 → qr/starvoyager-qr.png
//   npm run qr -- [주소] [출력파일]                   # 주소·파일 직접 지정
//   npm run qr -- "https://poguni.github.io/starvoyager/?mission=2" qr/4-3반.png
//   npm run qr:all                                    # 기본 주소 + 차시별(?mission=1~4) QR 5장을 한 번에
import QRCode from 'qrcode';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_URL = 'https://poguni.github.io/starvoyager/';

async function makeQr(url, outPath) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await QRCode.toFile(outPath, url, {
    type: 'png',
    width: 1200, // 인쇄해도 선명하도록 크게 만든다
    margin: 2,
    errorCorrectionLevel: 'M'
  });
  console.log(`QR 코드를 만들었어요: ${outPath}  (${url})`);
}

if (process.argv[2] === '--all') {
  await makeQr(DEFAULT_URL, 'qr/starvoyager-qr.png');
  for (const n of [1, 2, 3, 4]) await makeQr(`${DEFAULT_URL}?mission=${n}`, `qr/mission-${n}.png`);
} else {
  await makeQr(process.argv[2] ?? DEFAULT_URL, process.argv[3] ?? 'qr/starvoyager-qr.png');
}
