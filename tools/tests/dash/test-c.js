// اختبار المجموعة ج: node test_c.js
var fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
var window={SUM:{},SUM_REF:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../../assets/js/dash/sum-c.js'),'utf8'),{window:window});
var SUM=window.SUM,REF=window.SUM_REF;
var MAINT=JSON.parse(fs.readFileSync(''+path.join(__dirname,'../../../refs/guide/')+'maintenance.json','utf8'));
var TODAY='2026-10-08',fails=0,n=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.message)}}
function shape(r){assert.ok(r&&typeof r==='object');['line','done','of','empty','more'].forEach(function(k){assert.ok(k in r,'missing '+k)});
  assert.strictEqual(typeof r.empty,'boolean');
  if(!r.empty){assert.ok(r.line.length>0&&r.line.length<=75,'line length '+r.line.length)}
  var all=r.line+' '+(r.more||'');assert.ok(all.indexOf('…')<0,'ellipsis');assert.ok(all.indexOf('—')<0,'dash');
  ['دورة','كورس','منهج','واجب','مهام تفاعلية'].forEach(function(w){assert.ok(all.indexOf(w)<0,'banned '+w)});
  assert.ok(!/[٠-٩]/.test(all),'arabic digits')}
function show(k,r){console.log('      ['+k+'] line=«'+r.line+'» done='+r.done+' of='+r.of+' more='+(r.more?'«'+r.more+'»':null))}
var BAD=[null,undefined,{},{v:1},{v:2,rooms:[{}]},'x',42,[],{v:1,rooms:'x',notes:{},war:5,last:[],off:null,st:[],dl:'x',con:[null,1],floors:null,q:null}];
function robust(k,ref){BAD.forEach(function(b){var r=SUM[k](b,ref,TODAY);shape(r)})}

/* ===== الكميات ===== */
var K='bb_tool_qty_v1';
t(K+' fresh => empty',function(){var r=SUM[K]({v:1,H:'',fins:['بورسلان','رخام','باركيه'],floors:[{id:'a',name:'الدور الأرضي'}],rooms:[],q:{},bud:{total:'',it:{}},tab:'qty'});shape(r);assert.strictEqual(r.empty,true)});
t(K+' partial',function(){
  var d={v:1,H:'3',fins:['بورسلان','رخام'],floors:[{id:'g',name:'الدور الأرضي'},{id:'f',name:'الدور الأول'}],
    rooms:[{id:'1',floor:'g',name:'مجلس',type:'majlis',mode:'rect',L:'4',W:'5',h:'',ff:0,ceil:'paint',tH:'',dn:'',dw:'',dh:'',wn:'',ww:'',wh:''},
           {id:'2',floor:'f',name:'حمام',type:'bath',mode:'rect',L:'2',W:'2',h:'',ff:1,ceil:'gypsum',tH:'2.4',dn:'1',dw:'0.8',dh:'2.2',wn:'',ww:'',wh:''},
           {id:'3',floor:'f',name:'غرفة',type:'bed',mode:'rect',L:'4',W:'',ff:0,ceil:'paint'}],
    q:{'floor:بورسلان':{sp:'',w:'8',pr:'100'},'paintW':{sp:'',w:'0',pr:'20'}},tab:'qty'};
  var r=SUM[K](d);shape(r);show(K,r);
  // مجلس: أرضية 20 م² × 1.08 × 100 = 2160 ؛ دهان جدران: مجلس 54 + حمام (8×3 − 0.8×2.2 − تكسية (8×2.4 − 0.8×2.2)) = 54+4.8 = 58.8 × 20 = 1176
  assert.strictEqual(r.line,'أدخلت 3 فراغات في دورين، وتكلفة التشطيب المقدرة 3,336 ريال');
  assert.strictEqual(r.more,'فراغ واحد ناقص البيانات');assert.strictEqual(r.empty,false);
  var r2=SUM[K]({v:1,H:'',floors:[{id:'g'}],rooms:[{floor:'g',mode:'free',A:'30',P:'22'}]});shape(r2);show(K,r2);
  assert.strictEqual(r2.line,'أدخلت فراغاً واحداً في دور واحد');assert.strictEqual(r2.more,'مساحة الأرضيات 30 م²');
});
t(K+' broken',function(){robust(K)});

