"""يبني المرجع السكني الموحد ref_residential.json من الهيكل وأجزاء الكتابة وملفات الأسعار"""
import json,datetime
sk=json.load(open('skeleton.json',encoding='utf-8'))
W={}
issues=[]
for p in 'ABCDE':
    d=json.load(open(f'part-{p}.json',encoding='utf-8'))
    for it in d['items']: W[it['code']]=it
    issues+=d.get('issues',[])
R={}
for f in ['rates_civil','rates_mep']:
    for r in json.load(open(f'../{f}.json',encoding='utf-8')): R.setdefault((f,r['item_ar']),[]).append(r)
def nu(u):return (u or '').replace('م2','م²').replace('م3','م³').replace(' ','')
EXCLUDE={'بلاط رخام محلي (متوسط)'}  # سعر غير معقول للرخام، يُراجع مصدره
# تصحيحات بعد مراجعة الكتّاب
RENAME={'05 52 00-03':'زجاج مقسّى مصفّح مع فولاذ مقاوم للصدأ 316 أو ألمنيوم','04 22 00-03':'بلوك 10 سم للقواطع','10 44 16-02':'طفاية ثاني أكسيد الكربون للوحة الكهربائية','26 27 26-02':'مفاتيح ومقابس بإطار معدني أو زجاجي ومواصفات اعتماد كاملة','08 51 13-03':'قطاع حراري متعدد الحجرات بزجاج مزدوج منخفض الانبعاث مع غاز أرجون'}
OPTIONAL={'28 31 00-02':'يلزم حيث توجد أجهزة تعمل بالوقود أو مرآب ملاصق','31 23 19-01':'يلزم حيث يرتفع منسوب المياه الجوفية','33 36 00-01':'حيث لا تتوفر شبكة صرف عامة'}
# تحويل أسعار البلوك من الألف بلكة إلى المتر المربع: وجه البلكة 40×20 سم = 12.5 بلكة للمتر، و60×20 سم = 8.33
CONV={'بلك عازل 20×20×40 تقليدي':12.5,'بلك عازل متطور 20×20×40':12.5,'بلك أسود 15 سم':12.5,'بلك أسود 20 سم':12.5,'بلك خفيف (سيبوركس) 20×20×60':25/3,'بلك مصمت 400×200×100':12.5}
def price(v,unit):
    by={'شامل':[],'مادة':[],'مصنعية':[]};src=[];skipped=[]
    for pr in v.get('price_refs',[]):
        if pr['item_ar'] in EXCLUDE: skipped.append(pr['item_ar']);continue
        BM={'supply+install':'شامل','supply only':'مادة','labor only':'مصنعية'}
        for r in R.get((pr['file'],pr['item_ar']),[]):
            # السطر يُقبل حين يطابق أساسُه المكتوبُ في المصدر نوعَ التغطية المطلوب
            if r.get('basis') and BM.get(r['basis'])!=pr.get('covers','شامل'): continue
            k=1
            if nu(r['unit_ar'])!=nu(unit):
                if r['unit_ar']=='1000 بلكة' and pr['item_ar'] in CONV and nu(unit)=='م²':k=CONV[pr['item_ar']]/1000
                else: skipped.append(pr['item_ar']+' (وحدة '+r['unit_ar']+')');continue
            lo=r.get('low_sar') if r.get('low_sar') is not None else r.get('typical_sar');hi=r.get('high_sar') or r.get('typical_sar') or lo
            if lo is not None: lo=lo*k;hi=hi*k
            if lo is None:continue
            by[pr.get('covers','شامل')].append((lo,hi));src.append({'name':r.get('source_name'),'url':r.get('source_url'),'year':r.get('year')})
    def rng(a):return (min(x[0] for x in a),max(x[1] for x in a)) if a else None
    f,m,l=rng(by['شامل']),rng(by['مادة']),rng(by['مصنعية'])
    if f: out={'low':f[0],'high':f[1],'basis':'توريد وتركيب'}
    elif m and l: out={'low':m[0]+l[0],'high':m[1]+l[1],'basis':'مجمّع من سعر المادة والمصنعية'}
    elif m: out={'low':m[0],'high':m[1],'basis':'سعر المادة وحده'}
    elif l: out={'low':l[0],'high':l[1],'basis':'المصنعية وحدها'}
    else: return None,skipped
    out['low']=round(out['low'],2);out['high']=round(out['high'],2)
    seen=set();out['sources']=[s for s in src if not (s['url'] in seen or seen.add(s['url']))]
    return out,skipped
