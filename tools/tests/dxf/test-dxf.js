/* اختبار قارئ DXF على عينات بحقيقة معروفة: node tools/tests/dxf/test-dxf.js [--print] */
var fs=require('fs'),path=require('path'),vm=require('vm');
var ROOT=path.join(__dirname,'../../../');
var win={};var ctx={window:win,self:win,TextDecoder:TextDecoder,console:console,Map:Map,Uint8Array:Uint8Array,Float64Array:Float64Array};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT+'assets/vendor/dxf-parser-1.1.2.js','utf8'),ctx);
if(!win.DxfParser&&ctx.DxfParser)win.DxfParser=ctx.DxfParser;
vm.runInContext(fs.readFileSync(ROOT+'assets/js/dxf.js','utf8'),ctx);
function load(n){var b=fs.readFileSync(path.join(__dirname,'samples',n));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}
var fails=0,pass=0;function ok(c,m){if(c)pass++;else{fails++;console.log('FAIL:',m)}}
var x=win.BBDXF.extractText(load('villa.dxf'),'villa.dxf');
if(process.argv.indexOf('--print')>0)console.log(x.text);
ok(x.units.name==='سم'&&!x.units.guessed,'الوحدة سم من رأس الملف');
var types=x.sheetTypes.map(function(t){return t.type});
ok(types.indexOf('plan')>=0&&types.indexOf('elevation')>=0&&types.indexOf('section')>=0,'أنواع اللوحات: '+JSON.stringify(types));
ok(x.blocks.door===3,'الأبواب 3: '+x.blocks.door);ok(x.blocks.doorGuess===1,'باب واحد من قوسه: '+x.blocks.doorGuess);ok(x.blocks.window===3,'النوافذ 3: '+x.blocks.window);
var majlis=x.rooms.filter(function(r){return r.names.indexOf('مجلس')>=0})[0],sala=x.rooms.filter(function(r){return r.names.indexOf('صالة')>=0})[0];
ok(majlis&&Math.abs(majlis.area-78.88)<0.01,'المجلس 78.88: '+(majlis&&majlis.area));
ok(sala&&sala.src==='hatch'&&Math.abs(sala.area-88.74)<0.01,'الصالة من التهشير 88.74: '+(sala&&sala.area+' '+sala.src));
var th=(x.walls&&x.walls.byThk||[]).map(function(b){return b.t});
ok(th.indexOf(0.2)>=0&&th.indexOf(0.15)>=0,'سماكات الجدران 0.20 و0.15: '+JSON.stringify(x.walls&&x.walls.byThk));
ok(x.tags.plan.D1===2&&x.tags.plan.D2===1&&x.tags.plan.W1===2&&x.tags.plan.W2===1,'رموز المساقط: '+JSON.stringify(x.tags.plan));
ok(x.tags.sched.W3===1&&!x.tags.plan.W3,'جدول الفتحات فيه W3: '+JSON.stringify(x.tags.sched));
function has(state,rx){return x.checks.some(function(c){return c.state===state&&rx.test(c.what)})}
ok(has('conflict',/«14\.80».*15 م/),'تعارض البعد 14.80');
ok(!has('conflict',/«7\.00»/),'البعد 7.00 مطابق');
ok(has('check',/\+3\.50.*\+3\.60/),'تعارض المنسوب بين القطاع والواجهة');
ok(has('check',/W3 في جدول الفتحات/),'W3 في الجدول لا يظهر في المساقط');
ok(has('check',/W4 في الواجهات/),'W4 في الواجهة لا يظهر في المساقط');
ok(has('ok',/كتل الأبواب/),'كتل الأبواب تساوي رموزها');
ok(has('ok',/كتل النوافذ/),'كتل النوافذ تساوي رموزها');
ok(!/…|—/.test(x.text),'لا «…» ولا شرطة طويلة');
/* العينة 2: ملم، طبقات وكتل بأسماء عربية، بلا جدول ولا قطاعات */
var y=win.BBDXF.extractText(load('mm-arabic.dxf'),'mm-arabic.dxf');
if(process.argv.indexOf('--print')>0)console.log(y.text);
ok(y.units.name==='ملم','الوحدة ملم');
ok(y.blocks.door===4&&y.blocks.doorGuess===0,'أربعة أبواب باسم «باب»: '+y.blocks.door);
var th2=(y.walls&&y.walls.byThk||[]).map(function(b){return b.t});ok(th2.indexOf(0.2)>=0&&th2.indexOf(0.1)>=0,'سماكات 0.20 و0.10 بالملم: '+JSON.stringify(y.walls&&y.walls.byThk));
ok(y.sheetTypes.some(function(t){return t.type==='plan'&&/الأول/.test(t.title)}),'المسقط معروف: '+JSON.stringify(y.sheetTypes));
ok(y.checks.some(function(c){return c.state==='unchecked'&&/المناسيب/.test(c.what)}),'المناسيب لم تُفحص لغياب القطاع والواجهة');
ok(y.checks.some(function(c){return c.state==='ok'&&/بقيمتها المحسوبة/.test(c.what)}),'الأبعاد كلها محسوبة');
console.log(fails?fails+' FAILED, '+pass+' passed':'ALL PASSED ('+pass+')');process.exit(fails?1:0);
