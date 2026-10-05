// دالة الفحص الآلي: تقرأ ملفات الطلب، وترسلها لـClaude مع قواعد الفحص الفني، وتحفظ مسودة التقرير.
// لا يشغّلها إلا المشرف. والمسودة لا تصل للمكتب قبل مراجعة المعماري واعتماده.
import { createClient } from "jsr:@supabase/supabase-js@2";
import rulesData from "./rules.json" with { type: "json" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Rule = { c: string; l: number; n: string; r: string; s: string };
const RULES = (rulesData as { RULES: Rule[] }).RULES;
const LNAME: Record<number, string> = { 1: "النظامية", 2: "العملية", 3: "الموجهات", 4: "الثقافية" };

function buildPrompt(meta: string): string {
  const rules = RULES.map((R) =>
    `${R.c} | ${R.l === 1 || R.l === 3 ? "مطابقة" : "جودة تصميم"} · ${LNAME[R.l]} | ${R.n} | المطلوب: ${R.r}`
  ).join("\n");
  return "أنت فاحص معماري لمخططات المسكن السعودي، تُجري الفحص الفني للمخطط قبل رفعه للأمانة وفق بروتوكول ثابت: استخراج الفراغات وقياساتها، ثم فحص المطابقة (الطبقة النظامية: الاشتراطات والكود، ثم طبقة الموجهات: موجهات العمارة السعودية لطراز الموقع)، ثم فحص جودة التصميم (الطبقة العملية: صلاحية الفراغات للعيش، ثم الطبقة الثقافية: قواعد البيت السعودي).\n\n" +
    "المرفقات لوحات مخطط واحد (مساقط، واجهات، قطاعات، رندرات). بيانات أدخلها المكتب: " + meta + "\n\n" +
    "قواعد صارمة:\n- لا تخترع رقماً. استخدم الأبعاد والمناسيب المكتوبة على اللوحات فقط. إن حسبت قيمة فاذكر الحساب. إن قست من الرسم بالمقياس فقل «بالقياس من الرسم».\n- ما لا يمكن قراءته بثقة حكمه unk ويتحول إلى سؤال.\n- إن وُجد استخراج من ملف DXF فأرقامه (المساحات المحسوبة من المضلعات المغلقة، وقيم الأبعاد، والمناسيب، والنصوص) مقروءة من ملف الرسم نفسه، فقدّمها على القياس من الصور واذكر «من ملف DXF». تحقق من الوحدة المذكورة فيه، وإن وُسمت «مستنتجة» فاذكر ذلك. والمضلع المغلق قد يكون حد الأرض أو فراغاً أو عنصراً آخر، فاعتمد على اسمه وموقعه ومساحته.\n- ما لا يوجد في المشروع (مناور، شطفة، شارع جانبي) حكمه na.\n- الدرجة في فحص المطابقة: stop للمخالفة النظامية الصريحة وللموجهات الملزمة الصريحة، major لما يُعالج قبل الرفع، minor للتحسين.\n- الدرجة في فحص جودة التصميم: major أو minor فقط، ولا stop أبداً.\n- حكم المطابقة يُبنى من فحص المطابقة وحده: ready إن لم توجد فيه stop ولا major، وfix إن كانت علاجاته موضعية لا تغير التكوين، وredesign إن احتاج العلاج تغيير التكوين.\n- إن لم يُذكر نمط الطراز فافحص على المعاصر واذكر ذلك في الافتراضات.\n- اكتب بالعربية الفصحى، جملاً قصيرة، والعلاج محدد قابل للتنفيذ. استخدم «..» لا «…».\n\n" +
    "القواعد (الرمز | القسم · الطبقة | الاسم | المطلوب):\n" + rules + "\n\n" +
    'أعد JSON فقط، بلا أي نص قبله أو بعده، بهذا الشكل:\n{"title":"اسم المشروع إن ظهر","sub":"المدينة · الأرض · الأدوار","verdict":"ready|fix|redesign","summary":["خلاصة فحص المطابقة في سطر","خلاصة فحص جودة التصميم في سطر"],"assumptions":["..."],"results":{"SETBACK-01":{"v":"ok|fail|na|unk","sev":"stop|major|minor","f":"ما وُجد في المخطط بالأرقام","fix":"العلاج إن خالف","note":"ملاحظة اختيارية"}},"extraction":[["الدور","الفراغ","الأبعاد","المساحة م²","الحد النظامي","الحالة"]],"questions":["..."]}\n' +
    "ضع في results كل الرموز المذكورة دون استثناء.";
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no_json");
  return JSON.parse(text.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANALYSIS_MODEL") ?? "claude-opus-5-5";

  // التحقق أن المستدعي مشرف
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  if (adminErr || !isAdmin) return json({ error: "not_admin" }, 403);
  if (!apiKey) return json({ error: "missing_api_key", message: "أضف ANTHROPIC_API_KEY في أسرار الدوال" }, 500);

  const { request_id } = await req.json().catch(() => ({}));
  if (!request_id) return json({ error: "missing_request_id" }, 400);

  const db = createClient(url, service);
  const { data: rq, error: rqErr } = await db.from("requests").select("*").eq("id", request_id).single();
  if (rqErr || !rq) return json({ error: "request_not_found" }, 404);

  const p = rq.project ?? {};
  const meta = [
    p.type && `نوع المسكن: ${p.type}`, p.floors && `الأدوار: ${p.floors}`,
    (p.city || p.district) && `الموقع: ${[p.city, p.district].filter(Boolean).join(" · ")}`,
    p.area && `مساحة الأرض: ${p.area} م²`, p.streets && `الشوارع: ${p.streets}`,
    p.pattern && `نمط الموجهات: ${p.pattern}`, p.prev && `ملاحظات سابقة من الأمانة: ${p.prev}`,
  ].filter(Boolean).join(" · ") || "لم تُدخل بيانات";

  // تجهيز المرفقات: PDF، صور، واستخراج DXF وصور معاينته (تُولَّد في متصفح المكتب عند الرفع)
  type F = { path: string; name: string; type?: string; size?: number; role?: string; of?: string };
  const blocks: unknown[] = [];
  const skipped: string[] = [];
  const dxfTexts: string[] = [];
  let budget = 24 * 1024 * 1024; // حد آمن لحجم الطلب
  const all = (rq.files ?? []) as F[];
  // ملفات الاستخراج أولاً ثم بقية المرفقات
  const ordered = [...all.filter((f) => f.role === "dxf_extract"), ...all.filter((f) => f.role !== "dxf_extract")];
  for (const f of ordered) {
    const lower = (f.path || f.name).toLowerCase();
    if (f.role === "dxf_extract") {
      const { data: blob } = await db.storage.from("plans").download(f.path);
      if (!blob) { skipped.push(f.name); continue; }
      try { const ex = JSON.parse(await blob.text()); if (ex?.text) dxfTexts.push(ex.text); } catch { skipped.push(f.name); }
      continue;
    }
    if (lower.endsWith(".dxf")) continue; // يُقرأ عبر ملف الاستخراج وصور المعاينة
    const isPdf = lower.endsWith(".pdf");
    const imgType = lower.endsWith(".png") ? "image/png" : (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) ? "image/jpeg" : lower.endsWith(".webp") ? "image/webp" : null;
    if (!isPdf && !imgType) { skipped.push(f.name); continue; }
    if (imgType && (f.size ?? 0) > 5 * 1024 * 1024) { skipped.push(f.name + " (أكبر من 5MB)"); continue; }
    if ((f.size ?? 0) * 1.37 > budget) { skipped.push(f.name + " (تجاوز حجم الطلب)"); continue; }
    const { data: blob, error } = await db.storage.from("plans").download(f.path);
    if (error || !blob) { skipped.push(f.name); continue; }
    const buf = await blob.arrayBuffer();
    budget -= buf.byteLength * 1.37;
    const data = b64(buf);
    if (f.role === "dxf_view") blocks.push({ type: "text", text: "صورة معاينة مرسومة من ملف DXF: " + f.name });
    blocks.push(isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: imgType, data } });
  }
  if (!blocks.length && !dxfTexts.length) return json({ error: "no_readable_files", skipped }, 400);
  if (dxfTexts.length) blocks.push({ type: "text", text: "استخراج آلي من ملفات DXF المرفوعة (أرقام مقروءة من ملف الرسم نفسه):\n\n" + dxfTexts.join("\n\n---\n\n") });
  blocks.push({ type: "text", text: buildPrompt(meta) });

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: "user", content: blocks }] }),
  });
  const out = await resp.json();
  if (!resp.ok) {
    await db.from("analysis_runs").insert({ request_id, model, error: JSON.stringify(out).slice(0, 4000) });
    return json({ error: "api_error", detail: out?.error?.message ?? resp.status }, 502);
  }
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  let parsed: Record<string, unknown>;
  try { parsed = extractJson(text) as Record<string, unknown>; }
  catch {
    await db.from("analysis_runs").insert({ request_id, model, error: "bad_json", result: { text: text.slice(0, 20000) } });
    return json({ error: "bad_json" }, 502);
  }

  const report = {
    kind: "live", ref: rq.ref,
    title: (parsed.title as string) || "مخطط مرفوع",
    sub: (parsed.sub as string) || "",
    verdict: parsed.verdict ?? "fix",
    summary: parsed.summary ?? [], assumptions: parsed.assumptions ?? [],
    results: parsed.results ?? {}, extraction: parsed.extraction ?? [], questions: parsed.questions ?? [],
    files: (rq.files ?? []).filter((f: F) => !f.role).map((f: F) => f.name).join(" · "),
    skipped,
    foot: "فحص آلي أولي على المرجع، يراجعه المعماري قبل اعتماده.",
  };
  await db.from("analysis_runs").insert({ request_id, model, result: report });
  const { data: existing } = await db.from("reports").select("id,published").eq("request_id", request_id).maybeSingle();
  if (!existing) await db.from("reports").insert({ request_id, data: report });
  else if (!existing.published) await db.from("reports").update({ data: report }).eq("id", existing.id);
  if (rq.status === "submitted") await db.from("requests").update({ status: "in_review" }).eq("id", request_id);

  return json({ ok: true, report, skipped, usage: out.usage });
});
