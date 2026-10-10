/* مسقط بيتك: البيت على مسقطه غرفةً غرفة. الغرف من ملف DXF أو مرسومة فوق خلفية PDF أو صورة أو على شبكة فارغة.
   لكل غرفة: تشطيباتها من المرجع السكني بدرجة البيت، وأجهزتها ومواعيد صيانتها من مرجع الصيانة،
   وصور ما خلف جدرانها (مجلد المستخدم في التخزين)، وسجلها. الإحداثيات بالمتر، والمحور الصادي إلى أعلى */
TK.ready(function(){
'use strict';
var el=TK.el,$=TK.$;
var BASE=(document.querySelector('script[src*="assets/js/homeplan.js"]')||{}).src.replace(/assets\/js\/homeplan\.js.*$/,'');
var NS='http://www.w3.org/2000/svg';
function sv(t,a,p){var e=document.createElementNS(NS,t);for(var k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e}
function today(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function addMonths(iso,m){var d=new Date(iso+'T00:00:00');var days=Math.round(m*30.4375);d.setDate(d.getDate()+days);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function daysTo(iso){return Math.round((new Date(iso+'T00:00:00')-new Date(today()+'T00:00:00'))/864e5)}
var RX=/^\d{4}-\d{2}-\d{2}$/;
function uid(p){return (p||'r')+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function r2(n){return Math.round(n*100)/100}
function fmt(n,d){return TK.fmt(n,d==null?2:d)}
function cnt(k,f){k=+k;return k===1?f[0]:k===2?f[1]:(k>=3&&k<=10)?k+' '+f[2]:k+' '+f[3]}

/* ===== الهندسة ===== */
function pArea(p){var a=0;for(var i=0,n=p.length;i<n;i++){var j=(i+1)%n;a+=p[i][0]*p[j][1]-p[j][0]*p[i][1]}return Math.abs(a)/2}
function pPer(p){var s=0;for(var i=0,n=p.length;i<n;i++){var j=(i+1)%n;s+=Math.hypot(p[j][0]-p[i][0],p[j][1]-p[i][1])}return s}
function pCen(p){var a=0,cx=0,cy=0;for(var i=0,n=p.length;i<n;i++){var j=(i+1)%n,f=p[i][0]*p[j][1]-p[j][0]*p[i][1];a+=f;cx+=(p[i][0]+p[j][0])*f;cy+=(p[i][1]+p[j][1])*f}
  if(Math.abs(a)<1e-9){var b=pBox(p);return [(b[0]+b[2])/2,(b[1]+b[3])/2]}a*=3;return [cx/a,cy/a]}
function pBox(p){var b=[1/0,1/0,-1/0,-1/0];p.forEach(function(q){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1])});return b}
function clean(p){var o=p.slice();if(o.length>2&&o[0][0]===o[o.length-1][0]&&o[0][1]===o[o.length-1][1])o.pop();return o}
/* طول وعرض مكافئان يحفظان مساحة الغرفة ومحيطها، لمعادلات الحزم */
function equivLW(p){var A=pArea(p),P=pPer(p),s=P/2,d=s*s-4*A;if(d>=0){var L=(s+Math.sqrt(d))/2;return [r2(L),r2(A/L)]}var b=pBox(p);return [r2(b[2]-b[0]),r2(b[3]-b[1])]}

/* ===== أنواع الغرف ===== */
var TYPES=[['master','غرفة نوم رئيسية',['رئيسية','ماستر','master']],['bedroom','غرفة نوم',['نوم','bed']],['majlis','مجلس',['مجلس','majlis']],['living','صالة معيشة',['صالة','معيشة','جلوس','living']],
 ['dining','طعام',['طعام','سفرة','dining']],['kitchen','مطبخ',['مطبخ','kitchen']],['bath','حمام كامل',['حمام','bath']],['wc','حمام ضيوف',['ضيوف','مغاسل','wc','toilet']],['laundry','غرفة غسيل',['غسيل','laundry']],
 ['hall','ممر أو بهو',['ممر','بهو','موزع','مدخل','lobby','hall','corridor']],['stairs','درج',['درج','سلم','stair']],['maid','غرفة خادمة أو سائق',['خادمة','سائق','maid','driver']],
 ['roof','سطح',['سطح','roof']],['yard','فناء خارجي',['حوش','فناء','حديقة','yard']],['garage','مواقف أو مرآب',['موقف','مواقف','مرآب','كراج','garage','parking']],['storage','مخزن',['مخزن','مستودع','store']],['other','فراغ آخر',[]]];
var TN={};TYPES.forEach(function(t){TN[t[0]]=t[1]});
function guessType(name){var n=String(name||'').toLowerCase();
  if(/حمام/.test(n)&&/ضيوف|مغاسل/.test(n))return 'wc';if(/نوم/.test(n)&&/رئيس|ماستر/.test(n))return 'master';
  for(var i=0;i<TYPES.length;i++)for(var j=0;j<TYPES[i][2].length;j++)if(n.indexOf(TYPES[i][2][j].toLowerCase())>=0)return TYPES[i][0];return 'other'}

/* ===== الأجهزة: كل نوع مربوط بأعمال مرجع الصيانة (refs/guide/maintenance.json) ===== */
var KINDS=[['ac_split','مكيف جداري (سبليت)',['ac-filter','ac-service','ac-drain']],['ac_ducted','مكيف مخفي بمجاري هواء',['ac-ducted-filter','ac-service','ac-drain']],
 ['heater','سخان ماء',['water-heater-valve','water-heater-service']],['smoke','كاشف دخان',['safe-smoke-test','safe-smoke-battery','safe-smoke-replace']],
 ['ext','طفاية حريق',['safe-ext-check','safe-ext-service']],['hood','شفاط المطبخ',['app-hood']],['washer','غسالة ملابس',['app-washer']],
 ['panel','لوحة الكهرباء',['elec-rcd','elec-panel']],['drain','مصرف أرضي',['plumb-drains']],['pump','مضخة رفع الضغط',['water-booster']],
 ['filter','فلتر ماء',['water-filter']],['gas','أسطوانة الغاز وخرطومها',['safe-gas-hose']],['roofd','مصارف السطح',['roof-drains','roof-inspect']],['other','جهاز آخر',[]]];
var KN={},KT={};KINDS.forEach(function(k){KN[k[0]]=k[1];KT[k[0]]=k[2]});
var SUGGEST={master:['ac_split','smoke'],bedroom:['ac_split','smoke'],majlis:['ac_split'],living:['ac_split','smoke'],dining:['ac_split'],kitchen:['hood','ext','gas'],
 bath:['heater','drain'],wc:['drain'],laundry:['washer','drain'],hall:['smoke'],maid:['ac_split','smoke'],roof:['roofd'],yard:[],garage:['ext'],storage:['panel'],stairs:['smoke'],other:[]};
var MT={};/* مرجع الصيانة بمعرّفاته */
fetch(BASE+'refs/guide/maintenance.json').then(function(r){return r.json()}).then(function(d){(d.tasks||[]).forEach(function(t){MT[t.id]=t});paintAll()}).catch(function(){});
var REF=null,PK=null,refLoading=null;
function loadRef(){if(refLoading)return refLoading;refLoading=Promise.all([fetch(BASE+'refs/boq/ref_residential.json').then(function(r){return r.json()}),fetch(BASE+'refs/boq/packages_residential.json').then(function(r){return r.json()})]).then(function(a){REF=a[0];PK=a[1]});return refLoading}

/* ===== الحالة ===== */
function fresh(){return {v:1,grade:'mid',floors:[],cur:0,data:{},sample:false}}
var ST=TK.store('bb_tool_homeplan_v1',fresh,1),S=ST.get();
function save(){ST.save()}
function F(){return S.floors[S.cur]||null}
function D(id){return S.data[id]||(S.data[id]={assets:[],notes:[],photos:[],fin:{}})}

/* حالة الغرفة: ملاحظة مفتوحة، ثم صيانة مستحقة أو متأخرة خلال أسبوعين، ثم ضمان ينتهي خلال 60 يوماً */
function taskNext(a,tid){var t=MT[tid];if(!t)return null;var last=(a.done&&a.done[tid])||a.install||null;if(!last||!RX.test(last))return null;return addMonths(last,t.interval_months)}
function assetState(a){var late=0,soon=0;(KT[a.kind]||[]).forEach(function(tid){var n=taskNext(a,tid);if(!n)return;var d=daysTo(n);if(d<0)late++;else if(d<=14)soon++});
  var w=a.warranty&&RX.test(a.warranty)?daysTo(a.warranty):null;return {late:late,soon:soon,warr:w!=null&&w>=0&&w<=60}}
function roomState(id){var d=S.data[id];if(!d)return 'ok';
  if((d.notes||[]).some(function(n){return n.open}))return 'note';
  var due=false,warr=false;(d.assets||[]).forEach(function(a){var s=assetState(a);if(s.late||s.soon)due=true;if(s.warr)warr=true});
  return due?'due':warr?'warr':'ok'}
function roomFlags(id){var d=S.data[id],o={note:false,due:false,warr:false};if(!d)return o;
  o.note=(d.notes||[]).some(function(n){return n.open});(d.assets||[]).forEach(function(a){var s=assetState(a);if(s.late||s.soon)o.due=true;if(s.warr)o.warr=true});return o}
function shown(id){if(FLT==='all')return true;if(FLT==='ok')return roomState(id)==='ok';return roomFlags(id)[FLT]}
var SN={ok:'سليمة',due:'صيانة مستحقة',note:'ملاحظة مفتوحة',warr:'ضمان ينتهي قريباً'};

/* ===== التخزين: صور ما خلف الجدار وخلفيات المخططات في مجلد المستخدم ===== */
var USER=null;BB.auth.getSession().then(function(r){USER=r.data&&r.data.session&&r.data.session.user||null});
var URLS={};
function signed(path){var c=URLS[path];if(c&&c.exp>Date.now())return Promise.resolve(c.url);
  return BB.storage.from('home').createSignedUrl(path,3600).then(function(r){if(r.error||!r.data)throw r.error||new Error('url');URLS[path]={url:r.data.signedUrl,exp:Date.now()+3300e3};return r.data.signedUrl})}
function toJpeg(src,max){return new Promise(function(res,rej){var img=new Image();img.onload=function(){var s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.round(img.naturalWidth*s),h=Math.round(img.naturalHeight*s);
  var cv=document.createElement('canvas');cv.width=w;cv.height=h;var cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(img,0,0,w,h);cv.toBlob(function(b){b?res({blob:b,w:w,h:h}):rej(new Error('blob'))},'image/jpeg',.84)};img.onerror=function(){rej(new Error('img'))};img.src=src})}
function upload(blob,folder){if(!USER)return Promise.reject(new Error('login'));var path=USER.id+'/'+folder+'/'+uid('p')+'.jpg';
  return BB.storage.from('home').upload(path,blob,{contentType:'image/jpeg',upsert:false}).then(function(r){if(r.error)throw r.error;return path})}
var pdfLoading=null;
function pdfjs(){if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);if(pdfLoading)return pdfLoading;
  pdfLoading=new Promise(function(res,rej){var s=document.createElement('script');s.src=BASE+'assets/vendor/pdfjs-3.11.174.min.js';s.onload=function(){window.pdfjsLib.GlobalWorkerOptions.workerSrc=BASE+'assets/vendor/pdfjs-3.11.174.worker.min.js';res(window.pdfjsLib)};s.onerror=function(){pdfLoading=null;rej(new Error('pdfjs'))};document.head.appendChild(s)});return pdfLoading}
function pdfPage(file){return file.arrayBuffer().then(function(buf){return pdfjs().then(function(L){return L.getDocument({data:buf}).promise}).then(function(doc){return doc.getPage(1)}).then(function(pg){
  var v=pg.getViewport({scale:1}),sc=Math.min(4,2400/Math.max(v.width,v.height)),vp=pg.getViewport({scale:sc}),cv=document.createElement('canvas');cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);
  var cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);return pg.render({canvasContext:cx,viewport:vp}).promise.then(function(){return cv.toDataURL('image/jpeg',.86)})})})}

/* ===== عناصر الصفحة ===== */
var svg=$('hpSvg'),stage=$('hpStage'),panel=$('hpPanel'),pbody=$('pBody'),hint=$('hpHint'),tip=$('hpTip');
var VIEW={x:0,y:0,w:20,h:12},MODE='view',DRAW='rect',SEL=null,TAB='room',FLT='all',CAL=null,DRAFT=null;
function show(){var empty=!S.floors.length;$('hpStart').hidden=!empty;$('hpApp').hidden=empty;$('hpSample').hidden=!S.sample;$('hpGrade').value=S.grade||'mid'}

/* ===== الأدوار ===== */
function floorsUI(){var h=$('hpFloors');h.innerHTML='';S.floors.forEach(function(f,i){var b=el('button','hp-fl',f.name);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===S.cur));
  if(f.rooms.some(function(r){return roomState(r.id)!=='ok'})){b.appendChild(el('i','hp-fdot'));b.setAttribute('aria-label',f.name+'، فيه ما يحتاج انتباهك')}
  b.addEventListener('click',function(){S.cur=i;SEL=null;closePanel();save();fit();paintAll()});h.appendChild(b)})}

