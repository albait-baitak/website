/* قارئ الأدوات، المجموعة ج: الكميات، ملف بيتك (الاستلام)، دفتر السنة الأولى، تقويم الصيانة.
   ومعها window.UPCOMING: المواعيد القادمة بمنطق supabase/functions/cal/index.ts نفسه.
   ES5 فقط. لا ترمي أخطاء أبداً. */
(function(){
var SUM=window.SUM=window.SUM||{};
var SUM_REF=window.SUM_REF=window.SUM_REF||{};

/* ===== أدوات مشتركة ===== */
function isArr(x){return Object.prototype.toString.call(x)==='[object Array]'}
function isObj(x){return !!x&&typeof x==='object'&&!isArr(x)}
function keys(o){return isObj(o)?Object.keys(o):[]}
// صف «فيه إدخال» = فيه قيمة غير فارغة واحدة على الأقل
function filled(r){if(!isObj(r))return false;for(var k in r)if(r.hasOwnProperty(k)&&r[k]!==''&&r[k]!=null&&r[k]!==false)return true;return false}
// صيغة العدد: نسخة من guide.js:48
function cnt(k,f){k=+k;return k===1?f[0]:k===2?f[1]:(k>=3&&k<=10)?k+' '+f[2]:k+' '+f[3]}
function cut(s,n){s=String(s==null?'':s).replace(/\s+/g,' ').trim();if(s.length<=n)return s;var c=s.slice(0,n),i=c.lastIndexOf(' ');if(i>n*0.6)c=c.slice(0,i);return c.replace(/[\s،,.]+$/,'')+'..'}
// toEn/num/fmt: نسخ حرفية من assets/js/toolkit.js:5-7
var AR='٠١٢٣٤٥٦٧٨٩';
function toEn(s){return String(s==null?'':s).replace(/[٠-٩]/g,function(d){return AR.indexOf(d)}).replace(/[,٬\s]/g,'').replace(/٫/g,'.').replace(/[^\d.\-]/g,'')}
function num(s){var v=parseFloat(toEn(s));return isFinite(v)?v:0}
function fmt(n,dec){if(n==null||!isFinite(n))return '';var d=dec==null?2:dec;return (Math.round(n*Math.pow(10,d))/Math.pow(10,d)).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:0})}
// اليوم المحلي وفرق الأيام: كما في الأدوات (tools/maintenance/index.html:90-96)
function pad(n){return ('0'+n).slice(-2)}
function isoL(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function todayL(){return isoL(new Date())}
function daysL(a,b){return Math.round((new Date(a+'T00:00:00')-new Date(b+'T00:00:00'))/864e5)}
var RX=/^\d{4}-\d{2}-\d{2}$/;
// TK.store (toolkit.js:12) يرمي البيانات ويبدأ fresh إذا v لا يساوي 1، فنعاملها فارغة مثله
function stale(d){return !isObj(d)||d.v!==1}
var EMPTY={line:'',done:null,of:null,empty:true,more:null};
function emp(){return {line:EMPTY.line,done:null,of:null,empty:true,more:null}}

/* ===== bb_tool_qty_v1 : جداول الكميات (tools/quantities/index.html) ===== */
// لا مرجع
(function(){
var WET=['bath','laundry']; // quantities:142
function geo(r,Hg){ // نسخة من geo() في quantities:153-172 بلا تعديل على r
  var o={err:[]},A,P;
  if(r.mode==='free'){A=num(r.A);P=num(r.P);if(!(A>0))o.err.push(1);if(!(P>0))o.err.push(1)}
  else{var L=num(r.L),W=num(r.W);if(!(L>0))o.err.push(1);if(!(W>0))o.err.push(1);A=L*W;P=2*(L+W)}
  var hh=num(r.h),h=hh>0?hh:num(Hg),dn=num(r.dn),dw=num(r.dw),dh=num(r.dh),wn=num(r.wn),ww=num(r.ww),wh=num(r.wh),tH=num(r.tH);
  if(dn>0&&!(dw>0))o.err.push(1);if(dn>0&&!(dh>0))o.err.push(1);
  if(wn>0&&(!(ww>0)||!(wh>0)))o.err.push(1);
  o.A=A;o.P=P;o.h=h;o.noH=!(h>0);
  o.doorW=dn*dw;o.doorA=dn*dw*dh;o.winA=wn*ww*wh;o.dn=dn;o.wn=wn;
  if(o.err.length)return o;
  o.floor=A;o.ceil=A;
  if(!o.noH){var tz=Math.min(tH,h);o.tile=tH>0?Math.max(0,P*tz-dn*dw*Math.min(dh,tz)):0;o.paint=Math.max(0,P*h-o.doorA-o.winA-o.tile)}
  o.skirt=tH>0?0:Math.max(0,P-o.doorW);
  o.wp=WET.indexOf(r.type)>=0?A:0;
  return o;
}
function calc(rooms,fins,Hg){ // quantities:173-185
  var agg={floor:{},skirt:0,tile:0,paintW:0,paintC:0,gyps:0,wp:0,doors:{},win:0,winN:0,area:0,bad:0,noH:false};
  rooms.forEach(function(r){var g=geo(r,Hg);if(g.err.length){agg.bad++;return}
    var fin=fins[r.ff]||fins[0]||'أرضيات';agg.floor[fin]=(agg.floor[fin]||0)+g.floor;agg.area+=g.A;
    agg.skirt+=g.skirt;agg.wp+=g.wp;
    if(g.noH)agg.noH=true;else{agg.tile+=g.tile;agg.paintW+=g.paint}
    if(r.ceil==='gypsum'){agg.gyps+=g.ceil;agg.paintC+=g.ceil}else if(r.ceil!=='none')agg.paintC+=g.ceil;
    if(g.dn>0){var k=fmt(num(r.dw),2)+' × '+fmt(num(r.dh),2);agg.doors[k]=(agg.doors[k]||0)+g.dn}
    agg.win+=g.winA;agg.winN+=g.wn;
  });
  return agg;
}
function qrows(a){ // quantities:186-198 (الحقول اللازمة للحساب فقط)
  var R=[];
  Object.keys(a.floor).forEach(function(f){R.push({k:'floor:'+f,q:a.floor[f],w:8})});
  R.push({k:'skirt',q:a.skirt,w:0});
  R.push({k:'tile',q:a.noH?null:a.tile,w:8});
  R.push({k:'paintW',q:a.noH?null:a.paintW,w:0});
  R.push({k:'gyps',q:a.gyps,w:0});
  R.push({k:'paintC',q:a.paintC,w:0});
  R.push({k:'wp',q:a.wp,w:0});
  Object.keys(a.doors).forEach(function(d){R.push({k:'door:'+d,q:a.doors[d],w:0,int:true})});
  if(a.winN)R.push({k:'win',q:a.win,w:0});
  return R;
}
function rowCost(q,r){ // quantities:200-201؛ qmeta يُنشئ {w:String(w),pr:''} إن غاب، فنقرؤه دون إنشاء
  var m=isObj(q[r.k])?q[r.k]:{sp:'',w:String(r.w),pr:''};if(r.q==null)return null;
  var buy=r.int?r.q:r.q*(1+num(m.w)/100);var p=num(m.pr);return {buy:buy,tot:p>0?buy*p:null}}

SUM['bb_tool_qty_v1']=function(d){
  try{
    if(stale(d))return emp();
    var rooms=isArr(d.rooms)?d.rooms.filter(isObj):[];
    if(!rooms.length){
      if(num(d.H)>0)return {line:'حددت ارتفاع السقف ولم تُدخل فراغات بعد',done:null,of:null,empty:false,more:null};
      return emp();
    }
    var fins=isArr(d.fins)?d.fins:[],q=isObj(d.q)?d.q:{};
    var a=calc(rooms,fins,d.H),gtot=0;
    qrows(a).forEach(function(r){var c=rowCost(q,r);if(c&&c.tot!=null)gtot+=c.tot}); // drawQty: quantities:298
    var fl=isArr(d.floors)?d.floors.filter(isObj):[],used=0;
    fl.forEach(function(f){if(rooms.some(function(r){return r.floor===f.id}))used++});
    var line='أدخلت '+cnt(rooms.length,['فراغاً واحداً','فراغين','فراغات','فراغاً'])+(used?' في '+cnt(used,['دور واحد','دورين','أدوار','دوراً']):'');
    if(gtot)line+='، وتكلفة التشطيب المقدرة '+fmt(gtot,0)+' ريال';
    var more=null;
    if(a.bad)more=cnt(a.bad,['فراغ واحد ناقص البيانات','فراغان ناقصا البيانات','فراغات ناقصة البيانات','فراغاً ناقص البيانات']);
    else if(a.area)more='مساحة الأرضيات '+fmt(a.area)+' م²';
    return {line:line,done:null,of:null,empty:false,more:more};
  }catch(e){return emp()}
};
})();

/* ===== bb_tool_handover_v1 : ملف بيتك (tools/handover/index.html) ===== */
// لا مرجع. المقام ثابت: TOTAL = مجموع بنود LISTS (handover:112-121، يُحسب في handover:130) = 3+4+4+4+4+3+4+4 = 30
(function(){
var TOTAL=30;
SUM['bb_tool_handover_v1']=function(d){
  try{
    if(stale(d))return emp();
    var st=isObj(d.st)?d.st:{},dl=isObj(d.dl)?d.dl:{},c={ok:0,chk2:0,bad:0},open=0;
    // paint(): handover:162-165 يمر على المعرّفات 1..TOTAL فقط
    for(var id=1;id<=TOTAL;id++){var v=st[id];if(v==='ok'||v==='chk2'||v==='bad')c[v]++;if(v==='bad'&&!dl[id])open++}
    var done=c.ok+c.chk2+c.bad;
    var war=isArr(d.war)?d.war.filter(filled).length:0,con=isArr(d.con)?d.con.filter(filled).length:0,mnt=isArr(d.mnt)?d.mnt.filter(filled).length:0;
    var other=keys(d.notes).length+keys(d.card).length+keys(d.ph).length+keys(d.sea).length+keys(d.dl).length+war+con+mnt;
    if(!done&&!other)return emp();
    var recMore=war?'سجلت '+cnt(war,['ضماناً واحداً','ضمانين','ضمانات','ضماناً'])+' في ملف البيت':con?'سجلت '+cnt(con,['مقاولاً واحداً','مقاولَين','مقاولين','مقاولاً'])+' في ملف البيت':null;
    if(!done)return {line:'لم تبدأ قائمة فحص الاستلام بعد',done:0,of:TOTAL,empty:false,more:recMore};
    var line=(done===TOTAL?'اكتمل الفحص: ':'فحصت ')+done+' من '+TOTAL+' بنداً'; // صياغة الأداة: handover:169
    if(c.bad)line+='، وفيها '+cnt(c.bad,['نقطة واحدة','نقطتان','نقاط','نقطة'])+' تعالج قبل التوقيع';
    else if(c.chk2)line+='، وفيها '+cnt(c.chk2,['إصلاح بسيط واحد','إصلاحان بسيطان','إصلاحات بسيطة','إصلاحاً بسيطاً']);
    var more=open?cnt(open,['نقطة واحدة','نقطتان','نقاط','نقطة'])+' من (✕) بلا مهلة إصلاح مكتوبة':recMore;
    return {line:line,done:done,of:TOTAL,empty:false,more:more};
  }catch(e){return emp()}
};
})();

/* ===== bb_tool_homeplan_v1 : مسقط بيتك (tools/home-plan/index.html) ===== */
// لا مرجع ولا مقام ثابت. المثال التجريبي (sample) لا يُعد تقدماً
SUM['bb_tool_homeplan_v1']=function(d){
  try{
    if(stale(d)||d.sample)return emp();
    var rooms=0;(isArr(d.floors)?d.floors:[]).forEach(function(f){if(isObj(f)&&isArr(f.rooms))rooms+=f.rooms.length});
    if(!rooms)return emp();
    var assets=0,open=0,photos=0;keys(d.data).forEach(function(k){var r=d.data[k];if(!isObj(r))return;
      assets+=isArr(r.assets)?r.assets.length:0;photos+=isArr(r.photos)?r.photos.length:0;
      open+=isArr(r.notes)?r.notes.filter(function(n){return isObj(n)&&n.open}).length:0});
    var line='رسمت '+cnt(rooms,['غرفة واحدة','غرفتين','غرف','غرفة']);
    if(assets)line+=' وسجلت '+cnt(assets,['جهازاً واحداً','جهازين','أجهزة','جهازاً']);
    var more=open?cnt(open,['ملاحظة مفتوحة واحدة','ملاحظتان مفتوحتان','ملاحظات مفتوحة','ملاحظة مفتوحة'])+' في السجل':photos?cnt(photos,['صورة واحدة','صورتان','صور','صورة'])+' لما خلف الجدران':null;
    return {line:line,done:null,of:null,empty:false,more:more};
  }catch(e){return emp()}
};

/* ===== bb_tool_firstyear_v1 : دفتر السنة الأولى (tools/first-year/index.html) ===== */
// لا مرجع. لا مقام ثابت (عدد الملاحظات من المستخدم) فـ done/of = null
SUM['bb_tool_firstyear_v1']=function(d,ref,today){
  try{
    if(stale(d))return emp();
    var notes=isArr(d.notes)?d.notes.filter(isObj):[],war=isArr(d.war)?d.war.filter(filled):[];
    if(!notes.length&&!war.length)return emp(); // fresh: notes:[], war:[{},{}] (first-year:117)
    var td=RX.test(today||'')?today:todayL();
    var soon=war.filter(function(w){if(!RX.test(w.end||'')||w.res)return false;var n=daysL(w.end,td);return n>=0&&n<=60}); // first-year:190
    if(!notes.length)return {line:'سجلت '+cnt(war.length,['ضماناً واحداً','ضمانين','ضمانات','ضماناً'])+' ولم تدوّن ملاحظة بعد',done:null,of:null,empty:false,
      more:soon.length?'ضمان يقترب من نهايته: '+cut(soon[0].item||'بلا اسم',30):null};
    var fixed=notes.filter(function(n){return !!n.fixed}).length,N=notes.length; // fixed = تاريخ المعالجة (first-year:150)
    var line='دوّنت '+cnt(N,['ملاحظة واحدة','ملاحظتين','ملاحظات','ملاحظة']);
    if(!fixed)line+=N===1?' لم تُعالج بعد':' لم يُعالج منها شيء بعد';
    else if(fixed===N)line+=N===1?' وعولجت':' وعولجت كلها';
    else line+='، عولج منها '+fixed;
    var nowOpen=notes.filter(function(n){return n.cat==='now'&&!n.fixed}).length,more; // first-year:188
    if(nowOpen)more=nowOpen+' من ملاحظات «الآن» لم تُعالج';
    else if(soon.length)more='ضمان يقترب من نهايته: '+cut(soon[0].item||'بلا اسم',30);
    else{var last=notes.slice().sort(function(a,b){return String(a.date||'')<String(b.date||'')?1:String(a.date||'')>String(b.date||'')?-1:0})[0];
      more=last&&last.text?'آخر ملاحظة: '+cut(last.text,40):null}
    return {line:line,done:null,of:null,empty:false,more:more};
  }catch(e){return emp()}
};

/* ===== bb_tool_maint_v1 : تقويم الصيانة (tools/maintenance/index.html) ===== */
// المرجع: refs/guide/maintenance.json (tasks[].id, interval_months). المقام = عدد الأعمال في المرجع غير المخفية (off)
SUM_REF['bb_tool_maint_v1']='maintenance';
(function(){
function next(t,last){ // نسخة من next() في maintenance:92-94
  var v=last[t.id];if(!v)return null;var d=new Date(v+'T00:00:00');
  if(t.interval_months<1)d.setDate(d.getDate()+Math.round(t.interval_months*28));else{var m=d.getMonth()+t.interval_months,day=d.getDate();d.setDate(1);d.setMonth(m);var dim=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,dim))}
  return isoL(d)}
SUM['bb_tool_maint_v1']=function(d,ref,today){
  try{
    if(stale(d))return emp();
    var last=isObj(d.last)?d.last:{},off=isObj(d.off)?d.off:{};
    var lk=keys(last).filter(function(k){return !!last[k]}),ok=keys(off).filter(function(k){return !!off[k]});
    if(!lk.length&&!ok.length)return emp(); // view محفوظ تلقائياً ولا يُعد تقدماً
    var tasks=ref&&isArr(ref.tasks)?ref.tasks.filter(isObj):null;
    if(!tasks){
      if(!lk.length)return {line:'أخفيت '+cnt(ok.length,['عملاً واحداً','عملين','أعمال','عملاً'])+' ولم تسجّل تاريخاً بعد',done:null,of:null,empty:false,more:null};
      return {line:'سجّلت تاريخ آخر تنفيذ لـ'+cnt(lk.length,['عمل واحد','عملين','أعمال','عملاً']),done:null,of:null,empty:false,more:null};
    }
    var td=RX.test(today||'')?today:todayL(),c={over:0,soon:0,new:0,ok:0},of=0,done=0;
    tasks.forEach(function(t){if(off[t.id])return;of++; // draw(): maintenance:107
      var n=next(t,last);if(!n){c['new']++;return}done++;var x=daysL(n,td);
      if(x<0)c.over++;else if(x<=14)c.soon++;else c.ok++}); // state(): maintenance:97-98
    if(!done)return {line:'لم تسجّل تاريخ أي عمل بعد، وأخفيت '+cnt(ok.length,['عملاً واحداً','عملين','أعمال','عملاً']),done:0,of:of,empty:false,more:null};
    var line='سجّلت آخر تنفيذ لـ'+done+' من '+of+' '+(of>=3&&of<=10?'أعمال':'عملاً');
    var more=c.over?cnt(c.over,['عمل واحد متأخر','عملان متأخران','أعمال متأخرة','عملاً متأخراً']) // maintenance:125
      :c.soon?cnt(c.soon,['عمل واحد','عملان','أعمال','عملاً'])+' خلال أسبوعين':null; // maintenance:126
    return {line:line,done:done,of:of,empty:false,more:more};
  }catch(e){return emp()}
};
})();