items=[];priced=0;nv=0;notes=[]
for i in sk['items']:
    w=W[i['code']];wv={v['code']:v for v in w['variants']}
    vs=[]
    for v in i['variants']:
        nv+=1;x=wv[v['code']]
        p,sk_=price(x,v['unit'])
        if p:priced+=1
        if sk_:notes.append(v['code']+': استُبعد '+'، '.join(sk_))
        vv={'code':v['code'],'grade':v['grade'],'ar':RENAME.get(v['code'],v['ar']),'unit':v['unit'],'spec':x['spec'],'price':p}
        if v['code'] in OPTIONAL: vv['optional']=OPTIONAL[v['code']]
        if p and p['basis'] in ('سعر المادة وحده','المصنعية وحدها'): vv['price']=None;vv['partial']=p
        vs.append(vv)
    # نطاق واحد عام مكرر على أكثر من درجة لا يميز بينها
    seen={}
    for vv in vs:
        if vv['price'] and vv['grade'] in ('eco','mid','lux'):
            k=(vv['price']['low'],vv['price']['high']);seen.setdefault(k,[]).append(vv)
    for k,lst in seen.items():
        if len(lst)>1:
            for vv in lst: vv['price']['shared']=True
    items.append({'code':i['code'],'div':i['div'],'ar':i['ar'],'en':i['en'],'unit':i['unit'],'legacy':i['legacy'],
      'scope':w['scope'],'specs':w['specs'],'accept':w['accept'],'method':w['method'],'refs':w['refs'],'measure':w['measure'],
      'price_basis':w.get('price_basis','توريد وتركيب'),'keywords':w.get('keywords',[]),'local':w.get('local',''),'verify':w.get('verify',[]),'variants':vs})
# بنود بديلة: باب المدخل يُختار من نوع واحد
ALT={'08 11 13':'باب المدخل يُختار من بند واحد: المعدني (08 11 13) أو الخشبي (08 14 33) أو الألمنيوم (08 41 13). الخيار 08 11 13-04 لأبواب الخدمة والسطح يبقى مستقلاً.','08 14 33':'بند بديل لباب المدخل: يُختار واحد من 08 11 13 أو 08 14 33 أو 08 41 13.','08 41 13':'بند بديل لباب المدخل: يُختار واحد من 08 11 13 أو 08 14 33 أو 08 41 13.'}
for it in items:
    if it['code'] in ALT: it['alt']=ALT[it['code']]
# بطانية الحريق للمطبخ خيار مستقل
for it in items:
    if it['code']=='10 44 16':
        it['variants'].append({'code':'10 44 16-03','grade':'any','ar':'بطانية حريق للمطبخ','unit':'عدد','spec':'بطانية من ألياف زجاجية بمقاس لا يقل عن 1.2×1.2 م في علبة جدارية بسحب سريع','price':None})
        it['verify'].append('مقاس بطانية الحريق ومواصفتها القياسية')
        nv+=1
ref={'version':1,'built':datetime.date.today().isoformat(),'scope':'فلل سكنية سعودية: هيكل خرساني مسلح وجدران بلوك، أرضي وأول وملحق',
 'system':'ترميز MasterFormat: الشعبة رقمان، والبند ستة أرقام، والخيار برقم بعد الشرطة',
 'grades':{'eco':{'ar':'اقتصادي','desc':'يحقق الاشتراطات والكود بمواد محلية معتمدة وأقل كلفة'},'mid':{'ar':'متوسط','desc':'مواد أعلى أداءً وعمراً، وتشطيب أدق، وهو الخيار الشائع للفلل'},'lux':{'ar':'فاخر','desc':'أعلى قيم فنية في الأداء والتشطيب والعمر، ومواد منتقاة'},'any':{'ar':'بلا درجة','desc':'الخيار عنصر مختلف لا مستوى'}},
 'price_note':'الأسعار نطاقات استرشادية بالريال من مصادر منشورة مذكورة مع كل خيار، وأغلبها وطنية أو للرياض، ولا تشمل ضريبة القيمة المضافة ما لم يُذكر. الخيار بلا سعر يُسعّر بعرض.',
 'divisions':sk['divisions'],'items':items,'issues':issues,'price_notes':notes}
json.dump(ref,open('../ref_residential.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(items),'items',nv,'variants',priced,'priced')
print('\n'.join(notes))
