// 시험용 작은 PPTX를 코드로 만든다(저작권 없는 단색 그림). 그림 채우기(60-zip, 61-pptfill)와 extract_pptx.py 시험에 쓴다.
// 슬라이드 순서: presentation.xml 순서는 slide2 → slide1 → slide3 (파일 번호와 다르다).
//   1쪽(slide2.xml): 그림 1-1 빨강 40×30 PNG, 1-2 큰 파랑 2400×300 PNG(줄이기 시험)
//   2쪽(slide1.xml): 그림 2-1 초록 JPEG 대신 PNG, 2-2 EMF(브라우저가 못 여는 형식), 2-3 빨강(1-1과 같은 파일)
//   3쪽(slide3.xml): 그림 없음, 배경 그림 3-1 SVG
import { deflateRawSync, deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function png(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const pic = (rid, name) => `<p:pic><p:nvPicPr><p:cNvPr id="2" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill><p:spPr/></p:pic>`;
const slide = (body, bg = '') => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld>${bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:txBody><a:p><a:r><a:t>제목</a:t></a:r></a:p></p:txBody></p:sp>${body}</p:spTree></p:cSld></p:sld>`;
const rels = (list) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL}">${list.map(([id, target, type]) => `<Relationship Id="${id}" Type="${type || 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'}" Target="${target}"/>`).join('')}</Relationships>`;
// 테마 색 집계 시험용 도형: 노랑(accent3) 3번, 직접 지정한 주황 2번
const box = (fill) => `<p:sp><p:spPr><a:solidFill>${fill}</a:solidFill></p:spPr><p:txBody><a:p><a:r><a:t>내용 정리</a:t></a:r></a:p></p:txBody></p:sp>`;
const FILLS = box('<a:schemeClr val="accent3"/>').repeat(3) + box('<a:srgbClr val="E8541A"/>').repeat(2);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#ff9900"/></svg>';

export function files() {
  return [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>', 8],
    ['ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:sldIdLst><p:sldId id="256" r:id="rId12"/><p:sldId id="257" r:id="rId11"/><p:sldId id="258" r:id="rId13"/></p:sldIdLst></p:presentation>`, 8],
    ['ppt/_rels/presentation.xml.rels', rels([['rId11', 'slides/slide1.xml', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'], ['rId12', 'slides/slide2.xml', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'], ['rId13', '/ppt/slides/slide3.xml', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide']]), 8],
    ['ppt/slides/slide2.xml', slide(pic('rId2', '빨강') + pic('rId3', '큰 파랑')), 8],
    ['ppt/slides/_rels/slide2.xml.rels', rels([['rId2', '../media/image1.png'], ['rId3', '../media/image2.png']]), 0],
    ['ppt/slides/slide1.xml', slide(pic('rId5', '초록') + pic('rId6', '도형 EMF') + pic('rId7', '빨강 다시') + FILLS), 8],
    ['ppt/slides/_rels/slide1.xml.rels', rels([['rId5', '../media/image3.png'], ['rId6', '../media/image4.emf'], ['rId7', '../media/image1.png']]), 8],
    ['ppt/slides/slide3.xml', slide('', `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId9"/></a:blipFill></p:bgPr></p:bg>`), 8],
    ['ppt/slides/_rels/slide3.xml.rels', rels([['rId9', '../media/image5.svg']]), 8],
    ['ppt/media/image1.png', png(40, 30, [215, 38, 61]), 0],
    ['ppt/media/image2.png', png(2400, 300, [31, 111, 209]), 8],
    ['ppt/media/image3.png', png(30, 30, [46, 158, 106]), 8],
    ['ppt/media/image4.emf', Buffer.from([1, 0, 0, 0, 0x6C, 0, 0, 0, 0x20, 0x45, 0x4D, 0x46]), 0],
    ['ppt/media/image5.svg', SVG, 8],
    ['ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="${A}" name="시험"><a:themeElements><a:clrScheme name="시험"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F3B70"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="C04F15"/></a:accent1><a:accent2><a:srgbClr val="157E7B"/></a:accent2><a:accent3><a:srgbClr val="FFDE21"/></a:accent3><a:accent4><a:srgbClr val="4F9BB4"/></a:accent4><a:accent5><a:srgbClr val="A77540"/></a:accent5><a:accent6><a:srgbClr val="89C5CF"/></a:accent6></a:clrScheme></a:themeElements></a:theme>`, 8],
  ];
}

// 파일 목록 → zip(방식 0 저장, 8 deflate)
export function zip(list) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, content, method] of list) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const comp = method === 8 ? deflateRawSync(data) : data;
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(list.length, 8); end.writeUInt16LE(list.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function buildMiniPptx() { return zip(files()); }
