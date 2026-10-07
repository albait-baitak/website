/* تبويب الإحصائيات في لوحة الإدارة: يقرأ تقريراً مجمّعاً واحداً من الدالة stats_report (للمدير فقط)
   ويعرضه: المؤشرات، الزيارات اليومية، الصفحات، المصادر، الأجهزة، الأدوات، قمع التحويل، المسجلون.
   زيارات المدير مستبعدة من كل الأرقام. */
(function(){
var host=document.getElementById('vStats');if(!host)return;
var ROLE={office:'مكتب هندسي',designer:'مصمم',contractor:'مقاول',owner:'فرد'};
var STAGE={decision:'القرار',design:'التصميم',build:'التنفيذ',living:'السكن'};
var DEV={mobile:'جوال',tablet:'جهاز لوحي',desktop:'حاسوب'};
var days=30,busy=false,loaded=false;
function $(id){return document.getElementById(id)}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function n(x){return x==null?'·':Number(x).toLocaleString('en-US')}
function pct(a,b){return b?Math.round(100*a/b)+'٪':'·'}
function secs(s){if(s==null)return '·';s=Math.round(s);if(s<60)return s+' ث';var m=Math.floor(s/60),r=s%60;return m+' د'+(r?' '+r+' ث':'')}
function ago(ts){var d=(Date.now()-Date.parse(ts))/1000;if(d<3600)return 'قبل '+Math.max(1,Math.round(d/60))+' د';if(d<86400)return 'قبل '+Math.round(d/3600)+' س';return new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit'})}
function delta(cur,prev){if(prev==null||!prev)return '';var d=Math.round(100*(cur-prev)/prev);return (d>0?'+':'')+d+'٪ عن الفترة السابقة'}

/* شريط أفقي: الطول نسبة إلى أعلى قيمة في نفس القائمة */
function bars(list,label,val,extra,max){
  var w=el('div','st-bars');if(!list.length){w.appendChild(el('p','empty','لا بيانات بعد.'));return w}
  max=max||Math.max.apply(null,list.map(val))||1;
  list.forEach(function(r){var row=el('div','st-bar');
    var t=el('div','st-bar-t');t.appendChild(el('span','st-bar-l',label(r)));t.appendChild(el('b',null,n(val(r))));row.appendChild(t);
    var tr=el('div','st-track');var f=el('i');f.style.width=Math.max(2,100*val(r)/max)+'%';tr.appendChild(f);row.appendChild(tr);
    if(extra){var x=extra(r);if(x)row.appendChild(el('small',null,x))}
    row.title=label(r)+': '+n(val(r));w.appendChild(row)});
  return w;
}
/* الزيارات اليومية: أعمدة بخط أساس، والقيمة تظهر عند المرور أو اللمس */
function daily(list){
  var w=el('div','st-daily');var max=Math.max.apply(null,list.map(function(d){return d.v}))||1;
  var tip=el('div','st-tip');tip.hidden=true;
  var plot=el('div','st-plot');
  list.forEach(function(d){var c=el('button','st-col');c.type='button';
    var b=el('i');b.style.height=(d.v?Math.max(3,100*d.v/max):0)+'%';c.appendChild(b);
    var lab=new Date(d.d+'T12:00:00').toLocaleDateString('ar-SA-u-nu-latn-ca-gregory',{weekday:'long',day:'numeric',month:'long'});
    c.setAttribute('aria-label',lab+': '+d.v+' زائر، '+d.p+' صفحة');
    function show(){tip.hidden=false;tip.textContent=lab+' · '+n(d.v)+' زائر · '+n(d.p)+' صفحة';plot.querySelectorAll('.on').forEach(function(x){x.classList.remove('on')});c.classList.add('on')}
    c.addEventListener('mouseenter',show);c.addEventListener('focus',show);c.addEventListener('click',show);
    plot.appendChild(c)});
  plot.addEventListener('mouseleave',function(){tip.hidden=true;plot.querySelectorAll('.on').forEach(function(x){x.classList.remove('on')})});
  var ax=el('div','st-axis');ax.appendChild(el('span',null,fmtD(list[0]&&list[0].d)));ax.appendChild(el('span',null,'أعلى يوم: '+n(max)+' زائر'));ax.appendChild(el('span',null,fmtD(list.length&&list[list.length-1].d)));
  w.appendChild(tip);w.appendChild(plot);w.appendChild(ax);return w;
}
function fmtD(d){return d?new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit'}):''}
function card(title,sub,body){var s=el('section','card');var h=el('div','card-h');h.appendChild(el('h2',null,title));if(sub)h.appendChild(el('span','muted',sub));s.appendChild(h);var b=el('div','card-b');if(body)b.appendChild(body);s.appendChild(b);return s}
function kpi(label,val,sub){var d=el('div');d.appendChild(el('span',null,label));d.appendChild(el('b',null,val));if(sub)d.appendChild(el('small',null,sub));return d}

function render(R){
  var out=$('stBody');out.innerHTML='';var K=R.kpi||{},P=R.prev||{};
  /* المؤشرات */
  var k=el('div','st-kpis');
  k.appendChild(kpi('الزوار',n(K.visitors),delta(K.visitors,P.visitors)));
  k.appendChild(kpi('مشاهدات الصفحات',n(K.pageviews),delta(K.pageviews,P.pageviews)));
  k.appendChild(kpi('زوار جدد',n(K.new_visitors),pct(K.new_visitors,K.visitors)+' من الزوار'));
  k.appendChild(kpi('متوسط مدة الزيارة',secs(K.avg_session_s),'زيارات بصفحة واحدة: '+(K.bounce==null?'·':K.bounce+'٪')));
  k.appendChild(kpi('حسابات جديدة',n(K.signups),delta(K.signups,P.signups)));
  k.appendChild(kpi('استخدموا أداة',n(K.tool_users),delta(K.tool_users,P.tool_users)));
  out.appendChild(k);
  if(!K.pageviews){out.appendChild(el('p','empty','لم تُسجَّل زيارات في هذه الفترة بعد. الإحصاء يبدأ من لحظة نشره، وزياراتك أنت مستبعدة.'))}

  out.appendChild(card('الزوار يومياً',null,daily(R.daily||[])));

  /* قمع التحويل */
  var F=R.funnel||{},fl=[{t:'زاروا الموقع',v:F.visitors},{t:'فتحوا صفحة الحساب',v:F.account},{t:'سجّلوا حساباً',v:F.signups},{t:'استخدموا أداة بعد التسجيل',v:F.used_tool}];
  var fw=el('div','st-funnel');fl.forEach(function(s,i){var r=el('div','st-step');r.appendChild(el('b',null,n(s.v)));r.appendChild(el('span',null,s.t));if(i)r.appendChild(el('small',null,pct(s.v,fl[i-1].v)+' من الخطوة السابقة'));fw.appendChild(r)});
  out.appendChild(card('من الزيارة إلى الاستخدام','أين يتوقف الناس',fw));

  /* الأدوات */
  var tl=R.tools||[],tb=el('div');
  if(!tl.length)tb.appendChild(el('p','empty','لا بيانات بعد.'));
  else{var t=el('table','tbl st-tbl');t.innerHTML='<thead><tr><th>الأداة</th><th>فتحوها</th><th>عبّؤوا فيها</th><th>نسبة الاستخدام</th><th>رجعوا لها في يوم آخر</th></tr></thead>';var tbd=el('tbody');
    tl.forEach(function(r){var tr=el('tr');tr.appendChild(el('td',null,r.title||r.path));tr.appendChild(el('td','num',n(r.openers)));tr.appendChild(el('td','num',n(r.users)));tr.appendChild(el('td','num',pct(r.users,r.openers)));tr.appendChild(el('td','num',n(r.returners)));tbd.appendChild(tr)});
    t.appendChild(tbd);var wr=el('div','tbl-wrap');wr.appendChild(t);tb.appendChild(wr)}
  out.appendChild(card('الأدوات','مرتبة بعدد من استخدمها فعلاً',tb));

  /* المصادر والأجهزة */
  var g=el('div','st-two');
  g.appendChild(card('من أين جاؤوا',null,bars(R.sources||[],function(r){return r.src},function(r){return r.visitors},function(r){return n(r.sessions)+' زيارة'})));
  var dv=el('div');dv.appendChild(bars(R.devices||[],function(r){return DEV[r.dev]||r.dev},function(r){return r.visitors}));
  if(R.outside)dv.appendChild(el('p','muted st-note',n(R.outside)+' زائر بتوقيت جهاز خارج السعودية والخليج.'));
  g.appendChild(card('الأجهزة',null,dv));out.appendChild(g);
  if((R.campaigns||[]).length)out.appendChild(card('الروابط الموسومة','كل رابط نشرته بوسم',bars(R.campaigns,function(r){return r.camp+(r.src?' · '+r.src:'')},function(r){return r.visitors})));

  /* الصفحات */
  var pl=R.pages||[],pb=el('div');
  if(!pl.length)pb.appendChild(el('p','empty','لا بيانات بعد.'));
  else{var pt=el('table','tbl st-tbl');pt.innerHTML='<thead><tr><th>الصفحة</th><th>المشاهدات</th><th>الزوار</th><th>متوسط البقاء</th><th>خرجوا منها</th></tr></thead>';var pbd=el('tbody');
    pl.forEach(function(r){var tr=el('tr');var td=el('td');td.appendChild(el('b',null,r.title||r.path));td.appendChild(el('small','st-path',r.path));tr.appendChild(td);
      tr.appendChild(el('td','num',n(r.views)));tr.appendChild(el('td','num',n(r.visitors)));tr.appendChild(el('td','num',secs(r.avg_s)));tr.appendChild(el('td','num',pct(r.exits,r.views)));pbd.appendChild(tr)});
    pt.appendChild(pbd);var pw=el('div','tbl-wrap');pw.appendChild(pt);pb.appendChild(pw)}
  out.appendChild(card('الصفحات',null,pb));

  /* المسجلون النشطون */
  var ul=R.users||[],ub=el('div');
  if(!ul.length)ub.appendChild(el('p','empty','لا نشاط لحسابات مسجلة في هذه الفترة بعد.'));
  else{var ut=el('table','tbl st-tbl');ut.innerHTML='<thead><tr><th>الحساب</th><th>النوع</th><th>آخر نشاط</th><th>الزيارات</th><th>الصفحات</th><th>الأدوات التي عبّأ فيها</th></tr></thead>';var ubd=el('tbody');
    ul.forEach(function(r){var tr=el('tr');var td=el('td');td.appendChild(el('b',null,r.name||r.email));if(r.name)td.appendChild(el('small','st-path',r.email));tr.appendChild(td);
      tr.appendChild(el('td',null,(ROLE[r.role]||r.role||'·')+(r.stage&&STAGE[r.stage]?' · '+STAGE[r.stage]:'')));
      tr.appendChild(el('td',null,ago(r.last)));tr.appendChild(el('td','num',n(r.sessions)));tr.appendChild(el('td','num',n(r.pageviews)));
      tr.appendChild(el('td',null,(r.tools||[]).join('، ')||'·'));ubd.appendChild(tr)});
    ut.appendChild(ubd);var uw=el('div','tbl-wrap');uw.appendChild(ut);ub.appendChild(uw)}
  out.appendChild(card('الحسابات النشطة','الزيارات قبل الدخول تُنسب للحساب بعد دخوله',ub));
}

function load(){
  if(busy)return;busy=true;$('stMsg').textContent='جارٍ التحميل..';
  window.BB.rpc('stats_report',{p_days:days}).then(function(r){busy=false;
    if(r.error){$('stMsg').textContent='تعذر التحميل: '+r.error.message;return}
    $('stMsg').textContent='آخر تحديث '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});loaded=true;render(r.data||{})});
}
$('stDays').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;days=+b.dataset.d;
  this.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-selected',String(x===b))});load()});
$('stReload').addEventListener('click',load);

/* صانع الروابط الموسومة: لكل منشور رابط يعرّف بمصدره في الإحصائيات */
var SITE=location.origin+'/';
function mk(){var p=$('stLPage').value||'',s=$('stLSrc').value,c=$('stLCamp').value.trim().toLowerCase().replace(/[^a-z0-9\-_]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
  var u=SITE+p+'?utm_source='+encodeURIComponent(s)+(c?'&utm_campaign='+encodeURIComponent(c):'');$('stLOut').value=u}
['stLPage','stLSrc','stLCamp'].forEach(function(id){$(id).addEventListener('input',mk)});mk();
$('stLCopy').addEventListener('click',function(){var o=$('stLOut');o.select();try{navigator.clipboard.writeText(o.value).then(function(){$('stLMsg').textContent='نُسخ.'})}catch(e){document.execCommand('copy');$('stLMsg').textContent='نُسخ.'}});

window.BBStats={load:function(){if(!loaded)load()}};
})();