/* ===== الرسم ===== */
function setView(){svg.setAttribute('viewBox',VIEW.x+' '+VIEW.y+' '+VIEW.w+' '+VIEW.h)}
function bounds(){var f=F(),b=[1/0,1/0,-1/0,-1/0];if(!f)return [0,0,20,12];
  f.rooms.forEach(function(r){var q=pBox(r.poly);b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[2]);b[3]=Math.max(b[3],q[3])});
  (f.segs||[]).forEach(function(s){b[0]=Math.min(b[0],s[0],s[2]);b[1]=Math.min(b[1],s[1],s[3]);b[2]=Math.max(b[2],s[0],s[2]);b[3]=Math.max(b[3],s[1],s[3])});
  if(f.bg){b[0]=Math.min(b[0],f.bg.x);b[1]=Math.min(b[1],f.bg.y);b[2]=Math.max(b[2],f.bg.x+f.bg.w);b[3]=Math.max(b[3],f.bg.y+f.bg.h)}
  if(!isFinite(b[0]))return [0,0,20,12];return b}
var AUTO=true;
function fit(){AUTO=true;var b=bounds(),r=stage.getBoundingClientRect(),W=r.width||800,H=r.height||500,px=W<500?50:64,py=W<500?22:34,bw=Math.max(b[2]-b[0],12),bh=Math.max(b[3]-b[1],8),
    k=Math.min((W-px*2)/bw,(H-py*2)/bh),w=W/k,h=H/k;VIEW={x:(b[0]+b[2])/2-w/2,y:-(b[1]+b[3])/2-h/2,w:w,h:h};setView()}
function toWorld(cx,cy){var r=svg.getBoundingClientRect(),sx=VIEW.w/r.width,sy=VIEW.h/r.height,s=Math.max(sx,sy),ox=(r.width*s-VIEW.w)/2,oy=(r.height*s-VIEW.h)/2;
  return [VIEW.x-ox+(cx-r.left)*s,-(VIEW.y-oy+(cy-r.top)*s)]}
