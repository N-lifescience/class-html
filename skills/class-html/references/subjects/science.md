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
| 확산·삼투·기체 운동(입자 그림) | `figure.particles`(입자 상자): 막 양쪽 개수와 통과 여부를 정하면 입자가 움직이며 개수가 바뀐다 |

## 입자 상자 `figure.particles`

```html
<div class="calc" style="display:grid;grid-template-columns:1fr 360px;gap:28px;align-items:start">
  <figure class="particles" data-membrane="0.5" data-labels="세포 밖|세포 안" data-height="300">
    <i data-kind="물" data-left="30" data-right="30" data-pass="1" data-color="#5AA9E6" data-size="4"></i>
    <i data-kind="설탕" data-left="sugar" data-right="5" data-pass="0" data-color="#C04F15" data-size="8"></i>
  </figure>
  <div>
    <p>세포 밖 설탕 <output data-expr="sugar" data-unit="개"></output></p>
    <input type="range" name="sugar" min="0" max="40" value="20" aria-label="세포 밖 설탕 수">
    <p data-show="sugar > 5">설탕은 막을 못 지난다. 물이 세포 밖으로 더 많이 나간다.</p>
  </div>
</div>
```

- `data-membrane`: 막의 가로 위치(0~1). 빼면 막이 없는 한 칸(기체 운동, 확산). 막이 없어도 `data-right`를 주면 처음에 가운데를 기준으로 나눠 놓고 양쪽 개수를 센다(잉크가 퍼지는 확산).
- `data-labels="세포 밖|세포 안"`은 상자 안 양쪽 위와 개수 줄에 나온다.
- 입자 종류마다 `data-left`·`data-right`(처음 개수), `data-pass`(막을 지날 확률 0~1: 반투과성막이면 물 1, 용질 0), `data-color`, `data-size`(반지름 px). 값은 식이라 계산 상자 변수를 쓸 수 있다. `data-speed`(상자 전체 속도, 기본 1)도 식.
- 장이 보이면 움직이고 넘기면 멈춘다. 「멈추기」·「다시」 단추, 아래에 양쪽 개수. 입자는 모두 300개까지.
- 삼투: 막을 못 지나는 입자(`data-pass="0"`, 용질)는 자기 쪽 막 구멍을 가려, 그쪽 물이 막을 지날 확률이 용질 비율만큼 줄어든다. 그래서 물은 용질이 많은 쪽으로 더 많이 모인다(교과서의 설명 모형).
- 움직임은 모형이다. 개수의 비율이 개념과 맞는지만 지키고, '실제 분자 수'처럼 말하지 않는다.

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
