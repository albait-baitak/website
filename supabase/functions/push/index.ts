// الإشعارات (Web Push، ومعها البريد للمستخدم إن وُجد مفتاحه):
// - إشعارات المدير: يستدعيها مشغّل في قاعدة البيانات عند كل حدث مهم (تسجيل، أداة، طلب، تغذية راجعة، انتهاء فحص)، وتذهب لأجهزة المدراء فقط.
// - إشعارات المستخدم (body.u): تقريرك جاهز، جدولك جاهز، اعتُمد حسابك؛ تذهب لأجهزة صاحبها، وإلى بريده إن وُجد RESEND_API_KEY.
// - أي مستخدم داخل بحسابه يأخذ المفتاح العام (op:key) ويرسل لنفسه إشعاراً تجريبياً (op:test).
// مفاتيح VAPID تولّدها الدالة أول مرة وتحفظها في push_cfg الذي لا يقرؤه إلا الخادم.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SITE = Deno.env.get("SITE_URL") ?? "https://albait-baitak.com/";
const ROLE: Record<string, string> = { office: "مكتب هندسي", designer: "مصمم", contractor: "مقاول", owner: "فرد" };
const STAGE: Record<string, string> = { decision: "القرار", design: "التصميم", build: "التنفيذ", living: "السكن" };
const DEV: Record<string, string> = { mobile: "جوال", tablet: "جهاز لوحي", desktop: "حاسوب" };
const ADMIN = SITE + "admin/";
const PORTAL = SITE + "fahs/app.html";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type Msg = { title: string; body: string; url: string; tag?: string; mail?: string };
const USER_TYPES = new Set(["report_ready", "boq_ready", "approved", "test"]);

function compose(t: string, r: Record<string, any>): Msg | null {
  const who = r.name || r.email || "زائر بلا حساب";
  const proj = r.project ? `«${r.project}»` : "";
  if (t === "signup") {
    const role = ROLE[r.role] ?? "حساب";
    const wait = r.status === "pending";
    const extra = [r.org && r.org !== r.name ? r.org : null, r.city, r.stage && STAGE[r.stage] ? "مرحلة " + STAGE[r.stage] : null].filter(Boolean).join(" · ");
    return { title: wait ? `${role} جديد ينتظر اعتمادك` : `تسجيل جديد: ${role}`, body: [who, extra].filter(Boolean).join("\n"), url: ADMIN + (wait ? "#acc=pending" : "#acc"), tag: "signup-" + (r.email ?? Date.now()) };
  }
  if (t === "tool") return { title: r.again ? "رجع لأداة" : "استخدام أداة", body: `${who}${r.role && ROLE[r.role] ? " (" + ROLE[r.role] + ")" : ""}\n«${r.title || r.path}»`, url: ADMIN + "#st" };
  if (t === "request") {
    if (r.kind === "boq") return { title: "طلب جدول كميات جديد", body: `${who}\n${proj}${r.ref ? " · " + r.ref : ""}`, url: ADMIN + "#boq=" + r.id, tag: "req-" + r.id };
    return { title: "طلب فحص فني جديد", body: `${who}\n${proj}${r.rev ? " · الإصدار " + r.rev : ""}${r.ref ? " · " + r.ref : ""}`, url: ADMIN + "#req=" + r.id, tag: "req-" + r.id };
  }
  if (t === "feedback") {
    const f = r.rec ?? {};
    const what = f.kind === "rating" || (f.rating && !f.rule_code) ? `تقييم ${f.rating ?? ""} من 5` : `اعتراض على ${f.rule_code ?? "بند"}`;
    return { title: r.changed ? "تعديل رأي على تقرير" : "رأي جديد على تقرير", body: `${who}${r.ref ? " · " + r.ref : ""}\n${what}${f.note ? "\n" + String(f.note).slice(0, 120) : ""}`, url: ADMIN + (r.id ? "#req=" + r.id : "#obj") };
  }
  if (t === "job") {
    const ok = r.status === "done";
    const k = r.kind === "boq" ? "جدول الكميات" : "الفحص الآلي";
    return {
      title: ok ? `اكتمل ${k}` : `تعذر ${k}`,
      body: `${proj}${r.rev ? " · الإصدار " + r.rev : ""}${r.ref ? " · " + r.ref : ""}${ok ? "\nجاهز لمراجعتك ونشره." : r.error ? "\n" + r.error : ""}`,
      url: ADMIN + (r.kind === "boq" ? "#boq=" : "#req=") + r.id, tag: "job-" + r.id,
    };
  }
  if (t === "visit") {
    const from = r.src || r.ref || "رابط مباشر";
    return { title: "زائر جديد", body: `«${r.title || r.path}»\nمن ${from}${r.dev && DEV[r.dev] ? " · " + DEV[r.dev] : ""}`, url: ADMIN + "#st", tag: "visit" };
  }
  // إشعارات المستخدم
  const pUrl = PORTAL + (r.project_id ? "#p=" + r.project_id : "");
  if (t === "report_ready") return {
    title: "صدر تقرير الفحص الفني", body: `${proj}${r.rev ? " · الإصدار " + r.rev : ""}${r.ref ? " · " + r.ref : ""}`, url: pUrl, tag: "rep-" + r.ref,
    mail: `صدر تقرير الفحص الفني لمشروع ${esc(r.project ?? "")}${r.rev ? " (الإصدار " + r.rev + ")" : ""}${r.ref ? "، رقم الطلب " + esc(r.ref) : ""}.`,
  };
  if (t === "boq_ready") return {
    title: "جدول الكميات جاهز", body: `${proj}${r.ref ? " · " + r.ref : ""}`, url: pUrl, tag: "boq-" + r.ref,
    mail: `جدول الكميات لمشروع ${esc(r.project ?? "")} جاهز${r.ref ? "، رقم الطلب " + esc(r.ref) : ""}.`,
  };
  if (t === "approved") return {
    title: "فُعّل حسابك في «البيت بيتك»", body: "ادخل الآن إلى بوابة الفحص الفني وارفع أول مشروع.", url: PORTAL, tag: "approved",
    mail: `فُعّل حسابك (${esc(ROLE[r.role] ?? "")}) في «البيت بيتك». تستطيع الآن رفع مشاريعك للفحص الفني وطلب جداول الكميات.`,
  };
  if (t === "test") return { title: "البيت بيتك", body: "الإشعارات تعمل على هذا الجهاز.", url: r.url || SITE };
  return null;
}

