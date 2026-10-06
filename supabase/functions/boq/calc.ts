// محرك حساب الكميات: يأخذ ما قُرئ من المخطط (فراغات وجدران وفتحات وعناصر إنشائية) ويحسب كل بند
// بمعادلة ثابتة على طريقة القياس المكتوبة في مكتبة البنود. لكل بند سطر حساب يبين من أين جاء رقمه.
// القراءة يقوم بها الذكاء الاصطناعي، والحساب هنا وحده، فنفس البيانات تعطي نفس الكميات دائماً.

export type Takeoff = {
  title?: string;
  plot?: { area_m2?: number | null; perimeter_m?: number | null; fence_m?: number | null; gates_car?: number | null; yard_soft_m2?: number | null; yard_hard_m2?: number | null };
  floors?: { id: string; name?: string; gross_m2?: number | null; height_m?: number | null; slab_thk_m?: number | null }[];
  roof?: { area_m2?: number | null; parapet_m?: number | null; parapet_h_m?: number | null };
  rooms?: { floor: string; name?: string; use?: string; L?: number | null; W?: number | null; area_m2?: number | null; perimeter_m?: number | null; h_m?: number | null; floor_finish?: string | null; ceiling?: string | null; wall_tile_h_m?: number | null; src?: string }[];
  walls?: { floor: string; kind: string; length_m: number; height_m?: number | null }[];
  openings?: { floor?: string; kind: string; w: number; h: number; count?: number; in?: string }[];
  facade?: { stone_m2?: number | null; ext_finish_m2?: number | null };
  stairs?: { steps?: number | null; width_m?: number | null }[];
  railings_m?: number | null;
  mep?: Record<string, number | null>;
  structure?: null | {
    footings?: { count: number; L: number; W: number; D: number }[];
    necks?: { count: number; w: number; d: number; h: number }[];
    ties?: { length_m: number; w: number; d: number }[];
    slab_on_grade?: { area_m2: number; thk_m: number } | null;
    columns?: { floor?: string; count: number; w: number; d: number; h: number }[];
    slabs?: { floor?: string; area_m2: number; thk_m: number; type?: string }[];
    beams?: { floor?: string; length_m: number; w: number; d: number }[];
    stairs_m3?: number | null;
    excavation_m3?: number | null;
    backfill_m3?: number | null;
    rebar_t?: number | null;
  };
  assumptions?: string[]; questions?: string[]; excluded?: string[];
};
export type LibItem = { c: string; d: string; n: string; u: string; desc: string; spec: string; m: string; p: { low: number | null; typ: number | null; high: number | null; basis?: string } };
export type Line = { code: string; qty: number | null; calc: string; est?: boolean; info?: boolean };
export type Check = { name: string; value: string; expected: string; ok: boolean; note?: string };

const r2 = (x: number) => Math.round(x * 100) / 100;
const f2 = (x: number) => String(r2(x));
const num = (x: unknown): number | null => (typeof x === "number" && isFinite(x) && x >= 0 ? x : null);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

// غرف الأفراد في دليل النقاط ↔ استخدامات الفراغات المقروءة
const USE2POINTS: Record<string, string> = { majlis: "majlis", living: "living", dining: "dining", master: "master-bed", bed: "bedroom", maid: "maid-room", kitchen: "kitchen", bath: "bathroom", wc: "guest-wc", laundry: "laundry", corridor: "entrance", stair: "stairs", outdoor_covered: "carport" };
const WET = ["bath", "wc", "laundry"];

