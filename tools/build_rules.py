"""يولّد assets/js/rules.js من refs/rules_v2.json (المصدر الواحد لقواعد الفحص الفني)."""
import json,re,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d=json.load(open(os.path.join(ROOT,'refs/rules_v2.json'),encoding='utf-8'))
RD=json.load(open(os.path.join(ROOT,'refs/rules_display.json'),encoding='utf-8'))
SRC={'RES':'اشتراطات إنشاء المباني السكنية 1446هـ','AHSA-VILLA':'عمارة واحات الأحساء · الدليل التطبيقي للفلل','AHSA-GUIDE':'عمارة واحات الأحساء · الموجهات الكاملة','PARK':'دليل تصميم مواقف السيارات','PRO':'ستاندرد مهني','HOUSE':'قواعد البيت السعودي'}
def label(r):
    s=SRC.get(r['src'],r['src'])
    c=(r.get('clause') or '').strip()
    return s+(' · '+c if c else '')
out=[]
for r in d['RULES']:
    o={'c':r['c'],'l':r['l'],'n':r['n'],'r':RD[r['c']],'s':label(r)}
    if r.get('mand'):o['m']=1
    if r.get('mand_styles'):o['ms']=r['mand_styles']
    if r.get('styles'):o['st']=r['styles']
    if r.get('when'):o['w']=r['when']
    out.append(o)
p=os.path.join(ROOT,'assets/js/rules.js');t=open(p,encoding='utf-8').read()
a=t.index('var RULES=[');b=t.index('];',a)+2
head_start=t.index("var SH=") if "var SH=" in t else a
t=t[:head_start]+'var RULES='+json.dumps(out,ensure_ascii=False,indent=0).replace('\n','')+';'+t[b:]
t=re.sub(r'^/\* قواعد الفحص الفني وعينة.*?\*/\n/\* قواعد الفحص الفني: مصدرها.*?\*/\n','/* قواعد الفحص الفني وعينة بيت الواحة · القواعد مولّدة من refs/rules_v2.json بـ tools/build_rules.py فلا تُعدَّل هنا */\n',t,flags=re.S)
open(p,'w',encoding='utf-8').write(t)
print(len(out),'rules')
