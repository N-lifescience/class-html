# 부품 사전

엔진이 동작을 붙인다. 수업 HTML에는 구조와 `data-*` 속성만 쓴다. 맞춤 `<script>`는 부품으로 안 될 때만 쓴다(이 문서 끝 '맞춤 스크립트').

`data-why`·`data-hint`·`data-stops` 같은 속성 값은 글자만 된다(태그 없음). 위첨자·아래첨자는 유니코드로 쓴다(Na⁺, H₂O, x²).

## 0. 뼈대와 공통 모양

```html
<!doctype html>
<html lang="ko" data-deck="world-3-2-5">           <!-- 판서 저장 열쇠: 영문 소문자·숫자·하이픈, 덱마다 다르게 -->
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>자유주의와 민족주의</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/N-lifescience/class-html@1/engine/class-html.css">
<script defer src="https://cdn.jsdelivr.net/gh/N-lifescience/class-html@1/engine/class-html.js"></script>
<style>/* 이 수업만의 모양 */</style>
</head>
<body data-theme="ppt" style="--accent:#C04F15">
<section class="slide cover" id="cover" data-title="표지">…</section>
<section class="slide" id="vienna" data-sec="내용 정리" data-title="빈 체제의 성립">…</section>
</body></html>
```

- 슬라이드마다 고정 `id`(판서가 붙는 열쇠), 목차용 `data-title`, 묶음 이름 `data-sec`(ppt 테마에서는 왼쪽 위 색 띠).
- 무대는 1280×720. 안쪽 여백은 위 72(ppt 테마는 112)·좌우 80·아래 56~64. 그 밖으로 나가면 점검 오류.
- 이 수업만의 CSS는 그냥 클래스로 쓴다(`.pts { padding: 0 }`). 엔진 기본 글 규칙은 우선순위가 낮아 늘 진다.

| 모양 | 작성 | 비고 |
|---|---|---|
| 단계 공개 | `<p class="step">` | →로 하나씩. `data-step="2"`가 같으면 함께 |
| 꼬리표 | `<p class="kicker">` | 강조색 선 + 작은 글씨 |
| 형광 강조 | `<mark>` | 노랑 밑줄 형광 |
| 번호 제목 | `<h2 data-n="1">` | 동그라미 번호 |
| 문항 | `<p class="q" data-n="1">` | 큰 번호 + 굵은 물음. 번호 대신 기호도 된다(`data-n="●"`) |
| 번호 목록 | `<ol class="points">` (1)(2), `<ol class="circled">` ①② | |
| 자료 단추 | `<a class="pill" href="…" target="_blank" rel="noopener">` | 색: `style="--pill:#7B3FC4"` |
| 비교표 | `<table class="compare">` | 첫 줄 thead, 첫 칸 th. 머리 색은 띠 색(`--tab`)을 따른다. 바꾸려면 `--table-head`, `--table-side` |
| 빈칸 | `<span class="blank">확산</span>` | 누르면 열린다. 활동으로 치지 않는다 |
| 정답 상자 | `<div class="answer"><p>…</p></div>` | ✓ 단추나 →로 연다. `.answer.sheet`는 흰 답안지 |
| 그림 | `<figure class="fig"><img src="data:…" alt="…"><figcaption>…</figcaption></figure>` | 오른쪽 위 확대 단추, 손 모드에서 눌러 확대. 단추가 그림 속 글자를 가리면 `data-zoom="off"` |
| 표지 | 아래 '표지' 예시 | `img.cover-art`는 오른쪽 560px를 차지한다. 제목은 왼쪽 600px 안에서 `<br>`로 나눈다(겹치면 점검 경고) |
| 수식 | `$x^2 + 1$`(줄 안), `$$E = mc^2$$`(가운데 한 줄) | KaTeX로 그린다(수식이 있을 때만 불러옴). 글자 그대로 $는 `\$`. `$5`처럼 $ 안쪽이 빈칸이면 수식이 아니다 |
| 장 표지 | `<section class="slide chapter" data-sec="2. 확산"><p class="kicker">2</p><h1>확산</h1></section>` | 띠 색 바탕의 소단원 시작 |
| 목차 슬라이드 | `<section class="slide toc"></section>` | 엔진이 `data-sec` 묶음 목록을 만든다(누르면 그 묶음 첫 장) |
| 움직임 | `data-anim="fade-up"`(또는 `fade pop wipe type highlight draw count`), 묶음은 부모에 `data-stagger` | 장이 보일 때마다 재생. `count`는 숫자만 든 요소(`<b data-anim="count">1,234명</b>`), `draw`는 SVG 선. 한 화면에 두세 가지만 |

