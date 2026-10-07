/* إعدادات الربط بـSupabase · المفتاح العام فقط (آمن للنشر، والحماية في قواعد RLS) */
window.BB_CONFIG={
  url:'https://mafsmebubzvbyahmwyym.supabase.co',
  /* رابط التواصل الذي يظهر لمن رُفض أو أوقف حسابه (واتساب أو بريد). يبقى فارغاً حتى يُحدَّد */
  contact:'',
  anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZnNtZWJ1Ynp2YnlhaG13eXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTA0ODAsImV4cCI6MjEwNjc2NjQ4MH0.o6H-aXgIXO8b9qITFgSrYw8HXZOgfvNXHJafGk620mU'
};
window.BB=window.supabase.createClient(window.BB_CONFIG.url,window.BB_CONFIG.anonKey);
