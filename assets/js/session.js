/* رأس الموقع الموحد: حالة الدخول أعلى الصفحة في كل الصفحات، وقائمة الحساب، وقائمة الجوال */
(function(){
var BASE=(document.currentScript&&document.currentScript.src||'').replace(/assets\/js\/session\.js.*$/,'');
var ROLE={admin:'مدير النظام',office:'مكتب هندسي',contractor:'مقاول',owner:'صاحب بيت'};
/* طريقة الاستخدام: مفتوحة على الشاشات الواسعة، مطوية على الجوال حتى تظهر الأداة من أول نظرة */
try{if(window.matchMedia&&matchMedia('(min-width:900px)').matches)document.querySelectorAll('details.howto').forEach(function(d){d.open=true})}catch(e){}
var KEY='sb-mafsmebubzvbyahmwyym-auth-token';
var head=document.querySelector('header.top .wrap');if(!head)return;

function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}

/* خانة الحساب */
var slot=head.querySelector('[data-auth]');
if(!slot){slot=el('div','auth');slot.setAttribute('data-auth','');head.appendChild(slot)}

/* زر قائمة الجوال */
var nav=head.querySelector('nav');
if(nav){
  var tg=el('button','navtoggle');tg.type='button';tg.setAttribute('aria-label','القائمة');tg.setAttribute('aria-expanded','false');
  tg.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  head.appendChild(tg);
  tg.addEventListener('click',function(){var o=head.parentNode.classList.toggle('open');tg.setAttribute('aria-expanded',String(o))});
  nav.addEventListener('click',function(e){if(e.target.closest('a')){head.parentNode.classList.remove('open');tg.setAttribute('aria-expanded','false')}});
}

function loginBtn(){slot.innerHTML='';var a=el('a','btn sm','الدخول');a.href=BASE+'account/';slot.appendChild(a)}

var open=false,btn,menu;
function closeMenu(){if(!menu)return;open=false;menu.hidden=true;btn.setAttribute('aria-expanded','false')}
document.addEventListener('click',function(e){if(open&&!slot.contains(e.target))closeMenu()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&open){closeMenu();btn.focus()}});

function chip(email,p){
  p=p||{};slot.innerHTML='';
  var name=p.full_name||p.office_name||email||'حسابي';
  btn=el('button','acct-btn');btn.type='button';btn.setAttribute('aria-haspopup','menu');btn.setAttribute('aria-expanded','false');
  btn.appendChild(el('span','acct-av',(name.trim()[0]||'؟').toUpperCase()));
  btn.appendChild(el('span','acct-nm',name));
  var car=el('span','acct-car');car.innerHTML='<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';btn.appendChild(car);
  menu=el('div','acct-menu');menu.setAttribute('role','menu');menu.hidden=true;
  var hd=el('div','acct-hd');hd.appendChild(el('b',null,name));var em=el('span','acct-em',email||'');em.dir='ltr';hd.appendChild(em);
  var approved=p.status==='approved'&&p.role;
  hd.appendChild(el('span','acct-role'+(approved?'':' wait'),approved?ROLE[p.role]:(p.status==='pending'?'قيد المراجعة':p.status==='suspended'?'موقوف':p.status==='rejected'?'غير معتمد':'')));
  menu.appendChild(hd);
  function item(label,href){var a=el('a','acct-it',label);a.href=BASE+href;a.setAttribute('role','menuitem');menu.appendChild(a)}
  item(approved?'أدواتك':'حالة الحساب','account/');
  if(approved&&(p.role==='office'||p.role==='admin'))item('بوابة الفحص الفني','fahs/app.html');
  if(approved&&p.role==='admin')item('لوحة الإدارة','admin/');
  var out=el('button','acct-it acct-out','تسجيل الخروج');out.type='button';out.setAttribute('role','menuitem');
  out.addEventListener('click',function(){window.BB.auth.signOut().then(function(){
    /* بيانات الأدوات تبقى في الحساب، وتُمسح نسختها من هذا الجهاز عند الخروج */
    try{for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(/^bb_tool_|^bb_meta$|^bb_handoff_/.test(k))localStorage.removeItem(k)}}catch(e){}
    location.href=BASE})});
  menu.appendChild(out);
  btn.addEventListener('click',function(e){e.stopPropagation();open=!open;menu.hidden=!open;btn.setAttribute('aria-expanded',String(open))});
  slot.appendChild(btn);slot.appendChild(menu);
}

/* عرض فوري من الجلسة المحفوظة لتجنب الوميض، ثم يُحدَّث بالبيانات */
var cached=null;try{var raw=localStorage.getItem(KEY);if(raw){var j=JSON.parse(raw);cached=j&&j.user&&j.user.email}}catch(e){}
var pc=null;try{pc=JSON.parse(sessionStorage.getItem('bb_prof')||'null')}catch(e){}
if(cached)chip(cached,pc&&pc.email===cached?pc:null);else loginBtn();

if(!window.BB)return;
function refresh(s){
  var u=s&&s.user;
  if(!u){try{sessionStorage.removeItem('bb_prof')}catch(e){}loginBtn();return}
  window.BB.from('profiles').select('full_name,office_name,role,status,email').eq('id',u.id).maybeSingle().then(function(r){
    var p=r.data||{};p.email=u.email;try{sessionStorage.setItem('bb_prof',JSON.stringify(p))}catch(e){}
    chip(u.email,p);
  });
}
window.BB.auth.onAuthStateChange(function(ev,s){
  if(ev==='INITIAL_SESSION'||ev==='SIGNED_IN'||ev==='SIGNED_OUT'||ev==='USER_UPDATED')setTimeout(function(){refresh(s)},0);
});
window.BBSession={refresh:function(){window.BB.auth.getSession().then(function(r){refresh(r.data&&r.data.session)})}};
})();
