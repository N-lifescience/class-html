# 과학(물리·화학·생명과학·지구과학)

## 자주 나오는 PPT와 바꾸는 법

| PPT | HTML |
|---|---|
| 공식 + 표(농도·온도·압력 값) | `.calc`로 값을 바꾸면 결과·막대·그림이 계산된다 |
| 그래프 그림 | `figure.plot`로 같은 식을 그리고, 지금 값에 표시선 |
| 모식도(세포·원자·지층) | SVG를 직접 그리고 `data-attr`로 크기·위치를 값에 묶는다 |
| 실험 과정 | `ol.order` + 안전 주의는 `.answer` 또는 단계 |
| 개념 구분(확산/삼투, 산/염기) | `.sort` |
| 순환·과정 그림 | `.reveal` + `data-at` |

## 규칙

- 식과 수치는 교과서 수준에서 정확해야 한다. 근거가 없는 수치는 지어내지 않는다. 모형 수치를 쓰면 `data-ai="모형 수치"`로 표시하고 화면에 '모형'이라고 적는다.
- 슬라이더 옆에 지금 값과 단위를 쓴다(`data-unit`). 극단값(최솟값·최댓값)에서도 식이 말이 되는지 확인한다(0으로 나누기 → '?').
- 변수 이름은 교과서 기호를 쓴다(`v`, `T`, `C`). 화면에는 한글 이름을 함께 적는다.

## 예: 흡수력 = 삼투압 − 팽압

```html
<section class="slide" id="osmosis" data-sec="2. 삼투" data-title="흡수력">
  <h2>흡수력 = 삼투압 − 팽압</h2>
  <div class="calc" style="display:grid;grid-template-columns:480px 1fr;gap:30px"
       data-const="k = 8.7; pmax = k / 1.35" data-let="o = k / v; t = v <= 1 ? 0 : pmax * ((v - 1) / 0.35) ^ 1.6; s = o - t" data-ai="모형 수치">
    <div>
      <p>세포의 상대적 부피 <output data-expr="v" data-digits="2"></output></p>
      <input type="range" name="v" min="0.85" max="1.35" step="0.01" value="1.1" aria-label="세포의 상대적 부피">
      <p>흡수력 <output data-expr="s" data-digits="1" data-unit="기압"></output></p>
      <div class="bar" data-value="s" data-max="10.5"></div>
      <p data-show="v < 1"><b>원형질 분리</b>: 팽압이 0이다.</p>
    </div>
    <figure class="plot" data-x="0.85, 1.35" data-y="0, 11" data-xlabel="세포의 상대적 부피" data-ylabel="압력(기압)">
      <i data-line="k / x" data-label="삼투압"></i>
      <i data-line="k / x - (x <= 1 ? 0 : pmax * ((x - 1) / 0.35) ^ 1.6)" data-label="흡수력" data-dash></i>
      <i data-vline="v"></i>
    </figure>
  </div>
</section>
```
