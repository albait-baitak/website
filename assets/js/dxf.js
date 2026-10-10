/* قارئ DXF في المتصفح: يستخرج من ملف الرسم ما يحتاجه الفحص بأرقامه الدقيقة،
   ويرسم صور معاينة لكل لوحة، ثم تُرفع مع الطلب ليقرأها الفحص الآلي.
   يعتمد على مكتبة dxf-parser (assets/vendor). */
(function(){
var ARABIC=/[؀-ۿ]/;
var UNITS={1:['بوصة',0.0254],2:['قدم',0.3048],4:['ملم',0.001],5:['سم',0.01],6:['متر',1]};

/* 1. القراءة وفك الترميز */
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

/* 2. تحويلات الكتل */
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

/* تصنيف الكتل: باب أو نافذة من اسم الكتلة أو طبقتها */
var RX_DOOR=/(^|[^A-Z])(DOOR|DOORS|DR|DOR)([^A-Z]|$)|باب|أبواب|ابواب/i,RX_WIN=/(^|[^A-Z])(WINDOW|WINDOWS|WIN|WND|WDW)([^A-Z]|$)|نافذ|نوافذ|شباك|شبابيك/i;
function nameKind(name,layer){
  var n=String(name||''),l=String(layer||'');
  if(/^\*/.test(n))n='';
  if(/^D\d{1,2}[A-Z]?$/i.test(n)||RX_DOOR.test(n))return 'door';
  if(/^W\d{1,2}[A-Z]?$/i.test(n)||RX_WIN.test(n))return 'window';
  if(RX_DOOR.test(l))return 'door';if(RX_WIN.test(l))return 'window';
  return null;
}
var TAG=/^(D|W|G|DW|WD|SD|V|GD|WN|DR)[-\s.]?\d{1,2}[A-Z]?$/i;
function tagKey(s){return String(s).replace(/\s+/g,'').toUpperCase().replace(/[-.]/g,'')}

/* قراءة مباشرة لما لا تقرؤه مكتبة dxf-parser: التهشير (حدود الأرضيات غالباً) وسمات الكتل (رموز الأبواب والنوافذ كثيراً) */
function rawScan(text){
  var out={hatches:[],attribs:[]};
  var L=text.split(/\r?\n/),i=0,n=L.length;
  while(i<n-1){if(L[i].trim()==='0'&&L[i+1].trim()==='SECTION'&&(L[i+2]||'').trim()==='2'&&(L[i+3]||'').trim()==='ENTITIES'){i+=4;break}i+=2}
  if(i>=n-1)return out;
  var cur=null;
  function flush(){if(!cur)return;try{if(cur.t==='HATCH')hatch(cur.p);else if(cur.t==='ATTRIB')attrib(cur.p)}catch(e){}cur=null}
  for(;i<n-1;i+=2){
    var c=L[i].trim(),v=L[i+1];
    if(c==='0'){flush();var t=v.trim();if(t==='ENDSEC')break;if(t==='HATCH'||t==='ATTRIB')cur={t:t,p:[]};continue}
    if(cur)cur.p.push([+c,v]);
  }
  flush();return out;
  function attrib(p){
    var a={l:'0',x:null,y:null,s:'',tag:'',h:1,ps:false};
    p.forEach(function(q){var c=q[0],v=q[1];if(c===8)a.l=v.trim();else if(c===10)a.x=+v;else if(c===20)a.y=+v;else if(c===1)a.s=v;else if(c===2)a.tag=v.trim();else if(c===40)a.h=+v;else if(c===67)a.ps=v.trim()==='1';else if(c===70&&(+v&1))a.hidden=true});
    if(!a.ps&&!a.hidden&&a.x!=null&&a.s.trim())out.attribs.push(a);
  }
  function hatch(p){
    var h={l:'0',pat:'',solid:false,paths:[],ps:false},k=0;
    function at(c){for(;k<p.length;k++)if(p[k][0]===c)return +p[k++][1];return null}
    for(var j=0;j<p.length;j++){var c=p[j][0];if(c===8&&h.l==='0')h.l=p[j][1].trim();else if(c===2&&!h.pat)h.pat=p[j][1].trim();else if(c===67)h.ps=p[j][1].trim()==='1';else if(c===91){k=j+1;break}}
    if(!k)return;var np=+p[k-1][1];
    for(var q=0;q<np&&k<p.length;q++){
      var fl=at(92);if(fl==null)break;var pts=[];
      if(fl&2){var hb=at(72),cl=at(73),nv=at(93);
        for(var m=0;m<nv;m++){var x=at(10),y=at(20),b=0;if(hb){if(p[k]&&p[k][0]===42){b=+p[k][1];k++}}var pt={x:x,y:y,bulge:b};pts.push(pt)}
        var full=[];for(var m2=0;m2<pts.length;m2++){full.push(pts[m2]);var nx=pts[m2+1]||pts[0];if(pts[m2].bulge)full=full.concat(bulgePts(pts[m2],nx,pts[m2].bulge))}
        pts=full;
      }else{
        var ne=at(93);
        for(var e=0;e<ne;e++){var et=at(72);
          if(et===1){pts.push({x:at(10),y:at(20)});at(11);at(21)}
          else if(et===2){var cx=at(10),cy=at(20),r=at(40),a0=at(50),a1=at(51),ccw=at(73);var A0=a0*Math.PI/180,A1=a1*Math.PI/180;if(A1<A0)A1+=2*Math.PI;for(var s2=0;s2<=12;s2++){var aa=A0+(A1-A0)*s2/12;pts.push({x:cx+r*Math.cos(aa),y:cy+(ccw?1:-1)*r*Math.sin(aa)})}}
          else if(et===3){var ex=at(10),ey=at(20);at(11);at(21);at(40);at(50);at(51);at(73);pts.push({x:ex,y:ey})}
          else if(et===4){at(94);var nk=null,nc=null;for(;k<p.length;k++){var cc=p[k][0];if(cc===95)nk=+p[k][1];else if(cc===96){nc=+p[k][1];k++;break}}for(var z=0;z<nc;z++){pts.push({x:at(10),y:at(20)})}}
        }
      }
      if(pts.length>2)h.paths.push(pts.map(function(o){return [o.x,o.y]}));
    }
    if(!h.ps&&h.paths.length)out.hatches.push(h);
  }
}

/* 3. جمع العناصر بعد فك الكتل */
function collect(dxf){
  var P={lines:[],polys:[],texts:[],dims:[],closed:[],layers:{},inserts:[]},count=0,LIMIT=400000;
  function addLine(pts,layer,kind){if(pts.length>1&&count<LIMIT){P.lines.push({p:pts,l:layer,k:kind||''});count+=pts.length}}
  function walk(list,M,depth,layerIn,top,inKind){
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
            var raw=String(e.text||'');
            P.dims.push({m:m,t:t&&t!=='<>'?t.replace('<>',m!=null?String(+m.toFixed(3)):''):'',ov:!!(raw&&raw.indexOf('<>')<0&&clean(raw)),x:axy&&axy[0],y:axy&&axy[1],l:layer,type:e.dimensionType});
          }
          break}
        case 'INSERT':{
          var blk=dxf.blocks&&dxf.blocks[e.name];if(!blk||depth>5)break;
          var bp=blk.position||{x:0,y:0},sx=e.xScale||1,sy=e.yScale||1,rr=(e.rotation||0)*Math.PI/180,cs=Math.cos(rr),sn=Math.sin(rr);
          var T=[cs*sx,sn*sx,-sn*sy,cs*sy,e.position.x,e.position.y];
          var M2=mul(M,mul(T,[1,0,0,1,-bp.x,-bp.y]));
          /* كل كتلة مُدرجة تُسجَّل بموضعها، إلا ما كان داخل كتلة باب أو نافذة حتى لا يُعدّ مرتين */
          var kn=inKind?null:nameKind(e.name,layer);
          if(!inKind){var pxy=ap(M,e.position);P.inserts.push({name:e.name,l:layer,x:pxy[0],y:pxy[1],sx:Math.abs(sx*scaleOf(M)),kind:kn})}
          walk(blk.entities||[],M2,depth+1,layer,false,inKind||!!kn);
          break}
      }
    }
  }
  walk(dxf.entities||[],I,0,null,true,false);
  P.truncated=count>=LIMIT;
  return P;
}

