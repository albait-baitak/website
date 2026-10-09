"""عينات DXF اصطناعية بحقيقة معروفة لاختبار القارئ (assets/js/dxf.js).
تشغيل: python3 tools/tests/dxf/make_samples.py  (يحتاج ezdxf)"""
import os, ezdxf
from ezdxf.enums import TextEntityAlignment
OUT = os.path.join(os.path.dirname(__file__), 'samples')

def villa():
    doc = ezdxf.new('R2018', setup=True); doc.header['$INSUNITS'] = 5  # سم
    msp = doc.modelspace()
    for n in ['A-WALL', 'ROOM', 'FLOOR', 'A-DOOR', 'A-GLAZ', 'DIM', 'TEXT', 'ELEV', 'SECT']: doc.layers.add(n)
    def rect(x0, y0, x1, y1, layer, closed_poly=False):
        if closed_poly:
            msp.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True, dxfattribs={'layer': layer}); return
        for a, b in [((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))]:
            msp.add_line(a, b, dxfattribs={'layer': layer})
    def text(s, x, y, h=25, layer='TEXT'):
        msp.add_text(s, height=h, dxfattribs={'layer': layer}).set_placement((x, y))
    # --- لوحة 1: المسقط (1500 × 1200 سم) ---
    rect(0, 0, 1500, 1200, 'A-WALL'); rect(20, 20, 1480, 1180, 'A-WALL')          # جدار خارجي 20 سم
    msp.add_line((700, 20), (700, 1180), dxfattribs={'layer': 'A-WALL'})              # جدار داخلي 15 سم
    msp.add_line((715, 20), (715, 1180), dxfattribs={'layer': 'A-WALL'})
    rect(20, 20, 700, 1180, 'ROOM', closed_poly=True); text('مجلس', 300, 600)       # 6.80 × 11.60 = 78.88 م²
    h = msp.add_hatch(dxfattribs={'layer': 'FLOOR'}); h.set_pattern_fill('ANSI31', scale=10)
    h.paths.add_polyline_path([(715, 20), (1480, 20), (1480, 1180), (715, 1180)], is_closed=True)  # 7.65 × 11.60 = 88.74 م²
    text('صالة', 1050, 600)
    # كتل الأبواب والنوافذ
    door = doc.blocks.new('DOOR-90'); door.add_line((0, 0), (90, 0)); door.add_arc((0, 0), 90, 0, 90)
    anon = doc.blocks.new_anonymous_block(); anon.add_line((0, 0), (0, 90)); anon.add_arc((0, 0), 90, 0, 90)
    win = doc.blocks.new('WIN-150')
    for yy in (0, 5, 10, 15): win.add_line((0, yy), (150, yy))
    win.add_attdef('NO', (60, 25), dxfattribs={'height': 15})
    for x in (200, 1000): msp.add_blockref('DOOR-90', (x, 20), dxfattribs={'layer': 'A-DOOR'})
    msp.add_blockref(anon.name, (700, 400), dxfattribs={'layer': '0'})
    text('D1', 230, 80, 15); text('D1', 1030, 80, 15); text('D2', 730, 450, 15)
    for x, tag in ((300, 'W1'), (900, 'W1'), (1200, 'W2')):
        ref = msp.add_blockref('WIN-150', (x, 1180), dxfattribs={'layer': 'A-GLAZ'}); ref.add_auto_attribs({'NO': tag})
    d = msp.add_linear_dim(base=(0, -100), p1=(0, 0), p2=(1500, 0), text='14.80', dxfattribs={'layer': 'DIM'}); d.render()   # يخالف قياسه (15.00)
    d = msp.add_linear_dim(base=(0, -60), p1=(0, 0), p2=(700, 0), text='7.00', dxfattribs={'layer': 'DIM'}); d.render()      # يطابق
    d = msp.add_linear_dim(base=(-80, 0), p1=(0, 0), p2=(0, 1200), angle=90, dxfattribs={'layer': 'DIM'}); d.render()       # بلا تعديل
    text('مسقط الدور الأرضي', 450, -250, 45)
    # جدول الفتحات بجانب المسقط
    text('جدول الأبواب والنوافذ', 1600, 1150, 25)
    for i, tag in enumerate(['D1', 'D2', 'W1', 'W2', 'W3']): text(tag, 1620, 1080 - i * 60, 15)
    for i in range(6): msp.add_line((1600, 1100 - i * 60), (1900, 1100 - i * 60), dxfattribs={'layer': 'TEXT'})
    # --- لوحة 2: الواجهة الشمالية ---
    ox = 5000
    rect(ox, 0, ox + 1500, 760, 'ELEV')
    for i in range(30): msp.add_line((ox + i * 50, 0), (ox + i * 50, 30), dxfattribs={'layer': 'ELEV'})
    text('±0.00', ox + 1550, 0, 15); text('+3.60', ox + 1550, 360, 15); text('+7.20', ox + 1550, 720, 15)
    text('W4', ox + 300, 400, 15)
    text('الواجهة الشمالية', ox + 450, -250, 45)
    # --- لوحة 3: القطاع ---
    ox = 10000
    rect(ox, 0, ox + 1200, 760, 'SECT')
    for i in range(30): msp.add_line((ox + i * 40, 0), (ox + i * 40, 30), dxfattribs={'layer': 'SECT'})
    text('±0.00', ox + 1250, 0, 15); text('+3.50', ox + 1250, 350, 15); text('+7.20', ox + 1250, 720, 15)
    text('قطاع أ-أ', ox + 450, -250, 45)
    doc.saveas(os.path.join(OUT, 'villa.dxf'))

def mm_arabic():
    """ملف بالملم وطبقات عربية وكتل أبواب باسم «باب»، بلا جدول ولا قطاعات."""
    doc = ezdxf.new('R2018', setup=True); doc.header['$INSUNITS'] = 4
    msp = doc.modelspace()
    for n in ['جدران', 'أبواب', 'نصوص']: doc.layers.add(n)
    def L(a, b, layer='جدران'): msp.add_line(a, b, dxfattribs={'layer': layer})
    for (x0, y0, x1, y1) in [(0, 0, 12000, 9000), (200, 200, 11800, 8800)]:
        L((x0, y0), (x1, y0)); L((x1, y0), (x1, y1)); L((x1, y1), (x0, y1)); L((x0, y1), (x0, y0))
    L((6000, 200), (6000, 8800)); L((6100, 200), (6100, 8800))   # جدار 10 سم
    b = doc.blocks.new('باب-مفرد'); b.add_line((0, 0), (1000, 0)); b.add_arc((0, 0), 1000, 0, 90)
    for x in (1000, 4000, 8000, 10000): msp.add_blockref('باب-مفرد', (x, 200), dxfattribs={'layer': 'أبواب'})
    for i in range(30): L((i * 400, -300), (i * 400, -200), 'نصوص')
    msp.add_text('مسقط الدور الأول', height=400, dxfattribs={'layer': 'نصوص'}).set_placement((4000, -1500))
    d = msp.add_linear_dim(base=(0, -800), p1=(0, 0), p2=(12000, 0), dxfattribs={'layer': 'نصوص'}); d.render()
    doc.saveas(os.path.join(OUT, 'mm-arabic.dxf'))

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); villa(); mm_arabic(); print('ok')