export function compute(T: Takeoff, points: any | null) {
  const lines: Line[] = [];
  const A: string[] = [];          // افتراضات الحساب
  const Q: string[] = [...(T.questions ?? [])];
  const add = (code: string, qty: number | null, calc: string, est = false, info = false) => lines.push({ code, qty: qty == null ? null : r2(qty), calc, est, info });

  const floors = T.floors ?? [];
  const fl: Record<string, { h: number; thk: number; name: string; gross: number | null }> = {};
  let defaultedH = false, defaultedT = false;
  for (const f of floors) {
    const h = num(f.height_m); const t = num(f.slab_thk_m);
    if (h == null) defaultedH = true; if (t == null) defaultedT = true;
    fl[f.id] = { h: h ?? 3.4, thk: t ?? 0.2, name: f.name ?? f.id, gross: num(f.gross_m2) };
  }
  if (defaultedH) A.push("ارتفاع الدور من البلاطة إلى البلاطة غير مكتوب في بعض الأدوار، فاعتُمد 3.40 م حتى يُستكمل.");
  if (defaultedT) A.push("سمك البلاطة غير مكتوب في بعض الأدوار، فاعتُمد 0.20 م حتى يُستكمل.");
  const FL = (id?: string) => fl[id ?? ""] ?? { h: 3.4, thk: 0.2, name: id ?? "", gross: null };
  const built = sum(floors.map((f) => num(f.gross_m2) ?? 0));

  // ===== الفراغات =====
  type R = { floor: string; name: string; use: string; area: number; per: number; h: number; ff: string; ceil: string; tile: number | null };
  const rooms: R[] = [];
  let missingDims = 0;
  for (const x of T.rooms ?? []) {
    const L = num(x.L), W = num(x.W);
    const area = num(x.area_m2) ?? (L != null && W != null ? L * W : null);
    const per = num(x.perimeter_m) ?? (L != null && W != null ? 2 * (L + W) : null);
    if (area == null || per == null) { missingDims++; continue; }
    const F = FL(x.floor);
    rooms.push({ floor: x.floor, name: x.name ?? "", use: x.use ?? "other", area, per, h: num(x.h_m) ?? Math.max(F.h - F.thk, 2.4), ff: x.floor_finish ?? "porcelain", ceil: x.ceiling ?? "paint", tile: num(x.wall_tile_h_m) });
  }
  if (missingDims) Q.push(`${missingDims} من الفراغات بلا أبعاد كافية لحسابها، فلم تدخل في كميات التشطيب.`);
  const indoor = rooms.filter((r) => r.use !== "outdoor_covered");

  // ===== الفتحات =====
  const op = T.openings ?? [];
  const opA = (k: (o: any) => boolean) => sum(op.filter(k).map((o) => (num(o.w) ?? 0) * (num(o.h) ?? 0) * (num(o.count) ?? 1)));
  const opBig = (o: any) => (num(o.w) ?? 0) * (num(o.h) ?? 0) > 0.5;
  const extOpen = opA((o) => o.in !== "int" && opBig(o));
  const intOpen = opA((o) => o.in === "int" && opBig(o));
  const doorsInt = sum(op.filter((o) => o.kind === "door_int").map((o) => num(o.count) ?? 1));

  // ===== الأعمال الإنشائية =====
  const S = T.structure;
  let concreteTotal = 0, skeletonByIndicator = false;
  if (S) {
    const ft = S.footings ?? [];
    const v02 = sum(ft.map((x) => x.count * x.L * x.W * x.D));
    if (ft.length) {
      add("03-01", sum(ft.map((x) => x.count * (x.L + 0.2) * (x.W + 0.2) * 0.1)), "مجموع (العدد × (الطول+0.2) × (العرض+0.2) × 0.10) لكل قاعدة: نظافة بسمك 10 سم وبروز 10 سم من كل جانب");
      A.push("خرسانة النظافة محسوبة بسمك 10 سم وبروز 10 سم حول كل قاعدة، ما لم تحدد المخططات غير ذلك.");
      add("03-02", v02, ft.map((x) => `${x.count}×${x.L}×${x.W}×${x.D}`).join(" + "));
    }
    const nk = S.necks ?? [], ti = S.ties ?? [];
    const v03 = sum(nk.map((x) => x.count * x.w * x.d * x.h)) + sum(ti.map((x) => x.length_m * x.w * x.d));
    if (nk.length || ti.length) add("03-03", v03, [...nk.map((x) => `رقاب ${x.count}×${x.w}×${x.d}×${x.h}`), ...ti.map((x) => `ميد ${x.length_m}×${x.w}×${x.d}`)].join(" + "));
    const sg = S.slab_on_grade;
    if (sg && num(sg.area_m2) && num(sg.thk_m)) add("03-04", sg.area_m2 * sg.thk_m, `${sg.area_m2} م² × ${sg.thk_m} م`);
    const co = S.columns ?? [];
    const v05 = sum(co.map((x) => x.count * x.w * x.d * x.h));
    if (co.length) add("03-05", v05, co.map((x) => `${x.count}×${x.w}×${x.d}×${x.h}`).join(" + "));
    const sl = S.slabs ?? [], bm = S.beams ?? [];
    const hordi = sl.some((x) => x.type === "hordi");
    const vs = sum(sl.map((x) => x.area_m2 * x.thk_m));
    const vb = sum(bm.map((x) => { const t = FL(x.floor).thk; return x.length_m * x.w * Math.max(x.d - t, 0); }));
    if (sl.length || bm.length) add("03-06", vs + vb, `البلاطات: ${sl.map((x) => `${x.area_m2}×${x.thk_m}`).join(" + ") || "0"}؛ والكمرات تحت البلاطة: ${bm.map((x) => `${x.length_m}×${x.w}×(${x.d}−سمك البلاطة)`).join(" + ") || "0"}`);
    if (hordi) Q.push("بعض البلاطات هوردي: حجمها محسوب مصمتاً، ويلزم جدول البلوك لخصم حجمه وتسعيره في بند مستقل.");
    if (num(S.stairs_m3)) add("03-07", S.stairs_m3!, "من المخططات الإنشائية");
    concreteTotal = sum(lines.filter((l) => /^03-0[1-7]$/.test(l.code)).map((l) => l.qty ?? 0));
    if (num(S.excavation_m3)) add("02-01", S.excavation_m3!, "من المخططات الإنشائية");
    else if (ft.length) Q.push("كمية الحفر تحتاج منسوب التأسيس من المخطط الإنشائي.");
    if (num(S.backfill_m3)) add("02-02", S.backfill_m3!, "من المخططات الإنشائية");
    // الحديد معلوماتي: أسعار الخرسانة المسلحة في المكتبة شاملة الحديد والشدات
    if (num(S.rebar_t)) add("03-08", S.rebar_t!, "من جداول التسليح، للعلم فقط: سعره داخل في أسعار الخرسانة المسلحة", false, true);
    A.push("أسعار بنود الخرسانة المسلحة (03-02 إلى 03-07) شاملة الحديد والشدات كما في تحليل أسعار المكتبة، فلا يُضاف الحديد والشدات بندين مستقلين حتى لا تُحسب مرتين.");
  } else if (built > 0) {
    skeletonByIndicator = true;
    add("13-01", built, `إجمالي المسطحات المبنية ${f2(built)} م²: العظم بمؤشر التكلفة لعدم رفع المخططات الإنشائية`, true);
    A.push("لم تُرفع المخططات الإنشائية، فقُدّر العظم كاملاً بمؤشر تكلفة المتر المربع في المكتبة، ويُفصَّل بنوداً حين تُرفع.");
  }
  const g = floors[0]; const ground = g ? num(g.gross_m2) : null;
  if (ground) { add("02-03", ground, `مسقط الدور الأرضي ${f2(ground)} م²`); add("02-04", ground, `مسقط الدور الأرضي ${f2(ground)} م²`); }

  // ===== المباني =====
  const W = T.walls ?? [];
  const wa = (k: string) => sum(W.filter((w) => w.kind === k).map((w) => w.length_m * (num(w.height_m) ?? (FL(w.floor).h - FL(w.floor).thk))));
  const ext = wa("ext20"), i15 = wa("int15"), i10 = wa("int10"), below = wa("below20");
  if (ext) add("04-01", ext - extOpen, `أطوال الجدران الخارجية × ارتفاعها = ${f2(ext)} م²، ناقص الفتحات الخارجية ${f2(extOpen)} م²`);
  const intT = i15 + i10;
  if (i15) add("04-02", i15 - (intT ? intOpen * i15 / intT : 0), `${f2(i15)} م² ناقص حصتها من الفتحات الداخلية`);
  if (i10) add("04-03", i10 - (intT ? intOpen * i10 / intT : 0), `${f2(i10)} م² ناقص حصتها من الفتحات الداخلية`);
  if (below) add("04-04", below, `${f2(below)} م²`);
  if (!W.length) Q.push("أطوال الجدران لم تُقرأ من المساقط، فبنود البلك واللياسة الخارجية بلا كمية.");

  // ===== العزل والسطح =====
  const roof = num(T.roof?.area_m2) ?? (floors.length ? num(floors[floors.length - 1].gross_m2) : null);
  if (roof) {
    const why = num(T.roof?.area_m2) ? `مسقط السطح ${f2(roof)} م²` : `مسقط آخر دور ${f2(roof)} م² (لم يُقرأ مسقط السطح)`;
    add("05-02", roof, why); add("05-03", roof, why); add("05-05", roof, why);
  }
  const wet = indoor.filter((r) => WET.includes(r.use));
  if (wet.length) {
    const wf = sum(wet.map((r) => r.area)), wp = sum(wet.map((r) => r.per));
    add("05-04", wf + wp * 0.3, `أرضيات المناطق الرطبة ${f2(wf)} م² + رفرف 0.30 م على محيطها ${f2(wp)} م`);
    A.push("عزل المناطق الرطبة محسوب على الأرضية مع رفرف 30 سم على الجدران؛ ومنطقة الدش تحتاج عزلاً أعلى يُضاف حسب التفصيلة.");
  }

  // ===== اللياسة والدهان =====
  const wallsIn = sum(indoor.map((r) => r.per * r.h));
  const openFaces = opA((o) => o.in === "int" && opBig(o)) * 2 + opA((o) => o.in !== "int" && opBig(o));
  const ceilPlain = sum(indoor.filter((r) => r.ceil !== "gypsum").map((r) => r.area));
  const ceilGyp = sum(indoor.filter((r) => r.ceil === "gypsum").map((r) => r.area));
  if (indoor.length) {
    add("06-01", wallsIn - openFaces + ceilPlain, `جدران الفراغات (المحيط × الارتفاع) ${f2(wallsIn)} م² ناقص الفتحات بوجهيها ${f2(openFaces)} م² + أسقف غير مستعارة ${f2(ceilPlain)} م²`);
    A.push("اللياسة الداخلية تشمل الجدران المكسوة بالبلاط، لأن البلاط يُركّب عليها.");
    const tiled = sum(wet.map((r) => r.per * (r.tile ?? r.h)));
    add("06-05", wallsIn - openFaces - tiled + ceilPlain + ceilGyp, `جدران ${f2(wallsIn)} − فتحات ${f2(openFaces)} − جدران مكسوة بالبلاط ${f2(tiled)} + أسقف ${f2(ceilPlain + ceilGyp)} م²`);
    if (ceilGyp) add("06-03", ceilGyp, `مساحات الفراغات ذات السقف المستعار ${f2(ceilGyp)} م²`);
    if (wet.length) { add("07-02", tiled, wet.map((r) => `${r.name || r.use}: ${f2(r.per)}×${f2(r.tile ?? r.h)}`).join(" + ")); A.push("تكسية جدران المناطق الرطبة محسوبة على محيطها كاملاً دون خصم أبوابها، وهو فرق صغير يغطي الهدر."); }
    if (wet.some((r) => r.tile == null)) A.push("ارتفاع تكسية جدران الحمامات وغرف الغسيل غير مكتوب، فحُسب حتى السقف.");
  }
  const kitchens = indoor.filter((r) => r.use === "kitchen");
  if (kitchens.length && kitchens.some((r) => r.tile == null)) Q.push("تكسية جدران المطبخ وارتفاعها غير موضحة، فلم تدخل في بند السيراميك.");

  // ===== الأرضيات =====
  const byF = (k: string[]) => indoor.filter((r) => k.includes(r.ff));
  const por = byF(["porcelain", "ceramic"]), mar = byF(["marble"]);
  if (por.length) add("07-01", sum(por.map((r) => r.area)), `مجموع مساحات ${por.length} فراغاً أرضيتها بورسلان أو سيراميك`);
  if (mar.length) add("07-03", sum(mar.map((r) => r.area)), `مجموع مساحات ${mar.length} فراغاً أرضيتها رخام`);
  const other = indoor.filter((r) => !["porcelain", "ceramic", "marble", "none"].includes(r.ff));
  if (other.length) Q.push(`أرضيات ${other.length} فراغاً من مادة ليس لها بند في المكتبة (${[...new Set(other.map((r) => r.ff))].join("، ")})، فتُسعّر بعرض.`);
  const dry = indoor.filter((r) => !WET.includes(r.use) && r.use !== "kitchen" && r.ff !== "none");
  if (dry.length) {
    const sk = sum(dry.map((r) => r.per)) - sum(op.filter((o) => o.kind === "door_int").map((o) => (num(o.w) ?? 0) * (num(o.count) ?? 1))) * 2 - sum(op.filter((o) => o.kind === "door_main" || o.kind === "door_ext").map((o) => (num(o.w) ?? 0) * (num(o.count) ?? 1)));
    add("07-05", Math.max(sk, 0), `محيط الفراغات الجافة ${f2(sum(dry.map((r) => r.per)))} م ناقص عروض الأبواب (الداخلية بجانبيها)`);
  }
  const st = T.stairs ?? [];
  const stm = sum(st.map((s) => (num(s.steps) ?? 0) * (num(s.width_m) ?? 0)));
  if (stm) add("07-04", stm, st.map((s) => `${s.steps} درجة × ${s.width_m} م`).join(" + "));

  // ===== الواجهات =====
  if (ext) {
    const par = (num(T.roof?.parapet_m) ?? 0) * (num(T.roof?.parapet_h_m) ?? 0);
    const extFace = ext - extOpen + par;
    add("06-02", extFace, `الوجه الخارجي للجدران الخارجية ${f2(ext - extOpen)} م²${par ? ` + الدروة ${f2(par)} م²` : ""}`);
    if (num(T.roof?.parapet_m) && !num(T.roof?.parapet_h_m)) Q.push("ارتفاع دروة السطح غير مكتوب، فلم تدخل في اللياسة والدهان الخارجي.");
    const stone = num(T.facade?.stone_m2);
    if (stone) add("06-07", stone, "من الواجهات");
    add("06-06", extFace - (stone ?? 0), `اللياسة الخارجية ${f2(extFace)} م²${stone ? ` ناقص الحجر ${f2(stone)} م²` : ""}`);
    if (stone == null) Q.push("مساحة تكسية الحجر في الواجهات لم تُقرأ، فحُسب الدهان الخارجي على كامل الواجهات.");
  }

  // ===== الأبواب والنوافذ =====
  const cnt = (k: string) => sum(op.filter((o) => o.kind === k).map((o) => num(o.count) ?? 1));
  if (doorsInt) add("08-01", doorsInt, `من جدول الأبواب أو المساقط: ${doorsInt} باباً`);
  const dm = cnt("door_main") + cnt("door_ext");
  if (dm) add("08-02", dm, `باب المدخل والأبواب الخارجية: ${dm}`);
  const winA = opA((o) => o.kind === "window"), sldA = opA((o) => o.kind === "sliding");
  if (winA) add("08-03", winA, op.filter((o) => o.kind === "window").map((o) => `${o.count ?? 1}×${o.w}×${o.h}`).join(" + "));
  if (sldA) add("08-04", sldA, op.filter((o) => o.kind === "sliding").map((o) => `${o.count ?? 1}×${o.w}×${o.h}`).join(" + "));
  if (num(T.railings_m)) add("08-05", T.railings_m!, "أطوال الدرابزين من المساقط");
  if (num(T.plot?.gates_car)) add("08-06", T.plot!.gates_car!, "من الموقع العام");

  // ===== الكهرباء والسباكة والتكييف =====
  const M = T.mep ?? {};
  const fromPoints = (pat: RegExp, grp = "electrical") => {
    if (!points) return null; const by: Record<string, any> = {}; for (const r of points.rooms) by[r.id] = r;
    let n = 0; for (const r of indoor) { const pr = by[USE2POINTS[r.use] ?? ""]; if (!pr) continue; for (const it of pr[grp] ?? []) if (pat.test(it.id)) n += it.qty || 0; }
    return n;
  };
  const mepLine = (code: string, key: string, pat: RegExp | null, grp = "electrical", label = "") => {
    const v = num(M[key]);
    if (v != null) { add(code, v, "من مخططات الكهرباء والسباكة"); return; }
    if (!pat) return; const e = fromPoints(pat, grp); if (e) add(code, e, `تقدير من دليل النقاط في الموقع لكل فراغ${label}`, true);
  };
  mepLine("10-01", "light", /-light$/);
  mepLine("10-02", "socket", /-(sock|ded|shaver|cooker|heater)$/);
  mepLine("10-03", "ac_points", /-ac$/);
  mepLine("10-07", "lowcurrent", /./, "lowcurrent");
  add("10-04", num(M.panels) ?? (floors.length + 1), num(M.panels) != null ? "من المخططات" : `لوحة رئيسية + لوحة لكل دور (${floors.length})`, num(M.panels) == null);
  add("10-05", 1, "مقطوعية");
  const baths = indoor.filter((r) => r.use === "bath").length, wcs = indoor.filter((r) => r.use === "wc").length, kit = kitchens.length, lau = indoor.filter((r) => r.use === "laundry").length;
  const fx = (key: string, code: string, est: number, why: string) => { const v = num(M[key]); add(code, v ?? est, v != null ? "من مخطط السباكة" : why, v == null); };
  if (baths + wcs + kit + lau) {
    fx("water_points", "09-01", baths * 6 + wcs * 4 + kit * 3 + lau * 2, `تقدير: ${baths} حمام × 6 + ${wcs} مرحاض ضيوف × 4 + ${kit} مطبخ × 3 + ${lau} غسيل × 2`);
    fx("drain_points", "09-02", baths * 4 + wcs * 3 + kit * 2 + lau * 2, `تقدير: ${baths} حمام × 4 + ${wcs} مرحاض ضيوف × 3 + ${kit} مطبخ × 2 + ${lau} غسيل × 2`);
    fx("wc", "09-08", baths + wcs, "طقم لكل حمام ومرحاض ضيوف");
    fx("basin", "09-09", baths + wcs, "مغسلة لكل حمام ومرحاض ضيوف");
    fx("sink", "09-10", kit, "مجلى لكل مطبخ");
    fx("heaters", "09-07", baths + kit, "سخان لكل حمام ومطبخ");
    A.push("نقاط المياه والصرف المقدّرة: الحمام 6 تغذية و4 صرف، ومرحاض الضيوف 4 و3، والمطبخ 3 و2، والغسيل 2 و2؛ تُستبدل بالعدد الفعلي من مخطط السباكة.");
  }
  fx("manholes", "09-03", Math.max(2, Math.ceil((baths + wcs + kit) / 3)), "تقدير: غرفة لكل ثلاث نقاط تجميع رئيسية، وغرفتان على الأقل");
  add("09-05", num(M.ground_tank) ?? 1, "خزان أرضي واحد", num(M.ground_tank) == null);
  add("09-06", num(M.roof_tank) ?? 1, "خزان علوي واحد", num(M.roof_tank) == null);
  add("09-11", num(M.pump) ?? 1, "مضخة واحدة", num(M.pump) == null);
  const ac = num(M.split_units) ?? (lines.find((l) => l.code === "10-03")?.qty ?? null);
  if (ac) { add("11-01", ac, num(M.split_units) != null ? "من مخطط التكييف" : "وحدة لكل نقطة تكييف", num(M.split_units) == null); add("11-03", ac * 6, `${ac} وحدة × 6 م مواسير`, true); A.push("مواسير التكييف مقدرة بـ6 أمتار لكل وحدة حتى يُرفع مخطط التكييف."); }
  if (num(M.ducted_units)) add("11-02", M.ducted_units!, "من مخطط التكييف");
  const fans = baths + wcs + kit + lau;
  if (fans) add("11-04", num(M.exhaust_fans) ?? fans, num(M.exhaust_fans) != null ? "من المخططات" : "مروحة لكل حمام ومرحاض ومطبخ وغرفة غسيل", num(M.exhaust_fans) == null);

  // ===== الأعمال العامة والخارجية =====
  if (num(T.plot?.area_m2)) add("01-01", T.plot!.area_m2!, `مساحة الأرض ${f2(T.plot!.area_m2!)} م²`);
  add("01-02", 1, "مقطوعية"); add("01-03", 1, "مقطوعية");
  const fence = num(T.plot?.fence_m) ?? num(T.plot?.perimeter_m);
  if (fence) add("12-01", fence, num(T.plot?.fence_m) ? "طول السور من الموقع العام" : `محيط الأرض ${f2(fence)} م (البوابات غير مخصومة)`, !num(T.plot?.fence_m));
  if (num(T.plot?.yard_soft_m2)) add("12-02", T.plot!.yard_soft_m2!, "المسطحات الخضراء من الموقع العام");
  if (num(T.plot?.yard_hard_m2)) add("07-06", T.plot!.yard_hard_m2!, "الأرضيات الخارجية من الموقع العام");

  // مؤشر العظم في المكتبة يشمل البلك والحفر والعزل، فإن قُدّر العظم به صارت هذه البنود للعلم حتى لا تُحسب مرتين
  if (skeletonByIndicator) {
    const inSk = ["02-01", "02-02", "02-03", "02-04", "04-01", "04-02", "04-03", "04-04", "05-01", "05-02", "05-03"];
    for (const l of lines) if (inSk.includes(l.code)) { l.info = true; l.calc += "؛ للعلم: داخل في مؤشر العظم 13-01"; }
    A.push("مؤشر العظم في المكتبة يشمل البلك والحفر والعزل وجزءاً من تمديدات الكهرباء والسباكة داخل الجدران؛ فبنود البلك والعزل معروضة بكمياتها للعلم دون مبلغ، ونقاط الكهرباء والسباكة مسعّرة كاملة وقد يتداخل جزء منها مع المؤشر.");
  }
  return { lines, assumptions: A, questions: Q, built, concreteTotal, skeletonByIndicator, rooms, ext, intT: i15 + i10 };
}