/* 4. الحدود والتجمعات (كل لوحة أو مسقط وحده) */
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

/* 5. الرسم */
function render(P,box,maxSide){
  var pad=0.03,w=box.x1-box.x0,h=box.y1-box.y0,bx0=box.x0-w*pad,by0=box.y0-h*pad;w*=1+2*pad;h*=1+2*pad;
  var s=maxSide/Math.max(w,h),W=Math.max(200,Math.round(w*s)),H=Math.max(200,Math.round(h*s));
  var cv=document.createElement('canvas');cv.width=W;cv.height=H;var g=cv.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,W,H);g.lineCap='round';g.lineJoin='round';
  function X(x){return (x-bx0)*s}function Y(y){return H-(y-by0)*s}
  P.lines.forEach(function(L){
    var lay=(L.l||'').toUpperCase();
    g.strokeStyle=/DIM|بعد|ابعاد/.test(lay)?'#A65338':/HATCH|FURN|اثاث|أثاث/.test(lay)?'#9a9a9a':'#111';
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
  g.fillStyle='#A65338';g.font='600 15px "IBM Plex Mono",monospace';g.textAlign='center';g.textBaseline='middle';g.direction='ltr';
  P.dims.forEach(function(d){if(d.x==null||d.m==null||isNaN(d.m))return;if(d.x<box.x0||d.x>box.x1||d.y<box.y0||d.y>box.y1)return;var v=d.t||(d.type%32===2||d.type%32===5?(+d.m).toFixed(1)+'°':String(+(+d.m).toFixed(2)));var x=X(d.x),y=Y(d.y),tw=g.measureText(v).width;g.fillStyle='rgba(255,255,255,.85)';g.fillRect(x-tw/2-3,y-9,tw+6,18);g.fillStyle='#A65338';g.fillText(v,x,y)});
  return cv;
}
function toBlob(cv){return new Promise(function(res){cv.toBlob(function(b){
  if(b&&b.size<4.5*1048576)return res({blob:b,type:'image/png',ext:'png'});
  cv.toBlob(function(j){res({blob:j,type:'image/jpeg',ext:'jpg'})},'image/jpeg',0.85)},'image/png')})}

/* 6. الاستخراج */
function area(p){var a=0;for(var i=0;i<p.length-1;i++)a+=p[i][0]*p[i+1][1]-p[i+1][0]*p[i][1];return Math.abs(a)/2}
function inside(pt,p){var c=false;for(var i=0,j=p.length-1;i<p.length;j=i++){var xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1];if(((yi>pt[1])!==(yj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi))c=!c}return c}
function r2(n){return Math.round(n*100)/100}

function extract(P,dxf,meta,bb,cls,raw){
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
    var per=0;for(var pi=0;pi<c.p.length-1;pi++)per+=Math.hypot(c.p[pi+1][0]-c.p[pi][0],c.p[pi+1][1]-c.p[pi][1]);
    rooms.push({names:names.slice(0,3),area:r2(a),per:r2(per*f),w:r2((x1-x0)*f),h:r2((y1-y0)*f),rect:rect,layer:c.l,cx:r2((x0+x1)/2*f),cy:r2((y0+y1)/2*f),_box:[x0,x1,y0,y1]});
  });
  rooms.forEach(function(r){r.src='poly'});
  /* التهشير: كثيراً ما تُهشَّر أرضية الغرفة بحدودها، فهو مصدر ثانٍ لمساحات الفراغات حين لا تُرسم بخط مغلق */
  (raw&&raw.hatches||[]).forEach(function(h){
    var best=null,ba=0;h.paths.forEach(function(pp){var c=pp.slice();if(c.length&&(c[0][0]!==c[c.length-1][0]||c[0][1]!==c[c.length-1][1]))c.push(c[0]);var a=area(c);if(a>ba){ba=a;best=c}});
    if(!best)return;var a=ba*f*f;if(a<0.8||a>5000)return;
    var x0=1/0,x1=-1/0,y0=1/0,y1=-1/0;best.forEach(function(p){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])});
    var cx=(x0+x1)/2,cy=(y0+y1)/2;
    if(rooms.some(function(r){return Math.abs(r.area-a)<=Math.max(0.02*a,0.1)&&Math.abs(r.cx-cx*f)<0.3&&Math.abs(r.cy-cy*f)<0.3}))return;
    var names=lab.filter(function(t){return inside([t.x,t.y],best)}).map(function(t){return t.s.replace(/\n/g,' ')});
    var per=0;for(var pi=0;pi<best.length-1;pi++)per+=Math.hypot(best[pi+1][0]-best[pi][0],best[pi+1][1]-best[pi][1]);
    rooms.push({names:names.slice(0,3),area:r2(a),per:r2(per*f),w:r2((x1-x0)*f),h:r2((y1-y0)*f),rect:false,layer:h.l,cx:r2(cx*f),cy:r2(cy*f),src:'hatch',pat:h.pat,_box:[x0,x1,y0,y1]});
  });
  rooms.sort(function(a,b){return b.area-a.area});rooms=rooms.slice(0,400);
  /* اللوحة التي يقع فيها الموضع؛ وما وقع خارج كل اللوحات قريباً من إحداها (عنوان تحتها، أو منسوب بجانبها) يُنسب إلى أقربها */
  function which(x,y){var best=0,bd=1/0;for(var i=0;i<cls.length;i++){var b=cls[i].box;if(x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1)return i+1;
    var dx=Math.max(b.x0-x,0,x-b.x1),dy=Math.max(b.y0-y,0,y-b.y1),d=Math.hypot(dx,dy),lim=0.35*Math.max(b.x1-b.x0,b.y1-b.y0);if(d<=lim&&d<bd){bd=d;best=i+1}}return best}
  var texts={},tl=[];
  P.texts.forEach(function(t){if(!t.top)return;var k=t.s.replace(/\n/g,' / ');if(k.length>140)k=k.slice(0,140)+'..';var sh=which(t.x,t.y),key=sh+'|'+k;if(texts[key]){texts[key].n++;return}texts[key]={s:k,n:1,x:r2(t.x*f),y:r2(t.y*f),l:t.l,sheet:sh};tl.push(texts[key])});
  tl=tl.slice(0,900);
  var dims=P.dims.filter(function(d){return d.m!=null&&!isNaN(d.m)}).slice(0,900).map(function(d){return {v:r2(d.type%32===2||d.type%32===5?d.m:d.m*f),angle:d.type%32===2||d.type%32===5,t:d.t,x:d.x!=null?r2(d.x*f):null,y:d.y!=null?r2(d.y*f):null,l:d.l}});
  var levels=tl.filter(function(t){return /^[+\-±]?\s*\d{1,2}[.,]\d{2}$/.test(t.s.trim())&&/[+\-±]/.test(t.s)});
  // ربط كل فراغ وبعد بلوحته
  rooms.forEach(function(r){r.sheet=which((r._box[0]+r._box[1])/2,(r._box[2]+r._box[3])/2);delete r._box});
  dims.forEach(function(d){d.sheet=d.x!=null?which(d.x/f,d.y/f):0});
  var ST=sheetTypes(P,cls,which);
  function stype(n){return n&&ST[n-1]?ST[n-1].type:null}
  function sheetName(n){if(!n)return '';var t=ST[n-1];return 'لوحة '+n+(t&&t.type?' ('+SHEET_AR[t.type]+(t.title?': '+t.title:'')+')':'')}
  var blocks=blockStats(P,dxf,f,which,stype),walls=wallStats(P,f,which,stype),tags=tagStats(P,which,stype);
  var X={levels:levels.map(function(t){return {s:t.s,sheet:t.sheet}}),_which:which};
  var checks=consistency(X,P,f,stype,sheetName,tags,blocks);
  return {
    v:2,file:meta.name,version:meta.version,encoding:meta.encoding,
    sheetTypes:ST.map(function(t,i){return {n:i+1,type:t.type,label:t.type?SHEET_AR[t.type]:null,title:t.title}}),
    blocks:{door:blocks.door,window:blocks.window,doorGuess:blocks.doorGuess,bySheet:Object.keys(blocks.sheets).map(function(k){return {sheet:+k,door:blocks.sheets[k].door,window:blocks.sheets[k].window}}),names:Object.keys(blocks.names).map(function(k){var a=k.split('|');return {kind:a[0],name:a[1],n:blocks.names[k]}})},
    walls:walls,tags:tags,checks:checks,
    units:{name:unit[0],toMeter:f,guessed:guess,insunits:u||null},
    extents_m:{w:r2((bb.x1-bb.x0)*f),h:r2((bb.y1-bb.y0)*f)},
    layers:Object.keys(P.layers).map(function(k){return {name:k,n:P.layers[k]}}).sort(function(a,b){return b.n-a.n}).slice(0,120),
    sheets:cls.map(function(c,i){return {n:i+1,w:r2((c.box.x1-c.box.x0)*f),h:r2((c.box.y1-c.box.y0)*f),titles:tl.filter(function(t){return t.sheet===i+1&&ARABIC.test(t.s)}).sort(function(a,b){return b.y-a.y}).slice(0,6).map(function(t){return t.s})}}),
    rooms:rooms,dims:dims,levels:levels.map(function(t){return {s:t.s,sheet:t.sheet}}),texts:tl,
    truncated:P.truncated
  };
}


