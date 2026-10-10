/* اختبار محرك جداول الكميات على فيلا نموذجية بقيم محسوبة يدوياً */
const fs=require('fs'),path=require('path');
const R=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'../../../refs/boq',p),'utf8'));
const E=require('../../../assets/js/boq-engine.js');
const ref=R('ref_residential.json'),pk=R('packages_residential.json');
let ok=0,fail=0;const eq=(n,a,b)=>{if(Math.abs(a-b)<1e-6){ok++}else{fail++;console.log('FAIL',n,a,'!=',b)}};
// غرفة نوم 4×5، باب واحد، نافذة 2 م²، الارتفاع 3
const one=E.compute(ref,pk,{grade:'mid',rooms:[{type:'bedroom',name:'نوم 1',L:4,W:5,nd:1,wa:2}]});
const q=c=>{const l=one.lines.find(x=>x.code===c);return l?l.qty:0};
eq('floor',q('09 30 16-02'),20);
eq('skirting PS=18-0.9',q('09 30 16-04'),17.1);
eq('plaster WALL=54-(1.89+2)',q('09 24 00-01'),50.11);
eq('paint WALL+A',q('09 91 23-02'),70.11);
eq('gypsum mid',q('09 29 00-02'),20);
eq('sockets ceil(17.1/3.6)=5',q('26 05 00-02'),5);
eq('devices 5+1',q('26 27 26-02'),6);
eq('lights ceil(20/4)=5',q('26 05 00-01'),5);
eq('ac 1',q('23 81 26-02'),1);
eq('smoke',q('28 31 00-01'),1);
// الاقتصادي: لا جبس في غرفة النوم
const eco=E.compute(ref,pk,{grade:'eco',rooms:[{type:'bedroom',L:4,W:5,nd:1,wa:2}]});
eq('no gypsum eco',eco.lines.filter(x=>x.item==='09 29 00').length,0);
// حمام 2×2.5 اقتصادي: البلاط إلى 1.83
const b=E.compute(ref,pk,{grade:'eco',rooms:[{type:'bath',L:2,W:2.5,nd:1,wa:0.5}]});
const qb=c=>{const l=b.lines.find(x=>x.code===c);return l?l.qty:0};
eq('wall tile 9*1.83-(1.89+0.5)',qb('09 30 13-01'),Math.round((9*1.83-2.39)*100)/100);
eq('wc',qb('22 41 00-01'),1);eq('shower',qb('22 41 00-10'),1);eq('heater',qb('22 33 00-01'),1);
eq('waterproof 5+9*0.3+2.4*1.83',qb('07 14 16-01'),Math.round((5+2.7+4.392)*100)/100);
// الفاخر: البلاط إلى السقف
const bl=E.compute(ref,pk,{grade:'lux',rooms:[{type:'bath',L:2,W:2.5,nd:1,wa:0.5}]});
eq('lux tile to ceiling',bl.lines.find(x=>x.code==='09 30 13-03').qty,Math.round((27-2.39)*100)/100);
// مطبخ بسطح 5 م.ط: مقابس السطح ceil(5/1.2)=5 ومقابس الجدار
const k=E.compute(ref,pk,{grade:'mid',rooms:[{type:'kitchen',L:4,W:4,nd:1,wa:1.5,lc:5}]});
const qk=c=>{const l=k.lines.find(x=>x.code===c);return l?l.qty:0};
eq('kitchen sockets 5+ceil((15.1-5)/3.6)=8',qk('26 05 00-02'),8);
eq('cabinets',qk('12 35 30-02'),5);eq('co alarm',qk('28 31 00-02'),1);
// تجميع غرفتين وترتيب الشعب
const two=E.compute(ref,pk,{grade:'mid',rooms:[{type:'bedroom',L:4,W:5,nd:1,wa:2},{type:'bedroom',L:4,W:4,nd:1,wa:2}]});
eq('aggregate floor',two.lines.find(x=>x.code==='09 30 16-02').qty,36);
eq('rooms breakdown',two.lines.find(x=>x.code==='09 30 16-02').rooms.length,2);
eq('divs sorted',two.groups.map(g=>g.div).join()===two.groups.map(g=>g.div).sort().join()?1:0,1);
eq('no errors',two.errors.length,0);
// معادلة غير مسموحة تُرفض
let threw=0;try{E.evaluate('process.exit()',{})}catch(e){threw=1}eq('reject unsafe',threw,1);
// فيلا كاملة بلا أخطاء
const villa={grade:'mid',rooms:[{type:'majlis',L:6,W:5,nd:2,wa:4},{type:'living',L:7,W:6,nd:2,wa:5},{type:'dining',L:4,W:4,nd:1,wa:2},{type:'kitchen',L:4.5,W:4,nd:2,wa:1.5,lc:6},
 {type:'wc',L:1.6,W:1.8,nd:1,wa:0.3},{type:'master',L:5,W:5,nd:2,wa:3},{type:'bath',L:2.5,W:3,nd:1,wa:0.5},{type:'bedroom',L:4,W:4.5,nd:1,wa:2},{type:'bedroom',L:4,W:4,nd:1,wa:2},
 {type:'bath',L:2,W:2.4,nd:1,wa:0.5},{type:'hall',L:8,W:1.6,nd:0,wa:0},{type:'stairs',L:4,W:2.5,nd:0,sl:20,rl:8},{type:'laundry',L:2,W:2,nd:1,wa:0.5},{type:'maid',L:3,W:3,nd:1,wa:1},
 {type:'roof',L:15,W:12,nd:0},{type:'yard',L:20,W:6,nd:0,pa:60,ga:40}]};
const V=E.compute(ref,pk,villa);
eq('villa no errors',V.errors.length,0);
console.log('villa lines',V.totals.lines,'priced',V.totals.priced,'divisions',V.groups.length);
console.log(ok+'/'+(ok+fail)+' passed');process.exit(fail?1:0);
