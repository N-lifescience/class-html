// bundle.py: 옆의 그림을 data URI로, --offline이면 엔진도 넣는다. 파이썬이 없으면 건너뛴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noisyPng, png } from '../fixtures/mini-pptx.mjs';

const script = fileURLToPath(new URL('../../skills/class-html/scripts/bundle.py', import.meta.url));
const engine = fileURLToPath(new URL('../../engine/', import.meta.url));
const python = ['python3', 'python', 'py'].find((p) => spawnSync(p, ['--version']).status === 0);

test('bundle.py: 그림 넣기, 엔진 넣기, 큰 그림 줄이기 또는 알림', { skip: !python && '파이썬 없음' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'class-html-bundle-'));
  try {
    mkdirSync(join(dir, 'media'));
    writeFileSync(join(dir, 'media', '1-1.png'), png(40, 30, [215, 38, 61]));
    writeFileSync(join(dir, 'media', 'big.png'), png(2400, 300, [31, 111, 209]));
    writeFileSync(join(dir, 'media', 'photo.png'), noisyPng(400, 300));   // 약 360KB, 투명 없음
    writeFileSync(join(dir, 'lesson.html'), `<!doctype html><html><head>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/N-lifescience/class-html@1/engine/class-html.css">
<script defer src="https://cdn.jsdelivr.net/gh/N-lifescience/class-html@1/engine/class-html.js"></script>
</head><body><section class="slide"><img src="media/1-1.png" alt="빨강"><img alt="큰" src='media/big.png'><img src="data:image/png;base64,AAAA" alt="그대로"><img src="media/없음.png" alt="없음"><img src="media/photo.png" alt="사진"></section></body></html>`);
    const log = execFileSync(python, [script, join(dir, 'lesson.html'), '--offline', '--engine', engine], { encoding: 'utf8' });
    const out = readFileSync(join(dir, 'lesson-한파일.html'), 'utf8');
    assert.match(out, /<img src="data:image\/png;base64,[A-Za-z0-9+/=]{40,}" alt="빨강">/);
    assert.match(out, /<img alt="큰" src='data:image\/png;base64,/);
    assert.match(out, /src="data:image\/png;base64,AAAA"/);
    assert.match(out, /src="media\/없음.png"/);
    assert.match(log, /그림 파일이 없어요: media\/없음.png/);
    assert.match(out, /<style>\n\/\*! class-html engine/);
    assert.match(out, /<script>\n\/\*! class-html engine/);
    assert.ok(!/<\/script>[\s\S]*<\/script>[\s\S]*<\/script>/.test(out.split('<body>')[0]), 'no premature </script>');
    // 큰 그림은 sips·Pillow가 있으면 1600px로 줄고, 없으면 알린다
    const big = /alt="큰" src='data:image\/png;base64,([^']+)'/.exec(out)[1];
    const w = Buffer.from(big, 'base64').readUInt32BE(16);
    assert.ok(w === 1600 || /줄이지 못했어요/.test(log), `width ${w}`);
    // 큰 불투명 PNG는 JPEG로(도구가 있을 때), 없으면 알린다
    assert.ok(/<img src="data:image\/jpeg;base64,[^"]+" alt="사진">/.test(out) || /JPEG로 바꾸지 못했어요/.test(log), 'photo png → jpeg');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