/* ===== ملف بيتك ===== */
K='bb_tool_handover_v1';
function blank(n){var a=[];for(var i=0;i<n;i++)a.push({});return a}
t(K+' fresh => empty',function(){var r=SUM[K]({v:1,st:{},notes:{},dl:{},card:{},con:blank(3),war:blank(3),mnt:blank(2),ph:{},sea:{}});shape(r);assert.strictEqual(r.empty,true)});
t(K+' partial',function(){
  var st={};for(var i=1;i<=12;i++)st[i]='ok';st[13]='bad';st[14]='bad';st[15]='chk2';st[99]='bad';
  var d={v:1,st:st,notes:{13:'شرخ في جدار المجلس'},dl:{13:'2026-10-20'},card:{},con:blank(3),war:[{item:'مكيف',end:'2027-01-01'},{},{}],mnt:blank(2),ph:{},sea:{}};
  var r=SUM[K](d);shape(r);show(K,r);
  assert.strictEqual(r.line,'فحصت 15 من 30 بنداً، وفيها نقطتان تعالج قبل التوقيع');
  assert.strictEqual(r.more,'نقطة واحدة من (✕) بلا مهلة إصلاح مكتوبة');assert.strictEqual(r.done,15);assert.strictEqual(r.of,30);
  var r2=SUM[K]({v:1,st:{},war:[{item:'سخان',end:'2027-02-01'},{item:'مضخة'}],con:[{}]});shape(r2);show(K,r2);
  assert.strictEqual(r2.line,'لم تبدأ قائمة فحص الاستلام بعد');assert.strictEqual(r2.more,'سجلت ضمانين في ملف البيت');
});
t(K+' broken',function(){robust(K)});

/* ===== دفتر السنة الأولى ===== */
K='bb_tool_firstyear_v1';
t(K+' fresh => empty',function(){var r=SUM[K]({v:1,notes:[],war:[{},{}],flt:'open'});shape(r);assert.strictEqual(r.empty,true)});
t(K+' partial',function(){
  var d={v:1,flt:'all',notes:[{id:'a',date:'2026-08-01',text:'تسريب بسيط تحت مغسلة الحمام العلوي بعد الاستحمام',cat:'now',fixed:'2026-08-05'},
    {id:'b',date:'2026-09-10',text:'شرخ شعري في لياسة الصالة فوق الباب',cat:'live',fixed:''},
    {id:'c',date:'2026-09-20',text:'صوت طقطقة في باب المطبخ مع الحر الشديد والرطوبة في الليل',cat:'season',fixed:''}],
    war:[{item:'العزل المائي',end:'2026-11-15'},{}]};
  var r=SUM[K](d,null,TODAY);shape(r);show(K,r);
  assert.strictEqual(r.line,'دوّنت 3 ملاحظات، عولج منها 1');assert.strictEqual(r.more,'ضمان يقترب من نهايته: العزل المائي');
  d.war=[{}];var r2=SUM[K](d,null,TODAY);show(K,r2);assert.strictEqual(r2.more,'آخر ملاحظة: صوت طقطقة في باب المطبخ مع الحر الشديد..');
  d.notes[1].cat='now';var r3=SUM[K](d,null,TODAY);show(K,r3);assert.strictEqual(r3.more,'1 من ملاحظات «الآن» لم تُعالج');
});
t(K+' broken',function(){robust(K)});

