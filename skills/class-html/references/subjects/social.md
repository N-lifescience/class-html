# 사회(역사·지리·일반사회·윤리)

## 자주 나오는 PPT와 바꾸는 법

| PPT | HTML |
|---|---|
| 시기별 영토 지도(교과서 그림) | `figure.map-reveal`: 지도 그림 + 근사 다각형, 0단계는 전부 가림 |
| 연표 | `ol.yearline`(→로 사건 해마다) |
| 두 사건 비교(혁명, 정책) | `.switch` + 같은 표 모양, `data-pos`로 도식 강조 |
| 사상·사건 분류 | `.sort` |
| 조건에 따른 판정(선거권, 세금, 인구) | `.calc` + `data-set` 단추 + 슬라이더 |
| 사료 링크 | `a.pill` |
| 사건 전개 | `ol.order` 또는 `.reveal` |

## 윤리(생활과 윤리·윤리와 사상)

| PPT | HTML |
|---|---|
| 사상가·이론 구분(신경윤리학/진화윤리학 등) | `.sort`(주장·근거 카드를 이론 칸으로), 정리 `.step` |
| 두 제시문 (가)/(나) 비교 | `.switch` + 같은 모양의 표(주장·근거·한계 행) |
| 논증의 한계(사실에서 당위를 끌어낼 수 없다 등) | `.calc` + `data-set` 단추: 전제(사실)를 고르고 결론 종류를 고르면 '타당한가'와 빠진 전제가 계산되어 나온다 |
| 사례 만화(말풍선) | 그림 그대로 + `.reveal`로 장면 차례 공개, 말풍선 글은 아래에 다시 쳐서 |
| 수능형 문항(제시문 + 보기) | 화면과 디자인의 '긴 제시문' 배치. 정답이 PPT에 없으면 `data-ai="정답 확인 필요"` |

## 지도 규칙

- 역사 국경은 정확히 그릴 수 없다. 원본 지도 그림 위에 근사 다각형을 겹치고 '근사'를 표시한다(엔진이 꼬리표를 붙인다).
- 다각형 좌표는 `<svg viewBox="0 0 그림폭 그림높이">` 안에서 그림 픽셀 기준으로 잡는다. 순서와 지역이 사실과 맞아야 한다.
- 그 칸에 새로 열리는 땅만 `data-from`. 잃은 땅은 `data-lost`(빗금).
- 옆 설명은 칸마다 `data-only`로 한 문단씩. 지도가 한 장에 둘이면 `data-for`.

## 예: 통일 과정 지도

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
