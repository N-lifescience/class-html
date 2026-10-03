# 수학

| PPT | HTML |
|---|---|
| 함수 그래프 그림 | `.calc` 슬라이더(계수) + `figure.plot`의 `data-line="a * x ^ 2 + b"` |
| 단계 풀이 | `.step`(줄마다), 핵심 항은 `mark` |
| 표로 된 값(수열, 확률) | `.calc`로 n·확률을 바꾸면 계산 |
| 도형 성질 | SVG + `data-attr`(각·길이를 값에 묶기) |
| 개념 구분 | `.sort`, `.quiz` |

- 식 문법은 `references/components.md` 8절. 거듭제곱 `^`, `sqrt`, `abs`, `log`(밑 10), `ln`, `sin`(라디안, `rad(도)`).
- 그래프의 가로 변수는 `x`. 정의되지 않는 곳(1/x의 0)에서 선이 끊긴다.
- 수식 조판(KaTeX)은 아직 엔진에 없다. 식은 글자로 쓰고 위첨자는 `<sup>`.

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