표지:

```html
<section class="slide cover" id="cover" data-title="표지">
  <img class="cover-art" src="data:image/jpeg;base64,…" alt="표지 그림 설명">
  <div class="band"><p class="kicker">고등학교 생명과학 · 세포와 물질대사</p></div>
  <h1>세포막을 통한<br>물질 이동</h1>
</section>
```

표지 그림은 긴 변 1000px 이상이 좋다(작은 그림을 늘리면 흐리다). 그림이 없으면 `.cover-art`를 빼고 제목을 크게.

## 1. 단계 막대 `.reveal`

PPT로 할 수 없는 '하나씩 열기'. 0단계(전부 가림)에서 시작한다.

```html
<div class="reveal" data-stops="시작|증발|응결|강수">
  <div class="veil">0단계에 빗금으로 가려지는 영역(그림·도식)</div>
  <p data-at="1">1단계부터 보인다</p>
  <p data-only="2">2단계에서만 보인다</p>
  <p data-only="1 3">1단계와 3단계에서 보인다</p>
</div>
```

- `data-stops`: `|`로 나눈 눈금 이름. 첫 칸은 '시작'(없으면 엔진이 붙인다). 이름 안 줄바꿈은 `<br>`. 8칸 이상이면 지금 칸과 양 끝 이름만 보인다.
- 슬라이더는 엔진이 끝에 붙인다. 자리를 정하려면 `<div class="ch-stops"></div>`를 둔다.
- →·리모컨이 막대를 먼저 한 칸씩 연다. 막대가 다 열리면 그 뒤 `.step`, 그다음 장. `data-nav="off"`면 넘기기와 따로.
- 이전 장으로 돌아오면 끝 칸, 그 밖에는 0단계로 들어온다. 인쇄는 끝 칸.
- 막대 바깥에 있는 `data-at`·`data-only`는 그 장에 막대가 하나면 그 막대에, 여럿이면 `data-for="막대 id"`로 묶는다.
- 지금 칸은 `data-pos` 속성에 적힌다. CSS로 칸마다 모양을 바꿀 수 있다: `#fr[data-pos="2"] li:nth-child(3) { … }`.
- `data-only="0"`은 0단계(시작)에만 보이는 안내. `.veil`이 없으면 그림은 처음부터 보이고 `data-at`·`data-only`만 숨는다.
- 막대와 눈금 이름이 약 110px를 차지한다. 단계 막대 자체를 grid·flex로 배치하면 막대는 그 바로 뒤에 붙는다(칸 하나로 끼지 않는다).
- 안에는 표·그림·SVG·카드 무엇이든 넣을 수 있다.

## 2. 비교 전환 `.switch`

```html
<div class="switch" id="fr" data-stops="시작|7월 혁명 1830|2월 혁명 1848">
  <dl data-only="1">…</dl>
  <dl data-only="2">…</dl>
</div>
```

단추형 단계 막대. 처음엔 아무 단추도 눌려 있지 않고 "단추를 눌러 보자"가 보인다. 나머지는 1절과 같다.

## 3. 그림 지도 단계 공개 `figure.map-reveal`

교과서 지도 그림 위에 근사 다각형을 겹쳐, 아직 아닌 땅을 회색으로 가렸다가 연다.

