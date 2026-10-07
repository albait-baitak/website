/* اختبار قارئ الأدوات، المجموعة ب. التشغيل: node test_b.js */
var vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert');
var REFDIR=''+path.join(__dirname,'../../../refs/guide/')+'';
var window={SUM:{},SUM_REF:{}};var ctx={window:window};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../../../assets/js/dash/sum-b.js'),'utf8'),ctx);
var SUM=window.SUM,SUM_REF=window.SUM_REF;
function ref(k){var n=SUM_REF[k];return n?JSON.parse(fs.readFileSync(REFDIR+n+'.json','utf8')):null}
var J=function(x){return JSON.parse(JSON.stringify(x))};
var fails=0,out=[];
function check(res,label){
  assert.ok(res&&typeof res==='object',label+': لا نتيجة');
  ['line','done','of','empty','more'].forEach(function(f){assert.ok(f in res,label+': ينقص '+f)});
  assert.strictEqual(typeof res.empty,'boolean',label+': empty');
  assert.strictEqual(typeof res.line,'string',label+': line');
  var all=res.line+' '+(res.more||'');
  assert.ok(!/…|—/.test(all),label+': علامة ممنوعة');
  assert.ok(!/دورة|كورس|منهج|واجب|مهام تفاعلية/.test(all),label+': كلمة محظورة');
  assert.ok(!/[٠-٩]/.test(all),label+': أرقام غير لاتينية');
  assert.ok(!/undefined|NaN|null/.test(all),label+': قيمة تالفة في السطر');
  assert.ok(res.line.length<=72,label+': السطر طويل ('+res.line.length+')');
  if(res.more)assert.ok(res.more.length<=72,label+': more طويل');
}
function T(name,fn){try{fn();out.push('ok   '+name)}catch(e){fails++;out.push('FAIL '+name+' :: '+e.message)}}
function run(k,d,label){var r=SUM[k](d,ref(k));check(r,label);return r}
function show(k,r){out.push('     '+k+' => line: «'+r.line+'» | done/of: '+r.done+'/'+r.of+' | more: '+(r.more?'«'+r.more+'»':'null'))}
var BAD=[null,undefined,{},[],'x',42,{v:1},{v:1,rooms:null,s:'x',sh:[null,{o:null}],ags:[null,{pays:null}],st:null,sel:[]},{v:1,s:[null,{c:null,d:5}],sh:[{o:{a:null,b:'z'},win:'a'}],ags:[{item:5,days:'abc',from:'xx',pays:[null]}],st:{x:'ok'},sel:{'a|b':'nope'},rooms:[null,{type:'nope',q:null}]}];

/* ---------- fresh من كود كل أداة (ar=String في toolkit.js:4) ---------- */
var STN_N=[8,6,8,5,5,4,3,4,4,3];
var FRESH={
  bb_tool_points_v1:{v:1,rooms:[]},
  bb_tool_roadmap_v1:(function(){var o={v:1,s:[]};STN_N.forEach(function(){o.s.push({c:{},start:'',recv:'',d:{},note:''})});return o})(),
  bb_tool_offers_v1:{v:1,sh:[{id:'s1',name:'البند 1',o:{a:{},b:{},c:{}},win:'',why:''}],active:'s1'},
  bb_tool_agree_v1:{v:1,ags:[{id:'g1',item:'البند 1',owner:'',ownerPh:'',con:'',conPh:'',site:'',date:'',inc:'',exc:'',mat:'',matInc:'',matExc:'',
    b1:false,open:'',b2:true,b3:false,conflict:'',c1:false,util:'',c2:false,hFrom:'',hTo:'',c3:true,c4:true,days:'',from:'',delay:'',
    pays:[{n:'الأولى',w:'',a:''},{n:'الثانية',w:'',a:''},{n:'الأخيرة (بعد الاستلام النهائي)',w:'',a:''}],price:'',e1:true,e2:true,e3:false,war:'',sig1:'',sig2:'',wit:''}],active:'g1'},
  bb_tool_roughin_v1:{v:1,st:{},notes:{},date:{}},
  bb_tool_finishes_v1:{v:1,sel:{},note:{}}
};
Object.keys(FRESH).forEach(function(k){
  T(k+' fresh => empty',function(){var r=run(k,J(FRESH[k]),k+' fresh');assert.strictEqual(r.empty,true)});
  T(k+' تالفة => بلا خطأ',function(){BAD.forEach(function(b,i){var r=SUM[k](b,ref(k));check(r,k+' bad#'+i);r=SUM[k](b,null);check(r,k+' bad-noref#'+i)})});
});
/* الحقول التلقائية وحدها لا تُعد تقدماً */
T('offers: active وحده لا يُعد تقدماً',function(){var d=J(FRESH.bb_tool_offers_v1);d.active='zzz';assert.strictEqual(run('bb_tool_offers_v1',d,'o-act').empty,true)});
T('agree: active وحده لا يُعد تقدماً',function(){var d=J(FRESH.bb_tool_agree_v1);d.active='zzz';assert.strictEqual(run('bb_tool_agree_v1',d,'a-act').empty,true)});

