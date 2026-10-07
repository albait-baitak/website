/* إحصاءات الموقع الداخلية: تُسجَّل في قاعدة الموقع نفسها لا عند طرف خارجي.
   لا كوكيز ولا عنوان IP؛ الزائر يُعرف بمعرّف عشوائي في متصفحه، وإن دخل بحسابه رُبطت زياراته به.
   الأحداث: pv فتح صفحة، end مدة البقاء عند المغادرة، tool حفظ في أداة، signup تسجيل، login دخول، contact ضغط زر التواصل. */
(function(){
var C=window.BB_CONFIG;if(!C||!window.fetch)return;
if(navigator.webdriver||/bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent||''))return;
var KEY='sb-mafsmebubzvbyahmwyym-auth-token',END=C.url+'/rest/v1/events';
function rid(){var a='';try{var b=new Uint8Array(12);crypto.getRandomValues(b);for(var i=0;i<b.length;i++)a+=('0'+b[i].toString(16)).slice(-2)}catch(e){a=(Math.random().toString(16)+Math.random().toString(16)).replace(/0\./g,'').slice(0,24)}return a}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function ss(k,v){try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v)}catch(e){return null}}

/* الزائر: معرّف ثابت في المتصفح. الزيارة: تنتهي بعد 30 دقيقة بلا نشاط */
var vid=ls('bb_vid');if(!vid||vid.length<8){vid=rid();ls('bb_vid',vid)}
var now=Date.now(),sid=ss('bb_sid'),last=+(ss('bb_sid_t')||0);
if(!sid||now-last>30*60e3){sid=rid();ss('bb_sid',sid);ss('bb_src','')}
ss('bb_sid_t',String(now));

/* المصدر: وسوم الرابط أولاً (utm)، ثم الموقع الذي جاء منه، ويُحفظ لبقية الزيارة */
var q=new URLSearchParams(location.search),src=q.get('utm_source')||q.get('src'),med=q.get('utm_medium'),camp=q.get('utm_campaign');
var ref='';try{if(document.referrer){var r=new URL(document.referrer);if(r.host!==location.host)ref=r.host.replace(/^www\./,'')}}catch(e){}
var saved=null;try{saved=JSON.parse(ss('bb_src')||'null')}catch(e){}
if(src||ref){saved={src:src||null,med:med||null,camp:camp||null,ref:ref||null};ss('bb_src',JSON.stringify(saved))}
saved=saved||{};

function path(){var p=location.pathname.replace(/^\/website(?=\/)/,'').replace(/index\.html$/,'');return p||'/'}
function dev(){var w=Math.min(screen.width||innerWidth,screen.height||innerHeight),t=/iPad|Tablet/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&w>=600);return t&&w>=600?'tablet':w<600?'mobile':'desktop'}
function tz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||null}catch(e){return null}}
/* الحساب: من جلسة Supabase المحفوظة، وإن انتهت صلاحيتها يُرسل الحدث مجهولاً */
function auth(){try{var s=JSON.parse(ls(KEY)||'null');if(s&&s.access_token&&s.user&&(!s.expires_at||s.expires_at*1000>Date.now()+5e3))return {t:s.access_token,u:s.user.id}}catch(e){}return null}
function title(){var h=document.querySelector('main h1')||document.querySelector('h1');var t=(h&&h.textContent||document.title||'').replace(/\s+/g,' ').trim();return t.slice(0,200)}

var pid=rid(),t0=Date.now(),hidden=0,hs=null,ended=false;
function send(row){
  var a=auth();row.vid=vid;row.sid=sid;row.pid=pid;row.path=path();row.uid=a?a.u:null;
  try{fetch(END,{method:'POST',keepalive:true,headers:{'apikey':C.anonKey,'Authorization':'Bearer '+(a?a.t:C.anonKey),'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(row)}).catch(function(){})}catch(e){}
}
function pv(){send({kind:'pv',title:title(),ref:saved.ref||null,src:saved.src||null,med:saved.med||null,camp:saved.camp||null,dev:dev(),lang:(navigator.language||'').slice(0,20),tz:tz(),sw:Math.round(innerWidth)||null})}
/* مدة البقاء الفعلية: يُطرح منها وقت التبويب في الخلفية، وكل عودة للتبويب تُرسل مدتها الجديدة على نفس الصفحة فتُجمع */
function end(){if(ended)return;ended=true;var d=Date.now()-t0-hidden-(hs?Date.now()-hs:0);send({kind:'end',dur:Math.max(0,Math.min(86400,Math.round(d/1000)))})}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'){hs=Date.now();end()}
  else{if(hs){hidden+=Date.now()-hs;hs=null}if(ended){ended=false;t0=Date.now();hidden=0}}
});
addEventListener('pagehide',end);

var once={};
window.BBStat={
  /* حفظ في أداة: مرة لكل أداة في كل فتح للصفحة */
  tool:function(key){if(once[key])return;once[key]=1;send({kind:'tool',title:title(),meta:{key:String(key).slice(0,60)}})},
  signup:function(role){send({kind:'signup',meta:{role:String(role||'').slice(0,20)}})},
  login:function(){send({kind:'login'})},
  /* ضغط زر التواصل: يُحسب في الإحصائيات ويصل المدير إشعار به */
  contact:function(where){send({kind:'contact',title:title(),meta:{where:String(where||'').slice(0,30)}})}
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pv);else pv();
})();
