/* الدخول الموحد والصلاحيات: من يرى ماذا في «البيت بيتك».
   أي أداة جديدة تُضاف هنا مع الأنواع التي تظهر لها، ولا تظهر لغيرهم. */
(function(){
var ROLE={admin:'مدير النظام',office:'مكتب هندسي',contractor:'مقاول',owner:'صاحب بيت'};
var ALL=['owner','contractor','office','admin'];
var TOOLS=[
  {id:'admin',  name:'لوحة الإدارة',               desc:'الحسابات وطلبات الفحص والتقارير.',                      href:'admin/',                roles:['admin'],               live:true},
  {id:'fahs',   name:'الفحص الفني',                desc:'ارفع المخطط قبل الأمانة، وتابع طلباتك وتقاريرك.',      href:'fahs/app.html',         roles:['office','admin'],      live:true},
  {id:'t01',    name:'أسئلة الجلسة الأولى مع مصممك', desc:'عشرون سؤالاً تكشف من أمامك.. قبل أن توقع',            href:'tools/first-session/',  roles:['owner','admin'],       live:true},
  {id:'t02',    name:'دليل اختيار الأرض',           desc:'ما تفحصه قبل أن تشتري أرض بيت العمر',                 href:'tools/land/',           roles:['owner','admin'],       live:true},
  {id:'t08',    name:'جداول الكميات والتكاليف',     desc:'من فراغات بيتك إلى كميات التشطيب وتكلفتها.. وميزانيتك بنداً بنداً', href:'tools/quantities/', roles:ALL, live:true},
  {id:'t03',    name:'خمسون سؤالاً قبل أن تصمم بيتك', desc:'حدد احتياجك الحقيقي.. قبل أول لقاء وقبل أول خط',     href:'tools/fifty/',          roles:['owner','admin'],       live:true},
  {id:'t04',    name:'اختبار القرار الذكي',          desc:'ستة أسئلة ونتيجة واحدة.. قبل أي جهاز «ذكي»',          href:'tools/smart/',                      roles:['owner','admin'],       live:true},
  {id:'t05',    name:'خارطة بنود تنفيذ بيتك',        desc:'عشر محطات بتسلسل التنفيذ الصحيح: اتفق.. واستلم.. ووثق', href:'tools/roadmap/',                     roles:['owner','contractor','admin'], live:true},
  {id:'t06',    name:'نموذج اتفاق البند الواحد',     desc:'صفحة تحميك.. تملؤها مع كل مقاول قبل أول يوم عمل',      href:'tools/agreement/',                      roles:['owner','contractor','admin'], live:true},
  {id:'t09',    name:'جدول مقارنة عروض المقاولين',   desc:'للبند الواحد.. قبل الترسية',                          href:'tools/offers/',                      roles:['owner','admin'],       live:true},
  {id:'t07',    name:'ملف بيتك: الاستلام والسجلات',  desc:'قائمة الاستلام النهائي.. وسجلات هوية البيت',            href:'tools/handover/',                      roles:['owner','admin'],       live:true},
  {id:'t10',    name:'دفتر السنة الأولى',            desc:'سجل ملاحظات بيتك.. قبل أن تكبر وقبل أن تُنسى',          href:'tools/first-year/',                      roles:['owner','admin'],       live:true}
];
function toolsFor(role){return TOOLS.filter(function(t){return t.roles.indexOf(role)>=0})}
function load(){
  return BB.auth.getSession().then(function(r){
    var s=r.data&&r.data.session;if(!s)return {user:null,profile:null};
    return BB.from('profiles').select('*').eq('id',s.user.id).maybeSingle().then(function(p){return {user:s.user,profile:p.data||null}});
  });
}
/* تحرس الصفحة: من لم يُعتمد بنوع مسموح يُعاد إلى صفحة الدخول */
function guard(roles,accountUrl){
  return load().then(function(a){
    var p=a.profile,ok=a.user&&p&&p.status==='approved'&&(p.role==='admin'||roles.indexOf(p.role)>=0);
    if(!ok){location.replace(accountUrl);return new Promise(function(){})}
    BB.auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT')location.replace(accountUrl)});
    return a;
  });
}
window.BBA={ROLE:ROLE,TOOLS:TOOLS,toolsFor:toolsFor,load:load,guard:guard};
})();
