/* قارئ DXF في المتصفح: يستخرج من ملف الرسم ما يحتاجه الفحص بأرقامه الدقيقة،
   ويرسم صور معاينة لكل لوحة، ثم تُرفع مع الطلب ليقرأها الفحص الآلي.
   يعتمد على مكتبة dxf-parser (assets/vendor). */
(function(){
var ARABIC=/[؀-ۿ]/;
var UNITS={1:['بوصة',0.0254],2:['قدم',0.3048],4:['ملم',0.001],5:['سم',0.01],6:['متر',1]};

/* ١. القراءة وفك الترميز */
function decode(buf){
  var head=new TextDecoder('latin1').decode(new Uint8Array(buf,0,Math.min(buf.byteLength,200000)));
  if(/^AutoCAD Binary DXF/.test(head))throw new Error('binary_dxf');
  var ver=(head.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(\S+)/)||[])[1]||'';
  var cp=(head.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*(\S+)/)||[])[1]||'';
  var old=ver&&ver<'AC1021',enc='utf-8';
  if(old){var m=cp.match(/ANSI_(\d+)/i);enc=m?'windows-'+m[1]:'windows-1256'}
  var txt;try{txt=new TextDecoder(enc).decode(buf)}catch(e){txt=new TextDecoder('utf-8').decode(buf);enc='utf-8'}
  return {text:txt,version:ver,encoding:enc};
}
function clean(s){
  if(s==null)return '';
  s=String(s).replace(/\\U\+([0-9A-Fa-f]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16))});
  s=s.replace(/\\P/g,'\n').replace(/\\~/g,' ').replace(/\\[ACFHQTWfhpcqtwaLlOoKk][^;\\{}]*;?/g,'').replace(/\\S([^;]*)[\^#\/]([^;]*);/g,'$1/$2').replace(/[{}]/g,'');
  s=s.replace(/%%[cC]/g,'Ø').replace(/%%[dD]/g,'°').replace(/%%[pP]/g,'±').replace(/%%[uUoO]/g,'');
  return s.replace(/[ \t]+/g,' ').trim();
}

/* ٢. تحويلات الكتل */
function mul(A,B){return [A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]]}
function ap(M,p){return [M[0]*p.x+M[2]*p.y+M[4],M[1]*p.x+M[3]*p.y+M[5]]}
function scaleOf(M){return Math.sqrt(Math.abs(M[0]*M[3]-M[1]*M[2]))||1}
var I=[1,0,0,1,0,0];

function arcPts(c,r,a0,a1,M){
  if(a1<a0)a1+=Math.PI*2;var n=Math.max(8,Math.ceil((a1-a0)/(Math.PI/24))),out=[];
  for(var i=0;i<=n;i++){var a=a0+(a1-a0)*i/n;out.push(ap(M,{x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)}))}
  return out;
}
function bulgePts(p1,p2,b){
  var out=[],d=Math.hypot(p2.x-p1.x,p2.y-p1.y);if(!d)return out;
  var th=4*Math.atan(b),r=d/(2*Math.sin(th/2)),mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2,h=r*Math.cos(th/2);
  var nx=-(p2.y-p1.y)/d,ny=(p2.x-p1.x)/d,cx=mx+nx*h,cy=my+ny*h;
  var a0=Math.atan2(p1.y-cy,p1.x-cx),a1=Math.atan2(p2.y-cy,p2.x-cx);
  if(b>0){if(a1<a0)a1+=2*Math.PI}else{if(a1>a0)a1-=2*Math.PI}
  var n=Math.max(4,Math.ceil(Math.abs(a1-a0)/(Math.PI/18)));
  for(var i=1;i<n;i++){var a=a0+(a1-a0)*i/n;out.push({x:cx+Math.abs(r)*Math.cos(a),y:cy+Math.abs(r)*Math.sin(a)})}
  return out;
}
function vertsOf(e){
  var v=e.vertices||[],pts=[];
  for(var i=0;i<v.length;i++){pts.push(v[i]);var nx=v[i+1]||((e.shape||e.closed)?v[0]:null);if(v[i].bulge&&nx)pts=pts.concat(bulgePts(v[i],nx,v[i].bulge))}
  return pts;
}