/* ===== UPCOMING: نسخة من منطق supabase/functions/cal/index.ts بتواريخ UTC =====
   الفرق الوحيد: نُسقط ما مضى عليه أكثر من يوم (عدا الصيانة المتأخرة فتظهر اليوم)، ونرتب تصاعدياً ونأخذ 5. */
(function(){
function p2(n){return ('0'+n).slice(-2)}
function iso(d){return d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)+'-'+p2(d.getUTCDate())}
function parse(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s==='string'?s:'');return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])):null}
function addDays(d,n){return new Date(d.getTime()+n*864e5)}
function addMonths(d,m){
  if(m<1)return addDays(d,Math.round(m*28));
  var day=d.getUTCDate(),t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+m,1));
  var dim=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();
  t.setUTCDate(Math.min(day,dim));return t}
function arr(x){return isArr(x)?x:[]}
window.UPCOMING=function(D,refs,today){
  var evs=[];
  var T=parse(today);if(!T){var n0=new Date();T=new Date(Date.UTC(n0.getFullYear(),n0.getMonth(),n0.getDate()))}
  var floor=addDays(T,-1);
  try{
    D=isObj(D)?D:{};refs=refs||{};
    function push(date,title,slug){if(date&&!isNaN(date.getTime()))evs.push({d:date,date:iso(date),title:title,href:'tools/'+slug+'/'})}
    // الصيانة الدورية
    var M=D['bb_tool_maint_v1'],TASKS=refs.maintenance&&isArr(refs.maintenance.tasks)?refs.maintenance.tasks:[];
    if(isObj(M)&&M.last){
      TASKS.forEach(function(tk){
        if(!isObj(tk))return;if(M.off&&M.off[tk.id])return;var last=parse(M.last[tk.id]);if(!last)return;
        var due=addMonths(last,Number(tk.interval_months));if(isNaN(due.getTime()))return;var late=due<T;if(late)due=T;
        push(due,(late?'متأخر: ':'صيانة: ')+tk.task_ar,'maintenance');
      });
    }
    // الضمانات: قبل النهاية بـ60 يوماً، ويوم النهاية (كلها إلى first-year كما في cal)
    var seen={};
    function warranty(item,end,who){
      var e=parse(end);if(!e)return;var k=(item||'')+'|'+end;if(seen[k])return;seen[k]=1;
      var nm=item||'بلا اسم',pre=addDays(e,-60);
      if(pre>=floor)push(pre,'بعد 60 يوماً ينتهي ضمان: '+nm,'first-year');
      push(e,'ينتهي اليوم ضمان: '+nm,'first-year');
    }
    var F=isObj(D['bb_tool_firstyear_v1'])?D['bb_tool_firstyear_v1']:null;
    arr(F&&F.war).forEach(function(w){if(w&&w.end&&!w.res)warranty(w.item,w.end,w.who||w.sup||'')});
    var H=isObj(D['bb_tool_handover_v1'])?D['bb_tool_handover_v1']:null;
    arr(H&&H.war).forEach(function(w){if(w&&w.end)warranty(w.item,w.end,w.sup||'')});
    arr(H&&H.con).forEach(function(c){if(c&&c.until)warranty([c.item,c.name].filter(Boolean).join(' · '),c.until,c.ph||'')});
    // مهل إصلاح نقاط الاستلام (✕)
    if(H&&isObj(H.dl))Object.keys(H.dl).forEach(function(id){
      if(!(isObj(H.st)&&H.st[id]==='bad'))return;var d=parse(H.dl[id]);if(!d)return;
      var note=isObj(H.notes)&&H.notes[id]?String(H.notes[id]).slice(0,80):'';
      push(d,'تنتهي مهلة إصلاح في الاستلام'+(note?': '+note:''),'handover');
    });
    // نهاية مدة تنفيذ كل بند متفق عليه
    var G=D['bb_tool_agree_v1'];
    arr(isObj(G)?G.ags:null).forEach(function(a){
      if(!isObj(a))return;var f=parse(a.from),n=parseInt(String(a.days==null?'':a.days).replace(/[^\d]/g,''),10);if(!f||!n)return;
      push(addDays(f,n),'نهاية مدة تنفيذ: '+(a.item||'بند'),'agreement');
    });
  }catch(e){}
  var out=evs.filter(function(e){return e.d>=floor});
  out=out.map(function(e,i){e.i=i;return e}).sort(function(a,b){return a.d-b.d||a.i-b.i}).slice(0,5);
  return out.map(function(e){return {date:e.date,title:e.title,href:e.href}});
};
})();
})();
