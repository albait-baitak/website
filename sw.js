/* عامل الخدمة: يستقبل الإشعارات ويعرضها، ويفتح عند الضغط المكان المقصود بالضبط (الطلب أو المشروع).
   إن كانت للموقع نافذة مفتوحة يُعاد استخدامها بدل فتح نافذة جديدة. لا يخزّن صفحات الموقع. */
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('push',function(e){
  var d={};try{d=e.data?e.data.json():{}}catch(x){d={title:'البيت بيتك',body:e.data?e.data.text():''}}
  var base=self.registration.scope;
  e.waitUntil(self.registration.showNotification(d.title||'البيت بيتك',{
    body:d.body||'',dir:'rtl',lang:'ar',tag:d.tag||undefined,renotify:!!d.tag,
    icon:base+'assets/img/icon-192.png',badge:base+'assets/img/icon-192.png',data:{url:d.url||base}
  }));
});
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  var scope=self.registration.scope,url=(e.notification.data&&e.notification.data.url)||scope;
  var page=url.split('#')[0];
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    var same=null,any=null;
    list.forEach(function(c){if(c.url.indexOf(scope)!==0)return;if(!same&&c.url.split('#')[0]===page)same=c;if(!any)any=c});
    /* الصفحة نفسها مفتوحة: نركّز عليها ونخبرها بالوجهة (الطلب أو المشروع) */
    if(same&&'focus' in same)return same.focus().then(function(w){(w||same).postMessage({go:url});return w});
    /* نافذة أخرى من الموقع (مثل تطبيق الشاشة الرئيسية): ننقلها إلى الوجهة */
    if(any&&'navigate' in any)return any.focus().then(function(){return any.navigate(url)}).catch(function(){return self.clients.openWindow(url)});
    return self.clients.openWindow(url);
  }));
});