/* ٣. جمع العناصر بعد فك الكتل */
function collect(dxf){
  var P={lines:[],polys:[],texts:[],dims:[],closed:[],layers:{}},count=0,LIMIT=400000;
  function addLine(pts,layer,kind){if(pts.length>1&&count<LIMIT){P.lines.push({p:pts,l:layer,k:kind||''});count+=pts.length}}
  function walk(list,M,depth,layerIn,top){
    for(var i=0;i<list.length;i++){
      var e=list[i];if(!e||e.visible===false||(top&&e.inPaperSpace))continue;
      var layer=(e.layer==='0'&&layerIn)?layerIn:(e.layer||'0');
      if(top)P.layers[layer]=(P.layers[layer]||0)+1;
      switch(e.type){
        case 'LINE':addLine([ap(M,e.vertices[0]),ap(M,e.vertices[1])],layer);break;
        case 'LWPOLYLINE':case 'POLYLINE':{
          var raw=e.vertices||[];if(raw.length<2)break;
          var pts=vertsOf(e).map(function(p){return ap(M,p)}),cl=!!(e.shape||e.closed);
          var f=raw[0],l=raw[raw.length-1];if(!cl&&raw.length>3&&Math.hypot(f.x-l.x,f.y-l.y)<1e-6)cl=true;
          if(cl)pts.push(pts[0]);addLine(pts,layer);
          if(cl&&top)P.closed.push({p:pts,l:layer});
          break}
        case 'ARC':addLine(arcPts(e.center,e.radius,e.startAngle,e.endAngle,M),layer);break;
        case 'CIRCLE':addLine(arcPts(e.center,e.radius,0,Math.PI*2,M),layer);break;
        case 'ELLIPSE':{
          var c=e.center,mj=e.majorAxisEndPoint,ra=e.axisRatio||1,R=Math.hypot(mj.x,mj.y),rot=Math.atan2(mj.y,mj.x),s=e.startAngle||0,en=e.endAngle||Math.PI*2,pts2=[];
          if(en<s)en+=Math.PI*2;for(var k=0;k<=48;k++){var t=s+(en-s)*k/48,x=R*Math.cos(t),y=R*ra*Math.sin(t);pts2.push(ap(M,{x:c.x+x*Math.cos(rot)-y*Math.sin(rot),y:c.y+x*Math.sin(rot)+y*Math.cos(rot)}))}
          addLine(pts2,layer);break}
        case 'SPLINE':{var cp=e.fitPoints&&e.fitPoints.length>1?e.fitPoints:e.controlPoints;if(cp)addLine(cp.map(function(p){return ap(M,p)}),layer);break}
        case 'SOLID':case '3DFACE':{var pp=(e.points||e.vertices||[]).map(function(p){return ap(M,p)});if(pp.length>2){pp.push(pp[0]);addLine(pp,layer)}break}
        case 'TEXT':case 'MTEXT':case 'ATTRIB':{
          var str=clean(e.text);if(!str)break;
          var useEnd=e.type==='TEXT'&&(e.halign||e.valign)&&e.endPoint;
          var pos=useEnd?e.endPoint:(e.startPoint||e.position);if(!pos)break;
          var xy=ap(M,pos),h=(e.textHeight||e.height||1)*scaleOf(M);
          P.texts.push({s:str,x:xy[0],y:xy[1],h:h,l:layer,mt:e.type==='MTEXT',ha:useEnd?e.halign:(e.type==='MTEXT'?((e.attachmentPoint||1)-1)%3:0),va:e.type==='MTEXT'?Math.floor(((e.attachmentPoint||1)-1)/3):(e.valign||0),rot:(e.rotation||0),top:top});
          break}
        case 'DIMENSION':{
          if(e.block&&dxf.blocks[e.block]&&depth<6)walk(dxf.blocks[e.block].entities||[],M,depth+1,layer,false);
          if(top){
            var m=e.actualMeasurement,a=e.linearOrAngularPoint1,b=e.linearOrAngularPoint2;
            if((m==null||isNaN(m))&&a&&b)m=Math.hypot(b.x-a.x,b.y-a.y);
            var t=clean(e.text||''),at=e.middleOfText||e.anchorPoint,axy=at?ap(M,at):null;
            P.dims.push({m:m,t:t&&t!=='<>'?t.replace('<>',m!=null?String(+m.toFixed(3)):''):'',x:axy&&axy[0],y:axy&&axy[1],l:layer,type:e.dimensionType});
          }
          break}
        case 'INSERT':{
          var blk=dxf.blocks&&dxf.blocks[e.name];if(!blk||depth>5)break;
          var bp=blk.position||{x:0,y:0},sx=e.xScale||1,sy=e.yScale||1,rr=(e.rotation||0)*Math.PI/180,cs=Math.cos(rr),sn=Math.sin(rr);
          var T=[cs*sx,sn*sx,-sn*sy,cs*sy,e.position.x,e.position.y];
          var M2=mul(M,mul(T,[1,0,0,1,-bp.x,-bp.y]));
          walk(blk.entities||[],M2,depth+1,layer,false);
          break}
      }
    }
  }
  walk(dxf.entities||[],I,0,null,true);
  P.truncated=count>=LIMIT;
  return P;
}