/* ---------- بيانات جزئية واقعية ---------- */
T('points جزئي',function(){var k='bb_tool_points_v1';
  var d={v:1,rooms:[{id:'r1',type:'majlis',name:'مجلس الرجال',q:{'majlis-sock':'10'},note:''},{id:'r2',type:'kitchen',name:'المطبخ',q:{},note:'الثلاجة يمين'},{id:'r3',type:'bathroom',name:'حمام',q:{},note:''}]};
  var r=run(k,d,k);show(k,r);assert.strictEqual(r.empty,false);assert.ok(/^حددت نقاط 3 غرف: \d+ كهرباء، \d+ تيار خفيف، \d+ سباكة$/.test(r.line));
  /* تحقق الرقم يدوياً من المرجع */
  var R=ref(k),t={};R.rooms.forEach(function(x){t[x.id]=x});var e=0;d.rooms.forEach(function(rm){(t[rm.type].electrical||[]).forEach(function(it){var v=rm.q[it.id];e+=(v===undefined||v==='')?it.qty:+v})});
  assert.ok(r.line.indexOf(e+' كهرباء')>0,'مجموع الكهرباء '+e);assert.strictEqual(r.more,'عدّلت الأعداد المقترحة في غرفة واحدة');
  var r2=SUM[k](d,null);show(k+' (بلا مرجع)',r2);assert.strictEqual(r2.line,'أضفت 3 غرف إلى جدول النقاط')});

T('roadmap جزئي',function(){var k='bb_tool_roadmap_v1',d=J(FRESH[k]);
  for(var i=0;i<6;i++){d.s[i].recv='2026-0'+(i+1)+'-10';d.s[i].c={0:1,1:1}}d.s[6].c={0:1};d.s[6].start='2026-08-01';
  var r=run(k,d,k);show(k,r);assert.strictEqual(r.line,'استلمت 6 من 10 محطات، والحالية: اللياسة');assert.strictEqual(r.done,6);assert.strictEqual(r.of,10);assert.strictEqual(r.more,'تحققت من 13 من 50 بنداً');
  var d3=J(FRESH[k]);[0,1,2].forEach(function(i){d3.s[i].recv='2026-01-01'});var r3=run(k,d3,k);show(k,r3);assert.strictEqual(r3.line,'استلمت 3 من 10 محطات، والحالية: التمديدات الكهربائية');
  var d0=J(FRESH[k]);d0.s[0].c={2:1};var r0=run(k,d0,k);show(k,r0);assert.strictEqual(r0.line,'لم تستلم محطة بعد، والحالية: جاهزيتك قبل أول مقاول');
  var dA=J(FRESH[k]);dA.s.forEach(function(s){s.recv='2026-01-01'});assert.strictEqual(run(k,dA,k).line,'استلمت المحطات العشر كلها');
  var dX=J(FRESH[k]);dX.s[0].c={99:1,'x':1};assert.strictEqual(run(k,dX,k).empty,true,'مفاتيح c خارج النطاق لا تُحسب')});