/* 6ب. فهم أعمق للرسم: أنواع اللوحات، والأبواب والنوافذ، والجدران، ورموز الفتحات، وفحوص الاتساق */
var SHEET_RX=[['elevation',/واجهة|واجهه|ELEVATION/i],['section',/قطاع|مقطع|SECTION/i],['site',/موقع عام|الموقع العام|SITE\s*PLAN|LAYOUT\s*PLAN/i],['roof',/مسقط السطح|مسقط سطح|ROOF\s*PLAN/i],['plan',/مسقط|الدور|الطابق|الملحق|القبو|البدروم|PLAN|FLOOR/i],['detail',/تفصيل|تفاصيل|DETAIL/i]];
var SHEET_AR={elevation:'واجهة',section:'قطاع',site:'موقع عام',roof:'مسقط سطح',plan:'مسقط',detail:'تفاصيل'};
function sheetTypes(P,cls,which){
  var by={};P.texts.forEach(function(t){if(!t.top)return;var k=which(t.x,t.y);if(!k)return;(by[k]=by[k]||[]).push(t)});
  return cls.map(function(c,i){
    var ts=(by[i+1]||[]).filter(function(t){return t.s.length>=3&&t.s.length<=60}).sort(function(a,b){return b.h-a.h}).slice(0,12);
    for(var j=0;j<ts.length;j++)for(var r=0;r<SHEET_RX.length;r++)if(SHEET_RX[r][1].test(ts[j].s))return {type:SHEET_RX[r][0],title:ts[j].s.replace(/\n/g,' ')};
    return {type:null,title:ts.length?ts[0].s.replace(/\n/g,' '):''};
  });
}
function numOf(s){var m=String(s).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d)}).replace(/٫/g,'.').match(/[+\-±]?\s*\d+(?:[.,]\d+)?/);if(!m)return null;var t=m[0].replace(/\s/g,'').replace(',','.').replace('±','');var v=parseFloat(t);return isFinite(v)?{v:v,dec:(t.split('.')[1]||'').length}:null}