// فحوص المعقولية: تُقارن نسب المشروع بمؤشرات مكتبة البنود نفسها، وما خرج عنها يُعلَّم ولا يُخفى
export function checks(C: ReturnType<typeof compute>, T: Takeoff, totals: { skeleton: number; finish: number; total?: number }, lib: { byCode: Record<string, LibItem> }): Check[] {
  const out: Check[] = [];
  const B = C.built;
  if (!B) { out.push({ name: "المسطحات المبنية", value: "لم تُقرأ", expected: "مساحة كل دور", ok: false, note: "بدونها لا تُفحص النسب." }); return out; }
  if (C.concreteTotal) { const v = C.concreteTotal / B; out.push({ name: "الخرسانة لكل متر مربع مبني", value: v.toFixed(2) + " م³/م²", expected: "0.34 إلى 0.70 (الفيلا النموذجية في المكتبة 0.52)", ok: v >= 0.34 && v <= 0.70 }); }
  const blk = C.ext + C.intT; if (blk) { const v = blk / B; out.push({ name: "البلك لكل متر مربع مبني", value: v.toFixed(2) + " م²/م²", expected: "1.2 إلى 2.5 (الفيلا النموذجية في المكتبة 1.9)", ok: v >= 1.2 && v <= 2.5 }); }
  for (const f of T.floors ?? []) {
    const g = f.gross_m2; if (!g) continue; const rs = C.rooms.filter((r) => r.floor === f.id && r.use !== "outdoor_covered"); if (!rs.length) continue;
    const v = rs.reduce((s, r) => s + r.area, 0) / g;
    out.push({ name: `مجموع مساحات فراغات ${f.name ?? f.id} إلى مسطحه`, value: Math.round(v * 100) + "٪", expected: "75٪ إلى 95٪", ok: v >= 0.75 && v <= 0.95, note: v < 0.75 ? "فراغات لم تُقرأ على الأرجح." : v > 0.95 ? "مساحات مكررة أو مسطح الدور أقل من الحقيقي." : undefined });
  }
  const sk = lib.byCode["13-01"]?.p, fn = lib.byCode["13-02"]?.p;
  if (totals.skeleton && sk && !C.skeletonByIndicator) { const v = totals.skeleton / B; out.push({ name: "تكلفة العظم للمتر المربع", value: Math.round(v) + " ريال", expected: `${sk.low} إلى ${sk.high} ريال (مؤشر 13-01)`, ok: v >= (sk.low ?? 0) * 0.85 && v <= (sk.high ?? 1e9) * 1.15 }); }
  if (totals.finish && fn) { const v = totals.finish / B; out.push({ name: "تكلفة التشطيب المسعّر للمتر المربع", value: Math.round(v) + " ريال", expected: `${fn.low} إلى ${fn.high} ريال (مؤشر 13-02)، والبنود التي بعرض غير داخلة`, ok: v >= (fn.low ?? 0) * 0.5 && v <= (fn.high ?? 1e9) }); }
  const all = lib.byCode["13-03"]?.p;
  if (totals.total && all) { const v = totals.total / B; out.push({ name: "إجمالي المسعّر للمتر المربع", value: Math.round(v) + " ريال", expected: `${all.low} إلى ${all.high} ريال تسليم مفتاح (مؤشر 13-03)، والبنود التي بعرض غير داخلة`, ok: v >= (all.low ?? 0) * 0.6 && v <= (all.high ?? 1e9) }); }
  return out;
}

