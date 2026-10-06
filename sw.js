/* عامل الخدمة: يستقبل إشعارات الجوال ويعرضها، ويفتح لوحة الإدارة عند الضغط عليها. لا يخزّن صفحات الموقع. */
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('push',function(e){
  var d={};try{d=e.data?e.data.json():{}}catch(x){d={title:'البيت بيتك',body:e.data?e.data.text():''}}
  var base=self.registration.scope;
  e.waitUntil(self.registration.showNotification(d.title||'البيت بيتك',{
    body:d.body||'',dir:'rtl',lang:'ar',tag:d.tag||undefined,renotify:!!d.tag,
    icon:base+'assets/img/icon-192.png',badge:base+'assets/img/icon-192.png',data:{url:d.url||base+'admin/'}
  }));
});
self.addEventListener('notificationclick',function(e){
  e.notification.close();var url=(e.notification.data&&e.notification.data.url)||self.registration.scope+'admin/';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){var c=list[i];if(c.url.indexOf(url)===0&&'focus' in c)return c.focus()}
    return self.clients.openWindow(url);
  }));
});