```html
<figure class="map-reveal fig" id="map-it" style="width:560px" data-stops="시작|1859년 이전|1859~60|1860~61" data-approx="회색은 아직 통일 전 · 근사">
  <img src="data:image/jpeg;base64,…" alt="이탈리아의 통일 지도">
  <svg viewBox="0 0 1600 945">                      <!-- 그림 원래 픽셀 크기와 같은 좌표 -->
    <polygon data-from="2" points="530,25 615,25 …"/>  <!-- 2칸에 열리는 땅(그전엔 회색) -->
    <polygon data-lost="2" points="330,0 402,0 …"/>    <!-- 2칸부터 빗금(잃은 땅) -->
  </svg>
</figure>
<p data-for="map-it" data-only="2"><b>① 카부르</b> 중북부를 병합했다.</p>
```

- 다각형은 '가릴 곳'이다. 그 칸 이전의 영토는 다각형으로 덮지 않는다.
- '근사' 꼬리표는 엔진이 붙인다(`data-approx`로 글을 바꾼다). 좌표는 근사여도 되지만 사실과 맞는 순서·지역이어야 한다.
- 막대(약 100px)는 지도 바로 아래에 붙는다. 지도 폭을 정해(예: 560px) 지도 높이 + 막대가 제목 아래 약 480px 안에 들게 한다. 옆 설명은 `data-for`로 묶는다.

## 4. 연표 막대 `ol.yearline`

```html
<ol class="yearline" data-from="1815" data-to="1871">
  <li data-year="1815" data-tag="유럽">빈 회의, 빈 체제 성립</li>
  <li data-year="1830" data-tag="프랑스" data-flag>7월 혁명</li>
  <li data-year="1861" data-tag="미국" data-color="#C04F15" data-flag>남북 전쟁 발발</li>
</ol>
```

- 축은 연도에 비례한다. 칸은 사건이 있는 해마다 하나(→로 다음 사건 해). 막대는 한 해씩 움직인다.
- `data-tag`마다 색이 정해진다(`data-color`로 그 꼬리표 색 지정). `data-flag`는 축 위 깃발.
- 화면: 지금 연도(큰 글자) + 최근 사건 4개 + 축. 높이 약 380px.

## 5. 분류 카드 `.sort`

```html
<div class="sort">
  <div class="bin" data-bin="l"><h3>자유주의</h3></div>
  <div class="bin" data-bin="n"><h3>민족주의</h3></div>
  <span data-bin="l" data-why="맞을 때 보여 줄 이유" data-hint="틀릴 때 실마리">7월 혁명</span>
  <span data-bin="n" data-why="…" data-hint="…">그리스 독립</span>
</div>
<p class="step">다 맞히면 열리는 정리</p>
```

- 칸이 `.sort` 바로 아래에 있으면 칸 수만큼 열을 나눈다(최대 4).
- 카드는 끌어서 놓거나, 카드→칸 차례로 누른다. 펜을 든 채로도 카드가 움직인다.
- 다 맞히면 이 부품 뒤의 첫 `.step`을 연다. 「다시」 단추가 붙는다.
- 아래에 알림 줄(이유·실마리)이 붙고, 맞힌 카드는 칸 안으로 들어간다. 엔진이 실마리 앞에 "다시 생각해 보자.", 마지막 이유 앞에 "모두 맞혔다!"를 붙인다.
- 칸 2개에 카드 6~8장이 한 화면에 알맞다. 칸 높이는 이 수업 CSS로 바꾼다(`.bin { min-height: 100px }`). 칸 안의 빈 곳이나 이미 놓인 카드를 눌러도 그 칸에 놓인다.

## 6. 즉시 확인 문제 `.quiz`

```html
<div class="quiz" data-cols="2">
  <button class="opt" data-why="삼투는 막을 사이에 둔 물의 이동이다.">삼투</button>
  <button class="opt" data-ok data-why="맞다. 확산이다.">확산</button>
</div>
<div class="quiz" data-multi data-why="모두 맞혔을 때 풀이">
  <button class="opt" data-ok>능동 수송</button><button class="opt">단순 확산</button>
</div>
```