function pxPerM(){var r=svg.getBoundingClientRect();return Math.min(r.width/VIEW.w,r.height/VIEW.h)}
function pts(p){return p.map(function(q){return r2(q[0])+','+r2(-q[1])}).join(' ')}
var BGURL={};
function paint(){
  var f=F();svg.innerHTML='';if(!f)return;
  var g0=sv('g',{},svg);
  if(f.bg){var im=sv('image',{x:f.bg.x,y:-(f.bg.y+f.bg.h),width:f.bg.w,height:f.bg.h,preserveAspectRatio:'none','class':'hp-svg-bg'},g0);
    var src=(f.bg.path&&BGURL[f.bg.path])||BGURL['__tmp'+f.id];if(src)im.setAttribute('href',src);else if(f.bg.path)signed(f.bg.path).then(function(u){BGURL[f.bg.path]=u;im.setAttribute('href',u)}).catch(function(){})}
  if(f.segs&&f.segs.length){var gs=sv('g',{},g0),d='';f.segs.forEach(function(s){d+='M'+s[0]+' '+(-s[1])+'L'+s[2]+' '+(-s[3])});sv('path',{d:d,'class':'hp-seg'},gs)}
  var gr=sv('g',{},svg);
  f.rooms.forEach(function(r){var st=roomState(r.id),c=['hp-room','s-'+st];if(!shown(r.id))c.push('dim');if(SEL===r.id)c.push('sel');
    var pg=sv('polygon',{points:pts(r.poly),'class':c.join(' '),'data-id':r.id},gr);pg.setAttribute('tabindex','0');pg.setAttribute('role','button');pg.setAttribute('aria-label',r.name+'، '+fmt(pArea(r.poly),1)+' م²، '+SN[st])});
  /* الجدران من حواف الغرف حين لا تكون خطوط ملف: الحافة على حدود المبنى جدار خارجي أسمك */
  if(!(f.segs&&f.segs.length)){var b=bounds(),E={},gw=sv('g',{},svg);
    f.rooms.forEach(function(r){var p=r.poly;for(var i=0;i<p.length;i++){var a=p[i],c2=p[(i+1)%p.length],k=[r2(a[0]),r2(a[1]),r2(c2[0]),r2(c2[1])];var key=(k[0]<k[2]||(k[0]===k[2]&&k[1]<k[3]))?k.join():[k[2],k[3],k[0],k[1]].join();E[key]=k}});
    Object.keys(E).forEach(function(k){var e=E[k],ext=(Math.abs(e[0]-b[0])<.01&&Math.abs(e[2]-b[0])<.01)||(Math.abs(e[0]-b[2])<.01&&Math.abs(e[2]-b[2])<.01)||(Math.abs(e[1]-b[1])<.01&&Math.abs(e[3]-b[1])<.01)||(Math.abs(e[1]-b[3])<.01&&Math.abs(e[3]-b[3])<.01);
      sv('line',{x1:e[0],y1:-e[1],x2:e[2],y2:-e[3],'class':'hp-wall '+(ext?'ext':'int')},gw)})}
  else{var ge=sv('g',{},svg);f.rooms.forEach(function(r){sv('polygon',{points:pts(r.poly),'class':'hp-edge'},ge)})}
  var gl=sv('g',{},svg);
  f.rooms.forEach(function(r){var A=pArea(r.poly);if(A<1.2)return;var c=pCen(r.poly),bx=pBox(r.poly),side=Math.min(bx[2]-bx[0],bx[3]-bx[1]),fs=Math.max(.2,Math.min(.5,side/6));
    var t=sv('text',{x:r2(c[0]),y:r2(-c[1]),'class':'hp-lbl','font-size':fs,'stroke-width':r2(fs*.22)},gl);t.textContent=r.name;
    var room_w=(bx[2]-bx[0])*.9,tw=0;try{tw=t.getComputedTextLength()}catch(e){}
    if(tw>room_w){fs=fs*room_w/tw;if(fs<.13){t.remove();return}t.setAttribute('font-size',r2(fs*1000)/1000);t.setAttribute('stroke-width',r2(fs*.22*1000)/1000)}
    if(A>=4){var t2=sv('text',{x:r2(c[0]),y:r2(-c[1]+fs*1.2),'class':'hp-lbl2','font-size':fs*.72,'stroke-width':r2(fs*.16)},gl);t2.textContent=fmt(A,1)+' م²'}});
  if(DRAFT)paintDraft();
  if(CAL&&CAL.p.length){var gc=sv('g',{},svg);CAL.p.forEach(function(q){sv('circle',{cx:q[0],cy:-q[1],r:.12,'class':'hp-calp'},gc)});if(CAL.p.length===2)sv('line',{x1:CAL.p[0][0],y1:-CAL.p[0][1],x2:CAL.p[1][0],y2:-CAL.p[1][1],stroke:'currentColor','stroke-width':.05,'class':'hp-calp'},gc)}
}
var DG=null;
function paintDraft(){if(DG&&DG.parentNode)DG.parentNode.removeChild(DG);DG=sv('g',{},svg);if(!DRAFT)return;var p=DRAFT.pts.concat(DRAFT.cur?[DRAFT.cur]:[]);
  if(DRAFT.kind==='rect'&&DRAFT.a&&DRAFT.cur){var a=DRAFT.a,b=DRAFT.cur,x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
    sv('rect',{x:x0,y:-y1,width:x1-x0,height:y1-y0,'class':'hp-draft'},DG);var fs=Math.max(.18,.35*12/pxPerM()*2);
    var t=sv('text',{x:(x0+x1)/2,y:-(y1)-0.15,'class':'hp-dim','font-size':Math.min(.45,fs)},DG);t.textContent=fmt(x1-x0)+' م';
    var t2=sv('text',{x:x1+.15,y:-(y0+y1)/2,'class':'hp-dim','font-size':Math.min(.45,fs),'text-anchor':'start'},DG);t2.textContent=fmt(y1-y0)+' م';return}
  if(p.length>1)sv('polyline',{points:pts(p),'class':'hp-draft',fill:'none'},DG);
  DRAFT.pts.forEach(function(q){sv('circle',{cx:q[0],cy:-q[1],r:Math.max(.06,5/pxPerM()),'class':'hp-vtx'},DG)})}

/* ===== التقاط النقاط: شبكة 5 سم، ورؤوس الغرف وأطراف الخطوط القريبة ===== */
function snap(w){var f=F(),tol=10/pxPerM(),best=null,bd=tol;
  function tryP(x,y){var d=Math.hypot(x-w[0],y-w[1]);if(d<bd){bd=d;best=[x,y]}}
  if(f){f.rooms.forEach(function(r){r.poly.forEach(function(q){tryP(q[0],q[1])})});var segs=f.segs||[];if(segs.length<20000)segs.forEach(function(s){tryP(s[0],s[1]);tryP(s[2],s[3])})}
  if(DRAFT&&DRAFT.pts.length){var a=DRAFT.pts[DRAFT.pts.length-1];if(Math.abs(w[0]-a[0])<tol)w=[a[0],w[1]];if(Math.abs(w[1]-a[1])<tol)w=[w[0],a[1]]}
  return best||[Math.round(w[0]*20)/20,Math.round(w[1]*20)/20]}

