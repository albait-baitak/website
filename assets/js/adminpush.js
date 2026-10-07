/* إشعارات الجوال للمدير: تفعيلها على الجهاز، وأنواع الأحداث التي تُرسل، وإشعار تجريبي.
   في الآيفون تعمل فقط بعد إضافة لوحة الإدارة إلى الشاشة الرئيسية وفتحها من هناك (iOS 16.4 فأحدث). */
(function(){
var box=document.getElementById('pushBox');if(!box)return;
var BASE='../',TYPES=[
  ['signup','تسجيل حساب جديد','كل تسجيل، ومعه نوعه، وهل ينتظر اعتمادك'],
  ['tool','استخدام أداة','أول مرة يعبّئ فيها شخص في أداة كل يوم'],
  ['request','طلب فحص فني أو جدول كميات','كل طلب يرسله مكتب أو مصمم'],
  ['job','انتهاء الفحص الآلي أو جدول الكميات','نجاحه أو تعذره، ويفتح الطلب نفسه للمراجعة'],
  ['feedback','تغذية راجعة على تقرير','تقييم، أو اعتراض على بند، أو تغيير رأي سابق'],
  ['visit','زائر جديد','أول زيارة لكل متصفح جديد، وتزيد مع الزحمة']
];
function $(id){return document.getElementById(id)}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function msg(t,c){var m=$('pMsg2');m.className='msg'+(c?' '+c:'');m.textContent=t||''}
var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
var standalone=!!(navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches));
var supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
var reg=null,uid=null,cfg={};

function b64u(s){var p='='.repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}

function state(){
  var st=$('pState'),act=$('pAct');act.innerHTML='';st.innerHTML='';
  if(ios&&!standalone){
    st.appendChild(el('b',null,'أضف لوحة الإدارة إلى الشاشة الرئيسية أولاً'));
    var ol=el('ol','push-steps');
    ['افتح هذه الصفحة في سفاري.','اضغط زر المشاركة أسفل الشاشة، ثم «إضافة إلى الشاشة الرئيسية».','افتح «البيت بيتك» من الشاشة الرئيسية، وادخل بحسابك من جديد (التطبيق المضاف لا يشارك سفاري دخوله).','ارجع إلى هذا القسم واضغط «فعّل الإشعارات على هذا الجهاز».'].forEach(function(t){ol.appendChild(el('li',null,t))});
    st.appendChild(ol);return;
  }
  if(!supported){st.appendChild(el('b',null,'هذا المتصفح لا يدعم إشعارات الويب.'));st.appendChild(el('small',null,'في الآيفون يلزم iOS 16.4 فأحدث، وفتح اللوحة من الشاشة الرئيسية.'));return}
  if(Notification.permission==='denied'){st.appendChild(el('b',null,'الإشعارات محجوبة لهذا الموقع على هذا الجهاز.'));st.appendChild(el('small',null,ios?'افتح الإعدادات ← الإشعارات ← البيت بيتك، وفعّل السماح بالإشعارات.':'فعّلها من إعدادات الموقع في المتصفح.'));return}
  return (reg?reg.pushManager.getSubscription():Promise.resolve(null)).then(function(sub){
    if(sub){
      st.appendChild(el('b','ok','مفعّلة على هذا الجهاز'));
      var t=el('button','btn sm','أرسل إشعاراً تجريبياً');t.type='button';t.onclick=test;act.appendChild(t);
      var o=el('button','btn sm line','أوقفها على هذا الجهاز');o.type='button';o.onclick=function(){off(sub)};act.appendChild(o);
      /* تأكد أن الاشتراك محفوظ في الحساب (قد يُفقد إن مُسح من الخادم) */
      save(sub);
    }else{
      st.appendChild(el('b',null,'غير مفعّلة على هذا الجهاز'));
      var b=el('button','btn sm','فعّل الإشعارات على هذا الجهاز');b.type='button';b.onclick=on;act.appendChild(b);
    }
    return window.BB.from('push_subs').select('id',{count:'exact',head:true}).then(function(r){if(r.count!=null)$('pDevs').textContent=r.count?('الأجهزة المفعّلة: '+r.count):''});
  });
}
function save(sub){
  var j=sub.toJSON();if(!j.keys)return Promise.resolve();
  return window.BB.from('push_subs').upsert({user_id:uid,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,ua:navigator.userAgent.slice(0,290)},{onConflict:'endpoint'}).then(function(r){if(r.error)throw r.error});
}
function on(){
  msg('جارٍ التفعيل..');
  Notification.requestPermission().then(function(p){
    if(p!=='granted'){msg('لم يُسمح بالإشعارات.','bad');state();throw 0}
    return window.BB.functions.invoke('push',{body:{op:'key'}});
  }).then(function(r){
    if(r.error||!r.data||!r.data.key)throw new Error('تعذر جلب مفتاح الإشعارات');
    return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(r.data.key)});
  }).then(save).then(function(){msg('فُعّلت. سيصلك إشعار تجريبي الآن.','good');return test()}).then(state)
  .catch(function(e){if(e===0)return;msg('تعذر التفعيل: '+(e&&e.message||e),'bad')});
}
function off(sub){
  var ep=sub.endpoint;msg('');
  sub.unsubscribe().then(function(){return window.BB.from('push_subs').delete().eq('endpoint',ep)}).then(function(){msg('أُوقفت على هذا الجهاز.','good');state()});
}
function test(){
  return window.BB.functions.invoke('push',{body:{op:'test'}}).then(function(r){
    if(r.error||!r.data){msg('تعذر الإرسال.','bad');return}
    if(r.data.sent)msg('أُرسل إشعار تجريبي إلى '+r.data.sent+(r.data.sent===1?' جهاز.':' أجهزة.'),'good');
    else msg('لم يُرسل: '+((r.data.errors||[]).join('، ')||'لا أجهزة مفعّلة'),'bad');
  });
}

/* أنواع الإشعارات */
function types(){
  var w=$('pTypes');w.innerHTML='';w.appendChild(el('p','muted','كل اختيار يُحفظ فور الضغط عليه. والضغط على الإشعار يفتح الطلب أو الحساب نفسه.'));
  TYPES.forEach(function(t){var l=el('label','q-auto');var c=el('input');c.type='checkbox';c.checked=!!cfg[t[0]];
    c.onchange=function(){cfg[t[0]]=c.checked;window.BB.from('app_settings').upsert({key:'notify',value:cfg,updated_at:new Date().toISOString()}).then(function(r){msg(r.error?'تعذر الحفظ: '+r.error.message:'حُفظ.',r.error?'bad':'good')})};
    var s=el('span');s.appendChild(el('b',null,t[1]));s.appendChild(el('small',null,t[2]));l.appendChild(c);l.appendChild(s);w.appendChild(l)});
}

var started=false;
window.BBPush={load:function(){
  if(started)return;started=true;
  window.BB.auth.getUser().then(function(r){uid=r.data&&r.data.user&&r.data.user.id;
    return window.BB.from('app_settings').select('value').eq('key','notify').maybeSingle()}).then(function(r){cfg=(r&&r.data&&r.data.value)||{};types()});
  if(supported&&!(ios&&!standalone))navigator.serviceWorker.register(BASE+'sw.js',{scope:BASE}).then(function(r){reg=r;return navigator.serviceWorker.ready}).then(function(r){reg=r;state()}).catch(function(e){msg('تعذر تشغيل عامل الخدمة: '+e.message,'bad');state()});
  else state();
}};
})();