function blockStats(P,dxf,f,which,stype){
  var cache={};
  function arcDoor(name,sc){
    if(!(name in cache)){var b=dxf.blocks&&dxf.blocks[name],r=null;
      if(b){var arcs=(b.entities||[]).filter(function(e){return e.type==='ARC'});
        if(arcs.length>=1&&arcs.length<=2)arcs.forEach(function(a){var sw=a.endAngle-a.startAngle;if(sw<0)sw+=2*Math.PI;var deg=sw*180/Math.PI;if(deg>75&&deg<105)r=Math.max(r||0,a.radius)})}
      cache[name]=r}
    var rr=cache[name];return rr!=null&&rr*sc*f>0.45&&rr*sc*f<1.7;
  }
  var out={door:0,window:0,doorGuess:0,sheets:{},names:{}};
  P.inserts.forEach(function(ins){
    var k=ins.kind,guess=false;if(!k&&arcDoor(ins.name,ins.sx||1)){k='door';guess=true}
    if(!k)return;var sh=which(ins.x,ins.y),st=stype(sh);if(st&&st!=='plan'&&st!=='roof')return;
    out[k]++;if(guess)out.doorGuess++;
    var S=out.sheets[sh]=out.sheets[sh]||{door:0,window:0};S[k]++;
    var nm=/^\*/.test(ins.name)?'(كتلة بلا اسم)':ins.name;var key=k+'|'+nm;out.names[key]=(out.names[key]||0)+1;
  });
  return out;
}