/* ===== التفاعل على اللوح ===== */
var PTR={},pan=null,pinch=null,moved=false;
stage.addEventListener('pointerdown',function(e){
  if(e.target.closest&&e.target.closest('.hp-hint,.hp-zoom'))return;
  stage.setPointerCapture&&stage.setPointerCapture(e.pointerId);PTR[e.pointerId]=[e.clientX,e.clientY];moved=false;
  var ids=Object.keys(PTR);
  if(ids.length===2){var a=PTR[ids[0]],b=PTR[ids[1]];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),v:Object.assign({},VIEW),c:toWorld((a[0]+b[0])/2,(a[1]+b[1])/2)};pan=null;if(DRAFT&&DRAFT.kind==='rect'){DRAFT=null;paintDraft()}return}
  var w=toWorld(e.clientX,e.clientY);
  if(CAL){var q=snap(w);if(CAL.p.length===1){var a0=CAL.p[0],dx=Math.abs(q[0]-a0[0]),dy=Math.abs(q[1]-a0[1]);if(dy<dx*.06)q=[q[0],a0[1]];else if(dx<dy*.06)q=[a0[0],q[1]]}CAL.p.push(q);if(CAL.p.length===2)calAsk();paint();return}
  var onRoom=e.target&&e.target.getAttribute&&e.target.getAttribute('data-id');
  if(MODE==='draw'&&!onRoom&&e.button===0&&DRAW==='rect'){DRAFT={kind:'rect',a:snap(w),cur:null,pts:[]};return}
  pan={x:e.clientX,y:e.clientY,v:Object.assign({},VIEW),id:onRoom||null};
});
stage.addEventListener('pointermove',function(e){
  if(PTR[e.pointerId])PTR[e.pointerId]=[e.clientX,e.clientY];
  var ids=Object.keys(PTR);
  if(pinch&&ids.length===2){var a=PTR[ids[0]],b=PTR[ids[1]],d=Math.hypot(a[0]-b[0],a[1]-b[1]),k=pinch.d/d;AUTO=false;var w=pinch.v.w*k,h=pinch.v.h*k,c=pinch.c;
    VIEW={x:c[0]-(c[0]-pinch.v.x)*k,y:-c[1]-(-c[1]-pinch.v.y)*k,w:w,h:h};setView();moved=true;return}
  if(DRAFT&&DRAFT.kind==='rect'&&DRAFT.a){DRAFT.cur=snap(toWorld(e.clientX,e.clientY));moved=true;paintDraft();return}
  if(DRAFT&&DRAFT.kind==='poly'){DRAFT.cur=snap(toWorld(e.clientX,e.clientY));paintDraft()}
  if(pan){var dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;if(moved){AUTO=false;var s=1/pxPerM();VIEW.x=pan.v.x-dx*s;VIEW.y=pan.v.y-dy*s;setView()}return}
  /* التلميح */
  var id=e.target&&e.target.getAttribute&&e.target.getAttribute('data-id');
  if(id&&e.pointerType==='mouse'){var r=room(id);if(r){var st=roomState(id);tip.innerHTML='';tip.appendChild(el('b',null,r.name));tip.appendChild(el('small',null,fmt(pArea(r.poly),1)+' م² · '+SN[st]));tip.hidden=false;tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px'}}else tip.hidden=true;
});
function endPtr(e){
  var wasPinch=!!pinch;delete PTR[e.pointerId];if(Object.keys(PTR).length<2)pinch=null;
  if(wasPinch)return;
  if(DRAFT&&DRAFT.kind==='rect'&&DRAFT.a){var a=DRAFT.a,b=DRAFT.cur;DRAFT=null;paintDraft();
    if(b&&Math.abs(b[0]-a[0])>=.6&&Math.abs(b[1]-a[1])>=.6){var x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
      addRoom([[x0,y0],[x1,y0],[x1,y1],[x0,y1]])}return}
  if(pan&&!moved){var id=pan.id;
    if(MODE==='draw'&&DRAW==='poly'&&!id){polyClick(snap(toWorld(e.clientX,e.clientY)))}
    else if(id)select(id);else if(MODE==='view'){SEL=null;closePanel();paint()}}
  pan=null;
}
stage.addEventListener('pointerup',endPtr);stage.addEventListener('pointercancel',endPtr);
stage.addEventListener('pointerleave',function(){tip.hidden=true});
stage.addEventListener('wheel',function(e){e.preventDefault();var k=Math.exp(e.deltaY*.0015),c=toWorld(e.clientX,e.clientY);zoomAt(k,c)},{passive:false});
function zoomAt(k,c){AUTO=false;k=Math.max(.2,Math.min(5,k));var w=Math.max(2,Math.min(600,VIEW.w*k)),kk=w/VIEW.w;VIEW={x:c[0]-(c[0]-VIEW.x)*kk,y:-c[1]-(-c[1]-VIEW.y)*kk,w:w,h:VIEW.h*kk};setView()}
$('zIn').addEventListener('click',function(){zoomAt(1/1.35,[VIEW.x+VIEW.w/2,-(VIEW.y+VIEW.h/2)])});
$('zOut').addEventListener('click',function(){zoomAt(1.35,[VIEW.x+VIEW.w/2,-(VIEW.y+VIEW.h/2)])});
$('zFit').addEventListener('click',fit);
if(window.ResizeObserver){var RW=0,RH=0;new ResizeObserver(function(en){var r=en[0].contentRect;if(!r.width||(Math.abs(r.width-RW)<2&&Math.abs(r.height-RH)<2))return;
  var ow=RW,oh=RH;RW=r.width;RH=r.height;if(!F())return;if(AUTO||!ow){fit();return}var ppm=Math.min(ow/VIEW.w,oh/VIEW.h),cx=VIEW.x+VIEW.w/2,cy=VIEW.y+VIEW.h/2;
  VIEW={x:cx-r.width/ppm/2,y:cy-r.height/ppm/2,w:r.width/ppm,h:r.height/ppm};setView()}).observe(stage)}
svg.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.getAttribute('data-id')){e.preventDefault();select(e.target.getAttribute('data-id'))}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(DRAFT){DRAFT=null;paintDraft();return}if(CAL){CAL=null;setHint();paint();return}if(SEL){SEL=null;closePanel();paint()}}
  if(e.key==='Enter'&&DRAFT&&DRAFT.kind==='poly')polyFinish()});

/* ===== الرسم: مستطيل بالسحب، أو مضلع بالنقر ===== */
function setMode(m){MODE=m;$('mView').setAttribute('aria-pressed',String(m==='view'));$('mDraw').setAttribute('aria-pressed',String(m==='draw'));stage.classList.toggle('draw',m==='draw');DRAFT=null;setHint();paint()}
function setHint(){
  hint.innerHTML='';
  if(CAL){hint.appendChild(document.createTextNode(CAL.p.length<2?'ضبط المقياس: اضغط على طرفي بعد تعرف طوله في المخطط':''));if(CAL.p.length===2)return;hint.appendChild(btn('إلغاء','btn sm line',function(){CAL=null;setHint();paint()}));hint.hidden=false;return}
  if(MODE!=='draw'){hint.hidden=true;return}
  hint.appendChild(document.createTextNode(DRAW==='rect'?'اسحب لرسم غرفة مستطيلة. ':'اضغط لوضع رؤوس الغرفة، ثم «إنهاء» أو اضغط على أول رأس. '));
  hint.appendChild(btn(DRAW==='rect'?'غرفة غير مستطيلة':'غرفة مستطيلة','btn sm line',function(){DRAW=DRAW==='rect'?'poly':'rect';DRAFT=null;paintDraft();setHint()}));
  if(DRAW==='poly')hint.appendChild(btn('إنهاء','btn sm',polyFinish));
  hint.hidden=false}
function btn(t,c,fn){var b=el('button',c,t);b.type='button';b.addEventListener('click',fn);return b}
function polyClick(w){if(!DRAFT)DRAFT={kind:'poly',pts:[],cur:null};var p=DRAFT.pts;
  if(p.length>2&&Math.hypot(w[0]-p[0][0],w[1]-p[0][1])<12/pxPerM()){polyFinish();return}p.push(w);paintDraft()}
function polyFinish(){if(!DRAFT||DRAFT.kind!=='poly')return;var p=DRAFT.pts;DRAFT=null;paintDraft();if(p.length>=3&&pArea(p)>=.5)addRoom(p)}
function addRoom(poly){var f=F();if(!f)return;var n=f.rooms.length+1,r={id:uid('r'),name:'غرفة '+n,type:'other',poly:poly.map(function(q){return [r2(q[0]),r2(q[1])]})};
  f.rooms.push(r);if(S.sample)S.sample=false;AUTO=false;save();paintAll();select(r.id,'room',true)}
$('mView').addEventListener('click',function(){setMode('view')});$('mDraw').addEventListener('click',function(){setMode('draw')});

/* ===== ضبط المقياس ===== */
$('bCal').addEventListener('click',function(){if(!F())return;CAL={p:[]};setMode('view');CAL={p:[]};setHint();paint()});
function calAsk(){var a=CAL.p[0],b=CAL.p[1],m=Math.hypot(b[0]-a[0],b[1]-a[1]);hint.innerHTML='';
  hint.appendChild(document.createTextNode('الطول الحقيقي بين النقطتين بالمتر'));var i=el('input');i.type='number';i.step='0.01';i.min='0.1';i.id='calLen';i.value=fmt(m);hint.appendChild(i);
  hint.appendChild(btn('اعتمد','btn sm',function(){var v=TK.num(i.value);if(!(v>0)||!(m>0))return;scaleFloor(v/m);CAL=null;setHint();fit();paintAll();ST.flash('ضُبط المقياس')}));
  hint.appendChild(btn('إلغاء','btn sm line',function(){CAL=null;setHint();paint()}));hint.hidden=false;setTimeout(function(){i.focus();i.select()},30)}
function scaleFloor(k){var f=F();f.rooms.forEach(function(r){r.poly=r.poly.map(function(q){return [r2(q[0]*k),r2(q[1]*k)]})});
  if(f.segs)f.segs=f.segs.map(function(s){return [r2(s[0]*k),r2(s[1]*k),r2(s[2]*k),r2(s[3]*k)]});
  if(f.bg){f.bg.x*=k;f.bg.y*=k;f.bg.w*=k;f.bg.h*=k}save()}

