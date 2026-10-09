// مطابقة آلية بين ملف الرسم (استخراج DXF) وملف PDF للطلب نفسه: رموز الفتحات، والمناسيب، وعناوين اللوحات.
// حسابية بلا ذكاء اصطناعي، فتُعطى للفحص ليعتمدها في قسم «اتساق المخطط».
export type Cons = { kind: "in" | "cross"; state: "ok" | "conflict" | "check" | "unchecked"; what: string; where: string };

const PLAN = new Set(["plan", "roof"]);
function num(s: string): number | null {
  const m = String(s).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".").match(/[+\-±]?\s*\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const t = m[0].replace(/\s/g, "").replace(",", ".").replace("±", "");
  const v = parseFloat(t);
  return isFinite(v) ? v : null;
}
function norm(s: string): string {
  return String(s || "").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, "").toLowerCase();
}

// deno-lint-ignore no-explicit-any
export function crossCheck(dxf: any, pdf: any): Cons[] {
  const out: Cons[] = [];
  const pages = Array.isArray(pdf?.sheets) ? pdf.sheets : [];
  const textPages = pages.filter((p: any) => !p.raster);
  if (!textPages.length) {
    out.push({ kind: "cross", state: "unchecked", what: "مطابقة ملف الرسم بملف الـPDF", where: "ملف الـPDF صور ممسوحة بلا طبقة نص" });
    return out;
  }
  const dn = dxf?.file || "ملف الرسم", pn = pdf?.name || "ملف الـPDF";

  // 1) رموز الفتحات في المساقط
  const dT: Record<string, number> = dxf?.tags?.plan || {};
  const typed = textPages.some((p: any) => p.type);
  const pT: Record<string, number> = {};
  textPages.forEach((p: any) => {
    if (typed && p.type && !PLAN.has(p.type)) return;
    Object.entries(p.tags || {}).forEach(([k, n]) => { pT[k] = (pT[k] || 0) + Number(n); });
  });
  const dk = Object.keys(dT), pk = Object.keys(pT);
  if (dk.length && pk.length) {
    let issues = 0;
    dk.filter((k) => !pT[k]).forEach((k) => { issues++; out.push({ kind: "cross", state: "conflict", what: `الرمز ${k} في مساقط ${dn} (${dT[k]}) غير موجود في ${pn}`, where: "" }); });
    pk.filter((k) => !dT[k]).forEach((k) => { issues++; out.push({ kind: "cross", state: "check", what: `الرمز ${k} في ${pn} غير موجود في مساقط ${dn}`, where: "" }); });
    // الـPDF قد يكرر الرمز في جدول الفتحات، فالنقص فيه وحده تعارض
    dk.filter((k) => pT[k] && pT[k] < dT[k]).forEach((k) => { issues++; out.push({ kind: "cross", state: "conflict", what: `الرمز ${k}: في ${dn} ${dT[k]} مرة، وفي ${pn} ${pT[k]} مرة فقط`, where: "" }); });
    if (!issues) out.push({ kind: "cross", state: "ok", what: `رموز الفتحات في المساقط (${dk.length}) موجودة في الملفين بأعداد متوافقة`, where: "" });
  } else out.push({ kind: "cross", state: "unchecked", what: "مطابقة رموز الفتحات بين الملفين", where: !dk.length ? `لا رموز فتحات مكتوبة في مساقط ${dn}` : `لا رموز فتحات مقروءة في ${pn}` });

  // 2) المناسيب
  const dL = (dxf?.levels || []).map((l: any) => ({ s: l.s, v: num(l.s) })).filter((l: any) => l.v != null);
  const pL: { s: string; v: number }[] = [];
  textPages.forEach((p: any) => (p.levels || []).forEach((s: string) => { const v = num(s); if (v != null) pL.push({ s, v }); }));
  if (dL.length && pL.length) {
    let issues = 0;
    const seen = new Set<string>();
    dL.forEach((a: any) => {
      if (seen.has(a.s)) return; seen.add(a.s);
      if (pL.some((b) => Math.abs(b.v - a.v) < 0.005)) return;
      const near = pL.filter((b) => Math.abs(b.v - a.v) <= 0.3).sort((x, y) => Math.abs(x.v - a.v) - Math.abs(y.v - a.v))[0];
      if (near) { issues++; out.push({ kind: "cross", state: "check", what: `منسوب ${a.s} في ${dn}، وأقرب منسوب له في ${pn} ${near.s}`, where: "" }); }
    });
    if (!issues) out.push({ kind: "cross", state: "ok", what: "المناسيب المكتوبة متطابقة بين الملفين", where: "" });
  }

  // 3) عناوين اللوحات
  const pText = norm(pdf?.text || "");
  const titles = (dxf?.sheetTypes || []).filter((t: any) => t.type && t.title && t.title.length >= 5);
  if (titles.length && pText) {
    const miss = titles.filter((t: any) => pText.indexOf(norm(t.title)) < 0);
    miss.forEach((t: any) => out.push({ kind: "cross", state: "check", what: `لوحة «${t.title}» في ${dn} لا يظهر عنوانها في ${pn}`, where: "" }));
    if (!miss.length) out.push({ kind: "cross", state: "ok", what: `عناوين اللوحات في ${dn} (${titles.length}) كلها في ${pn}`, where: "" });
  }
  return out;
}

const ARS: Record<string, string> = { ok: "متسق", conflict: "متعارض", check: "للتحقق", unchecked: "لم يُفحص" };
export function consText(list: Cons[]): string {
  return list.map((c) => `- [${ARS[c.state]}] ${c.what}${c.where ? " · " + c.where : ""}`).join("\n");
}
