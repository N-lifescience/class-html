# M2 구현·검증 현황

2026-10-03 맥미니에서 M1 마지막 리뷰 수정과 M2(공통 부품, 테마, 그림 채우기·저장, 추출 스크립트)를 구현했다. 계획서: 작업 폴더 `docs/superpowers/plans/2026-10-03-m2-parts-theme.md`.

## 부품 (작성 모양은 계획서 '작성 모양' 절)

| 부품 | 작성 모양 | 핵심 동작 |
|---|---|---|
| 단계 막대 | `.reveal[data-stops]` + `[data-at]` `[data-only]` `.veil` | 0단계(전부 가림)에서 시작, → ←로도 한 칸씩, 이전 장에서 오면 끝 칸 |
| 비교 전환 | `.switch[data-stops]` | 단추형 단계 막대, 처음엔 아무것도 안 눌림 |
| 그림 지도 단계 공개 | `figure.map-reveal` + svg `[data-from]` `[data-lost]` | 회색 가림 다각형을 한 칸씩 열고 새 땅 테두리, '근사' 꼬리표 |
| 연표 막대 | `ol.yearline > li[data-year][data-tag][data-flag]` | 연도 비례 축, 사건 해마다 한 칸, 최근 사건 4개 |
| 분류 카드 | `.sort` + `.bin[data-bin]` + `[data-bin]` 카드 | 끌기·누르기, 이유·실마리, 다 맞히면 뒤 단계 공개, 「다시」 |
| 즉시 확인 문제 | `.quiz > .opt[data-ok][data-why]`, `data-multi` | 보기마다 이유, 여러 개 고르기는 맞게·잘못·놓침 |
| 순서 배열 | `ol.order > li[data-why]` | 섞어 내놓고 차례로 쌓기, 되돌리기, 자리별 채점 |
| 정답 상자·그림 확대 | `.answer`, `figure.fig` | ✓ 단추·→로 공개, 손 모드 그림 확대 |
| 계산 상자 | `.calc[data-const][data-let]` + `data-expr/show/class/style/attr`, `.bar[data-value]`, `[data-set]` | 입력하면 식을 다시 계산(eval 없는 해석기). 단계 막대 칸도 변수(`data-name`) |
| 그래프 | `figure.plot[data-x][data-y] > i[data-line|data-vline|data-point]` | 계산 상자 변수로 곡선·표시선·점 |
| 그림 자리 | `img[data-ppt="12-2"]` | 원본 PPTX를 끌어다 놓으면 채움, 그림 바꾸기, 그림 넣어 저장, 오프라인용 저장 |
| 빈칸 | `.blank` | 핵심어를 가렸다가 눌러서 연다 |
| 교실 도구 | `.timer[data-sec]`, `.picker[data-range]`(또는 `data-items`), `.score[data-teams]`, `ul.checklist`, `figure.hotspots > .hs` | 타이머, 뽑기, 모둠 점수판, 체크리스트, 그림 핫스팟(활동으로 치지 않음) |

테마: `body[data-theme]` = `paper`(기본)·`ppt`(원본 PPT 색 띠)·`grid`·`chalk`. 색은 `--accent`, `--tab`, `--tab-ink`. 본문 28px.

자동 점검(D, `?audit`, `ClassHTML.audit()`)에 더한 것: 단계 막대 칸마다 넘침, 부품 작성 실수(`part`), 부품 밖 슬라이더 시작 값(`not-veiled`), 활동 장 3분의 1 미만(`few-activities`), 정보(활동 장 수, 그림 자리 수).

도구: `tools/shots.mjs`(장마다 캡처 + audit.json), `skills/class-html/scripts/extract_pptx.py`(글·그림·테마 색 추출, 엔진과 같은 그림 번호).

## 재현 명령 (저장소 루트)

```bash
node tools/build.mjs && node --test tests/unit/*.test.mjs && node tests/run-browser.mjs tests/browser/*.test.html && node tests/run-demo.mjs
node tools/shots.mjs examples/m2-parts.html /tmp/shots --open
```

## 검증 결과

- 단위 51개(식 해석기 16, zip 4, 추출 스크립트 1 포함), 브라우저 21쪽 235개 통과. `run-demo.mjs` 세 해상도 33항목 통과.
- 예시 덱 `examples/m2-parts.html` 13장: 점검 오류 0, 경고 2(그림 자리 시연), 활동 장 10장.
- 세계사 3-2-5를 엔진 부품만으로 다시 만들었다(저장소 밖 `작업/세계사-3-2-5-m2/`, 맞춤 스크립트 0줄, 21장, 활동 장 14장). 처음 상태·모두 연 상태 모두 점검 오류 0. 그림과 엔진을 넣은 단일 파일은 `수업 PPT/결과물 비교/세계사_3-2-5_엔진.html`(2.2MB).
- 실제 수업 PPT 3종에 추출 스크립트: 세계사 19장(그림 54), 생명 86장(그림 116), 윤리 16장(4쪽부터 글이 그림 속이라 개요가 짧다).

## 재작성 중 찾아 고친 엔진 문제

- 어절 보정이 flex·grid 상자 안 낱말 사이 띄어쓰기를 없애던 문제(M1).
- 기본 글 규칙의 우선순위가 높아 수업 HTML의 클래스가 먹지 않던 문제 → `:where(.slide)`.
- 부품 안 `span` 선택자가 어절 span에 걸려 두 낱말 이름이 겹치던 문제.
- 비교 전환이 안에 든 다른 단계 막대의 막대를 가져가던 문제.

## 남은 것

- 학교 전자칠판 실기 확인(M1 문서의 네 항목 + 부품 끌기·슬라이더).
- 다른 AI(ChatGPT·Gemini·Claude 웹) 시험: 프롬프트 v2, 그리고 이 부품을 쓰는 지침(M4)으로.
- M3 교과 부품, M4 스킬 문서·합본 지침·README, M5 공개와 연수.
- 레이저 머리 점(M1 리뷰 보류, 사용자 확인 필요).