/* ===== البطاقة ===== */
function room(id){var f=F();if(!f)return null;for(var i=0;i<f.rooms.length;i++)if(f.rooms[i].id===id)return f.rooms[i];return null}
function select(id,tab,focus){SEL=id;if(tab)TAB=tab;panel.hidden=false;document.querySelector('.hp-main').classList.add('has-panel');paint();drawPanel(focus)}
function closePanel(){panel.hidden=true;document.querySelector('.hp-main').classList.remove('has-panel')}
$('pClose').addEventListener('click',function(){SEL=null;closePanel();paint()});
[].forEach.call(document.querySelectorAll('.hp-ptabs button'),function(b){b.addEventListener('click',function(){TAB=b.getAttribute('data-t');drawPanel()})});
function drawPanel(focus){var r=room(SEL);if(!r){closePanel();return}
  [].forEach.call(document.querySelectorAll('.hp-ptabs button'),function(b){b.setAttribute('aria-selected',String(b.getAttribute('data-t')===TAB))});
  var A=pArea(r.poly),st=roomState(r.id);$('pType').textContent=TN[r.type]||'';$('pName').textContent=r.name;$('pMeta').textContent=fmt(A,1)+' م² · '+SN[st];
  pbody.innerHTML='';({room:tabRoom,fin:tabFin,eq:tabEq,wall:tabWall,log:tabLog})[TAB](r,focus);pbody.scrollTop=0}
function armed(b,label,fn){var t=null,orig=b.textContent;b.addEventListener('click',function(){if(b.dataset.armed){clearTimeout(t);delete b.dataset.armed;b.textContent=orig;fn();return}b.dataset.armed=1;b.textContent=label;t=setTimeout(function(){delete b.dataset.armed;b.textContent=orig},3000)})}

function tabRoom(r,focus){
  var kv=el('div','hp-kv');
  kv.appendChild(el('span',null,'اسم الغرفة'));var n=el('input');n.type='text';n.id='rName';n.value=r.name;n.maxLength=40;
  n.addEventListener('input',function(){r.name=n.value.trim()||'غرفة';$('pName').textContent=r.name;save();paint()});kv.appendChild(n);
  kv.appendChild(el('span',null,'نوعها'));var s=el('select');s.id='rType';TYPES.forEach(function(t){var o=el('option',null,t[1]);o.value=t[0];if(t[0]===r.type)o.selected=true;s.appendChild(o)});
  s.addEventListener('change',function(){r.type=s.value;$('pType').textContent=TN[r.type];save()});kv.appendChild(s);
  var A=pArea(r.poly),P=pPer(r.poly),lw=equivLW(r.poly);
  kv.appendChild(el('span',null,'المساحة'));kv.appendChild(el('b',null,fmt(A,2)+' م²'));
  kv.appendChild(el('span',null,'المحيط'));kv.appendChild(el('b',null,fmt(P,2)+' م'));
  kv.appendChild(el('span',null,'الأبعاد'));kv.appendChild(el('b',null,r.poly.length===4?fmt(lw[0])+' × '+fmt(lw[1])+' م':'غرفة غير مستطيلة · '+r.poly.length+' رؤوس'));
  pbody.appendChild(kv);
  var d=D(r.id),sum=el('div','hp-row');
  [[d.assets.length,['جهاز واحد','جهازان','أجهزة','جهازاً'],'eq'],[d.photos.length,['صورة واحدة','صورتان','صور','صورة'],'wall'],[d.notes.filter(function(x){return x.open}).length,['ملاحظة مفتوحة','ملاحظتان مفتوحتان','ملاحظات مفتوحة','ملاحظة مفتوحة'],'log']].forEach(function(x){
    var b=btn(x[0]?cnt(x[0],x[1]):'لا '+x[1][3].replace(/ة$/,'ات').replace('جهازاً','أجهزة').replace('صورات','صور').replace('ملاحظات مفتوحات','ملاحظات مفتوحة'),'hp-chip',function(){TAB=x[2];drawPanel()});sum.appendChild(b)});
  pbody.appendChild(sum);
  var del=el('button','hp-lnk danger','احذف هذه الغرفة من المسقط');del.type='button';armed(del,'اضغط مرة أخرى للحذف',function(){var f=F();f.rooms=f.rooms.filter(function(x){return x.id!==r.id});SEL=null;closePanel();save();paintAll()});
  pbody.appendChild(del);
  if(focus)setTimeout(function(){n.focus();n.select()},60);
}

/* التشطيبات: سطور حزمة نوع الغرفة بدرجة البيت، بكمياتها من مساحة الغرفة ومحيطها */
var CAT=[['09','الأرضيات والجدران والأسقف'],['07','العزل'],['08','الأبواب والنوافذ'],['12','الخزائن والأسطح'],['22','الأعمال الصحية'],['23','التكييف والتهوية'],['26','الكهرباء والإنارة'],['27','الاتصالات'],['28','السلامة'],['10','الإكسسوارات والسلامة'],['05','المعادن'],['32','الخارج']];
function tabFin(r){
  if(!REF){pbody.appendChild(el('p','hp-msg','..'));loadRef().then(function(){if(SEL===r.id&&TAB==='fin')drawPanel()},function(){pbody.innerHTML='';pbody.appendChild(el('p','hp-empty','تعذر تحميل المرجع السكني. حدّث الصفحة.'))});return}
  var g=S.grade||'mid',lw=equivLW(r.poly);
  var has=PK.rooms.some(function(x){return x.type===r.type});
  if(!has){pbody.appendChild(el('p','hp-empty','لا حزمة تشطيبات لهذا النوع من الفراغات. غيّر نوع الغرفة من تبويب «الغرفة» إن كان له نوع آخر.'));return}
  var res=BBQ.compute(REF,PK,{grade:g,rooms:[{type:r.type,name:r.name,L:lw[0],W:lw[1],nd:1,wa:0}]});
  var d=D(r.id);
  pbody.appendChild(el('p','hp-sub','حسب حزمة «'+(TN[r.type]||'')+'» بالدرجة '+({eco:'الاقتصادية',mid:'المتوسطة',lux:'الفاخرة'})[g]+'، وكمياتها من مساحة الغرفة ومحيطها (باب واحد، بلا نوافذ). اكتب تحت كل بند ما نُفّذ فعلاً: الطراز واللون ورقم الدفعة، لتجده يوم تحتاج إصلاحاً.'));
  var groups={};res.lines.forEach(function(l){var c=l.item.slice(0,2);(groups[c]=groups[c]||[]).push(l)});
  CAT.forEach(function(c){var ls=groups[c[0]];if(!ls)return;var box=el('div','fin-g');box.appendChild(el('b',null,c[1]));
    ls.forEach(function(l){var row=el('div','fin-l'),t=el('div','t');t.appendChild(el('b',null,l.item_ar));var qs=el('span');qs.appendChild(el('bdi','n',fmt(l.qty)));qs.appendChild(document.createTextNode(' '+l.unit));t.appendChild(qs);row.appendChild(t);
      row.appendChild(el('small',null,l.ar+(l.spec?' · '+l.spec:'')));
      var i=el('input');i.type='text';i.id='fin-'+l.code.replace(/\W/g,'');i.placeholder='ما نُفّذ فعلاً (اختياري)';i.value=(d.fin||{})[l.code]||'';i.setAttribute('aria-label','ما نُفّذ فعلاً: '+l.item_ar);
      i.addEventListener('input',function(){d.fin=d.fin||{};if(i.value.trim())d.fin[l.code]=i.value;else delete d.fin[l.code];save()});row.appendChild(i);box.appendChild(row)});
    pbody.appendChild(box)});
  var a=el('a','hp-lnk','افتح أداة جداول الكميات لبيتك كله');a.href=BASE+'tools/quantities/';pbody.appendChild(a);
}

