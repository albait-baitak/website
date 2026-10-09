var FQ_ASSETS=(document.currentScript&&document.currentScript.src||'').replace(/js\/report\.js.*$/,'');
/* حالات بنود «اتساق المخطط»، مشتركة بين عرض التقرير وصفحات الـPDF */
var CSTN={ok:'متسق',conflict:'متعارض',check:'للتحقق',unchecked:'لم يُفحص'},CST_ORD={conflict:1,check:2,unchecked:3,ok:4};

/* نموذج التقرير بالأقسام: يبني لكل قسم صفوف قواعده ومخالفاته وعدّاداته، ويجمع أخطر الملاحظات للملخص التنفيذي.
   التقارير القديمة بلا rep.sections تُستنتج أقسامها مما فيها */
var FQ_SEVN={stop:'تمنع الرفع',major:'تُعالج قبل الرفع',minor:'تحسين مقترح'};
function FQ_model(rep,only){
  var res=rep.results||{};
  var sel=rep.sections&&rep.sections.length?rep.sections.slice():(function(){var a=['reg','guide','arch'];
    if(RULES.some(function(R){return R.l===5&&res[R.c]}))a.push('eng');if(rep.consistency&&rep.consistency.length)a.push('cons');return a})();
  var ord={stop:0,major:1,minor:2};
  var out=[],top=[];
  SECTIONS.forEach(function(S){
    if(sel.indexOf(S.id)<0||S.id==='boq')return;if(only&&only!==S.id)return;
    var rows=RULES.filter(function(R){return S.layers.indexOf(R.l)>=0&&(R.l===5?!!res[R.c]:(!rep.listed||res[R.c]))}).map(function(R){return {R:R,r:res[R.c]||null}});
    if(S.id==='reg')(rep.extra||[]).forEach(function(x){rows.push({R:{c:x.c,l:x.l||1,n:x.n,r:x.r,s:x.s},r:x})});
    var c={stop:0,major:0,minor:0,unk:0,ok:0,na:0};
    rows.forEach(function(k){var r=k.r;if(!r)return;if(r.v==='fail')c[r.sev||'major']++;else if(r.v==='ok')c.ok++;else if(r.v==='na')c.na++;else c.unk++});
    var fails=rows.filter(function(k){return k.r&&k.r.v==='fail'}).sort(function(a,b){var x=ord[a.r.sev],y=ord[b.r.sev];return (x==null?1:x)-(y==null?1:y)||a.R.l-b.R.l});
    var cons=[];
    if(S.id==='cons'){cons=(rep.consistency||[]).slice().sort(function(a,b){return ((a.kind||'in')==='in'?0:1)-((b.kind||'in')==='in'?0:1)||(CST_ORD[a.state]||9)-(CST_ORD[b.state]||9)});
      cons.forEach(function(x){if(x.state==='conflict')c.major++;else if(x.state==='check')c.minor++;else if(x.state==='ok')c.ok++;else c.unk++})}
    var sec={id:S.id,n:S.n,sub:S.sub,layers:S.layers,rows:rows,fails:fails,cons:cons,c:c};
    out.push(sec);
    fails.forEach(function(k){if(k.r.sev==='minor')return;top.push({sev:k.r.sev||'major',sec:sec,code:k.R.c,t:k.R.n,f:k.r.f||'',fix:k.r.fix||''})});
    cons.forEach(function(x,i){if(x.state==='conflict')top.push({sev:'major',sec:sec,code:'cons-'+i,t:x.what,f:x.where||'',fix:''})});
  });
  top.sort(function(a,b){return ord[a.sev]-ord[b.sev]});
  return {sel:sel,secs:out,top:top,verdict:sel.indexOf('reg')>=0&&(!only||only==='reg')};
}
/* رسم أفقي مكدّس لكل قسم: ما يمنع الرفع، وما يُعالج قبله، والتحسين المقترح */
function FQ_chart(secs,hex){
  var NS='http://www.w3.org/2000/svg',W=640,RH=34,LW=200,BW=W-LW-70,H=secs.length*RH+30;
  var max=1;secs.forEach(function(s){max=Math.max(max,s.c.stop+s.c.major+s.c.minor)});
  var col=hex?{stop:'#9B2F22',major:'#B5652A',minor:'#5F7044',ink:'#1F1A17',mute:'#5E554E',line:'#D9D3CB'}:{stop:'var(--stop)',major:'var(--major)',minor:'var(--minor)',ink:'var(--ink)',mute:'var(--ink-2)',line:'var(--line)'};
  var svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('width','100%');svg.setAttribute('role','img');
  svg.setAttribute('aria-label','عدد الملاحظات في كل قسم بحسب درجتها');svg.setAttribute('direction','ltr');svg.style.direction='ltr';
  function t(x,y,s,a,c,sz,w){var e=document.createElementNS(NS,'text');e.setAttribute('x',x);e.setAttribute('y',y);e.setAttribute('text-anchor',a);e.setAttribute('fill',c);e.setAttribute('font-size',sz||13);if(w)e.setAttribute('font-weight',w);e.setAttribute('font-family','Janna, Tahoma, sans-serif');e.textContent=s;svg.appendChild(e)}
  secs.forEach(function(s,i){var y=i*RH+6,x=W-LW;
    t(W-4,y+17,s.n,'end',col.ink,13,700);
    var bg=document.createElementNS(NS,'rect');bg.setAttribute('x',70);bg.setAttribute('y',y+6);bg.setAttribute('width',BW);bg.setAttribute('height',16);bg.setAttribute('rx',3);bg.setAttribute('fill',col.line);bg.setAttribute('opacity','.45');svg.appendChild(bg);
    var cx=70+BW;['stop','major','minor'].forEach(function(k){var n=s.c[k];if(!n)return;var w=Math.max(3,BW*n/max);cx-=w;var r=document.createElementNS(NS,'rect');r.setAttribute('x',cx);r.setAttribute('y',y+6);r.setAttribute('width',w-1);r.setAttribute('height',16);r.setAttribute('rx',2);r.setAttribute('fill',col[k]);svg.appendChild(r)});
    var tot=s.c.stop+s.c.major+s.c.minor;t(62,y+19,tot?String(tot):'لا ملاحظات','end',tot?col.ink:col.mute,12,tot?700:400);
  });
  var ly=secs.length*RH+22,lx=W-4;[['stop','تمنع الرفع'],['major','تُعالج قبل الرفع'],['minor','تحسين مقترح']].forEach(function(p){var r=document.createElementNS(NS,'rect');r.setAttribute('x',lx-10);r.setAttribute('y',ly-9);r.setAttribute('width',10);r.setAttribute('height',10);r.setAttribute('rx',2);r.setAttribute('fill',col[p[0]]);svg.appendChild(r);t(lx-16,ly,p[1],'end',col.mute,11.5);lx-=p[1].length*7.5+34});
  return svg;
}
/* عرض تقرير الفحص الفني وتصديره PDF */
(function(){
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e}
var SEVN={stop:'تمنع الرفع',major:'تُعالج قبل الرفع',minor:'تحسين مقترح'};
var VD=[['ready','جاهز للرفع','لا مخالفة تمنع الرفع ولا تُعالج قبله'],['fix','يُرفع بعد العلاج','علاجها موضعي لا يغير التكوين'],['redesign','يعاد للتصميم','علاجها يغير التكوين']];
function stLabel(r){if(!r)return['unk','لم يُفحص'];if(r.v==='ok')return['ok','مطابق'];if(r.v==='na')return['na','لا يخص هذا المشروع'];if(r.v==='unk')return['unk','غير موضّح في المخطط'];if(r.v==='conflict')return['unk','تعارض في المرجع'];if(r.v==='style')return['unk','معلّق على نمط الطراز'];return['fail-'+(r.sev||'major'),'مخالف · '+(SEVN[r.sev]||'')]}

function allChecks(rep){
  var list=RULES.filter(function(R){return !rep.listed||rep.results[R.c]}).map(function(R){return {R:R,r:rep.results[R.c]||null}});
  (rep.extra||[]).forEach(function(x){list.push({R:{c:x.c,l:x.l,n:x.n,r:x.r,s:x.s},r:x})});
  return list;
}
function tally(rep){
  var t={};LAYERS.forEach(function(L){t[L.id]={stop:0,major:0,minor:0,unk:0,ok:0}});
  allChecks(rep).forEach(function(k){var r=k.r;if(!r)return;var T=t[k.R.l];if(r.v==='fail')T[r.sev||'major']++;else if(r.v==='unk'||r.v==='conflict'||r.v==='style')T.unk++;else if(r.v==='ok')T.ok++});
  return t;
}
function lname(id){for(var i=0;i<LAYERS.length;i++)if(LAYERS[i].id===id)return LAYERS[i].n;return ''}
var ORD={stop:0,major:1,minor:2};
function sevSort(a,b){var x=ORD[a.r.sev],y=ORD[b.r.sev];return (x==null?1:x)-(y==null?1:y)||a.R.l-b.R.l}

/* التغذية الراجعة: موافقة أو اعتراض على كل مخالفة، وتقييم للتقرير كله */
function fbRow(code,fb){
  var w=el('div','fb-row'),cur=(fb.state&&fb.state[code])||{};
  var a=el('button','fb-b'+(cur.kind==='agree'?' on':''),'أوافق');a.type='button';
  var o=el('button','fb-b'+(cur.kind==='object'?' on obj':''),'أعترض');o.type='button';
  var ta=el('textarea','fb-note');ta.placeholder='لماذا تعترض؟ (مثال: البعد مكتوب في لوحة كذا)';ta.rows=2;ta.value=cur.note||'';ta.hidden=cur.kind!=='object';
  var sv=el('button','btn sm line','أرسل الاعتراض');sv.type='button';sv.hidden=cur.kind!=='object';var st=el('span','fb-st');
  function set(kind,note){st.textContent='..';Promise.resolve(fb.onSet(code,kind,note)).then(function(){cur={kind:kind,note:note};if(fb.state)fb.state[code]=cur;
      a.className='fb-b'+(kind==='agree'?' on':'');o.className='fb-b'+(kind==='object'?' on obj':'');st.textContent=kind==='agree'?'شكراً':'وصل اعتراضك'},function(){st.textContent='تعذر الإرسال'})}
  a.addEventListener('click',function(){ta.hidden=true;sv.hidden=true;set('agree',null)});
  o.addEventListener('click',function(){ta.hidden=false;sv.hidden=false;ta.focus()});
  sv.addEventListener('click',function(){set('object',ta.value.trim()||null)});
  w.appendChild(el('span','fb-q','هل هذا الحكم صحيح؟'));w.appendChild(a);w.appendChild(o);w.appendChild(st);w.appendChild(ta);w.appendChild(sv);return w;
}
function rateBlock(rt){
  var b=el('div','blk rate-blk');var h=el('h4',null,'قيّم هذا التقرير');h.appendChild(el('span',null,'رأيك يطوّر الفحص'));b.appendChild(h);
  var v=rt.value||0,stars=el('div','stars');stars.setAttribute('role','radiogroup');stars.setAttribute('aria-label','التقييم');
  for(var i=1;i<=5;i++)(function(n){var s=el('button','star'+(n<=v?' on':''),'★');s.type='button';s.setAttribute('aria-label',n+' من 5');s.addEventListener('click',function(){v=n;[].forEach.call(stars.children,function(c,j){c.className='star'+(j<n?' on':'')})});stars.appendChild(s)})(i);
  b.appendChild(stars);var ta=el('textarea','fb-note');ta.rows=2;ta.placeholder='ما الذي أفادك؟ وما الذي ينقص التقرير؟';ta.value=rt.note||'';b.appendChild(ta);
  var sv=el('button','btn sm','أرسل التقييم');sv.type='button';var st=el('span','fb-st');
  sv.addEventListener('click',function(){if(!v){st.textContent='اختر عدد النجوم أولاً';return}st.textContent='..';Promise.resolve(rt.onSave(v,ta.value.trim()||null)).then(function(){st.textContent='شكراً، وصل تقييمك'},function(){st.textContent='تعذر الإرسال'})});
  var r=el('div','row');r.appendChild(sv);r.appendChild(st);b.appendChild(r);return b;
}
function render(rep,host,opts){
  opts=opts||{};host.innerHTML='';
  var M=FQ_model(rep);
  var box=el('article','rep');
  var h=el('div','rep-h');var hl=el('div');
  hl.appendChild(el('p','eyb','تقرير الفحص الفني'));
  hl.appendChild(el('h3',null,rep.title||'مخطط مرفوع'));
  hl.appendChild(el('p','sub',rep.sub||''));
  var hr=el('div');hr.style.textAlign='left';
  var isLive=rep.kind==='live'||rep.kind==='reviewed',isRev=rep.reviewed||rep.kind==='reviewed';
  hr.appendChild(el('span','badge'+(isLive?' live':''),isLive?(isRev?'فحص آلي · راجعه معماري':opts.auto?'فحص آلي':'فحص آلي · مسودة تراجعها عين معماري'):'عينة · فحص يدوي على المرجع'));
  var m=el('p','mono',(rep.ref||'')+' · '+(rep.date||new Date().toISOString().slice(0,10)));m.style.marginTop='6px';hr.appendChild(m);
  var pb=el('button','btn sm pdfbtn','تنزيل التقرير كاملاً PDF');pb.type='button';var ps=el('p','status pdfst');pb.addEventListener('click',function(){exportPdf(rep,pb,ps)});hr.appendChild(pb);hr.appendChild(ps);
  h.appendChild(hl);h.appendChild(hr);box.appendChild(h);

  /* الملخص التنفيذي */
  var ex=el('section','exec');ex.appendChild(el('h4','exec-h','الملخص التنفيذي'));
  if(M.verdict){
    var vl=el('div','vlabel');vl.appendChild(el('b',null,'حكم الجاهزية للرفع'));vl.appendChild(el('span',null,'يُبنى من الاشتراطات النظامية وحدها'));ex.appendChild(vl);
    var vd=el('div','vd');VD.forEach(function(v){var d=el('div',rep.verdict===v[0]?'on':'');d.appendChild(el('b',null,v[1]));d.appendChild(el('small',null,v[2]));vd.appendChild(d)});ex.appendChild(vd);
  }
  var sm=el('div','summary');
  [['المطابقة',0],['جودة التصميم',1],['الفحص الهندسي',2]].forEach(function(p){var x=rep.summary&&rep.summary[p[1]];if(!x)return;var q=el('p');q.appendChild(el('b',null,p[0]+': '));q.appendChild(document.createTextNode(x));sm.appendChild(q)});
  if(rep.assumptions&&rep.assumptions.length){var as=el('p','assume');as.appendChild(el('b',null,'افتراضات الفحص: '));as.appendChild(document.createTextNode(rep.assumptions.join(' · ')));sm.appendChild(as)}
  ex.appendChild(sm);
  var cw=el('div','exec-chart');cw.appendChild(el('p','exec-sub','الملاحظات في كل قسم بحسب درجتها'));cw.appendChild(FQ_chart(M.secs,false));ex.appendChild(cw);
  if(M.top.length){
    var tw=el('div','exec-top');tw.appendChild(el('p','exec-sub','أهم ما يُعالج أولاً'));var ol=el('ol','top-l');
    M.top.slice(0,8).forEach(function(x){var li=el('li');li.appendChild(el('span','sevtag '+x.sev,FQ_SEVN[x.sev]));
      var a=el('a',null,x.t);a.href='#f-'+x.code;a.addEventListener('click',function(e){e.preventDefault();var t=box.querySelector('#f-'+CSS.escape(x.code));if(!t)return;var d=t.closest('details');if(d)d.open=true;t.scrollIntoView({behavior:'smooth',block:'center'});t.classList.add('flash');setTimeout(function(){t.classList.remove('flash')},1600)});
      var d=el('div');d.appendChild(a);d.appendChild(el('small',null,x.sec.n+(x.f?' · '+x.f:'')));li.appendChild(d);ol.appendChild(li)});
    if(M.top.length>8)ol.appendChild(el('li','more','و'+(M.top.length-8)+' ملاحظة أخرى في أقسامها'));
    tw.appendChild(ol);ex.appendChild(tw);
  }else ex.appendChild(el('p','exec-ok','لا ملاحظات تمنع الرفع أو تُعالج قبله في الأقسام المفحوصة.'));
  box.appendChild(ex);

  /* الأقسام: كل قسم يُطوى ويُفتح، والقسم الذي فيه ما يمنع الرفع يبدأ مفتوحاً */
  var ctl=el('div','sec-ctl');var oa=el('button','linkbtn','افتح كل الأقسام');oa.type='button';var ca=el('button','linkbtn','اطوِ الكل');ca.type='button';
  oa.addEventListener('click',function(){box.querySelectorAll('details.rsec').forEach(function(d){d.open=true})});ca.addEventListener('click',function(){box.querySelectorAll('details.rsec').forEach(function(d){d.open=false})});
  ctl.appendChild(oa);ctl.appendChild(ca);box.appendChild(ctl);
  M.secs.forEach(function(S){
    var d=el('details','rsec');d.id='sec-'+S.id;if(S.c.stop)d.open=true;
    var su=el('summary');var ti=el('div','rs-t');ti.appendChild(el('b',null,S.n));ti.appendChild(el('span',null,S.sub));su.appendChild(ti);
    var cn=el('span','cnts');
    if(S.c.stop)cn.appendChild(el('span','c-stop',S.c.stop+' تمنع'));if(S.c.major)cn.appendChild(el('span','c-major',S.c.major+' تُعالج'));if(S.c.minor)cn.appendChild(el('span','c-minor',S.c.minor+' تحسين'));
    if(!S.c.stop&&!S.c.major&&!S.c.minor)cn.appendChild(el('span','c-ok','✓ لا ملاحظات'));su.appendChild(cn);d.appendChild(su);
    var bd=el('div','rs-b');
    var tl=el('div','rs-tools');var spb=el('button','btn sm line','PDF لهذا القسم');spb.type='button';var sps=el('span','status pdfst');spb.addEventListener('click',function(){exportPdf(rep,spb,sps,S.id)});tl.appendChild(spb);tl.appendChild(sps);bd.appendChild(tl);
    if(S.id==='cons')consBlock(S,bd);
    else{
      var fb=el('div','blk');var fh=el('h4',null,S.id==='reg'?'المخالفات وعلاجاتها':'الملاحظات وعلاجاتها');fh.appendChild(el('span',null,S.fails.length?S.fails.length+' مرتبة بالدرجة':''));fb.appendChild(fh);
      if(!S.fails.length)fb.appendChild(el('p','muted','لا شيء.'));
      S.fails.forEach(function(k){
        var f=el('div','find');f.id='f-'+k.R.c;f.appendChild(el('span','sevtag '+(k.r.sev||'major'),SEVN[k.r.sev]||'تُعالج قبل الرفع'));
        var dd=el('div');var tt=el('div','t',k.R.n);tt.appendChild(el('code',null,k.R.c));if(k.R.d)tt.appendChild(el('span','disc-tag',DISC[k.R.d]||''));dd.appendChild(tt);
        var dl=el('dl');[['المطلوب',k.R.r,''],['في المخطط',k.r.f,''],['العلاج',k.r.fix||'','fix']].forEach(function(p){if(!p[1])return;dl.appendChild(el('dt',null,p[0]));dl.appendChild(el('dd',p[2]||null,p[1]))});
        dd.appendChild(dl);if(k.r.note)dd.appendChild(el('p','note','ملاحظة: '+k.r.note));dd.appendChild(el('p','note',k.R.s||''));
        if(opts.fb)dd.appendChild(fbRow(k.R.c,opts.fb));
        f.appendChild(dd);fb.appendChild(f);
      });
      bd.appendChild(fb);
      var lb=el('div','blk');var lh=el('h4',null,'سجل الفحص الكامل');lh.appendChild(el('span',null,'كل قاعدة وما وُجد في المخطط'));lb.appendChild(lh);
      groupsOf(S).forEach(function(g){
        var lr=g.rows;if(!lr.length)return;var c={ok:0,stop:0,major:0,minor:0,unk:0};lr.forEach(function(k){var r=k.r;if(!r)return;if(r.v==='fail')c[r.sev||'major']++;else if(r.v==='ok')c.ok++;else if(r.v!=='na')c.unk++});
        var dt=el('details','lay');var sx=el('summary');sx.appendChild(el('span',null,g.n));
        var cc=el('span','cnts');cc.appendChild(el('span','c-ok','✓ '+c.ok));['stop','major','minor'].forEach(function(x){if(c[x])cc.appendChild(el('span','c-'+x,'✗ '+c[x]))});if(c.unk)cc.appendChild(el('span',null,'؟ '+c.unk));
        sx.appendChild(cc);dt.appendChild(sx);
        var w=el('div','chk-wrap'),tb2=el('table','chk'),hd=el('thead'),hr2=el('tr');
        ['القاعدة','المطلوب','في المخطط','الحكم'].forEach(function(x){hr2.appendChild(el('th',null,x))});hd.appendChild(hr2);tb2.appendChild(hd);
        var tb=el('tbody');
        lr.forEach(function(k){var r=el('tr');var c1=el('td');c1.appendChild(document.createTextNode(k.R.n));c1.appendChild(el('code',null,k.R.c));r.appendChild(c1);
          r.appendChild(el('td',null,k.R.r));r.appendChild(el('td',null,k.r?k.r.f:'·'));var s2=stLabel(k.r);r.appendChild(el('td','st '+s2[0],s2[1]));tb.appendChild(r)});
        tb2.appendChild(tb);w.appendChild(tb2);dt.appendChild(w);lb.appendChild(dt);
      });
      bd.appendChild(lb);
      if(S.id==='reg'&&rep.extraction&&rep.extraction.length){
        var xb=el('div','blk');var dx=el('details','lay');var sx2=el('summary');sx2.appendChild(el('span',null,'جدول الاستخراج'));sx2.appendChild(el('span','cnts',rep.extraction.length+' فراغاً'));dx.appendChild(sx2);
        var wx=el('div','chk-wrap'),tx=el('table','ext-t'),hx=el('thead'),rx=el('tr');['الدور','الفراغ','الأبعاد (م)','المساحة (م²)','الحد النظامي','الحالة'].forEach(function(x){rx.appendChild(el('th',null,x))});hx.appendChild(rx);tx.appendChild(hx);
        var bx=el('tbody');rep.extraction.forEach(function(row){var r=el('tr');row.forEach(function(v,i){r.appendChild(el('td',(i>=2&&i<=4)?'n':null,v))});bx.appendChild(r)});tx.appendChild(bx);wx.appendChild(tx);dx.appendChild(wx);xb.appendChild(dx);bd.appendChild(xb);
      }
    }
    d.appendChild(bd);box.appendChild(d);
  });
  if(M.sel.indexOf('boq')>=0){var bq=el('div','rsec-note');bq.appendChild(el('b',null,'الكميات والتكاليف: '));bq.appendChild(document.createTextNode('جدول الكميات يصلك مستقلاً في مشروعك، بأرقامه وسطور حسابه وملف إكسل.'));box.appendChild(bq)}
  if(rep.questions&&rep.questions.length){var qb=el('div','blk');var qh=el('h4',null,'أسئلة لم يجب عنها المخطط');qh.appendChild(el('span',null,'تبقى غير موضّحة حتى تُستوفى'));qb.appendChild(qh);var ol2=el('ol','qs-l');rep.questions.forEach(function(q){ol2.appendChild(el('li',null,q))});qb.appendChild(ol2);box.appendChild(qb)}
  if(opts.rate)box.appendChild(rateBlock(opts.rate));
  var ft=el('div','rep-f');ft.appendChild(el('span',null,rep.foot||'التقرير فحص سابق للرفع، والمراجعة والاعتماد للأمانة.'));
  var lia=el('p','rep-liab','تقرير الفحص الفني أداة مساعدة سابقة للرفع، لا تحل محل المراجعة الهندسية ولا اعتماد الأمانة، والمسؤولية الهندسية والنظامية عن المخطط على المكتب أو المصمم المعدّ له.');box.appendChild(lia);ft.appendChild(el('span',null,'الملفات: '+(rep.files||'')));box.appendChild(ft);
  host.appendChild(box);
}
/* مجموعات سجل الفحص داخل القسم: بالطبقة، أو بالتخصص في الفحص الهندسي */
function groupsOf(S){
  if(S.id==='eng')return Object.keys(DISC).map(function(k){return {n:'التخصص '+DISC[k],rows:S.rows.filter(function(r){return r.R.d===k})}});
  return S.layers.map(function(id){return {n:'الطبقة '+lname(id),rows:S.rows.filter(function(r){return r.R.l===id})}});
}
function consBlock(S,bd){
  var cb=el('div','blk');
  if(!S.cons.length)cb.appendChild(el('p','muted','لم يُرصد في هذا الفحص بند اتساق.'));
  [['in','داخل الملف'],['cross','بين الملفات']].forEach(function(g){var items=S.cons.filter(function(c){return (c.kind||'in')===g[0]});if(!items.length)return;
    cb.appendChild(el('p','cons-g',g[1]));var ul=el('ul','cons-l');
    items.forEach(function(c){var li=el('li');li.id='f-cons-'+S.cons.indexOf(c);li.appendChild(el('span','cst cst-'+(c.state||'check'),CSTN[c.state]||'للتحقق'));var d=el('div');d.appendChild(el('span',null,c.what||''));if(c.where)d.appendChild(el('small',null,c.where));li.appendChild(d);ul.appendChild(li)});
    cb.appendChild(ul)});
  bd.appendChild(cb);
}

window.FQ_render=render;

/* تصدير PDF: صفحات A4 من المولد نفسه، تُرسم صوراً ثم تُجمع في ملف */
function loadScript(src){return new Promise(function(res,rej){if(document.querySelector('script[src="'+src+'"]'))return res();var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('load'))};document.head.appendChild(s)})}
var FONTCSS=null;
function fontCss(){if(FONTCSS)return FONTCSS;var t='';document.querySelectorAll('style').forEach(function(s){var m=s.textContent.match(/@font-face\{[^}]*\}/g);if(m)t+=m.join('\n')});return FONTCSS=t}
var busy=false;
function exportPdf(rep,btn,st,only){
  if(busy)return;busy=true;var old=btn.textContent;btn.disabled=true;btn.textContent='جارٍ تجهيز الملف..';st.textContent='';st.className='status pdfst';
  var host=null;
  loadScript(FQ_ASSETS+'vendor/jspdf-2.5.1.min.js').then(function(){
    return loadScript(FQ_ASSETS+'vendor/html-to-image-1.11.11.js')}).then(function(){
    return document.fonts.ready}).then(function(){
    host=document.createElement('div');host.className='pp-host';host.setAttribute('aria-hidden','true');document.body.appendChild(host);
    var pages=FQ_pages(rep,host,window.FQ_LOGO||'',only);
    var pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});var i=0;
    function next(){
      if(i>=pages.length)return Promise.resolve();
      btn.textContent='صفحة '+(i+1)+' من '+pages.length+'..';
      return window.htmlToImage.toJpeg(pages[i],{quality:0.92,pixelRatio:2,backgroundColor:'#FFFFFF',width:794,height:1123}).then(function(url){
        if(i>0)pdf.addPage('a4','p');pdf.addImage(url,'JPEG',0,0,210,297,undefined,'FAST');i++;return next()});
    }
    return next().then(function(){var sn='';if(only)SECTIONS.forEach(function(S){if(S.id===only)sn=' - '+S.n});pdf.save('تقرير الفحص الفني - '+(rep.ref||'FQ')+sn+'.pdf')});
  }).then(function(){st.textContent='نُزّل الملف.'}).catch(function(){st.className='status pdfst bad';st.textContent='تعذر تجهيز الملف. أعد المحاولة.'})
  .then(function(){if(host)host.remove();busy=false;btn.disabled=false;btn.textContent=old});
}


