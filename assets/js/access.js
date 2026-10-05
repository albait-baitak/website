/* الدخول الموحد والصلاحيات: من يرى ماذا في «البيت بيتك».
   أي أداة جديدة تُضاف هنا مع الأنواع التي تظهر لها، ولا تظهر لغيرهم. */
(function(){
var ROLE={admin:'مدير النظام',office:'مكتب هندسي',contractor:'مقاول',owner:'صاحب بيت'};
var TOOLS=[
  {id:'admin',  name:'لوحة الإدارة',          desc:'الحسابات وطلبات الفحص والتقارير.',                         href:'admin/',         roles:['admin'],                         live:true},
  {id:'fahs',   name:'الفحص الفني',           desc:'ارفع المخطط قبل الأمانة، وتابع طلباتك وتقاريرك.',         href:'fahs/app.html',  roles:['office','admin'],                live:true},
  {id:'program',name:'مولد البرنامج المعماري', desc:'برنامج الفراغات ومساحاتها من أسئلة أسرتك وأيامك.',       href:'',               roles:['owner','admin'],                 live:false},
  {id:'boq',    name:'جداول الكميات',         desc:'كميات البناء والتشطيب من بيانات البيت.',                 href:'',               roles:['owner','contractor','office','admin'], live:false},
  {id:'exec',   name:'إدارة التنفيذ',          desc:'مراحل البناء ونقاط الاستلام في كل مرحلة.',               href:'',               roles:['owner','contractor','admin'],    live:false},
  {id:'maint',  name:'الصيانة والتشغيل',       desc:'جدول صيانة للبيت بأنظمته ومواده.',                       href:'',               roles:['owner','admin'],                 live:false}
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
