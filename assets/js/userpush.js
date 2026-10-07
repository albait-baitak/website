/* تنبيهات المستخدم على جهازه: يصله إشعار حين يصدر تقرير الفحص أو جدول الكميات، أو حين يُفعَّل حسابه.
   يعمل في متصفحات الحاسوب وأندرويد مباشرة، وفي الآيفون بعد إضافة الموقع إلى الشاشة الرئيسية وفتحه منها (iOS 16.4 فأحدث). */
(function(){
var BASE=(document.currentScript&&document.currentScript.src||'').replace(/assets\/js\/userpush\.js.*$/,'');
var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
var standalone=!!(navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches));
var supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function b64u(s){var p='='.repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
var regP=null;
function reg(){if(!regP)regP=navigator.serviceWorker.register(BASE+'sw.js',{scope:BASE}).then(function(){return navigator.serviceWorker.ready});return regP}
function save(sub){
  var j=sub.toJSON();if(!j.keys)return Promise.resolve();
  return window.BB.auth.getUser().then(function(r){var uid=r.data&&r.data.user&&r.data.user.id;if(!uid)throw new Error('ادخل بحسابك أولاً');
    return window.BB.from('push_subs').upsert({user_id:uid,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,ua:navigator.userAgent.slice(0,290)},{onConflict:'endpoint'})})
  .then(function(r){if(r&&r.error)throw r.error});
}
/* mount(عنصر، {what: نص ما يُنبَّه عليه}) */
function mount(box,opt){
  if(!box)return;opt=opt||{};
  var what=opt.what||'حين يصدر تقريرك أو جدول الكميات';
  box.classList.add('upush');
  function draw(){
    box.innerHTML='';
    var txt=el('div','upush-t'),act=el('div','upush-a'),m=el('p','msg');m.setAttribute('role','status');
    box.appendChild(txt);box.appendChild(act);box.appendChild(m);
    function say(t,c){m.className='msg'+(c?' '+c:'');m.textContent=t||''}
    if(ios&&!standalone){
      txt.appendChild(el('b',null,'نبّهني على الجوال '+what));
      txt.appendChild(el('span',null,'في الآيفون: افتح الموقع في سفاري، واضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»، وافتحه من الأيقونة وادخل بحسابك، ثم فعّل التنبيه من هنا.'));
      return;
    }
    if(!supported){txt.appendChild(el('b',null,'هذا المتصفح لا يدعم التنبيهات.'));txt.appendChild(el('span',null,'تابع حالة طلبك من هذه الصفحة، فهي تتحدث وحدها.'));return}
    if(Notification.permission==='denied'){txt.appendChild(el('b',null,'التنبيهات محجوبة لهذا الموقع.'));txt.appendChild(el('span',null,'اسمح بها من إعدادات الموقع في المتصفح ثم أعد تحميل الصفحة.'));return}
    reg().then(function(r){return r.pushManager.getSubscription()}).then(function(sub){
      if(sub){
        save(sub).catch(function(){});
        txt.appendChild(el('b',null,'التنبيه مفعّل على هذا الجهاز'));txt.appendChild(el('span',null,'يصلك إشعار '+what+'.'));
        var t=el('button','linkbtn','جرّبه');t.type='button';
        t.onclick=function(){say('جارٍ الإرسال..');window.BB.functions.invoke('push',{body:{op:'test'}}).then(function(r){say(r.data&&r.data.sent?'أُرسل إشعار تجريبي.':'تعذر الإرسال. أعد المحاولة.',r.data&&r.data.sent?'good':'bad')})};
        var o=el('button','linkbtn','أوقفه');o.type='button';
        o.onclick=function(){var ep=sub.endpoint;sub.unsubscribe().then(function(){return window.BB.from('push_subs').delete().eq('endpoint',ep)}).then(draw)};
        act.appendChild(t);act.appendChild(o);
      }else{
        txt.appendChild(el('b',null,'نبّهني على هذا الجهاز'));txt.appendChild(el('span',null,'يصلك إشعار '+what+'، ولو كانت الصفحة مغلقة.'));
        var b=el('button','btn sm','فعّل التنبيه');b.type='button';
        b.onclick=function(){
          b.disabled=true;say('جارٍ التفعيل..');
          Notification.requestPermission().then(function(p){
            if(p!=='granted'){throw new Error('لم يُسمح بالتنبيهات في المتصفح')}
            return window.BB.functions.invoke('push',{body:{op:'key'}});
          }).then(function(r){
            if(r.error||!r.data||!r.data.key)throw new Error('تعذر جلب مفتاح التنبيه');
            return reg().then(function(rg){return rg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(r.data.key)})});
          }).then(save).then(draw).catch(function(e){b.disabled=false;say('تعذر التفعيل: '+(e&&e.message||e),'bad')});
        };
        act.appendChild(b);
      }
    }).catch(function(){txt.innerHTML='';txt.appendChild(el('b',null,'تعذر تشغيل التنبيهات في هذا المتصفح.'))});
  }
  draw();
}
window.BBUserPush={mount:mount};
})();