// التسعير والتجميع: السعر النموذجي من المكتبة، والمبلغ = الكمية × السعر؛ والمعلوماتي وما لا سعر له بلا مبلغ
export function assemble(C: ReturnType<typeof compute>, lib: LibItem[]) {
  const byCode: Record<string, LibItem> = {}; lib.forEach((i) => (byCode[i.c] = i));
  const secs: Record<string, { div: string; name: string; items: any[]; total: number }> = {};
  let skeleton = 0, finish = 0, total = 0;
  for (const l of C.lines.sort((a, b) => a.code.localeCompare(b.code))) {
    const it = byCode[l.code]; if (!it) continue;
    const dv = l.code.slice(0, 2);
    const rate = l.info ? null : it.p.typ;
    const amount = l.qty != null && rate != null ? Math.round(l.qty * rate) : null;
    const s = (secs[dv] ??= { div: dv, name: it.d, items: [], total: 0 });
    s.items.push({ code: it.c, name: it.n, unit: it.u, qty: l.qty, est: !!l.est, info: !!l.info, rate, low: it.p.low, high: it.p.high,
      amount, calc: l.calc, spec: (it.desc + " " + it.spec).trim(),
      note: l.info ? "للعلم: غير داخل في المجموع." : rate == null ? "يُسعّر بعرض لغياب مصدر منشور كافٍ." : it.p.basis === "توريد فقط" ? "السعر للتوريد فقط." : "" });
    if (amount != null) { s.total += amount; total += amount; if (["02", "03", "04", "13"].includes(dv) || l.code === "05-01") skeleton += amount; if (["05", "06", "07", "08"].includes(dv) && l.code !== "05-01") finish += amount; }
  }
  return { sections: Object.keys(secs).sort().map((k) => secs[k]), total, skeleton, finish, byCode };
}
