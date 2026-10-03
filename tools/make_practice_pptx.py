"""연수 실습용 PPT 두 개를 만든다. 내용·그림 모두 직접 만든 것이라 저작권 걱정 없이 공개한다.

사용:  python3 tools/make_practice_pptx.py [-o examples/practice]
필요:  python-pptx, Pillow (pip install --user python-pptx pillow)

선생님들이 흔히 만드는 PPT 모양을 흉내 낸다: 색 띠 제목, 글머리표, 표, 그림, 노트에 정답.
'~를 통해', 화살표로 이은 문장처럼 AI가 다듬어야 할 문장도 일부러 남긴다.
"""
import argparse
import io
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

FONT = '맑은 고딕'
PIL_FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
INK = RGBColor(0x22, 0x22, 0x22)
MUTE = RGBColor(0x6B, 0x70, 0x78)


def rgb(hexcolor):
    return RGBColor.from_string(hexcolor.lstrip('#'))


# ── 그림 ──────────────────────────────────────────────

def font(size, bold=False):
    return ImageFont.truetype(PIL_FONT, size, index=6 if bold else 2)


def png(img):
    buf = io.BytesIO()
    img.save(buf, 'PNG', optimize=True)
    buf.seek(0)
    return buf


def dot(d, x, y, r, fill):
    d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def img_perfume():
    """향수병에서 냄새 입자가 퍼져 나가 뒷자리 학생에게 닿는 모습."""
    W, H = 1200, 700
    im = Image.new('RGB', (W, H), '#F4FBFA')
    d = ImageDraw.Draw(im)
    d.rectangle([0, 560, W, H], fill='#E2EFEC')                 # 바닥
    d.rectangle([60, 470, 300, 560], fill='#C9A27E')            # 교탁
    d.rounded_rectangle([120, 300, 240, 470], 28, fill='#B9E3F0', outline='#4A90A4', width=6)
    d.rectangle([158, 250, 202, 300], fill='#4A90A4')           # 병목
    d.rounded_rectangle([140, 210, 220, 252], 10, fill='#7A5C9E')  # 뚜껑(열어 둠, 옆에)
    rnd = random.Random(7)
    for _ in range(170):                                        # 병 가까이 촘촘, 멀수록 듬성
        t = rnd.random() ** 1.6
        x = 210 + t * 820 + rnd.uniform(-30, 30)
        y = 250 - math.sin(t * 2.6) * 60 + rnd.gauss(0, 40 + t * 80)
        dot(d, x, y, 9, '#C774D9')
    d.rectangle([900, 470, 1130, 560], fill='#C9A27E')          # 책상
    dot(d, 1015, 300, 52, '#F2C9A0')                            # 학생 머리
    d.rounded_rectangle([945, 355, 1085, 470], 40, fill='#5B8DEF')
    return png(im)


def img_ink_model():
    """처음 · 1분 뒤 · 5분 뒤: 잉크 입자(빨강)가 물 입자(파랑) 사이로 퍼진다."""
    W, H = 1500, 620
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    rnd = random.Random(3)
    labels = ['처음', '1분 뒤', '5분 뒤']
    spread = [0.12, 0.45, 1.0]
    for k in range(3):
        x0, y0, bw, bh = 60 + k * 480, 60, 420, 440
        d.rectangle([x0, y0, x0 + bw, y0 + bh], outline='#3B4A5A', width=6)
        water = []
        for _ in range(70):
            water.append((x0 + rnd.uniform(18, bw - 18), y0 + rnd.uniform(18, bh - 18)))
        for (x, y) in water:
            dot(d, x, y, 11, '#9CC9F5')
        cx, cy = x0 + 80, y0 + 80
        for _ in range(24):
            s = spread[k]
            x = cx + rnd.uniform(-60, 60) * (1 - s) + rnd.uniform(-60, bw - 100) * s
            y = cy + rnd.uniform(-60, 60) * (1 - s) + rnd.uniform(-60, bh - 100) * s
            dot(d, min(max(x, x0 + 16), x0 + bw - 16), min(max(y, y0 + 16), y0 + bh - 16), 12, '#E0464E')
        f = font(46, True)
        tw = d.textlength(labels[k], font=f)
        d.text((x0 + bw / 2 - tw / 2, y0 + bh + 26), labels[k], font=f, fill='#222222')
    return png(im)


