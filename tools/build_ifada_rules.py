"""يولّد supabase/seed/ifada_rules.sql: البنود النظامية (الطبقة 1) التي تدخل إفادة الفحص الفني ومصادرها.
يُشغَّل بعد tools/build_rules.py كلما تغيرت مكتبة القواعد، ثم يُطبَّق ملف الناتج على قاعدة البيانات."""
import json,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d=json.load(open(os.path.join(ROOT,'refs/rules_v2.json'),encoding='utf-8'))
# عناوين المصادر كما تُطبع في الإفادة؛ القيم من refs/rules_v2.json → sources
SRC={'RES':('اشتراطات إنشاء المباني السكنية','وزارة البلديات والإسكان','1446هـ/2024م',1),
     'SBC':('الكود السعودي للمباني السكنية SBC 1101','المركز الوطني لكود البناء','2024',2)}
q=lambda s:"'"+s.replace("'","''")+"'"
rules=[r for r in d['RULES'] if r['l']==1]
miss={r['src'] for r in rules}-set(SRC)
if miss:raise SystemExit('مصدر بلا عنوان في SRC: '+', '.join(sorted(miss)))
out=['-- مولّد بـ tools/build_ifada_rules.py من refs/rules_v2.json (الإصدار '+str(d.get('version'))+') فلا يُعدَّل يدوياً','begin;',
 'delete from public.ifada_rules;']
out.append('insert into public.ifada_rules(code,src,mand,pending) values\n'+',\n'.join('(%s,%s,%s,%s)'%(q(r['c']),q(r['src']),'true' if r.get('mand') else 'false','true' if r.get('verify') else 'false') for r in rules)+';')
out.append('insert into public.ifada_sources(id,title,publisher,edition,ord) values\n'+',\n'.join('(%s,%s,%s,%s,%d)'%(q(k),q(v[0]),q(v[1]),q(v[2]),v[3]) for k,v in SRC.items())+'\non conflict (id) do update set title=excluded.title,publisher=excluded.publisher,edition=excluded.edition,ord=excluded.ord;')
out.append('commit;')
os.makedirs(os.path.join(ROOT,'supabase/seed'),exist_ok=True)
open(os.path.join(ROOT,'supabase/seed/ifada_rules.sql'),'w',encoding='utf-8').write('\n'.join(out)+'\n')
print(len(rules),'بنداً نظامياً،',sum(1 for r in rules if r.get('verify')),'منها معلّقة')
