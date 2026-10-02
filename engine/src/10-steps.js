// 순수 단계 로직. 슬라이드 안 .step 요소를 묶음 단위로 하나씩 연다.
// keys: 문서 순서대로 각 .step의 data-step 값(숫자) 또는 null.
// data-step이 없는 단계는 바로 앞 단계 다음에 열린다.
const Steps = {
  groups(keys) {
    const byKey = new Map();
    let base = 0;
    let n = 0;
    keys.forEach((v, i) => {
      let key;
      if (typeof v === 'number' && Number.isFinite(v)) { key = v; base = v; n = 0; } else { n += 1; key = base + n * 1e-6; }
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(i);
    });
    return Array.from(byKey.entries()).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  },

  next(state, counts) {
    if (state.shown < counts[state.slide]) return { slide: state.slide, shown: state.shown + 1 };
    if (state.slide < counts.length - 1) return { slide: state.slide + 1, shown: 0 };
    return state;
  },

  prev(state, counts) {
    if (state.shown > 0) return { slide: state.slide, shown: state.shown - 1 };
    if (state.slide > 0) return { slide: state.slide - 1, shown: counts[state.slide - 1] };
    return state;
  },

  go(index, counts, allShown) {
    const slide = clamp(index, 0, counts.length - 1);
    return { slide, shown: allShown ? counts[slide] : 0 };
  },
};
