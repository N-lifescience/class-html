<!-- 자동 생성: node tools/build.mjs (손으로 고치지 않는다) -->
# class-html 합본 지침

> **AI에게**: 이 파일 하나가 「수업 HTML」 지침 전체다. 선생님이 수업 PPT를 주면 이 지침대로 수업용 HTML을 만든다.
> 본문의 `references/…`는 이 파일의 해당 절을, `scripts/…`는 저장소 https://github.com/N-lifescience/class-html 의 `skills/class-html/scripts/`를 가리킨다.
> 엔진: `https://cdn.jsdelivr.net/gh/N-lifescience/class-html@1/engine/class-html.css`·`.js` (v1.0.0-dev)

## 차례

1. 절차와 규칙
2. 인터뷰와 설계 확인
3. 부품 사전
4. PPT 패턴 → 부품
5. 화면과 디자인
6. 한국어 문장
7. 교과 지침: 과학(물리·화학·생명과학·지구과학)
8. 교과 지침: 사회(역사·지리·일반사회·윤리)
9. 교과 지침: 수학
10. 교과 지침: 국어
11. 교과 지침: 영어·제2외국어·한문
12. 교과 지침: 정보
13. 교과 지침: 기술·가정, 예체능

---

## 1. 절차와 규칙

PPT를 HTML로 옮기는 일이 아니다. PPT의 학습 목표와 내용으로 **PPT로는 할 수 없는 수업**을 새로 설계한다. 학생이나 교사가 값을 바꾸거나 고르면 화면이 계산해서 달라지는 활동이 중심이다.

판서(펜·형광펜·지우개·레이저), 칠판, 반별 저장, 넘기기, 인쇄, 자동 점검은 엔진이 한다. 너는 `<section class="slide">`와 부품 구조만 쓴다.

### 절차

#### 1. 읽기

- 코드를 실행할 수 있으면: `python3 scripts/extract_pptx.py 수업.pptx -o 작업폴더` → `outline.md`(슬라이드별 글·표·노트·그림 번호), `media/12-2.png`, `theme.json`(원본 PPT 색).
- 실행할 수 없으면 PPT를 직접 읽는다. 그림은 `<img data-ppt="12-2" alt="…">` 자리로 남긴다(12쪽의 2번째 그림).
- `outline.md`는 화면 위치 순서로 적혀 있다. 나란히 놓인 글은 '(같은 줄 1/2칸)'처럼 표시되며, 다음 줄의 같은 칸과 짝이다. 링크(영상·사료 주소)와 그림의 화면 크기도 적힌다. '작은 그림(장식·단추일 수 있음)'은 대개 쓰지 않는다.
- **글이 없거나 적은 장은 `media/`의 그림을 열어 읽는다.** 글이 박힌 그림(만화 말풍선, 표, 문제, 손글씨 정리)은 글을 HTML로 다시 쳐서 넣는다. 교실 뒤에서도 읽히고 판서·단계 공개가 된다. 사진과 그림 자료는 그림 그대로 둔다.

#### 2. 인터뷰 — 답을 받기 전에는 만들지 않는다

`references/interview.md`의 질문 5개를 한 번에 묻는다(교과·학년·차시, 수업 장면, 헷갈리는 지점, 꼭 넣을 활동, 지킬 것). 짐작한 답에 (추천)을 붙인다. "알아서"면 추천대로.

#### 3. 설계 확인

개념 | 헷갈리는 지점 | 활동(부품) | 학생이 조작하는 것 | 화면에서 바뀌는 것 — 이 표를 채팅에 보여 주고 "이대로 만들까요?"라고 묻는다. **설계표와 교사용 안내는 HTML에 넣지 않는다.** 부품 고르기는 `references/patterns.md`, 교과 지침은 `references/subjects/`에서 해당 교과 하나만 읽는다.

#### 4. 쓰기

- 뼈대: `assets/template.html`. 부품 작성 모양: `references/components.md`. 화면·색: `references/design.md`. 문장: `references/korean.md`.
- 원본 PPT 색은 `theme.json`의 `css` 줄을 쓴다(`body[data-theme="ppt"]`).
- 그림: 쓰는 동안은 `<img src="media/3-1.png" alt="…">`처럼 추출한 파일을 가리킨다. 다 쓰면 `python3 scripts/bundle.py 수업.html -o 수업-한파일.html`이 그림을 긴 변 1600px 이하로 줄여 `data:` URI로 넣는다. 인터넷이 없는 교실용은 `--offline`(엔진도 파일 안에). 코드를 실행할 수 없으면 `img[data-ppt]` 자리.

#### 5. 점검

- 브라우저를 쓸 수 있으면 `수업.html?audit`로 열거나 D 키. `ClassHTML.audit()`의 `errors`가 0이 될 때까지 고친다(각 항목의 `page`가 화면 쪽 번호). 점검은 단계를 모두 연 채로 여러 상태를 잰다: 부품을 풀기 전, 다 푼 뒤(이유가 나온 가장 긴 모습), 단계 막대의 칸마다, 계산 상자 슬라이더의 최솟값·최댓값과 단추 값마다. 넘침 알림 끝의 괄호가 그때의 상태다.
- 저장소의 `node tools/shots.mjs 수업.html 폴더`는 장마다 처음 상태를, `--open`은 모두 열고 다 푼 상태를 찍는다. 점검 결과는 두 방식이 같다(찍는 화면만 다르다). 찍은 화면을 직접 보고 겹침·잘림도 확인한다(표지 그림 겹침은 경고로 나온다).
- 못 쓰면 아래 점검표로 스스로 확인한다.

#### 6. 전달

