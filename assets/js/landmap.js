/* خريطة الأرض في دليل اختيار الأرض: رسم حدود الأرض، وحساب أضلاعها واتجاه كل واجهة،
   وساعات الشمس على كل واجهة صيفاً وشتاءً، واتجاه القبلة، والخدمات القريبة من خريطة مفتوحة.
   الحسابات هندسية وفلكية تجري في المتصفح، ولا تُرسل حدود الأرض إلا إلى حساب المستخدم. */
(function(){
var R2D=180/Math.PI,D2R=Math.PI/180;
var KAABA=[21.422487,39.826206];
var DIRS=['الشمال','الشمال الشرقي','الشرق','الجنوب الشرقي','الجنوب','الجنوب الغربي','الغرب','الشمال الغربي'];
function dirName(az){return DIRS[Math.round(((az%360)+360)%360/45)%8]}
/* إسقاط محلي بالمتر حول نقطة مرجعية */
function proj(pts){var la=0,lo=0;pts.forEach(function(p){la+=p[0];lo+=p[1]});la/=pts.length;lo/=pts.length;
  var kx=111320*Math.cos(la*D2R),ky=110540;return {c:[la,lo],xy:pts.map(function(p){return [(p[1]-lo)*kx,(p[0]-la)*ky]})}}
function geom(pts){
  if(!pts||pts.length<3)return null;var P=proj(pts),xy=P.xy,n=xy.length,A=0,per=0,edges=[];
  for(var i=0;i<n;i++){var a=xy[i],b=xy[(i+1)%n];A+=a[0]*b[1]-b[0]*a[1]}
  var ccw=A>0;A=Math.abs(A)/2;
  for(i=0;i<n;i++){var a=xy[i],b=xy[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);per+=L;
    /* العمودي الخارجي: يمين الضلع إن كان الترتيب عكس عقارب الساعة */
    var nx=ccw?dy:-dy,ny=ccw?-dx:dx;var az=(Math.atan2(nx,ny)*R2D+360)%360;
    edges.push({i:i,len:L,az:az,dir:dirName(az),mid:[(pts[i][0]+pts[(i+1)%n][0])/2,(pts[i][1]+pts[(i+1)%n][1])/2]})}
  return {area:A,per:per,edges:edges,c:P.c};
}
/* موقع الشمس (معادلات تقريبية بدقة تكفي لحساب ساعات الشمس) */
function sun(ms,lat,lon){
  var d=ms/864e5+2440587.5-2451545.0,g=(357.529+0.98560028*d)*D2R,q=280.459+0.98564736*d,
      L=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*D2R,e=(23.439-0.00000036*d)*D2R,
      ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L)),
      gmst=(18.697374558+24.06570982441908*d)%24,H=((gmst*15+lon)*D2R-ra),la=lat*D2R;
  H=Math.atan2(Math.sin(H),Math.cos(H));
  var alt=Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(H));
  var az=(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(la)-Math.tan(dec)*Math.cos(la))*R2D+180+360)%360;
  return {alt:alt*R2D,az:az,H:H};
}
/* ساعات الشمس المباشرة على واجهة في يوم معين، ومنها ما بعد الظهر */
function sunHours(c,az,y,m,day){
  var t0=Date.UTC(y,m-1,day,0,0)-3*3600e3,tot=0,pm=0,step=5;
  for(var k=0;k<24*60;k+=step){var s=sun(t0+k*6e4,c[0],c[1]);if(s.alt<=2)continue;
    if(Math.cos((s.az-az)*D2R)>0.05){tot+=step;if(s.H>0)pm+=step}}
  return {t:tot/60,pm:pm/60};
}
function bearing(a,b){var f1=a[0]*D2R,f2=b[0]*D2R,dl=(b[1]-a[1])*D2R;
  return (Math.atan2(Math.sin(dl)*Math.cos(f2),Math.cos(f1)*Math.sin(f2)-Math.sin(f1)*Math.cos(f2)*Math.cos(dl))*R2D+360)%360}
function dist(a,b){var R=6371000,f1=a[0]*D2R,f2=b[0]*D2R,df=(b[0]-a[0])*D2R,dl=(b[1]-a[1])*D2R;
  var h=Math.sin(df/2)*Math.sin(df/2)+Math.cos(f1)*Math.cos(f2)*Math.sin(dl/2)*Math.sin(dl/2);return 2*R*Math.asin(Math.sqrt(h))}
/* إحداثيات من نص أو رابط خرائط */
function parseLoc(s){s=String(s||'').trim();var m=/@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s)||/[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(s)||/^(-?\d+\.\d+)\s*[,،\s]\s*(-?\d+\.\d+)$/.exec(s);
  if(!m)return null;var a=+m[1],b=+m[2];if(Math.abs(a)>90)return null;return [a,b]}

/* الخدمات القريبة: استعلام واحد لكل أرض عند الطلب، من بيانات OpenStreetMap المفتوحة */
var CATS=[
  {k:'mosque',t:'مسجد',q:'nwr["amenity"="place_of_worship"]["religion"="muslim"]'},
  {k:'school',t:'مدرسة أو روضة',q:'nwr["amenity"~"^(school|kindergarten)$"]'},
  {k:'health',t:'مستشفى أو مستوصف أو صيدلية',q:'nwr["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]'},
  {k:'shop',t:'بقالة أو سوق',q:'nwr["shop"~"^(supermarket|convenience|mall|greengrocer|bakery)$"]'},
  {k:'park',t:'حديقة أو ممشى',q:'nwr["leisure"~"^(park|playground)$"]'},
  {k:'road',t:'طريق رئيسي',q:'way["highway"~"^(motorway|trunk|primary|secondary)$"]'},
  {k:'fuel',t:'محطة وقود',q:'nwr["amenity"="fuel"]'}
];
function services(c){
  var r=2000,body='[out:json][timeout:25];('+CATS.map(function(x){return x.q+'(around:'+r+','+c[0]+','+c[1]+');'}).join('')+');out center tags 400;';
  return fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(body),headers:{'Content-Type':'application/x-www-form-urlencoded'}})
    .then(function(x){if(!x.ok)throw new Error(x.status);return x.json()}).then(function(j){
      var out={};CATS.forEach(function(x){out[x.k]={n1:0,near:null}});
      (j.elements||[]).forEach(function(e){var p=e.lat!=null?[e.lat,e.lon]:e.center?[e.center.lat,e.center.lon]:null;if(!p)return;var t=e.tags||{},k=null;
        if(t.amenity==='place_of_worship')k='mosque';else if(/^(school|kindergarten)$/.test(t.amenity))k='school';else if(/^(hospital|clinic|doctors|pharmacy)$/.test(t.amenity))k='health';
        else if(t.shop)k='shop';else if(t.leisure)k='park';else if(t.highway)k='road';else if(t.amenity==='fuel')k='fuel';if(!k)return;
        var d=dist(c,p),o=out[k];if(d<=1000)o.n1++;if(!o.near||d<o.near.d)o.near={d:Math.round(d),name:t['name:ar']||t.name||''}});
      return out});
}
window.LM={geom:geom,sun:sun,sunHours:sunHours,bearing:bearing,dist:dist,parseLoc:parseLoc,services:services,CATS:CATS,KAABA:KAABA,dirName:dirName};
})();
