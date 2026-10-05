/* أدوات مشتركة لأدوات رحلة بيت العمر: الحفظ في الجهاز، وبناء العناصر، والأرقام العربية، والطباعة، وإعادة البدء */
(function(){
var AR='٠١٢٣٤٥٦٧٨٩';
function ar(n){return String(n)}
function toEn(s){return String(s==null?'':s).replace(/[٠-٩]/g,function(d){return AR.indexOf(d)}).replace(/[,٬\s]/g,'').replace(/٫/g,'.').replace(/[^\d.\-]/g,'')}
function num(s){var v=parseFloat(toEn(s));return isFinite(v)?v:0}
function fmt(n,dec){if(n==null||!isFinite(n))return '';var d=dec==null?2:dec;var s=(Math.round(n*Math.pow(10,d))/Math.pow(10,d)).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:0});return s}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function $(id){return document.getElementById(id)}
function store(key,fresh,version){
  var S=null;try{S=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
  if(!S||S.v!==version)S=fresh();
  var t=null,fl=null,dirty=false;
  function write(){clearTimeout(t);if(!dirty)return;dirty=false;try{localStorage.setItem(key,JSON.stringify(S));flash('حُفظ في هذا الجهاز')}catch(e){flash('تعذر الحفظ في هذا المتصفح')}}
  window.addEventListener('pagehide',write);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')write()});
  function flash(msg){var s=$('saved');if(!s)return;s.textContent=msg;clearTimeout(fl);fl=setTimeout(function(){s.textContent=''},1800)}
  return {
    get:function(){return S},
    set:function(v){S=v},
    save:function(){dirty=true;clearTimeout(t);t=setTimeout(write,250)},
    clear:function(){S=fresh();dirty=false;clearTimeout(t);try{localStorage.removeItem(key)}catch(e){};return S},
    flash:flash
  };
}
function resetButton(btn,onReset,armedLabel){
  var armed=false,t=null,label=btn.textContent;
  btn.addEventListener('click',function(){
    if(!armed){armed=true;btn.textContent=armedLabel||'اضغط مرة ثانية لمسح كل شيء';clearTimeout(t);t=setTimeout(function(){armed=false;btn.textContent=label},4000);return}
    armed=false;btn.textContent=label;onReset();
  });
}
function grow(ta){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight+2,360)+'px'}
function rename(current,cb){
  var d=$('dlg'),inp=$('dlgIn');
  if(!d||typeof d.showModal!=='function'){var v=window.prompt('الاسم',current);if(v&&v.trim())cb(v.trim().slice(0,40));return}
  inp.value=current;d.returnValue='';d.showModal();inp.select();
  d.onclose=function(){if(d.returnValue==='ok'&&inp.value.trim())cb(inp.value.trim().slice(0,40))};
}
function csv(rows,name){
  var s='﻿'+rows.map(function(r){return r.map(function(c){c=c==null?'':String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}
window.TK={ar:ar,num:num,toEn:toEn,fmt:fmt,el:el,$:$,store:store,resetButton:resetButton,grow:grow,rename:rename,csv:csv};
})();
