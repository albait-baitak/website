/* قارئ الأدوات للوحة «بيتي» (المجموعة أ)
   الأدوات: first-session، land، budget (+ quantities)، fifty، room-sizes، smart
   كل دالة: SUM[key](d, ref) => {line, done, of, empty, more}
   لا ترمي خطأً أبداً: كل وصول للحقول عبر دوال حذرة. */
(function(){
var SUM=window.SUM=window.SUM||{};
var SUM_REF=window.SUM_REF=window.SUM_REF||{};

/* ===== أدوات مساعدة ===== */
function isArr(x){return Object.prototype.toString.call(x)==='[object Array]'}
function isObj(x){return x!==null&&typeof x==='object'&&!isArr(x)}
function obj(x){return isObj(x)?x:{}}
function arr(x){return isArr(x)?x:[]}
function str(x){return (typeof x==='string'||typeof x==='number')?String(x):''}
function has(x){return str(x).replace(/\s+/g,'')!==''}
var AR='٠١٢٣٤٥٦٧٨٩';
/* نسخة من TK.toEn/TK.num (assets/js/toolkit.js:5-6) */
function toEn(s){return str(s).replace(/[٠-٩]/g,function(c){return AR.indexOf(c)}).replace(/[,٬\s]/g,'').replace(/٫/g,'.').replace(/[^\d.\-]/g,'')}
function num(s){var v=parseFloat(toEn(s));return isFinite(v)?v:0}
/* فواصل الآلاف بالأرقام اللاتينية، بلا اعتماد على إعدادات اللغة */
function money(n){var r=Math.round(Math.abs(n)),s=String(r).replace(/\B(?=(\d{3})+(?!\d))/g,',');return (n<0?'-':'')+s}
function cut(t,n){t=str(t).replace(/\s+/g,' ').replace(/^\s+|\s+$/g,'');return t.length>n?t.slice(0,n).replace(/\s+$/,'')+'..':t}
function nm(t){return '«'+cut(t,22)+'»'}
/* المعدود: 1 مفرد، 2 مثنى، 3-10 جمع، 11+ مفرد منصوب */
function cnt(n,one,two,few,many){if(n===1)return one;if(n===2)return two;var m=n%100;if(n>=3&&n<=10)return n+' '+few;if(m>=3&&m<=10)return n+' '+few;return n+' '+many}
/* تمييز العدد بعد «من N» (يتبع المقام) */
function noun(n,few,many){var m=n%100;return (m>=3&&m<=10)?few:many}
function keysIn(o,lo,hi,test){var c=0;o=obj(o);for(var k in o){if(!o.hasOwnProperty(k))continue;var i=+k;if(String(i)!==k||i<lo||i>hi)continue;if(test(o[k],i))c++}return c}
function R(line,done,of,empty,more){return {line:line,done:done==null?null:done,of:of==null?null:of,empty:!!empty,more:more||null}}
function E(){return R('',null,null,true,null)}
function guard(fn){return function(d,ref){try{return fn(d,ref)}catch(e){return E()}}}

/* ===================================================================
   bb_tool_first_session_v1  (tools/first-session/index.html)
   20 سؤالاً: GROUPS في السطر 124 (6+6+8). 7 معايير: CRIT السطر 151.
   fresh السطر 156: 3 مرشحين بأسماء «المرشح أ/ب/ج».
   notes[cid][1..20] نص ما سمعه، scores[cid][0..6] من 1 إلى 5، flags[cid].bad/good،
   star[1..20]، price[cid]. active وonlyStar تُحفظ تلقائياً فلا تُحسب.
   =================================================================== */
var FS_Q=20,FS_CRIT=7,FS_DEF={a:'المرشح أ',b:'المرشح ب',c:'المرشح ج'};
SUM['bb_tool_first_session_v1']=guard(function(d){
  d=obj(d);
  var cands=arr(d.cands).filter(function(c){return isObj(c)&&has(c.id)});
  if(!cands.length)cands=[{id:'a',name:FS_DEF.a},{id:'b',name:FS_DEF.b},{id:'c',name:FS_DEF.c}];
  var notes=obj(d.notes),scores=obj(d.scores),flags=obj(d.flags),price=obj(d.price);
  var best=null,bestN=0,scored=0,full=[],flagN=0,renamed=0,priced=0,lastNote='';
  cands.forEach(function(c){
    var nt=obj(notes[c.id]);
    var n=keysIn(nt,1,FS_Q,function(v){return has(v)});
    if(n>bestN){bestN=n;best=c}
    var sc=obj(scores[c.id]),k=0,s=0;
    for(var i=0;i<FS_CRIT;i++){var v=sc[i];if(typeof v==='number'&&v>=1&&v<=5){k++;s+=v}}
    if(k)scored++;
    if(k===FS_CRIT)full.push({c:c,s:s});
    var fl=obj(flags[c.id]);flagN+=Object.keys(obj(fl.bad)).length+Object.keys(obj(fl.good)).length;
    if(has(c.name)&&FS_DEF[c.id]!==str(c.name))renamed++;
    if(has(price[c.id]))priced++;
  });
  var stars=keysIn(d.star,1,FS_Q,function(v){return !!v});
  if(!bestN&&!scored&&!flagN&&!stars&&!renamed&&!priced)return E();
  var nCand=cands.length;
  var scoredTxt='قيّمت '+scored+' من '+nCand+' '+noun(nCand,'مرشحين','مرشحاً');
  if(bestN){
    var more=null;
    if(scored){
      more=scoredTxt;
      if(full.length){full.sort(function(a,b){return b.s-a.s});more+='، أعلاهم '+nm(full[0].c.name)+' بـ '+full[0].s+' من '+(FS_CRIT*5)}
    }else more='لم تقيّم أي مرشح بعد';
    return R('أجبت عن '+bestN+' من '+FS_Q+' سؤالاً مع '+nm(best.name),bestN,FS_Q,false,more);
  }
  if(scored)return R(scoredTxt+' على '+FS_CRIT+' معايير',0,FS_Q,false,'لم تسجّل إجابات المرشحين بعد');
  if(flagN)return R('سجّلت '+cnt(flagN,'علامة واحدة','علامتين','علامات','علامة')+' عن المرشحين',0,FS_Q,false,null);
  if(stars)return R('علّمت '+stars+' من '+FS_Q+' سؤالاً بأنها «مهم عندي»',0,FS_Q,false,'لم تسجّل إجابات المرشحين بعد');
  return R('سمّيت مرشحيك ولم تسجّل إجاباتهم بعد',0,FS_Q,false,null);
});

/* ===================================================================
   bb_tool_land_v1  (tools/land/index.html)
   21 بنداً: LISTS السطر 140 (5+4+4+4+4)، TOTAL محسوب في السطر 150.
   st[lid][1..21] = ok|chk2|bad، notes[lid][1..21]، cost[lid][0..3] (COST السطر 147)،
   dec[lid][0..5] (CRIT السطر 148)، map[lid].pts (رسم الحدود). active يُحفظ تلقائياً.
   =================================================================== */
var LD_TOTAL=21,LD_CRIT=6,LD_DEF={a:'الأرض أ',b:'الأرض ب',c:'الأرض ج'},LD_ST={ok:1,chk2:1,bad:1};
SUM['bb_tool_land_v1']=guard(function(d){
  d=obj(d);
  var lands=arr(d.lands).filter(function(c){return isObj(c)&&has(c.id)});
  if(!lands.length)lands=[{id:'a',name:LD_DEF.a},{id:'b',name:LD_DEF.b},{id:'c',name:LD_DEF.c}];
  var st=obj(d.st),notes=obj(d.notes),cost=obj(d.cost),dec=obj(d.dec),map=obj(d.map);
  var best=null,bestN=-1,info={},touched=0,renamed=0,drawn=null,noteN=0,noteLand=null,decN=0,costLand=null;
  lands.forEach(function(c){
    var s=obj(st[c.id]),o={ok:0,chk2:0,bad:0,n:0};
    for(var k in s){if(!s.hasOwnProperty(k))continue;var i=+k;if(String(i)!==k||i<1||i>LD_TOTAL||!LD_ST[s[k]])continue;o[s[k]]++;o.n++}
    var cs=obj(cost[c.id]),cv=0,anyC=false;for(var j=0;j<4;j++){var v=num(cs[j]);if(v){anyC=true;cv+=v}}
    o.cost=anyC?cv:null;
    var nn=keysIn(notes[c.id],1,LD_TOTAL,function(v){return has(v)});
    var dk=keysIn(dec[c.id],0,LD_CRIT-1,function(v){return typeof v==='number'&&v>=1&&v<=5});
    var pts=arr(obj(map[c.id]).pts).length;
    info[c.id]=o;
    if(o.n>bestN){bestN=o.n;best=c}
    if(o.n||anyC||nn||dk||pts>=1)touched++;
    if(nn>noteN){noteN=nn;noteLand=c}
    if(dk)decN++;
    if(anyC&&!costLand)costLand=c;
    if(pts>=3&&!drawn)drawn=c;
    if(has(c.name)&&LD_DEF[c.id]!==str(c.name))renamed++;
  });
  if(bestN<=0&&!costLand&&!noteN&&!decN&&!drawn&&!touched&&!renamed)return E();
  var nL=lands.length;
  if(bestN>0){
    var o=info[best.id],parts=[];
    if(o.bad)parts.push('مشكلات محتملة: '+o.bad);
    if(o.chk2)parts.push('تحتاج تحقق: '+o.chk2);
    if(o.cost!=null)parts.push('تكلفتها الحقيقية '+money(o.cost)+' ريال');
    if(touched>1&&parts.length<2)parts.unshift('تقارن بين '+touched+' من '+nL+' '+noun(nL,'أراضٍ','أرضاً'));
    return R('فحصت '+bestN+' من '+LD_TOTAL+' بنداً في '+nm(best.name),bestN,LD_TOTAL,false,parts.length?parts.slice(0,2).join('، '):null);
  }
  if(costLand)return R('حسبت التكلفة الحقيقية لـ '+nm(costLand.name)+': '+money(info[costLand.id].cost)+' ريال',0,LD_TOTAL,false,'لم تبدأ قائمة الفحص بعد');
  if(decN)return R('قيّمت '+decN+' من '+nL+' '+noun(nL,'أراضٍ','أرضاً')+' على '+LD_CRIT+' معايير',0,LD_TOTAL,false,'لم تبدأ قائمة الفحص بعد');
  if(drawn)return R('رسمت حدود '+nm(drawn.name)+' على الخريطة',0,LD_TOTAL,false,'لم تبدأ قائمة الفحص بعد');
  if(noteN)return R('كتبت ملاحظات على '+noteN+' من '+LD_TOTAL+' بنداً في '+nm(noteLand.name),0,LD_TOTAL,false,null);
  return R('سمّيت الأراضي ولم تبدأ فحصها بعد',0,LD_TOTAL,false,null);
});

/* ===================================================================
   bb_tool_budget_v1  (tools/budget/index.html + tools/quantities/index.html)
   25 بنداً: BUD في budget السطر 85 وquantities السطر 144 (القائمة نفسها). الاحتياطي البند 24 (RES السطر 86).
   الحاسبة تكتب total وarea وit[0..24] (تقديرات). جدول الكميات يكتب المخزن نفسه ويضيف
   act[0..24] (المصروف الفعلي) وnote[0..24] (ملاحظات النطاق)، السطر 359 في quantities.
   =================================================================== */
var BG_N=25,BG_RES=24;
SUM['bb_tool_budget_v1']=guard(function(d){
  d=obj(d);
  var it=obj(d.it),act=obj(d.act),note=obj(d.note);
  var total=num(d.total),area=num(d.area);
  var est=keysIn(it,0,BG_N-1,function(v){return num(v)>0});
  var E=0,A=0,actN=0;
  for(var i=0;i<BG_N;i++){E+=num(it[i]);var a=num(act[i]);if(a>0){A+=a;actN++}}
  var noteN=keysIn(note,0,BG_N-1,function(v){return has(v)});
  var anyIt=keysIn(it,0,BG_N-1,function(v){return has(v)}),anyAct=keysIn(act,0,BG_N-1,function(v){return has(v)});
  if(!has(d.total)&&!has(d.area)&&!anyIt&&!anyAct&&!noteN)return E0();
  var more=null;
  if(actN)more='صرفت فعلياً '+money(A)+' ريال حتى الآن';
  else if(total&&E>total)more='تقديراتك تتجاوز الميزانية بـ '+money(E-total)+' ريال';
  else if(total&&E&&!(num(it[BG_RES])>0))more='لم تحجز احتياطي الطوارئ بعد';
  else if(total&&E)more='المتبقي بعد التقديرات '+money(total-E)+' ريال';
  else if(area&&E)more='تكلفة المتر المربع '+money(E/area)+' ريال';
  var line;
  if(total&&est)line='ميزانيتك '+money(total)+' ريال، قدّرت منها '+est+' من '+BG_N+' بنداً';
  else if(est)line='قدّرت '+est+' من '+BG_N+' بنداً بمجموع '+money(E)+' ريال';
  else if(total)line='ميزانيتك '+money(total)+' ريال ولم تقدّر بنودها بعد';
  else if(actN)line='سجّلت المصروف الفعلي في '+actN+' من '+BG_N+' بنداً';
  else if(noteN)line='كتبت ملاحظات النطاق على '+noteN+' من '+BG_N+' بنداً';
  else if(area)line='مساحة البناء '+money(area)+' م² ولم تكتب الميزانية بعد';
  else line='فتحت الميزانية وبدأت الكتابة';
  return R(line,est,BG_N,false,more);
});
function E0(){return E()}

/* ===================================================================
   bb_tool_fifty_v1  (tools/fifty/index.html)
   50 سؤالاً: G السطر 100 (8+6+8+5+5+4+3+4+4+3)، والأداة نفسها تقسم على 50 في السطر 143.
   a[1..50] الإجابات (تُحذف إن فرغت)، sum = 10 صفوف {t,d} (fresh السطر 113)،
   d: 0 لا يقبل التنازل، 1 مهم، 2 تحسين.
   =================================================================== */
var FF_N=50,FF_SUM=10;
SUM['bb_tool_fifty_v1']=guard(function(d){
  d=obj(d);
  var n=keysIn(d.a,1,FF_N,function(v){return has(v)});
  var rows=arr(d.sum),sumN=0,must=0,degN=0;
  rows.slice(0,FF_SUM).forEach(function(r){r=obj(r);var t=has(r.t);if(t)sumN++;if(r.d===0||r.d===1||r.d===2){degN++;if(t&&r.d===0)must++}});
  if(!n&&!sumN&&!degN)return E();
  var more=null;
  if(sumN){more='خلاصتك: '+sumN+' من '+FF_SUM+' أشياء';if(must)more+='، منها '+(must===1?'واحد':must)+' لا يقبل التنازل'}
  else if(n)more='لم تكتب خلاصتك العشرية بعد';
  if(n)return R('أجبت عن '+n+' من '+FF_N+' سؤالاً',n,FF_N,false,more);
  if(sumN)return R('كتبت '+sumN+' من '+FF_SUM+' أشياء في خلاصتك',0,FF_N,false,must?('منها '+(must===1?'واحد':must)+' لا يقبل التنازل'):null);
  return R('بدأت ترتيب خلاصتك ولم تجب عن الأسئلة بعد',0,FF_N,false,null);
});

/* ===================================================================
   bb_tool_roomsizes_v1  (tools/room-sizes/index.html)
   المرجع: refs/guide/rooms.json. المقام = مجموع checks لغرف المستخدم (كما في total() السطر 144).
   rooms[] = {id,type,name,val:{checkId: سم | {d,s} للنسبة}}. الحكم منسوخ من value()/judge().
   =================================================================== */
SUM_REF['bb_tool_roomsizes_v1']='rooms';
function rsValue(c,v){if(v==null)return null;
  if(c.unit==='ratio'){v=obj(v);var dd=num(v.d),s=num(v.s);if(!dd||!s)return null;return dd/(s*2.54)}
  if(typeof v==='object')return null;
  var n=num(v);return str(v)===''||!isFinite(n)||n<=0?null:n}
function rsJudge(c,x){if(x==null)return null;
  if(c.min!=null&&x<c.min)return 'r';if(c.max!=null&&x>c.max)return 'r';if(c.ideal_min!=null&&x<c.ideal_min)return 'y';return 'g'}
SUM['bb_tool_roomsizes_v1']=guard(function(d,ref){
  d=obj(d);
  var rooms=arr(d.rooms).filter(isObj);
  if(!rooms.length)return E();
  var T={};arr(obj(ref).rooms).forEach(function(r){if(isObj(r)&&has(r.id))T[r.id]=r});
  var haveRef=Object.keys(T).length>0;
  var a={r:0,y:0,g:0,n:0},nRooms=0,raw=0;
  rooms.forEach(function(r){
    var val=obj(r.val);
    if(!haveRef){nRooms++;for(var k in val){if(!val.hasOwnProperty(k))continue;var v=val[k];if(isObj(v)?(num(v.d)&&num(v.s)):num(v)>0)raw++}return}
    var t=T[r.type];if(!t)return;nRooms++;
    arr(t.checks).forEach(function(c){if(!isObj(c))return;a.n++;var j=rsJudge(c,rsValue(c,val[c.id]));if(j)a[j]++});
  });
  var rw=cnt(nRooms,'غرفة واحدة','غرفتين','غرف','غرفة');
  if(!haveRef){
    if(raw)return R('قست '+raw+' '+noun(raw,'قياسات','قياساً')+' في '+rw,null,null,false,null);
    return R('أضفت '+rw+' ولم تقس شيئاً بعد',null,null,false,null);
  }
  if(!nRooms)return R('أضفت غرفاً لمراجعة مقاساتها',null,null,false,null);
  var m=a.r+a.y+a.g;
  if(!m)return R('أضفت '+rw+' ولم تقس شيئاً بعد',0,a.n,false,null);
  var parts=[];if(a.r)parts.push('تحتاج مراجعة: '+a.r);if(a.y)parts.push('يمكن أفضل: '+a.y);
  var more=parts.length?parts.join('، '):'كل ما قسته مناسب';
  return R('قست '+m+' من '+a.n+' '+noun(a.n,'قياسات','قياساً')+' في '+rw,m,a.n,false,more);
});

/* ===================================================================
   bb_tool_smart_v1  (tools/smart/index.html)
   6 أسئلة: Q السطر 113، والأداة تعدّ i<6 في score() السطر 178. المجموع من 12.
   BANDS السطر 123: 10-12 اشترِ، 6-9 أجّل وفكر، 0-5 وفّر مالك (الحكم لا يظهر إلا بعد 6 من 6).
   devs[] = {id,name,p:{0..5: 0|1|2},n:{ملاحظات},c:{0..3 تكاليف}}، الاسم الافتراضي «الجهاز N».
   active يُحفظ تلقائياً.
   =================================================================== */
var SM_Q=6;
function smBand(s){return s>=10?'اشترِ':s>=6?'أجّل وفكر':'وفّر مالك'}
SUM['bb_tool_smart_v1']=guard(function(d){
  d=obj(d);
  var devs=arr(d.devs).filter(isObj);
  var tested=[],complete=[],noteDev=null,costDev=null,renamed=0;
  devs.forEach(function(v){
    var p=obj(v.p),k=0,s=0;
    for(var i=0;i<SM_Q;i++){var x=p[i];if(x===0||x===1||x===2){k++;s+=x}}
    var c=obj(v.c),cv=0,anyC=false;for(var j=0;j<4;j++){if(has(c[j])){anyC=true;cv+=num(c[j])}}
    var o={d:v,k:k,s:s,cost:anyC?cv:null};
    if(k)tested.push(o);
    if(k===SM_Q)complete.push(o);
    if(!noteDev&&keysIn(v.n,0,SM_Q-1,function(t){return has(t)}))noteDev=o;
    if(!costDev&&anyC)costDev=o;
    if(has(v.name)&&!/^الجهاز \d+$/.test(str(v.name)))renamed++;
  });
  if(!tested.length&&!noteDev&&!costDev&&!renamed&&devs.length<=1)return E();
  var name=function(o){return nm(has(o.d.name)?o.d.name:'جهاز')};
  if(tested.length===1){
    var o=tested[0];
    if(o.k===SM_Q)return R('حكمك على '+name(o)+': '+smBand(o.s)+' ('+o.s+' من 12)',SM_Q,SM_Q,false,o.cost!=null?'تكلفته أول سنة '+money(o.cost)+' ريال':null);
    return R('أجبت عن '+o.k+' من '+SM_Q+' أسئلة عن '+name(o),o.k,SM_Q,false,'يظهر الحكم بعد الأسئلة الستة كلها');
  }
  if(tested.length>1){
    var line='اختبرت '+cnt(tested.length,'جهازاً واحداً','جهازين','أجهزة','جهازاً');
    line+=complete.length?('، واكتمل الحكم على '+complete.length+' منها'):'، ولم يكتمل الحكم على أي منها';
    var more=complete.length?complete.slice(0,3).map(function(o){return cut(o.d.name,14)+': '+smBand(o.s)}).join('، '):null;
    return R(line,null,null,false,more);
  }
  if(costDev)return R('حسبت تكلفة '+name(costDev)+' أول سنة: '+money(costDev.cost)+' ريال',0,SM_Q,false,null);
  if(noteDev)return R('كتبت ملاحظاتك عن '+name(noteDev)+' ولم تجب عن الأسئلة بعد',0,SM_Q,false,null);
  return R('أضفت '+cnt(Math.max(devs.length,1),'جهازاً واحداً','جهازين','أجهزة','جهازاً')+' ولم تختبر أي جهاز بعد',0,SM_Q,false,null);
});
})();