- PPT에 정답이 없어 AI가 푼 문제, 손글씨·흐린 그림을 읽어 옮긴 곳은 따로 적어 선생님께 확인을 부탁한다.
- HTML 파일 하나(`bundle.py`로 그림을 넣은 것). 엔진은 인터넷에서 불러오므로 인터넷이 없는 교실이면 `--offline`으로 묶은 파일을 준다. 사용법 세 줄: ① 파일을 더블클릭해 연다 ② 툴바에서 펜을 고르고 ◀ ▶로 넘긴다 ③ 그림이 비어 있으면 원본 PPT를 화면에 끌어다 놓고 ⚙ 「그림 넣어 저장」.
- "교과서 그림이 들어 있으니 수업용으로만 쓰고 인터넷에 공개하지 마세요."를 덧붙인다.

### 작성 규칙(핵심)

1. 사실·정의·정답·자료 출처는 PPT 그대로. 문장은 윤문한다. 장의 순서와 구성은 수업 흐름에 맞게 바꿔도 된다. PPT 원문(정의·정답·사료·시험 문제)은 말투 규칙보다 우선한다. 교과서 쪽수는 `.kicker`나 문항 끝 `<small>`에 '교과서 36쪽'처럼 남긴다.
2. AI가 새로 만든 설명·문항·예시는 그것을 감싼 가장 작은 덩어리(문단·카드·부품 하나)에 `data-ai="무엇"`(화면에 안 보이고 점검에서 보인다). 부품 안의 이유·실마리만 AI가 썼으면 부품에 붙이고 무엇을 썼는지 적는다(`data-ai="카드 이유·실마리"`). PPT에 정답이 없는 문제를 AI가 풀었으면 `data-ai="정답 확인 필요"`.
3. 한 장에 한 생각. 본문 28px, 어떤 글자도 20px 미만 금지. 넘치면 글자를 줄이지 말고 장을 나눈다.
4. 답·풀이·결론은 `.step`이나 `.answer`로 숨긴다.
5. 활동이 중심: 전체 장의 3분의 1 이상을 활동 장으로. **활동 장** = 학생·교사의 입력에 따라 화면이 달라지는 장: 계산 상자·그래프·입자 상자, 분류 카드, 문제, 순서 배열, 지도 단계 공개, 연표 막대, 그림·도식이 바뀌는 단계 막대·비교 전환. 글만 차례로 여는 단계 막대·비교 전환, 빈칸, 정답 상자는 활동이 아니다(점검 D가 이 기준으로 세어 활동 장 쪽 번호를 알려 준다). 한 장에 활동 하나.
6. 슬라이드마다 고정 `id`, 문서에 `data-deck`.
7. 외부 그림 주소 금지. `data:` URI 또는 `img[data-ppt]`.
8. 학생 실명·사진 금지.
9. 단계형 활동은 0단계(전부 가림)에서 시작한다. 엔진 부품을 쓰면 저절로 그렇다. 직접 만든 슬라이더로 단계를 열지 않는다.
10. 한국어: `references/korean.md`. AI 말투 금지, 줄은 의미 단위, 맞춤법.
11. 맞춤 스크립트는 부품으로 안 될 때만. 그때도 `DOMContentLoaded` 안에서 `ClassHTML.onShow` 등을 쓴다.

### 점검표(내기 전)

- [ ] 선생님이 고른 활동이 모두 들어갔는가.
- [ ] 활동 장마다 조작하면 화면이 계산해서 바뀌는가. 활동 장이 3분의 1 이상인가.
- [ ] 단계형 활동이 모두 0단계에서 시작하는가.
- [ ] 계산 상자의 식·단위·극단값(최솟값·최댓값)이 맞는가. 넘침은 점검이 끝값까지 재지만, 값이 맞는지는 끝값을 직접 계산해 본다.
- [ ] 무대 밖으로 넘친 내용, 20px 미만 글자가 없는가.
- [ ] 쓰지 않기로 한 말투가 없는가. 줄이 의미 단위로 바뀌는가.
- [ ] PPT의 정답과 사실이 그대로인가. 설계표·교사용 안내가 HTML 안에 없는가.

### 길이

- PPT가 40장을 넘으면 소단원(차시)별로 파일을 나눈다.
- 답이 길어 끊기면 선생님이 '계속'이라고 쓸 때 끊긴 곳부터 이어 쓴다. 코드를 실행할 수 있으면 장을 파일로 나눠 쓰고 이어 붙인다.

---

## 2. 인터뷰와 설계 확인

선생님마다, 교과마다 필요한 활동이 다르다. PPT를 읽은 뒤 만들기 전에 묻는다. 답을 받기 전에는 HTML을 만들지 않는다.

### 묻는 방법

- 아래 질문을 **한 번에** 묻는다. 질문마다 번호 보기를 주고, PPT를 보고 짐작한 답에 (추천)을 붙인다.
- 선생님이 "알아서"라고 하면 추천대로 간다.
- 선택지 창을 띄울 수 있는 AI(Claude 데스크톱·Claude Code의 질문 창 등)는 그것을 쓰고, 나머지는 채팅 글로 묻는다.

### 질문(5개 이하)

1. **교과·학년·차시**: "PPT를 보니 ○○ ○학년 '○○' 단원으로 보입니다. 맞나요? 몇 차시로 쓸까요?"
2. **수업 장면**: ① 교사가 전자칠판으로 진행(추천) ② 학생이 각자 기기로 ③ 둘 다
3. **학생이 가장 헷갈려 하는 지점**: PPT에서 후보 3개를 뽑아 보여 주고, 고르거나 직접 쓰게 한다.
4. **꼭 넣고 싶은 활동(최대 3개)**: 아래 교과별 메뉴를 보여 준다. 메뉴에 없는 것도 말하게 하고, "PPT로 수업할 때 아쉬웠던 장면이 있나요?"를 함께 묻는다.
5. **지킬 것**: 시험 범위, 그대로 둘 문장·자료, 뺄 장. 없으면 넘어간다.

