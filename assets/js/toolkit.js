/* أدوات مشتركة لأدوات رحلة بيت العمر: الحفظ في حساب المستخدم (مع نسخة في الجهاز)، وبناء العناصر، والأرقام العربية، والطباعة، وإعادة البدء */
(function(){
var AR='٠١٢٣٤٥٦٧٨٩';
function ar(n){return String(n)}
function toEn(s){return String(s==null?'':s).replace(/[٠-٩]/g,function(d){return AR.indexOf(d)}).replace(/[,٬\s]/g,'').replace(/٫/g,'.').replace(/[^\d.\-]/g,'')}
function num(s){var v=parseFloat(toEn(s));return isFinite(v)?v:0}
function fmt(n,dec){if(n==null||!isFinite(n))return '';var d=dec==null?2:dec;var s=(Math.round(n*Math.pow(10,d))/Math.pow(10,d)).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:0});return s}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function $(id){return document.getElementById(id)}
function store(key,fresh,version){
  var S=null;try{S=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
  if(!S||S.v!==version)S=fresh();
  var t=null,fl=null,dirty=false;
  function write(){clearTimeout(t);if(!dirty)return;dirty=false;try{localStorage.setItem(key,JSON.stringify(S));push(key);flash('حُفظ في حسابك')}catch(e){flash('تعذر الحفظ. أعد المحاولة.')}}
  window.addEventListener('pagehide',write);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')write()});
  function flash(msg){var s=$('saved');if(!s)return;s.textContent=msg;clearTimeout(fl);fl=setTimeout(function(){s.textContent=''},1800)}
  return {
    get:function(){return S},
    set:function(v){S=v},
    save:function(){dirty=true;clearTimeout(t);t=setTimeout(write,250)},
    clear:function(){S=fresh();dirty=false;clearTimeout(t);try{localStorage.removeItem(key)}catch(e){};push(key);return S},
    flash:flash
  };
}
/* ===== الحساب: لا تبدأ الأداة إلا بعد الدخول، وبياناتها تُحفظ في حساب المستخدم =====
   النسخة المحلية في المتصفح ذاكرة مؤقتة فقط؛ المرجع ما في الحساب.
   bb_meta: {owner: معرّف صاحب النسخة المحلية, t: {المفتاح: وقت آخر تعديل}, d: {المفتاح: لم يُرفع بعد}} */
var META='bb_meta',KRX=/^bb_tool_[a-z0-9_]{1,40}$/,uid=null,timers={};
function meta(){var m=null;try{m=JSON.parse(localStorage.getItem(META)||'null')}catch(e){}m=m||{};m.t=m.t||{};m.d=m.d||{};return m}
function setMeta(m){try{localStorage.setItem(META,JSON.stringify(m))}catch(e){}}
function toolKeys(){var a=[];try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(KRX.test(k))a.push(k)}}catch(e){}return a}
function wipeLocal(){toolKeys().forEach(function(k){try{localStorage.removeItem(k)}catch(e){}});try{localStorage.removeItem(META)}catch(e){}}
function db(){return window.BB}
/* يُستدعى بعد كل حفظ أو مسح محلي: يعلّم المفتاح ويرفعه بعد لحظة */
function push(key){
  if(!uid||!KRX.test(key))return;
  var m=meta();m.t[key]=Date.now();m.d[key]=1;setMeta(m);
  clearTimeout(timers[key]);
  if(document.visibilityState==='hidden')send(key);else timers[key]=setTimeout(function(){send(key)},700);
}
function send(key){
  var raw=null;try{raw=localStorage.getItem(key)}catch(e){}
  var ts=meta().t[key]||Date.now(),q;
  if(raw==null)q=db().from('tool_data').delete().eq('user_id',uid).eq('key',key);
  else{var data;try{data=JSON.parse(raw)}catch(e){return}
    q=db().from('tool_data').upsert({user_id:uid,key:key,data:data,updated_at:new Date(ts).toISOString()})}
  return q.then(function(r){if(r.error)return;var m=meta();if(m.t[key]===ts){delete m.d[key];setMeta(m)}});
}
function flushAll(){var m=meta();Object.keys(m.d).forEach(function(k){clearTimeout(timers[k]);send(k)})}
/* مزامنة عند الفتح: ما في الحساب يُنزَّل، وما عُدّل هنا ولم يُرفع (أو بيانات قديمة قبل الحسابات) يُرفع */
function sync(){
  return db().from('tool_data').select('key,data,updated_at').then(function(r){
    if(r.error)throw r.error;
    var m=meta();
    if(m.owner&&m.owner!==uid){wipeLocal();m=meta()}
    var legacy=!m.owner;m.owner=uid;
    var srv={},ups=[];(r.data||[]).forEach(function(row){srv[row.key]=row});
    Object.keys(srv).forEach(function(k){
      var row=srv[k],st=Date.parse(row.updated_at)||0;
      if(m.d[k]&&(m.t[k]||0)>st){ups.push(k);return}
      try{localStorage.setItem(k,JSON.stringify(row.data))}catch(e){}
      m.t[k]=st;delete m.d[k];
    });
    toolKeys().forEach(function(k){
      if(srv[k])return;
      if(legacy||m.d[k]){m.t[k]=m.t[k]||Date.now();m.d[k]=1;ups.push(k)}
      else{try{localStorage.removeItem(k)}catch(e){}delete m.t[k]}
    });
    Object.keys(m.d).forEach(function(k){if(ups.indexOf(k)<0&&!srv[k]){try{if(localStorage.getItem(k)==null)delete m.d[k]}catch(e){}}});
    setMeta(m);ups.forEach(send);
  });
}
function base(){var s=document.querySelector('script[src*="assets/js/toolkit.js"]');return s?s.src.replace(/assets\/js\/toolkit\.js.*$/,''):'/'}
function gate(kind){
  var wrap=document.querySelector('.tool-main .wrap'),how=wrap&&wrap.querySelector('details.howto');if(!wrap)return;
  var g=wrap.querySelector('.tk-gate');if(g)g.remove();
  g=el('section','tk-gate');
  var nx=encodeURIComponent(location.pathname),B=base();
  if(kind==='load'){g.appendChild(el('p','tk-gate-load','جارٍ تحميل بياناتك..'))}
  else if(kind==='err'){
    g.appendChild(el('h2',null,'تعذر الاتصال'));
    g.appendChild(el('p',null,'لم نتمكن من تحميل بياناتك من حسابك. تأكد من الاتصال ثم أعد المحاولة.'));
    var rb=el('button','btn','أعد المحاولة');rb.type='button';rb.addEventListener('click',function(){location.reload()});
    var rw=el('div','row');rw.appendChild(rb);g.appendChild(rw);
  }else{
    g.appendChild(el('h2',null,'ابدأ بحسابك'));
    g.appendChild(el('p',null,'سجّل ببريدك لتبدأ استخدام الأداة. يُحفظ عملك في حسابك، فتكمله متى شئت ومن أي جهاز. والتسجيل مجاني ولا يحتاج انتظاراً.'));
    var row=el('div','row'),a=el('a','btn','إنشاء حساب'),b=el('a','btn line','عندي حساب');
    a.href=B+'account/?new&next='+nx;b.href=B+'account/?next='+nx;row.appendChild(a);row.appendChild(b);g.appendChild(row);
    if(how)how.open=true;
  }
  if(how)how.after(g);else wrap.appendChild(g);
  wrap.classList.add('gated');var mn=wrap.closest('.tool-main');if(mn)mn.classList.add('gated');
}
function ungate(){var wrap=document.querySelector('.tool-main .wrap');if(!wrap)return;var g=wrap.querySelector('.tk-gate');if(g)g.remove();wrap.classList.remove('gated');var mn=wrap.closest('.tool-main');if(mn)mn.classList.remove('gated')}
/* تشغيل الأداة: بعد الدخول والمزامنة فقط */
function ready(fn){
  gate('load');
  var started=false;
  function go(){if(started)return;started=true;ungate();fn()}
  if(!db()){gate('sign');return}
  db().auth.getSession().then(function(r){
    var s=r.data&&r.data.session;
    if(!s){gate('sign');return}
    uid=s.user.id;
    sync().then(go,function(){if(meta().owner===uid)go();else gate('err')});
  },function(){gate('err')});
  db().auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT'){uid=null;wipeLocal();location.reload()}});
  window.addEventListener('pagehide',function(){if(uid)flushAll()});
  window.addEventListener('online',function(){if(uid)flushAll()});
}
function resetButton(btn,onReset,armedLabel){
  var armed=false,t=null,label=btn.textContent;
  btn.addEventListener('click',function(){
    if(!armed){armed=true;btn.textContent=armedLabel||'اضغط مرة ثانية لمسح كل شيء';clearTimeout(t);t=setTimeout(function(){armed=false;btn.textContent=label},4000);return}
    armed=false;btn.textContent=label;onReset();
  });
}
function grow(ta){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight+2,360)+'px'}
function rename(current,cb){
  var d=$('dlg'),inp=$('dlgIn');
  if(!d||typeof d.showModal!=='function'){var v=window.prompt('الاسم',current);if(v&&v.trim())cb(v.trim().slice(0,40));return}
  inp.value=current;d.returnValue='';d.showModal();inp.select();
  d.onclose=function(){if(d.returnValue==='ok'&&inp.value.trim())cb(inp.value.trim().slice(0,40))};
}
function csv(rows,name){
  var s='﻿'+rows.map(function(r){return r.map(function(c){c=c==null?'':String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}
window.TK={ready:ready,push:push,wipeLocal:wipeLocal,ar:ar,num:num,toEn:toEn,fmt:fmt,el:el,$:$,store:store,resetButton:resetButton,grow:grow,rename:rename,csv:csv};
})();
