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
  var t=null,dirty=false;
  if(used.indexOf(key)<0)used.push(key);
  function write(){clearTimeout(t);if(!dirty)return;dirty=false;try{localStorage.setItem(key,JSON.stringify(S));if(push(key))flash(MSG.local)}catch(e){flash('تعذر الحفظ. أعد المحاولة.')}}
  window.addEventListener('pagehide',write);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')write()});
  var o={
    get:function(){return S},
    set:function(v){S=v},
    save:function(){dirty=true;clearTimeout(t);t=setTimeout(write,250)},
    clear:function(){S=fresh();dirty=false;clearTimeout(t);try{localStorage.removeItem(key)}catch(e){};push(key);return S},
    flash:flash,
    isDirty:function(){return dirty},
    write:function(){write()}
  };
  stores.push(o);
  return o;
}
/* ===== حالة الحفظ: لا يُقال «في حسابك» إلا بعد أن يقبله الخادم ===== */
var MSG={local:'حُفظ على هذا الجهاز..',acct:'حُفظ في حسابك',fail:'لم يُرفع آخر تعديل إلى حسابك بعد. سيُرفع تلقائياً حين يعود الاتصال.',other:'حُدّثت بياناتك من جهاز آخر.'};
var used=[],stores=[],failing=false,flT=null,retryT=null;
function statusEl(){var s=$('saved');if(s&&s.dataset.tkOrig==null)s.dataset.tkOrig=s.textContent;return s}
function rest(){var s=statusEl();if(!s)return;s.classList.toggle('tk-fail',failing);s.textContent=failing?MSG.fail:s.dataset.tkOrig}
function flash(msg,ms){var s=statusEl();if(!s)return;clearTimeout(flT);s.classList.remove('tk-fail');s.textContent=msg;flT=setTimeout(rest,ms||1800)}
function setFail(on){
  if(failing===on)return;failing=on;clearTimeout(retryT);
  if(on)retryT=setTimeout(function retry(){if(uid&&failing){flushAll();retryT=setTimeout(retry,30000)}},30000);
  clearTimeout(flT);rest();
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
/* يُستدعى بعد كل حفظ أو مسح محلي: يعلّم المفتاح ويرفعه بعد لحظة. يعيد true إن كان سيُرفع */
function push(key){
  if(!uid||!KRX.test(key))return false;
  if(window.BBStat)BBStat.tool(key);
  var m=meta();m.t[key]=Date.now();m.d[key]=1;setMeta(m);
  clearTimeout(timers[key]);
  if(document.visibilityState==='hidden')send(key);else timers[key]=setTimeout(function(){send(key)},700);
  return true;
}
function pendingKeys(){return Object.keys(meta().d)}
/* يرفع مفتاحاً واحداً؛ يعيد Promise تتحقق دائماً (true عند النجاح) */
function send(key){
  if(!uid||!db())return Promise.resolve(false);
  var raw=null;try{raw=localStorage.getItem(key)}catch(e){}
  var ts=meta().t[key]||Date.now(),q;
  if(raw==null)q=db().from('tool_data').delete().eq('user_id',uid).eq('key',key);
  else{var data;try{data=JSON.parse(raw)}catch(e){return Promise.resolve(false)}
    q=db().from('tool_data').upsert({user_id:uid,key:key,data:data,updated_at:new Date(ts).toISOString()})}
  return Promise.resolve(q).then(function(r){
    if(r&&r.error)throw r.error;
    var m=meta();if(m.t[key]===ts){delete m.d[key];setMeta(m)}
    if(!Object.keys(m.d).length){setFail(false);hideBanner()}
    flash(MSG.acct);return true;
  }).catch(function(){setFail(true);return false});
}
function flushAll(){var m=meta();return Promise.all(Object.keys(m.d).map(function(k){clearTimeout(timers[k]);return send(k)}))}
/* يرفع كل ما لم يُرفع، ثم يعيد قائمة المفاتيح الباقية (فارغة إن رُفع كل شيء). لا ينتظر أكثر من ثماني ثوانٍ */
function flush(){
  stores.forEach(function(o){if(o.isDirty())o.write()});
  var w=new Promise(function(res){setTimeout(res,8000)});
  var f=uid?flushAll():Promise.resolve();
  return Promise.race([f,w]).then(function(){return pendingKeys()},function(){return pendingKeys()});
}
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
/* شريط العمل دون اتصال: يبقى حتى يُرفع كل شيء أو تنجح مزامنة */
function showBanner(){
  var wrap=document.querySelector('.tool-main .wrap');if(!wrap||wrap.querySelector('.tk-banner'))return;
  var b=el('p','tk-banner','تعمل الآن على النسخة المحفوظة في هذا الجهاز. ستُرفع تعديلاتك إلى حسابك حين يعود الاتصال.');b.setAttribute('role','status');
  var c=wrap.querySelector('.crumbs');if(c)c.after(b);else wrap.prepend(b);
}
function hideBanner(){var b=document.querySelector('.tk-banner');if(b)b.remove()}
/* تعدد الأجهزة: عند العودة إلى الصفحة تُراجع بيانات هذه الأداة في الحساب، ولا يُمس ما لم يُرفع من هنا */
var lastSync=0,resyncing=false;
function resync(){
  if(!uid||!db()||resyncing||!used.length||Date.now()-lastSync<30000)return;
  if(stores.some(function(o){return o.isDirty()}))return;
  resyncing=true;lastSync=Date.now();
  Promise.resolve(db().from('tool_data').select('key,data,updated_at').in('key',used)).then(function(r){
    if(r.error)throw r.error;
    var m=meta();if(m.owner!==uid)return;
    var srv={},changed=false;(r.data||[]).forEach(function(row){srv[row.key]=row});
    used.forEach(function(k){
      if(m.d[k])return;
      var row=srv[k];
      if(row){var st=Date.parse(row.updated_at)||0;
        if(st>(m.t[k]||0)){try{localStorage.setItem(k,JSON.stringify(row.data))}catch(e){return}m.t[k]=st;changed=true}}
      else{var has=null;try{has=localStorage.getItem(k)}catch(e){}
        if(has!=null&&m.t[k]){try{localStorage.removeItem(k)}catch(e){}delete m.t[k];changed=true}}
    });
    setMeta(m);
    if(!pendingKeys().length){setFail(false);hideBanner()}
    if(changed){try{sessionStorage.setItem('bb_tk_other','1')}catch(e){}location.reload()}
  }).catch(function(){}).then(function(){resyncing=false});
}
/* تشغيل الأداة: بعد الدخول والمزامنة فقط */
function ready(fn){
  gate('load');
  var started=false;
  function go(){if(started)return;started=true;ungate();fn();
    var o=null;try{o=sessionStorage.getItem('bb_tk_other');sessionStorage.removeItem('bb_tk_other')}catch(e){}
    if(o)flash(MSG.other,4000);
    if(pendingKeys().length&&!navigator.onLine)setFail(true);
  }
  if(!db()){gate('sign');return}
  db().auth.getSession().then(function(r){
    var s=r.data&&r.data.session;
    if(!s){gate('sign');return}
    uid=s.user.id;
    sync().then(function(){lastSync=Date.now();go()},function(){if(meta().owner===uid){go();showBanner()}else gate('err')});
  },function(){gate('err')});
  db().auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT'){uid=null;wipeLocal();location.reload()}});
  window.addEventListener('pagehide',function(){if(uid)flushAll()});
  window.addEventListener('online',function(){if(!uid)return;flushAll();if(document.querySelector('.tk-banner')){lastSync=0;resync()}});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState!=='visible'||!uid)return;if(pendingKeys().length)flushAll();resync()});
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
/* أدوات المرحلة نفسها أسفل كل أداة. العناوين والمراحل كما في بطاقات الصفحة الرئيسية */
var STAGES={
  decision:{t:'القرار',tools:[['first-session','أسئلة الجلسة الأولى مع مصممك'],['land','دليل اختيار الأرض'],['budget','حاسبة البنود والتكاليف']]},
  design:{t:'التصميم',tools:[['fifty','خمسون سؤالاً قبل أن تصمم بيتك'],['room-sizes','أبعاد الغرف المريحة'],['smart','اختبار القرار الذكي'],['points','مخطط نقاط الكهرباء والسباكة']]},
  build:{t:'التنفيذ',tools:[['roadmap','خارطة بنود تنفيذ بيتك'],['offers','جدول مقارنة عروض المقاولين'],['agreement','نموذج اتفاق البند الواحد'],['rough-in','فحص التأسيس قبل الإغلاق'],['finishes','جدول مواد التشطيب'],['quantities','جداول الكميات والتكاليف']]},
  living:{t:'السكن',tools:[['handover','ملف بيتك: الاستلام والسجلات'],['first-year','دفتر السنة الأولى'],['maintenance','تقويم الصيانة الدورية']]}
};
function stageStrip(){
  var mt=location.pathname.match(/\/tools\/([a-z0-9-]+)\/?/);if(!mt)return;
  var slug=mt[1],id=null;
  Object.keys(STAGES).forEach(function(k){STAGES[k].tools.forEach(function(x){if(x[0]===slug)id=k})});
  var ft=document.querySelector('body>footer');if(!id||!ft||document.querySelector('.tk-strip'))return;
  var st=STAGES[id],B=base();
  var nv=el('nav','tk-strip');nv.setAttribute('aria-label','أدوات هذه المرحلة');
  var w=el('div','wrap'),hd=el('div','tk-strip-h');
  hd.appendChild(el('h2',null,'أدوات هذه المرحلة'));
  var all=el('a',null,'مرحلة '+st.t);all.href=B+'#'+id;hd.appendChild(all);w.appendChild(hd);
  var ul=el('ul','tk-strip-l');
  st.tools.forEach(function(x){if(x[0]===slug)return;var li=el('li'),a=el('a',null,x[1]);a.href=B+'tools/'+x[0]+'/';li.appendChild(a);ul.appendChild(li)});
  w.appendChild(ul);nv.appendChild(w);ft.before(nv);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',stageStrip);else stageStrip();
/* ترويسة الطباعة: الشعار واسم الموقع أعلى كل ورقة تُطبع من الأدوات */
function printBrand(){
  var m=document.querySelector('.tool-main>.wrap');if(!m||document.querySelector('.pbrand'))return;
  var d=el('div','pbrand'),i=document.createElement('img');
  i.src=base()+'assets/img/brand/logo-horizontal.svg';i.alt='البيت بيتك';d.appendChild(i);
  var u=el('span',null,'albait-baitak.com');u.dir='ltr';d.appendChild(u);m.prepend(d);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',printBrand);else printBrand();
window.TK={ready:ready,push:push,flush:flush,pending:pendingKeys,STAGES:STAGES,wipeLocal:wipeLocal,ar:ar,num:num,toEn:toEn,fmt:fmt,el:el,$:$,store:store,resetButton:resetButton,grow:grow,rename:rename,csv:csv};
})();