window.FQ={render:render,exportPdf:exportPdf,el:el};
})();
/* مولد صفحات A4 لتقرير الفحص الفني · يستخدمه التصدير في الصفحة وملف PDF العينة */
window.FQ_pages=function(rep,host,logoSrc,only){
  function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e}
  var SEVN=FQ_SEVN;
  var VD=[['ready','جاهز للرفع','لا مخالفة تمنع الرفع ولا تُعالج قبله'],['fix','يُرفع بعد العلاج','علاجها موضعي لا يغير التكوين'],['redesign','يعاد للتصميم','علاجها يغير التكوين']];
  var date=rep.date||new Date().toISOString().slice(0,10);
  var M=FQ_model(rep,only);
  var pages=[],cur=null;
  function newPage(){
    var p=el('section','pp');
    var h=el('header','pp-h');var lg=el('img','pp-logo');lg.src=(typeof FQ_ASSETS!=='undefined'?FQ_ASSETS:'')+'img/brand/logo-horizontal.svg';lg.alt='البيت بيتك';h.appendChild(lg);
    var pt=el('div','pt');pt.appendChild(el('b',null,'تقرير الفحص الفني'+(only&&M.secs[0]?' · '+M.secs[0].n:'')));pt.appendChild(el('span',null,(rep.ref||'')+' · '+date));h.appendChild(pt);p.appendChild(h);
    var c=el('div','pp-c');p.appendChild(c);
    var f=el('footer','pp-f');f.appendChild(el('span',null,'الفحص الفني · الأحساء · التقرير فحص سابق للرفع، والاعتماد للأمانة'));var fe=el('span','pp-fe');if(logoSrc){var im=el('img');im.src=logoSrc;im.alt='SAYAH';fe.appendChild(im)}var n=el('span','n');fe.appendChild(n);f.appendChild(fe);p.appendChild(f);
    host.appendChild(p);pages.push(p);cur=c;return c;
  }
  function add(b){
    if(!cur)newPage();
    cur.appendChild(b);
    if(cur.scrollHeight>cur.clientHeight+1&&cur.children.length>1){cur.removeChild(b);newPage();cur.appendChild(b)}
  }
  function blk(){return el('div','pp-b')}
  function sec(t,s){var d=el('div','pp-sec');d.appendChild(el('b',null,t));if(s)d.appendChild(el('span',null,s));return d}
  function hdr(cols,cls){var t=el('table','pp-row');var cg=el('colgroup');cls.forEach(function(c){var x=el('col',c);cg.appendChild(x)});t.appendChild(cg);var r=el('tr');cols.forEach(function(c){r.appendChild(el('th',null,c))});t.appendChild(r);return t}
  function st(r){if(!r)return['','·'];if(r.v==='ok')return['k-ok','مطابق'];if(r.v==='na')return['','لا يخص هذا المشروع'];if(r.v==='unk')return['','غير موضّح في المخطط'];if(r.v==='conflict')return['','تعارض في المرجع'];if(r.v==='style')return['','معلّق على نمط الطراز'];return['k-'+(r.sev||'major'),'مخالف · '+(SEVN[r.sev]||'')]}
  function ln(id){for(var q=0;q<LAYERS.length;q++)if(LAYERS[q].id===id)return LAYERS[q].n;return ''}

  // الافتتاح والملخص التنفيذي
  var b=blk();var tt=el('div','pp-title');tt.appendChild(el('h1',null,rep.title||'مخطط مرفوع'));tt.appendChild(el('p',null,rep.sub||''));
  var meta=el('div','meta');[['الملفات',rep.files||'',0],['المرجع',rep.ref||'',1],['التاريخ',date,1]].forEach(function(m){var s=el('span');s.appendChild(el('b',null,m[0]+': '));var v=el('bdi',null,m[1]);if(m[2])v.dir='ltr';s.appendChild(v);meta.appendChild(s)});tt.appendChild(meta);
  var isLv=rep.kind==='live'||rep.kind==='reviewed',isRv=rep.reviewed||rep.kind==='reviewed';tt.appendChild(el('span','tag'+(isLv?' live':''),isLv?(isRv?'فحص آلي · راجعه معماري':rep.auto?'فحص آلي':'فحص آلي أولي · مسودة تراجعها عين معماري'):'فحص يدوي على المرجع'));
  b.appendChild(tt);
  b.appendChild(sec(only?'ملخص القسم':'الملخص التنفيذي',only?'':M.secs.length+' أقسام مفحوصة'));
  if(M.verdict){b.appendChild(el('div','pp-vl','حكم الجاهزية للرفع · يُبنى من الاشتراطات النظامية وحدها'));
    var vd=el('div','pp-vd');VD.forEach(function(v){var d=el('div',rep.verdict===v[0]?'on':'');d.appendChild(el('b',null,v[1]));d.appendChild(el('small',null,v[2]));vd.appendChild(d)});b.appendChild(vd)}
  var sm=el('div','pp-sum1');
  if(!only)[['المطابقة',0],['جودة التصميم',1],['الفحص الهندسي',2]].forEach(function(p){var x=rep.summary&&rep.summary[p[1]];if(!x)return;var q=el('p');q.appendChild(el('b',null,p[0]+': '));q.appendChild(document.createTextNode(x));sm.appendChild(q)});
  if(!only&&rep.assumptions&&rep.assumptions.length)sm.appendChild(el('p','as','افتراضات الفحص: '+rep.assumptions.join(' · ')));
  b.appendChild(sm);
  var ch=el('div','pp-chart');ch.appendChild(FQ_chart(M.secs,true));b.appendChild(ch);add(b);
  if(M.top.length){var tb=blk();tb.appendChild(sec('أهم ما يُعالج أولاً',M.top.length+' ملاحظة'));
    M.top.slice(0,10).forEach(function(x,i){var d=el('div','pp-top');d.appendChild(el('span','sv '+x.sev,SEVN[x.sev]));var t=el('div');t.appendChild(el('b',null,x.t));t.appendChild(el('small',null,' · '+x.sec.n+(x.f?' · '+x.f:'')));d.appendChild(t);tb.appendChild(d)});
    add(tb)}

  // الأقسام
  M.secs.forEach(function(S){
    var gh=el('div','pp-grp');gh.appendChild(el('b',null,S.n));gh.appendChild(el('span',null,S.sub));
    var first=true;function head(bb){if(first){bb.appendChild(gh);first=false}}
    if(S.id==='cons'){
      if(!S.cons.length){var e0=blk();head(e0);e0.appendChild(el('p','pp-nt','لم يُرصد في هذا الفحص بند اتساق.'));add(e0)}
      S.cons.forEach(function(c){var bb=blk();head(bb);var d=el('div','pp-cons');d.appendChild(el('span','cst cst-'+(c.state||'check'),CSTN[c.state]||'للتحقق'));var t=el('div');t.appendChild(el('b',null,((c.kind||'in')==='in'?'داخل الملف':'بين الملفات')+': '));t.appendChild(document.createTextNode(c.what||''));if(c.where)t.appendChild(el('small',null,' · '+c.where));d.appendChild(t);bb.appendChild(d);add(bb)});
      return;
    }
    if(!S.fails.length){var e1=blk();head(e1);e1.appendChild(sec(S.id==='reg'?'المخالفات وعلاجاتها':'الملاحظات وعلاجاتها','لا شيء'));add(e1)}
    S.fails.forEach(function(k,i){
      var bb=blk();head(bb);if(i===0)bb.appendChild(sec(S.id==='reg'?'المخالفات وعلاجاتها':'الملاحظات وعلاجاتها',S.fails.length+' مرتبة بالدرجة'));
      var f=el('div','pp-find');f.appendChild(el('span','sv '+(k.r.sev||'major'),SEVN[k.r.sev]||'تُعالج قبل الرفع'));
      var d=el('div');var t=el('div','t',k.R.n);t.appendChild(el('code',null,k.R.c));if(k.R.d)t.appendChild(el('span','disc-tag',DISC[k.R.d]||''));d.appendChild(t);
      var dl=el('dl');[['المطلوب',k.R.r],['في المخطط',k.r.f],['العلاج',k.r.fix]].forEach(function(p){if(!p[1])return;dl.appendChild(el('dt',null,p[0]));dl.appendChild(el('dd',null,p[1]))});d.appendChild(dl);
      if(k.r.note)d.appendChild(el('p','nt','ملاحظة: '+k.r.note));d.appendChild(el('p','nt',k.R.s||''));
      f.appendChild(d);bb.appendChild(f);add(bb);
    });
    var groups=S.id==='eng'?Object.keys(DISC).map(function(k){return {n:'التخصص '+DISC[k],rows:S.rows.filter(function(r){return r.R.d===k})}}):S.layers.map(function(id){return {n:'الطبقة '+ln(id),rows:S.rows.filter(function(r){return r.R.l===id})}});
    groups.forEach(function(g){
      g.rows.forEach(function(k,i){
        var bb=blk();head(bb);
        if(i===0){bb.appendChild(sec('سجل الفحص · '+g.n,g.rows.length+' قاعدة'));bb.appendChild(hdr(['القاعدة','المطلوب','في المخطط','الحكم'],['c1','c2','c3','c4']))}
        var t=el('table','pp-row');var cg=el('colgroup');['c1','c2','c3','c4'].forEach(function(c){cg.appendChild(el('col',c))});t.appendChild(cg);
        var r=el('tr');var c1=el('td');c1.appendChild(document.createTextNode(k.R.n));c1.appendChild(el('code',null,k.R.c));r.appendChild(c1);
        r.appendChild(el('td',null,k.R.r));r.appendChild(el('td',null,k.r?k.r.f:'·'));var s=st(k.r);r.appendChild(el('td','st '+s[0],s[1]));t.appendChild(r);bb.appendChild(t);add(bb);
      });
    });
    if(S.id==='reg')(rep.extraction||[]).forEach(function(row,i){
      var bb=blk();var cls=['e1','e2','e3','e4','e5','e6'];
      if(i===0){bb.appendChild(sec('جدول الاستخراج',(rep.extraction.length)+' فراغاً'));bb.appendChild(hdr(['الدور','الفراغ','الأبعاد (م)','المساحة (م²)','الحد النظامي','الحالة'],cls))}
      var t=el('table','pp-row');var cg=el('colgroup');cls.forEach(function(c){cg.appendChild(el('col',c))});t.appendChild(cg);
      var r=el('tr');row.forEach(function(v,j){r.appendChild(el('td',(j>=2&&j<=4)?'n':null,v))});t.appendChild(r);bb.appendChild(t);add(bb);
    });
  });

  // الأسئلة وحدود التقرير
  if(!only)(rep.questions||[]).forEach(function(q,i){var bb=blk();if(i===0)bb.appendChild(sec('أسئلة لم يجب عنها المخطط','تبقى غير موضّحة حتى تُستوفى'));var d=el('div','pp-q');d.appendChild(el('span',null,String(i+1)));d.appendChild(el('div',null,q));bb.appendChild(d);add(bb)});
  if(!only&&rep.extra&&rep.extra.length){var bb=blk();bb.appendChild(sec('قاعدة مقترحة من هذا الفحص'));rep.extra.forEach(function(x){bb.appendChild(el('div','pp-nr',x.c+' · '+x.n+': '+x.r))});add(bb)}
  var lb=blk();lb.appendChild(sec('حدود التقرير'));var lm=el('div','pp-lim');
  ['تقرير الفحص الفني أداة مساعدة سابقة للرفع، لا تحل محل المراجعة الهندسية ولا اعتماد الأمانة، والمسؤولية الهندسية والنظامية عن المخطط على المكتب أو المصمم المعدّ له.','المسؤولية المهنية عن التصميم تبقى على المكتب المصمم وختمه.','دقة القياس محكومة بما في المخطط المرفوع، وما لا يُقرأ بثقة يُنقل إلى الأسئلة.','كل قاعدة بمصدرها، والموسوم «للتحقق» لم يُثبَّت رقمه من النص الأصلي بعد.'].concat(rep.foot?[rep.foot]:[]).forEach(function(x){lm.appendChild(el('div',null,x))});
  lb.appendChild(lm);add(lb);
  pages.forEach(function(p,i){p.querySelector('.pp-f .n').textContent=(i+1)+' / '+pages.length});
  return pages;
};
