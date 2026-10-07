/* اختبار قارئ الأدوات، المجموعة أ: node test_a.js */
var vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert');
var win={SUM:{},SUM_REF:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../../assets/js/dash/sum-a.js'),'utf8'),{window:win});
var SUM=win.SUM,REFS=''+path.join(__dirname,'../../../refs/guide/')+'';
function ref(key){var n=win.SUM_REF[key];return n?JSON.parse(fs.readFileSync(REFS+n+'.json','utf8')):null}
var fails=0,shown=[];
function check(key,label,d,fn,useRef){
  var r;try{r=SUM[key](d,useRef===false?null:ref(key))}catch(e){fails++;console.log('THROW',key,label,e.message);return}
  try{
    assert(r&&typeof r==='object','no result');
    assert(typeof r.line==='string');assert(typeof r.empty==='boolean');
    assert(r.done===null||typeof r.done==='number');assert(r.of===null||typeof r.of==='number');
    assert(r.more===null||typeof r.more==='string');
    [r.line,r.more||''].forEach(function(t){
      assert(t.indexOf('…')<0,'ellipsis');assert(t.indexOf('—')<0&&t.indexOf('–')<0,'dash');
      assert(!/[٠-٩]/.test(t),'arabic digits');
      ['دورة','كورس','منهج','واجب','مهام تفاعلية'].forEach(function(w){assert(t.indexOf(w)<0,'banned '+w)});
    });
    assert(r.line.length<=75,'line too long: '+r.line.length);
    if(fn)fn(r);
    if(!r.empty)shown.push(key+' ['+label+']\n   line: '+r.line+'\n   more: '+r.more+'   done/of: '+r.done+'/'+r.of);
  }catch(e){fails++;console.log('FAIL',key,label,e.message,JSON.stringify(r))}
}
function empty(r){assert.strictEqual(r.empty,true)}
function full(r){assert.strictEqual(r.empty,false);assert(r.line)}
var JUNK=[null,undefined,{},[],'x',5,{v:1},{notes:null,cands:'x',st:5,lands:[null,3],it:[],devs:[null,{p:null}],rooms:[null,{type:'zzz',val:null}],a:null,sum:[null,5]}];
function junk(key){JUNK.forEach(function(j,i){check(key,'junk'+i,j,null)})}

/* ---------- first-session ---------- */
var K='bb_tool_first_session_v1';
function fsFresh(){return {v:1,cands:[{id:'a',name:'المرشح أ'},{id:'b',name:'المرشح ب'},{id:'c',name:'المرشح ج'}],active:'a',star:{},notes:{a:{},b:{},c:{}},flags:{a:{bad:{},good:{}},b:{bad:{},good:{}},c:{bad:{},good:{}}},scores:{a:{},b:{},c:{}},price:{a:'',b:'',c:''},onlyStar:false}}
check(K,'fresh',fsFresh(),empty);
var f=fsFresh();f.active='b';f.onlyStar=true;check(K,'auto fields only',f,empty);
f=fsFresh();f.cands[1].name='م. خالد العتيبي';for(var i=1;i<=14;i++)f.notes.b[i]='ملاحظة '+i;f.notes.a[1]='x';f.notes.a[2]='   ';
f.scores.a={0:4,1:3};f.scores.b={0:5,1:4,2:4,3:5,4:3,5:4,6:5};
check(K,'partial',f,function(r){full(r);assert.strictEqual(r.done,14);assert.strictEqual(r.of,20);assert(r.line.indexOf('م. خالد العتيبي')>0);assert(r.more.indexOf('2 من 3')>=0);assert(r.more.indexOf('30 من 35')>0)});
f=fsFresh();f.scores.c={0:3};check(K,'scores only',f,function(r){full(r);assert.strictEqual(r.done,0)});
f=fsFresh();f.star={3:true,7:true};check(K,'stars only',f,full);
f=fsFresh();f.notes={a:{1:'نعم'}};delete f.cands;check(K,'missing cands',f,function(r){full(r);assert.strictEqual(r.done,1)});
junk(K);

/* ---------- land ---------- */
K='bb_tool_land_v1';
function ldFresh(){var o={v:1,lands:[{id:'a',name:'الأرض أ'},{id:'b',name:'الأرض ب'},{id:'c',name:'الأرض ج'}],active:'a',st:{},notes:{},cost:{},dec:{}};['a','b','c'].forEach(function(k){o.st[k]={};o.notes[k]={};o.cost[k]={};o.dec[k]={}});return o}
check(K,'fresh',ldFresh(),empty);
var l=ldFresh();l.active='c';l.map={a:{pts:[],street:{}}};check(K,'auto fields only',l,empty);
l=ldFresh();l.lands[0].name='أرض حي النخيل';for(i=1;i<=12;i++)l.st.a[i]=i%5===0?'bad':i%4===0?'chk2':'ok';l.st.b={1:'ok',2:'ok'};l.st.a[99]='ok';l.st.a[3]='zzz';
l.cost.a={0:'٨٠٠٬٠٠٠',1:'25,000'};
check(K,'partial',l,function(r){full(r);assert.strictEqual(r.done,11);assert.strictEqual(r.of,21);assert(r.more.indexOf('مشكلات محتملة: 2')===0)});
l=ldFresh();l.cost.b={0:'650000',2:'15000'};check(K,'cost only',l,function(r){full(r);assert(r.line.indexOf('665,000')>0)});
l=ldFresh();l.st.a={1:'ok',2:'ok'};l.st.b={1:'ok'};check(K,'two lands',l,function(r){assert(r.more.indexOf('تقارن بين 2 من 3')===0)});
junk(K);

/* ---------- budget ---------- */
K='bb_tool_budget_v1';
check(K,'fresh (budget tool)',{v:1,total:'',area:'',it:{}},empty);
check(K,'fresh (quantities tool)',{v:1,total:'',area:'',it:{},act:{},note:{}},empty);
var b={v:1,total:'840000',area:'420',it:{0:'45,000',5:'180000',6:'120000',7:'40000',9:'35000',10:'20000',11:'60000',14:'90000',18:'30000',20:'50000',21:'40000',23:'20000'}};
check(K,'partial',b,function(r){full(r);assert.strictEqual(r.line,'ميزانيتك 840,000 ريال، قدّرت منها 12 من 25 بنداً');assert.strictEqual(r.done,12);assert.strictEqual(r.of,25);assert(r.more.indexOf('احتياطي')>0)});
b.it[24]='84,000';check(K,'with reserve',b,function(r){assert(r.more.indexOf('المتبقي')===0)});
b.act={0:'45000',5:'175000'};b.note={0:'شامل التخصصات'};check(K,'with actuals (quantities)',b,function(r){assert.strictEqual(r.more,'صرفت فعلياً 220,000 ريال حتى الآن')});
check(K,'over budget',{total:'500000',it:{1:'300000',2:'300000'}},function(r){assert(r.more.indexOf('تتجاوز')>0&&r.more.indexOf('100,000')>0)});
check(K,'total only',{total:'1٬200٬000'},function(r){assert.strictEqual(r.line,'ميزانيتك 1,200,000 ريال ولم تقدّر بنودها بعد')});
check(K,'items no total',{it:{3:'12000'}},function(r){assert.strictEqual(r.done,1)});
junk(K);

/* ---------- fifty ---------- */
K='bb_tool_fifty_v1';
function ffFresh(){var s=[];for(var i=0;i<10;i++)s.push({t:'',d:null});return {v:1,a:{},sum:s}}
check(K,'fresh',ffFresh(),empty);
var ff=ffFresh();for(i=1;i<=23;i++)ff.a[i]='جواب';ff.sum[0]={t:'غرفة نوم أرضية للوالدة',d:0};ff.sum[1]={t:'مجلس منفصل',d:0};ff.sum[2]={t:'مطبخ مغلق',d:1};ff.sum[3]={t:'حوش',d:null};
check(K,'partial',ff,function(r){full(r);assert.strictEqual(r.line,'أجبت عن 23 من 50 سؤالاً');assert.strictEqual(r.more,'خلاصتك: 4 من 10 أشياء، منها 2 لا يقبل التنازل')});
ff=ffFresh();ff.a={5:'x'};check(K,'one answer',ff,function(r){assert.strictEqual(r.done,1);assert(r.more.indexOf('لم تكتب')===0)});
ff=ffFresh();ff.sum[0].t='شيء';check(K,'summary only',ff,full);
junk(K);

/* ---------- room-sizes ---------- */
K='bb_tool_roomsizes_v1';
assert.strictEqual(win.SUM_REF[K],'rooms');
check(K,'fresh',{v:1,rooms:[]},empty);
var RR=ref(K),byId={};RR.rooms.forEach(function(r){byId[r.id]=r});
var PRESET=['majlis-men','living','dining','master','kids','kitchen','bath','entry','stair'];
var rs={v:1,rooms:PRESET.map(function(t,i){return {id:'r'+i,type:t,name:byId[t].name_ar,val:{}}})};
check(K,'preset no values',rs,function(r){full(r);assert.strictEqual(r.done,0);assert(r.of>0);assert(r.line.indexOf('9 غرف')>0)});
var tot=0;rs.rooms.forEach(function(r){tot+=byId[r.type].checks.length});
var mj=byId['majlis-men'].checks;rs.rooms[0].val[mj[0].id]='300';rs.rooms[0].val[mj[1].id]='100';rs.rooms[0].val[mj[2].id]='60';
var ratio=null;RR.rooms.forEach(function(t){t.checks.forEach(function(c){if(c.unit==='ratio'&&!ratio)ratio={t:t.id,c:c}})});
if(ratio){var ri=PRESET.indexOf(ratio.t);if(ri<0){rs.rooms.push({id:'rx',type:ratio.t,name:'x',val:{}});ri=rs.rooms.length-1;tot+=byId[ratio.t].checks.length}rs.rooms[ri].val[ratio.c.id]={d:'300',s:'65'}}
rs.rooms[1].val['nope']='5';rs.rooms.push({id:'bad',type:'unknown-type',val:{a:'1'}});
check(K,'partial',rs,function(r){full(r);assert.strictEqual(r.of,tot);assert.strictEqual(r.done,ratio?4:3);assert.strictEqual(r.more,ratio?'تحتاج مراجعة: 2، يمكن أفضل: 1':'تحتاج مراجعة: 1، يمكن أفضل: 1')});
check(K,'partial without ref',rs,function(r){full(r);assert.strictEqual(r.of,null)},false);
junk(K);

/* ---------- smart ---------- */
K='bb_tool_smart_v1';
function smFresh(){var d={id:'dabc1',name:'الجهاز 1',p:{},n:{},c:{}};return {v:1,devs:[d],active:d.id}}
check(K,'fresh',smFresh(),empty);
var sm=smFresh();sm.devs[0].name='قفل الباب الذكي';sm.devs[0].p={0:2,1:2,3:1};
check(K,'partial single',sm,function(r){full(r);assert.strictEqual(r.line,'أجبت عن 3 من 6 أسئلة عن «قفل الباب الذكي»');assert.strictEqual(r.done,3)});
sm.devs[0].p={0:2,1:2,2:2,3:1,4:2,5:2};sm.devs[0].c={0:'1200',1:'300'};
check(K,'complete single',sm,function(r){assert.strictEqual(r.line,'حكمك على «قفل الباب الذكي»: اشترِ (11 من 12)');assert.strictEqual(r.more,'تكلفته أول سنة 1,500 ريال')});
sm.devs.push({id:'d2',name:'ستائر ذكية',p:{0:1,1:0,2:0,3:1,4:1,5:0},n:{},c:{}});sm.devs.push({id:'d3',name:'الجهاز 3',p:{0:1},n:{},c:{}});
check(K,'multi',sm,function(r){assert.strictEqual(r.line,'اختبرت 3 أجهزة، واكتمل الحكم على 2 منها');assert(r.more.indexOf('ستائر ذكية: وفّر مالك')>0)});
sm=smFresh();sm.devs.push({id:'d2',name:'الجهاز 2',p:{},n:{},c:{}});check(K,'added device only',sm,full);
junk(K);

console.log(shown.join('\n'));
if(fails){console.log('\n'+fails+' FAILED');process.exit(1)}
console.log('\nALL PASSED');