async function mailUser(db: any, uid: string, m: Msg) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !m.mail) return "no_mail";
  const { data: p } = await db.from("profiles").select("email").eq("id", uid).single();
  if (!p?.email) return "no_email";
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#1F1A17;line-height:1.9">
<p>${m.mail}</p><p><a href="${m.url}" style="color:#B26042">افتح «البيت بيتك»</a></p>
<p style="color:#8A8079;font-size:13px">وصلتك هذه الرسالة لأن لك حساباً في «البيت بيتك».</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("NOTIFY_FROM") ?? "البيت بيتك <onboarding@resend.dev>", to: [p.email], subject: m.title, html }),
  });
  return r.ok ? "sent" : "mail_error";
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

  // المصدر: مشغّل قاعدة البيانات (بالسر الداخلي) أو مستخدم داخل بحسابه
  let msg: Msg | null = null, target: string | null = null, adminsOnly = false;
  if (body.s) {
    if (body.s !== cfg.hook_secret) return json({ error: "forbidden" }, 403);
    const t = String(body.t);
    msg = compose(t, body.r ?? {});
    if (body.u) { if (!USER_TYPES.has(t)) return json({ error: "bad_type" }, 400); target = String(body.u); }
    else adminsOnly = true;
  } else {
    const uc = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    if (body.op === "key") return json({ key: pub });
    if (body.op !== "test") return json({ error: "bad_op" }, 400);
    target = user.id;
    const { data: isAdmin } = await uc.rpc("is_admin");
    msg = compose("test", { url: isAdmin ? ADMIN : PORTAL });
  }
  if (!msg) return json({ sent: 0, reason: "no_message" });

  let subs: any[] = [];
  if (target) {
    const { data } = await db.from("push_subs").select("*").eq("user_id", target);
    subs = data ?? [];
  } else if (adminsOnly) {
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
    const ids = (admins ?? []).map((a: any) => a.id);
    if (ids.length) { const { data } = await db.from("push_subs").select("*").in("user_id", ids); subs = data ?? []; }
  }
  webpush.setVapidDetails(SITE, pub, priv);
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag });
  let sent = 0, gone = 0;
  const errs: string[] = [];
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "normal" });
      sent++;
      await db.from("push_subs").update({ last_ok: new Date().toISOString() }).eq("id", s.id);
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) { gone++; await db.from("push_subs").delete().eq("id", s.id); }
      else errs.push(String(e?.statusCode ?? "") + " " + String(e?.body ?? e?.message ?? e).slice(0, 200));
    }
  }));
  const mail = body.s && target ? await mailUser(db, target, msg) : null;
  return json({ sent, gone, errors: errs, mail });
});