- 보기마다 `data-why`(왜 맞고 왜 틀린지)를 쓴다. 정답은 `data-ok`(둘 이상이어도 된다).
- 하나 고르기는 누른 보기의 이유가 아래 알림 줄에 나온다. 여러 개 고르기는 「확인」 뒤 잘못 고른 보기와 놓친 보기 아래에 그 보기의 이유가 나오고, 다 맞히면 문제의 `data-why`가 나온다.
- 보기 안에 그림·SVG를 넣어도 된다(그래프 고르기 등).
- 번호 ①②는 엔진이 붙인다(`data-num="off"`로 끔). `data-cols`로 열 수.
- 처음 맞히면 문제 뒤 첫 `.step`을 연다. 인쇄는 정답 표시.

## 7. 순서 배열 `ol.order`

```html
<ol class="order">
  <li data-why="처음에는 시야가 넓은 저배율로 찾는다.">저배율 대물렌즈로 돌린다</li>
  <li data-why="…">프레파라트를 재물대에 고정한다</li>
</ol>
```

정답 순서로 쓴다. 엔진이 섞어 내놓고, 학생이 차례로 눌러 쌓으면 자리마다 채점한다. 맞은 칸 아래에 `data-why`가 붙어 길어지므로 항목은 5개 안팎, 이유는 한 줄로. 모두 맞으면 뒤 `.step`을 연다.

## 8. 계산 상자 `.calc` — 입력하면 화면이 계산해서 바뀐다

```html
<div class="calc" style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start" data-const="k = 8.7" data-let="o = k / v; t = v <= 1 ? 0 : 6.44 * ((v - 1) / 0.35) ^ 1.6; s = o - t">
  <div>
  <input type="range" name="v" min="0.85" max="1.35" step="0.01" value="1.1" aria-label="세포 부피">
  <p>부피 <output data-expr="v" data-digits="2"></output></p>
  <p>흡수력 <output data-expr="s" data-digits="1" data-unit="기압"></output></p>
  <div class="bar" data-value="s" data-max="10.5" style="--bar-c:#B45309"></div>
  <p data-show="v < 1">원형질 분리: 팽압이 0이다.</p>
  <p data-class="is-ok: s > 0; is-bad: s <= 0">상태</p>
  </div>
  <svg viewBox="0 0 300 120" width="300"><rect data-attr="width: 216 * v; x: 150 - 108 * v" y="20" height="80"/></svg>
</div>
```

- 입력(변수 이름은 `name`): `input[type=range|number|checkbox|radio|text]`, `textarea`, `select`, 단추 고르기 `<button data-set="sex" data-value="여">`(처음엔 `aria-pressed="true"`인 것, 없으면 첫 단추).
- 단계 막대를 변수로: `.calc` 안의 `<div class="reveal" data-name="v" data-stops="…">` → 지금 칸 번호가 `v`. 0단계 시작이 필요한 활동은 이것을 쓴다.
- 계산: `data-const`(한 번), `data-let`(바뀔 때마다 앞에서부터).
- 출력: `data-expr`(글자, `data-digits` 소수 자리, `data-unit` 단위), `data-show`(참이면 보임), `data-class="클래스: 식; …"`, `data-style="속성: 식"`(숫자는 px, `--변수`는 그대로), `data-attr="속성: 식"`(SVG), `.bar[data-value][data-max]`(막대 길이).
- 식 문법: 수, `'글자'`, `+ - * / % ^`, `== != < <= > >=`, `&& || !`, `조건 ? 가 : 나`, `× ÷ − ≤ ≥ ≠`도 된다. 함수: `abs min max round(x,n) floor ceil sqrt pow exp ln log(10이 밑) sin cos tan asin acos atan rad deg clamp(x,lo,hi) if(c,a,b) fix(x,n) len(글자) sign`. 상수 `pi e true false`. 글자 + 수는 이어 붙인다.
- 식이 틀리면 그 자리에 '?'가 나오고 점검(D)에 오류로 뜬다. 근거 없는 수치를 지어내지 않는다. 단위를 쓴다.
- 계산 상자의 슬라이더는 중간값에서 시작해도 된다(단계를 여는 막대가 아니다).
- 입자·점이 많은 모식도는 `data-attr`로 점마다 식을 쓰지 말고 입자 상자 `figure.particles`(교과 지침: 과학)를 쓰거나, 그림 몇 장을 단계 막대로 바꾼다.

## 9. 그래프 `figure.plot`