/* الأجهزة ومواعيد صيانتها */
function tabEq(r){
  var d=D(r.id);
  var add=el('div','eq-add');(SUGGEST[r.type]||[]).forEach(function(k){if(d.assets.some(function(a){return a.kind===k}))return;add.appendChild(btn('+ '+KN[k],'hp-chip',function(){newAsset(r,k)}))});
  var sel=el('select');sel.id='eqKind';sel.setAttribute('aria-label','نوع الجهاز');var o0=el('option',null,'أضف جهازاً..');o0.value='';sel.appendChild(o0);KINDS.forEach(function(k){var o=el('option',null,k[1]);o.value=k[0];sel.appendChild(o)});
  sel.addEventListener('change',function(){if(sel.value)newAsset(r,sel.value)});add.appendChild(sel);pbody.appendChild(add);
  if(!d.assets.length){pbody.appendChild(el('p','hp-empty','لا أجهزة مسجلة في هذه الغرفة. أضف المكيف والسخان والشفاط وغيرها، فيُحسب موعد صيانة كل منها وتتلون الغرفة حين يحين.'));return}
  d.assets.forEach(function(a){
    var box=el('div','eq'),h=el('div','eq-h');h.appendChild(el('b',null,a.name||KN[a.kind]));var s=assetState(a);
    var stl=s.late?['due','صيانة متأخرة']:s.soon?['due','صيانة قريبة']:s.warr?['warr','ضمان ينتهي قريباً']:['ok','في موعده'];h.appendChild(el('span','eq-st '+stl[0],stl[1]));box.appendChild(h);
    var f=el('div','eq-f');
    [['name','الاسم','text'],['model','الطراز','text'],['serial','الرقم التسلسلي','text'],['install','تاريخ التركيب','date'],['warranty','نهاية الضمان','date'],['vendor','المورد أو الفني','text']].forEach(function(x){
      var l=el('label',null,x[1]),i=el('input');i.type=x[2];i.id='a-'+a.id+'-'+x[0];i.value=a[x[0]]||'';i.addEventListener('change',function(){a[x[0]]=i.value.trim();save();paintAll(true);if(x[0]==='install'||x[0]==='warranty')drawPanel()});l.appendChild(i);f.appendChild(l)});
    box.appendChild(f);
    var tl=el('div','eq-t');(KT[a.kind]||[]).forEach(function(tid){var t=MT[tid];if(!t)return;var n=taskNext(a,tid),row=el('div','eq-tk'),dd=n?daysTo(n):null;
      if(dd!=null&&dd<0)row.classList.add('late');else if(dd!=null&&dd<=14)row.classList.add('soon');
      var c=el('div');c.appendChild(el('span',null,t.task_ar));c.appendChild(el('small',null,n?(dd<0?'متأخر منذ '+cnt(-dd,['يوم','يومين','أيام','يوماً']):dd===0?'موعده اليوم':'القادم '+'\u2066'+n+'\u2069'+' · كل '+fmtInt(t.interval_months)):'أدخل تاريخ التركيب ليُحسب موعده'));row.appendChild(c);
      row.appendChild(btn('نُفّذ اليوم','btn sm line',function(){a.done=a.done||{};a.done[tid]=today();save();paintAll(true);drawPanel();ST.flash('سُجّل التنفيذ')}));tl.appendChild(row)});
    if(tl.children.length)box.appendChild(tl);
    var rm=el('button','hp-lnk danger','احذف الجهاز');rm.type='button';armed(rm,'اضغط مرة أخرى للحذف',function(){d.assets=d.assets.filter(function(x){return x!==a});save();paintAll(true);drawPanel()});box.appendChild(rm);
    pbody.appendChild(box)});
}
function fmtInt(m){return m<1?cnt(Math.round(m*30),['يوم','يومين','أيام','يوماً']):m<12?cnt(m,['شهر','شهرين','أشهر','شهراً']):m%12===0?cnt(m/12,['سنة','سنتين','سنوات','سنة']):cnt(m,['شهر','شهرين','أشهر','شهراً'])}
function newAsset(r,k){var d=D(r.id);d.assets.push({id:uid('a'),kind:k,name:KN[k],install:today(),done:{}});save();paintAll(true);drawPanel()}

/* خلف الجدار */
var WALLS=['الجدار الشمالي','الجدار الجنوبي','الجدار الشرقي','الجدار الغربي','السقف','الأرضية'];
function tabWall(r){
  var d=D(r.id);
  pbody.appendChild(el('p','hp-sub','صوّر التمديدات قبل اللياسة والتبليط: مواسير الماء والصرف، ومسارات الكهرباء، والعزل. وحدد الجدار في كل صورة، فتعرف بعد سنوات أين يمر كل شيء قبل أن تثقب أو تصلح.'));
  var up=el('div','ph-up'),row=el('div','hp-row'),w=el('select');w.id='phWall';w.setAttribute('aria-label','الجدار');WALLS.forEach(function(x){var o=el('option',null,x);o.value=x;w.appendChild(o)});
  var c=el('input');c.type='text';c.id='phCap';c.placeholder='وصف قصير: تغذية المغسلة، مسار التكييف..';c.style.flex='1';
  row.appendChild(w);row.appendChild(c);up.appendChild(row);
  var lab=el('label','btn sm');var fi=el('input');fi.type='file';fi.accept='image/*';fi.multiple=true;fi.hidden=true;fi.id='phFile';lab.appendChild(fi);lab.appendChild(document.createTextNode('ارفع صوراً'));
  var ms=el('span','hp-msg');var r2w=el('div','hp-row');r2w.appendChild(lab);r2w.appendChild(ms);up.appendChild(r2w);pbody.appendChild(up);
  fi.addEventListener('change',function(){var files=[].slice.call(fi.files||[]);if(!files.length)return;if(!USER){ms.textContent='سجّل الدخول لترفع الصور';return}
    var n=0;ms.textContent='جارٍ الرفع..';
    files.reduce(function(p,file){return p.then(function(){return new Promise(function(res){var rd=new FileReader();rd.onload=function(){res(rd.result)};rd.readAsDataURL(file)}).then(function(u){return toJpeg(u,1800)}).then(function(j){return upload(j.blob,'rooms/'+r.id)}).then(function(path){
      d.photos.push({id:uid('p'),path:path,wall:w.value,cap:c.value.trim(),date:today()});n++;save()})})},Promise.resolve())
    .then(function(){ms.textContent='رُفعت '+cnt(n,['صورة واحدة','صورتان','صور','صورة']);c.value='';drawPanel()},function(){ms.textContent=n?'رُفع بعضها وتعذر الباقي':'تعذر الرفع. تحقق من الاتصال وأعد المحاولة.';if(n)drawPanel()})});
  if(!d.photos.length){pbody.appendChild(el('p','hp-empty',S.sample?'في بيتك الحقيقي تظهر هنا صور ما خلف جدران الغرفة.':'لا صور بعد لهذه الغرفة.'));return}
  WALLS.forEach(function(wn){var ps=d.photos.filter(function(p){return p.wall===wn});if(!ps.length)return;pbody.appendChild(el('p','hp-h',wn));var g=el('div','ph-grid');
    ps.forEach(function(p){var fg=el('figure','ph');var im=el('img');im.alt=p.cap||wn;im.loading='lazy';signed(p.path).then(function(u){im.src=u}).catch(function(){im.alt='تعذر عرض الصورة'});
      im.addEventListener('click',function(){viewer(im.src,(p.cap?p.cap+' · ':'')+wn+' · \u2066'+p.date+'\u2069')});fg.appendChild(im);var dd=el('span','wall');var bd=el('bdi',null,p.date);bd.dir='ltr';dd.appendChild(bd);fg.appendChild(dd);
      var cap=el('figcaption',null,p.cap||'');fg.appendChild(cap);
      var rm=el('button','ph-del','حذف');rm.type='button';rm.setAttribute('aria-label','احذف الصورة'+(p.cap?': '+p.cap:''));
      armed(rm,'تأكيد',function(){BB.storage.from('home').remove([p.path]).then(function(){},function(){});d.photos=d.photos.filter(function(x){return x!==p});save();drawPanel()});fg.appendChild(rm);g.appendChild(fg)});
    pbody.appendChild(g)});
}
function viewer(src,cap){if(!src)return;var v=el('div','hp-view');v.setAttribute('role','dialog');v.setAttribute('aria-label','عرض الصورة');var b=btn('إغلاق','btn sm',function(){v.remove()});var wrap=el('div');var im=el('img');im.src=src;im.alt=cap;wrap.appendChild(im);wrap.appendChild(el('p',null,cap));v.appendChild(b);v.appendChild(wrap);
  v.addEventListener('click',function(e){if(e.target===v)v.remove()});document.body.appendChild(v);b.focus()}