def img_beakers():
    """찬물(10 ℃)과 따뜻한 물(60 ℃) 비커에 잉크를 떨어뜨리는 장면."""
    W, H = 1100, 700
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    for k, (label, water) in enumerate([('10 ℃', '#D6EBFB'), ('60 ℃', '#FBE1D6')]):
        x0 = 120 + k * 500
        d.rectangle([x0, 330, x0 + 340, 640], fill=water)      # 물
        d.line([x0, 200, x0, 640, x0 + 340, 640, x0 + 340, 200], fill='#3B4A5A', width=8, joint='curve')
        d.polygon([(x0 + 150, 120), (x0 + 190, 120), (x0 + 175, 170), (x0 + 165, 170)], fill='#8A8F98')  # 스포이트 끝
        d.rounded_rectangle([x0 + 140, 30, x0 + 200, 125], 14, fill='#C3C7CE')
        dot(d, x0 + 170, 220, 14, '#3949AB')                     # 잉크 방울
        f = font(56, True)
        tw = d.textlength(label, font=f)
        d.text((x0 + 170 - tw / 2, 440), label, font=f, fill='#B3261E' if k else '#1F5FAF')
    return png(im)


def img_watermelon():
    """여름 해와 겨울 눈송이 사이의 수박."""
    W, H = 1100, 620
    im = Image.new('RGB', (W, H), '#FFF8EE')
    d = ImageDraw.Draw(im)
    dot(d, 150, 150, 80, '#FFC83D')                             # 해
    for a in range(0, 360, 30):
        r = math.radians(a)
        d.line([150 + math.cos(r) * 100, 150 + math.sin(r) * 100, 150 + math.cos(r) * 135, 150 + math.sin(r) * 135], fill='#FFC83D', width=10)
    cx, cy = 950, 150                                           # 눈송이
    for a in range(0, 180, 30):
        r = math.radians(a)
        d.line([cx - math.cos(r) * 90, cy - math.sin(r) * 90, cx + math.cos(r) * 90, cy + math.sin(r) * 90], fill='#6FA8DC', width=12)
    d.pieslice([300, 220, 800, 720], 180, 360, fill='#2E8B3E')  # 껍질
    d.pieslice([325, 245, 775, 695], 180, 360, fill='#F2F7E9')
    d.pieslice([345, 265, 755, 675], 180, 360, fill='#E8414A')  # 속
    rnd = random.Random(5)
    for _ in range(16):
        a = math.radians(rnd.uniform(200, 340))
        rr = rnd.uniform(90, 170)
        x, y = 550 + math.cos(a) * rr, 470 + math.sin(a) * rr
        d.ellipse([x - 8, y - 13, x + 8, y + 13], fill='#222222')
    d.rectangle([0, 470, W, H], fill='#FFF8EE')
    return png(im)


def img_supply_demand():
    """수요 곡선과 공급 곡선, 균형점 E. 6쪽 표의 값과 같다."""
    W, H = 1200, 860
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    ox, oy = 190, 730                                           # 원점
    sx, sy = 1.6, 0.25                                          # 1인분 → 1.6px, 1원 → 0.25px
    X = lambda q: ox + q * sx
    Y = lambda p: oy - (p - 1500) * sy * 1.0 if p >= 1500 else oy
    d.line([ox, 60, ox, oy, 1120, oy], fill='#222222', width=5)
    f, fb = font(34), font(38, True)
    for p in (2000, 2500, 3000, 3500, 4000):
        d.line([ox - 12, Y(p), ox, Y(p)], fill='#222222', width=4)
        t = f'{p:,}'
        d.text((ox - 24 - d.textlength(t, font=f), Y(p) - 20), t, font=f, fill='#222222')
    for q in (100, 200, 300, 400, 500):
        d.line([X(q), oy, X(q), oy + 12], fill='#222222', width=4)
        t = str(q)
        d.text((X(q) - d.textlength(t, font=f) / 2, oy + 20), t, font=f, fill='#222222')
    d.text((ox - 150, 20), '가격(원)', font=fb, fill='#222222')
    d.text((1000, oy + 70), '수량(인분)', font=fb, fill='#222222')
    d.line([X(100), Y(4000), X(500), Y(2000)], fill='#1D4E89', width=9)   # 수요
    d.line([X(100), Y(2000), X(500), Y(4000)], fill='#E8590C', width=9)   # 공급
    d.text((X(500) + 14, Y(2000) - 24), '수요 곡선', font=fb, fill='#1D4E89')
    d.text((X(500) + 14, Y(4000) - 24), '공급 곡선', font=fb, fill='#E8590C')
    ex, ey = X(300), Y(3000)
    for i in range(int(ox), int(ex), 24):
        d.line([i, ey, min(i + 12, ex), ey], fill='#888888', width=3)
    for j in range(int(ey), int(oy), 24):
        d.line([ex, j, ex, min(j + 12, oy)], fill='#888888', width=3)
    dot(d, ex, ey, 14, '#222222')
    d.text((ex + 18, ey - 60), 'E', font=font(44, True), fill='#222222')
    return png(im)


