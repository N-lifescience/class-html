// 브라우저 시험이 file://에서 읽을 수 있도록 시험용 PPTX를 base64 스크립트로 쓴다: node tests/fixtures/make-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { buildMiniPptx } from './mini-pptx.mjs';

const b64 = buildMiniPptx().toString('base64');
writeFileSync(new URL('./mini-pptx.js', import.meta.url), `// 자동 생성: node tests/fixtures/make-fixtures.mjs (손으로 고치지 않는다)\nwindow.MINI_PPTX_B64 = '${b64}';\n`);
console.log(`mini-pptx.js ${b64.length} chars`);