### 교과별 활동 메뉴 → 부품

| 교과 | 메뉴 | 쓰는 부품 |
|---|---|---|
| 과학 | 변수 조작 시뮬레이션(농도·온도·시간 슬라이더) | `.calc` + `figure.plot` |
| | 예측 후 확인 그래프 | `.quiz`(예측) → `.reveal`/`.step`로 그래프 공개 |
| | 식과 그림이 함께 바뀌는 모식도 | `.calc`의 `data-attr`(SVG)·`data-style` |
| | 실험 순서 맞추기 | `ol.order` |
| | 입자 운동(확산·삼투·기체) | `figure.particles` |
| 사회 | 지도 시기별 공개와 영역 색칠 | `figure.map-reveal` |
| | 연표 막대 | `ol.yearline` |
| | 두 자료 비교 전환 | `.switch` |
| | 분류 카드 | `.sort` |
| | 판정 모형(조건을 바꾸면 결과가 계산됨) | `.calc` + `data-set` 단추 |
| 국어 | 지문에서 낱말 찾기, 표현 분류 | `.sort`, `.quiz[data-multi]` |
| | 정서 변화, 서사 단계 | `.reveal`(단계마다 설명), `figure.plot`(정서 곡선 점) |
| | 고쳐 쓰기 전후 비교 | `.switch` |
| 수학 | 함수 그래프 계수 슬라이더 | `.calc` + `figure.plot` |
| | 단계 풀이 | `.step`, `.reveal` |
| | 확률·통계 계산 | `.calc` |
| 영어·제2외국어 | 어순 맞추기 | `ol.order` |
| | 어휘·문장 성분 분류 | `.sort` |
| 정보 | 알고리즘 단계 추적 | `.reveal`(칸마다 변수 표) |
| | 이진수 계산 | `.calc`(체크 상자 비트) |
| 기술·가정, 예체능 | 절차 카드 | `ol.order` |
| | 영양·전력 계산기 | `.calc` |

메뉴에 없는 요청은 `.calc`(계산)와 `.reveal`(단계)로 먼저 풀어 본다. 그래도 안 되면 맞춤 스크립트로 만들고 `data-ai`로 표시한다.

### 설계표 확인

답을 받으면 아래 표를 채팅에 보여 주고 "이대로 만들까요?"라고 묻는다. 고칠 곳을 말하면 고쳐서 다시 보여 준다. **설계표와 교사용 안내는 HTML 파일 안에 넣지 않는다.** HTML은 학생이 보는 화면이다.

| 개념 | 헷갈리는 지점 | 활동(부품) | 학생이 조작하는 것 | 화면에서 바뀌는 것 |
|---|---|---|---|---|
| 흡수력 | 팽압이 커질수록 흡수력이 준다는 것 | 계산 상자 + 그래프 | 세포 부피 슬라이더 | 세 막대, 곡선 위 표시선, 상태 글 |

- 학습 목표와 핵심 개념은 3~6개.
- 3번 질문에서 고른 헷갈리는 지점을 먼저 다룬다. 4번에서 고른 활동은 반드시 넣는다.
- 활동의 기준: 학생이나 교사가 값을 바꾸거나 고르면 **화면이 그 입력으로 계산해서 달라진다.** 누르면 글이 나타나기만 하는 것은 PPT로도 되므로 활동으로 치지 않는다.
- 한 장에 활동 하나. 전체 장의 3분의 1 이상을 활동 장으로.

---

## 3. 부품 사전

엔진이 동작을 붙인다. 수업 HTML에는 구조와 `data-*` 속성만 쓴다. 맞춤 `<script>`는 부품으로 안 될 때만 쓴다(이 문서 끝 '맞춤 스크립트').

`data-why`·`data-hint`·`data-stops` 같은 속성 값은 글자만 된다(태그 없음). 위첨자·아래첨자는 유니코드로 쓴다(Na⁺, H₂O, x²).

### 0. 뼈대와 공통 모양

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
| 표지 | 아래 '표지' 예시 | `img.cover-art`는 오른쪽 560px를 차지한다. 제목은 왼쪽 600px 안에서 `<br>`로 나눈다(겹치면 점검 경고). 그림의 보일 부분은 `style="object-position: 20% 50%"`로 고른다 |
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

### 1. 단계 막대 `.reveal`

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

### 2. 비교 전환 `.switch`

```html
<div class="switch" id="fr" data-stops="시작|7월 혁명 1830|2월 혁명 1848">
  <dl data-only="1">…</dl>
  <dl data-only="2">…</dl>
</div>
```

단추형 단계 막대. 단추 줄과 "단추를 눌러 보자" 안내는 `.switch` 안 맨 위에 붙는다(단계 막대의 슬라이더는 맨 아래). 처음엔 아무 단추도 눌려 있지 않다. 나머지는 단계 막대와 같다.

### 3. 그림 지도 단계 공개 `figure.map-reveal`

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

### 4. 연표 막대 `ol.yearline`

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

### 5. 분류 카드 `.sort`

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
- 칸 안의 빈 곳이나 이미 놓인 카드를 눌러도 그 칸에 놓인다.
- 높이: 풀기 전에는 카드 더미가 칸 위에 놓여 다 푼 뒤보다 길다. 카드 한 줄 60px, 빈 칸 120px, 「다시」·알림 줄 56px, 사이 16px. 칸 2개에 카드 6장(두세 줄)이면 약 400px다. 발문이 두 줄이면 제목(`h2`)을 빼거나 카드를 줄인다. 칸 높이는 이 수업 CSS로 바꾼다(`.bin { min-height: 100px }`).