/* ٤. الحدود والتجمعات (كل لوحة أو مسقط وحده) */
function pct(a,q){if(!a.length)return 0;var i=Math.min(a.length-1,Math.max(0,Math.floor(q*(a.length-1))));return a[i]}
function bboxOf(P){
  var xs=[],ys=[];
  P.lines.forEach(function(L){L.p.forEach(function(p){xs.push(p[0]);ys.push(p[1])})});
  P.texts.forEach(function(t){xs.push(t.x);ys.push(t.y)});
  if(!xs.length)return null;
  xs.sort(function(a,b){return a-b});ys.sort(function(a,b){return a-b});
  return {x0:pct(xs,.003),x1:pct(xs,.997),y0:pct(ys,.003),y1:pct(ys,.997)};
}
function clusters(P,bb){
  var items=P.lines.map(function(L){var x0=1/0,x1=-1/0,y0=1/0,y1=-1/0;L.p.forEach(function(p){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1]});return {x0:x0,x1:x1,y0:y0,y1:y1}});
  P.texts.forEach(function(t){items.push({x0:t.x,x1:t.x+t.h,y0:t.y,y1:t.y+t.h})});
  items=items.filter(function(b){return b.x1>=bb.x0&&b.x0<=bb.x1&&b.y1>=bb.y0&&b.y0<=bb.y1});
  function split(set,box,axis,depth){
    var N=240,lo=axis?box.y0:box.x0,hi=axis?box.y1:box.x1,span=hi-lo;if(span<=0||set.length<30||depth>3)return [{box:box,set:set}];
    var diff=new Float64Array(N+1);
    set.forEach(function(b){var a=Math.floor(((axis?b.y0:b.x0)-lo)/span*N),c=Math.ceil(((axis?b.y1:b.x1)-lo)/span*N);a=Math.max(0,Math.min(N-1,a));c=Math.max(a+1,Math.min(N,c));diff[a]+=1;diff[c]-=1});
    var occ=[],run=0;for(var i=0;i<N;i++){run+=diff[i];occ.push(run>0)}
    var segs=[],st=-1,gap=0,MINGAP=Math.max(3,Math.round(N*0.025));
    for(i=0;i<N;i++){if(occ[i]){if(st<0)st=i;gap=0}else if(st>=0){gap++;if(gap>=MINGAP){segs.push([st,i-gap+1]);st=-1;gap=0}}}
    if(st>=0)segs.push([st,N]);
    if(segs.length<2)return axis===0?split(set,box,1,depth+1):[{box:box,set:set}];
    var out=[];
    segs.forEach(function(sg){
      var a=lo+sg[0]/N*span,c=lo+sg[1]/N*span,sub=set.filter(function(b){var m=axis?(b.y0+b.y1)/2:(b.x0+b.x1)/2;return m>=a-span*0.002&&m<=c+span*0.002});
      if(!sub.length)return;
      var nb=axis?{x0:box.x0,x1:box.x1,y0:a,y1:c}:{x0:a,x1:c,y0:box.y0,y1:box.y1};
      out=out.concat(split(sub,nb,axis?0:1,depth+1));
    });
    return out;
  }
  var cl=split(items,bb,0,0).map(function(c){
    var b={x0:1/0,x1:-1/0,y0:1/0,y1:-1/0};c.set.forEach(function(i){b.x0=Math.min(b.x0,i.x0);b.x1=Math.max(b.x1,i.x1);b.y0=Math.min(b.y0,i.y0);b.y1=Math.max(b.y1,i.y1)});
    return {box:{x0:Math.max(b.x0,bb.x0),x1:Math.min(b.x1,bb.x1),y0:Math.max(b.y0,bb.y0),y1:Math.min(b.y1,bb.y1)},n:c.set.length};
  }).filter(function(c){return c.n>=25&&c.box.x1>c.box.x0&&c.box.y1>c.box.y0});
  cl.sort(function(a,b){return b.n-a.n});cl=cl.slice(0,8);
  cl.sort(function(a,b){return (b.box.y1-a.box.y1)||(a.box.x0-b.box.x0)});
  return cl;
}

