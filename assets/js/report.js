var FQ_ASSETS=(document.currentScript&&document.currentScript.src||'').replace(/js\/report\.js.*$/,'');
/* عرض تقرير الفحص الفني وتصديره PDF */
(function(){
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e}
var SEVN={stop:'مانعة',major:'جوهرية',minor:'تحسينية'};
var VD=[['ready','جاهز للرفع','لا مانعة ولا جوهرية'],['fix','يُرفع بعد العلاج','علاجها موضعي لا يغير التكوين'],['redesign','يعاد للتصميم','علاجها يغير التكوين']];
function stLabel(r){if(!r)return['unk','لم يُفحص'];if(r.v==='ok')return['ok','يوافق'];if(r.v==='na')return['na','لا ينطبق'];if(r.v==='unk')return['unk','لا يُحكم'];return['fail-'+(r.sev||'major'),'يخالف · '+(SEVN[r.sev]||'')]}

function allChecks(rep){
  var list=RULES.map(function(R){return {R:R,r:rep.results[R.c]||null}});
  (rep.extra||[]).forEach(function(x){list.push({R:{c:x.c,l:x.l,n:x.n,r:x.r,s:x.s},r:x})});
  return list;
}
function tally(rep){
  var t={};LAYERS.forEach(function(L){t[L.id]={stop:0,major:0,minor:0,unk:0,ok:0}});
  allChecks(rep).forEach(function(k){var r=k.r;if(!r)return;var T=t[k.R.l];if(r.v==='fail')T[r.sev||'major']++;else if(r.v==='unk')T.unk++;else if(r.v==='ok')T.ok++});
  return t;
}
function lname(id){for(var i=0;i<LAYERS.length;i++)if(LAYERS[i].id===id)return LAYERS[i].n;return ''}
var ORD={stop:0,major:1,minor:2};
function sevSort(a,b){var x=ORD[a.r.sev],y=ORD[b.r.sev];return (x==null?1:x)-(y==null?1:y)||a.R.l-b.R.l}

function render(rep,host){
  host.innerHTML='';
  var box=el('article','rep');
  var h=el('div','rep-h');var hl=el('div');
  hl.appendChild(el('p','eyb','تقرير الفحص الفني'));
  hl.appendChild(el('h3',null,rep.title||'مخطط مرفوع'));
  hl.appendChild(el('p','sub',rep.sub||''));
  var hr=el('div');hr.style.textAlign='left';
  hr.appendChild(el('span','badge'+(rep.kind==='live'?' live':''),rep.kind==='live'?'فحص آلي · مسودة تراجعها عين معماري':'عينة · فحص يدوي على المرجع'));
  var m=el('p','mono',(rep.ref||'')+' · '+(rep.date||new Date().toISOString().slice(0,10)));m.style.marginTop='6px';hr.appendChild(m);
  var pb=el('button','btn sm pdfbtn','تنزيل التقرير PDF');pb.type='button';var ps=el('p','status pdfst');pb.addEventListener('click',function(){exportPdf(rep,pb,ps)});hr.appendChild(pb);hr.appendChild(ps);
  h.appendChild(hl);h.appendChild(hr);box.appendChild(h);

  var vl=el('div','vlabel');vl.appendChild(el('b',null,'حكم المطابقة'));vl.appendChild(el('span',null,'يُبنى من فحص المطابقة وحده'));box.appendChild(vl);
  var vd=el('div','vd');
  VD.forEach(function(v){var d=el('div',rep.verdict===v[0]?'on':'');d.appendChild(el('b',null,v[1]));d.appendChild(el('small',null,v[2]));vd.appendChild(d)});
  box.appendChild(vd);

  var t=tally(rep);
  var body=el('div','rep-body');
  var sm=el('div','summary');
  GROUPS.forEach(function(G,i){if(rep.summary&&rep.summary[i]){var p=el('p');p.appendChild(el('b',null,G.n+': '));p.appendChild(document.createTextNode(rep.summary[i]));sm.appendChild(p)}});
  if(rep.assumptions&&rep.assumptions.length){var a=el('p','assume');a.appendChild(el('b',null,'افتراضات الفحص: '));a.appendChild(document.createTextNode(rep.assumptions.join(' · ')));sm.appendChild(a)}
  body.appendChild(sm);
  var tb=el('table','tl'),th=el('thead'),tr=el('tr');
  ['','مانعة','جوهرية','تحسينية','لا يُحكم'].forEach(function(x,i){tr.appendChild(el('th',['','c-stop','c-major','c-minor',''][i],x))});th.appendChild(tr);tb.appendChild(th);
  var tbd=el('tbody');
  GROUPS.forEach(function(G){
    var gr=el('tr','grp');var gc=el('th',null,G.n);gc.colSpan=5;gr.appendChild(gc);tbd.appendChild(gr);
    G.layers.forEach(function(id){var r=el('tr');r.appendChild(el('td',null,lname(id)));['stop','major','minor','unk'].forEach(function(k){var n=t[id][k];var na=(k==='stop'&&G.id==='qual');r.appendChild(el('td',na?'z':(n?'c-'+k:'z'),na?'·':String(n)))});tbd.appendChild(r)});
  });
  tb.appendChild(tbd);var tw=el('div');tw.appendChild(tb);body.appendChild(tw);box.appendChild(body);

  var all=allChecks(rep);
  GROUPS.forEach(function(G){
    var gb=el('div','grp-h');gb.appendChild(el('h4',null,G.n));gb.appendChild(el('span',null,G.sub));box.appendChild(gb);
    var rows=all.filter(function(k){return G.layers.indexOf(k.R.l)>=0});
    var fails=rows.filter(function(k){return k.r&&k.r.v==='fail'}).sort(sevSort);
    var fb=el('div','blk');var fh=el('h4',null,G.id==='comp'?'المخالفات وعلاجاتها':'الملاحظات وعلاجاتها');fh.appendChild(el('span',null,fails.length+(G.id==='comp'?' مخالفة مرتبة بالدرجة':' ملاحظة مرتبة بالدرجة')));fb.appendChild(fh);
    if(!fails.length)fb.appendChild(el('p','muted','لا شيء.'));
    fails.forEach(function(k){
      var f=el('div','find');f.appendChild(el('span','sevtag '+(k.r.sev||'major'),SEVN[k.r.sev]||'جوهرية'));
      var d=el('div');var tt=el('div','t',k.R.n);tt.appendChild(el('code',null,k.R.c));d.appendChild(tt);
      var dl=el('dl');[['المطلوب',k.R.r,''],['في المخطط',k.r.f,''],['العلاج',k.r.fix||'','fix']].forEach(function(p){if(!p[1])return;dl.appendChild(el('dt',null,p[0]));dl.appendChild(el('dd',p[2]||null,p[1]))});
      d.appendChild(dl);if(k.r.note)d.appendChild(el('p','note','ملاحظة: '+k.r.note));d.appendChild(el('p','note',k.R.s||''));
      f.appendChild(d);fb.appendChild(f);
    });
    box.appendChild(fb);
    var lb=el('div','blk');var lh=el('h4',null,'سجل الفحص الكامل');lh.appendChild(el('span',null,'كل قاعدة وما وُجد في المخطط'));lb.appendChild(lh);
    G.layers.forEach(function(id){
      var lr=rows.filter(function(k){return k.R.l===id});var c=t[id];
      var dt=el('details','lay');var su=el('summary');su.appendChild(el('span',null,'الطبقة '+lname(id)));
      var cn=el('span','cnts');cn.appendChild(el('span','c-ok','✓ '+c.ok));['stop','major','minor'].forEach(function(s){if(c[s])cn.appendChild(el('span','c-'+s,'✗ '+c[s]))});if(c.unk)cn.appendChild(el('span',null,'؟ '+c.unk));
      su.appendChild(cn);dt.appendChild(su);
      var w=el('div','chk-wrap'),tb2=el('table','chk'),hd=el('thead'),hr2=el('tr');
      ['القاعدة','المطلوب','في المخطط','الحكم'].forEach(function(x){hr2.appendChild(el('th',null,x))});hd.appendChild(hr2);tb2.appendChild(hd);
      var bd=el('tbody');
      lr.forEach(function(k){var r=el('tr');var c1=el('td');c1.appendChild(document.createTextNode(k.R.n));c1.appendChild(el('code',null,k.R.c));r.appendChild(c1);
        r.appendChild(el('td',null,k.R.r));r.appendChild(el('td',null,k.r?k.r.f:'·'));var s=stLabel(k.r);r.appendChild(el('td','st '+s[0],s[1]));bd.appendChild(r)});
      tb2.appendChild(bd);w.appendChild(tb2);dt.appendChild(w);lb.appendChild(dt);
    });
    box.appendChild(lb);
  });

  if(rep.extraction&&rep.extraction.length){
    var xb=el('div','blk');var dx=el('details','lay');var sx=el('summary');sx.appendChild(el('span',null,'جدول الاستخراج'));sx.appendChild(el('span','cnts',rep.extraction.length+' فراغاً'));dx.appendChild(sx);
    var wx=el('div','chk-wrap'),tx=el('table','ext-t'),hx=el('thead'),rx=el('tr');['الدور','الفراغ','الأبعاد (م)','المساحة (م²)','الحد النظامي','الحالة'].forEach(function(x){rx.appendChild(el('th',null,x))});hx.appendChild(rx);tx.appendChild(hx);
    var bx=el('tbody');rep.extraction.forEach(function(row){var r=el('tr');row.forEach(function(v,i){r.appendChild(el('td',(i>=2&&i<=4)?'n':null,v))});bx.appendChild(r)});tx.appendChild(bx);wx.appendChild(tx);dx.appendChild(wx);xb.appendChild(dx);box.appendChild(xb);
  }
  if(rep.questions&&rep.questions.length){var qb=el('div','blk');var qh=el('h4',null,'أسئلة لم يجب عنها المخطط');qh.appendChild(el('span',null,'لا يُحكم عليها حتى تُستوفى'));qb.appendChild(qh);var ol=el('ol','qs-l');rep.questions.forEach(function(q){ol.appendChild(el('li',null,q))});qb.appendChild(ol);box.appendChild(qb)}
  if(rep.extra&&rep.extra.length){var nb=el('div','blk');nb.appendChild(el('h4',null,'قاعدة مقترحة من هذا الفحص'));rep.extra.forEach(function(x){nb.appendChild(el('p','newrule',x.c+' · '+x.n+': '+x.r))});box.appendChild(nb)}
  var ft=el('div','rep-f');ft.appendChild(el('span',null,rep.foot||'التقرير فحص سابق للرفع، والمراجعة والاعتماد للأمانة.'));ft.appendChild(el('span',null,'الملفات: '+(rep.files||'')));box.appendChild(ft);
  host.appendChild(box);
}

window.FQ_render=render;

/* تصدير PDF: صفحات A4 من المولد نفسه، تُرسم صوراً ثم تُجمع في ملف */
function loadScript(src){return new Promise(function(res,rej){if(document.querySelector('script[src="'+src+'"]'))return res();var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('load'))};document.head.appendChild(s)})}
var FONTCSS=null;
function fontCss(){if(FONTCSS)return FONTCSS;var t='';document.querySelectorAll('style').forEach(function(s){var m=s.textContent.match(/@font-face\{[^}]*\}/g);if(m)t+=m.join('\n')});return FONTCSS=t}
var busy=false;
function exportPdf(rep,btn,st){
  if(busy)return;busy=true;var old=btn.textContent;btn.disabled=true;btn.textContent='جارٍ تجهيز الملف..';st.textContent='';st.className='status pdfst';
  var host=null;
  loadScript(FQ_ASSETS+'vendor/jspdf-2.5.1.min.js').then(function(){
    return loadScript(FQ_ASSETS+'vendor/html-to-image-1.11.11.js')}).then(function(){
    return document.fonts.ready}).then(function(){
    host=document.createElement('div');host.className='pp-host';host.setAttribute('aria-hidden','true');document.body.appendChild(host);
    var pages=FQ_pages(rep,host,window.FQ_LOGO||'');
    var pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});var i=0;
    function next(){
      if(i>=pages.length)return Promise.resolve();
      btn.textContent='صفحة '+(i+1)+' من '+pages.length+'..';
      return window.htmlToImage.toJpeg(pages[i],{quality:0.92,pixelRatio:2,backgroundColor:'#FFFFFF',width:794,height:1123}).then(function(url){
        if(i>0)pdf.addPage('a4','p');pdf.addImage(url,'JPEG',0,0,210,297,undefined,'FAST');i++;return next()});
    }
    return next().then(function(){pdf.save('تقرير الفحص الفني - '+(rep.ref||'FQ')+'.pdf')});
  }).then(function(){st.textContent='نُزّل الملف.'}).catch(function(){st.className='status pdfst bad';st.textContent='تعذر تجهيز الملف. أعد المحاولة.'})
  .then(function(){if(host)host.remove();busy=false;btn.disabled=false;btn.textContent=old});
}


