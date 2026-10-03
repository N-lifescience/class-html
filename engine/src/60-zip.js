// PPTX(zip) 읽기: 브라우저 안에서만 푼다(외부 전송 없음). 압축 방식 0(저장)과 8(deflate)을 지원한다.
// 그림 번호 '12-2' = presentation.xml 순서로 12번째 슬라이드, 그 슬라이드 XML의 a:blip 가운데 2번째(문서 순서).
// extract_pptx.py도 같은 규칙을 쓴다. XML은 DOMParser('application/xml')로만 읽는다(HTML로 해석하지 않음).
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const Zip = {
  // ArrayBuffer → Map(이름 → { method, csize, size, offset, encrypted })
  entries(buf) {
    const v = new DataView(buf);
    const n = buf.byteLength;
    let eocd = -1;
    for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('zip 파일이 아니에요');
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    if (p === 0xFFFFFFFF || count === 0xFFFF) throw new Error('너무 큰 파일(zip64)은 열 수 없어요');
    const dec = new TextDecoder();
    const out = new Map();
    for (let k = 0; k < count; k++) {
      if (p + 46 > n || v.getUint32(p, true) !== 0x02014b50) throw new Error('zip 목차가 깨졌어요');
      const flags = v.getUint16(p + 8, true);
      const nameLen = v.getUint16(p + 28, true);
      const extraLen = v.getUint16(p + 30, true);
      const commentLen = v.getUint16(p + 32, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      out.set(name, {
        method: v.getUint16(p + 10, true), csize: v.getUint32(p + 20, true), size: v.getUint32(p + 24, true),
        offset: v.getUint32(p + 42, true), encrypted: !!(flags & 1),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  },

  // 항목 하나 → Uint8Array
  async read(buf, e) {
    if (!e) throw new Error('파일 안에 그 항목이 없어요');
    if (e.encrypted) throw new Error('암호가 걸린 파일은 열 수 없어요');
    const v = new DataView(buf);
    if (v.getUint32(e.offset, true) !== 0x04034b50) throw new Error('zip 항목이 깨졌어요');
    const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
    const data = new Uint8Array(buf, start, e.csize);
    if (e.method === 0) return data.slice();
    if (e.method !== 8) throw new Error(`지원하지 않는 압축 방식(${e.method})이에요`);
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  },

  async text(buf, e) { return new TextDecoder().decode(await this.read(buf, e)); },
};

const Pptx = {
  xml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('PPT 안의 XML을 읽지 못했어요');
    return doc;
  },

  // 'ppt/slides/slide1.xml' 기준 상대 경로 → zip 안의 경로
  resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/').slice(0, -1);
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  },

  async rels(buf, entries, path) {
    const relPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
    const map = new Map();
    if (!entries.has(relPath)) return map;
    const doc = this.xml(await Zip.text(buf, entries.get(relPath)));
    for (const r of Array.from(doc.getElementsByTagNameNS(NS_REL, 'Relationship'))) {
      if (r.getAttribute('TargetMode') === 'External') continue;
      map.set(r.getAttribute('Id'), this.resolve(path, r.getAttribute('Target') || ''));
    }
    return map;
  },

  // ArrayBuffer → { slides: [{ n, path, images: [{ id: '12-2', path, ext }] }], entries }
  async open(buf) {
    const entries = Zip.entries(buf);
    const presPath = 'ppt/presentation.xml';
    if (!entries.has(presPath)) throw new Error('PPTX 파일이 아니에요(presentation.xml 없음)');
    const pres = this.xml(await Zip.text(buf, entries.get(presPath)));
    const presRels = await this.rels(buf, entries, presPath);
    const slides = [];
    const ids = Array.from(pres.getElementsByTagNameNS(NS_P, 'sldId'));
    for (const [i, el] of ids.entries()) {
      const path = presRels.get(el.getAttributeNS(NS_R, 'id'));
      const slide = { n: i + 1, path, images: [] };
      slides.push(slide);
      if (!path || !entries.has(path)) continue;
      const doc = this.xml(await Zip.text(buf, entries.get(path)));
      const rels = await this.rels(buf, entries, path);
      let k = 0;
      for (const blip of Array.from(doc.getElementsByTagNameNS(NS_A, 'blip'))) {
        const rid = blip.getAttributeNS(NS_R, 'embed');
        if (!rid) continue;
        k += 1;
        const media = rels.get(rid);
        slide.images.push({ id: `${slide.n}-${k}`, path: media, ext: media ? (media.split('.').pop() || '').toLowerCase() : '' });
      }
    }
    return { slides, entries, buf };
  },

  find(pptx, id) {
    const [s] = String(id).split('-');
    const slide = pptx.slides[Number(s) - 1];
    return slide ? slide.images.find((im) => im.id === id) || null : null;
  },
};
