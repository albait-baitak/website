// دالة جداول الكميات: تقرأ ملفات إصدار المشروع، وتطلب من Claude كميات بنود مكتبة الفيلا،
// ثم تُسعّرها من المكتبة نفسها وتحفظ مسودة لا تصل المكتب قبل مراجعة المعماري واعتماده.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Item = { c: string; d: string; n: string; u: string; desc: string; spec: string; m: string; p: { low: number | null; typ: number | null; high: number | null; method: string; basis: string } };
// المكتبة مصدرها واحد: refs/boq/boq_library.json في المستودع المنشور
const LIB_URL = Deno.env.get("BOQ_LIB_URL") ?? "https://albait-baitak.github.io/website/refs/boq/boq_library.json";
let LIB: { built: string; price_date: string; items: Item[] } = { built: "", price_date: "", items: [] };
async function loadLib() {
  if (LIB.items.length) return;
  const r = await fetch(LIB_URL);
  if (!r.ok) throw new Error("lib_fetch:" + r.status);
  const L = await r.json();
  LIB = { built: L.built, price_date: "يوليو 2026", items: (L.items as any[]).filter((i) => !String(i.code).startsWith("13-")).map((i) => ({
    c: i.code, d: i.div_ar, n: i.name_ar, u: i.unit_ar, desc: i.desc_ar, spec: i.spec_ar, m: i.measure_ar,
    p: { low: i.price.low, typ: i.price.typ, high: i.price.high, method: i.price.method, basis: i.price.basis } })) };
}
const DISC: Record<string, string> = { arch: "معماري", struct: "إنشائي", elec: "كهربائي", plumb: "صحي", hvac: "تكييف" };
// الأقسام وما يُشترط لقياسها من المخطط
const DIV_NEEDS: Record<string, string> = { "02": "struct", "03": "struct", "09": "plumb", "10": "elec", "11": "hvac" };

