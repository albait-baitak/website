// دالة جداول الكميات: تقرأ ملفات إصدار المشروع، ويستخرج Claude منها البيانات الخام فقط (فراغات وجدران وفتحات وعناصر إنشائية)،
// ثم يحسب calc.ts كل بند بمعادلة ثابتة على طريقة قياس مكتبة البنود، ويُسعّره منها، ويفحص معقوليته.
// تُحفظ مسودة لا تصل المكتب قبل مراجعة المعماري واعتماده.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { compute, assemble, checks, type Takeoff, type LibItem } from "./calc.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// المكتبة ودليل النقاط مصدرهما واحد: الموقع المنشور
const SITE = Deno.env.get("SITE_URL") ?? "https://albait-baitak.com/";
const LIB_URL = Deno.env.get("BOQ_LIB_URL") ?? SITE + "refs/boq/boq_library.json";
let LIB: { built: string; price_date: string } = { built: "", price_date: "" };
let LIBRAW: LibItem[] = [];
async function loadLib() {
  if (LIBRAW.length) return;
  const r = await fetch(LIB_URL);
  if (!r.ok) throw new Error("lib_fetch:" + r.status);
  const L = await r.json();
  LIB = { built: L.built, price_date: "يوليو 2026" };
  LIBRAW = (L.items as any[]).map((i) => ({ c: i.code, d: i.div_ar, n: i.name_ar, u: i.unit_ar, desc: i.desc_ar, spec: i.spec_ar, m: i.measure_ar,
    p: { low: i.price.low, typ: i.price.typ, high: i.price.high, basis: i.price.basis } }));
}
const DISC: Record<string, string> = { arch: "معماري", struct: "إنشائي", elec: "كهربائي", plumb: "صحي", hvac: "تكييف" };