```html
<figure class="plot" data-x="0.85, 1.35" data-y="0, 11" data-height="340" data-xlabel="세포의 상대적 부피" data-ylabel="압력(기압)">
  <i data-line="k / x" data-label="삼투압" data-color="#0F766E"></i>
  <i data-line="k / x - (x <= 1 ? 0 : 6.44 * ((x - 1) / 0.35) ^ 1.6)" data-label="흡수력" data-dash></i>
  <i data-vline="v"></i>
  <i data-point="v, s" data-label="지금"></i>
</figure>
```

`.calc` 안에 두면 그 변수(v, s, k…)를 쓰고 입력이 바뀔 때마다 다시 그린다. 곡선의 가로 변수는 `x`. 폭은 감싼 칸 폭, 높이는 `data-height`. 가로 기준선은 상수 식(`<i data-line="vmax" data-dash>`), 점 색은 `data-color`.

## 10. 그림 자리 `img[data-ppt]`

```html
<img data-ppt="12-2" alt="빈 회의 풍자화" width="480">
```

- 코드를 실행할 수 없어 그림을 못 넣을 때만 쓴다. `12-2`는 원본 PPT 12쪽의 2번째 그림(슬라이드 XML의 그림 순서, `extract_pptx.py`의 번호와 같다).
- 선생님이 원본 PPTX를 화면에 끌어다 놓으면 채워지고, ⚙ 「그림 넣어 저장」으로 파일에 넣는다.

## 11. 교실 도구

활동으로 치지 않는 수업 진행 도구다. 상태는 그 화면 안에만 있다(저장하지 않는다).

```html
<div class="timer" data-sec="300" data-label="모둠 활동"></div>   <!-- 시작·멈춤·다시, 끝나면 '끝'과 깜빡임 -->
<div class="picker" data-range="1-30"></div>                     <!-- 발표자 뽑기(겹치지 않게). data-items="가|나|다"도 된다 -->
```

```html
<div class="score" data-teams="4"></div>                          <!-- 모둠 점수판(+1/−1). data-teams="빨강|파랑"도 된다 -->
<ul class="checklist"><li>보안경</li><li>실험복</li></ul>         <!-- 누르면 ✓, 아래에 '1 / 2' -->
```

```html
<figure class="hotspots" style="width:560px">                    <!-- 그림 위 번호를 누르면 그 설명 -->
  <img src="data:…" alt="…">
  <span class="hs" style="--x:30%; --y:40%">설명</span>
  <span class="hs" style="--x:70%; --y:55%" data-label="A">설명</span>
</figure>
```

## 12. 맞춤 스크립트(마지막 수단)

```html
<script>
document.addEventListener('DOMContentLoaded', () => {
  ClassHTML.onShow((slide, i) => { /* 장이 보일 때 */ });
});
</script>
```

- `</body>` 바로 앞에 둔다. `ClassHTML.onShow/onHide/go/next/prev/audit`를 쓴다. `innerHTML`로 학생 입력을 넣지 않는다.
- 펜을 든 채로 쓰는 규칙: 누르는 요소는 `button`·`a`·`label` 또는 `data-tap`, 끄는 요소(슬라이더가 아닌 것)는 `data-no-ink`.

## 점검 코드(D 키, `?audit`)

| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `slide-overflow`, `out` | 무대 밖으로 넘침 | 글자를 줄이지 말고 장을 나누거나 배치를 바꾼다 |
| `clip` | 상자 안 내용이 잘림 | 상자 높이·글 양 |
| `tiny-text`, `small-text` | 18px 미만 오류, 20px 미만 본문 경고 | 글자 키우기 |
| `part` | 부품 작성 실수(칸 없는 카드, 정답 없는 문제, 식 오류, 어느 막대인지 모르는 data-at …) | 메시지대로 |
| `not-veiled` | 부품 밖 슬라이더가 중간에서 시작 | 단계형이면 `.reveal`로 |
| `few-activities` | 활동 장이 3분의 1 미만 | 개념마다 활동을 하나 더 |
| `empty-image`, `no-alt`, `dup-id` | 빈 그림 자리, 그림 설명 없음, 중복 id | |