### 6. 즉시 확인 문제 `.quiz`

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
- 점검은 가장 긴 이유가 나온 상태(여러 개 고르기는 이유가 가장 긴 두 보기를 틀린 상태)까지 잰다. 이유는 한 문장으로 짧게.
- 번호 ①②는 엔진이 붙인다(`data-num="off"`로 끔). `data-cols`로 열 수.
- 높이: 보기 한 줄 64px, 사이 12px, 아래 알림 줄 약 60px. 보기 5개면 약 380px다.
- 처음 맞히면 문제 뒤 첫 `.step`을 연다. 인쇄는 정답 표시.

### 7. 순서 배열 `ol.order`

```html
<ol class="order">
  <li data-why="처음에는 시야가 넓은 저배율로 찾는다.">저배율 대물렌즈로 돌린다</li>
  <li data-why="…">프레파라트를 재물대에 고정한다</li>
</ol>
```

정답 순서로 쓴다. 엔진이 섞어 내놓고, 학생이 차례로 눌러 쌓으면 자리마다 채점한다. 맞은 칸 아래에 `data-why`가 붙어 길어지므로 항목은 5개 안팎, 이유는 한 줄로. 모두 맞으면 뒤 `.step`을 연다.

### 8. 계산 상자 `.calc` — 입력하면 화면이 계산해서 바뀐다

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
- 단추 값(`data-value`)은 수처럼 생기면 수(`year == 1918`), 아니면 글자(`sex == '여'`)다.
- 출력: `data-expr`(글자, `data-digits` 소수 자리, `data-unit` 단위, `data-comma` 천 단위 쉼표 3,000), `data-show`(참이면 보임), `data-class="클래스: 식; …"`, `data-style="속성: 식"`(숫자는 px, `--변수`는 그대로), `data-attr="속성: 식"`(SVG), `.bar[data-value][data-max]`(막대 길이).
- 식 문법: 수, `'글자'`, `+ - * / % ^`, `== != < <= > >=`, `&& || !`, `조건 ? 가 : 나`, `× ÷ − ≤ ≥ ≠`도 된다. 함수: `abs min max round(x,n) floor ceil sqrt pow exp ln log(10이 밑) sin cos tan asin acos atan rad deg clamp(x,lo,hi) if(c,a,b) fix(x,n) len(글자) sign`. 상수 `pi e true false`. 글자 + 수는 이어 붙인다.
- 단위: 한글 단위(`초`·`원`·`인분`·`년`)는 숫자에 붙고(360초), 기호 단위(`℃`·`mL`·`%`)는 한 칸 띄운다(10 ℃). 단위 앞에 빈칸을 넣지 않는다.
- 식이 틀리면 그 자리에 '?'가 나오고 점검(D)에 오류로 뜬다. 근거 없는 수치를 지어내지 않는다. 단위를 쓴다.
- 계산 상자의 슬라이더는 중간값에서 시작해도 된다(단계를 여는 막대가 아니다).
- 입자·점이 많은 모식도는 `data-attr`로 점마다 식을 쓰지 말고 입자 상자 `figure.particles`(교과 지침: 과학)를 쓰거나, 그림 몇 장을 단계 막대로 바꾼다.

### 9. 그래프 `figure.plot`

```html
<figure class="plot" data-x="0.85, 1.35" data-y="0, 11" data-height="340" data-xlabel="세포의 상대적 부피" data-ylabel="압력(기압)">
  <i data-line="k / x" data-label="삼투압" data-color="#0F766E"></i>
  <i data-line="k / x - (x <= 1 ? 0 : 6.44 * ((x - 1) / 0.35) ^ 1.6)" data-label="흡수력" data-dash></i>
  <i data-vline="v"></i>
  <i data-point="v, s" data-label="지금"></i>
</figure>
```

`.calc` 안에 두면 그 변수(v, s, k…)를 쓰고 입력이 바뀔 때마다 다시 그린다. 곡선의 가로 변수는 `x`. 폭은 감싼 칸 폭, 높이는 `data-height`. 가로 기준선은 상수 식(`<i data-line="vmax" data-dash>`), 점 색은 `data-color`.

| 하고 싶은 것 | 쓰는 법 |
|---|---|
| 눈금 간격 정하기, 천 단위 쉼표 | 그래프에 `data-ystep="500"`·`data-xstep`, `data-comma`(4,000). 눈금 글자가 길면 왼쪽 여백이 저절로 늘어 세로축 이름과 겹치지 않는다 |
| 선을 일부 구간만 | 선에 `data-x="10, 60"`(식도 된다: `data-x="min(a, b), max(a, b)"`) |
| 조건이 맞을 때만 선·점 | `data-show="qd != qs"`. 거짓이면 선과 범례가 함께 숨는다 |
| 측정값(표의 점 여러 개) | `<i data-points="10, 360; 20, 260; 40, 160" data-label="측정값"></i>` 점으로 찍히고 범례에 동그라미 |
| 범례 | `data-label`이 있는 선·측정값이 그래프 위에 범례로 나온다. 움직이는 점의 이름은 점 옆에 |

예: 가격 슬라이더 `p`에 따라 초과량 구간만 굵게 보이기 `<i data-line="p" data-x="min(qd, qs), max(qd, qs)" data-show="qd != qs" data-label="초과량"></i>`.

### 10. 그림 자리 `img[data-ppt]`

```html
<img data-ppt="12-2" alt="빈 회의 풍자화" width="480">
```

- 코드를 실행할 수 없어 그림을 못 넣을 때만 쓴다. `12-2`는 원본 PPT 12쪽의 2번째 그림(슬라이드 XML의 그림 순서, `extract_pptx.py`의 번호와 같다).
- 선생님이 원본 PPTX를 화면에 끌어다 놓으면 채워지고, ⚙ 「그림 넣어 저장」으로 파일에 넣는다.

