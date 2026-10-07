#!/usr/bin/env node
// 배포 주소를 QR 코드 PNG로 만든다(기획서 14장 10단계).
// 학급마다 다른 시작 상태(예: ?mission=2)로 QR을 새로 만들고 싶으면 주소만 바꿔 다시 실행한다.
//
// 사용법:
//   node scripts/make-qr.mjs [주소] [출력파일]
//   npm run qr -- "https://poguni.github.io/starvoyager/?mission=2" qr/4-3반.png
import QRCode from 'qrcode';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_URL = 'https://poguni.github.io/starvoyager/';

const url = process.argv[2] ?? DEFAULT_URL;
const outPath = process.argv[3] ?? 'qr/starvoyager-qr.png';

await mkdir(path.dirname(outPath), { recursive: true });
await QRCode.toFile(outPath, url, {
  type: 'png',
  width: 1200, // 인쇄해도 선명하도록 크게 만든다
  margin: 2,
  errorCorrectionLevel: 'M'
});

console.log(`QR 코드를 만들었어요: ${outPath}`);
console.log(`주소: ${url}`);