/* ٥. الرسم */
function render(P,box,maxSide){
  var pad=0.03,w=box.x1-box.x0,h=box.y1-box.y0,bx0=box.x0-w*pad,by0=box.y0-h*pad;w*=1+2*pad;h*=1+2*pad;
  var s=maxSide/Math.max(w,h),W=Math.max(200,Math.round(w*s)),H=Math.max(200,Math.round(h*s));
  var cv=document.createElement('canvas');cv.width=W;cv.height=H;var g=cv.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,W,H);g.lineCap='round';g.lineJoin='round';
  function X(x){return (x-bx0)*s}function Y(y){return H-(y-by0)*s}
  P.lines.forEach(function(L){
    var lay=(L.l||'').toUpperCase();
    g.strokeStyle=/DIM|بعد|ابعاد/.test(lay)?'#B26042':/HATCH|FURN|اثاث|أثاث/.test(lay)?'#9a9a9a':'#111';
    g.lineWidth=/WALL|جدار|حائط/.test(lay)?1.6:1;
    g.beginPath();g.moveTo(X(L.p[0][0]),Y(L.p[0][1]));for(var i=1;i<L.p.length;i++)g.lineTo(X(L.p[i][0]),Y(L.p[i][1]));g.stroke();
  });
  g.fillStyle='#000';
  P.texts.forEach(function(t){
    var px=t.h*s;if(px<6)return;if(t.x<box.x0-w||t.x>box.x1+w)return;
    var lines=t.s.split('\n');px=Math.min(px,90);
    g.save();g.translate(X(t.x),Y(t.y));if(t.rot)g.rotate(-t.rot*Math.PI/180);
    g.font=px+'px "Janna","Noto Kufi Arabic",Tahoma,sans-serif';
    var ar=ARABIC.test(t.s);g.direction=ar?'rtl':'ltr';
    g.textAlign=t.ha===1?'center':t.ha===2?'right':'left';
    if(t.mt){g.textBaseline=t.va===0?'top':t.va===1?'middle':'bottom'}else{g.textBaseline=t.va===2?'middle':t.va===3?'top':'alphabetic'}
    lines.forEach(function(ln,i){g.fillText(ln,0,i*px*1.35)});
    g.restore();
  });
  g.fillStyle='#B26042';g.font='600 15px "IBM Plex Mono",monospace';g.textAlign='center';g.textBaseline='middle';g.direction='ltr';
  P.dims.forEach(function(d){if(d.x==null||d.m==null||isNaN(d.m))return;if(d.x<box.x0||d.x>box.x1||d.y<box.y0||d.y>box.y1)return;var v=d.t||(d.type%32===2||d.type%32===5?(+d.m).toFixed(1)+'°':String(+(+d.m).toFixed(2)));var x=X(d.x),y=Y(d.y),tw=g.measureText(v).width;g.fillStyle='rgba(255,255,255,.85)';g.fillRect(x-tw/2-3,y-9,tw+6,18);g.fillStyle='#B26042';g.fillText(v,x,y)});
  return cv;
}
function toBlob(cv){return new Promise(function(res){cv.toBlob(function(b){
  if(b&&b.size<4.5*1048576)return res({blob:b,type:'image/png',ext:'png'});
  cv.toBlob(function(j){res({blob:j,type:'image/jpeg',ext:'jpg'})},'image/jpeg',0.85)},'image/png')})}

