import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './load.mjs';
import { buildMiniPptx, files, png } from '../fixtures/mini-pptx.mjs';

const { Zip } = load(['00-core.js', '60-zip.js'], ['Zip'], { TextDecoder, DecompressionStream, Blob, Response });
const bytes = buildMiniPptx();
const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

test('목차를 읽는다: 이름, 압축 방식, 크기', () => {
  const e = Zip.entries(buf);
  assert.equal(e.size, files().length);
  assert.equal(e.get('ppt/media/image1.png').method, 0);
  assert.equal(e.get('ppt/media/image2.png').method, 8);
  assert.ok(e.get('ppt/media/image2.png').csize < e.get('ppt/media/image2.png').size);
});

test('저장 방식(0)과 deflate(8) 항목을 원래 바이트로 푼다', async () => {
  const e = Zip.entries(buf);
  assert.deepEqual(Buffer.from(await Zip.read(buf, e.get('ppt/media/image1.png'))), png(40, 30, [215, 38, 61]));
  assert.deepEqual(Buffer.from(await Zip.read(buf, e.get('ppt/media/image2.png'))), png(2400, 300, [31, 111, 209]));
  assert.match(await Zip.text(buf, e.get('ppt/presentation.xml')), /sldIdLst/);
  assert.match(await Zip.text(buf, e.get('ppt/slides/slide2.xml')), /제목/);
});

test('zip이 아니거나 깨진 파일은 알아듣는 오류', async () => {
  assert.throws(() => Zip.entries(new Uint8Array(100).buffer), /zip 파일이 아니에요/);
  const broken = Buffer.from(bytes);
  const cd = broken.readUInt32LE(broken.length - 6);
  broken.writeUInt32LE(0, cd);   // 목차 첫 항목 서명을 지운다
  assert.throws(() => Zip.entries(broken.buffer.slice(broken.byteOffset, broken.byteOffset + broken.length)), /목차가 깨졌어요/);
  await assert.rejects(Zip.read(buf, undefined), /항목이 없어요/);
});

test('브라우저 시험용 base64 파일이 생성기와 같다', () => {
  const js = readFileSync(new URL('../fixtures/mini-pptx.js', import.meta.url), 'utf8');
  assert.equal(/'(.+)'/.exec(js)[1], bytes.toString('base64'));
});
