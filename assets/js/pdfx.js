/* قراءة طبقة النص في ملفات PDF المصدّرة من برامج الرسم: الأبعاد المكتوبة، وأسماء الفراغات ومساحاتها،
   ورموز الأبواب والنوافذ وأعدادها في كل لوحة، والجداول. تجري في متصفح المكتب عند الرفع، وتُرفع مع الطلب
   فيقرؤها الفحص وجداول الكميات أرقاماً لا صوراً. ملف PDF الممسوح ضوئياً (صور فقط) يُعلَّم بذلك.
   يعتمد على مكتبة pdf.js (assets/vendor). */
(function(){
var BASE=(document.currentScript&&document.currentScript.src||'').replace(/js\/pdfx\.js.*$/,'');
var LIB=BASE+'vendor/pdfjs-3.11.174.min.js',WORKER=BASE+'vendor/pdfjs-3.11.174.worker.min.js';
var loading=null;
function load(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(loading)return loading;
  loading=new Promise(function(res,rej){var s=document.createElement('script');s.src=LIB;s.onload=function(){window.pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER;res(window.pdfjsLib)};s.onerror=function(){loading=null;rej(new Error('pdfjs_load'))};document.head.appendChild(s)});
  return loading;
}
var TAG=/^(D|W|G|DW|WD|SD|V|GD|WN|DR)[-\s.]?\d{1,2}[A-Z]?$/i;
var SHEET_AR={elevation:'واجهة',section:'قطاع',site:'موقع عام',roof:'مسقط سطح',plan:'مسقط',detail:'تفاصيل'};
var SHEET_RX=[['elevation',/واجهة|واجهه|ELEVATION/i],['section',/قطاع|مقطع|SECTION/i],['site',/موقع عام|الموقع العام|SITE\s*PLAN|LAYOUT\s*PLAN/i],['roof',/مسقط السطح|مسقط سطح|ROOF\s*PLAN/i],['plan',/مسقط|الدور|الطابق|الملحق|القبو|البدروم|PLAN|FLOOR/i],['detail',/تفصيل|تفاصيل|DETAIL/i]];
var MAX_PAGES=40,MAX_CHARS=90000,MAX_LINES=450;
function r1(x){return Math.round(x*10)/10}
var AR=/[؀-ۿ]/;
/* برامج الرسم تصدّر النص العربي حروفاً متفرقة بأشكالها المتصلة وبترتيب بصري؛ نعيدها حروفاً عادية ونجمع السطر من اليمين */
function norm(s){try{return s.normalize('NFKC')}catch(e){return s}}
function pageText(items){
  var pts=items.filter(function(it){return it.str&&it.str.trim()}).map(function(it){var t=it.transform;return {s:norm(it.str.trim()),x:t[4],y:t[5],w:it.width||0,h:Math.hypot(t[2],t[3])||Math.hypot(t[0],t[1])}});
  pts.sort(function(a,b){return b.y-a.y||a.x-b.x});
  var lines=[],cur=null;
  pts.forEach(function(p){if(!cur||Math.abs(cur.y-p.y)>Math.max(1.5,p.h*0.4)){cur={y:p.y,t:[]};lines.push(cur)}cur.t.push(p)});
  lines.forEach(function(l){
    l.t.sort(function(a,b){return a.x-b.x});l.h=Math.max.apply(null,l.t.map(function(p){return p.h}));
    /* مقاطع السطر: ما تقارب من النصوص يُجمع كلمة أو عبارة، وما تباعد يبقى مقطعاً مستقلاً */
    var segs=[],sg=null;
    l.t.forEach(function(p){var gap=sg?p.x-sg.x1:1e9;if(!sg||gap>p.h*1.5){sg={t:[],x0:p.x,x1:p.x+p.w};segs.push(sg)}sg.t.push({p:p,gap:gap});sg.x1=Math.max(sg.x1,p.x+p.w)});
    l.segs=segs.map(function(g){
      var rtl=g.t.some(function(o){return AR.test(o.p.s)}),parts=g.t.slice();
      var txt='';if(rtl){parts.reverse();parts.forEach(function(o,i){var nx=parts[i-1];var gap=nx?nx.p.x-(o.p.x+o.p.w):0;txt+=(i&&gap>o.p.h*0.25?' ':'')+o.p.s})}
      else parts.forEach(function(o,i){txt+=(i&&o.gap>o.p.h*0.25?' ':'')+o.p.s});
      return {s:txt.replace(/\s+/g,' ').trim(),x:Math.round(g.x0),h:Math.max.apply(null,g.t.map(function(o){return o.p.h}))};
    });
  });
  return {pts:pts,lines:lines};
}
/* المنسوب قد يُقرأ بإشارته في آخره (3.60+) بسبب ترتيب العرض؛ يُعاد بإشارته في أوله */
function level(s){var m=String(s).replace(/\s+/g,'').match(/^([+\-±])(\d{1,2}[.,]\d{2})$|^(\d{1,2}[.,]\d{2})([+\-±])$/);return m?(m[1]?m[1]+m[2]:m[4]+m[3]):null}
function process(file){
  return load().then(function(lib){return file.arrayBuffer().then(function(buf){return lib.getDocument({data:new Uint8Array(buf),isEvalSupported:false}).promise})})
  .then(function(doc){
    var n=Math.min(doc.numPages,MAX_PAGES),out=[],tagsAll={},raster=0,chars=0,pages=[];
    var chain=Promise.resolve();
    for(var i=1;i<=n;i++)(function(i){chain=chain.then(function(){return doc.getPage(i)}).then(function(pg){
      var vp=pg.getViewport({scale:1});
      return pg.getTextContent().then(function(tc){
        var P=pageText(tc.items),tags={},big='';
        P.pts.forEach(function(p){var s=p.s.replace(/\s+/g,'');if(TAG.test(s)){var k=s.toUpperCase().replace(/[-.]/g,'');tags[k]=(tags[k]||0)+1;tagsAll[k]=(tagsAll[k]||0)+1}});
        var isRaster=P.pts.length<5;if(isRaster)raster++;
        /* عنوان اللوحة المحتمل: أكبر نص فيها */
        var segs=[];P.lines.forEach(function(l){l.segs.forEach(function(g){segs.push(g)})});
        var mx=0;segs.forEach(function(g){if(g.h>mx&&g.s.length>3&&!level(g.s)){mx=g.h;big=g.s}});
        /* نوع اللوحة من أكبر نصوصها، ومناسيبها المكتوبة؛ للمطابقة مع ملف الرسم */
        var type=null,tt='';segs.filter(function(g){return g.s.length>=3&&g.s.length<=60}).sort(function(a,b){return b.h-a.h}).slice(0,12).some(function(g){for(var r=0;r<SHEET_RX.length;r++)if(SHEET_RX[r][1].test(g.s)){type=SHEET_RX[r][0];tt=g.s;return true}return false});
        var lv=[];segs.forEach(function(g){var v=level(g.s);if(v)lv.push(v)});
        pages.push({page:i,items:P.pts.length,raster:isRaster,title:big,tags:tags,type:type,typeTitle:tt,levels:lv});
        var head='## اللوحة '+i+' · مقاسها '+Math.round(vp.width)+'×'+Math.round(vp.height)+' نقطة'+(big?' · أكبر نص: '+big:'')+(type?' · نوعها: '+SHEET_AR[type]:'')+(isRaster?' · بلا طبقة نص (صورة ممسوحة)':'');
        var body=[];
        if(Object.keys(tags).length)body.push('رموز الفتحات وأعدادها في هذه اللوحة: '+Object.keys(tags).sort().map(function(k){return k+'×'+tags[k]}).join('، '));
        P.lines.slice(0,MAX_LINES).forEach(function(l){body.push('y'+Math.round(l.y)+': '+l.segs.map(function(g){var v=level(g.s);return (v||g.s)+'@'+g.x}).join('  '))});
        if(P.lines.length>MAX_LINES)body.push('(اختُصرت '+(P.lines.length-MAX_LINES)+' سطراً)');
        var txt=head+'\n'+body.join('\n');
        if(chars+txt.length>MAX_CHARS){txt=txt.slice(0,Math.max(0,MAX_CHARS-chars))+'\n(اقتُطع بقية النص لطوله)'}
        chars+=txt.length;out.push(txt);pg.cleanup();
      });
    })})(i);
    return chain.then(function(){
      var text='استخراج آلي من طبقة النص في ملف PDF «'+file.name+'» ('+doc.numPages+' لوحة'+(doc.numPages>n?'، قُرئت أول '+n:'')+'). كل سطر: الارتفاع على اللوحة y، ثم كل نص وموضعه الأفقي @x بنقاط PDF. النصوص المتجاورة على السطر نفسه تخص العنصر نفسه غالباً (اسم فراغ ومساحته، أو بُعد وقيمته).\n'+
        (Object.keys(tagsAll).length?'مجموع رموز الفتحات في كل اللوحات (تشمل تكرارها في الجداول والواجهات، فالعدد الفعلي من المساقط): '+Object.keys(tagsAll).sort().map(function(k){return k+'×'+tagsAll[k]}).join('، ')+'\n':'')+
        (raster?raster+' من '+n+' لوحة بلا طبقة نص، فهي صور تُقرأ بالنظر فقط.\n':'')+'\n'+out.join('\n\n');
      return {extract:{kind:'pdf',name:file.name,pages:doc.numPages,read:n,raster_pages:raster,text_pages:n-raster,tags:tagsAll,sheets:pages.map(function(p){return {page:p.page,title:p.title,raster:p.raster,items:p.items,tags:p.tags,type:p.type,typeTitle:p.typeTitle,levels:p.levels}}),text:text}};
    });
  });
}
window.BBPDF={process:process};
})();
