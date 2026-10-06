/* أدوات الدليل (نقاط الكهرباء والسباكة، أبعاد الغرف، فحص التأسيس، مواد التشطيب، الصيانة الدورية):
   تحميل ملف البيانات الموثق من refs/guide، وترقيم المصادر، وإظهار مرجع كل بند. */
(function(){
var el=TK.el;
var BASE=(document.querySelector('script[src*="assets/js/guide.js"]')||{}).src||'';BASE=BASE.replace(/assets\/js\/guide\.js.*$/,'');
var VER=(BASE&&document.querySelector('script[src*="assets/js/guide.js"]').src.split('?v=')[1])||'';
function load(name){
  return fetch(BASE+'refs/guide/'+name+'.json'+(VER?'?v='+VER:''),{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(d){
    d._ix={};(d.sources||[]).forEach(function(s,i){d._ix[s.id]=i+1});return d});
}
/* مراجع البند: أرقام صغيرة تقود إلى قائمة المصادر أسفل الصفحة */
function refs(d,ids){
  var s=el('span','gd-refs');(ids||[]).forEach(function(id){var n=d._ix[id];if(!n)return;var a=el('a',null,String(n));a.href='#src-'+n;a.title=(d.sources[n-1].title||'');s.appendChild(a)});
  return s.childNodes.length?s:null;
}
/* يُوسم ما لم يُوجد له نص ملزم صريح، حتى لا يُقرأ تقدير كأنه كود */
function tag(o){
  if(!o)return null;
  if(o.basis==='practice')return el('span','gd-tag','ممارسة شائعة');
  if(o.confidence==='low')return el('span','gd-tag','تقدير، تحقق منه');
  return null;
}
function line(d,o,text,cls){
  var p=el(cls||'p','gd-line');p.appendChild(document.createTextNode(text));
  var t=tag(o);if(t){p.appendChild(document.createTextNode(' '));p.appendChild(t)}
  var r=refs(d,o&&o.source_ids);if(r)p.appendChild(r);
  return p;
}
function sources(d,host){
  var det=el('details','gd-src');det.id='sources';
  var sm=el('summary');sm.appendChild(el('span',null,'المصادر'));sm.appendChild(el('small',null,String((d.sources||[]).length)+' مرجعاً'));det.appendChild(sm);
  var ol=el('ol');
  (d.sources||[]).forEach(function(s,i){var li=el('li');li.id='src-'+(i+1);
    var t=s.url?el('a',null,s.title):el('span',null,s.title);if(s.url){t.href=s.url;t.rel='noopener';t.target='_blank'}
    li.appendChild(t);var meta=[s.publisher,s.edition,s.clause].filter(Boolean).join(' · ');if(meta)li.appendChild(el('small',null,meta));ol.appendChild(li)});
  det.appendChild(ol);
  det.appendChild(el('p','gd-src-note','البنود الموسومة «ممارسة شائعة» أو «تقدير» لم نجد لها نصاً ملزماً صريحاً، فراجعها مع مصممك أو المختص قبل اعتمادها.'));
  host.appendChild(det);
  /* فتح القائمة عند الضغط على رقم مرجع */
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('.gd-refs a');if(a)det.open=true});
}
function fail(host){host.innerHTML='';host.appendChild(el('p','warn','تعذر تحميل بيانات الأداة. تأكد من الاتصال ثم أعد تحميل الصفحة.'))}
function uid(){return 'r'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)}
/* الطباعة تُظهر الشروح المطوية */
window.addEventListener('beforeprint',function(){document.querySelectorAll('.tool-main details').forEach(function(d){d.open=true})});
function json(path){return fetch(BASE+path+(VER?'?v='+VER:''),{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})}
/* العدد مع معدوده: واحد، مثنى، من 3 إلى 10، وما فوقها */
function n(k,f){k=+k;return k===1?f[0]:k===2?f[1]:(k>=3&&k<=10)?k+' '+f[2]:k+' '+f[3]}
window.GD={n:n,json:json,load:load,refs:refs,tag:tag,line:line,sources:sources,fail:fail,uid:uid};
})();
