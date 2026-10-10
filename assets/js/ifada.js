/* إفادة الفحص الفني: ورقة A4 أفقية يصدرها المكتب لعميله حين يخلو القسم النظامي من المخالفات المانعة.
   الحكم والعدادات تُحسب في الخادم (ifada_check)، وهذا الملف يرسم الورقة ويصدّرها PDF ويعرض صندوقها في تقرير المكتب.
   يعتمد على assets/vendor/qrcode-generator-1.4.4.js، وعند التصدير jspdf وhtml-to-image. */
(function(){
'use strict';
var ASSETS=(document.currentScript&&document.currentScript.src||'').replace(/js\/ifada\.js.*$/,'');
var SITE='https://albait-baitak.com';
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function cnt(k,f){k=+k;return k===1?f[0]:k===2?f[1]:(k>=3&&k<=10)?k+' '+f[2]:k+' '+f[3]}
var ORD=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر'];
function revName(n){return ORD[n-1]||('رقم '+n)}
function verifyUrl(code){return SITE+'/verify/#'+code}
function joinAr(a){if(!a.length)return '';if(a.length===1)return a[0];return a.slice(0,-1).join('، ')+'، و'+a[a.length-1]}

/* رمز QR مسار SVG واحد */
function qrSvg(text){
  if(typeof window.qrcode!=='function')return null;
  var q=window.qrcode(0,'M');q.addData(text);q.make();var n=q.getModuleCount(),d='';
  for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(q.isDark(y,x))d+='M'+x+' '+y+'h1v1h-1z';
  var ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 '+n+' '+n);s.setAttribute('shape-rendering','crispEdges');s.setAttribute('aria-hidden','true');
  var p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill','currentColor');s.appendChild(p);return s;
}

function outText(rec){
  var c=rec.counts||{},a=(rec.out||[]).slice();
  if(c.pending)a.push(cnt(c.pending,['بند نظامي واحد','بندان نظاميان','بنود نظامية','بنداً نظامياً'])+' لم يكتمل تحققنا من نصه الرسمي');
  if(c.unk_opt)a.push(cnt(c.unk_opt,['بند غير إلزامي','بندان غير إلزاميين','بنود غير إلزامية','بنداً غير إلزامي'])+' لم يتضح في المخطط');
  if(!a.length)return 'لا شيء من أقسام هذا الطلب خارج نطاقها.';
  return joinAr(a)+'. وكلها مفصلة في التقرير الكامل لدى المكتب.';
}

/* الورقة: 1123×794 بكسل (A4 أفقية بدقة 96) */
function sheet(rec,opt){
  opt=opt||{};var c=rec.counts||{};
  var s=el('article','ifd');s.setAttribute('aria-label','إفادة فحص فني '+rec.code);s.setAttribute('dir','rtl');
  s.appendChild(el('div','ifd-frame'));
  if(opt.stamp)s.appendChild(el('span','ifd-stamp',opt.stamp));
  var inr=el('div','ifd-in');s.appendChild(inr);
  var h=el('div','ifd-head');
  var k=el('div','ifd-kind');k.appendChild(el('b',null,'الفحص الفني لمخططات المسكن السعودي'));k.appendChild(document.createTextNode('albait-baitak.com'));h.appendChild(k);
  var lg=el('img','ifd-logo');lg.src=ASSETS+'img/brand/logo-horizontal.svg';lg.alt='البيت بيتك';h.appendChild(lg);
  var no=el('div','ifd-no');no.appendChild(document.createTextNode('رقم الإفادة'));no.appendChild(el('b',null,rec.code));h.appendChild(no);
  inr.appendChild(h);
  var t=el('div','ifd-title');t.appendChild(el('h3',null,'إفادة فحص فني'));
  t.appendChild(el('p',null,'تفيد منظومة الفحص الفني في «البيت بيتك» بأن مخططات'));
  t.appendChild(el('div','prj',rec.project));t.appendChild(el('p',null,'المقدَّمة من'));t.appendChild(el('div','off',rec.office));
  t.appendChild(el('p',null,'فُحصت على البنود النظامية الواردة أدناه بإصداراتها، فلم تُرصد فيها مخالفة تمنع الرفع، ولا مخالفة تستوجب المعالجة قبله.'));
  inr.appendChild(t);
  var b=el('div','ifd-body'),L=el('div'),R=el('div');
  var v=el('div','ifd-verdict');v.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>';
  var vt=el('div');vt.appendChild(el('b',null,'لم تُرصد مخالفات مانعة في البنود المفحوصة'));
  vt.appendChild(el('span',null,'القسم النظامي: صفر مخالفة تمنع الرفع، وصفر مخالفة تُعالج قبله، وصفر بند إلزامي غير موضّح في المخطط'));v.appendChild(vt);L.appendChild(v);
  var ct=el('div','ifd-counts');
  [[c.checked,c.checked>=3&&c.checked<=10?'بنود نظامية فُحصت':'بنداً نظامياً فُحص'],[c.ok,'مطابق'],[c.na,'لا يخص هذا المشروع'],
   [c.minor||0,(c.minor>=3&&c.minor<=10)?'ملاحظات تحسين لا تمنع الرفع':'ملاحظة تحسين لا تمنع الرفع']].forEach(function(x){var d=el('div');d.appendChild(el('b',null,String(x[0]||0)));d.appendChild(el('span',null,x[1]));ct.appendChild(d)});
  L.appendChild(ct);
  var sr=el('div','ifd-src');sr.appendChild(el('h4',null,'المصادر'));var ol=el('ol');
  (rec.sources||[]).forEach(function(x){var li=el('li'),a=el('span',null,x.title);a.appendChild(el('small',null,x.publisher+' · '+x.edition));li.appendChild(a);li.appendChild(el('em',null,cnt(x.n,['بند واحد','بندان','بنود','بنداً'])));ol.appendChild(li)});
  sr.appendChild(ol);R.appendChild(sr);
  var ou=el('div','ifd-out');ou.appendChild(el('h4',null,'خارج نطاق هذه الإفادة'));ou.appendChild(el('p',null,outText(rec)));R.appendChild(ou);
  b.appendChild(L);b.appendChild(R);inr.appendChild(b);
  var f=el('div','ifd-foot'),m=el('div','ifd-meta');
  [['تاريخ الفحص',rec.date,1],['الإصدار المفحوص',revName(rec.rev||1)],['بصمة الملفات',rec.fp,1]].forEach(function(x){var d=el('div');d.appendChild(el('span',null,x[0]));d.appendChild(el('b',x[2]?'m':null,x[1]));m.appendChild(d)});
  f.appendChild(m);
  var lg2=el('p','ifd-legal');lg2.appendChild(el('strong',null,'تسقط هذه الإفادة بأي تعديل على المخطط بعد تاريخها. '));
  lg2.appendChild(document.createTextNode('وهي فحص فني سابق للرفع على المصادر المذكورة بإصداراتها، لا تغني عن مراجعة الأمانة واعتمادها، والمسؤولية المهنية عن التصميم لمُعدّه.'));f.appendChild(lg2);
  var qr=el('div','ifd-qr'),qp=el('p');qp.appendChild(document.createTextNode('امسح الرمز، أو افتح'));qp.appendChild(el('b',null,'albait-baitak.com/verify'));qp.appendChild(document.createTextNode('وأدخل رقم الإفادة'));qr.appendChild(qp);
  var qq=el('div','q'),svg=qrSvg(verifyUrl(rec.code));if(svg)qq.appendChild(svg);qr.appendChild(qq);f.appendChild(qr);
  inr.appendChild(f);
  return s;
}

/* معاينة مصغرة بعرض الحاوية */
function preview(rec,host,opt){
  host.innerHTML='';var wrap=el('div','ifd-pv'),s=sheet(rec,opt);wrap.appendChild(s);host.appendChild(wrap);
  function fit(){var w=wrap.clientWidth||1123,k=w/1123;s.style.transform='scale('+k+')';wrap.style.height=Math.round(794*k)+'px'}
  fit();if(window.ResizeObserver)new ResizeObserver(fit).observe(wrap);else window.addEventListener('resize',fit);
  return s;
}

function loadScript(src){return new Promise(function(res,rej){if(document.querySelector('script[src="'+src+'"]'))return res();var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('load'))};document.head.appendChild(s)})}
function pdf(rec){
  var host=null;
  return loadScript(ASSETS+'vendor/jspdf-2.5.1.min.js').then(function(){return loadScript(ASSETS+'vendor/html-to-image-1.11.11.js')}).then(function(){return document.fonts.ready}).then(function(){
    host=el('div','ifd-host');host.setAttribute('aria-hidden','true');var s=sheet(rec);host.appendChild(s);document.body.appendChild(host);
    var imgs=[].slice.call(s.querySelectorAll('img'));return Promise.all(imgs.map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r})})).then(function(){
      return window.htmlToImage.toJpeg(s,{quality:0.95,pixelRatio:2.5,backgroundColor:'#FBF9F4',width:1123,height:794})});
  }).then(function(url){var d=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'landscape',compress:true});d.addImage(url,'JPEG',0,0,297,210,undefined,'FAST');d.save('إفادة الفحص الفني - '+rec.code+'.pdf')})
  .then(function(){if(host)host.remove()},function(e){if(host)host.remove();throw e});
}

