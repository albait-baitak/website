// تقويم بيتي: رابط تقويم خاص لكل مستخدم يشترك فيه من جواله مرة واحدة،
// ويتحدث وحده من بيانات أدواته: الصيانة الدورية، الضمانات، مهل الإصلاح، مدد تنفيذ البنود.
// الدخول بالرمز السري في الرابط وحده (verify_jwt = false)، والقراءة بمفتاح الخدمة.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = Deno.env.get("SITE_URL") ?? "https://albait-baitak.github.io/website/";
let TASKS: any[] = [];
async function loadTasks() {
  if (TASKS.length) return;
  const r = await fetch(SITE + "refs/guide/maintenance.json");
  if (r.ok) TASKS = (await r.json()).tasks ?? [];
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
function addMonths(d: Date, m: number) {
  if (m < 1) return addDays(d, Math.round(m * 28));
  const day = d.getUTCDate(), t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1));
  const dim = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, dim)); return t;
}
// الرياض: اليوم المحلي
function todayRiyadh() { const n = new Date(Date.now() + 3 * 3600e3); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); }

// معرّف ثابت بحروف لاتينية لكل حدث
function hid(s: string) { let h = 5381; for (const c of s) h = ((h << 5) + h + c.codePointAt(0)!) >>> 0; return h.toString(36); }
type Ev = { uid: string; date: Date; title: string; desc: string; url: string };
const esc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// طي الأسطر عند 75 بايتاً دون قطع الحرف العربي
function fold(line: string) {
  const enc = new TextEncoder(); const out: string[] = []; let cur = "", n = 0;
  for (const ch of line) { const b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; n = 0; } cur += ch; n += b; }
  out.push(cur); return out.join("\r\n ");
}
function ics(evs: Ev[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//albait-baitak//home-calendar//AR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:بيتي · البيت بيتك", "X-WR-TIMEZONE:Asia/Riyadh", "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H"];
  for (const e of evs) {
    const d = iso(e.date).replace(/-/g, ""), d2 = iso(addDays(e.date, 1)).replace(/-/g, "");
    L.push("BEGIN:VEVENT", `UID:${hid(e.uid)}-${iso(e.date).replace(/-/g, "")}@albait-baitak`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d2}`,
      fold("SUMMARY:" + esc(e.title)), fold("DESCRIPTION:" + esc(e.desc)), fold("URL:" + e.url), "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", fold("DESCRIPTION:" + esc(e.title)), "END:VALARM", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[a-f0-9]{64}$/.test(t)) return new Response("not found", { status: 404 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const tok = await db.from("cal_tokens").select("user_id").eq("token", t).maybeSingle();
  if (!tok.data) return new Response("not found", { status: 404 });
  const rows = await db.from("tool_data").select("key,data").eq("user_id", tok.data.user_id)
    .in("key", ["bb_tool_maint_v1", "bb_tool_firstyear_v1", "bb_tool_handover_v1", "bb_tool_agree_v1"]);
  const D: Record<string, any> = {}; for (const r of rows.data ?? []) D[r.key] = r.data;
  const today = todayRiyadh(), evs: Ev[] = [];

  // الصيانة الدورية: الموعد القادم لكل عمل مسجل؛ والمتأخر يظهر اليوم حتى يُنفذ
  const M = D["bb_tool_maint_v1"];
  if (M && M.last) {
    await loadTasks();
    for (const tk of TASKS) {
      if (M.off && M.off[tk.id]) continue; const last = parse(M.last[tk.id]); if (!last) continue;
      let due = addMonths(last, Number(tk.interval_months)); const late = due < today; if (late) due = today;
      evs.push({ uid: `m-${tk.id}-${iso(last)}`, date: due, title: (late ? "متأخر: " : "صيانة: ") + tk.task_ar,
        desc: (tk.how_ar ?? "") + "\nبعد التنفيذ سجّله في تقويم الصيانة.", url: SITE + "tools/maintenance/" });
    }
  }
  // الضمانات: تنبيه قبل النهاية بـ60 يوماً، ويوم النهاية
  const seen = new Set<string>();
  function warranty(item: string, end: string, who: string, src: string) {
    const e = parse(end); if (!e) return; const k = (item || "") + "|" + end; if (seen.has(k)) return; seen.add(k);
    const nm = item || "بلا اسم", pre = addDays(e, -60);
    if (pre >= addDays(today, -1)) evs.push({ uid: `w60-${src}-${k}`, date: pre, title: "بعد 60 يوماً ينتهي ضمان: " + nm, desc: (who ? "المورد أو المنفذ: " + who + "\n" : "") + "راجع ملاحظاتك المتعلقة به وطالب بها قبل انتهائه.", url: SITE + "tools/first-year/" });
    evs.push({ uid: `w-${src}-${k}`, date: e, title: "ينتهي اليوم ضمان: " + nm, desc: who ? "المورد أو المنفذ: " + who : "", url: SITE + "tools/first-year/" });
  }
  const F = D["bb_tool_firstyear_v1"];
  for (const w of F?.war ?? []) if (w && w.end && !w.res) warranty(w.item, w.end, w.who || w.sup || "", "fy");
  const H = D["bb_tool_handover_v1"];
  for (const w of H?.war ?? []) if (w && w.end) warranty(w.item, w.end, w.sup || "", "ho");
  for (const c of H?.con ?? []) if (c && c.until) warranty([c.item, c.name].filter(Boolean).join(" · "), c.until, c.ph || "", "hc");
  // مهل إصلاح نقاط الاستلام (✕)
  for (const id of Object.keys(H?.dl ?? {})) {
    if (H.st?.[id] !== "bad") continue; const d = parse(H.dl[id]); if (!d) continue;
    const note = H.notes?.[id] ? String(H.notes[id]).slice(0, 80) : "";
    evs.push({ uid: `hd-${id}-${H.dl[id]}`, date: d, title: "تنتهي مهلة إصلاح في الاستلام" + (note ? ": " + note : ""), desc: "تحقق من الإصلاح قبل التوقيع النهائي أو الدفعة الأخيرة.", url: SITE + "tools/handover/" });
  }
  // نهاية مدة تنفيذ كل بند متفق عليه
  for (const a of D["bb_tool_agree_v1"]?.ags ?? []) {
    const f = parse(a.from), n = parseInt(String(a.days ?? "").replace(/[^\d]/g, ""), 10); if (!f || !n) continue;
    const end = addDays(f, n);
    evs.push({ uid: `ag-${a.id}-${iso(end)}`, date: end, title: "نهاية مدة تنفيذ: " + (a.item || "بند"), desc: (a.con ? "المنفذ: " + a.con + "\n" : "") + "إن تأخر التنفيذ فارجع إلى بند التأخير في الاتفاق.", url: SITE + "tools/agreement/" });
  }
  return new Response(ics(evs), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache", "Content-Disposition": 'inline; filename="bayti.ics"' } });
});