var RX_WALL=/WALL|جدار|جدران|حائط|حوائط|حيطان/i;
function wallStats(P,f,which,stype){
  var segs=[];
  P.lines.forEach(function(L){if(!RX_WALL.test(L.l||''))return;for(var i=0;i<L.p.length-1&&segs.length<40000;i++){var a=L.p[i],b=L.p[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len*f<0.05)continue;
    var ang=Math.atan2(dy,dx);if(ang<0)ang+=Math.PI;if(ang>=Math.PI)ang-=Math.PI;var c=Math.cos(ang),sn=Math.sin(ang);
    var s1=c*a[0]+sn*a[1],s2=c*b[0]+sn*b[1];segs.push({ang:ang,off:-sn*a[0]+c*a[1],s1:Math.min(s1,s2),s2:Math.max(s1,s2),len:len,mx:(a[0]+b[0])/2,my:(a[1]+b[1])/2})}});
  if(!segs.length)return null;
  var B={};segs.forEach(function(g){var k=Math.round(g.ang*180/Math.PI)%180;(B[k]=B[k]||[]).push(g)});
  var hist={},bySheet={},total=0,paired=0;
  segs.forEach(function(g){total+=g.len*f});
  Object.keys(B).forEach(function(k){
    var list=B[k].concat(B[(+k+1)%180]||[]).sort(function(a,b){return a.off-b.off}),own=B[k];
    own.forEach(function(g){
      var best=null;
      for(var j=0;j<list.length;j++){var h=list[j];if(h===g)continue;var d=(h.off-g.off)*f;if(d<0.07||d>0.45)continue;if(Math.abs(h.ang-g.ang)>0.03)continue;
        var ov=Math.min(g.s2,h.s2)-Math.max(g.s1,h.s1);if(ov*f<0.3)continue;if(!best||d<best.d)best={d:d,ov:ov*f}}
      if(!best)return;
      var t=Math.round(best.d*100)/100;hist[t]=(hist[t]||0)+best.ov;paired+=best.ov;
      var sh=which(g.mx,g.my),st=stype(sh);if(st&&st!=='plan')return;var S=bySheet[sh]=bySheet[sh]||{};S[t]=(S[t]||0)+best.ov;
    });
  });
  function bins(h){var ks=Object.keys(h).map(Number).sort(function(a,b){return a-b}),out=[];ks.forEach(function(t){var last=out[out.length-1];if(last&&t-last.t<=0.015){last.len+=h[t]}else out.push({t:t,len:h[t]})});return out.filter(function(b){return b.len>=1}).sort(function(a,b){return b.len-a.len}).slice(0,6).map(function(b){return {t:b.t,len:r2(b.len)}})}
  return {total:r2(total),paired:r2(paired),byThk:bins(hist),bySheet:Object.keys(bySheet).map(function(k){return {sheet:+k,byThk:bins(bySheet[k])}})};
}

function tagStats(P,which,stype){
  var tags=P.texts.filter(function(t){return t.top&&TAG.test(t.s.replace(/\s+/g,''))}).map(function(t){var sh=which(t.x,t.y);return {k:tagKey(t.s),x:t.x,y:t.y,h:t.h||1,sheet:sh,st:stype(sh),sched:false}});
  var hasTitle={};P.texts.forEach(function(t){if(t.top&&/جدول\s*(ال)?(أبواب|ابواب|نوافذ|فتحات|شبابيك)|SCHEDULE/i.test(t.s))hasTitle[which(t.x,t.y)]=1});
  /* رموز مصفوفة عمودياً بمسافات متقاربة في لوحة فيها عنوان جدول = صفوف جدول الفتحات */
  var bySheet={};tags.forEach(function(t){(bySheet[t.sheet]=bySheet[t.sheet]||[]).push(t)});
  Object.keys(bySheet).forEach(function(k){if(!hasTitle[k])return;var L=bySheet[k].slice().sort(function(a,b){return a.x-b.x}),i=0;
    while(i<L.length){var g=[L[i]],j=i+1;while(j<L.length&&Math.abs(L[j].x-L[i].x)<=Math.max(L[i].h,L[j].h)*1.5){g.push(L[j]);j++}
      if(g.length>=3){var ys=g.map(function(t){return t.y}).sort(function(a,b){return a-b}),gaps=[];for(var q=1;q<ys.length;q++)gaps.push(ys[q]-ys[q-1]);var mean=gaps.reduce(function(a,b){return a+b},0)/gaps.length,sd=Math.sqrt(gaps.reduce(function(a,b){return a+(b-mean)*(b-mean)},0)/gaps.length);if(mean>0&&sd/mean<0.35)g.forEach(function(t){t.sched=true})}
      i=j}});
  function count(fn){var o={};tags.forEach(function(t){if(fn(t))o[t.k]=(o[t.k]||0)+1});return o}
  return {plan:count(function(t){return !t.sched&&(t.st==='plan'||t.st==='roof'||!t.st)}),elev:count(function(t){return !t.sched&&t.st==='elevation'}),sched:count(function(t){return t.sched}),
    perSheet:Object.keys(bySheet).map(function(k){var o={};bySheet[k].forEach(function(t){if(!t.sched)o[t.k]=(o[t.k]||0)+1});return {sheet:+k,tags:o}}).filter(function(x){return Object.keys(x.tags).length})};
}

