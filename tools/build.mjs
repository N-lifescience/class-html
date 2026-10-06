// engine/src/*.js 와 engine/css/*.css 를 이름 순서대로 이어 붙여 배포 파일 두 개를 만든다.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.1.0';
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

// 채팅 AI용 합본 지침: 스킬 문서와 references를 파일 하나로 잇는다(주소 하나만 주면 되게).
const skill = join(root, 'skills/class-html');
const read = (rel) => readFileSync(join(skill, rel), 'utf8').replace(/^---[\s\S]*?---\n/, '').trim();
const demote = (md) => md.replace(/^# .*\n+/, '').replace(/^(#+) /gm, '#$1 ');   // 맨 위 제목은 절 제목이 대신하고, 나머지는 한 단계 아래로
const title = (rel) => (/^# (.+)$/m.exec(read(rel)) || [, rel])[1];
const parts = [
  ['절차와 기준', 'SKILL.md'],
  ['만지는 도해', 'references/dohae.md'],
  ['화면과 원본 모양', 'references/design.md'],
  ['부품 사전', 'references/components.md'],
  ['한국어 문장', 'references/korean.md'],
];
// 레퍼런스 완성본(HTML)은 합본에 넣지 않고 주소로 알린다
const EXAMPLES = 'https://cdn.jsdelivr.net/gh/N-lifescience/class-html@1/skills/class-html/references/examples/';
const examples = readdirSync(join(skill, 'references/examples')).filter((f) => f.endsWith('.html')).sort();
const guide = [
  '# class-html 합본 지침',
  '',
  '> **AI에게**: 이 파일 하나가 「수업 HTML」 지침 전체다. 선생님이 수업 PPT를 주면 이 지침대로 수업용 HTML을 만든다.',
  '> 본문의 `references/…`는 이 파일의 해당 절을, `scripts/…`는 저장소 https://github.com/N-lifescience/class-html 의 `skills/class-html/scripts/`를 가리킨다.',
  `> 엔진: \`https://cdn.jsdelivr.net/gh/N-lifescience/class-html@1/engine/class-html.css\`·\`.js\` (v${VERSION})`,
  `> 레퍼런스 완성본(\`references/examples/\`): ${examples.map((f) => `${EXAMPLES}${f}`).join(' · ')}`,
  '',
  '## 차례',
  '',
  ...parts.map(([title], i) => `${i + 1}. ${title}`),
  '',
  ...parts.flatMap(([title, file], i) => ['---', '', `## ${i + 1}. ${title}`, '', demote(read(file)), '']),
].join('\n');
mkdirSync(join(root, 'guide'), { recursive: true });
writeFileSync(join(root, 'guide/class-html-guide.md'), `<!-- 자동 생성: node tools/build.mjs (손으로 고치지 않는다) -->\n${guide}`);
console.log(`guide ${guide.length} chars`);