# ── 슬라이드 ──────────────────────────────────────────

def set_font(run, size, bold=False, color=INK):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = FONT
    rpr = run._r.get_or_add_rPr()
    for tag in ('a:ea', 'a:cs'):
        el = rpr.find(qn(tag))
        if el is None:
            el = rpr.makeelement(qn(tag), {})
            rpr.append(el)
        el.set('typeface', FONT)


def textbox(slide, x, y, w, h, paras, size=22, color=INK, bold=False, align=None, anchor=None):
    """paras: 문자열 또는 (문자열, {size, bold, color, bullet, level}) 목록."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    if anchor:
        tf.vertical_anchor = anchor
    for i, item in enumerate(paras):
        text, opt = (item, {}) if isinstance(item, str) else item
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if align:
            p.alignment = align
        p.space_after = Pt(opt.get('after', 8))
        p.level = opt.get('level', 0)
        if opt.get('bullet'):
            text = f'{opt["bullet"]} {text}'
        r = p.add_run()
        r.text = text
        set_font(r, opt.get('size', size), opt.get('bold', bold), opt.get('color', color))
    return tb


def picture(slide, data, x, y, w=None, h=None, alt=''):
    pic = slide.shapes.add_picture(data, Inches(x), Inches(y), Inches(w) if w else None, Inches(h) if h else None)
    pic._element.nvPicPr.cNvPr.set('descr', alt)
    return pic


def table(slide, x, y, w, rows, col_w=None, head_fill='#DDDDDD', size=20, row_h=0.6, side_head=True):
    shape = slide.shapes.add_table(len(rows), len(rows[0]), Inches(x), Inches(y), Inches(w), Inches(row_h * len(rows)))
    tbl = shape.table
    if col_w:
        for i, cw in enumerate(col_w):
            tbl.columns[i].width = Inches(cw)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = tbl.cell(r, c)
            cell.text = ''
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            run = p.add_run()
            run.text = str(val)
            head = r == 0 or (side_head and c == 0)
            set_font(run, size, head, INK)
            cell.fill.solid()
            cell.fill.fore_color.rgb = rgb(head_fill) if head else RGBColor(0xFF, 0xFF, 0xFF)
    return shape


class Deck:
    def __init__(self, accent, tab, tab_ink='#222222'):
        self.prs = Presentation()
        self.prs.slide_width = Inches(13.333)
        self.prs.slide_height = Inches(7.5)
        self.accent, self.tab, self.tab_ink = accent, tab, tab_ink

    def blank(self):
        return self.prs.slides.add_slide(self.prs.slide_layouts[6])

    def notes(self, slide, text):
        slide.notes_slide.notes_text_frame.text = text

    def cover(self, kicker, title, sub):
        s = self.blank()
        bg = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, self.prs.slide_width, self.prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = rgb(self.accent)
        bg.line.fill.background()
        bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(2.0), Inches(0.18), Inches(2.6))
        bar.fill.solid()
        bar.fill.fore_color.rgb = rgb(self.tab)
        bar.line.fill.background()
        white = RGBColor(0xFF, 0xFF, 0xFF)
        textbox(s, 1.3, 1.9, 11, 0.6, [kicker], size=22, color=white)
        textbox(s, 1.3, 2.6, 11, 1.3, [title], size=48, color=white, bold=True)
        textbox(s, 1.3, 3.9, 11, 0.8, [sub], size=28, color=white)
        return s

    def page(self, title, tag):
        s = self.blank()
        band = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, self.prs.slide_width, Inches(1.05))
        band.fill.solid()
        band.fill.fore_color.rgb = rgb(self.accent)
        band.line.fill.background()
        textbox(s, 0.5, 0.18, 10.2, 0.75, [title], size=30, color=RGBColor(0xFF, 0xFF, 0xFF), bold=True, anchor=MSO_ANCHOR.MIDDLE)
        pill = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(11.0), Inches(0.28), Inches(1.9), Inches(0.5))
        pill.fill.solid()
        pill.fill.fore_color.rgb = rgb(self.tab)
        pill.line.fill.background()
        tf = pill.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = tag
        set_font(r, 18, True, rgb(self.tab_ink))
        return s

    def save(self, path):
        self.prs.save(path)


def science(out):
    d = Deck('#0F766E', '#FBBF24')
    d.cover('중학교 과학 · 입자의 운동', '냄새는 어떻게 퍼질까?', '확산과 입자의 운동')

    s = d.page('학습 목표', '학습 목표')
    textbox(s, 0.9, 1.7, 11.5, 3, [
        ('확산 현상을 입자의 운동으로 설명할 수 있다.', {'bullet': '1.', 'size': 28}),
        ('온도에 따라 확산 빠르기가 달라지는 까닭을 설명할 수 있다.', {'bullet': '2.', 'size': 28}),
    ])

    s = d.page('교실 앞에서 향수 뚜껑을 열면?', '생각 열기')
    textbox(s, 0.7, 1.5, 5.6, 4.5, [
        '교실 앞 교탁에서 향수병 뚜껑을 열면 잠시 뒤 맨 뒷자리 학생도 냄새를 맡을 수 있다.',
        ('창문을 모두 닫아 바람이 없는데도 냄새가 퍼지는 이유는 무엇일까?', {'bold': True, 'color': rgb('#0F766E')}),
    ], size=24)
    picture(s, img_perfume(), 6.6, 1.5, w=6.2, alt='향수병에서 냄새 입자가 퍼져 뒷자리 학생에게 닿는 모습')
    d.notes(s, '학생 생각을 두세 개 듣고 넘어간다. 바람 때문이라는 답이 나오면 창문을 닫아도 퍼진다는 점을 짚는다.')

    s = d.page('확산이란?', '개념')
    textbox(s, 0.7, 1.4, 12, 5.5, [
        ('확산: 물질을 이루는 입자가 스스로 움직여 다른 물질 속으로 퍼져 나가는 현상', {'bold': True, 'size': 26}),
        ('입자는 끊임없이 스스로 움직이기 때문에 확산이 일어난다.', {'bullet': '•'}),
        ('생활 속 다양한 확산의 예를 통해 확산에 대해 알아봅시다!', {'bullet': '•'}),
        ('향수 냄새가 방 안에 퍼진다.', {'bullet': '-', 'level': 1, 'size': 22}),
        ('물에 잉크를 떨어뜨리면 물 전체로 퍼진다.', {'bullet': '-', 'level': 1, 'size': 22}),
        ('티백을 넣은 물의 색이 점점 진해진다.', {'bullet': '-', 'level': 1, 'size': 22}),
    ], size=24)

    s = d.page('잉크가 퍼지는 모습을 입자로 나타내면', '개념')
    picture(s, img_ink_model(), 1.4, 1.35, w=10.5, alt='처음, 1분 뒤, 5분 뒤에 잉크 입자가 물 입자 사이로 퍼지는 입자 모형')
    textbox(s, 0.9, 5.95, 11.5, 1.2, [
        '잉크 입자와 물 입자가 모두 스스로 움직이므로 시간이 지나면 잉크 입자가 물 전체에 고르게 퍼진다.',
    ], size=22)

    s = d.page('실험: 물의 온도와 확산', '실험')
    textbox(s, 0.6, 1.3, 7.4, 6, [
        ('준비물: 비커 2개, 찬물(10 ℃), 따뜻한 물(60 ℃), 잉크, 스포이트, 초시계', {'size': 20, 'color': MUTE}),
        ('비커 2개에 찬물과 따뜻한 물을 200 mL씩 담는다.', {'bullet': '1.'}),
        ('물이 잔잔해질 때까지 1분 동안 기다린다.', {'bullet': '2.'}),
        ('두 비커에 잉크를 한 방울씩 동시에 떨어뜨린다.', {'bullet': '3.'}),
        ('잉크가 비커 전체에 고르게 퍼질 때까지 걸린 시간을 잰다.', {'bullet': '4.'}),
        ('결과를 표에 기록한다.', {'bullet': '5.'}),
        ('※ 뜨거운 물에 손을 데지 않게 조심한다.', {'size': 20, 'color': rgb('#B3261E')}),
    ], size=22)
    picture(s, img_beakers(), 8.2, 1.6, w=4.7, alt='10 ℃ 물과 60 ℃ 물이 담긴 비커 위에서 스포이트로 잉크를 떨어뜨리는 장면')
    d.notes(s, '비커를 흔들거나 저으면 확산이 아니라 섞기가 된다. 3번에서는 두 비커에 동시에 떨어뜨리게 한다.')

    s = d.page('실험 결과 (예시)', '실험')
    table(s, 0.9, 1.6, 11.5, [
        ['물의 온도 (℃)', '10', '20', '40', '60'],
        ['잉크가 고르게 퍼진 시간 (초)', '360', '260', '160', '110'],
    ], col_w=[4.3, 1.8, 1.8, 1.8, 1.8], head_fill='#CCEAE6', size=22, row_h=0.8)
    textbox(s, 0.9, 3.6, 11.5, 2.5, [
        ('물의 온도가 높을수록 잉크가 퍼지는 데 걸리는 시간이 짧다.', {'bold': True, 'size': 26}),
        ('※ 실제 실험값은 비커 크기, 잉크 양에 따라 달라질 수 있음', {'size': 18, 'color': MUTE}),
    ])
    d.notes(s, '가로축을 온도, 세로축을 시간으로 하여 그래프를 그려 보게 한다. 온도가 높아질수록 시간이 줄어드는 곡선이 된다.')

    s = d.page('왜 따뜻한 물에서 더 빨리 퍼질까?', '개념')
    textbox(s, 0.7, 1.5, 12, 5.5, [
        ('온도가 높다 → 입자의 운동이 활발하다 → 확산이 빠르다', {'bold': True, 'size': 28, 'color': rgb('#0F766E')}),
        ('확산은 액체보다 기체에서 더 빠르게 일어난다.', {'bullet': '•'}),
        ('진공 속에서는 움직임을 방해하는 다른 입자가 없어서 확산이 가장 빠르다.', {'bullet': '•'}),
    ], size=24)

    s = d.page('확인 문제 1', '확인 문제')
    textbox(s, 0.7, 1.4, 12, 5.8, [
        ('다음 중 확산으로 설명할 수 있는 현상이 아닌 것은?', {'bold': True, 'size': 26}),
        ('① 빵 굽는 냄새가 집 안에 퍼진다.', {}),
        ('② 물에 떨어뜨린 잉크가 퍼진다.', {}),
        ('③ 젖은 빨래가 햇볕에 마른다.', {}),
        ('④ 방향제 냄새가 방 안에 퍼진다.', {}),
        ('⑤ 홍차 티백을 넣은 물의 색이 점점 진해진다.', {}),
    ], size=24)
    d.notes(s, '정답 ③. 빨래가 마르는 것은 액체 표면의 입자가 기체로 날아가는 증발이다.')

    s = d.page('확인 문제 2', '확인 문제')
    textbox(s, 0.7, 1.4, 12, 5.8, [
        ('다음 현상을 확산과 증발로 분류해 보자.', {'bold': True, 'size': 26}),
        ('ㄱ. 꽃향기가 정원 전체에 퍼진다.', {}),
        ('ㄴ. 어항의 물이 조금씩 줄어든다.', {}),
        ('ㄷ. 물에 설탕을 넣으면 저어 주지 않아도 물 전체가 달아진다.', {}),
        ('ㄹ. 손등에 바른 알코올이 금방 마른다.', {}),
        ('ㅁ. 모기향 냄새가 방 안에 퍼진다.', {}),
        ('ㅂ. 마당에 뿌린 물이 마른다.', {}),
    ], size=24)
    d.notes(s, '확산: ㄱ, ㄷ, ㅁ / 증발: ㄴ, ㄹ, ㅂ')

    s = d.page('정리', '정리')
    textbox(s, 0.7, 1.5, 12, 5.5, [
        ('확산: 입자가 스스로 움직여 퍼져 나가는 현상', {'bullet': '•'}),
        ('온도가 높을수록 입자 운동이 활발해서 확산이 빠르다.', {'bullet': '•'}),
        ('확산 빠르기: 진공 > 기체 > 액체', {'bullet': '•'}),
    ], size=28)
    d.notes(s, '다음 시간: 증발')
    d.save(out / '실습_과학_확산.pptx')


def social(out):
    d = Deck('#1D4E89', '#F59F00')
    d.cover('중학교 사회 · 시장 경제', '떡볶이 값은 누가 정할까?', '수요와 공급, 시장 가격의 결정')

    s = d.page('학습 목표', '학습 목표')
    textbox(s, 0.9, 1.7, 11.5, 4, [
        ('수요 법칙과 공급 법칙을 설명할 수 있다.', {'bullet': '1.', 'size': 28}),
        ('시장에서 균형 가격이 정해지는 과정을 설명할 수 있다.', {'bullet': '2.', 'size': 28}),
        ('수요와 공급을 변하게 하는 요인을 구분할 수 있다.', {'bullet': '3.', 'size': 28}),
    ])

    s = d.page('수박 값은 왜 계절마다 다를까?', '생각 열기')
    textbox(s, 0.7, 1.5, 5.8, 4.5, [
        '같은 크기의 수박인데 여름에는 한 통에 15,000원, 겨울에는 35,000원이다.',
        ('수박 값을 정하는 사람은 누구일까?', {'bold': True, 'color': rgb('#1D4E89')}),
    ], size=24)
    picture(s, img_watermelon(), 6.8, 1.6, w=6.0, alt='여름 해와 겨울 눈송이 사이에 놓인 수박')
    d.notes(s, '가격은 한 사람이 정하는 것이 아니라 사려는 사람과 팔려는 사람이 만나서 정해진다는 생각으로 이끈다.')

    s = d.page('수요와 수요 법칙', '개념')
    textbox(s, 0.7, 1.5, 12, 5.5, [
        ('수요: 어떤 상품을 일정한 가격에 사려고 하는 욕구', {'bullet': '•'}),
        ('수요량: 일정한 가격에서 사려고 하는 상품의 양', {'bullet': '•'}),
        ('수요 법칙: 가격이 오르면 수요량이 줄어들고 가격이 내리면 수요량이 늘어난다.', {'bullet': '•', 'bold': True}),
        ('가격과 수요량은 반대 방향으로 움직인다는 점에 대해 이해하는 것이 중요합니다.', {'size': 20, 'color': MUTE}),
    ], size=24)

    s = d.page('공급과 공급 법칙', '개념')
    textbox(s, 0.7, 1.5, 12, 5.5, [
        ('공급: 어떤 상품을 일정한 가격에 팔려고 하는 욕구', {'bullet': '•'}),
        ('공급량: 일정한 가격에서 팔려고 하는 상품의 양', {'bullet': '•'}),
        ('공급 법칙: 가격이 오르면 공급량이 늘어나고 가격이 내리면 공급량이 줄어든다.', {'bullet': '•', 'bold': True}),
    ], size=24)

    s = d.page('떡볶이 가격에 따른 수요량과 공급량 (예시)', '자료')
    table(s, 0.9, 1.5, 11.5, [
        ['가격 (원)', '2,000', '2,500', '3,000', '3,500', '4,000'],
        ['수요량 (인분)', '500', '400', '300', '200', '100'],
        ['공급량 (인분)', '100', '200', '300', '400', '500'],
    ], col_w=[2.5, 1.8, 1.8, 1.8, 1.8, 1.8], head_fill='#D6E2F0', size=22, row_h=0.8)
    textbox(s, 0.9, 4.2, 11.5, 2, [
        ('어느 마을 떡볶이 시장의 하루 거래를 나타낸 가상 자료이다.', {'size': 20, 'color': MUTE}),
        '가격이 오를수록 수요량은 줄고 공급량은 늘어난다.',
    ], size=24)

    s = d.page('수요 곡선과 공급 곡선', '자료')
    picture(s, img_supply_demand(), 0.6, 1.3, h=5.9, alt='떡볶이 수요 곡선과 공급 곡선, 두 곡선이 만나는 균형점 E(300인분, 3,000원)')
    textbox(s, 8.9, 1.8, 4.0, 5, [
        '수요 곡선은 오른쪽 아래로, 공급 곡선은 오른쪽 위로 향한다.',
        '두 곡선이 만나는 점 E에서 균형 가격과 균형 거래량이 정해진다.',
    ], size=22)

    s = d.page('시장 가격의 결정', '개념')
    textbox(s, 0.7, 1.5, 12, 5.5, [
        ('가격 2,500원: 수요량 > 공급량 → 초과 수요 → 가격 상승', {'bullet': '•'}),
        ('가격 3,500원: 공급량 > 수요량 → 초과 공급 → 가격 하락', {'bullet': '•'}),
        ('결국 수요량 = 공급량이 되는 3,000원에서 가격이 정해짐 (균형 가격)', {'bullet': '•', 'bold': True, 'color': rgb('#1D4E89')}),
    ], size=24)
    d.notes(s, '초과 수요일 때는 사려는 사람끼리, 초과 공급일 때는 팔려는 사람끼리 경쟁해서 가격이 움직인다.')

    s = d.page('수요와 공급을 변하게 하는 요인', '개념')
    table(s, 1.4, 1.5, 10.5, [
        ['수요를 변하게 하는 요인', '공급을 변하게 하는 요인'],
        ['소비자의 소득', '생산 요소의 가격 (재료비, 임금)'],
        ['소비자의 선호', '생산 기술'],
        ['관련 상품(대체재·보완재)의 가격', '공급자의 수'],
        ['인구 (소비자의 수)', '기후 (농산물)'],
    ], col_w=[5.25, 5.25], head_fill='#D6E2F0', size=22, row_h=0.75, side_head=False)
    d.notes(s, '가격이 바뀌면 수요량·공급량이 움직인다. 가격 말고 다른 요인이 바뀌면 수요·공급 자체가 바뀐다. 이 둘을 구분한다.')

    s = d.page('확인 문제 1', '확인 문제')
    textbox(s, 0.7, 1.4, 12, 5.8, [
        ('6쪽의 표에서 떡볶이 1인분 가격이 2,500원일 때 나타나는 현상으로 옳은 것은?', {'bold': True, 'size': 26}),
        ('① 200인분의 초과 공급이 나타난다.', {}),
        ('② 200인분의 초과 수요가 나타난다.', {}),
        ('③ 100인분의 초과 수요가 나타난다.', {}),
        ('④ 수요량과 공급량이 같다.', {}),
        ('⑤ 300인분의 초과 공급이 나타난다.', {}),
    ], size=24)
    d.notes(s, '정답 ②. 2,500원일 때 수요량 400인분, 공급량 200인분이므로 200인분의 초과 수요가 나타난다.')

    s = d.page('확인 문제 2', '확인 문제')
    textbox(s, 0.7, 1.4, 12, 5.8, [
        ('다음 사례가 떡볶이의 수요를 변하게 하는지, 공급을 변하게 하는지 분류해 보자.', {'bold': True, 'size': 26}),
        ('ㄱ. 떡볶이 가게가 방송에 맛집으로 소개되었다.', {}),
        ('ㄴ. 떡의 재료인 쌀 가격이 크게 올랐다.', {}),
        ('ㄷ. 떡을 빠르게 뽑는 새 기계가 나왔다.', {}),
        ('ㄹ. 학생들의 용돈이 늘었다.', {}),
        ('ㅁ. 동네에 떡볶이 가게가 세 곳 더 생겼다.', {}),
        ('ㅂ. 떡볶이와 함께 먹는 어묵의 가격이 크게 올랐다.', {}),
    ], size=24)
    d.notes(s, '수요: ㄱ, ㄹ, ㅂ(어묵은 보완재) / 공급: ㄴ, ㄷ, ㅁ')

    s = d.page('정리', '정리')
    textbox(s, 0.7, 1.5, 12, 5.5, [
        ('수요 법칙: 가격과 수요량은 반대로 움직인다.', {'bullet': '•'}),
        ('공급 법칙: 가격과 공급량은 같은 방향으로 움직인다.', {'bullet': '•'}),
        ('수요량과 공급량이 같아지는 곳에서 균형 가격이 정해진다.', {'bullet': '•'}),
        ('소득·선호 등은 수요를, 생산 비용·기술 등은 공급을 변하게 한다.', {'bullet': '•'}),
    ], size=26)
    d.save(out / '실습_사회_수요와공급.pptx')


def main():
    ap = argparse.ArgumentParser(description='연수 실습용 PPT를 만든다')
    ap.add_argument('-o', '--out', default='examples/practice')
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    science(out)
    social(out)
    for p in sorted(out.glob('*.pptx')):
        print(f'{p}  {p.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