### 11. 교실 도구

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

### 12. 맞춤 스크립트(마지막 수단)

```html
<script>
document.addEventListener('DOMContentLoaded', () => {
  ClassHTML.onShow((slide, i) => { /* 장이 보일 때 */ });
});
</script>
```

- `</body>` 바로 앞에 둔다. `ClassHTML.onShow/onHide/go/next/prev/audit`를 쓴다. `innerHTML`로 학생 입력을 넣지 않는다.
- 펜을 든 채로 쓰는 규칙: 누르는 요소는 `button`·`a`·`label` 또는 `data-tap`, 끄는 요소(슬라이더가 아닌 것)는 `data-no-ink`.

### 점검 코드(D 키, `?audit`)

| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `slide-overflow`, `out` | 무대 밖으로 넘침 | 글자를 줄이지 말고 장을 나누거나 배치를 바꾼다 |
| `clip` | 상자 안 내용이 잘림 | 상자 높이·글 양 |
| `tiny-text` | 20px 미만 글자(SVG 안 글자는 실제 크기) | 글자 키우기, 그림 폭 키우기 |
| `part` | 부품 작성 실수(칸 없는 카드, 정답 없는 문제, 식 오류, 어느 막대인지 모르는 data-at …) | 메시지대로 |
| `not-veiled` | 부품 밖 슬라이더가 중간에서 시작 | 단계형이면 `.reveal`로 |
| `few-activities` | 활동 장이 3분의 1 미만 | 개념마다 활동을 하나 더 |
| `empty-image`, `no-alt`, `dup-id` | 빈 그림 자리, 그림 설명 없음, 중복 id | |

---

## 4. PPT 패턴 → 부품

PPT를 옮기지 말고, 슬라이드가 하려던 일을 HTML에서만 되는 방식으로 바꾼다.

| PPT에서 보이는 것 | 바꾸는 방법 |
|---|---|
| 질문 슬라이드 다음에 답 슬라이드 | 한 장으로 합치고 `.answer` 또는 `.step` |
| "확인 학습", "형성 평가", 객관식 | `.quiz`, 보기마다 `data-why` |
| "모두 고르시오" | `.quiz[data-multi]` |
| 연도 나열, 연표 그림 | `ol.yearline` |
| 시기별 영토·세력 지도 | `figure.map-reveal`(근사 다각형) |
| 두 사건·개념을 같은 틀로 비교 | `.switch` + 같은 표 모양 |
| 개념을 두세 무리로 나누는 표 | `.sort`(카드를 무리로) |
| 실험·조리·사건의 순서 | `ol.order` |
| 공식과 그 값의 표 | `.calc`(값을 바꾸면 계산) |
| 수치 표, 그래프 그림 | `.calc` + `figure.plot` |
| 단계가 있는 그림(과정, 순환) | `.reveal` + `.veil` + `data-at` |
| 핵심어에 빈칸 | `.blank`(활동으로 치지 않음) |
| 외부 링크 | `a.pill` |
| 글 없이 그림 위주인 슬라이드 | 큰 `figure.fig` + 발문 `.q` |
| 정의 | `mark`로 핵심어, 바로 뒤에 확인 `.quiz` |
| 단원 표지 | `.slide.cover` + `.band` + `img.cover-art` |
| 학습 목표 | 한두 문장 + 핵심어 카드. 활동으로 치지 않음 |

한 장에 넘치면 나눈다. PPT 한 장이 HTML 두 장이 되어도 된다. 반대로 질문과 답처럼 짝인 장은 하나로 합친다.

---

## 5. 화면과 디자인

### 교실 화면

- 전자칠판(16:9). 무대 1280×720을 창에 맞춰 엔진이 확대·축소한다. 교실 맨 뒤에서도 읽혀야 한다.
- 글자: 장 제목 40~44px, 본문 28px(엔진 기본), 어떤 글자도 20px 미만 금지(직접 그린 SVG 안 글자도 실제 크기로 잰다). 넘치면 글자를 줄이지 말고 **장을 나눈다**.
- 쓸 수 있는 높이: ppt 테마는 위 112·아래 56을 뺀 552px(제목 포함), paper 테마는 위 72·아래 64를 뺀 584px. 점검의 넘침 메시지가 넘친 px와 맨 아래 요소를 알려 준다. 몇 px라면 여백·그림 크기를 줄이고, 많이 넘치면 장을 나눈다.
- 긴 제시문 + 보기 문항(수능형): 제시문은 왼쪽, 보기는 오른쪽 두 칸으로 놓는다. 제시문만 22~24px까지 줄여도 된다. 보기가 반 폭에서 두 줄이 되거나 제시문이 8줄을 넘으면 처음부터 제시문 장과 보기 장으로 나누고, 보기 장 위에 제시문 요약 한 줄을 둔다.
- 누르는 것은 56px 이상(엔진 부품은 이미 맞춰져 있다). 마우스를 올려야만 되는 기능은 만들지 않는다.
- 빈 곳을 눌러 넘기는 기능은 없다(판서 중 사고 방지). 넘기기는 → Space PageDown, ← PageUp, 숫자+Enter, 툴바 ◀ ▶.
- 판서·칠판·반별 저장·인쇄는 엔진이 한다. 수업 HTML에 따로 만들지 않는다.

### 테마와 색

`<body data-theme="…" style="--accent:#…">`

