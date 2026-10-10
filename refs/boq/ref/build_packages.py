"""حزم الغرف: لكل نوع غرفة بنودها وكمياتها بمعادلات من أبعادها، بالدرجات الثلاث.
أساس كل كمية واحد من ثلاثة: geometry من أبعاد الغرفة، code من نص كود له مصدر، design افتراض تصميمي معلن يُعدَّل."""
import json
FS={x['key']:x for x in json.load(open('formula-sources.json',encoding='utf-8'))}
G='G'  # يُستبدل برقم الدرجة: 01 اقتصادي، 02 متوسط، 03 فاخر
def fx(e,m,l):return {'eco':e,'mid':m,'lux':l}
WC=fx('22 41 00-01','22 41 00-02','22 41 00-03');BAS=fx('22 41 00-04','22 41 00-05','22 41 00-06')
SINK=fx('22 41 00-07','22 41 00-08','22 41 00-09');SHW=fx('22 41 00-10','22 41 00-11','22 41 00-12')
PARAMS={
 'H':{'v':3.0,'ar':'الارتفاع الصافي للغرفة (م)','basis':'design','note':'يؤخذ من القطاع إن وُجد'},
 'DW':{'v':0.9,'ar':'عرض الباب الداخلي (م)','basis':'design','note':'يؤخذ من جدول الأبواب إن وُجد'},
 'DH':{'v':2.1,'ar':'ارتفاع الباب (م)','basis':'design'},
 'TH':{'v':{'eco':1.83,'mid':None,'lux':None},'ar':'ارتفاع بلاط جدران الحمام (م)','basis':'code','src':'shower_wall_height','note':'الاقتصادي إلى الحد الأدنى في الكود، والمتوسط والفاخر إلى السقف'},
 'UP':{'v':0.3,'ar':'ارتفاع رفع العزل المائي على الجدران (م)','basis':'design'},
 'SHW_W':{'v':2.4,'ar':'طول جدران منطقة الدش المعزولة (م)','basis':'design'},
 'KL':{'v':{'eco':6,'mid':4,'lux':3},'ar':'مساحة الغرفة لكل وحدة إنارة (م²)','basis':'design','note':'تقدير أولي يُستبدل بتصميم الإنارة'},
 'AC_A':{'v':25,'ar':'مساحة الغرفة لكل وحدة تكييف (م²)','basis':'design','note':'تقدير أولي يُستبدل بحساب الأحمال الحرارية'},
 'CU':{'v':6,'ar':'طول تمديد النحاس لكل وحدة تكييف (م.ط)','basis':'design'},
 'RCPT':{'v':3.6,'ar':'أقصى تباعد بين المقابس على الجدار (م)','basis':'code','src':'rcpt_wall','note':'لا تبعد أي نقطة على الجدار أكثر من 1.8 م عن مقبس'},
 'RCPT_K':{'v':1.2,'ar':'أقصى تباعد بين مقابس سطح المطبخ (م)','basis':'code','src':'rcpt_counter','note':'لا تبعد أي نقطة على السطح أكثر من 60 سم عن مقبس'},
 'BS':{'v':0.6,'ar':'ارتفاع بلاط ظهر المطبخ (م)','basis':'design'},
}
# متغيرات الغرفة: L W الطول والعرض، nd عدد الأبواب، wa مساحة النوافذ (م²)، lc طول سطح المطبخ (م.ط)
# المشتقات: A المساحة، P المحيط، O مساحة الفتحات، WALL صافي الجدران، PS المحيط بعد خصم الأبواب
def L(v,q,basis='geometry',src=None,when=None,note=None):
    d={'v':v,'q':q,'basis':basis}
    if src:d['src']=src
    if when:d['when']=when
    if note:d['note']=note
    return d