function consistency(x,P,f,stype,sheetName,tags,blocks){
  var C=[];
  /* 1) بعد كُتب نصه يدوياً بقيمة تخالف قياسه الحقيقي في الرسم */
  var ov=P.dims.filter(function(d){return d.ov&&d.m!=null&&!isNaN(d.m)&&!(d.type%32===2||d.type%32===5)}),bad=[];
  ov.forEach(function(d){var n=numOf(d.t);if(!n)return;var c=[d.m*f,d.m*f*100,d.m*f*1000,d.m],tol=0.6*Math.pow(10,-n.dec);
    var ok=c.some(function(v){return Math.abs(Math.abs(n.v)-v)<=Math.max(tol,0.003*v)});
    if(!ok)bad.push(d)});
  bad.slice(0,25).forEach(function(d){C.push({kind:'in',state:'conflict',what:'بعد مكتوب «'+d.t+'» وقياسه الحقيقي في الرسم '+r2(d.m*f)+' م',where:sheetName(d.x!=null?x._which(d.x,d.y):0)})});
  if(!bad.length)C.push({kind:'in',state:'ok',what:ov.length?'الأبعاد المعدّل نصها يدوياً ('+ov.length+') تطابق قياسها في الرسم':'كل الأبعاد ('+P.dims.length+') معروضة بقيمتها المحسوبة من الرسم',where:''});
  else if(bad.length>25)C.push({kind:'in',state:'conflict',what:'و'+(bad.length-25)+' بعداً آخر بالحال نفسها',where:''});
  /* 2) المناسيب بين القطاعات والواجهات */
  var lv={section:[],elevation:[],plan:[]};x.levels.forEach(function(l){var t=stype(l.sheet),n=numOf(l.s);if(n&&lv[t])lv[t].push({v:/^\s*-/.test(l.s)?-Math.abs(n.v):n.v,s:l.s,sheet:l.sheet})});
  if(lv.section.length&&lv.elevation.length){var miss=0;
    lv.section.forEach(function(a){if(lv.elevation.some(function(b){return Math.abs(b.v-a.v)<0.005}))return;var near=lv.elevation.filter(function(b){return Math.abs(b.v-a.v)<=0.3}).sort(function(p,q){return Math.abs(p.v-a.v)-Math.abs(q.v-a.v)})[0];
      if(near){miss++;C.push({kind:'in',state:'check',what:'منسوب '+a.s+' في القطاع، وأقرب منسوب له في الواجهات '+near.s,where:sheetName(a.sheet)+' و'+sheetName(near.sheet)})}});
    if(!miss)C.push({kind:'in',state:'ok',what:'مناسيب القطاعات تطابق مناسيب الواجهات',where:''});
  }else C.push({kind:'in',state:'unchecked',what:'مقارنة المناسيب بين القطاعات والواجهات',where:'لم تُعرف في الملف لوحات قطاع وواجهة معاً بمناسيب مكتوبة'});
  /* 3) رموز الفتحات بين المساقط والجدول والواجهات */
  var PT=Object.keys(tags.plan),ST=Object.keys(tags.sched),ET=Object.keys(tags.elev);
  if(ST.length){var a1=PT.filter(function(k){return ST.indexOf(k)<0}),a2=ST.filter(function(k){return PT.indexOf(k)<0});
    a1.forEach(function(k){C.push({kind:'in',state:'conflict',what:'الرمز '+k+' في المساقط ('+tags.plan[k]+') غير موجود في جدول الفتحات',where:''})});
    a2.forEach(function(k){C.push({kind:'in',state:'check',what:'الرمز '+k+' في جدول الفتحات لا يظهر في المساقط',where:''})});
    if(!a1.length&&!a2.length)C.push({kind:'in',state:'ok',what:'رموز الفتحات في المساقط ('+PT.length+') كلها في جدول الفتحات',where:''});
  }else if(PT.length)C.push({kind:'in',state:'unchecked',what:'مطابقة رموز المساقط بجدول الفتحات',where:'لم يُعثر على جدول فتحات في الملف'});
  if(ET.length&&PT.length){var e1=ET.filter(function(k){return PT.indexOf(k)<0});e1.forEach(function(k){C.push({kind:'in',state:'check',what:'الرمز '+k+' في الواجهات لا يظهر في المساقط',where:''})})}
  /* 4) عدد كتل الأبواب والنوافذ مقابل رموزها المكتوبة في المساقط */
  function sumBy(rx){return PT.filter(function(k){return rx.test(k)}).reduce(function(a,k){return a+tags.plan[k]},0)}
  var dT=sumBy(/^(D|DR|SD|GD)\d/),wT=sumBy(/^(W|WN)\d/);
  if(blocks.door&&dT&&blocks.door!==dT)C.push({kind:'in',state:'check',what:'في المساقط '+blocks.door+' كتلة باب، و'+dT+' رمز باب مكتوب',where:''});
  else if(blocks.door&&dT)C.push({kind:'in',state:'ok',what:'عدد كتل الأبواب في المساقط ('+blocks.door+') يساوي رموزها المكتوبة',where:''});
  if(blocks.window&&wT&&blocks.window!==wT)C.push({kind:'in',state:'check',what:'في المساقط '+blocks.window+' كتلة نافذة، و'+wT+' رمز نافذة مكتوب',where:''});
  else if(blocks.window&&wT)C.push({kind:'in',state:'ok',what:'عدد كتل النوافذ في المساقط ('+blocks.window+') يساوي رموزها المكتوبة',where:''});
  return C;
}