| 테마 | 모습 | 쓰는 때 |
|---|---|---|
| `paper`(기본) | 따뜻한 종이색, 강조색 하나 | 원본 PPT 색이 없거나 단순할 때 |
| `ppt` | 흰 바탕, `data-sec`가 왼쪽 위 색 띠 | 원본 PPT의 대표 색을 이을 때(권장) |
| `grid` | 32px 모눈 | 수학·과학 풀이 |
| `chalk` | 어두운 초록 칠판, 흰 펜 | 칠판 느낌 |

원본 PPT 색 잇기:

1. `extract_pptx.py`가 만든 `theme.json`의 `css` 줄을 그대로 쓴다. 예: `body[data-theme="ppt"] { --accent: #C04F15; --tab: #FFDE21; --tab-ink: #1F3B70; }`
2. 단원 성격마다 띠 색이 다르면 `data-sec`로 나눈다.

```css
.slide[data-sec="내용 정리"] { --tab: #FFDE21; --tab-ink: #1F3B70; }
.slide[data-sec="확인 학습"] { --tab: #A77540; }
```

- 색 변수: `--accent`(제목 번호·단추·막대), `--tab`·`--tab-ink`(머리 띠와 그 글자), `--table-head`·`--table-side`(비교표, 기본은 띠 색을 옅게), `--pill`(자료 단추), `--qnum`(문항 번호), `--flag`·`--yl-c`(연표), `--bar-c`(계산 막대), `--map-new`(지도 새 땅 테두리).
- 글자 대비는 4.5:1 이상. 밝은 띠(노랑 등)에는 어두운 `--tab-ink`.

### 배치

- 두 칸 배치는 `display: grid; grid-template-columns: 1fr 480px; gap: 36px;`처럼 이 수업 CSS에 쓴다.
- 그림 폭을 정하면 높이가 따라 커진다. 지도·그림 + 막대(약 110px)가 무대 높이(제목 아래 약 480px) 안에 들어가게 폭을 고른다.
- 한 화면의 움직임은 두세 가지. 엔진의 단계·부품 효과로 충분하다. 큰 확대·회전·끝없는 움직임은 쓰지 않는다.

### 0단계에서 시작

단계 막대·연표·지도·비교 전환은 **아무것도 공개되지 않은 상태**에서 시작한다. 엔진 부품은 그렇게 동작한다. 직접 만든 슬라이더로 단계를 열지 않는다(점검 `not-veiled`).

### 인쇄

Ctrl+P로 장마다 한 쪽. 엔진이 단계는 모두 펼치고, 단계 막대는 끝 칸, 문제는 정답 표시, 분류 카드는 정답 칸에 넣어 인쇄한다. ⚙ 「인쇄에 판서 포함」을 켜면 지금 반의 판서와 칠판도 함께 나온다.

### 그림

- 외부 그림 주소를 쓰지 않는다. `data:` URI(긴 변 1600px 이하) 또는 그림 자리 `img[data-ppt]`. 사진·만화 같은 큰 PNG는 JPEG로 바꾸면 훨씬 작다(`bundle.py`가 Pillow·sips로 바꾼다).
- 링크는 `a.pill`로(영상·사료 주소). 원본 PPT의 로컬 파일 링크(mp4 등)는 학교 PC에서만 열리므로 '원본 PPT 22쪽 영상'처럼 적거나 뺀다.
- 모든 그림에 `alt`. 교과서 지도·사진은 출처를 그림 설명에 쓴다.
- 학생 실명·사진을 넣지 않는다.

---

## 6. 한국어 문장

PPT의 사실·정의·정답·자료 출처는 바꾸지 않는다. 문장은 뜻을 지키며 다시 쓴다(윤문).

**우선순위**: PPT 원문(정의·정답·사료·시험 문제·교과서 인용)은 아래 말투 규칙보다 앞선다. 원문에 '~를 통해'가 있어도 정의 문장이면 그대로 둔다. 말투 규칙은 AI가 새로 쓰거나 고쳐 쓰는 문장에 적용한다.

### 규칙

1. 한 문장에는 생각 하나. 화살표(→)로 길게 잇지 말고 문장이나 단계로 나눈다.
2. 문장 끝을 맞춘다. 개념 설명은 '-다'로 끝나는 평서문, 발문은 '-까?', 활동 지시는 '-해 보자'.
3. 맞춤법과 띄어쓰기를 지킨다. 의존 명사(것, 수, 때), 수와 단위(10 mL, 1830년), 고유 명사를 확인한다.
4. 줄은 의미 단위로 바꾼다. 제목과 핵심 문장은 의미가 끊기는 곳에 `<br>`을 직접 넣는다.
   - 조사나 어미가 줄 맨 앞에 오지 않게 한다.
   - 숫자와 단위, 괄호 안 내용, 고유 명사는 한 줄에 둔다.
   - 엔진이 어절 단위로 줄을 바꾸므로(`word-break: keep-all`) 낱말 중간에서는 끊기지 않는다.
5. AI가 새로 만든 설명·문항·예시는 그 요소에 `data-ai="무엇"`을 붙인다(화면에는 안 보이고 점검 D에서 보인다).

### 쓰지 않는 말투

'함께 알아볼까요?', '~해 봅시다!', '정말 중요해요', '핵심은 ~입니다', '~라고 할 수 있습니다', '~하는 것이 중요합니다', '다양한', '효과적으로', '~를 통해', '~에 대해', '되어지다', 느낌표 남발, 이모지, '여러분'으로 시작하는 문장.

### 고쳐 쓰기의 예

