/* لوحة «بيتي» في صفحة الحساب: تقرأ ما حفظه المستخدم في أدواته، فتريه آخر ما عمل عليه ووين وصل،
   وخطوته التالية، ومواعيده القادمة. سطر كل أداة يكتبه قارئها في assets/js/dash/sum-*.js (لا رقم مخترع). */
(function(){
var KEY2SLUG={bb_tool_first_session_v1:'first-session',bb_tool_land_v1:'land',bb_tool_budget_v1:'budget',bb_tool_fifty_v1:'fifty',
  bb_tool_roomsizes_v1:'room-sizes',bb_tool_smart_v1:'smart',bb_tool_points_v1:'points',bb_tool_roadmap_v1:'roadmap',bb_tool_offers_v1:'offers',
  bb_tool_agree_v1:'agreement',bb_tool_roughin_v1:'rough-in',bb_tool_finishes_v1:'finishes',bb_tool_qty_v1:'quantities',
  bb_tool_handover_v1:'handover',bb_tool_firstyear_v1:'first-year',bb_tool_maint_v1:'maintenance'};
var SLUG2KEY={};Object.keys(KEY2SLUG).forEach(function(k){SLUG2KEY[KEY2SLUG[k]]=k});
var MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
var ORDER=['decision','design','build','living'];

function base(){var s=document.querySelector('script[src*="assets/js/dash.js"]');return s?s.src.replace(/assets\/js\/dash\.js.*$/,''):'/'}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function slugOf(t){var m=/tools\/([a-z0-9-]+)\//.exec(t.href||'');return m?m[1]:null}
function pad(n){return ('0'+n).slice(-2)}
function isoLocal(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function dayDiff(a,b){return Math.round((new Date(a+'T00:00:00')-new Date(b+'T00:00:00'))/864e5)}

/* «قبل كم» بصيغة عربية سليمة */
function ago(ts){
  if(!ts)return '';var d=new Date(ts),n=dayDiff(isoLocal(new Date()),isoLocal(d));
  if(n<=0)return 'اليوم';if(n===1)return 'أمس';if(n===2)return 'قبل يومين';
  if(n<=10)return 'قبل '+n+' أيام';if(n<30)return 'قبل '+n+' يوماً';
  return 'في '+d.getDate()+' '+MONTHS[d.getMonth()]+(d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():'');
}
function when(iso,today){
  var n=dayDiff(iso,today),p=iso.split('-');
  if(n<=0)return 'اليوم';if(n===1)return 'غداً';
  return (+p[2])+' '+MONTHS[+p[1]-1]+(p[0]!==today.slice(0,4)?' '+p[0]:'');
}

/* البيانات: ما في الحساب، ومعه ما عُدّل على هذا الجهاز ولم يُرفع بعد (نفس قاعدة الأدوات في toolkit.js) */
function load(uid){
  return Promise.resolve(window.BB.from('tool_data').select('key,data,updated_at')).then(function(r){
    if(r.error)throw r.error;
    var rows={};(r.data||[]).forEach(function(x){if(KEY2SLUG[x.key])rows[x.key]={data:x.data,ts:Date.parse(x.updated_at)||0}});
    try{
      var m=JSON.parse(localStorage.getItem('bb_meta')||'null');
      if(m&&m.owner===uid&&m.t)Object.keys(m.t).forEach(function(k){
        if(!KEY2SLUG[k])return;var lt=m.t[k]||0,raw=localStorage.getItem(k);
        if(raw==null)return;if(rows[k]&&rows[k].ts>=lt)return;if(!rows[k]&&!(m.d&&m.d[k]))return;
        rows[k]={data:JSON.parse(raw),ts:lt};
      });
    }catch(e){}
    var need={};Object.keys(rows).forEach(function(k){var n=window.SUM_REF&&SUM_REF[k];if(n)need[n]=1});
    var B=base(),refs={};
    return Promise.all(Object.keys(need).map(function(n){
      return fetch(B+'refs/guide/'+n+'.json',{cache:'no-cache'}).then(function(x){return x.ok?x.json():null}).then(function(j){refs[n]=j},function(){refs[n]=null});
    })).then(function(){return {rows:rows,refs:refs}});
  });
}
function summarize(rows,refs){
  var info={};
  Object.keys(rows).forEach(function(k){
    var f=window.SUM&&SUM[k],s=null;
    try{s=f?f(rows[k].data,refs[SUM_REF[k]]||null):null}catch(e){s=null}
    info[KEY2SLUG[k]]={key:k,ts:rows[k].ts,s:s||{line:'',done:null,of:null,empty:true,more:null}};
  });
  return info;
}

/* ===== العرض ===== */
function bar(s){
  if(!s||s.done==null||!s.of)return null;
  var b=el('div','dbar');b.setAttribute('role','img');b.setAttribute('aria-label',s.done+' من '+s.of);
  var i=el('i');i.style.width=Math.max(2,Math.min(100,Math.round(s.done/s.of*100)))+'%';b.appendChild(i);return b;
}
function stageTag(t){return t.stage?el('span','dtag','مرحلة '+(window.BBA?BBA.STAGE[t.stage]:'')):null}
function noOf(t,list){var i=list.indexOf(t);return i<0?'':pad(i+1)}

function hero(t,x,list,recent){
  var sec=el('section','card dhero');
  var h=el('div','card-h');h.appendChild(el('h2',null,'أكمل من حيث توقفت'));h.appendChild(el('span','muted','آخر تعديل '+ago(x.ts)));sec.appendChild(h);
  var b=el('div','card-b dh');
  var no=noOf(t,list);if(no)b.appendChild(el('span','dh-no',no));
  var mid=el('div','dh-mid');var tg=stageTag(t);if(tg)mid.appendChild(tg);
  mid.appendChild(el('h3',null,t.name));
  mid.appendChild(el('p','dh-line',x.s.empty?'فتحتها ولم تُدخل فيها شيئاً بعد.':(x.s.line||'بدأت فيها.')));
  if(!x.s.empty&&x.s.more)mid.appendChild(el('p','dh-more',x.s.more));
  var br=bar(x.s);if(br)mid.appendChild(br);
  b.appendChild(mid);
  var a=el('a','btn','أكمل');a.href='../'+t.href;b.appendChild(a);
  sec.appendChild(b);
  if(recent.length){
    var f=el('div','dh-also');f.appendChild(el('span','muted','وعملت مؤخراً في: '));
    recent.forEach(function(r,i){if(i)f.appendChild(document.createTextNode('، '));var l=el('a',null,r.t.name);l.href='../'+r.t.href;f.appendChild(l)});
    sec.appendChild(f);
  }
  return sec;
}
function starter(t,list){
  var sec=el('section','card dhero');
  var h=el('div','card-h');h.appendChild(el('h2',null,'ابدأ من هنا'));sec.appendChild(h);
  var b=el('div','card-b dh');var no=noOf(t,list);if(no)b.appendChild(el('span','dh-no',no));
  var mid=el('div','dh-mid');var tg=stageTag(t);if(tg)mid.appendChild(tg);mid.appendChild(el('h3',null,t.name));
  mid.appendChild(el('p','dh-line',t.desc));
  mid.appendChild(el('p','dh-more','كل ما تكتبه في الأداة يُحفظ في حسابك، وتجده هنا حين ترجع.'));
  b.appendChild(mid);var a=el('a','btn','ابدأ');a.href='../'+t.href;b.appendChild(a);sec.appendChild(b);return sec;
}
function nextCard(n,list){
  var sec=el('section','card dnext');
  var h=el('div','card-h');h.appendChild(el('h2',null,'خطوتك التالية'));sec.appendChild(h);
  var a=el('a','dn card-b');a.href='../'+n.t.href;
  var no=noOf(n.t,list);if(no)a.appendChild(el('span','dn-no',no));
  var mid=el('div','dn-mid');mid.appendChild(el('b',null,n.t.name));mid.appendChild(el('span',null,n.why));a.appendChild(mid);
  a.appendChild(el('em',null,n.go));sec.appendChild(a);return sec;
}
function upcomingCard(ev,today){
  var sec=el('section','card dup');
  var h=el('div','card-h');h.appendChild(el('h2',null,'مواعيدك القادمة'));sec.appendChild(h);
  var ul=el('ul','dup-l card-b');
  ev.forEach(function(e){
    var li=el('li'),a=el('a');a.href='../'+e.href;
    var late=/^متأخر:\s*/.test(e.title);
    a.appendChild(el('span','dup-d'+(late?' late':''),late?'فات موعده':when(e.date,today)));
    a.appendChild(el('span','dup-t',late?e.title.replace(/^متأخر:\s*/,'صيانة: '):e.title));li.appendChild(a);ul.appendChild(li);
  });
  sec.appendChild(ul);return sec;
}
function serviceCard(){
  var c=(window.BB_CONFIG&&BB_CONFIG.contact)||'';if(!c)return null;
  var sec=el('section','dsvc');
  sec.appendChild(el('p',null,'تصمم بيت عمرك قريباً؟ خلف هذه الأدوات معماري يصمم بيت العمر بنفسه، من أول جلسة حتى آخر لوحة، بسعر ثابت معلن من البداية.'));
  var a=el('a','btn line sm','تواصل معه');a.href=c;a.target='_blank';a.rel='noopener';
  a.addEventListener('click',function(){if(window.BBStat&&BBStat.contact)BBStat.contact('dash')});
  sec.appendChild(a);return sec;
}

/* الخطوة التالية: في مرحلة المستخدم أولاً أداة لم يبدأها، ثم أداة بدأها ولم يكملها، ثم أول أداة في المرحلة التي بعدها */
function pickNext(tools,info,stage,skip){
  var st=ORDER.indexOf(stage);if(st<0)st=0;
  function inSt(k){return tools.filter(function(t){return t.stage===k&&slugOf(t)!==skip})}
  var cur=inSt(ORDER[st]);
  for(var i=0;i<cur.length;i++){var x=info[slugOf(cur[i])];if(!x||x.s.empty)return {t:cur[i],why:cur[i].desc,go:'ابدأ'}}
  var part=cur.map(function(t){return {t:t,x:info[slugOf(t)]}}).filter(function(o){return o.x&&o.x.s.of&&o.x.s.done<o.x.s.of})
    .sort(function(a,b){return a.x.s.done/a.x.s.of-b.x.s.done/b.x.s.of});
  if(part.length)return {t:part[0].t,why:'وصلت فيها إلى '+part[0].x.s.done+' من '+part[0].x.s.of+'.. أكملها',go:'أكمل'};
  for(var s=st+1;s<ORDER.length;s++){var nx=inSt(ORDER[s]);for(var j=0;j<nx.length;j++){var y=info[slugOf(nx[j])];if(!y||y.s.empty)return {t:nx[j],why:'أنهيت أدوات مرحلتك.. وهذه أول أدوات مرحلة '+BBA.STAGE[ORDER[s]],go:'ابدأ'}}}
  return null;
}

/* تُرسم اللوحة في box، وتعيد info ليستعمله رسم بطاقات الأدوات */
function render(box,p,uid,tools,info,today){
  box.innerHTML='';
  var used=Object.keys(info).map(function(s){var t=null;tools.forEach(function(x){if(slugOf(x)===s)t=x});return t?{t:t,x:info[s]}:null})
    .filter(Boolean).sort(function(a,b){return b.x.ts-a.x.ts});
  var list=tools.filter(function(t){return t.stage});
  var top=used.filter(function(u){return !u.x.s.empty})[0]||used[0];
  var stage=p.stage||(top&&top.t.stage)||'decision';
  if(top)box.appendChild(hero(top.t,top.x,list,used.filter(function(u){return u!==top&&!u.x.s.empty}).slice(0,2)));
  else if(p.role==='owner'){var first=pickNext(tools,info,stage,null);if(first)box.appendChild(starter(first.t,list))}
  /* الخطوة التالية مبنية على مراحل رحلة الفرد، فلا تظهر لغيره */
  if(top&&p.role==='owner'){var n=pickNext(tools,info,stage,slugOf(top.t));if(n)box.appendChild(nextCard(n,list))}
  if(window.UPCOMING){
    var D={};Object.keys(info).forEach(function(s){D[info[s].key]=info[s].raw});
    var ev=[];try{ev=UPCOMING(D,info.__refs||{},today)||[]}catch(e){ev=[]}
    if(ev.length)box.appendChild(upcomingCard(ev.slice(0,4),today));
  }
  if(p.role==='owner'&&(!p.stage||p.stage==='decision'||p.stage==='design')){var sv=serviceCard();if(sv)box.appendChild(sv)}
}

window.BBDash={
  /* يحمّل البيانات ويرسم اللوحة؛ ثم يستدعي done(info) ليرسم صاحب الصفحة بطاقات الأدوات بحالاتها */
  mount:function(box,p,uid,tools,done){
    box.innerHTML='';var w=el('p','muted dload','جارٍ تحميل عملك..');box.appendChild(w);
    return load(uid).then(function(r){
      var info=summarize(r.rows,r.refs);
      Object.keys(info).forEach(function(s){info[s].raw=r.rows[info[s].key].data});
      Object.defineProperty(info,'__refs',{value:r.refs,enumerable:false});
      render(box,p,uid,tools,info,isoLocal(new Date()));
      if(done)done(info);return info;
    },function(){box.innerHTML='';box.appendChild(el('p','msg bad','تعذر تحميل عملك في الأدوات. أعد تحميل الصفحة.'));if(done)done({})});
  },
  slugOf:slugOf,ago:ago,bar:bar
};
})();