window.FQ={render:render,exportPdf:exportPdf,el:el};
})();
/* مولد صفحات A4 لتقرير الفحص الفني · يستخدمه التصدير في الصفحة وملف PDF العينة */
window.FQ_pages=function(rep,host,logoSrc){
  function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e}
  var SEVN={stop:'مانعة',major:'جوهرية',minor:'تحسينية'};
  var VD=[['ready','جاهز للرفع','لا مانعة ولا جوهرية'],['fix','يُرفع بعد العلاج','علاجها موضعي لا يغير التكوين'],['redesign','يعاد للتصميم','علاجها يغير التكوين']];
  var date=rep.date||new Date().toISOString().slice(0,10);
  var checks=RULES.map(function(R){return {R:R,r:rep.results[R.c]||null}});
  (rep.extra||[]).forEach(function(x){checks.push({R:{c:x.c,l:x.l,n:x.n,r:x.r,s:x.s},r:x})});
  var pages=[],cur=null;
  function newPage(){
    var p=el('section','pp');
    var h=el('header','pp-h');h.appendChild(el('b','pp-bn','البيت بيتك'));
    var pt=el('div','pt');pt.appendChild(el('b',null,'تقرير الفحص الفني'));pt.appendChild(el('span',null,(rep.ref||'')+' · '+date));h.appendChild(pt);p.appendChild(h);
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

  // الافتتاح
  var b=blk();var tt=el('div','pp-title');tt.appendChild(el('h1',null,rep.title||'مخطط مرفوع'));tt.appendChild(el('p',null,rep.sub||''));
  var meta=el('div','meta');[['الملفات',rep.files||'',0],['المرجع',rep.ref||'',1],['التاريخ',date,1]].forEach(function(m){var s=el('span');s.appendChild(el('b',null,m[0]+': '));var v=el('bdi',null,m[1]);if(m[2])v.dir='ltr';s.appendChild(v);meta.appendChild(s)});tt.appendChild(meta);
  tt.appendChild(el('span','tag'+(rep.kind==='live'?' live':''),rep.kind==='live'?'فحص آلي أولي · مسودة تراجعها عين معماري':'فحص يدوي على المرجع'));
  b.appendChild(tt);
  b.appendChild(el('div','pp-vl','حكم المطابقة · يُبنى من فحص المطابقة وحده'));
  var vd=el('div','pp-vd');VD.forEach(function(v){var d=el('div',rep.verdict===v[0]?'on':'');d.appendChild(el('b',null,v[1]));d.appendChild(el('small',null,v[2]));vd.appendChild(d)});b.appendChild(vd);
  var sm=el('div','pp-sum');var l=el('div');
  GROUPS.forEach(function(G,i){if(rep.summary&&rep.summary[i]){var p=el('p');p.appendChild(el('b',null,G.n+': '));p.appendChild(document.createTextNode(rep.summary[i]));l.appendChild(p)}});
  if(rep.assumptions&&rep.assumptions.length)l.appendChild(el('p','as','افتراضات الفحص: '+rep.assumptions.join(' · ')));sm.appendChild(l);
  var T={};LAYERS.forEach(function(L){T[L.id]={stop:0,major:0,minor:0,unk:0}});
  checks.forEach(function(k){if(!k.r)return;if(k.r.v==='fail')T[k.R.l][k.r.sev||'major']++;else if(k.r.v==='unk')T[k.R.l].unk++});
  function ln(id){for(var q=0;q<LAYERS.length;q++)if(LAYERS[q].id===id)return LAYERS[q].n;return ''}
  var tb=el('table','pp-tl'),th=el('thead'),tr=el('tr');['','مانعة','جوهرية','تحسينية','لا يُحكم'].forEach(function(x,i){tr.appendChild(el('th',['','k-stop','k-major','k-minor',''][i],x))});th.appendChild(tr);tb.appendChild(th);
  var bd=el('tbody');
  GROUPS.forEach(function(G){var gr=el('tr','g');var gc=el('td',null,G.n);gc.colSpan=5;gr.appendChild(gc);bd.appendChild(gr);
    G.layers.forEach(function(id){var r=el('tr');r.appendChild(el('td',null,ln(id)));['stop','major','minor','unk'].forEach(function(k){var n=T[id][k];var na=(k==='stop'&&G.id==='qual');r.appendChild(el('td',na?'k-z':(n?(k==='unk'?'':'k-'+k):'k-z'),na?'·':String(n)))});bd.appendChild(r)})});
  tb.appendChild(bd);sm.appendChild(tb);b.appendChild(sm);add(b);

  function hdr(cols,cls){var t=el('table','pp-row');var cg=el('colgroup');cls.forEach(function(c){var x=el('col',c);cg.appendChild(x)});t.appendChild(cg);var r=el('tr');cols.forEach(function(c){r.appendChild(el('th',null,c))});t.appendChild(r);return t}
  function st(r){if(!r)return['','·'];if(r.v==='ok')return['k-ok','يوافق'];if(r.v==='na')return['','لا ينطبق'];if(r.v==='unk')return['','لا يُحكم'];return['k-'+(r.sev||'major'),'يخالف · '+(SEVN[r.sev]||'')]}
  var ord={stop:0,major:1,minor:2};
  GROUPS.forEach(function(G){
    var gh=blk();gh.appendChild(el('div','pp-grp',''));gh.lastChild.appendChild(el('b',null,G.n));gh.lastChild.appendChild(el('span',null,G.sub));
    var rows=checks.filter(function(k){return G.layers.indexOf(k.R.l)>=0});
    var fails=rows.filter(function(k){return k.r&&k.r.v==='fail'});
    fails.sort(function(a,c){var x=ord[a.r.sev],y=ord[c.r.sev];return (x==null?1:x)-(y==null?1:y)||a.R.l-c.R.l});
    var first=true;
    function head(bb){if(first){bb.appendChild(gh.firstChild);first=false}}
    fails.forEach(function(k,i){
      var bb=blk();head(bb);if(i===0)bb.appendChild(sec(G.id==='comp'?'المخالفات وعلاجاتها':'الملاحظات وعلاجاتها',fails.length+(G.id==='comp'?' مخالفة مرتبة بالدرجة':' ملاحظة مرتبة بالدرجة')));
      var f=el('div','pp-find');f.appendChild(el('span','sv '+(k.r.sev||'major'),SEVN[k.r.sev]||'جوهرية'));
      var d=el('div');var t=el('div','t',k.R.n);t.appendChild(el('code',null,k.R.c));d.appendChild(t);
      var dl=el('dl');[['المطلوب',k.R.r],['في المخطط',k.r.f],['العلاج',k.r.fix]].forEach(function(p){if(!p[1])return;dl.appendChild(el('dt',null,p[0]));dl.appendChild(el('dd',null,p[1]))});d.appendChild(dl);
      if(k.r.note)d.appendChild(el('p','nt','ملاحظة: '+k.r.note));d.appendChild(el('p','nt',k.R.s||''));
      f.appendChild(d);bb.appendChild(f);add(bb);
    });
    G.layers.forEach(function(id){
      var lr=rows.filter(function(k){return k.R.l===id});
      lr.forEach(function(k,i){
        var bb=blk();head(bb);
        if(i===0){bb.appendChild(sec('سجل الفحص · الطبقة '+ln(id),lr.length+' قاعدة'));bb.appendChild(hdr(['القاعدة','المطلوب','في المخطط','الحكم'],['c1','c2','c3','c4']))}
        var t=el('table','pp-row');var cg=el('colgroup');['c1','c2','c3','c4'].forEach(function(c){cg.appendChild(el('col',c))});t.appendChild(cg);
        var r=el('tr');var c1=el('td');c1.appendChild(document.createTextNode(k.R.n));c1.appendChild(el('code',null,k.R.c));r.appendChild(c1);
        r.appendChild(el('td',null,k.R.r));r.appendChild(el('td',null,k.r?k.r.f:'·'));var s=st(k.r);r.appendChild(el('td','st '+s[0],s[1]));t.appendChild(r);bb.appendChild(t);add(bb);
      });
    });
  });

  // الاستخراج
  (rep.extraction||[]).forEach(function(row,i){
    var bb=blk();var cls=['e1','e2','e3','e4','e5','e6'];
    if(i===0){bb.appendChild(sec('جدول الاستخراج',(rep.extraction.length)+' فراغاً'));bb.appendChild(hdr(['الدور','الفراغ','الأبعاد (م)','المساحة (م²)','الحد النظامي','الحالة'],cls))}
    var t=el('table','pp-row');var cg=el('colgroup');cls.forEach(function(c){cg.appendChild(el('col',c))});t.appendChild(cg);
    var r=el('tr');row.forEach(function(v,j){r.appendChild(el('td',(j>=2&&j<=4)?'n':null,v))});t.appendChild(r);bb.appendChild(t);add(bb);
  });

  // الأسئلة
  (rep.questions||[]).forEach(function(q,i){var bb=blk();if(i===0)bb.appendChild(sec('أسئلة لم يجب عنها المخطط','لا يُحكم عليها حتى تُستوفى'));var d=el('div','pp-q');d.appendChild(el('span',null,String(i+1)));d.appendChild(el('div',null,q));bb.appendChild(d);add(bb)});
  if(rep.extra&&rep.extra.length){var bb=blk();bb.appendChild(sec('قاعدة مقترحة من هذا الفحص'));rep.extra.forEach(function(x){bb.appendChild(el('div','pp-nr',x.c+' · '+x.n+': '+x.r))});add(bb)}
  var lb=blk();lb.appendChild(sec('حدود التقرير'));var lm=el('div','pp-lim');
  ['التقرير فحص سابق للرفع، والمراجعة والاعتماد للأمانة وحدها.','المسؤولية المهنية عن التصميم تبقى على المكتب المصمم وختمه.','دقة القياس محكومة بما في المخطط المرفوع، وما لا يُقرأ بثقة يُنقل إلى الأسئلة.','كل قاعدة بمصدرها، والموسوم «للتحقق» لم يُثبَّت رقمه من النص الأصلي بعد.'].concat(rep.foot?[rep.foot]:[]).forEach(function(x){lm.appendChild(el('div',null,x))});
  lb.appendChild(lm);add(lb);
  pages.forEach(function(p,i){p.querySelector('.pp-f .n').textContent=(i+1)+' / '+pages.length});
  return pages;
};
