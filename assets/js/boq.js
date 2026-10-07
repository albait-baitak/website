/* عرض جدول الكميات وتصديره: البيانات تأتي من boq_docs.data
   {v, date, price_date, basis, areas:{built_m2}, sections:[{div,name,items:[{code,name,unit,qty,est,info,rate,low,high,amount,calc,spec,note}]}],
    total, checks:[{name,value,expected,ok,note}], assumptions:[], questions:[], excluded:[]} */
(function(){
var BASE=((document.currentScript&&document.currentScript.src)||'').replace(/assets\/js\/boq\.js.*$/,'');
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function n(v,d){return v==null||v===''||isNaN(v)?'':Number(v).toLocaleString('en-US',{maximumFractionDigits:d==null?2:d})}
function amt(i){if(i.info)return null;return i.amount!=null?i.amount:(i.qty!=null&&i.rate!=null?i.qty*i.rate:null)}
function totals(D){var T=0,est=0,meas=0,unpriced=0,info=0;(D.sections||[]).forEach(function(s){s.total=0;(s.items||[]).forEach(function(i){if(i.info){info++;return}var a=amt(i);if(a!=null){s.total+=a;T+=a}else unpriced++;if(i.est)est++;else meas++})});return {T:T,est:est,meas:meas,unpriced:unpriced,info:info}}
function render(D,host){
  host.innerHTML='';var t=totals(D),B=D.areas&&D.areas.built_m2;
  var k=el('div','boq-kpis');
  [['الإجمالي التقديري',n(Math.round(t.T),0)+' ريال'],['للمتر المربع المبني',B?n(Math.round(t.T/B),0)+' ريال':'·'],['بنود مقيسة من المخطط',String(t.meas)],['بنود مقدّرة بقاعدة',String(t.est)],['بنود تُسعّر بعرض',String(t.unpriced)]].forEach(function(x){var d=el('div');d.appendChild(el('span',null,x[0]));d.appendChild(el('b',null,x[1]));k.appendChild(d)});
  host.appendChild(k);
  var md=D.mode||{},mw=[];
  if(md.skeleton==='indicator')mw.push('العظم مقدّر بمؤشر تكلفة المتر المربع لأن المخططات الإنشائية لم تُرفع');
  if(md.finish==='indicator')mw.push('التشطيب مقدّر بمؤشر تكلفة المتر المربع لأن أبعاد الفراغات لم تُقرأ (المقيس '+(md.coverage||0)+'٪ من المسطح)');
  else if(md.finish==='partial')mw.push('بعض الفراغات لم تُقَس، فكميات التشطيب تغطي '+(md.coverage||0)+'٪ من المسطح');
  if(mw.length){var wb=el('p','boq-warn');wb.textContent='جدول تقديري: '+mw.join('، و')+'. تُفصَّل البنود حين تُرفع المخططات الناقصة أو ملف DXF.';host.appendChild(wb)}
  if(D.checks&&D.checks.length){var cb=el('div','boq-checks');var bad=D.checks.filter(function(c){return !c.ok}).length;
    cb.appendChild(el('h4',null,bad?'فحوص المعقولية: '+bad+' تحتاج نظرة':'فحوص المعقولية: النسب ضمن المعتاد'));var ul=el('ul');
    D.checks.forEach(function(c){var li=el('li',c.ok?'ok':'warn');li.appendChild(el('span','ic',c.ok?'✓':'!'));var tx=el('span');tx.appendChild(el('b',null,c.name+': '+c.value));tx.appendChild(document.createTextNode(' · المعتاد '+c.expected+(c.note?' · '+c.note:'')));li.appendChild(tx);ul.appendChild(li)});
    cb.appendChild(ul);host.appendChild(cb)}
  if(D.basis)host.appendChild(el('p','boq-basis',D.basis));
  (D.sections||[]).forEach(function(s){
    var h=el('div','boq-sec');h.appendChild(el('h3',null,s.div+' · '+s.name));h.appendChild(el('span',null,s.total?n(Math.round(s.total),0)+' ريال':'بعرض'));host.appendChild(h);
    var w=el('div','tbl-wrap'),tb=el('table','tbl boq-t'),th=el('thead'),tr=el('tr');
    ['البند','الوصف وطريقة الحساب','الوحدة','الكمية','سعر الوحدة','المبلغ'].forEach(function(x){tr.appendChild(el('th',null,x))});th.appendChild(tr);tb.appendChild(th);
    var body=el('tbody');
    (s.items||[]).forEach(function(i){
      var r=el('tr',i.info?'info':null);r.appendChild(el('td','mono',i.code));
      var c=el('td','boq-d');var nm=el('b',null,i.name);if(i.est)nm.appendChild(el('em','est','تقدير'));if(i.info)nm.appendChild(el('em','inf','للعلم'));c.appendChild(nm);
      if(i.calc)c.appendChild(el('small','calc','الحساب: '+i.calc));
      if(i.note)c.appendChild(el('small',null,i.note));
      if(i.spec){var d=el('details');d.appendChild(el('summary',null,'المواصفة'));d.appendChild(el('p',null,i.spec));c.appendChild(d)}
      r.appendChild(c);r.appendChild(el('td',null,i.unit));r.appendChild(el('td','num',n(i.qty)));
      var rc=el('td','num',i.info?'·':i.rate!=null?n(i.rate):'بعرض');if(!i.info&&i.rate!=null&&i.low!=null&&i.high!=null&&i.low!==i.high)rc.appendChild(el('small','rng',n(i.low,0)+' إلى '+n(i.high,0)));r.appendChild(rc);
      r.appendChild(el('td','num',n(amt(i),0)));body.appendChild(r)});
    tb.appendChild(body);w.appendChild(tb);host.appendChild(w)});
  var f=el('div','boq-tot');f.appendChild(el('span',null,'الإجمالي التقديري للبنود المسعّرة'));f.appendChild(el('b',null,n(Math.round(t.T),0)+' ريال'));host.appendChild(f);
  [['أسئلة تُستوفى من المكتب',D.questions],['افتراضات الجدول',D.assumptions],['خارج الجدول',D.excluded]].forEach(function(x){if(!x[1]||!x[1].length)return;var b=el('div','boq-notes');b.appendChild(el('h4',null,x[0]));var ul=el('ul');x[1].forEach(function(s){ul.appendChild(el('li',null,s))});b.appendChild(ul);host.appendChild(b)});
  host.appendChild(el('p','boq-basis','الأسعار تقديرية من مكتبة البنود بمصادرها'+(D.price_date?' (أسعار '+D.price_date+')':'')+'، والكميات تُراجع مع المخططات المعتمدة قبل الطرح.'));
}
function csv(D,name){
  var rows=[['القسم','البند','الوصف','الوحدة','الكمية','سعر الوحدة','المبلغ','نوع الكمية','الحساب','المواصفة','ملاحظة']];
  (D.sections||[]).forEach(function(s){(s.items||[]).forEach(function(i){rows.push([s.name,i.code,i.name,i.unit,i.qty,i.info?'':i.rate,amt(i),i.info?'للعلم':i.est?'تقدير':'مقيسة',i.calc||'',i.spec||'',i.note||''])})});
  var t='﻿'+rows.map(function(r){return r.map(function(c){c=c==null?'':String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\r\n');
  save(new Blob([t],{type:'text/csv;charset=utf-8'}),name);
}
function save(blob,name){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},800)}
function loadXL(){if(window.ExcelJS)return Promise.resolve();return new Promise(function(res,rej){var s=document.createElement('script');s.src=BASE+'assets/vendor/exceljs-4.4.0.min.js';s.onload=res;s.onerror=function(){rej(new Error('load'))};document.head.appendChild(s)})}

/* ملف إكسل: ملخص، وبنود بمعادلات حية، وافتراضات وأسئلة */
function build(D){
  var X=window.ExcelJS,wb=new X.Workbook();wb.creator='البيت بيتك';wb.created=new Date();
  var TERRA='FFA65338',BROWN='FF5A3420',CREAM='FFF5EFE8',LINE='FFD9D3CB';
  var bord={top:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}}};
  function head(ws,row){row.eachCell(function(c){c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:TERRA}};c.alignment={vertical:'middle',horizontal:'center',wrapText:true};c.border=bord});row.height=24}
  var P=D.project||{},B=(D.areas&&D.areas.built_m2)||null;

  // الملخص أول ورقة، ويُملأ بعد البنود لأن معادلاته تشير إليها
  var sm=wb.addWorksheet('الملخص',{views:[{rightToLeft:true}],pageSetup:{paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
  // البنود
  var ws=wb.addWorksheet('البنود',{views:[{rightToLeft:true,state:'frozen',ySplit:1}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  ws.columns=[{header:'الرمز',key:'c',width:9},{header:'البند',key:'n',width:42},{header:'الوحدة',key:'u',width:9},{header:'الكمية',key:'q',width:12},{header:'سعر الوحدة',key:'r',width:12},{header:'المبلغ',key:'a',width:14},{header:'نوع الكمية',key:'t',width:11},{header:'طريقة الحساب',key:'k',width:48},{header:'المواصفة',key:'s',width:50},{header:'ملاحظة',key:'o',width:28}];
  head(ws,ws.getRow(1));
  var subRefs=[],secRows=[];
  (D.sections||[]).forEach(function(s){
    var hr=ws.addRow([s.div,s.name]);hr.eachCell({includeEmpty:true},function(c,i){if(i<=10){c.fill={type:'pattern',pattern:'solid',fgColor:{argb:CREAM}};c.font={bold:true,color:{argb:BROWN}};c.border=bord}});ws.mergeCells(hr.number,2,hr.number,10);
    var first=hr.number+1;
    (s.items||[]).forEach(function(i){
      var r=ws.addRow([i.code,i.name,i.unit,i.qty,i.info?null:i.rate,null,i.info?'للعلم':i.est?'تقدير':'مقيسة',i.calc||'',i.spec||'',i.note||'']);
      if(!i.info&&i.rate!=null&&i.qty!=null)r.getCell(6).value={formula:'D'+r.number+'*E'+r.number,result:Math.round(i.qty*i.rate)};
      else if(!i.info&&i.rate==null)r.getCell(5).value='بعرض';
      r.getCell(4).numFmt='#,##0.00';r.getCell(5).numFmt='#,##0.00';r.getCell(6).numFmt='#,##0';
      r.eachCell({includeEmpty:true},function(c,ci){if(ci<=10){c.border=bord;c.alignment={vertical:'top',wrapText:ci===2||ci>=8}}});
      if(i.info)r.eachCell(function(c){c.font={color:{argb:'FF8A8178'},italic:true}});
    });
    var last=ws.lastRow.number;
    var sr=ws.addRow(['','إجمالي '+s.name]);sr.getCell(6).value={formula:'SUM(F'+first+':F'+last+')',result:Math.round(s.total||0)};sr.getCell(6).numFmt='#,##0';
    sr.eachCell({includeEmpty:true},function(c,i){if(i<=10){c.font={bold:true};c.border=bord}});
    subRefs.push('F'+sr.number);secRows.push({div:s.div,name:s.name,ref:"'البنود'!F"+sr.number,total:s.total||0});
    ws.addRow([]);
  });
  var tr=ws.addRow(['','الإجمالي التقديري للبنود المسعّرة']);tr.getCell(6).value={formula:subRefs.length?subRefs.join('+'):'0',result:Math.round(D.total||0)};tr.getCell(6).numFmt='#,##0';
  tr.eachCell({includeEmpty:true},function(c,i){if(i<=10){c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:BROWN}}}});
  var totRef="'البنود'!F"+tr.number;

  // الملخص (أول ورقة)
  sm.columns=[{width:34},{width:46},{width:18},{width:14}];
  if(LOGO_B64){var lid=wb.addImage({base64:LOGO_B64,extension:'png'});var lr=sm.addRow([]);lr.height=48;sm.addImage(lid,{tl:{col:0,row:0},ext:{width:174,height:48}})}
  var t1=sm.addRow(['جدول الكميات التقديري']);t1.font={bold:true,size:16,color:{argb:BROWN}};sm.mergeCells(t1.number,1,t1.number,4);
  [['المشروع',(D.title||P.name||'')],['الرقم والإصدار',(P.ref||'')+(P.rev?' · الإصدار '+P.rev:'')],['تاريخ الجدول',D.date||''],['تاريخ الأسعار',D.price_date||''],['المسطحات المبنية',B?B+' م²':'لم تُقرأ']].forEach(function(x){var r=sm.addRow(x);r.getCell(1).font={bold:true,color:{argb:BROWN}}});
  var md=D.mode||{},mw=[];if(md.skeleton==='indicator')mw.push('العظم بمؤشر المتر المربع');if(md.finish==='indicator')mw.push('التشطيب بمؤشر المتر المربع');else if(md.finish==='partial')mw.push('التشطيب يغطي '+(md.coverage||0)+'٪ من المسطح');
  if(mw.length){var wr=sm.addRow(['جدول تقديري: '+mw.join('، و')+'.']);wr.font={bold:true,color:{argb:'FFA65338'}};sm.mergeCells(wr.number,1,wr.number,4)}
  sm.addRow([]);
  var h2=sm.addRow(['القسم','البيان','المبلغ (ريال)','النسبة']);head(sm,h2);
  var f1=h2.number+1;
  secRows.forEach(function(s){var r=sm.addRow([s.div,s.name,{formula:s.ref,result:Math.round(s.total)},null]);r.getCell(3).numFmt='#,##0';r.eachCell({includeEmpty:true},function(c,i){if(i<=4)c.border=bord})});
  var l1=sm.lastRow.number;
  var tt=sm.addRow(['','الإجمالي التقديري',{formula:totRef,result:Math.round(D.total||0)},null]);tt.getCell(3).numFmt='#,##0';tt.eachCell({includeEmpty:true},function(c,i){if(i<=4){c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:BROWN}}}});
  for(var rr=f1;rr<=l1;rr++){sm.getCell('D'+rr).value={formula:'IF($C$'+tt.number+'=0,0,C'+rr+'/$C$'+tt.number+')'};sm.getCell('D'+rr).numFmt='0.0%'}
  if(B){var pm=sm.addRow(['','للمتر المربع المبني',{formula:'C'+tt.number+'/'+B,result:Math.round((D.total||0)/B)}]);pm.getCell(3).numFmt='#,##0'}
  if(D.checks&&D.checks.length){sm.addRow([]);var hc=sm.addRow(['فحص المعقولية','قيمة المشروع','المعتاد','النتيجة']);head(sm,hc);
    D.checks.forEach(function(c){var r=sm.addRow([c.name,c.value,c.expected,c.ok?'ضمن المعتاد':'يحتاج نظرة']);r.getCell(4).font={bold:true,color:{argb:c.ok?'FF2F6B3A':'FFA65338'}};r.eachCell({includeEmpty:true},function(x,i){if(i<=4){x.border=bord;x.alignment={wrapText:true,vertical:'top'}}})})}
  sm.addRow([]);var nt=sm.addRow(['الأسعار تقديرية من مكتبة البنود بمصادرها، والكميات محسوبة بمعادلات ثابتة على ما قُرئ من المخططات، وتُراجع مع المخططات المعتمدة قبل الطرح.']);sm.mergeCells(nt.number,1,nt.number,4);nt.getCell(1).alignment={wrapText:true};nt.height=34;

  // الافتراضات والأسئلة
  var an=wb.addWorksheet('الافتراضات والأسئلة',{views:[{rightToLeft:true}]});an.columns=[{width:24},{width:110}];
  [['أسئلة تُستوفى من المكتب',D.questions],['افتراضات الجدول',D.assumptions],['خارج الجدول',D.excluded],['أساس الجدول',D.basis?[D.basis]:[]]].forEach(function(g){if(!g[1]||!g[1].length)return;var h=an.addRow([g[0]]);h.font={bold:true,color:{argb:TERRA}};g[1].forEach(function(s,i){var r=an.addRow([String(i+1),s]);r.getCell(2).alignment={wrapText:true,vertical:'top'}});an.addRow([])});
  return wb;
}
/* شعار الموقع لملف الإكسل: يُجلب مرة، وإن تعذر يُبنى الملف بلا شعار */
var LOGO_B64=null;
function loadLogo(){if(LOGO_B64)return Promise.resolve();return fetch(BASE+'assets/img/brand/logo-horizontal.png').then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(b){return new Promise(function(res){var fr=new FileReader();fr.onload=function(){LOGO_B64=String(fr.result);res()};fr.onerror=function(){res()};fr.readAsDataURL(b)})}).catch(function(){})}
function xlsx(D,name){
  return loadXL().then(loadLogo).then(function(){return build(D).xlsx.writeBuffer()}).then(function(buf){save(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name)});
}
window.BOQ={render:render,csv:csv,xlsx:xlsx,build:build,totals:totals};
})();