function buildPrompt(meta: string, disc: string[], note: string): string {
  const have = disc.map((k) => DISC[k] ?? k).join("، ");
  const missing = Object.keys(DISC).filter((k) => !disc.includes(k)).map((k) => DISC[k]).join("، ") || "لا شيء";
  return "أنت مهندس كميات سعودي. مهمتك الآن القراءة فقط: تستخرج من لوحات الفيلا المرفقة البيانات الخام التي تُحسب منها الكميات، ولا تحسب أي كمية إجمالية بنفسك؛ الحساب يتم بعدك بمعادلات ثابتة.\n" +
    "بيانات المشروع: " + meta + "\nالتخصصات المرفوعة: " + have + ". غير المرفوعة: " + missing + ".\n" + (note ? "ملاحظات المكتب: " + note + "\n" : "") + "\n" +
    "قواعد صارمة:\n" +
    "- لا تخترع رقماً. ما لا يُقرأ بثقة اكتبه null واذكره في questions. والقياس من الرسم بالمقياس ليس اختراعاً: هو عمل مهندس الكميات حين لا يُكتب البُعد.\n" +
    "- المقياس: خذ بُعداً مكتوباً على اللوحة نفسها مرجعاً (ضلع الأرض، أو محور، أو بُعد غرفة مكتوب)، وقس به ما لم يُكتب، واكتب src=\"scale\". لا تترك فراغاً أو جداراً بلا أبعاد إلا إن تعذر القياس أيضاً.\n" +
    "- إن وُجد استخراج من ملف DXF أو من طبقة النص في PDF فأرقامه من ملف الرسم نفسه، فقدّمها على القراءة من الصور، واكتب src=\"dxf\" أو src=\"pdf\". في استخراج PDF: النصوص على السطر نفسه (y) متجاورة في الرسم، فاسم الفراغ وأبعاده تحته عادة، ورموز الفتحات (D1، W2) وأعدادها في كل لوحة مذكورة؛ والعدد الفعلي من المساقط لا من الجداول والواجهات. وما قرأته من بُعد مكتوب src=\"dim\"، وما قسته بالمقياس src=\"scale\".\n" +
    "- الفراغات: لكل فراغ في كل دور اسمه واستخدامه وأبعاده الصافية L وW إن كان مستطيلاً، وإلا area_m2 وperimeter_m. ارتفاع السقف الصافي h_m إن ظهر في القطاعات. مادة الأرضية والسقف إن ظهرتا في جدول التشطيبات أو المخطط، وإلا porcelain وpaint. ارتفاع تكسية الجدران wall_tile_h_m للحمامات والمطبخ والغسيل إن ظهر.\n" +
    "- use واحدة من: majlis, living, dining, master, bed, maid, kitchen, bath, wc, laundry, corridor, stair, store, outdoor_covered, other. (bath حمام كامل، wc مرحاض ومغسلة ضيوف).\n" +
    "- floor_finish واحدة من: porcelain, ceramic, marble, parquet, vinyl, stone, other, none. وceiling واحدة من: gypsum, paint, none.\n" +
    "- الجدران: لكل دور أطوال الجدران على المحور مجمّعة بنوعها: ext20 خارجي 20 سم، int15 داخلي 15 سم، int10 داخلي 10 سم، below20 تحت منسوب الأرض. اجمع الطول من الأبعاد المكتوبة، وما لم يُكتب فقسه من الرسم بالمقياس واذكر ذلك في assumptions. الجدار الخارجي محيط المبنى في كل دور، والداخلي مجموع الفواصل بين الفراغات.\n" +
    "- الفتحات: من جدول الأبواب والنوافذ إن وُجد، وإلا من المساقط؛ kind: door_main (باب مدخل الفيلا), door_ext (باب خارجي آخر في المبنى), door_int, window, sliding؛ ومعها tag (رمزها في الجدول مثل D1 أو W2) وw وh بالمتر وcount، وin=ext للفتحات في الجدران الخارجية وint للداخلية. count هو عدد تكرار الرمز في المساقط بعدّه فعلاً، وإن لم تستطع عدّه فاكتبه null ولا تفترض 1. بوابات السور ليست أبواباً: بوابة السيارات gate_car وبوابة المشاة gate_ped.\n" +
    "- الأدوار: لكل دور المسطح الإجمالي gross_m2 من جدول المساحات إن وُجد، وارتفاعه من البلاطة إلى البلاطة height_m، وسمك البلاطة slab_thk_m.\n" +
    "- السطح والموقع: مسقط السطح، وطول الدروة وارتفاعها، ومساحة الأرض ومحيطها، وطول السور، وعدد بوابات السيارات gates_car وبوابات المشاة gates_ped، ومساحة المسطحات الخضراء والأرضيات الخارجية إن ظهرت في الموقع العام.\n" +
    "- الواجهات: stone_m2 مساحة تكسية الحجر إن ظهرت مادتها وأبعادها في الواجهات، وإلا null.\n" +
    "- الدرج: عدد الدرجات وعرضها لكل درج. والدرابزين: طوله الإجمالي.\n" +
    "- الكهرباء والسباكة والتكييف (mep): أعداد فقط ومن مخططاتها فقط إن رُفعت: light, socket, ac_points, lowcurrent, water_points, drain_points, wc, basin, sink, heaters, manholes, split_units, ducted_units, exhaust_fans, panels. وإن لم تُرفع فاترك mep فارغاً {}.\n" +
    "- الإنشائي (structure): فقط إن رُفعت المخططات الإنشائية، من جداول القواعد والأعمدة والكمرات والبلاطات: footings [{count,L,W,D}]، necks [{count,w,d,h}]، ties [{length_m,w,d}]، slab_on_grade {area_m2,thk_m}، columns [{floor,count,w,d,h}]، slabs [{floor,area_m2,thk_m,type:\"solid|hordi\"}]، beams [{floor,length_m,w,d}] بطول إجمالي لكل مقطع، وstairs_m3 وexcavation_m3 وbackfill_m3 وrebar_t إن كُتبت صراحة. وإن لم تُرفع فاجعله null.\n" +
    "- floor في كل عنصر هو id الدور كما عرّفته في floors (مثل G وF وA).\n" +
    "- اكتب بالعربية الفصحى في الأسماء والأسئلة، واستخدم «..» لا «…».\n\n" +
    'أعد JSON فقط، بلا أي نص قبله أو بعده، بهذا الشكل:\n{"title":"","plot":{"area_m2":null,"perimeter_m":null,"fence_m":null,"gates_car":null,"gates_ped":null,"yard_soft_m2":null,"yard_hard_m2":null},"floors":[{"id":"G","name":"الدور الأرضي","gross_m2":null,"height_m":null,"slab_thk_m":null}],"roof":{"area_m2":null,"parapet_m":null,"parapet_h_m":null},"rooms":[{"floor":"G","name":"المجلس","use":"majlis","L":null,"W":null,"area_m2":null,"perimeter_m":null,"h_m":null,"floor_finish":"porcelain","ceiling":"paint","wall_tile_h_m":null,"src":"dim"}],"walls":[{"floor":"G","kind":"ext20","length_m":0,"height_m":null}],"openings":[{"floor":"G","kind":"window","tag":"W1","w":1.5,"h":1.6,"count":null,"in":"ext"}],"facade":{"stone_m2":null},"stairs":[{"steps":null,"width_m":null}],"railings_m":null,"mep":{},"structure":null,"assumptions":[],"questions":[],"excluded":[]}';
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
      const isEx = (f: F) => f.role === "dxf_extract" || f.role === "pdf_extract";
      for (const f of [...all.filter(isEx), ...all.filter((f) => !isEx(f))]) {
        const lower = (f.path || f.name).toLowerCase();
        if (isEx(f)) {
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
      if (dxfTexts.length) blocks.push({ type: "text", text: "استخراج آلي من ملفات الرسم (DXF أو طبقة النص في PDF):\n\n" + dxfTexts.join("\n\n---\n\n") });

      const disc: string[] = bq.disciplines?.length ? bq.disciplines : ["arch"];
      const r = await callClaude(apiKey, model, [...blocks, { type: "text", text: buildPrompt(meta, disc, bq.note ?? "") }]);
      const pr = PRICE[model] ?? [0, 0];
      const usage = { ...r.usage, stop: r.stop, seconds: Math.round((Date.now() - t0) / 1000),
        usd: Math.round((((r.usage.input_tokens ?? 0) * pr[0] + (r.usage.output_tokens ?? 0) * pr[1]) / 1e6) * 1000) / 1000 };
      let A: Record<string, any>;
      try { A = extractJson(r.text) as Record<string, any>; } catch { return await fail("bad_json", { usage, result: { stop: r.stop, text: r.text.slice(0, 20000) } }); }

      // الحساب: معادلات ثابتة على ما قُرئ، ثم التسعير من المكتبة، ثم فحوص المعقولية
      const T = A as Takeoff;
      let points: unknown = null;
      try { const pr2 = await fetch(SITE + "refs/guide/points.json"); if (pr2.ok) points = await pr2.json(); } catch { /* التقدير من دليل النقاط اختياري */ }
      const C = compute(T, points);
      const P = assemble(C, LIBRAW);
      const K = checks(C, T, { skeleton: P.skeleton, finish: P.finish, total: P.total }, { byCode: P.byCode });
      const doc = {
        v: 2, title: A.title || pj.name, project: { name: pj.name, ref: pj.ref, rev: rq.rev }, date: new Date().toISOString().slice(0, 10),
        price_date: LIB.price_date, areas: { built_m2: Math.round(C.built * 100) / 100 },
        basis: "الكميات محسوبة بمعادلات ثابتة على ما قُرئ من مخططات الإصدار " + rq.rev + " (" + disc.map((k) => DISC[k] ?? k).join("، ") + ")، على طريقة القياس المكتوبة لكل بند في مكتبة البنود، ولكل بند سطر حساب. البنود الموسومة «تقدير» محسوبة بقاعدة مكتوبة لعدم رفع مخططات تخصصها. أسعار الوحدات هي الأسعار النموذجية في المكتبة.",
        mode: { skeleton: C.skeletonByIndicator ? "indicator" : "measured", finish: C.finishByIndicator ? "indicator" : C.coverage < 0.75 ? "partial" : "measured", coverage: Math.round(C.coverage * 100) },
        sections: P.sections, total: P.total, checks: K,
        assumptions: [...C.assumptions, ...(A.assumptions ?? [])], excluded: A.excluded ?? [], questions: C.questions, skipped,
        takeoff: T,
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
