# class-html · 수업 PPT 말고, 수업 HTML

> **AI에게**: 선생님이 이 저장소 주소와 수업 PPT를 주면 합본 지침 하나를 읽고 그대로 따른다.
> 지침: https://raw.githubusercontent.com/N-lifescience/class-html/main/guide/class-html-guide.md
> 만들기 전에 선생님에게 먼저 묻고(인터뷰), 설계표를 확인받은 뒤 HTML 파일 하나를 만든다.

선생님이 자기 AI(ChatGPT·Gemini·Claude)에게 수업 PPT를 주면, 판서와 활동이 들어간 수업용 HTML이 나온다. 판서·칠판·반별 저장·넘기기·인쇄·자동 점검은 이 저장소의 엔진이 맡고, AI는 수업 내용과 활동만 쓴다.

## 무엇이 다른가

- **펜을 든 채로 넘긴다.** 펜·형광펜 상태에서도 ◀ ▶, 활동 단추, 슬라이더가 그대로 작동한다. PPT처럼 펜 모드와 마우스 모드를 오가지 않는다.
- **판서가 남는다.** 장마다, 반마다 따로 저장되고 브라우저를 닫아도 남는다. 칠판 모드(흰색·모눈·초록 칠판 등)도 있다.
- **PPT로 못 하는 활동.** 값을 바꾸면 계산해서 바뀌는 시뮬레이션과 그래프, 하나씩 열리는 지도·연표, 끌어서 나누는 카드, 보기마다 이유가 나오는 문제.
- **0단계에서 시작.** 단계형 활동은 모두 가린 채 시작하고 한 칸씩 연다. 리모컨 →로도 연다.

## 선생님: 3단계로 쓰기

1. AI에게 수업 PPT를 올리고 이렇게 쓴다.
   `https://github.com/N-lifescience/class-html 지침대로 이 PPT를 수업 HTML로 바꿔줘`
   (주소를 못 읽는 AI는 `guide/class-html-guide.md` 파일을 받아 PPT와 함께 올린다.)
2. AI가 묻는 질문(교과·차시, 수업 장면, 헷갈리는 지점, 넣고 싶은 활동, 지킬 것)에 답하고, 설계표를 확인한다.
3. 받은 `.html` 파일을 더블클릭해서 수업한다. 그림 자리가 비어 있으면 원본 PPT를 화면에 끌어다 놓고, ⚙ 설정의 「그림 넣어 저장」을 누른다.

수업 중 단축키: → ← 넘기기 · P 펜 · H 형광펜 · E 지우개 · L 레이저 · Esc 손 · C 칠판 · T 목차 · F 전체 화면 · B 검정 화면 · ? 도움말 · D 자동 점검.
학교 PC가 재부팅 때 저장소를 지운다면, 반 메뉴의 「판서 백업 파일로 저장」을 쓴다.

## 저장소 구성

| 경로 | 내용 |
|---|---|
| `engine/` | 엔진(`class-html.js`·`.css`, 빌드 결과). 소스는 `engine/src`, `engine/css` |
| `skills/class-html/` | AI 지침(스킬). `SKILL.md`, `references/`(부품 사전, 인터뷰, 패턴, 화면, 한국어, 교과별), `scripts/`(`extract_pptx.py`, `bundle.py`), `assets/template.html` |
| `guide/class-html-guide.md` | 채팅 AI용 합본 지침(빌드 때 자동 생성) |
| `examples/` | 직접 만든 예시 덱(`m2-parts.html`: 모든 부품), 연수 슬라이드(`training.html`), 실습용 PPT(`practice/`: 과학 '확산', 사회 '수요와 공급', `tools/make_practice_pptx.py`로 만듦) |
| `tests/`, `tools/` | 엔진 시험, 빌드, 화면 캡처·점검(`tools/shots.mjs`) |

## 개발

Node.js 22 이상, Chrome 또는 Edge. npm 설치는 필요 없다.

```bash
node tools/build.mjs && node --test tests/unit/*.test.mjs && node tests/run-browser.mjs tests/browser/*.test.html && node tests/run-docs.mjs
```

현황: `docs/m1-status.md`(엔진 코어), `docs/m2-status.md`(공통 부품·테마·그림 채우기).

## 저작권과 개인정보

- 교과서·출판사 그림이 들어간 수업 HTML은 **수업용으로만** 쓰고 인터넷에 공개하지 않는다.
- 이 저장소에는 교과서·출판사 자료와 그 변환본을 넣지 않는다. 예시는 모두 직접 만든 것이다.
- 엔진은 학생 정보를 받거나 보내지 않는다. 판서와 활동 기록은 그 PC의 브라우저 안에만 남는다. 끌어다 놓은 PPT도 브라우저 안에서만 열린다.

라이선스: MIT (`LICENSE`).
