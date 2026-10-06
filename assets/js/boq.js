/* عرض جدول الكميات وتصديره: البيانات تأتي من boq_docs.data
   {date, price_date, basis, sections:[{div,name,items:[{code,name,unit,qty,est,rate,amount,spec,note}]}], assumptions:[], excluded:[]} */
(function(){
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function n(v,d){return v==null||v===''||isNaN(v)?'':Number(v).toLocaleString('en-US',{maximumFractionDigits:d==null?2:d})}
function amt(i){return i.amount!=null?i.amount:(i.qty!=null&&i.rate!=null?i.qty*i.rate:null)}
function totals(D){var T=0,est=0,meas=0,unpriced=0;(D.sections||[]).forEach(function(s){s.total=0;(s.items||[]).forEach(function(i){var a=amt(i);if(a!=null){s.total+=a;T+=a}else unpriced++;if(i.est)est++;else meas++})});return {T:T,est:est,meas:meas,unpriced:unpriced}}
function render(D,host){
  host.innerHTML='';var t=totals(D);
  var k=el('div','boq-kpis');
  [['الإجمالي التقديري',n(Math.round(t.T),0)+' ريال'],['بنود مقيسة من المخطط',String(t.meas)],['بنود مقدّرة',String(t.est)],['بنود تُسعّر بعرض',String(t.unpriced)]].forEach(function(x){var d=el('div');d.appendChild(el('span',null,x[0]));d.appendChild(el('b',null,x[1]));k.appendChild(d)});
  host.appendChild(k);
  if(D.basis)host.appendChild(el('p','boq-basis',D.basis));
  (D.sections||[]).forEach(function(s){
    var h=el('div','boq-sec');h.appendChild(el('h3',null,s.div+' · '+s.name));h.appendChild(el('span',null,n(Math.round(s.total),0)+' ريال'));host.appendChild(h);
    var w=el('div','tbl-wrap'),tb=el('table','tbl boq-t'),th=el('thead'),tr=el('tr');
    ['البند','الوصف والمواصفة','الوحدة','الكمية','سعر الوحدة','المبلغ'].forEach(function(x){tr.appendChild(el('th',null,x))});th.appendChild(tr);tb.appendChild(th);
    var body=el('tbody');
    (s.items||[]).forEach(function(i){
      var r=el('tr');r.appendChild(el('td','mono',i.code));
      var c=el('td','boq-d');c.appendChild(el('b',null,i.name));if(i.spec){var d=el('details');d.appendChild(el('summary',null,'المواصفة'));d.appendChild(el('p',null,i.spec));c.appendChild(d)}
      if(i.note)c.appendChild(el('small',null,i.note));if(i.est)c.appendChild(el('em','est','كمية تقديرية'));r.appendChild(c);
      r.appendChild(el('td',null,i.unit));r.appendChild(el('td','num',n(i.qty)));
      r.appendChild(el('td','num',i.rate!=null?n(i.rate):'بعرض'));r.appendChild(el('td','num',n(amt(i),0)));body.appendChild(r)});
    tb.appendChild(body);w.appendChild(tb);host.appendChild(w)});
  var f=el('div','boq-tot');f.appendChild(el('span',null,'الإجمالي التقديري للبنود المسعّرة'));f.appendChild(el('b',null,n(Math.round(t.T),0)+' ريال'));host.appendChild(f);
  [['افتراضات الجدول',D.assumptions],['خارج الجدول',D.excluded]].forEach(function(x){if(!x[1]||!x[1].length)return;var b=el('div','boq-notes');b.appendChild(el('h4',null,x[0]));var ul=el('ul');x[1].forEach(function(s){ul.appendChild(el('li',null,s))});b.appendChild(ul);host.appendChild(b)});
  host.appendChild(el('p','boq-basis','الأسعار تقديرية من مكتبة البنود بمصادرها'+(D.price_date?' (أسعار '+D.price_date+')':'')+'، والكميات تُراجع مع المخططات المعتمدة قبل الطرح.'));
}
function csv(D,name){
  var rows=[['القسم','البند','الوصف','الوحدة','الكمية','سعر الوحدة','المبلغ','تقديرية','المواصفة','ملاحظة']];
  (D.sections||[]).forEach(function(s){(s.items||[]).forEach(function(i){rows.push([s.name,i.code,i.name,i.unit,i.qty,i.rate,amt(i),i.est?'نعم':'',i.spec||'',i.note||''])})});
  var t='﻿'+rows.map(function(r){return r.map(function(c){c=c==null?'':String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}
window.BOQ={render:render,csv:csv,totals:totals};
})();