/* 7. نص مختصر يقرؤه الفحص الآلي */
function summary(x){
  var L=[];
  L.push('ملف DXF: '+x.file+' · نسخة '+(x.version||'غير معروفة')+' · الوحدة: '+x.units.name+(x.units.guessed?' (مستنتجة من حجم الرسم، تحقق منها)':' (من رأس الملف)')+' · امتداد الرسم '+x.extents_m.w+' × '+x.extents_m.h+' م');
  if(x.sheets.length){L.push('');L.push('اللوحات المرسومة (لكل لوحة صورة معاينة بنفس الرقم):');x.sheets.forEach(function(s){var t=(x.sheetTypes||[])[s.n-1];L.push('لوحة '+s.n+(t&&t.label?' · نوعها: '+t.label+' («'+t.title+'»)':' · نوعها غير معروف')+': '+s.w+' × '+s.h+' م'+(s.titles.length?' · نصوصها البارزة: '+s.titles.join(' | '):''))})}
  if(x.checks&&x.checks.length){L.push('');L.push('فحوص اتساق آلية داخل الملف (حسابية من الرسم نفسه، فاعتمدها كما هي في قسم اتساق المخطط):');
    var ST={ok:'متسق',conflict:'متعارض',check:'للتحقق',unchecked:'لم يُفحص'};x.checks.forEach(function(c){L.push('- ['+ST[c.state]+'] '+c.what+(c.where?' · '+c.where:''))})}
  var B=x.blocks;if(B&&(B.door||B.window)){L.push('');L.push('الأبواب والنوافذ معدودة من كتل الرسم في المساقط (عدّ آلي من الملف، أدق من العدّ بالنظر'+(B.doorGuess?'؛ منها '+B.doorGuess+' باباً عُرف من قوس فتحته لا من اسمه':'')+'): أبواب '+B.door+'، نوافذ '+B.window);
    B.bySheet.forEach(function(b){L.push('- لوحة '+b.sheet+': أبواب '+b.door+'، نوافذ '+b.window)});
    if(B.names.length)L.push('أسماء الكتل: '+B.names.map(function(n){return n.name+' ('+(n.kind==='door'?'باب':'نافذة')+') ×'+n.n}).join('، '))}
  var T=x.tags;if(T&&Object.keys(T.plan).length){L.push('');L.push('رموز الفتحات المكتوبة في المساقط (دون صفوف الجداول) وأعدادها: '+Object.keys(T.plan).sort().map(function(k){return k+'×'+T.plan[k]}).join('، '));
    if(Object.keys(T.sched).length)L.push('رموز جدول الفتحات: '+Object.keys(T.sched).sort().join('، '));
    T.perSheet.forEach(function(p){L.push('- لوحة '+p.sheet+': '+Object.keys(p.tags).sort().map(function(k){return k+'×'+p.tags[k]}).join('، '))})}
  var W=x.walls;if(W&&W.total){L.push('');L.push('الجدران من طبقات الجدران: مجموع أطوال خطوطها '+W.total+' م، والمزدوج منها (خطان متوازيان) بطول محوري '+W.paired+' م. سماكاتها المقيسة من المسافة بين الخطين (تقدير هندسي): '+W.byThk.map(function(b){return b.t+' م: '+b.len+' م'}).join('، '));
    W.bySheet.forEach(function(b){L.push('- لوحة '+b.sheet+': '+b.byThk.map(function(t){return t.t+' م: '+t.len+' م'}).join('، '))})}
  L.push('');L.push('الفراغات المغلقة (مضلعات مغلقة أو حدود تهشير) بمساحاتها المحسوبة من الملف، م²، مع النصوص الواقعة داخلها:');
  x.rooms.slice(0,250).forEach(function(r){L.push('- لوحة '+r.sheet+' · '+(r.names.length?r.names.join(' / '):'بلا اسم')+' · '+r.area+' م² · '+(r.rect?'مستطيل ':'الإطار ')+r.w+' × '+r.h+' م · طبقة '+r.layer+(r.src==='hatch'?' · من التهشير':''))});
  if(x.dims.length){L.push('');L.push('الأبعاد المسجلة في الملف (قيمة البعد الفعلية بالمتر، والنص الظاهر إن عُدّل):');
    x.dims.slice(0,400).forEach(function(d){L.push('- لوحة '+d.sheet+' · '+(d.angle?d.v+'°':d.v+' م')+(d.t?' · مكتوب: '+d.t:''))})}
  if(x.levels.length){L.push('');L.push('المناسيب المكتوبة: '+x.levels.map(function(l){return l.s+' (لوحة '+l.sheet+')'}).join('، '))}
  L.push('');L.push('النصوص في الرسم (النص × عدد تكراره · لوحته):');
  x.texts.slice(0,600).forEach(function(t){L.push('- '+t.s+(t.n>1?' ×'+t.n:'')+' · لوحة '+t.sheet)});
  L.push('');L.push('الطبقات: '+x.layers.map(function(l){return l.name+' ('+l.n+')'}).join('، '));
  if(x.truncated)L.push('تنبيه: الملف كبير، فقُرئ جزء من عناصره فقط.');
  var s=L.join('\n');return s.length>90000?s.slice(0,90000)+'\n..':s;
}

/* 8. الواجهة */
function analyse(d,dxf,name){
  var P=collect(dxf),raw=rawScan(d.text);
  raw.attribs.forEach(function(a){var str=clean(a.s);if(str)P.texts.push({s:str,x:a.x,y:a.y,h:a.h||1,l:a.l,mt:false,ha:0,va:0,rot:0,top:true,attr:a.tag})});
  var bb=bboxOf(P);if(!bb)throw new Error('empty');
  var cls=clusters(P,bb);if(!cls.length)cls=[{box:bb,n:0}];
  var x=extract(P,dxf,{name:name,version:d.version,encoding:d.encoding},bb,cls,raw);
  x.text=summary(x);
  return {P:P,bb:bb,cls:cls,x:x};
}
function process(file){
  return file.arrayBuffer().then(function(buf){
    var d=decode(buf),dxf=new (window.DxfParser.default||window.DxfParser)().parseSync(d.text);
    if(!dxf)throw new Error('parse_failed');
    var r=analyse(d,dxf,file.name),P=r.P,bb=r.bb,cls=r.cls,x=r.x;
    var jobs=[];
    var boxes=cls.length>1?cls.map(function(c){return c.box}):[bb];
    if(cls.length>1)boxes.unshift(bb);
    boxes.forEach(function(b,i){jobs.push(toBlob(render(P,b,i===0&&cls.length>1?1800:2200)).then(function(r){r.label=cls.length>1?(i===0?'نظرة عامة':'لوحة '+i):'الرسم كاملاً';return r}))});
    return Promise.all(jobs).then(function(imgs){return {extract:x,images:imgs}});
  });
}