def dry(extra_ceiling_eco=False,cornice=False,floor_lux_marble=False,smoke=False,data=1,tv=1):
    lines=[]
    if floor_lux_marble:
        lines+= [L('09 30 16-'+G,'A',when=['eco','mid']),L('09 63 40-03','A',when=['lux'],basis='design',note='الفاخر في المجالس والصالات رخام')]
    else: lines.append(L('09 30 16-'+G,'A'))
    lines+=[L('09 30 16-04','PS'),L('09 24 00-01','WALL'),L('09 91 23-'+G,'WALL+A'),
      L('09 29 00-'+G,'A',when=None if extra_ceiling_eco else ['mid','lux'])]
    if cornice: lines.append(L('09 27 00-'+G,'P',when=['mid','lux']))
    lines+=[L('08 14 16-'+G,'nd'),L('08 51 13-'+G,'wa'),
      L('26 05 00-01','max(1,ceil(A/KL))',basis='design',note='الكود يشترط وحدة إنارة واحدة على الأقل بمفتاح جداري'),L('26 51 00-'+G,'max(1,ceil(A/KL))',basis='design'),
      L('26 05 00-02','max(1,ceil(PS/RCPT))',basis='code',src='rcpt_wall'),L('26 27 26-'+G,'max(1,ceil(PS/RCPT))+nd',basis='code',src='rcpt_wall',note='المقابس ومفتاح عند كل باب'),
      L('26 05 00-03','max(1,ceil(A/AC_A))',basis='design'),L('23 81 26-'+G,'max(1,ceil(A/AC_A))',basis='design'),L('23 23 00-01','max(1,ceil(A/AC_A))*CU',basis='design')]
    if data:lines.append(L('27 15 00-01',str(data),basis='design'))
    if tv:lines.append(L('27 15 00-02',str(tv),basis='design'))
    if smoke:lines.append(L('28 31 00-01','1',basis='code',src='smoke_locations'))
    return lines
def wet(full=True):
    l=[L('09 30 16-'+G,'A'),L('09 30 13-'+G,'P*TH-O',note='البلاط حتى الارتفاع TH بعد خصم الفتحات'),
       L('09 91 23-'+G,'max(0,P*(H-TH))+A',note='الدهان فوق البلاط وعلى السقف'),L('09 24 00-01','WALL'),
       L('07 14 16-'+G,'A+P*UP'+('+SHW_W*1.83' if full else ''),basis='geometry',note='الأرضية ورفعة على الجدران'+(' وجدران الدش حتى 1.83 م' if full else '')),
       L('09 29 00-'+G,'A',when=['mid','lux']),
       L(WC,'1'),L(BAS,'1'),L('22 41 00-13','1'),
       L('22 11 16-01',('4' if full else '3'),note='مرحاض ومغسلة وشطاف'+(' ودش' if full else '')),
       L('22 13 16-01',('3' if full else '2')),L('22 13 16-02','1'),
       L('23 34 23-01','1',basis='code',src='exhaust_rates'),L('10 28 13-'+G,'1'),
       L('08 14 16-'+G,'nd'),L('08 51 13-'+G,'wa'),
       L('26 05 00-01','max(1,ceil(A/KL))',basis='code',src='light_outlet'),L('26 51 00-'+G,'max(1,ceil(A/KL))',basis='design'),
       L('26 05 00-02','1',basis='code',src='rcpt_bath'),L('26 27 26-'+G,'1+nd',basis='code',src='rcpt_bath')]
    if full: l+=[L(SHW,'1'),L('22 33 00-'+G,'1',basis='design',note='سخان لكل حمام كامل'),L('26 05 00-04','1',basis='design')]
    return l
