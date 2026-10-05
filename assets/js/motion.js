/* حركة قليلة قصيرة ذات معنى: ظهور الأقسام، عدّاد الأرقام، مشهد بطاقة التقرير،
   تقدم القراءة والقسم النشط، ورسم خط الخطوات. تتعطل كلها مع تقليل الحركة. */
(function(){
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduce||!('IntersectionObserver' in window))return;
var root=document.documentElement;root.classList.add('mo');
function once(els,fn,th){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);fn(e.target)}})},{threshold:th||0.15,rootMargin:'0px 0px -8% 0px'});els.forEach(function(el){io.observe(el)})}

/* ١. ظهور الأقسام: كل قسم يدخل مرة واحدة، وعناصره تتتابع بفارق 70ms */
var groups=[];
document.querySelectorAll('main section').forEach(function(sec){
  var items=sec.querySelectorAll('.sh, .matrix-wrap, .steps, .cols>.list, .who, .cta-band, #report, .muted');
  if(items.length)groups.push(items);
});
var loose=document.querySelectorAll('[data-rv]');if(loose.length)groups.push(loose);
groups.forEach(function(items){
  items.forEach(function(el,i){el.classList.add('rv');el.style.setProperty('--d',Math.min(i,6)*70+'ms')});
  once(Array.prototype.slice.call(items),function(el){el.classList.add('in')});
});

/* ٢. عدّاد الأرقام: نحو ثانية، مرة واحدة */
var nums=document.querySelectorAll('.facts b');
nums.forEach(function(b){var t=parseInt(b.textContent,10);if(isNaN(t))return;b.dataset.to=t;b.textContent='0'});
once(Array.prototype.slice.call(nums),function(b){
  var to=+b.dataset.to,t0=null;
  function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/1000),e=1-Math.pow(1-p,3);b.textContent=Math.round(to*e);if(p<1)requestAnimationFrame(step)}
  requestAnimationFrame(step);
},0.6);

/* ٣. بطاقة التقرير: الصفوف صفاً صفاً، ثم العلامات، ثم الحكم آخر الكل */
var doc=document.querySelector('.hero .doc');
if(doc){
  var rows=doc.querySelectorAll('.rows tbody tr'),n=rows.length;
  rows.forEach(function(tr,i){tr.style.setProperty('--d',(250+i*120)+'ms')});
  doc.querySelectorAll('.rows td.got').forEach(function(td){
    var t=td.textContent,m=t.match(/[✓✗]\s*$/);if(!m)return;
    td.textContent=t.slice(0,m.index);var s=document.createElement('span');s.className='mk';s.textContent=m[0];td.appendChild(s);
    s.style.setProperty('--d',(250+n*120+150)+'ms');
  });
  var on=doc.querySelector('.verdict .on');
  if(on){var d=(250+n*120+550)+'ms';on.style.setProperty('--d',d);var i=on.querySelector('i');if(i)i.style.setProperty('--d',d)}
  doc.classList.add('pre');
  once([doc],function(){requestAnimationFrame(function(){doc.classList.remove('pre')})},0.3);
}

/* ٤. شريط تقدم القراءة وتظليل القسم النشط في الشريط العلوي */
var top=document.querySelector('header.top'),bar=null;
var links=Array.prototype.slice.call(document.querySelectorAll('.top nav a[href^="#"]'));
var secs=links.map(function(a){return document.querySelector(a.getAttribute('href'))}).filter(Boolean);
if(top&&secs.length){bar=document.createElement('div');bar.className='readbar';top.appendChild(bar)}
/* ٥. خط الخطوات يُرسم مع التمرير */
var steps=[];
document.querySelectorAll('.steps').forEach(function(ol){
  var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),ln=document.createElementNS(ns,'line');
  svg.setAttribute('class','draw');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  ln.setAttribute('x1','100%');ln.setAttribute('x2','0');ln.setAttribute('y1','1');ln.setAttribute('y2','1');
  svg.appendChild(ln);ol.appendChild(svg);steps.push({ol:ol,ln:ln});
});
var ticking=false;
function frame(){
  ticking=false;var vh=innerHeight;
  if(bar){var h=document.documentElement.scrollHeight-vh;bar.style.transform='scaleX('+(h>0?Math.min(1,scrollY/h):0)+')'}
  if(secs.length){var cur=null;secs.forEach(function(s,i){if(s.getBoundingClientRect().top<vh*0.35)cur=i});links.forEach(function(a,i){a.classList.toggle('cur',i===cur)})}
  steps.forEach(function(o){
    var r=o.ol.getBoundingClientRect(),w=r.width,p=Math.max(0,Math.min(1,(vh*0.9-r.top)/(vh*0.5)));
    o.ln.style.strokeDasharray=w;o.ln.style.strokeDashoffset=w*(1-p);
  });
}
function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(frame)}}
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);frame();
})();