/* 7. نموذج المسقط التفاعلي: لكل لوحة مسقط خطوطها وفراغاتها المغلقة بأسمائها، بالمتر ومن زاوية اللوحة،
   لتُرسم في «مسقط بيتك». الخطوط تُختصر إلى قطع مستقيمة بحد أعلى، وتُستبعد طبقات الأبعاد والمحاور والنصوص */
var SKIP_LAYER=/DIM|ANNO|TEXT|HATCH|GRID|AXIS|DEFPOINTS|TITLE|BORDER|FRAME|ابعاد|أبعاد|محاور|نص|اطار|إطار/i;
var NUMONLY=/^[\d\s.,x×*+\-±%:/()]+$/;
function planModel(buf,name){
  var d=decode(buf),dxf=new (window.DxfParser.default||window.DxfParser)().parseSync(d.text);
  if(!dxf)throw new Error('parse_failed');
  var P=collect(dxf),raw=rawScan(d.text);
  var bb=bboxOf(P);if(!bb)throw new Error('empty');
  var cls=clusters(P,bb);if(!cls.length)cls=[{box:bb,n:0}];
  var x=extract(P,dxf,{name:name,version:d.version,encoding:d.encoding},bb,cls,raw),f=x.units.toMeter;
  var sheets=cls.map(function(c,i){
    var b=c.box,inBox=function(px,py){return px>=b.x0&&px<=b.x1&&py>=b.y0&&py<=b.y1};
    var T=function(p){return [r2((p[0]-b.x0)*f),r2((p[1]-b.y0)*f)]};
    var segs=[],cap=14000;
    for(var li=0;li<P.lines.length&&segs.length<cap;li++){var L=P.lines[li];if(SKIP_LAYER.test(L.l||''))continue;
      var cx=0,cy=0;L.p.forEach(function(p){cx+=p[0];cy+=p[1]});cx/=L.p.length;cy/=L.p.length;if(!inBox(cx,cy))continue;
      for(var k=0;k<L.p.length-1&&segs.length<cap;k++){var a=T(L.p[k]),e=T(L.p[k+1]);if(Math.abs(a[0]-e[0])+Math.abs(a[1]-e[1])<0.02)continue;segs.push([a[0],a[1],e[0],e[1]])}}
    var labels=P.texts.filter(function(t){return t.top&&inBox(t.x,t.y)&&!NUMONLY.test(t.s)&&t.s.length<=40});
    var cand=[];
    function addRoom(poly,src){
      var a=area(poly)*f*f;if(a<1.2||a>600)return;
      var names=labels.filter(function(t){return inside([t.x,t.y],poly)}).map(function(t){return t.s.replace(/\n/g,' ').trim()}).filter(Boolean);
      var mx=0,my=0;poly.forEach(function(p){mx+=p[0];my+=p[1]});mx/=poly.length;my/=poly.length;
      if(cand.some(function(r){return Math.abs(r.a-a)<=Math.max(0.02*a,0.1)&&Math.hypot(r.mx-mx,r.my-my)*f<0.3}))return;
      cand.push({poly:poly,a:a,mx:mx,my:my,names:names,src:src});
    }
    P.closed.forEach(function(c2){var mx=0,my=0;c2.p.forEach(function(p){mx+=p[0];my+=p[1]});mx/=c2.p.length;my/=c2.p.length;if(inBox(mx,my)&&!SKIP_LAYER.test(c2.l||''))addRoom(c2.p,'poly')});
    (raw&&raw.hatches||[]).forEach(function(h){var best=null,ba=0;h.paths.forEach(function(pp){var c3=pp.slice();if(c3.length&&(c3[0][0]!==c3[c3.length-1][0]||c3[0][1]!==c3[c3.length-1][1]))c3.push(c3[0]);var a=area(c3);if(a>ba){ba=a;best=c3}});
      if(!best)return;var mx=0,my=0;best.forEach(function(p){mx+=p[0];my+=p[1]});mx/=best.length;my/=best.length;if(inBox(mx,my))addRoom(best,'hatch')});
    /* الحدود الخارجية للمبنى والإطارات: مضلع يحتوي مراكز فراغين فأكثر ليس فراغاً */
    var rooms=cand.filter(function(r){var inner=cand.filter(function(o){return o!==r&&o.a<r.a&&inside([o.mx,o.my],r.poly)});return inner.length<2})
      .map(function(r,ri){return {id:'d'+i+'_'+ri,names:r.names.slice(0,3),area:r2(r.a),poly:r.poly.map(T),src:r.src}});
    var st=x.sheetTypes[i]||{};
    return {n:i+1,type:st.type||null,title:st.title||'',w:r2((b.x1-b.x0)*f),h:r2((b.y1-b.y0)*f),segs:segs,rooms:rooms,named:rooms.filter(function(r){return r.names.length}).length};
  });
  if(cls.length===1)sheets[0].type=sheets[0].type||'plan';
  return {file:name,units:x.units,sheets:sheets};
}
/* للاختبار في Node: قراءة نص الملف دون رسم */
function extractText(buf,name){var d=decode(buf),dxf=new (window.DxfParser.default||window.DxfParser)().parseSync(d.text);if(!dxf)throw new Error('parse_failed');return analyse(d,dxf,name).x}
window.BBDXF={process:process,extractText:extractText,planModel:planModel,_debug:{decode:decode,clean:clean,rawScan:rawScan,nameKind:nameKind}};
})();