ROOMS=[
 {'type':'master','ar':'غرفة نوم رئيسية','aliases':['نوم رئيسية','ماستر','master'],'lines':dry(smoke=True)},
 {'type':'bedroom','ar':'غرفة نوم','aliases':['نوم','غرفة نوم','bed'],'lines':dry(smoke=True)},
 {'type':'majlis','ar':'مجلس','aliases':['مجلس','مجلس رجال','مجلس نساء','majlis'],'lines':dry(extra_ceiling_eco=True,cornice=True,floor_lux_marble=True,data=0,tv=1)},
 {'type':'living','ar':'صالة معيشة','aliases':['صالة','معيشة','living'],'lines':dry(extra_ceiling_eco=True,cornice=True,floor_lux_marble=True)},
 {'type':'dining','ar':'طعام','aliases':['طعام','سفرة','dining'],'lines':dry(cornice=True,data=0,tv=0)},
 {'type':'hall','ar':'ممر أو بهو','aliases':['ممر','بهو','موزع','hall'],'lines':[x for x in dry(smoke=True,data=0,tv=0) if not x['v'].startswith(('23 81','26 05 00-03','23 23'))]},
 {'type':'maid','ar':'غرفة خادمة أو سائق','aliases':['خادمة','سائق','maid'],'lines':dry(data=0,tv=0,smoke=True)},
 {'type':'bath','ar':'حمام كامل','aliases':['حمام','bath'],'lines':wet(True)},
 {'type':'wc','ar':'حمام ضيوف','aliases':['حمام ضيوف','مغاسل','wc'],'lines':wet(False)},
 {'type':'kitchen','ar':'مطبخ','aliases':['مطبخ','kitchen'],'lines':[
   L('09 30 16-'+G,'A'),L('09 30 13-'+G,'lc*BS',basis='design',note='بلاط ظهر السطح'),L('09 24 00-01','WALL'),L('09 91 23-'+G,'WALL-lc*BS+A'),
   L('09 29 00-'+G,'A',when=['mid','lux']),L('07 14 16-'+G,'A+P*UP'),
   L('12 35 30-'+G,'lc'),L('12 36 40-'+G,'lc'),L(SINK,'1'),
   L('22 11 16-01','2',note='المجلى وغسالة الصحون'),L('22 13 16-01','2'),L('22 13 16-02','1'),
   L('23 34 23-01','1',basis='code',src='exhaust_rates'),L('23 11 26-01','1',basis='design',note='حين يكون الطبخ بالغاز'),
   L('28 31 00-02','1',basis='code',src='co_locations',note='يلزم مع أجهزة الطبخ بالغاز'),L('10 44 16-03','1',basis='design'),
   L('08 14 16-'+G,'nd'),L('08 51 13-'+G,'wa'),
   L('26 05 00-01','max(1,ceil(A/KL))',basis='design'),L('26 51 00-'+G,'max(1,ceil(A/KL))',basis='design'),
   L('26 05 00-02','ceil(lc/RCPT_K)+max(1,ceil((PS-lc)/RCPT))',basis='code',src='rcpt_counter'),
   L('26 27 26-'+G,'ceil(lc/RCPT_K)+max(1,ceil((PS-lc)/RCPT))+nd',basis='code',src='rcpt_counter'),
   L('26 05 00-04','2',basis='design',note='الفرن وغسالة الصحون'),
   L('26 05 00-03','max(1,ceil(A/AC_A))',basis='design'),L('23 81 26-'+G,'max(1,ceil(A/AC_A))',basis='design'),L('23 23 00-01','max(1,ceil(A/AC_A))*CU',basis='design')]},
 {'type':'laundry','ar':'غرفة غسيل','aliases':['غسيل','laundry'],'lines':[
   L('09 30 16-'+G,'A'),L('09 30 13-'+G,'P*1.2-O',basis='design'),L('09 91 23-'+G,'max(0,P*(H-1.2))+A'),L('09 24 00-01','WALL'),L('07 14 16-'+G,'A+P*UP'),
   L('22 11 16-01','1'),L('22 13 16-01','1'),L('22 13 16-02','1'),L('23 34 23-01','1',basis='design'),
   L('08 14 16-'+G,'nd'),L('26 05 00-01','1',basis='code',src='light_outlet'),L('26 51 00-'+G,'1'),L('26 05 00-02','1'),L('26 05 00-04','2',basis='design',note='الغسالة والمجفف'),L('26 27 26-'+G,'2+nd')]},
 {'type':'stairs','ar':'درج','aliases':['درج','سلم','stairs'],'inputs':['sl','rl'],'lines':[
   L('09 63 40-04','sl',note='الطول الكلي للنائمات والقوائم (م.ط)'),L('05 52 00-'+G,'rl',note='طول الدرابزين'),
   L('09 24 00-01','WALL'),L('09 91 23-'+G,'WALL'),L('26 05 00-01','2',basis='code',src='light_outlet',note='مفتاح أعلى الدرج وأسفله'),L('26 51 00-'+G,'max(2,ceil(A/KL))'),L('26 27 26-'+G,'2')]},
 {'type':'roof','ar':'سطح','aliases':['سطح','roof'],'lines':[
   L('07 13 52-'+G,'A+P*UP'),L('07 21 13-'+G,'A'),L('07 76 00-'+G,'A'),L('22 14 26-01','max(2,ceil(A/100))',basis='design',note='مصرف رئيسي وحماية تصريف ثانوية'),
   L('26 05 00-01','max(2,ceil(P/10))',basis='design'),L('26 56 00-'+G,'max(2,ceil(P/10))',basis='design'),L('26 05 00-02','1')]},
 {'type':'yard','ar':'فناء خارجي','aliases':['حوش','فناء','حديقة','yard'],'inputs':['pa','ga'],'lines':[
   L('32 14 13-'+G,'pa',note='مساحة الممرات المرصوفة'),L('32 14 13-04','pa>0?ceil(sqrt(pa)*4):0',basis='design',note='تقدير طول البردورات حول المرصوف'),
   L('32 90 00-'+G,'ga',note='مساحة الزراعة'),L('32 84 00-'+G,'ga'),
   L('26 56 00-'+G,'max(2,ceil(P/6))',basis='design'),L('26 05 00-01','max(2,ceil(P/6))',basis='design')]},
]
def fix(r):
    for l in r['lines']:
        if isinstance(l['v'],str) and l['v'].endswith('-'+G):
            b=l['v'][:-2];l['v']={'eco':b+'-01','mid':b+'-02','lux':b+'-03'}
        if l.get('src'):
            s=FS[l['src']];l['source']={'claim':s['claim'],'ref':s['ref'],'url':s['url'],'level':s['level']}
    r.setdefault('inputs',['L','W','nd','wa']+(['lc'] if r['type']=='kitchen' else []))
    return r
