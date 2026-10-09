// دالة الفحص الآلي: تقرأ ملفات الطلب، وترسلها لـClaude مع قواعد الفحص الفني، وتحفظ مسودة التقرير.
// يشغّلها المشرف، أو صاحب الطلب حين يكون النشر الآلي مشغّلاً في الإعدادات؛ وحينها يُنشر التقرير فور اكتماله،
// وإلا بقي مسودة لا تصل للمكتب قبل مراجعة المعماري واعتماده.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { crossCheck, consText } from "./consist.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Rule = { c: string; l: number; n: string; r: string; src: string; clause?: string; q?: string; mand?: boolean; mand_styles?: string[]; styles?: string[]; when?: string; verify?: string; sbc?: string; disc?: string; sheet?: string; note?: string };
// القواعد مصدرها واحد: refs/rules_v2.json في المستودع المنشور
const RULES_URL = Deno.env.get("RULES_URL") ?? "https://albait-baitak.com/refs/rules_v2.json";
let RULES: Rule[] = [];
async function loadRules() {
  if (RULES.length) return;
  const r = await fetch(RULES_URL);
  if (!r.ok) throw new Error("rules_fetch:" + r.status);
  const J = await r.json();
  RULES = (J.RULES ?? []) as Rule[];
  if (!RULES.length) throw new Error("rules_empty");
  for (const s of J.sources ?? []) if (s?.id && !SRCN[s.id]) SRCN[s.id] = s.title_ar || s.id;
}
const SRCN: Record<string, string> = { RES: "اشتراطات إنشاء المباني السكنية 1446هـ", "AHSA-VILLA": "الدليل التطبيقي للفلل (عمارة واحات الأحساء)", "AHSA-GUIDE": "موجهات عمارة واحات الأحساء الكاملة", PARK: "دليل تصميم مواقف السيارات", PRO: "ستاندرد مهني", HOUSE: "قواعد البيت السعودي", SBC: "الكود السعودي للمباني السكنية SBC 1101 (2024)" };
function mandText(R: Rule): string {
  if (R.l === 2 || R.l === 4) return "";
  if (!R.mand) return "توصية";
  if (R.verify) return R.l === 5 ? "ملزم، وبعض قيمه بانتظار المطابقة على المجلد السعودي الحالي (" + R.verify + ")" : "ملزم بنص SBC 1101، والقيم المأخوذة من IRC 2021 بانتظار التحقق";
  if (R.mand_styles && R.mand_styles.length && R.mand_styles.length < 3) return "ملزم في " + R.mand_styles.join(" و") + "، وتوصية في غيره";
  return "ملزم";
}
const LNAME: Record<number, string> = { 1: "النظامية", 2: "العملية", 3: "الموجهات", 4: "الثقافية", 5: "الهندسية" };
const DISCN: Record<string, string> = { struct: "الإنشائي", elec: "الكهربائي", plumb: "الصحي", hvac: "التكييف والتهوية", fire: "السلامة والحريق" };
// الأقسام التي يختارها المكتب قبل الطلب؛ الطلبات القديمة بلا اختيار تُفحص بالأقسام المعمارية والاتساق
const SEC_LAYER: Record<string, number[]> = { reg: [1], guide: [3], arch: [2, 4], eng: [5] };
type Opts = { layers: number[]; cons: boolean; disc: string[] };

const GROUPS = {
  comp: { layers: [1, 3], name: "فحص المطابقة", desc: "الطبقة النظامية: الاشتراطات والكود، ثم طبقة الموجهات: موجهات العمارة السعودية لطراز الموقع" },
  qual: { layers: [2, 4], name: "فحص جودة التصميم", desc: "الطبقة العملية: صلاحية الفراغات للعيش، ثم الطبقة الثقافية: قواعد البيت السعودي" },
  eng: { layers: [5], name: "الفحص الهندسي", desc: "مخططات التخصصات المرفوعة مع المعماري: اكتمالها، ومطابقتها للكود السعودي واشتراطات البلدية، وتنسيقها مع المعماري" },
} as const;
type GroupId = keyof typeof GROUPS;

