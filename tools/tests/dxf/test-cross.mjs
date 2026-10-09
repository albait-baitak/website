// اختبار المطابقة بين ملف الرسم والـPDF: node --experimental-strip-types tools/tests/dxf/test-cross.mjs
import fs from 'fs';import path from 'path';import vm from 'vm';import {fileURLToPath} from 'url';
import {crossCheck,consText} from '../../../supabase/functions/analyze/consist.ts';
const D=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.join(D,'../../../');
const win={};const ctx={window:win,self:win,TextDecoder,console,Map,Uint8Array,Float64Array};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT+'assets/vendor/dxf-parser-1.1.2.js','utf8'),ctx);if(!win.DxfParser&&ctx.DxfParser)win.DxfParser=ctx.DxfParser;
vm.runInContext(fs.readFileSync(ROOT+'assets/js/dxf.js','utf8'),ctx);
const b=fs.readFileSync(path.join(D,'samples/villa.dxf'));const x=win.BBDXF.extractText(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'villa.dxf');
const pdf={name:'villa.pdf',text:'مسقط الدور الأرضي ... الواجهة الشمالية ...',sheets:[
 {page:1,raster:false,type:'plan',tags:{D1:2,D2:1,W1:2,W5:1},levels:[]},
 {page:2,raster:false,type:'elevation',tags:{W4:1},levels:['±0.00','+3.65','+7.20']}]};
const r=crossCheck(x,pdf);console.log(consText(r));
let f=0;const has=(s,rx)=>r.some(c=>c.state===s&&rx.test(c.what));const ok=(c,m)=>{if(!c){f++;console.log('FAIL',m)}};
ok(has('conflict',/W2 في مساقط/),'W2 ناقص في الـPDF');ok(has('check',/W5 في villa\.pdf/),'W5 زائد في الـPDF');
ok(has('check',/\+3\.60.*\+3\.65/),'منسوب مختلف');ok(has('check',/قطاع أ-أ/),'عنوان القطاع غائب');
ok(crossCheck(x,{name:'s.pdf',sheets:[{raster:true}]})[0].state==='unchecked','PDF ممسوح');
ok(Array.isArray(crossCheck(null,null)),'بيانات فارغة بلا خطأ');
console.log(f?f+' FAILED':'ALL PASSED');process.exit(f?1:0);