for k,p in PARAMS.items():
    if p.get('src'):s=FS[p['src']];p['source']={'claim':s['claim'],'ref':s['ref'],'url':s['url'],'level':s['level']}
out={'version':1,'about':'حزم الغرف السكنية: بنود كل غرفة وكمياتها من أبعادها، والكود حيث له نص، والافتراض التصميمي معلن وقابل للتعديل',
 'inputs':{'L':'طول الغرفة (م)','W':'عرض الغرفة (م)','nd':'عدد الأبواب','wa':'مساحة النوافذ (م²)','lc':'طول سطح المطبخ (م.ط)','sl':'طول نائمات الدرج وقوائمه (م.ط)','rl':'طول الدرابزين (م.ط)','pa':'مساحة المرصوف (م²)','ga':'مساحة الزراعة (م²)'},
 'derived':{'A':'L*W','P':'2*(L+W)','O':'nd*DW*DH+wa','WALL':'max(0,P*H-O)','PS':'max(0,P-nd*DW)'},
 'params':PARAMS,'rooms':[fix(r) for r in ROOMS]}
json.dump(out,open('../packages_residential.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
ref=json.load(open('../ref_residential.json',encoding='utf-8'));codes={v['code'] for i in ref['items'] for v in i['variants']}
bad=set()
for r in out['rooms']:
    for l in r['lines']:
        for c in (l['v'].values() if isinstance(l['v'],dict) else [l['v']]):
            if c not in codes:bad.add(c)
print(len(out['rooms']),'rooms',sum(len(r['lines']) for r in out['rooms']),'lines','bad codes',bad)
