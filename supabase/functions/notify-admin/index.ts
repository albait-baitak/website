// تنبيه المشرف ببريد عند تسجيل حساب جديد ينتظر الاعتماد.
// يستدعيها المستخدم نفسه بعد إكمال تسجيله، وترسل مرة واحدة لكل حساب.
// تحتاج سر RESEND_API_KEY، وبدونه يبقى التنبيه في لوحة الإدارة فقط.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const ROLE: Record<string, string> = { office: "مكتب هندسي", designer: "مصمم", contractor: "مقاول", owner: "فرد" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: p } = await db.from("profiles").select("*").eq("id", user.id).single();
  if (!p || p.status !== "pending" || p.notified_at || !p.registered_at) return json({ sent: false, reason: "not_needed" });

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ sent: false, reason: "no_mail_key" });
  const { data: admins } = await db.from("admin_emails").select("email");
  const to = (admins ?? []).map((a: { email: string }) => a.email);
  if (!to.length) return json({ sent: false, reason: "no_admins" });

  const site = "https://albait-baitak.com/";
  const rows = [
    ["الاسم", p.full_name], ["نوع الحساب المطلوب", ROLE[p.requested_role] ?? p.requested_role],
    ["الجهة", p.office_name], ["الجوال", p.phone], ["المدينة", p.city], ["البريد", p.email],
  ].filter((r) => r[1]).map((r) => `<tr><td style="padding:4px 12px;color:#5E554E">${r[0]}</td><td style="padding:4px 12px"><b>${esc(String(r[1]))}</b></td></tr>`).join("");
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#1F1A17">
<p>حساب جديد ينتظر اعتمادك في «البيت بيتك»:</p><table>${rows}</table>
<p><a href="${site}admin/#acc=pending" style="color:#B26042">افتح لوحة الإدارة لاعتماده وتحديد نوعه</a></p></div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("NOTIFY_FROM") ?? "البيت بيتك <onboarding@resend.dev>", to, subject: `حساب جديد ينتظر الاعتماد: ${p.full_name ?? p.email}`, html }),
  });
  if (!r.ok) return json({ sent: false, reason: "mail_error", detail: await r.text() }, 502);
  await db.from("profiles").update({ notified_at: new Date().toISOString() }).eq("id", user.id);
  return json({ sent: true });
});