function buildPrompt(meta: string, g: GroupId, o: Opts): string {
  const G = GROUPS[g];
  const list = RULES.filter((R) => (G.layers as readonly number[]).includes(R.l) && o.layers.includes(R.l) && (R.l !== 5 || !R.disc || R.disc === "fire" || o.disc.includes(R.disc)));
  const rules = list.map((R) => {
    const parts = [`${R.c} | ${LNAME[R.l]} | ${R.n}`, `المطلوب: ${R.r}`];
    const m = mandText(R); if (m) parts.push(`الإلزام: ${m}`);
    if (R.styles && R.styles.length) parts.push(`الأنماط: ${R.styles.join("، ")}`);
    if (R.when) parts.push(`ينطبق عند: ${R.when}`);
    parts.push(`المرجع: ${SRCN[R.src] ?? R.src}${R.clause ? " · " + R.clause : ""}${R.sbc && R.src !== "SBC" ? " · SBC 1101: " + R.sbc : ""}`);
    if (R.q && (R.l === 1 || R.l === 3 || R.l === 5)) parts.push(`نص البند: ${R.q}`);
    if (R.l === 5) { if (R.disc) parts.push(`التخصص: ${DISCN[R.disc] ?? R.disc}`); if (R.sheet) parts.push(`يُبحث في: ${R.sheet}`); if (R.verify) { parts.push(`القيم بانتظار التحقق (${R.verify})`); if (R.note) parts.push(`حدود التحقق: ${R.note}`); } }
    return parts.join(" | ");
  }).join("\n");
  const common = "أنت فاحص معماري لمخططات المسكن السعودي، تُجري الفحص الفني للمخطط قبل رفعه للأمانة. مهمتك الآن: " + G.name + " (" + G.desc + ").\n\n" +
    "المرفقات لوحات مخطط واحد (مساقط، واجهات، قطاعات، رندرات). بيانات أدخلها المكتب: " + meta + "\n\n" +
    "قواعد صارمة:\n- لا تخترع رقماً. استخدم الأبعاد والمناسيب المكتوبة على اللوحات فقط. إن حسبت قيمة فاذكر الحساب باختصار. إن قست من الرسم بالمقياس فقل «بالقياس من الرسم».\n- ما لا يمكن قراءته بثقة حكمه unk ويتحول إلى سؤال.\n- إن وُجد استخراج من ملف DXF أو من طبقة النص في PDF فأرقامه مقروءة من ملف الرسم نفسه، فقدّمها على القياس من الصور واذكر «من ملف الرسم». في استخراج PDF يدل تجاور النصوص على السطر نفسه (y) على أنها تخص العنصر نفسه: اسم الفراغ وأبعاده تحته، والبُعد وقيمته. تحقق من الوحدة.\n- جدول الاستخراج: الحالة ok أو fail للمقروء من رقم مكتوب، و«بالقياس» لما قيس من الرسم، و«غير مقروء» لما تعذر؛ ولا تكتب في الخلاصة ما يناقض الجدول.\n- ما لا يوجد في المشروع (مناور، شطفة، شارع جانبي) حكمه na.\n- إن تعارض بندان رسميان في المسألة نفسها (مذكور في نص القاعدة) فالحكم conflict، واذكر البندين في f، ولا تحكم بمخالفة.\n- نص البند الحرفي مرجع الحكم، لكن لا تنقل في f أو fix كلمة «دورة» بأي صيغة؛ اكتب «حمام» أو «مرحاض».\n" +
    (g === "comp"
      ? "- الدرجة: stop للمخالفة الصريحة لبند ملزم، وmajor لما يُتوقع أن تلاحظه الأمانة ويُعالج قبل الرفع، وminor للتحسين المقترح. مخالفة قاعدة إلزامها «توصية» درجتها minor دائماً. ومخالفة قاعدة قيمها «بانتظار التحقق» لا تتجاوز major إلا إن خالفت جزءاً منصوصاً برقمه في SBC، واذكر في f أن القيمة من IRC 2021.\n" + (o.cons ? "- اتساق المخطط (consistency): انقل «فحوص الاتساق الآلية» و«المطابقة الآلية بين الملفات» الواردة في الاستخراج كما هي بحالاتها. ثم أضف ما تلاحظه أنت بالنظر من تعارض داخل المجموعة: عدد النوافذ والأبواب في كل واجهة مقابل جدارها في المسقط، والمداخل بين المسقط والواجهة والموقع العام، والمناسيب بين القطاع والواجهة، وعدد درجات الدرج مع فرق منسوب الدورين، وجدول المساحات مقابل مساحات المساقط. ما تلاحظه بالنظر حالته check، ولا تجعله conflict إلا إن كان رقمين مقروءين متعارضين. وما لا تتوفر لوحاته للمقارنة فاكتبه unchecked مع سببه في where. اكتب what جملة واحدة محددة، وwhere موضعه (اللوحة والدور). ولا تكرر هنا ما في results.\n" : "- لا تكتب consistency؛ المكتب لم يطلب قسم الاتساق.\n") + "- حكم المطابقة: ready إن لم توجد stop ولا major، وfix إن كانت العلاجات موضعية لا تغير التكوين، وredesign إن احتاج العلاج تغيير التكوين.\n- إن لم يُحدد المكتب نمط الطراز («لا أعرف»): القاعدة التي يختلف إلزامها أو قيمتها بين الأنماط لا تُحكم عليها بمخالفة؛ حكمها style، واكتب في f النتيجة لكل نمط باختصار (مثل: «تخالف إن كان تقليدياً، وتطابق في الانتقالي والمعاصر»)، فهي معلّقة على النمط ولا تدخل في حكم المطابقة. ولا تطالب المبنى بمتطلبات أنماط مختلفة في وقت واحد. أما القاعدة الملزمة في الأنماط الثلاثة فيُحكم عليها عادياً. واذكر في الأسئلة أن النمط يُؤكَّد من رخصة البناء.\n"
      : g === "eng"
      ? "- التخصصات المرفوعة: " + (o.disc.map((d) => DISCN[d] ?? d).join("، ") || "غير محددة") + "، ومعها السلامة والحريق. افحص كل قاعدة على لوحات تخصصها؛ وإن لم تجد بين المرفقات لوحات تخصص ما فحكم قواعده كلها unk، واكتب سؤالاً واحداً عن نقص لوحاته لا سؤالاً لكل قاعدة.\n- الدرجة: stop لمخالفة صريحة لبند ملزم بنص سعودي غير موسوم بالتحقق، وmajor لما يُتوقع أن تلاحظه الأمانة أو مكتب المراجعة، وminor للتوصيات والستاندرد المهني. والقاعدة الموسومة «بانتظار التحقق» لا تتجاوز major في قيمها، واذكر في f أن القيمة من المرجع المذكور؛ لكن ما تذكر «حدود التحقق» أنه نص سعودي مقروء (مثل منع باب المرآب إلى غرفة النوم) يُحكم عليه كاملاً.\n- كل ملاحظة تستند إلى بند: اذكر في f رقم البند ومرجعه كما في القاعدة، فقيمة التقرير أن كل ملاحظة فيه منسوبة إلى نص.\n- لا تحكم على تصميم إنشائي أو كهربائي بالحساب (كفاية التسليح أو مقطع كابل بالحمل)؛ افحص ما هو مكتوب ومرسوم على اللوحات ومطابقته للقيم المنصوصة فقط.\n"
      : "- الدرجة: major أو minor فقط، ولا stop أبداً. هذا الفحص لا يدخل في حكم المطابقة.\n") +
    "- مصدر كل ملاحظة ملزم ليصل إليها المهندس بسرعة: لكل نتيجة حكمها fail أو conflict أو unk أو style، ولكل بند في consistency، اكتب src بهذا الشكل: «اسم الملف كما ورد · صفحة N (عنوان اللوحة إن ظهر) · العنصر (الغرفة أو البُعد أو الرمز)». وفي ملف DXF اكتب اسم اللوحة أو الدور بدل رقم الصفحة. ولا تكتب رقم صفحة أو لوحة لم تتحقق منه؛ وإن لم تُبنَ الملاحظة على موضع محدد فاكتب «عام». وفي ok اكتب src إن كان الموضع واضحاً.\n" +
    "- الإيجاز ملزم: f جملة واحدة بالأرقام، وfix جملة واحدة محددة قابلة للتنفيذ، ولا تكتب fix لما حكمه ok أو na.\n- اكتب بالعربية الفصحى، واستخدم «..» لا «…».\n\n" +
    "القواعد (الرمز | الطبقة | الاسم | المطلوب):\n" + rules + "\n\n";
  const shape = g === "comp"
    ? '{"title":"اسم المشروع إن ظهر","sub":"المدينة · الأرض · الأدوار","verdict":"ready|fix|redesign","summary":"خلاصة فحص المطابقة في سطر","assumptions":["..."],"results":{"SETBACK-01":{"v":"ok|fail|na|unk|conflict|style","sev":"stop|major|minor","f":"..","fix":"..","src":"الملف · صفحة N (اللوحة) · العنصر"}},"extraction":[["الدور","الفراغ","الأبعاد","المساحة م²","الحد النظامي","الحالة"]],"consistency":[{"kind":"in|cross","state":"ok|conflict|check|unchecked","what":"..","where":"..","src":"الملف · صفحة N"}],"questions":["..."]}'
    : g === "eng"
    ? '{"summary":"خلاصة الفحص الهندسي في سطر","assumptions":["..."],"results":{"STR-01":{"v":"ok|fail|na|unk","sev":"stop|major|minor","f":"..","fix":"..","src":"الملف · صفحة N (اللوحة) · العنصر"}},"questions":["..."]}'
    : '{"summary":"خلاصة فحص جودة التصميم في سطر","assumptions":["..."],"results":{"PRAC-01":{"v":"ok|fail|na|unk|conflict","sev":"major|minor","f":"..","fix":"..","src":"الملف · صفحة N (اللوحة) · العنصر"}},"questions":["..."]}';
  return common + "أعد JSON فقط، بلا أي نص قبله أو بعده، بهذا الشكل:\n" + shape + "\nضع في results كل الرموز المذكورة أعلاه دون استثناء، ولا رمزاً غيرها.";
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


// يستدعي Claude بالبث حتى لا ينقطع الاتصال في الطلبات الطويلة، ويجمع النص والاستهلاك وسبب التوقف
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

  // من يشغّل الفحص: المشرف دائماً، وصاحب الطلب نفسه حين يكون النشر الآلي مشغّلاً (مرة واحدة لكل إصدار)
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: isAdmin } = await userClient.rpc("is_admin");
  const { data: who } = await userClient.auth.getUser();
  if (!apiKey) return json({ error: "missing_api_key", message: "أضف ANTHROPIC_API_KEY في أسرار الدوال" }, 500);

  const { request_id } = await req.json().catch(() => ({}));
  if (!request_id) return json({ error: "missing_request_id" }, 400);

  const db = createClient(url, service);
  const { data: rq, error: rqErr } = await db.from("requests").select("*").eq("id", request_id).single();
  if (rqErr || !rq) return json({ error: "request_not_found" }, 404);
  const { data: setRow } = await db.from("app_settings").select("value").eq("key", "auto_publish").maybeSingle();
  const autoPublish = setRow?.value === true;
  if (!isAdmin) {
    if (!autoPublish || !who?.user || who.user.id !== rq.user_id) return json({ error: "not_allowed" }, 403);
    const { data: done } = await db.from("analysis_runs").select("id").eq("request_id", request_id).in("status", ["running", "done"]).limit(1);
    if (done && done.length) return json({ ok: true, already: true }, 202);
  }

  // تشغيل واحد في كل مرة لكل طلب
  const { data: running } = await db.from("analysis_runs").select("id,created_at").eq("request_id", request_id).eq("status", "running")
    .gte("created_at", new Date(Date.now() - 8 * 60 * 1000).toISOString()).limit(1);
  if (running && running.length) return json({ ok: true, run_id: running[0].id, already: true }, 202);

  const { data: run, error: runErr } = await db.from("analysis_runs").insert({ request_id, model, status: "running" }).select("id").single();
  if (runErr || !run) return json({ error: "run_insert" }, 500);

  const job = (async () => {
    const t0 = Date.now();
    const fail = async (msg: string, extra: Record<string, unknown> = {}) => {
      await db.from("analysis_runs").update({ status: "error", error: msg, finished_at: new Date().toISOString(), ...extra }).eq("id", run.id);
    };
    try {
      await loadRules();
      const p = rq.project ?? {};
      const meta = [
        p.type && `نوع المسكن: ${p.type}`, p.floors && `الأدوار: ${p.floors}`,
        (p.city || p.district) && `الموقع: ${[p.city, p.district].filter(Boolean).join(" · ")}`,
        p.area && `مساحة الأرض: ${p.area} م²`, p.streets && `الشوارع: ${p.streets}`,
        `نمط الطراز: ${p.pattern || "لا أعرف"}`, p.prev && `ملاحظات سابقة من الأمانة: ${p.prev}`,
      ].filter(Boolean).join(" · ") || "لم تُدخل بيانات";

      type F = { path: string; name: string; type?: string; size?: number; role?: string; of?: string };
      const blocks: unknown[] = [];
      const skipped: string[] = [];
      const dxfTexts: string[] = [];
      // deno-lint-ignore no-explicit-any
      const dxfObjs: any[] = [], pdfObjs: any[] = [];
      let budget = 24 * 1024 * 1024;
      const all = (rq.files ?? []) as F[];
      const isEx = (f: F) => f.role === "dxf_extract" || f.role === "pdf_extract";
      const ordered = [...all.filter(isEx), ...all.filter((f) => !isEx(f))];
      for (const f of ordered) {
        const lower = (f.path || f.name).toLowerCase();
        if (isEx(f)) {
          const { data: blob } = await db.storage.from("plans").download(f.path);
          if (!blob) { skipped.push(f.name); continue; }
          try { const ex = JSON.parse(await blob.text()); if (ex?.text) dxfTexts.push(ex.text); (f.role === "dxf_extract" ? dxfObjs : pdfObjs).push(ex); } catch { skipped.push(f.name); }
          continue;
        }
        if (lower.endsWith(".dxf")) continue;
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
        // اسم كل ملف قبل محتواه، ليكتب الفحص مصدر كل ملاحظة: الملف والصفحة
        blocks.push({ type: "text", text: f.role === "dxf_view" ? "صورة معاينة مرسومة من ملف DXF: «" + (f.of || f.name) + "»" : isPdf ? "الملف «" + f.name + "» (PDF، صفحاته مرقمة من 1 بترتيبها في الملف):" : "الملف «" + f.name + "» (صورة):" });
        blocks.push(isPdf
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
          : { type: "image", source: { type: "base64", media_type: imgType, data } });
      }
      if (!blocks.length && !dxfTexts.length) return await fail("no_readable_files", { result: { skipped } });
      const proj = rq.project ?? {};
      const sections: string[] = Array.isArray(proj.sections) && proj.sections.length ? proj.sections : ["reg", "guide", "arch", "cons"];
      const opts: Opts = { layers: sections.flatMap((x) => SEC_LAYER[x] ?? []), cons: sections.includes("cons"), disc: Array.isArray(proj.disc) ? proj.disc : [] };
      if (dxfObjs.length && pdfObjs.length && opts.cons) {
        try {
          const cc = crossCheck(dxfObjs[0], pdfObjs[0]);
          if (cc.length) dxfTexts.push("مطابقة آلية بين ملف الرسم وملف الـPDF (حسابية من الملفين، فانقلها كما هي إلى consistency بالنوع cross):\n" + consText(cc));
        } catch { /* المطابقة إضافة لا تمنع الفحص */ }
      }
      if (dxfTexts.length) blocks.push({ type: "text", text: "استخراج آلي من ملفات الرسم المرفوعة (DXF أو طبقة النص في PDF المصدّر من برنامج الرسم)، أرقامه مقروءة من الملف نفسه لا من الصورة:\n\n" + dxfTexts.join("\n\n---\n\n") });

      // مسارات متوازية بحسب الأقسام المطلوبة: المطابقة (النظامية والموجهات والاتساق)، وجودة التصميم، والفحص الهندسي
      const want: GroupId[] = [];
      if (opts.layers.some((l) => l === 1 || l === 3) || opts.cons) want.push("comp");
      if (opts.layers.some((l) => l === 2 || l === 4)) want.push("qual");
      if (opts.layers.includes(5)) want.push("eng");
      if (!want.length) return await fail("no_sections");
      const outs = await Promise.all(want.map((g) => callClaude(apiKey, model, [...blocks, { type: "text", text: buildPrompt(meta, g, opts) }])));
      const pr = PRICE[model] ?? [0, 0];
      // deno-lint-ignore no-explicit-any
      const usage: Record<string, any> = { seconds: Math.round((Date.now() - t0) / 1000), usd: 0 };
      let tin = 0, tout = 0;
      want.forEach((g, i) => { usage[g] = { ...outs[i].usage, stop: outs[i].stop }; tin += outs[i].usage.input_tokens ?? 0; tout += outs[i].usage.output_tokens ?? 0; });
      usage.usd = Math.round(((tin * pr[0] + tout * pr[1]) / 1e6) * 1000) / 1000;
      // deno-lint-ignore no-explicit-any
      const P: Record<string, any> = {};
      for (let i = 0; i < want.length; i++) {
        try { P[want[i]] = extractJson(outs[i].text); } catch { return await fail("bad_json", { usage, result: { part: want[i], stop: outs[i].stop, text: outs[i].text.slice(0, 20000) } }); }
      }
      const A = P.comp ?? {}, Q = P.qual ?? {}, E = P.eng ?? {};

      const uniq = (a: unknown[]) => [...new Set(a.filter(Boolean))];
      const report = {
        kind: "live", ref: rq.ref,
        title: (A.title as string) || "مخطط مرفوع",
        sub: (A.sub as string) || "",
        verdict: opts.layers.includes(1) ? (A.verdict ?? "fix") : null,
        sections,
        disc: opts.disc,
        summary: [A.summary ?? "", Q.summary ?? "", E.summary ?? ""],
        assumptions: uniq([...(A.assumptions ?? []), ...(Q.assumptions ?? []), ...(E.assumptions ?? [])]),
        results: { ...(E.results ?? {}), ...(Q.results ?? {}), ...(A.results ?? {}) },
        extraction: A.extraction ?? [],
        consistency: opts.cons && Array.isArray(A.consistency) ? A.consistency.filter((c: any) => c && c.what).slice(0, 60) : [],
        questions: uniq([...(A.questions ?? []), ...(Q.questions ?? []), ...(E.questions ?? [])]),
        files: (rq.files ?? []).filter((f: F) => !f.role).map((f: F) => f.name).join(" · "),
        skipped,
        foot: autoPublish ? "فحص آلي على المرجع." : "فحص آلي أولي على المرجع، يراجعه المعماري قبل اعتماده.",
        reviewed: false,
      };
      await db.from("analysis_runs").update({ status: "done", result: report, usage, finished_at: new Date().toISOString() }).eq("id", run.id);
      const { data: existing } = await db.from("reports").select("id,published").eq("request_id", request_id).maybeSingle();
      // النشر الآلي: يصل التقرير صاحبه فوراً، ويبقى للمشرف أن يراجعه بعدها
      const pub = autoPublish ? { published: true, published_at: new Date().toISOString(), auto: true } : {};
      if (!existing) await db.from("reports").insert({ request_id, data: report, ...pub });
      else if (!existing.published) await db.from("reports").update({ data: report, ...pub }).eq("id", existing.id);
      if (autoPublish) await db.from("requests").update({ status: "published" }).eq("id", request_id);
      else if (rq.status === "submitted") await db.from("requests").update({ status: "in_review" }).eq("id", request_id);
    } catch (e) {
      const m = String((e as Error)?.message ?? e);
      await fail(m.startsWith("api_error:") ? m : "exception:" + m.slice(0, 500));
    }
  })();

  // يكمل الفحص في الخلفية، ويرجع الرد فوراً حتى لا ينقطع اتصال المتصفح
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(job); else await job;
  return json({ ok: true, run_id: run.id }, 202);
});
