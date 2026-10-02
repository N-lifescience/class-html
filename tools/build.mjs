// engine/src/*.js 와 engine/css/*.css 를 이름 순서대로 이어 붙여 배포 파일 두 개를 만든다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.0-dev';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function concat(dir, ext) {
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => `/* ---- ${f} ---- */\n${readFileSync(join(root, dir, f), 'utf8').trim()}\n`)
    .join('\n');
}

const banner = `/*! class-html engine v${VERSION} | MIT | https://github.com/N-lifescience/class-html */`;
writeFileSync(join(root, 'engine/class-html.js'),
  `${banner}\n(function () {\n'use strict';\nconst VERSION = '${VERSION}';\n${concat('engine/src', '.js')}\n})();\n`);
writeFileSync(join(root, 'engine/class-html.css'), `${banner}\n${concat('engine/css', '.css')}`);
console.log(`built class-html v${VERSION}`);