T('offers جزئي',function(){var k='bb_tool_offers_v1';
  var d={v:1,sh:[{id:'s1',name:'بند العظم',o:{a:{con:'مؤسسة الريان 0550000000',price:'180000',inc:'هيكل كامل'},b:{con:'أبو فهد',price:'165000'},c:{con:'شركة البناء',price:'172000'}},win:'b',why:'الأوضح'}],active:'s1'};
  var r=run(k,d,k);show(k,r);assert.strictEqual(r.line,'قارنت 3 عروض في «بند العظم»');assert.strictEqual(r.more,'رسّيت على عرض ب · أبو فهد');
  d.sh.push({id:'s2',name:'البند ٢',o:{a:{price:'40000'},b:{con:'سعيد'},c:{}},win:'c',why:''});
  var r2=run(k,d,k);show(k,r2);assert.strictEqual(r2.line,'قارنت 5 عروض في بندين، وحسمت بنداً واحداً');assert.ok(!/[٠-٩]/.test(r2.line+r2.more));
  var d3=J(FRESH[k]);d3.sh[0].name='بند اللياسة';var r3=run(k,d3,k);show(k,r3);assert.strictEqual(r3.empty,false)});

T('agree جزئي',function(){var k='bb_tool_agree_v1',d=J(FRESH[k]);
  var a=d.ags[0];a.item='بند الكهرباء';a.con='خالد العلي';a.days='45';a.from='2026-11-01';
  var r=run(k,d,k);show(k,r);assert.strictEqual(r.line,'اتفاق «بند الكهرباء» مع خالد العلي: 45 يوماً من 01/11/2026');assert.strictEqual(r.more,null);
  var b=J(FRESH[k].ags[0]);b.id='g2';b.item='البند 2';b.con='أبو سالم';d.ags.push(b);
  var r2=run(k,d,k);show(k,r2);assert.strictEqual(r2.line,'كتبت اتفاقين، واحد منها بمقاول ومدة وتاريخ بدء');assert.strictEqual(r2.more,'آخر نهاية مدة: «بند الكهرباء» في 16/12/2026');
  var d1=J(FRESH[k]);d1.ags[0].con='سعيد';var r1=run(k,d1,k);show(k,r1);assert.strictEqual(r1.more,'لم تكتب بعد: تاريخ البدء، المدة');
  var dB=J(FRESH[k]);dB.ags[0].e3=true;assert.strictEqual(run(k,dB,k).empty,false,'تغيير مربع افتراضي يُعد إدخالاً')});

T('roughin جزئي',function(){var k='bb_tool_roughin_v1',R=ref(k),ids=[];R.sections.forEach(function(s){s.items.forEach(function(i){ids.push(i.id)})});
  var d=J(FRESH[k]);ids.slice(0,18).forEach(function(id,i){d.st[id]=i<3?'bad':(i===4?'chk2':'ok')});d.notes[ids[0]]='الحمام العلوي';d.st['ghost']='ok';
  var r=run(k,d,k);show(k,r);assert.strictEqual(r.line,'فحصت 18 من 51 بنداً، و3 بنود تحتاج تصحيحاً');assert.strictEqual(r.done,18);assert.strictEqual(r.of,ids.length);
  var d2=J(FRESH[k]);d2.date.supply='2026-09-01';var r2=run(k,d2,k);show(k,r2);assert.strictEqual(r2.empty,false);assert.strictEqual(r2.done,0)});

T('finishes جزئي',function(){var k='bb_tool_finishes_v1';
  var d={v:1,sel:{'majlis|floor':'porcelain','majlis|wall':'paint_washable','bath_floor|floor':'wood_parquet','kitchen_counter|counter':'quartz_counter','bad|x':'porcelain'},note:{}};
  var r=run(k,d,k);show(k,r);assert.strictEqual(r.line,'اخترت التشطيب في 4 من 22 سطحاً');assert.strictEqual(r.of,22);
  var d2={v:1,sel:{'majlis|floor':'porcelain','majlis|wall':'paint_washable'},note:{}};var r2=run(k,d2,k);show(k,r2)});

out.forEach(function(l){console.log(l)});
if(fails){console.log('\n'+fails+' FAILED');process.exit(1)}else console.log('\nALL PASSED');
