// 순수 획 기하. 점 배열은 [x0, y0, x1, y1, ...] (무대 px).
const InkGeom = {
  round(v) { return Math.round(v * 10) / 10; },

  distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  },

  bbox(p) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      x0 = Math.min(x0, p[i]);
      x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]);
      y1 = Math.max(y1, p[i + 1]);
    }
    return [x0, y0, x1, y1];
  },

  // (x, y)에 놓인 반지름 r의 지우개가 획에 닿는가
  hit(stroke, x, y, r) {
    const p = stroke.p;
    const reach = r + stroke.w / 2;
    const [x0, y0, x1, y1] = InkGeom.bbox(p);
    if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) return false;
    if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= reach;
    for (let i = 0; i + 3 < p.length; i += 2) {
      if (InkGeom.distToSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true;
    }
    return false;
  },

  // 마지막 점과 minDist보다 가까우면 버린다(획 데이터를 작게)
  keep(p, x, y, minDist) {
    const n = p.length;
    return n < 2 || Math.hypot(x - p[n - 2], y - p[n - 1]) >= minDist;
  },
};