| 원문(PPT) | 고친 글 |
|---|---|
| 산업 혁명 → 도시 인구 증가 → 노동 문제 발생(장시간 노동, 낮은 임금) | 산업 혁명으로 도시 인구가 크게 늘었다.<br>그러자 노동 문제가 생겼다.<br>(장시간 노동, 낮은 임금) |
| 세포막을 통한 물질 이동의 다양한 방식에 대해 알아봅시다! | 물질은 세포막을 어떻게 지나갈까? |
| 농도가 높은 곳에서 낮은 곳으로 물질이 이동하는 현상을 확산이라고 할 수 있습니다. | 물질이 농도가 높은 곳에서 낮은 곳으로 퍼져 나가는 현상을 확산이라고 한다. |
| 차티스트 운동을 통해 노동자들은 참정권 확대를 요구했음 | 노동자들은 차티스트 운동을 벌여 참정권을 넓히라고 요구했다. |

쓰지 말 글: "프랑스 혁명은 유럽에 큰 영향을 미쳤다고 할 수 있습니다. 이를 통해 다양한 변화가 나타났어요!"

### 피드백 문장(문제·카드의 data-why, data-hint)

- 맞을 때: "맞다. ○○이다. (이유 한 문장)"
- 틀릴 때: 왜 아닌지 사실로 말한다. "○○은 1830년 프랑스에서 일어났다." 학생을 탓하지 않는다.
- 실마리(data-hint): 답을 말하지 않고 생각할 거리를 준다. "움직이는 것은 물일까, 냄새 분자일까?" 엔진이 앞에 "다시 생각해 보자."를 붙이므로 그 말로 시작하지 않는다.
- 분류 카드를 모두 맞히면 엔진이 "모두 맞혔다!"를 붙인다. 마지막 카드의 이유는 그 뒤에 이어 읽혀도 자연스럽게 쓴다.

---

## 7. 교과 지침: 과학(물리·화학·생명과학·지구과학)

### 자주 나오는 PPT와 바꾸는 법

| PPT | HTML |
|---|---|
| 공식 + 표(농도·온도·압력 값) | `.calc`로 값을 바꾸면 결과·막대·그림이 계산된다 |
| 그래프 그림 | `figure.plot`로 같은 식을 그리고, 지금 값에 표시선 |
| 모식도(세포·원자·지층) | SVG를 직접 그리고 `data-attr`로 크기·위치를 값에 묶는다 |
| 실험 과정 | `ol.order` + 안전 주의는 `.answer` 또는 단계 |
| 개념 구분(확산/삼투, 산/염기) | `.sort` |
| 순환·과정 그림 | `.reveal` + `data-at` |
| 확산·삼투·기체 운동(입자 그림) | `figure.particles`(입자 상자): 막 양쪽 개수와 통과 여부를 정하면 입자가 움직이며 개수가 바뀐다 |

### 입자 상자 `figure.particles`

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

### 규칙

- 식과 수치는 교과서 수준에서 정확해야 한다. 근거가 없는 수치는 지어내지 않는다. 모형 수치를 쓰면 `data-ai="모형 수치"`로 표시하고 화면에 '모형'이라고 적는다.
- 슬라이더 옆에 지금 값과 단위를 쓴다(`data-unit`). 극단값(최솟값·최댓값)에서도 식이 말이 되는지 확인한다(0으로 나누기 → '?').
- 변수 이름은 교과서 기호를 쓴다(`v`, `T`, `C`). 화면에는 한글 이름을 함께 적는다.

### 예: 흡수력 = 삼투압 − 팽압

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

---

## 8. 교과 지침: 사회(역사·지리·일반사회·윤리)

### 자주 나오는 PPT와 바꾸는 법

| PPT | HTML |
|---|---|
| 시기별 영토 지도(교과서 그림) | `figure.map-reveal`: 지도 그림 + 근사 다각형, 0단계는 전부 가림 |
| 연표 | `ol.yearline`(→로 사건 해마다) |
| 두 사건 비교(혁명, 정책) | `.switch` + 같은 표 모양, `data-pos`로 도식 강조 |
| 사상·사건 분류 | `.sort` |
| 조건에 따른 판정(선거권, 세금, 인구) | `.calc` + `data-set` 단추 + 슬라이더 |
| 사료 링크 | `a.pill` |
| 사건 전개 | `ol.order` 또는 `.reveal` |

### 윤리(생활과 윤리·윤리와 사상)

| PPT | HTML |
|---|---|
| 사상가·이론 구분(신경윤리학/진화윤리학 등) | `.sort`(주장·근거 카드를 이론 칸으로), 정리 `.step` |
| 두 제시문 (가)/(나) 비교 | `.switch` + 같은 모양의 표(주장·근거·한계 행) |
| 논증의 한계(사실에서 당위를 끌어낼 수 없다 등) | `.calc` + `data-set` 단추: 전제(사실)를 고르고 결론 종류를 고르면 '타당한가'와 빠진 전제가 계산되어 나온다 |
| 사례 만화(말풍선) | 그림 그대로 + `.reveal`로 장면 차례 공개, 말풍선 글은 아래에 다시 쳐서 |
| 수능형 문항(제시문 + 보기) | 화면과 디자인의 '긴 제시문' 배치. 정답이 PPT에 없으면 `data-ai="정답 확인 필요"` |

### 지도 규칙

- 역사 국경은 정확히 그릴 수 없다. 원본 지도 그림 위에 근사 다각형을 겹치고 '근사'를 표시한다(엔진이 꼬리표를 붙인다).
- 다각형 좌표는 `<svg viewBox="0 0 그림폭 그림높이">` 안에서 그림 픽셀 기준으로 잡는다. 순서와 지역이 사실과 맞아야 한다.
- 그 칸에 새로 열리는 땅만 `data-from`. 잃은 땅은 `data-lost`(빗금).
- 옆 설명은 칸마다 `data-only`로 한 문단씩. 지도가 한 장에 둘이면 `data-for`.

### 예: 통일 과정 지도