/* صندوق الإفادة في تقرير المكتب */
var ERR={not_allowed:'لا تملك صلاحية إصدار إفادة لهذا الطلب.',not_open:'الإفادة غير متاحة بعد.',bad_label:'اكتب وصف المشروع بين 3 و120 حرفاً.',exists:'صدرت إفادة لهذا الإصدار من قبل.',not_eligible:'لا يستحق هذا الإصدار الإفادة.'};
function errText(e){var m=(e&&e.message)||'';for(var k in ERR)if(m.indexOf(k)>=0)return ERR[k];return 'تعذر الإصدار. أعد المحاولة.'}
function box(host,rid){
  host.hidden=true;host.innerHTML='';
  if(!window.BB||!BB.rpc)return;
  BB.rpc('ifada_get',{rid:rid}).then(function(r){
    var g=r&&r.data;if(!g||!g.open)return;
    host.hidden=false;host.innerHTML='';
    var hd=el('div','card-h');hd.appendChild(el('h2',null,'إفادة الفحص الفني'));hd.appendChild(el('span','muted','ورقة تعطيها عميلك، ويتحقق منها برقمها'));host.appendChild(hd);
    var bd=el('div','card-b ifd-box');host.appendChild(bd);
    if(g.ifada){issued(bd,g.ifada);return}
    var ch=g.check||{},c=ch.counts||{};
    if(!ch.eligible){
      var why=[];
      if(ch.reason==='not_published')why.push('التقرير لم يُنشر بعد');
      else if(!ch.has_reg)why.push('القسم النظامي لم يُطلب في هذا الفحص');
      else{if(c.stop)why.push(cnt(c.stop,['مخالفة واحدة تمنع الرفع','مخالفتان تمنعان الرفع','مخالفات تمنع الرفع','مخالفة تمنع الرفع']));
        if(c.major)why.push(cnt(c.major,['مخالفة واحدة تُعالج قبل الرفع','مخالفتان تُعالجان قبل الرفع','مخالفات تُعالج قبل الرفع','مخالفة تُعالج قبل الرفع']));
        if(c.unk)why.push(cnt(c.unk,['بند إلزامي واحد غير موضّح في المخطط','بندان إلزاميان غير موضّحين في المخطط','بنود إلزامية غير موضّحة في المخطط','بنداً إلزامياً غير موضّح في المخطط']))}
      var p=el('p','ifd-why');p.appendChild(el('b',null,'لا تصدر الإفادة لهذا الإصدار. '));p.appendChild(document.createTextNode('في القسم النظامي '+joinAr(why)+'. عالجها وارفع إصداراً جديداً، فإن خلا منها صدرت إفادته.'));bd.appendChild(p);
      return;
    }
    var p2=el('p','ifd-lead','خلا القسم النظامي من المخالفات المانعة، فلهذا الإصدار إفادة. اكتب وصف المشروع كما تريده أن يظهر لعميلك، بلا اسم المالك ولا رقم الصك.');bd.appendChild(p2);
    var f=el('form','ifd-form');f.noValidate=true;
    var lb=el('label',null,'وصف المشروع');lb.setAttribute('for','ifdLabel');var inp=el('input');inp.id='ifdLabel';inp.maxLength=120;inp.value=g.suggest||'';inp.placeholder='فيلا سكنية من دورين · حي السلام، الأحساء';
    var bt=el('button','btn','أصدر الإفادة');bt.type='submit';var st=el('span','status');st.setAttribute('role','status');
    var row=el('div','ifd-row');row.appendChild(inp);row.appendChild(bt);f.appendChild(lb);f.appendChild(row);
    f.appendChild(el('p','ifd-note','تصدر مرة واحدة لهذا الإصدار ولا تُعدَّل بعدها. وتسقط وحدها إذا رفعت إصداراً أحدث من المخطط.'));f.appendChild(st);bd.appendChild(f);
    var armed=false;
    f.addEventListener('submit',function(e){e.preventDefault();var v=inp.value.trim().replace(/\s+/g,' ');
      if(v.length<3){st.className='status bad';st.textContent=ERR.bad_label;inp.focus();return}
      if(!armed){armed=true;bt.textContent='تأكيد الإصدار';st.className='status';st.textContent='راجع الوصف ثم اضغط «تأكيد الإصدار».';setTimeout(function(){if(armed){armed=false;bt.textContent='أصدر الإفادة'}},6000);return}
      armed=false;bt.disabled=true;bt.textContent='جارٍ الإصدار..';
      BB.rpc('ifada_issue',{rid:rid,label:v}).then(function(x){if(x.error)throw x.error;bd.innerHTML='';issued(bd,x.data,true)})
        .catch(function(e2){bt.disabled=false;bt.textContent='أصدر الإفادة';st.className='status bad';st.textContent=errText(e2)})});
  },function(){});
}
function issued(bd,rec,fresh){
  var top=el('div','ifd-top');
  var a=el('div');a.appendChild(el('b',null,rec.superseded?'سقطت هذه الإفادة':(fresh?'صدرت الإفادة':'لهذا الإصدار إفادة سارية')));
  a.appendChild(el('span',null,rec.superseded?'رُفع بعدها إصدار أحدث من المخطط في \u2066'+rec.superseded+'\u2069':'رقمها \u2066'+rec.code+'\u2069 · صدرت في \u2066'+rec.date+'\u2069'));top.appendChild(a);
  var acts=el('div','ifd-acts'),bp=el('button','btn sm','نزّل PDF'),bc=el('button','btn sm line','انسخ رابط التحقق'),st=el('span','status');st.setAttribute('role','status');
  bp.type='button';bc.type='button';
  bp.addEventListener('click',function(){bp.disabled=true;var o=bp.textContent;bp.textContent='جارٍ التجهيز..';pdf(rec).then(function(){st.className='status';st.textContent='نُزّل الملف.'},function(){st.className='status bad';st.textContent='تعذر تجهيز الملف. أعد المحاولة.'}).then(function(){bp.disabled=false;bp.textContent=o})});
  bc.addEventListener('click',function(){var u=verifyUrl(rec.code);(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(function(){st.className='status';st.textContent='نُسخ الرابط.'},function(){st.className='status';st.textContent=u})});
  if(!rec.superseded)acts.appendChild(bp);acts.appendChild(bc);acts.appendChild(st);top.appendChild(acts);bd.appendChild(top);
  var pv=el('div','ifd-pvbox');bd.appendChild(pv);preview(rec,pv,rec.superseded?{stamp:'سقطت بإصدار أحدث'}:null);
}

window.IFADA={sheet:sheet,preview:preview,pdf:pdf,box:box,verifyUrl:verifyUrl,revName:revName,outText:outText,cnt:cnt};
})();
