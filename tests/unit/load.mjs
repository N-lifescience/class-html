// 엔진 소스 파일들을 하나의 vm 샌드박스에 올려 순수 모듈을 Node에서 시험한다.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../../engine/src');

export function load(files, names) {
  const code = files.map((f) => readFileSync(join(srcDir, f), 'utf8')).join('\n');
  const ctx = vm.createContext({ console });
  return vm.runInContext(`${code}\n;({ ${names.join(', ')} })`, ctx);
}

// vm 안에서 만든 배열·객체는 프로토타입이 달라 deepStrictEqual이 실패하므로 평범한 값으로 바꿔 비교한다.
export const plain = (x) => JSON.parse(JSON.stringify(x));
