/* قارئ الأدوات، المجموعة ب: النقاط، خارطة التنفيذ، العروض، الاتفاق، فحص التأسيس، التشطيبات.
   ES5 فقط. يضيف إلى window.SUM و window.SUM_REF الموجودين.
   المراجع: bb_tool_points_v1 => points.json ، bb_tool_roughin_v1 => inspection.json ، bb_tool_finishes_v1 => finishes.json */
(function(W){
var SUM=W.SUM=W.SUM||{},SUM_REF=W.SUM_REF=W.SUM_REF||{};

/* ===== أدوات مساعدة ===== */
function isArr(x){return Object.prototype.toString.call(x)==='[object Array]'}
function isObj(x){return !!x&&typeof x==='object'&&!isArr(x)}

function str(x){return (typeof x==='string'||typeof x==='number')?String(x).replace(/^\s+|\s+$/g,''):''}
var AR='٠١٢٣٤٥٦٧٨٩';
function latin(s){return String(s==null?'':s).replace(/[٠-٩]/g,function(d){return String(AR.indexOf(d))})}
function cut(s,n){s=latin(str(s)).replace(/\s+/g,' ');return s.length>n?s.slice(0,n).replace(/\s+$/,'')+'..':s}
function keys(o){var r=[];if(!isObj(o))return r;for(var k in o)if(Object.prototype.hasOwnProperty.call(o,k))r.push(k);return r}
/* عدد ومعدود: f=[للواحد، للاثنين، للجمع 3-10، للمفرد المنصوب 11 فأكثر] */
function cnt(n,f){var m=n%100;if(n===1)return f[0];if(n===2)return f[1];if(m>=3&&m<=10)return n+' '+f[2];return n+' '+f[3]}
/* المعدود بعد «من N» */
function of(n,f){var m=n%100;return (m>=3&&m<=10)?f[2]:f[3]}
function fmtN(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',')}
function dt(d){d=str(d);var p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:latin(d)}
function R(line,done,ofN,empty,more){return {line:line,done:done==null?null:done,of:ofN==null?null:ofN,empty:!!empty,more:more||null}}
function safe(fn,emptyLine){return function(d,ref){try{return fn(d,ref)}catch(e){return R(emptyLine||'',null,null,true,null)}}}

/* ===== النقاط: bb_tool_points_v1 ===== */
/* tools/points/index.html:89 fresh={v:1,rooms:[]}
   :106 كل غرفة {id,type,name,q:{itemId:عدد معدّل},note}
   :105 qty(): القيمة المعدلة وإلا it.qty من المرجع ، :130 kpis تجمع electrical/lowcurrent/plumbing لكل غرفة معروف نوعها في المرجع */
SUM_REF['bb_tool_points_v1']='points';
SUM['bb_tool_points_v1']=safe(function(d,ref){
  var rooms=(isObj(d)&&isArr(d.rooms))?d.rooms.filter(isObj):[];
  if(!rooms.length)return R('',null,null,true,null);
  var T={},hasRef=isObj(ref)&&isArr(ref.rooms);
  if(hasRef)ref.rooms.forEach(function(r){if(isObj(r)&&r.id)T[r.id]=r});
  var tot={electrical:0,lowcurrent:0,plumbing:0},known=0,changed=0;
  rooms.forEach(function(r){
    var q=isObj(r.q)?r.q:{};if(keys(q).some(function(k){return q[k]!==''&&q[k]!=null}))changed++;
    var t=T[r.type];if(!t)return;known++;
    ['electrical','lowcurrent','plumbing'].forEach(function(g){(isArr(t[g])?t[g]:[]).forEach(function(it){
      if(!isObj(it))return;var v=q[it.id];var n=(v===undefined||v===''||v===null)?it.qty:+v;n=+n;if(isFinite(n)&&n>0)tot[g]+=n})})});
  var rf=['غرفة واحدة','غرفتين','غرف','غرفة'];
  var line;
  if(hasRef&&known)line='حددت نقاط '+cnt(rooms.length,rf)+': '+fmtN(tot.electrical)+' كهرباء، '+fmtN(tot.lowcurrent)+' تيار خفيف، '+fmtN(tot.plumbing)+' سباكة';
  else line='أضفت '+cnt(rooms.length,rf)+' إلى جدول النقاط';
  var more=changed?'عدّلت الأعداد المقترحة في '+cnt(changed,rf):null;
  return R(line,null,null,false,more);
});

/* ===== خارطة التنفيذ: bb_tool_roadmap_v1 ===== */
/* tools/roadmap/index.html:96-157 STN عشر محطات، عدد بنود كل محطة من مصفوفة i:
   :97 جاهزيتك=8 ، :106 قواعد ثابتة=6 ، :113 العظم=8 ، :122 الكهرباء=5 ، :128 السباكة=5 ، :134 العزل=4 ، :139 اللياسة=3 ، :143 الأرضيات=4 ، :148 النجارة=4 ، :153 الاستلام=3 (المجموع 50 = TOTAL في :159)
   :160 fresh: s[k]={c:{},start:'',recv:'',d:{},note:''} ؛ c[j]=1 عند التعليم (:184) ؛ recv تاريخ الاستلام (:188) ؛ لوحة «المحطات المستلمة: rec من 10» (:244) */
var STN=[['جاهزيتك قبل أول مقاول',8],['قواعد ثابتة مع كل مقاول',6],['العظم',8],['التمديدات الكهربائية',5],['السباكة والتكييف',5],['العزل',4],['اللياسة',3],['الأرضيات والجبس',4],['النجارة والألمنيوم والدهان',4],['الاستلام النهائي والتشغيل',3]];
var STN_ITEMS=50;
SUM_REF['bb_tool_roadmap_v1']=null;
SUM['bb_tool_roadmap_v1']=safe(function(d){
  var S=(isObj(d)&&isArr(d.s))?d.s:[];
  var any=false,rec=0,items=0,curK=-1;
  for(var k=0;k<STN.length;k++){
    var s=isObj(S[k])?S[k]:{};
    var c=isObj(s.c)?s.c:{},dn=0;
    keys(c).forEach(function(j){var i=+j;if(c[j]&&i>=0&&i<STN[k][1]&&String(i)===j)dn++});
    items+=dn;
    var r=!!str(s.recv);if(r)rec++;else if(curK<0)curK=k;
    if(dn||r||str(s.start)||str(s.note)||keys(s.d).some(function(x){return s.d[x]}))any=true;
  }
  if(!any)return R('',0,STN.length,true,null);
  var line=rec===STN.length?'استلمت المحطات العشر كلها':
    (rec?'استلمت '+rec+' من '+STN.length+' '+of(STN.length,['','','محطات','محطة']):'لم تستلم محطة بعد')+'، والحالية: '+STN[curK][0];
  var more=items?'تحققت من '+items+' من '+STN_ITEMS+' '+of(STN_ITEMS,['','','بنود','بنداً']):null;
  return R(line,rec,STN.length,false,more);
});

/* ===== مقارنة العروض: bb_tool_offers_v1 ===== */
/* tools/offers/index.html:115 OFF=a,b,c (عرض أ/ب/ج) ؛ :116-127 ROWS مفاتيح الصفوف ؛ :151 used(o)=أي صف معبأ
   :130 newSh: {id,name:'البند 1',o:{a:{},b:{},c:{}},win:'',why:''} ؛ :131 fresh={v:1,sh:[s],active} (active يُحفظ تلقائياً فلا يُعد تقدماً)
   :200 win يُعتد به فقط إن كان العرض المختار معبأً */
var OFF={a:'عرض أ',b:'عرض ب',c:'عرض ج'};
var OROWS=['con','price','inc','exc','mat','dur','pay','war','prev','clr','note'];
function oUsed(o){return isObj(o)&&OROWS.some(function(k){return str(o[k])!==''})}
function conName(o){return cut((str(o.con)).split(/[\n،,·\-0-9٠-٩+]/)[0],18)}
SUM_REF['bb_tool_offers_v1']=null;
SUM['bb_tool_offers_v1']=safe(function(d){
  var sh=(isObj(d)&&isArr(d.sh))?d.sh.filter(isObj):[];
  var total=0,withOff=[],won=[],touched=false;
  sh.forEach(function(s){
    var o=isObj(s.o)?s.o:{},n=0;
    ['a','b','c'].forEach(function(k){if(oUsed(o[k]))n++});
    total+=n;if(n)withOff.push({s:s,n:n});
    var w=str(s.win);if(OFF[w]&&oUsed(o[w]))won.push({s:s,k:w,o:o[w]});
    if(str(s.why))touched=true;
  });
  var renamed=sh.some(function(s){var nm=latin(str(s.name));return nm!==''&&!/^البند \d+$/.test(nm)});
  if(!total&&!touched&&!renamed&&sh.length<=1)return R('',null,null,true,null);
  var bf=['بنداً واحداً','بندين','بنود','بنداً'],ofF=['عرضاً واحداً','عرضين','عروض','عرضاً'];
  var line,more=null;
  if(!total){line=sh.length>1?'أنشأت '+cnt(sh.length,['بنداً واحداً','بندين','بنود','بنداً'])+' ولم تكتب عروضها بعد':'سمّيت البند ولم تكتب عروضه بعد'}
  else if(withOff.length===1){var s0=withOff[0];
    line=(s0.n>1?'قارنت ':'كتبت ')+cnt(s0.n,ofF)+' في «'+cut(s0.s.name||'البند',24)+'»';
    if(won.length){var w0=won[0],nm=conName(w0.o);more='رسّيت على '+OFF[w0.k]+(nm?' · '+nm:'')}}
  else{line='قارنت '+cnt(total,ofF)+' في '+cnt(withOff.length,['بند واحد','بندين','بنود','بنداً']);
    if(won.length)line+='، وحسمت '+(won.length===withOff.length?'كلها':cnt(won.length,bf));
    if(won.length)more=cut('رسّيت في: '+won.map(function(x){return latin(str(x.s.name))}).join('، '),60)}
  return R(line,null,null,false,more);
});

/* ===== اتفاق البند الواحد: bb_tool_agree_v1 ===== */
/* tools/agreement/index.html:111-117 newAg: item='البند 1', con='', from='', days='' ... وقيم افتراضية b2,c3,c4,e1,e2=true والبقية false، وثلاث دفعات بأسماء افتراضية
   :118 fresh={v:1,ags:[g],active} ؛ :187 days «مدة التنفيذ (يوماً)» و from «من تاريخ» ؛ :108 التقويم يعرض «نهاية مدة تنفيذ كل بند» */
var AG_TXT=['owner','ownerPh','con','conPh','site','date','inc','exc','mat','matInc','matExc','open','conflict','util','hFrom','hTo','days','from','delay','price','war','sig1','sig2','wit'];
var AG_BOOL={b1:false,b2:true,b3:false,c1:false,c2:false,c3:true,c4:true,e1:true,e2:true,e3:false};
var AG_PAYN=['الأولى','الثانية','الأخيرة (بعد الاستلام النهائي)'];
function agTouched(a){
  if(!isObj(a))return false;
  if(AG_TXT.some(function(k){return str(a[k])!==''}))return true;
  for(var k in AG_BOOL)if(k in a&&!!a[k]!==AG_BOOL[k])return true;
  var it=latin(str(a.item));if(it!==''&&!/^البند \d+$/.test(it))return true;
  if(isArr(a.pays)){if(a.pays.length!==3)return true;
    if(a.pays.some(function(p,i){return isObj(p)&&(str(p.w)!==''||str(p.a)!==''||str(p.n)!==AG_PAYN[i])}))return true}
  return false}
function agDays(a){var v=parseFloat(latin(str(a.days)).replace(/[^\d.]/g,''));return isFinite(v)&&v>0?Math.round(v):0}
function agFrom(a){var f=str(a.from);return /^\d{4}-\d{2}-\d{2}$/.test(f)?f:''}
function addDays(f,n){var p=f.split('-'),t=Date.UTC(+p[0],+p[1]-1,+p[2])+n*864e5,x=new Date(t);
  function z(v){return (v<10?'0':'')+v}return x.getUTCFullYear()+'-'+z(x.getUTCMonth()+1)+'-'+z(x.getUTCDate())}
SUM_REF['bb_tool_agree_v1']=null;
SUM['bb_tool_agree_v1']=safe(function(d){
  var ags=(isObj(d)&&isArr(d.ags))?d.ags.filter(isObj):[];
  var T=ags.filter(agTouched);
  if(!T.length&&ags.length<=1)return R('',null,null,true,null);
  if(!T.length)return R('أنشأت '+cnt(ags.length,['اتفاقاً واحداً','اتفاقين','اتفاقات','اتفاقاً'])+' ولم تملأ بياناتها بعد',null,null,false,null);
  var df=['يوم واحد','يومان','أيام','يوماً'];
  var full=T.filter(function(a){return str(a.con)&&agDays(a)&&agFrom(a)});
  var line,more=null;
  if(T.length===1){var a=T[0],nm=cut(a.item||'البند',22),c=cut(a.con,16),dy=agDays(a),f=agFrom(a);
    line='اتفاق «'+nm+'»'+(c?' مع '+c:'');
    if(dy&&f)line+=': '+cnt(dy,df)+' من '+dt(f);
    else if(dy)line+=': '+cnt(dy,df);
    else if(!c)line+=': بدأت كتابته';
    var miss=[];if(!c)miss.push('اسم المقاول');if(!f)miss.push('تاريخ البدء');if(!dy)miss.push('المدة');
    if(miss.length)more='لم تكتب بعد: '+miss.join('، ')}
  else{var k=full.length;line='كتبت '+cnt(T.length,['اتفاقاً واحداً','اتفاقين','اتفاقات','اتفاقاً'])+'، '+
      (k===0?'ولم يكتمل منها اتفاق بمقاول ومدة وتاريخ':(k===T.length?'كلها':(k===1?'واحد منها':k+' منها'))+' بمقاول ومدة وتاريخ بدء');
    if(full.length){var last=null;full.forEach(function(a){var e=addDays(agFrom(a),agDays(a));if(!last||e>last.e)last={e:e,a:a}});
      more='آخر نهاية مدة: «'+cut(last.a.item||'البند',20)+'» في '+dt(last.e)}}
  return R(line,null,null,false,more);
});

/* ===== فحص التأسيس: bb_tool_roughin_v1 ===== */
/* tools/rough-in/index.html:83 الحالات ok/bad/chk2 ؛ :85 fresh={v:1,st:{},notes:{},date:{}}
   :119 n = عدد بنود المرجع (sections[].items) ، «فُحص: ok+bad+chk2 من n» ؛ :120 البند المانع (stop) مفتوح ما لم يكن ok أو chk2
   المقام من inspection.json: مجموع items في كل sections */
SUM_REF['bb_tool_roughin_v1']='inspection';
var RI_ST={ok:1,bad:1,chk2:1};
SUM['bb_tool_roughin_v1']=safe(function(d,ref){
  var st=isObj(d)&&isObj(d.st)?d.st:{},notes=isObj(d)&&isObj(d.notes)?d.notes:{},date=isObj(d)&&isObj(d.date)?d.date:{};
  var hasNote=keys(notes).some(function(k){return str(notes[k])!==''}),hasDate=keys(date).some(function(k){return str(date[k])!==''});
  var items=[];if(isObj(ref)&&isArr(ref.sections))ref.sections.forEach(function(s){if(isObj(s)&&isArr(s.items))s.items.forEach(function(it){if(isObj(it)&&it.id)items.push(it)})});
  var done=0,bad=0,openStop=0;
  if(items.length){items.forEach(function(it){var v=st[it.id];if(RI_ST[v]===1){done++;if(v==='bad')bad++}if(it.stop&&v!=='ok'&&v!=='chk2')openStop++})}
  else keys(st).forEach(function(k){if(RI_ST[st[k]]===1){done++;if(st[k]==='bad')bad++}});
  if(!done&&!hasNote&&!hasDate)return R('',items.length?0:null,items.length||null,true,null);
  var bf=['بنداً واحداً','بندين','بنود','بنداً'];
  if(!done)return R('سجلت تواريخ أو ملاحظات ولم تعلّم حالة أي بند بعد',0,items.length||null,false,null);
  var line=items.length?'فحصت '+done+' من '+items.length+' '+of(items.length,['','','بنود','بنداً']):'فحصت '+cnt(done,bf);
  line+=bad?'، و'+cnt(bad,['بند واحد يحتاج','بندان يحتاجان','بنود تحتاج','بنداً تحتاج'])+' تصحيحاً':'، ولا شيء يحتاج تصحيحاً';
  var more=items.length?(openStop?'لا تسمح بالإغلاق بعد: '+cnt(openStop,['بند مانع','بندان مانعان','بنود مانعة','بنداً مانعاً'])+' لم يُطابق':'البنود المانعة للإغلاق كلها مطابقة'):null;
  return R(line,done,items.length||null,false,more);
});

/* ===== جدول التشطيبات: bb_tool_finishes_v1 ===== */
/* tools/finishes/index.html:89 fresh={v:1,sel:{},note:{}} ؛ :97 المفتاح sp.id+'|'+surface ؛ :125 sel[k]=materialId
   :135 المقام tot = مجموع spaces[].surfaces في finishes.json ، «اخترت: R من tot» و«لا يُنصح بها في مكانها» (avoid ∩ conditions) */
SUM_REF['bb_tool_finishes_v1']='finishes';
SUM['bb_tool_finishes_v1']=safe(function(d,ref){
  var sel=isObj(d)&&isObj(d.sel)?d.sel:{},note=isObj(d)&&isObj(d.note)?d.note:{};
  var anySel=keys(sel).some(function(k){return str(sel[k])!==''}),anyNote=keys(note).some(function(k){return str(note[k])!==''});
  var hasRef=isObj(ref)&&isArr(ref.spaces)&&isArr(ref.materials);
  if(!hasRef){var n0=keys(sel).filter(function(k){return str(sel[k])!==''}).length;
    if(!n0&&!anyNote)return R('',null,null,true,null);
    return R(n0?'اخترت التشطيب في '+cnt(n0,['سطح واحد','سطحين','أسطح','سطحاً']):'كتبت ملاحظات ولم تختر مادة بعد',null,null,false,null)}
  var M={};ref.materials.forEach(function(m){if(isObj(m)&&m.id)M[m.id]=m});
  var tot=0,done=0,bad=0,spDone=0,spN=0;
  ref.spaces.forEach(function(sp){if(!isObj(sp))return;var su=isArr(sp.surfaces)?sp.surfaces:[];if(!su.length)return;spN++;var c=0;
    var cond=isArr(sp.conditions)?sp.conditions:[];
    su.forEach(function(s){tot++;var m=M[sel[sp.id+'|'+s]];if(!m)return;done++;c++;
      if((isArr(m.avoid)?m.avoid:[]).some(function(x){return cond.indexOf(x)>=0}))bad++});
    if(c===su.length)spDone++});
  if(!done&&!anySel&&!anyNote)return R('',0,tot,true,null);
  if(!done)return R('فتحت الجدول ولم تختر مادة لأي سطح بعد',0,tot,false,null);
  var line='اخترت التشطيب في '+done+' من '+tot+' '+of(tot,['','','أسطح','سطحاً']);
  var more=bad?cnt(bad,['مادة واحدة','مادتان','مواد','مادة'])+' منها لا يُنصح بها في مكانها':'أكملت '+spDone+' من '+spN+' '+of(spN,['','','أماكن','مكاناً']);
  return R(line,done,tot,false,more);
});

})(typeof window!=='undefined'?window:this);