/* ٦. الاستخراج */
function area(p){var a=0;for(var i=0;i<p.length-1;i++)a+=p[i][0]*p[i+1][1]-p[i+1][0]*p[i][1];return Math.abs(a)/2}
function inside(pt,p){var c=false;for(var i=0,j=p.length-1;i<p.length;j=i++){var xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1];if(((yi>pt[1])!==(yj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi))c=!c}return c}
function r2(n){return Math.round(n*100)/100}

function extract(P,dxf,meta,bb,cls){
  var u=(dxf.header||{}).$INSUNITS,unit=UNITS[u],guess=false;
  if(!unit){guess=true;var span=Math.max(bb.x1-bb.x0,bb.y1-bb.y0);unit=span>1500?UNITS[4]:span>150?UNITS[5]:UNITS[6]}
  var f=unit[1];
  var lab=P.texts.filter(function(t){return t.top&&!/^[\d\s.,x×*+\-±%:/()]+$/.test(t.s)&&t.s.length<=60});
  var rooms=[],seen={};
  var owner=new Map();
  lab.forEach(function(t){var best=null,ba=1/0;P.closed.forEach(function(c){var a=area(c.p);if(a<ba&&inside([t.x,t.y],c.p)){ba=a;best=c}});if(best)owner.set(t,best)});
  P.closed.forEach(function(c){
    var a=area(c.p)*f*f;if(a<0.8||a>5000)return;
    var x0=1/0,x1=-1/0,y0=1/0,y1=-1/0;c.p.forEach(function(p){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])});
    var key=Math.round(a*10)+'_'+Math.round(x0)+'_'+Math.round(y0);if(seen[key])return;seen[key]=1;
    var names=lab.filter(function(t){return owner.get(t)===c}).map(function(t){return t.s.replace(/\n/g,' ')});
    var rect=c.p.length===5&&Math.abs(a-(x1-x0)*(y1-y0)*f*f)<0.01*a;
    rooms.push({names:names.slice(0,3),area:r2(a),w:r2((x1-x0)*f),h:r2((y1-y0)*f),rect:rect,layer:c.l,cx:r2((x0+x1)/2*f),cy:r2((y0+y1)/2*f),_box:[x0,x1,y0,y1]});
  });
  rooms.sort(function(a,b){return b.area-a.area});rooms=rooms.slice(0,400);
  function which(x,y){for(var i=0;i<cls.length;i++){var b=cls[i].box;if(x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1)return i+1}return 0}
  var texts={},tl=[];
  P.texts.forEach(function(t){if(!t.top)return;var k=t.s.replace(/\n/g,' / ');if(k.length>140)k=k.slice(0,140)+'..';var sh=which(t.x,t.y),key=sh+'|'+k;if(texts[key]){texts[key].n++;return}texts[key]={s:k,n:1,x:r2(t.x*f),y:r2(t.y*f),l:t.l,sheet:sh};tl.push(texts[key])});
  tl=tl.slice(0,900);
  var dims=P.dims.filter(function(d){return d.m!=null&&!isNaN(d.m)}).slice(0,900).map(function(d){return {v:r2(d.type%32===2||d.type%32===5?d.m:d.m*f),angle:d.type%32===2||d.type%32===5,t:d.t,x:d.x!=null?r2(d.x*f):null,y:d.y!=null?r2(d.y*f):null,l:d.l}});
  var levels=tl.filter(function(t){return /^[+\-±]?\s*\d{1,2}[.,]\d{2}$/.test(t.s.trim())&&/[+\-±]/.test(t.s)});
  // ربط كل فراغ وبعد بلوحته
  rooms.forEach(function(r){r.sheet=which((r._box[0]+r._box[1])/2,(r._box[2]+r._box[3])/2);delete r._box});
  dims.forEach(function(d){d.sheet=d.x!=null?which(d.x/f,d.y/f):0});
  return {
    v:1,file:meta.name,version:meta.version,encoding:meta.encoding,
    units:{name:unit[0],toMeter:f,guessed:guess,insunits:u||null},
    extents_m:{w:r2((bb.x1-bb.x0)*f),h:r2((bb.y1-bb.y0)*f)},
    layers:Object.keys(P.layers).map(function(k){return {name:k,n:P.layers[k]}}).sort(function(a,b){return b.n-a.n}).slice(0,120),
    sheets:cls.map(function(c,i){return {n:i+1,w:r2((c.box.x1-c.box.x0)*f),h:r2((c.box.y1-c.box.y0)*f),titles:tl.filter(function(t){return t.sheet===i+1&&ARABIC.test(t.s)}).sort(function(a,b){return b.y-a.y}).slice(0,6).map(function(t){return t.s})}}),
    rooms:rooms,dims:dims,levels:levels.map(function(t){return {s:t.s,sheet:t.sheet}}),texts:tl,
    truncated:P.truncated
  };
}

