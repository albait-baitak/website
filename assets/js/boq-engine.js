/* محرك جداول الكميات السكنية: يحوّل قائمة الغرف بأبعادها إلى جدول كميات مرتب بالشعب
   من المرجع السكني (ref_residential.json) وحزم الغرف (packages_residential.json).
   كل سطر يحمل أساس كميته: geometry من الأبعاد، code من نص كود له مصدر، design افتراض تصميمي معلن */
(function(root){
'use strict';
var FN={ceil:Math.ceil,floor:Math.floor,max:Math.max,min:Math.min,sqrt:Math.sqrt,round:Math.round,abs:Math.abs};
var CACHE={};
/* تقييم معادلة الكمية: أرقام ومتغيرات معروفة ودوال رياضية فقط، وأي رمز آخر يُرفض */
function evaluate(expr,vars){
  var src=String(expr);
  if(!/^[0-9A-Za-z_+\-*\/().,?:<>=! ]*$/.test(src))throw new Error('رمز غير مسموح في المعادلة: '+src);
  var ids=src.match(/[A-Za-z_][A-Za-z0-9_]*/g)||[];
  ids.forEach(function(id){if(!(id in vars)&&!(id in FN))throw new Error('متغير غير معروف: '+id)});
  var f=CACHE[src];
  if(!f){f=CACHE[src]=new Function('V','F','with(F){with(V){return ('+src+');}}')}
  var v=f(vars,FN);
  if(typeof v!=='number'||!isFinite(v))throw new Error('ناتج غير صالح للمعادلة: '+src);
  return v;
}
function index(ref){
  if(ref.__ix)return ref.__ix;
  var items={},variants={},divs={};
  (ref.divisions||[]).forEach(function(d){divs[d.code]=d});
  ref.items.forEach(function(it){items[it.code]=it;it.variants.forEach(function(v){variants[v.code]={v:v,item:it}})});
  Object.defineProperty(ref,'__ix',{value:{items:items,variants:variants,divs:divs},enumerable:false});
  return ref.__ix;
}
function paramVal(p,grade,vars){
  var v=p.v;
  if(v&&typeof v==='object')v=v[grade];
  return v==null?null:v;
}
var r2=function(x){return Math.round(x*100)/100};
function roomVars(pk,room,grade,over){
  var V={};
  Object.keys(pk.inputs).forEach(function(k){var x=room[k];V[k]=x==null||x===''?(k==='nd'?1:0):Number(x)||0});
  Object.keys(pk.params).forEach(function(k){
    var v=over&&over[k]!=null?over[k]:paramVal(pk.params[k],grade,V);
    V[k]=v});
  if(V.TH==null)V.TH=V.H;            /* بلاط الحمام حتى السقف حين لا يحدد الكود حداً للدرجة */
  ['A','P','O','WALL','PS'].forEach(function(k){V[k]=evaluate(pk.derived[k],V)});
  return V;
}
/* project: {grade:'eco|mid|lux', params:{}, rooms:[{type,name,L,W,nd,wa,lc,sl,rl,pa,ga,grade}]} */
function compute(ref,pk,project){
  var ix=index(ref),types={},acc={},errors=[];
  pk.rooms.forEach(function(r){types[r.type]=r});
  (project.rooms||[]).forEach(function(room,ri){
    var t=types[room.type];if(!t){errors.push('نوع غرفة غير معروف: '+room.type);return}
    var g=room.grade||project.grade||'mid',name=room.name||t.ar+' '+(ri+1);
    var V;try{V=roomVars(pk,room,g,project.params)}catch(e){errors.push(name+': '+e.message);return}
    t.lines.forEach(function(l){
      if(l.when&&l.when.indexOf(g)<0)return;
      var code=typeof l.v==='string'?l.v:l.v[g];
      var q;try{q=evaluate(l.q,V)}catch(e){errors.push(name+': '+e.message);return}
      if(!(q>0))return;
      var hit=ix.variants[code];if(!hit){errors.push('خيار غير موجود في المرجع: '+code);return}
      var a=acc[code]||(acc[code]={code:code,item:hit.item.code,div:hit.item.div,item_ar:hit.item.ar,ar:hit.v.ar,grade:hit.v.grade,unit:hit.v.unit,spec:hit.v.spec,price:hit.v.price||null,qty:0,basis:{},sources:[],rooms:[]});
      a.qty+=q;a.basis[l.basis]=1;a.rooms.push({name:name,qty:r2(q),basis:l.basis,note:l.note||''});
      if(l.source&&!a.sources.some(function(s){return s.url===l.source.url}))a.sources.push(l.source);
    });
  });
  var lines=Object.keys(acc).map(function(k){var a=acc[k];a.qty=a.unit==='عدد'||a.unit==='نقطة'||a.unit==='طقم'?Math.ceil(a.qty-1e-9):r2(a.qty);
    a.basis=Object.keys(a.basis);
    if(a.price){a.low=r2(a.qty*a.price.low);a.high=r2(a.qty*a.price.high)}return a})
    .sort(function(x,y){return x.code<y.code?-1:x.code>y.code?1:0});
  var groups=[],gi={};
  lines.forEach(function(l){var d=gi[l.div];if(!d){d=gi[l.div]={div:l.div,ar:(ix.divs[l.div]||{}).ar||l.div,lines:[],low:0,high:0,priced:0};groups.push(d)}
    d.lines.push(l);if(l.price){d.low+=l.low;d.high+=l.high;d.priced++}});
  groups.sort(function(a,b){return a.div<b.div?-1:1});
  var T={lines:lines.length,priced:0,low:0,high:0};
  groups.forEach(function(d){d.low=r2(d.low);d.high=r2(d.high);T.low+=d.low;T.high+=d.high;T.priced+=d.priced});
  T.low=r2(T.low);T.high=r2(T.high);
  return {groups:groups,lines:lines,totals:T,errors:errors};
}
var api={compute:compute,evaluate:evaluate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BBQ=api;
})(typeof window!=='undefined'?window:this);