/* السجل */
function tabLog(r){
  var d=D(r.id),f=el('div','ph-up'),row=el('div','hp-row');
  var dt=el('input');dt.type='date';dt.id='lgDate';dt.value=today();var op=el('label','hp-ck');var cb=el('input');cb.type='checkbox';cb.id='lgOpen';op.appendChild(cb);op.appendChild(document.createTextNode(' تحتاج معالجة'));
  var ta=el('textarea');ta.id='lgText';ta.placeholder='ما حدث: تسرب، إصلاح، استبدال، تجديد..';ta.setAttribute('aria-label','ما حدث في الغرفة');f.appendChild(ta);dt.setAttribute('aria-label','تاريخه');row.appendChild(dt);row.appendChild(op);f.appendChild(row);
  f.appendChild(btn('أضف إلى السجل','btn sm',function(){var t=ta.value.trim();if(!t){ta.focus();return}d.notes.unshift({id:uid('n'),date:dt.value||today(),text:t,open:cb.checked});save();paintAll(true);drawPanel();ST.flash('أُضيف إلى السجل')}));
  pbody.appendChild(f);
  if(!d.notes.length){pbody.appendChild(el('p','hp-empty','السجل فارغ. دوّن فيه كل ما يحدث في الغرفة، فيصير تاريخها أمامك.'));return}
  d.notes.slice().sort(function(a,b){return a.date<b.date?1:-1}).forEach(function(n){var it=el('div','lg'+(n.open?' open':''));var tm=el('time',null,n.date);tm.dir='ltr';tm.setAttribute('datetime',n.date);it.appendChild(tm);it.appendChild(el('span',null,n.text));
    var c=el('div');c.appendChild(btn(n.open?'عولجت':'أعد فتحها','hp-lnk',function(){n.open=!n.open;save();paintAll(true);drawPanel()}));
    var rm=el('button','hp-lnk danger x','حذف');rm.type='button';armed(rm,'تأكيد',function(){d.notes=d.notes.filter(function(x){return x!==n});save();paintAll(true);drawPanel()});c.appendChild(rm);it.appendChild(c);pbody.appendChild(it)});
}

/* ===== المؤشرات والتصفية ===== */
function stats(){var f=F(),rooms=f?f.rooms:[],A=0,c={ok:0,due:0,note:0,warr:0},tasks=0,notes=0,warr=0;
  rooms.forEach(function(r){var d=S.data[r.id];if(!d)return;notes+=(d.notes||[]).filter(function(n){return n.open}).length;(d.assets||[]).forEach(function(a){var s=assetState(a);tasks+=s.late+s.soon;if(s.warr)warr++})});
  rooms.forEach(function(r){A+=pArea(r.poly);var g=roomFlags(r.id);if(roomState(r.id)==='ok')c.ok++;if(g.due)c.due++;if(g.note)c.note++;if(g.warr)c.warr++});
  var h=$('hpStats');h.innerHTML='';
  [['',rooms.length,'غرف في هذا الدور'],['',fmt(A,1),'م² مساحة الغرف'],['s-due',tasks,'صيانة حانت أو خلال أسبوعين'],['s-note',notes,'ملاحظات مفتوحة'],['s-warr',warr,'ضمانات تنتهي خلال 60 يوماً']].forEach(function(x){var d=el('div',x[1]?x[0]:'');d.appendChild(el('b',null,String(x[1])));d.appendChild(el('span',null,x[2]));h.appendChild(d)});
  var fl=$('hpFlt');fl.innerHTML='';
  [['all','كل الغرف',rooms.length],['ok','سليمة',c.ok],['due','صيانة مستحقة',c.due],['note','ملاحظة مفتوحة',c.note],['warr','ضمان قريب',c.warr]].forEach(function(x){
    var b=el('button','hp-chip');b.type='button';b.setAttribute('aria-pressed',String(FLT===x[0]));b.appendChild(el('i','i-'+x[0]));b.appendChild(el('span',null,x[1]));b.appendChild(el('b',null,String(x[2])));
    b.addEventListener('click',function(){FLT=x[0];stats();paint()});fl.appendChild(b)})}
function paintAll(keepPanel){show();floorsUI();stats();paint();if(SEL&&!keepPanel&&!room(SEL)){SEL=null;closePanel()}if(SEL&&keepPanel&&!panel.hidden){var r=room(SEL);if(r){$('pMeta').textContent=fmt(pArea(r.poly),1)+' م² · '+SN[roomState(r.id)]}}}

/* ===== المصادر: DXF، خلفية PDF أو صورة، شبكة فارغة، مثال ===== */
function newFloor(name,extra){var f=Object.assign({id:uid('f'),name:name,rooms:[],segs:[]},extra||{});S.floors.push(f);S.cur=S.floors.length-1;return f}
function fromDxf(file){if(!file)return;if(!/\.dxf$/i.test(file.name)){ST.flash('الملف ليس DXF');return}
  ST.flash('جارٍ قراءة المخطط..',6000);
  file.arrayBuffer().then(function(buf){var m=window.BBDXF.planModel(buf,file.name);
    var plans=m.sheets.filter(function(s){return s.type==='plan'||s.type==='roof'||(s.type==null&&(s.rooms.length||s.segs.length>30))});if(!plans.length)plans=m.sheets.slice(0,1);
    if(S.sample)clearAll();
    plans.forEach(function(s,i){var name=s.title&&s.title.length<=30?s.title:(plans.length>1?'الدور '+(i+1):'الدور الأرضي');
      var f=newFloor(name,{src:'dxf',file:file.name,segs:s.segs});
      s.rooms.forEach(function(r){var nm=r.names[0]||'فراغ';f.rooms.push({id:uid('r'),name:nm.slice(0,40),type:guessType(r.names.join(' ')),poly:clean(r.poly)})})});
    S.cur=S.floors.length-plans.length;SEL=null;closePanel();setMode('view');closeMore();save();paintAll();setTimeout(fit,30);
    var n=plans.reduce(function(a,s){return a+s.rooms.length},0);
    if(!n){setMode('draw');ST.flash('قُرئت خطوط المخطط ولم نجد غرفاً مغلقة. ارسم الغرف فوق الخطوط.',6000)}else ST.flash('استُخرجت '+cnt(n,['غرفة واحدة','غرفتان','غرف','غرفة'])+' من '+cnt(plans.length,['لوحة واحدة','لوحتين','لوحات','لوحة']),5000)
  }).catch(function(){ST.flash('تعذر قراءة الملف. تأكد أنه DXF غير تالف (احفظه من الأوتوكاد بصيغة DXF 2013 أو أحدث).',7000)})}
function fromBg(file,intoCurrent){if(!file)return;ST.flash('جارٍ تجهيز الخلفية..',8000);
  var p=/pdf$/i.test(file.type)||/\.pdf$/i.test(file.name)?pdfPage(file):new Promise(function(res){var rd=new FileReader();rd.onload=function(){res(rd.result)};rd.readAsDataURL(file)});
  p.then(function(u){return toJpeg(u,2400)}).then(function(j){
    if(S.sample)clearAll();
    var f=intoCurrent&&F()?F():newFloor(S.floors.length?'دور '+(S.floors.length+1):'الدور الأرضي',{src:'bg'});
    var W=20,H=r2(W*j.h/j.w);f.bg={x:0,y:0,w:W,h:H,path:null};
    var local=URL.createObjectURL(j.blob);BGURL['__tmp'+f.id]=local;
    return upload(j.blob,'plans').then(function(path){f.bg.path=path;BGURL[path]=local},function(){f.bg.path=null;ST.flash('تعذر حفظ الخلفية في حسابك، فهي في هذه الجلسة فقط. تأكد من الاتصال ثم ارفعها مرة أخرى.',8000)}).then(function(){
      save();paintAll();setTimeout(function(){fit();CAL={p:[]};setHint();ST.flash('اضغط على طرفي بعد تعرف طوله لضبط المقياس',7000)},40)})
  }).catch(function(){ST.flash('تعذر فتح الملف. جرّب صورة JPG أو PNG أو ملف PDF غير محمي.',7000)})}
