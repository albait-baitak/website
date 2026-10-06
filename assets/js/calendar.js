/* تقويم بيتي: رابط تقويم خاص بالمستخدم يشترك فيه من جواله مرة واحدة، ويتحدث وحده
   بمواعيد الصيانة وانتهاء الضمانات ومهل الإصلاح ونهاية مدد التنفيذ. */
(function(){
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
var FN=(window.BB_CONFIG&&window.BB_CONFIG.url||'')+'/functions/v1/cal?t=';
function mount(host,what){
  if(!host||!window.BB)return;
  host.innerHTML='';host.className='calbox';
  var h=el('h2',null,'تقويم بيتك على جوالك');host.appendChild(h);
  host.appendChild(el('p','lead2','اشترك مرة واحدة، فتظهر '+(what||'مواعيدك')+' في تقويم جوالك وتصلك تنبيهاتها، وتتحدث وحدها كلما سجّلت شيئاً هنا.'));
  var body=el('div');host.appendChild(body);
  var msg=el('p','msg');msg.setAttribute('role','status');host.appendChild(msg);
  var uid=null;
  function say(t,c){msg.textContent=t||'';msg.className='msg'+(c?' '+c:'')}
  function draw(tok){
    body.innerHTML='';
    if(!tok){var b=el('button','btn','فعّل تقويم بيتك');b.type='button';b.addEventListener('click',function(){create(false)});body.appendChild(b);return}
    var https=FN+tok,web=https.replace(/^https:/,'webcal:');
    var row=el('div','row');
    var a1=el('a','btn','اشترك من الآيفون');a1.href=web;
    var a2=el('a','btn line','أضف إلى تقويم قوقل');a2.href='https://calendar.google.com/calendar/r?cid='+encodeURIComponent(web);a2.target='_blank';a2.rel='noopener';
    var cp=el('button','btn line','انسخ الرابط');cp.type='button';
    cp.addEventListener('click',function(){(navigator.clipboard?navigator.clipboard.writeText(https):Promise.reject()).then(function(){say('نُسخ الرابط. ألصقه في خانة «إضافة تقويم من رابط» في تطبيق التقويم.','good')},function(){window.prompt('انسخ الرابط',https)})});
    row.appendChild(a1);row.appendChild(a2);row.appendChild(cp);body.appendChild(row);
    var ul=el('ul','calnotes');
    ['في الآيفون: عند الاشتراك تأكد أن خيار «إزالة التنبيهات» غير مفعّل، لتصلك التنبيهات صباح كل موعد.',
     'في تقويم قوقل: يُحدَّث الاشتراك كل عدة ساعات، وقد يتأخر ظهور التعديل يوماً تقريباً. واضبط تنبيهات هذا التقويم من إعداداته.',
     'الرابط خاص بك: من يملكه يرى مواعيدك. لا ترسله لأحد، وإن أرسلته خطأً فأوقفه وأنشئ رابطاً جديداً.'].forEach(function(t){ul.appendChild(el('li',null,t))});
    body.appendChild(ul);
    var rv=el('button','linkbtn','أوقف هذا الرابط وأنشئ رابطاً جديداً');rv.type='button';var armed=false;
    rv.addEventListener('click',function(){if(!armed){armed=true;rv.textContent='اضغط مرة ثانية: سيتوقف الاشتراك القديم في كل الأجهزة';setTimeout(function(){armed=false;rv.textContent='أوقف هذا الرابط وأنشئ رابطاً جديداً'},4000);return}
      window.BB.from('cal_tokens').delete().eq('user_id',uid).then(function(r){if(r.error){say('تعذر الإيقاف. أعد المحاولة.','bad');return}create(true)})});
    body.appendChild(rv);
  }
  function create(again){say('جارٍ التفعيل..');
    window.BB.from('cal_tokens').insert({user_id:uid}).select('token').single().then(function(r){
      if(r.error){say('تعذر التفعيل. أعد المحاولة.','bad');return}say(again?'أُنشئ رابط جديد. اشترك به من جديد في جوالك واحذف الاشتراك القديم.':'','good');draw(r.data.token)})}
  window.BB.auth.getSession().then(function(r){var s=r.data&&r.data.session;if(!s){host.hidden=true;return}uid=s.user.id;
    window.BB.from('cal_tokens').select('token').eq('user_id',uid).maybeSingle().then(function(q){draw(q.data&&q.data.token)})});
}
window.BBCal={mount:mount};
})();