function buildPrompt(meta: string, disc: string[], note: string): string {
  const list = LIB.items.map((i) => `${i.c} | ${i.d} | ${i.n} | ${i.u} | القياس: ${i.m}`).join("\n");
  const have = disc.map((k) => DISC[k] ?? k).join("، ");
  const missing = Object.keys(DISC).filter((k) => !disc.includes(k)).map((k) => DISC[k]).join("، ") || "لا شيء";
  return "أنت مهندس كميات سعودي تُعد جدول كميات لفيلا سكنية من مخططاتها. المرفقات لوحات المشروع، وقد يُرفق استخراج من ملفات DXF بأرقام مقروءة من ملف الرسم نفسه فقدّمها على القياس من الصور.\n" +
    "بيانات المشروع: " + meta + "\n" +
    "التخصصات المرفوعة: " + have + ". التخصصات غير المرفوعة: " + missing + ".\n" +
    (note ? "ملاحظات المكتب: " + note + "\n" : "") + "\n" +
    "قواعد صارمة:\n" +
    "- احسب كمية كل بند من البنود التالية بطريقة القياس المكتوبة معه، وبوحدته.\n" +
    "- ما يُقاس من المخططات المرفوعة: est=false، واكتب في calc الحساب مختصراً بأرقامه (مثال: «2×(12.4+8.6)×3.2 − فتحات 14.5»).\n" +
    "- ما لا تُرفع مخططاته (مثل الإنشائي إن لم يُرفع) قدّره بنسب هندسية معروفة لفيلا سكنية سعودية من مسطحات المعماري: est=true، واكتب في calc الأساس (مثال: «تقدير: 0.20 م³ خرسانة لكل م² من مسطح البلاطات»).\n" +
    "- لا تخترع رقماً لا أساس له. ما لا يمكن قياسه ولا تقديره بأساس معقول: اتركه بلا كمية واذكره في questions.\n" +
    "- البند غير الموجود في المشروع لا تذكره، واذكر ما استبعدته في excluded.\n" +
    "- اكتب بالعربية الفصحى، واستخدم «..» لا «…».\n\n" +
    "البنود (الرمز | القسم | البند | الوحدة | طريقة القياس):\n" + list + "\n\n" +
    'أعد JSON فقط، بلا أي نص قبله أو بعده، بهذا الشكل:\n{"title":"اسم المشروع إن ظهر","areas":{"built_m2":0,"ground_m2":0,"first_m2":0,"annex_m2":0},"items":[{"c":"04-01","qty":312.5,"est":false,"calc":".."}],"assumptions":[".."],"excluded":[".."],"questions":[".."]}';
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function extractJson(text: string): unknown {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no_json");
  return JSON.parse(text.slice(start, end + 1));
}
async function callClaude(apiKey: string, model: string, content: unknown[]): Promise<{ text: string; usage: Record<string, number>; stop: string }> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 48000, stream: true, messages: [{ role: "user", content }] }),
  });
  if (!resp.ok || !resp.body) {
    const j = await resp.json().catch(() => ({}));
    throw new Error("api_error:" + (j?.error?.message ?? resp.status));
  }
  const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", text = "", stop = "";
  const usage: Record<string, number> = {};
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let k;
    while ((k = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, k).trim();
      buf = buf.slice(k + 1);
      if (!line.startsWith("data:")) continue;
      let ev: any;
      try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text;
      else if (ev.type === "message_start") Object.assign(usage, ev.message?.usage ?? {});
      else if (ev.type === "message_delta") { Object.assign(usage, ev.usage ?? {}); if (ev.delta?.stop_reason) stop = ev.delta.stop_reason; }
      else if (ev.type === "error") throw new Error("api_error:" + (ev.error?.message ?? "stream"));
    }
  }
  return { text, usage, stop };
}
const PRICE: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-4-5": [1, 5], "claude-fable-5-1": [10, 50],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANALYSIS_MODEL") ?? "claude-opus-5-5";

  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  if (adminErr || !isAdmin) return json({ error: "not_admin" }, 403);
  if (!apiKey) return json({ error: "missing_api_key" }, 500);

  const { boq_id } = await req.json().catch(() => ({}));
  if (!boq_id) return json({ error: "missing_boq_id" }, 400);
  const db = createClient(url, service);
  const { data: bq } = await db.from("boq_requests").select("*").eq("id", boq_id).single();
  if (!bq) return json({ error: "boq_not_found" }, 404);
  const { data: rq } = await db.from("requests").select("*").eq("id", bq.request_id).single();
  const { data: pj } = await db.from("projects").select("*").eq("id", bq.project_id).single();
  if (!rq || !pj) return json({ error: "request_not_found" }, 404);

  const { data: running } = await db.from("boq_runs").select("id").eq("boq_id", boq_id).eq("status", "running")
    .gte("created_at", new Date(Date.now() - 8 * 60 * 1000).toISOString()).limit(1);
  if (running && running.length) return json({ ok: true, run_id: running[0].id, already: true }, 202);
  const { data: run } = await db.from("boq_runs").insert({ boq_id, model, status: "running" }).select("id").single();
  if (!run) return json({ error: "run_insert" }, 500);

  const job = (async () => {
    const t0 = Date.now();
    const fail = async (msg: string, extra: Record<string, unknown> = {}) => {
      await db.from("boq_runs").update({ status: "error", error: msg, finished_at: new Date().toISOString(), ...extra }).eq("id", run.id);
    };
    try {
      await loadLib();
      const p = pj.data ?? {};
      const meta = [pj.name, p.type && `نوع المسكن: ${p.type}`, p.floors && `الأدوار: ${p.floors}`,
        (p.city || p.district) && `الموقع: ${[p.city, p.district].filter(Boolean).join(" · ")}`, p.area && `مساحة الأرض: ${p.area} م²`,
        `الإصدار ${rq.rev}`].filter(Boolean).join(" · ");
      type F = { path: string; name: string; size?: number; role?: string };
      const blocks: unknown[] = [], skipped: string[] = [], dxfTexts: string[] = [];
      let budget = 24 * 1024 * 1024;
      const all = (rq.files ?? []) as F[];
      for (const f of [...all.filter((f) => f.role === "dxf_extract"), ...all.filter((f) => f.role !== "dxf_extract")]) {
        const lower = (f.path || f.name).toLowerCase();
        if (f.role === "dxf_extract") {
          const { data: blob } = await db.storage.from("plans").download(f.path);
          try { const ex = JSON.parse(await blob!.text()); if (ex?.text) dxfTexts.push(ex.text); } catch { skipped.push(f.name); }
          continue;
        }
        if (lower.endsWith(".dxf")) continue;
        const isPdf = lower.endsWith(".pdf");
        const imgType = lower.endsWith(".png") ? "image/png" : (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) ? "image/jpeg" : lower.endsWith(".webp") ? "image/webp" : null;
        if (!isPdf && !imgType) { skipped.push(f.name); continue; }
        if (imgType && (f.size ?? 0) > 5 * 1024 * 1024) { skipped.push(f.name); continue; }
        if ((f.size ?? 0) * 1.37 > budget) { skipped.push(f.name); continue; }
        const { data: blob, error } = await db.storage.from("plans").download(f.path);
        if (error || !blob) { skipped.push(f.name); continue; }
        const buf = await blob.arrayBuffer();
        budget -= buf.byteLength * 1.37;
        const data = b64(buf);
        blocks.push(isPdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
          : { type: "image", source: { type: "base64", media_type: imgType, data } });
      }
      if (!blocks.length && !dxfTexts.length) return await fail("no_readable_files", { result: { skipped } });
      if (dxfTexts.length) blocks.push({ type: "text", text: "استخراج آلي من ملفات DXF:\n\n" + dxfTexts.join("\n\n---\n\n") });

      const disc: string[] = bq.disciplines?.length ? bq.disciplines : ["arch"];
      const r = await callClaude(apiKey, model, [...blocks, { type: "text", text: buildPrompt(meta, disc, bq.note ?? "") }]);
      const pr = PRICE[model] ?? [0, 0];
      const usage = { ...r.usage, stop: r.stop, seconds: Math.round((Date.now() - t0) / 1000),
        usd: Math.round((((r.usage.input_tokens ?? 0) * pr[0] + (r.usage.output_tokens ?? 0) * pr[1]) / 1e6) * 1000) / 1000 };
      let A: Record<string, any>;
      try { A = extractJson(r.text) as Record<string, any>; } catch { return await fail("bad_json", { usage, result: { stop: r.stop, text: r.text.slice(0, 20000) } }); }

      // التسعير من المكتبة: السعر النموذجي، والمبلغ = الكمية × السعر. ما لا سعر له يبقى «بعرض».
      const byCode: Record<string, Item> = {};
      LIB.items.forEach((i) => { byCode[i.c] = i; });
      const secs: Record<string, { div: string; name: string; items: unknown[] }> = {};
      for (const x of (A.items ?? []) as { c: string; qty: number | null; est?: boolean; calc?: string }[]) {
        const it = byCode[x.c];
        if (!it) continue;
        const dv = x.c.slice(0, 2);
        const need = DIV_NEEDS[dv];
        const est = !!x.est || (need ? !disc.includes(need) : false);
        const qty = typeof x.qty === "number" && isFinite(x.qty) ? Math.round(x.qty * 100) / 100 : null;
        const rate = it.p.typ;
        (secs[dv] ??= { div: dv, name: it.d, items: [] }).items.push({
          code: it.c, name: it.n, unit: it.u, qty, est, rate,
          amount: qty != null && rate != null ? Math.round(qty * rate) : null,
          spec: it.desc + " " + it.spec,
          note: [x.calc, rate == null ? "السعر بعرض لغياب مصدر منشور كافٍ." : (it.p.basis === "توريد فقط" ? "السعر للتوريد فقط." : "")].filter(Boolean).join(" "),
        });
      }
      const doc = {
        title: A.title || pj.name, project: { name: pj.name, ref: pj.ref, rev: rq.rev }, date: new Date().toISOString().slice(0, 10),
        price_date: LIB.price_date, areas: A.areas ?? {},
        basis: "الكميات من مخططات الإصدار " + rq.rev + " (" + disc.map((k) => DISC[k] ?? k).join("، ") + ")، والبنود الموسومة «كمية تقديرية» محسوبة بنسب هندسية لعدم رفع مخططات تخصصها. أسعار الوحدات هي الأسعار النموذجية في مكتبة البنود.",
        sections: Object.keys(secs).sort().map((k) => secs[k]),
        assumptions: A.assumptions ?? [], excluded: A.excluded ?? [], questions: A.questions ?? [], skipped,
      };
      await db.from("boq_runs").update({ status: "done", result: doc, usage, finished_at: new Date().toISOString() }).eq("id", run.id);
      const { data: ex } = await db.from("boq_docs").select("id,published").eq("boq_id", boq_id).maybeSingle();
      if (ex) { if (!ex.published) await db.from("boq_docs").update({ data: doc }).eq("id", ex.id); }
      else await db.from("boq_docs").insert({ boq_id, data: doc });
      if (bq.status === "submitted") await db.from("boq_requests").update({ status: "in_review" }).eq("id", boq_id);
    } catch (e) {
      await fail(String((e as Error)?.message ?? e).slice(0, 500));
    }
  })();
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(job); else await job;
  return json({ ok: true, run_id: run.id }, 202);
});