/* ٧. نص مختصر يقرؤه الفحص الآلي */
function summary(x){
  var L=[];
  L.push('ملف DXF: '+x.file+' · نسخة '+(x.version||'غير معروفة')+' · الوحدة: '+x.units.name+(x.units.guessed?' (مستنتجة من حجم الرسم، تحقق منها)':' (من رأس الملف)')+' · امتداد الرسم '+x.extents_m.w+' × '+x.extents_m.h+' م');
  if(x.sheets.length){L.push('');L.push('اللوحات المرسومة (لكل لوحة صورة معاينة بنفس الرقم):');x.sheets.forEach(function(s){L.push('لوحة '+s.n+': '+s.w+' × '+s.h+' م'+(s.titles.length?' · نصوصها البارزة: '+s.titles.join(' | '):''))})}
  L.push('');L.push('الفراغات المغلقة (مضلعات مغلقة) بمساحاتها المحسوبة من الملف، م²، مع النصوص الواقعة داخلها:');
  x.rooms.slice(0,250).forEach(function(r){L.push('- لوحة '+r.sheet+' · '+(r.names.length?r.names.join(' / '):'بلا اسم')+' · '+r.area+' م² · '+(r.rect?'مستطيل ':'الإطار ')+r.w+' × '+r.h+' م · طبقة '+r.layer)});
  if(x.dims.length){L.push('');L.push('الأبعاد المسجلة في الملف (قيمة البعد الفعلية بالمتر، والنص الظاهر إن عُدّل):');
    x.dims.slice(0,400).forEach(function(d){L.push('- لوحة '+d.sheet+' · '+(d.angle?d.v+'°':d.v+' م')+(d.t?' · مكتوب: '+d.t:''))})}
  if(x.levels.length){L.push('');L.push('المناسيب المكتوبة: '+x.levels.map(function(l){return l.s+' (لوحة '+l.sheet+')'}).join('، '))}
  L.push('');L.push('النصوص في الرسم (النص × عدد تكراره · لوحته):');
  x.texts.slice(0,600).forEach(function(t){L.push('- '+t.s+(t.n>1?' ×'+t.n:'')+' · لوحة '+t.sheet)});
  L.push('');L.push('الطبقات: '+x.layers.map(function(l){return l.name+' ('+l.n+')'}).join('، '));
  if(x.truncated)L.push('تنبيه: الملف كبير، فقُرئ جزء من عناصره فقط.');
  var s=L.join('\n');return s.length>90000?s.slice(0,90000)+'\n..':s;
}

/* ٨. الواجهة */
function process(file){
  return file.arrayBuffer().then(function(buf){
    var d=decode(buf),dxf=new (window.DxfParser.default||window.DxfParser)().parseSync(d.text);
    if(!dxf)throw new Error('parse_failed');
    var P=collect(dxf),bb=bboxOf(P);if(!bb)throw new Error('empty');
    var cls=clusters(P,bb);
    var x=extract(P,dxf,{name:file.name,version:d.version,encoding:d.encoding},bb,cls);
    x.text=summary(x);
    var jobs=[];
    var boxes=cls.length>1?cls.map(function(c){return c.box}):[bb];
    if(cls.length>1)boxes.unshift(bb);
    boxes.forEach(function(b,i){jobs.push(toBlob(render(P,b,i===0&&cls.length>1?1800:2200)).then(function(r){r.label=cls.length>1?(i===0?'نظرة عامة':'لوحة '+i):'الرسم كاملاً';return r}))});
    return Promise.all(jobs).then(function(imgs){return {extract:x,images:imgs}});
  });
}
window.BBDXF={process:process,_debug:{decode:decode,clean:clean}};
})();