```html
<section class="slide" id="italy" data-sec="내용 정리" data-title="이탈리아의 통일">
  <h2 data-n="4">이탈리아의 통일</h2>
  <div style="display:grid;grid-template-columns:600px 1fr;gap:30px">
    <figure class="map-reveal fig" id="map-italy" data-stops="시작|1859년 이전|1859~60|1860~61|1866|1870">
      <img src="data:image/jpeg;base64,…" alt="이탈리아의 통일 지도 (출처)">
      <svg viewBox="0 0 1600 945">
        <polygon data-lost="2" points="…"/>
        <polygon data-from="2" points="…"/>
        <polygon data-from="3" points="…"/>
      </svg>
    </figure>
    <div>
      <p data-for="map-italy" data-only="1"><b>1859년 이전</b><br>이탈리아는 여러 나라로 나뉘어 있었다.</p>
      <p data-for="map-italy" data-only="2"><b>① 카부르</b><br>사르데냐의 재상 카부르가<br>중북부 이탈리아를 병합했다.</p>
    </div>
  </div>
</section>
```

---

## 9. 교과 지침: 수학

| PPT | HTML |
|---|---|
| 함수 그래프 그림 | `.calc` 슬라이더(계수) + `figure.plot`의 `data-line="a * x ^ 2 + b"` |
| 단계 풀이 | `.step`(줄마다), 핵심 항은 `mark` |
| 표로 된 값(수열, 확률) | `.calc`로 n·확률을 바꾸면 계산 |
| 도형 성질 | SVG + `data-attr`(각·길이를 값에 묶기) |
| 개념 구분 | `.sort`, `.quiz` |

- 식 문법은 부품 사전의 '계산 상자'. 거듭제곱 `^`, `sqrt`, `abs`, `log`(밑 10), `ln`, `sin`(라디안, `rad(도)`).
- 그래프의 가로 변수는 `x`. 정의되지 않는 곳(1/x의 0)에서 선이 끊긴다.
- 수식은 `$…$`(줄 안), `$$…$$`(가운데 한 줄)로 쓰면 엔진이 KaTeX로 그린다. 계산 상자의 식(`data-let`)은 KaTeX가 아니라 엔진 식 문법이다.

예: `y = a(x − p)² + q`

```html
<div class="calc" style="display:grid;grid-template-columns:420px 1fr;gap:30px;align-items:start">
  <div>
    <p>a = <output data-expr="a"></output></p><input type="range" name="a" min="-2" max="2" step="0.5" value="1" aria-label="a">
    <p>p = <output data-expr="p"></output></p><input type="range" name="p" min="-3" max="3" step="1" value="0" aria-label="p">
    <p>q = <output data-expr="q"></output></p><input type="range" name="q" min="-3" max="3" step="1" value="0" aria-label="q">
  </div>
  <figure class="plot" data-x="-5, 5" data-y="-5, 5" data-height="420"><i data-line="a * (x - p) ^ 2 + q"></i><i data-point="p, q" data-label="꼭짓점"></i></figure>
</div>
```

---

## 10. 교과 지침: 국어

| PPT | HTML |
|---|---|
| 시어·표현법 설명 | `.sort`(표현법별로 시어 분류), `.quiz[data-multi]`(해당하는 시어 모두 고르기) |
| 지문 + 핵심어 | `mark`, `.blank` |
| 인물 관계, 사건 전개 | `.reveal`(단계마다 관계·사건 공개), `ol.order` |
| 정서 변화 | `.reveal` 칸마다 정서 설명, 또는 `figure.plot`의 점(`data-point`) |
| 고쳐 쓰기 전후 | `.switch`(전/후) |

- 인물 그림, 대화 장면(NPC), 지문 요소 강조 애니메이션은 아직 엔진 부품이 없다(M3 예정). 지금은 위 부품으로 만든다.
- 작품 원문은 저작권이 있으면 필요한 부분만 인용하고 출처를 적는다.

---

## 11. 교과 지침: 영어·제2외국어·한문

| PPT | HTML |
|---|---|
| 어순 배열 | `ol.order`(정답 순서로 단어·구) |
| 품사·문장 성분 | `.sort` |
| 어휘 확인 | `.quiz`, `.blank` |
| 끊어 읽기 | `.reveal`(칸마다 `/` 표시가 늘어난 문장) |
| 한문 현토·해석 | `.switch`(원문/현토/해석) |

- 외국어 문장에는 `lang` 속성(`<span lang="en">`)을 단다.
- 발음 듣기, 루비 토글, 획순은 아직 엔진 부품이 없다(M3 예정). 후리가나는 `<ruby>`로 쓸 수 있다.

---

## 12. 교과 지침: 정보

| PPT | HTML |
|---|---|
| 코드와 실행 결과 | `<pre><code>`(어절 보정 안 함) + `.reveal`로 줄마다 변수 표 |
| 정렬·탐색 과정 | `.reveal` 칸마다 배열 상태 |
| 이진수 | `.calc`의 체크 상자 비트: `data-let="n = b3*8 + b2*4 + b1*2 + b0"` |
| 순서도 | `ol.order` 또는 `.reveal` |

- 코드 구문 강조와 한 줄씩 실행 추적은 아직 엔진 부품이 없다(M3 예정).

---

## 13. 교과 지침: 기술·가정, 예체능

| PPT | HTML |
|---|---|
| 조리·제작 절차 | `ol.order` |
| 영양·전력·비용 계산 | `.calc`(재료량·사용 시간 슬라이더 → 합계·막대) |
| 공구·재료 분류 | `.sort` |
| 안전 수칙 확인 | `.quiz[data-multi]` |
| 작품 비교 | `.switch` |

- 음원 재생, 메트로놈, 작품 비교 슬라이더는 아직 엔진 부품이 없다(M3 예정).
