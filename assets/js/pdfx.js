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
var MAX_PAGES=40,MAX_CHARS=90000,MAX_LINES=450;
function r1(x){return Math.round(x*10)/10}
function pageText(items){
  var pts=items.filter(function(it){return it.str&&it.str.trim()}).map(function(it){var t=it.transform;return {s:it.str.trim(),x:t[4],y:t[5],h:Math.hypot(t[2],t[3])||Math.hypot(t[0],t[1])}});
  pts.sort(function(a,b){return b.y-a.y||a.x-b.x});
  var lines=[],cur=null;
  pts.forEach(function(p){if(!cur||Math.abs(cur.y-p.y)>Math.max(1.5,p.h*0.4)){cur={y:p.y,t:[]};lines.push(cur)}cur.t.push(p)});
  lines.forEach(function(l){l.t.sort(function(a,b){return a.x-b.x})});
  return {pts:pts,lines:lines};
}
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
        var mx=0;P.pts.forEach(function(p){if(p.h>mx&&p.s.length>3){mx=p.h;big=p.s}});
        pages.push({page:i,items:P.pts.length,raster:isRaster,title:big,tags:tags});
        var head='## اللوحة '+i+' · مقاسها '+Math.round(vp.width)+'×'+Math.round(vp.height)+' نقطة'+(big?' · أكبر نص: '+big:'')+(isRaster?' · بلا طبقة نص (صورة ممسوحة)':'');
        var body=[];
        if(Object.keys(tags).length)body.push('رموز الفتحات وأعدادها في هذه اللوحة: '+Object.keys(tags).sort().map(function(k){return k+'×'+tags[k]}).join('، '));
        P.lines.slice(0,MAX_LINES).forEach(function(l){body.push('y'+Math.round(l.y)+': '+l.t.map(function(p){return p.s+'@'+Math.round(p.x)}).join('  '))});
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
      return {extract:{kind:'pdf',name:file.name,pages:doc.numPages,read:n,raster_pages:raster,text_pages:n-raster,tags:tagsAll,sheets:pages.map(function(p){return {page:p.page,title:p.title,raster:p.raster,items:p.items}}),text:text}};
    });
  });
}
window.BBPDF={process:process};
})();
