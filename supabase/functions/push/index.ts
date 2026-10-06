// إشعارات الجوال للمدير (Web Push): يستدعيها مشغّل في قاعدة البيانات عند كل حدث مهم (تسجيل، استخدام أداة، طلب، تغذية راجعة)،
// ويستدعيها المدير من لوحة الإدارة ليأخذ المفتاح العام أو يرسل إشعاراً تجريبياً.
// مفاتيح VAPID تولّدها الدالة أول مرة وتحفظها في push_cfg الذي لا يقرؤه إلا الخادم؛ لا سر يدخله أحد يدوياً.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SITE = Deno.env.get("SITE_URL") ?? "https://albait-baitak.github.io/website/";
const ROLE: Record<string, string> = { office: "مكتب هندسي", designer: "مصمم", contractor: "مقاول", owner: "فرد" };
const STAGE: Record<string, string> = { decision: "القرار", design: "التصميم", build: "التنفيذ", living: "السكن" };
const DEV: Record<string, string> = { mobile: "جوال", tablet: "جهاز لوحي", desktop: "حاسوب" };

type Msg = { title: string; body: string; url: string; tag?: string };
function compose(t: string, r: Record<string, any>): Msg | null {
  const who = r.name || r.email || "حساب";
  if (t === "signup") {
    const role = ROLE[r.role] ?? "حساب";
    const wait = r.status === "pending";
    const extra = [r.org && r.org !== r.name ? r.org : null, r.city, r.stage && STAGE[r.stage] ? "مرحلة " + STAGE[r.stage] : null].filter(Boolean).join(" · ");
    return { title: wait ? `${role} جديد ينتظر اعتمادك` : `تسجيل جديد: ${role}`, body: [who, extra].filter(Boolean).join("\n"), url: SITE + "admin/", tag: "signup" };
  }
  if (t === "tool") return { title: r.again ? "رجع لأداة" : "استخدام أداة", body: `${who}${r.role && ROLE[r.role] ? " (" + ROLE[r.role] + ")" : ""}\n«${r.title || r.path}»`, url: SITE + "admin/" };
  if (t === "request") {
    if (r.kind === "boq") return { title: "طلب جدول كميات جديد", body: `${who}\n${r.project ?? ""}`, url: SITE + "admin/", tag: "req" };
    return { title: "طلب فحص فني جديد", body: `${who}\n${r.project ?? ""}${r.rev ? " · الإصدار " + r.rev : ""}`, url: SITE + "admin/", tag: "req" };
  }
  if (t === "feedback") {
    const f = r.rec ?? {};
    const what = f.kind === "rating" || f.rating ? `تقييم ${f.rating ?? ""} من 5` : f.kind === "agree" ? `موافقة على ${f.rule_code ?? "بند"}` : `اعتراض على ${f.rule_code ?? "بند"}`;
    return { title: "تغذية راجعة على تقرير", body: `${who}\n${what}${f.note ? "\n" + String(f.note).slice(0, 120) : ""}`, url: SITE + "admin/" };
  }
  if (t === "visit") {
    const from = r.src || r.ref || "رابط مباشر";
    return { title: "زائر جديد", body: `«${r.title || r.path}»\nمن ${from}${r.dev && DEV[r.dev] ? " · " + DEV[r.dev] : ""}`, url: SITE + "admin/", tag: "visit" };
  }
  if (t === "test") return { title: "البيت بيتك", body: "الإشعارات تعمل على هذا الجهاز.", url: SITE + "admin/" };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));

  const { data: cfg } = await db.from("push_cfg").select("*").eq("id", 1).single();
  if (!cfg) return json({ error: "no_cfg" }, 500);
  let pub = cfg.vapid_public as string | null, priv = cfg.vapid_private as string | null;
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    pub = k.publicKey; priv = k.privateKey;
    await db.from("push_cfg").update({ vapid_public: pub, vapid_private: priv }).eq("id", 1);
  }

  // المصدر: مشغّل قاعدة البيانات (بالسر الداخلي) أو المدير (بجلسته)
  let msg: Msg | null = null, onlyUser: string | null = null;
  if (body.s) {
    if (body.s !== cfg.hook_secret) return json({ error: "forbidden" }, 403);
    msg = compose(String(body.t), body.r ?? {});
  } else {
    const uc = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: isAdmin } = await uc.rpc("is_admin");
    if (!isAdmin) return json({ error: "not_admin" }, 403);
    if (body.op === "key") return json({ key: pub });
    if (body.op !== "test") return json({ error: "bad_op" }, 400);
    const { data: { user } } = await uc.auth.getUser();
    onlyUser = user?.id ?? null;
    msg = compose("test", {});
  }
  if (!msg) return json({ sent: 0, reason: "no_message" });

  let q = db.from("push_subs").select("*");
  if (onlyUser) q = q.eq("user_id", onlyUser);
  const { data: subs } = await q;
  webpush.setVapidDetails(SITE, pub, priv);
  const payload = JSON.stringify(msg);
  let sent = 0, gone = 0;
  const errs: string[] = [];
  await Promise.all((subs ?? []).map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "normal" });
      sent++;
      await db.from("push_subs").update({ last_ok: new Date().toISOString() }).eq("id", s.id);
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) { gone++; await db.from("push_subs").delete().eq("id", s.id); }
      else errs.push(String(e?.statusCode ?? "") + " " + String(e?.body ?? e?.message ?? e).slice(0, 200));
    }
  }));
  return json({ sent, gone, errors: errs });
});
