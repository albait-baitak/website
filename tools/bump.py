# يضيف رقم نسخة لروابط الملفات المحلية حتى لا يعرض المتصفح نسخة قديمة بعد كل تحديث
import re,sys,glob,time
v=sys.argv[1] if len(sys.argv)>1 else time.strftime('%Y%m%d%H%M')
for p in glob.glob('**/*.html',recursive=True):
    if p.startswith('node_modules'):continue
    s=open(p,encoding='utf-8').read()
    n=re.sub(r'((?:\.\./|/)?assets/(?:css|js|vendor)/[\w.\-]+\.(?:css|js))(\?v=[\w]+)?"',lambda m:m.group(1)+'?v='+v+'"',s)
    if n!=s:open(p,'w',encoding='utf-8').write(n);print(p)