function clearAll(){S.floors=[];S.data={};S.cur=0;S.sample=false;SEL=null;closePanel()}
$('fDxf').addEventListener('change',function(e){fromDxf(e.target.files[0]);e.target.value=''});
$('fDxf2').addEventListener('change',function(e){fromDxf(e.target.files[0]);e.target.value=''});
$('fBg').addEventListener('change',function(e){fromBg(e.target.files[0],false);e.target.value=''});
$('fBg2').addEventListener('change',function(e){closeMore();fromBg(e.target.files[0],true);e.target.value=''});
$('bBlank').addEventListener('click',function(){newFloor('الدور الأرضي',{src:'draw'});save();paintAll();setTimeout(function(){VIEW={x:-1,y:-13,w:22,h:14};setView();fit();VIEW.w=Math.max(VIEW.w,22);setView();setMode('draw')},30)});
$('bSample').addEventListener('click',function(){S=Object.assign(S,sample());save();paintAll();setTimeout(fit,30)});
$('bClearSample').addEventListener('click',function(){clearAll();save();paintAll()});
$('bAddFloor').addEventListener('click',function(){newFloor('دور '+(S.floors.length+1),{src:'draw'});save();paintAll();setTimeout(fit,30);setMode('draw')});
$('bRenFloor').addEventListener('click',function(){var f=F();if(!f)return;TK.rename(f.name,function(v){f.name=v;save();floorsUI()})});
armed($('bDelFloor'),'اضغط مرة أخرى لحذف الدور',function(){var f=F();if(!f)return;f.rooms.forEach(function(r){delete S.data[r.id]});S.floors.splice(S.cur,1);S.cur=Math.max(0,S.cur-1);SEL=null;closePanel();save();paintAll();setTimeout(fit,30)});
$('bMore').addEventListener('click',function(){var m=$('hpMore'),o=m.hidden;m.hidden=!o;this.setAttribute('aria-expanded',String(o))});
function closeMore(){$('hpMore').hidden=true;$('bMore').setAttribute('aria-expanded','false')}
[].forEach.call(document.querySelectorAll('#hpMore button'),function(b){b.addEventListener('click',function(){if(b.id!=='bDelFloor')setTimeout(closeMore,0)})});
$('hpGrade').addEventListener('change',function(){S.grade=this.value;save();if(SEL&&TAB==='fin')drawPanel()});
$('bCsv').addEventListener('click',function(){var out=[['الدور','الغرفة','النوع','المساحة م²','البند','التفاصيل','التاريخ']];
  S.floors.forEach(function(f){f.rooms.forEach(function(r){var d=S.data[r.id]||{},base=[f.name,r.name,TN[r.type]||'',fmt(pArea(r.poly),2)];out.push(base.concat(['','','']));
    (d.assets||[]).forEach(function(a){out.push(base.concat(['جهاز: '+(a.name||KN[a.kind]),[a.model,a.serial,a.warranty?'الضمان حتى '+a.warranty:''].filter(Boolean).join(' · '),a.install||'']))});
    Object.keys(d.fin||{}).forEach(function(k){out.push(base.concat(['تشطيب '+k,d.fin[k],'']))});
    (d.notes||[]).forEach(function(n){out.push(base.concat(['سجل'+(n.open?' (مفتوحة)':''),n.text,n.date]))});
    (d.photos||[]).forEach(function(p){out.push(base.concat(['صورة: '+p.wall,p.cap||'',p.date]))})})});
  TK.csv(out,'مسقط-بيتك.csv')});

/* ===== فيلا المثال: دوران بغرف وأجهزة وملاحظات افتراضية معلنة ===== */
function sample(){
  function R(n,t,x0,y0,x1,y1){return {id:uid('r'),name:n,type:t,poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]}}
  var g=[R('مجلس الرجال','majlis',0,0,6,5),R('حمام الضيوف','wc',6,0,8.2,2.2),R('البهو','hall',6,2.2,9,5),R('الطعام','dining',9,0,13,5),R('الدرج','stairs',13,0,15,5),
    R('الصالة','living',0,5,7,12),R('المطبخ','kitchen',7,5,11.5,9.5),R('الغسيل','laundry',7,9.5,9.5,12),R('غرفة الخادمة','maid',9.5,9.5,12.5,12),R('حمام الخادمة','bath',12.5,9.5,15,12),R('المخزن','storage',11.5,5,15,9.5),R('مدخل الخدمة','hall',8.2,0,9,2.2)];
  var u=[R('النوم الرئيسية','master',0,0,6,5),R('حمام الرئيسية','bath',6,0,9,3),R('غرفة الملابس','storage',6,3,9,5),R('نوم 1','bedroom',9,0,13,5),R('الدرج','stairs',13,0,15,5),
    R('الصالة العلوية','living',0,5,5,12),R('حمام مشترك','bath',5,5,7.5,7.5),R('الممر','hall',7.5,5,15,7.5),R('نوم 2','bedroom',5,7.5,10,12),R('نوم 3','bedroom',10,7.5,15,12)];
  var t=today(),data={};function ago(m){return addMonths(t,-m)}
  function A(room,kind,ext){(data[room.id]=data[room.id]||{assets:[],notes:[],photos:[],fin:{}}).assets.push(Object.assign({id:uid('a'),kind:kind,name:KN[kind],done:{}},ext))}
  function N(room,text,open,m){(data[room.id]=data[room.id]||{assets:[],notes:[],photos:[],fin:{}}).notes.push({id:uid('n'),date:ago(m||1),text:text,open:open})}
  A(g[0],'ac_split',{model:'سبليت 24,000 وحدة',install:ago(22),warranty:addMonths(t,1.2),done:{'ac-filter':ago(.3),'ac-service':ago(10),'ac-drain':ago(10)}});
  A(g[6],'hood',{install:ago(14),done:{'app-hood':ago(2)}});A(g[6],'ext',{install:ago(14),done:{'safe-ext-check':ago(.5),'safe-ext-service':ago(6)}});
  A(g[1],'drain',{install:ago(14),done:{'plumb-drains':ago(.4)}});N(g[1],'تسرب بسيط تحت المغسلة عند الوصلة المرنة',true,.2);
  A(g[5],'ac_split',{install:ago(14),done:{'ac-filter':ago(.2),'ac-service':ago(4),'ac-drain':ago(4)}});A(g[5],'smoke',{install:ago(14),done:{'safe-smoke-test':ago(.5),'safe-smoke-battery':ago(3)}});
  A(g[9],'heater',{model:'سخان 80 لتر',install:ago(14),warranty:addMonths(t,10),done:{'water-heater-valve':ago(.5),'water-heater-service':ago(6)}});
  A(g[7],'washer',{install:ago(8),done:{'app-washer':ago(.6)}});
  A(u[0],'ac_split',{install:ago(14),done:{'ac-filter':ago(.2),'ac-service':ago(5),'ac-drain':ago(5)}});A(u[0],'smoke',{install:ago(14),done:{'safe-smoke-test':ago(1.5),'safe-smoke-battery':ago(5)}});
  A(u[1],'heater',{install:ago(14),done:{'water-heater-valve':ago(.4),'water-heater-service':ago(13)}});N(u[1],'استُبدل خلاط الدش بخلاط حراري',false,4);
  A(u[3],'ac_split',{install:ago(14),done:{'ac-filter':ago(.1),'ac-service':ago(5),'ac-drain':ago(5)}});A(u[8],'ac_split',{install:ago(14),done:{'ac-filter':ago(.3),'ac-service':ago(5),'ac-drain':ago(5)}});
  data[g[0].id].fin={'09 30 16-02':'بورسلان 60×120 رمادي فاتح، رقم الدفعة مدوّن في الفاتورة'};
  return {floors:[{id:uid('f'),name:'الدور الأرضي',src:'sample',rooms:g,segs:[]},{id:uid('f'),name:'الدور الأول',src:'sample',rooms:u,segs:[]}],cur:0,data:data,sample:true,grade:'mid'}}

/* ===== البدء ===== */
BBCal.mount($('calBox'),'مواعيد صيانة أجهزة بيتك');
show();floorsUI();stats();
if(S.floors.length)setTimeout(function(){fit();paint()},30);
window.addEventListener('resize',function(){if(!S.floors.length)return;var c=[VIEW.x+VIEW.w/2,VIEW.y+VIEW.h/2];var r=stage.getBoundingClientRect();if(!r.width)return;var ar=r.width/r.height;if(VIEW.w/VIEW.h<ar)VIEW.w=VIEW.h*ar;else VIEW.h=VIEW.w/ar;VIEW.x=c[0]-VIEW.w/2;VIEW.y=c[1]-VIEW.h/2;setView()});
});