/* ===== تقويم الصيانة ===== */
K='bb_tool_maint_v1';
t(K+' ref declared',function(){assert.strictEqual(REF[K],'maintenance')});
t(K+' fresh => empty',function(){var r=SUM[K]({v:1,last:{},off:{},view:'all'},MAINT,TODAY);shape(r);assert.strictEqual(r.empty,true)});
var MD={v:1,view:'due',last:{'ac-filter':'2026-09-01','ac-service':'2025-09-01','water-ground-tank':'2026-07-01','elec-rcd':'2026-07-15'},off:{'garden-palm':true}};
t(K+' partial',function(){
  var r=SUM[K](MD,MAINT,TODAY);shape(r);show(K,r);
  assert.strictEqual(r.done,4);assert.strictEqual(r.of,MAINT.tasks.length-1);
  assert.strictEqual(r.line,'سجّلت آخر تنفيذ لـ4 من 33 عملاً');assert.strictEqual(r.more,'عملان متأخران');
  var r2=SUM[K]({v:1,last:{'elec-rcd':'2026-07-15'},off:{}},MAINT,TODAY);show(K,r2);assert.strictEqual(r2.more,'عمل واحد خلال أسبوعين');
  var r3=SUM[K](MD,null,TODAY);shape(r3);show(K+' no ref',r3);assert.strictEqual(r3.of,null);
});
t(K+' broken',function(){robust(K,MAINT);robust(K,null);robust(K,{tasks:'x'})});

/* ===== UPCOMING ===== */
t('UPCOMING',function(){
  var D={bb_tool_maint_v1:MD,
    bb_tool_firstyear_v1:{v:1,notes:[],war:[{item:'مكيف المجلس',end:'2026-12-01'},{item:'قديم',end:'2026-01-01'},{item:'طالبت',end:'2026-10-10',res:'تم'}]},
    bb_tool_handover_v1:{v:1,st:{3:'bad',4:'ok',5:'bad'},dl:{3:'2026-10-20',4:'2026-10-09',5:'2026-10-01'},notes:{3:'تسريب تحت المغسلة'},
      war:[{item:'مكيف المجلس',end:'2026-12-01'}],con:[{item:'العزل',name:'مؤسسة الواحة',until:'2027-03-01'}]},
    bb_tool_agree_v1:{v:1,ags:[{id:'a',item:'العظم',from:'2026-10-01',days:'90 يوماً'},{id:'b',from:'',days:'30'},null]}};
  var u=window.UPCOMING(D,{maintenance:MAINT},TODAY);console.log(JSON.stringify(u,null,1));
  assert.strictEqual(u.length,5);
  assert.strictEqual(JSON.stringify(u.map(function(e){return e.date})),JSON.stringify(['2026-10-08','2026-10-08','2026-10-15','2026-10-20','2026-12-01']));
  assert.ok(/^متأخر: /.test(u[0].title)&&u[0].href==='tools/maintenance/');
  assert.strictEqual(u[3].title,'تنتهي مهلة إصلاح في الاستلام: تسريب تحت المغسلة');assert.strictEqual(u[3].href,'tools/handover/');
  assert.strictEqual(u[4].title,'ينتهي اليوم ضمان: مكيف المجلس');assert.strictEqual(u[4].href,'tools/first-year/');
  var all=window.UPCOMING({bb_tool_handover_v1:D.bb_tool_handover_v1,bb_tool_agree_v1:D.bb_tool_agree_v1,bb_tool_firstyear_v1:D.bb_tool_firstyear_v1},{},TODAY);
  console.log(JSON.stringify(all));
  assert.strictEqual(JSON.stringify(all.map(function(e){return e.date})),JSON.stringify(['2026-10-20','2026-12-01','2026-12-30','2026-12-31','2027-03-01']));
  // تالف
  [null,{},{bb_tool_maint_v1:{last:'x'}},{bb_tool_agree_v1:{ags:{}}},{bb_tool_handover_v1:{dl:{1:'2026-11-01'},st:null,war:'x',con:[1,null]}}].forEach(function(b){assert.ok(Array.isArray(window.UPCOMING(b,null,TODAY)))});
  assert.ok(Array.isArray(window.UPCOMING(D,{maintenance:MAINT})));
});

console.log('\n'+(n-fails)+'/'+n+' passed');process.exit(fails?1:0);
