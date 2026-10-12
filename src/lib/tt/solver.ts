/**
 * Constraint solver + validation for ClashFree Timetable.
 *
 * Algorithm: pre-checks -> lecturer assignment (load balanced) -> backtracking
 * search over "demands" (one per theory hour / lab block). Candidates are
 * filtered by HARD constraints and ordered by a SOFT-constraint penalty score.
 * Several randomized restarts are tried; on failure the most frequently failing
 * demand is analysed to explain which constraint blocked it.
 */
import { slotKey, uid, type AppState, type Room, type Session, type Settings } from "./types";

export interface Diagnostic { constraint: string; message: string; fix: string }
export interface Clash { kind: string; message: string; ids: string[] }
export interface SolveResult {
  ok: boolean; sessions: Session[]; errors: Diagnostic[];
  stats: { steps: number; ms: number; attempts: number; penalty: number; placed: number };
}

/* ---------- helpers ---------- */
export function blockStarts(settings: Settings, len: number): number[] {
  const P = settings.periods, out: number[] = [];
  for (let p = 0; p < P.length; p++) {
    let ok = true;
    for (let k = 0; k < len; k++) if (!P[p + k] || P[p + k].isBreak) { ok = false; break; }
    if (ok) out.push(p);
  }
  return out;
}
export const teachingIndexes = (s: Settings) => s.periods.map((p, i) => (p.isBreak ? -1 : i)).filter((i) => i >= 0);
export const sessionPeriods = (s: { period: number; length: number }) => Array.from({ length: s.length }, (_, k) => s.period + k);
function maxRun(settings: Settings) {
  let best = 0, cur = 0;
  for (const p of settings.periods) { cur = p.isBreak ? 0 : cur + 1; best = Math.max(best, cur); }
  return best;
}

/* ---------- pre-checks ---------- */
export function precheck(state: AppState): Diagnostic[] {
  const e: Diagnostic[] = [];
  const { settings, rooms, lecturers, subjects, classes } = state;
  const teach = teachingIndexes(settings).length;
  const slots = teach * settings.days;
  if (!teach) e.push({ constraint: "Periods", message: "No teaching periods are configured.", fix: "Add periods in Setup → Schedule." });
  if (!rooms.length) e.push({ constraint: "Rooms", message: "No rooms or labs exist.", fix: "Add at least one classroom (and a lab room for lab subjects)." });
  if (!lecturers.length) e.push({ constraint: "Lecturers", message: "No lecturers exist.", fix: "Add lecturers and the subjects they can teach." });
  if (!classes.length) e.push({ constraint: "Classes", message: "No classes/sections exist.", fix: "Add a class and assign its subjects." });
  const subj = new Map(subjects.map((s) => [s.id, s]));
  for (const s of subjects) {
    if (s.type === "lab") {
      if (s.labBlock < 2 || s.labBlock > 3) e.push({ constraint: "Lab block size", message: `${s.code} lab block is ${s.labBlock}; labs must be 2-3 consecutive periods.`, fix: "Set the lab block to 2 or 3." });
      else if (s.weeklyHours % s.labBlock !== 0) e.push({ constraint: "Lab block size", message: `${s.code} needs ${s.weeklyHours} h/week, which can't be split into ${s.labBlock}-period blocks.`, fix: `Change weekly hours to a multiple of ${s.labBlock}, or change the block size.` });
      else if (s.labBlock > maxRun(settings)) e.push({ constraint: "Consecutive lab periods", message: `${s.code} needs ${s.labBlock} consecutive periods but the longest run between breaks is ${maxRun(settings)}.`, fix: "Rearrange breaks or reduce the lab block size." });
    }
  }
  for (const c of classes) {
    const list = c.subjectIds.map((id) => subj.get(id)).filter(Boolean) as typeof subjects;
    const hrs = list.reduce((a, s) => a + s.weeklyHours, 0);
    if (hrs > slots) e.push({ constraint: "Class capacity", message: `${c.name} needs ${hrs} periods/week but only ${slots} teaching slots exist.`, fix: "Add periods/days or remove subjects from the class." });
    if (list.some((s) => s.type === "theory") && !rooms.some((r) => r.type === "classroom" && r.capacity >= c.size))
      e.push({ constraint: "Room capacity", message: `No classroom fits ${c.name} (${c.size} students).`, fix: "Add a larger classroom or reduce the section size." });
    if (list.some((s) => s.type === "lab") && !rooms.some((r) => r.type === "lab" && r.capacity >= c.size))
      e.push({ constraint: "Lab room", message: `No lab room fits ${c.name} (${c.size} students).`, fix: "Add a lab room with enough capacity, or split the section." });
  }
  return e;
}

/** Choose one lecturer per (class, subject), balancing load and honouring weekly limits. */
export function assignLecturers(state: AppState, locked: Session[]) {
  const map: Record<string, string> = {}, load: Record<string, number> = {}, errors: Diagnostic[] = [];
  const subj = new Map(state.subjects.map((s) => [s.id, s]));
  for (const s of locked) {
    const k = `${s.classId}|${s.subjectId}`;
    map[k] ??= s.lecturerId;
    load[s.lecturerId] = (load[s.lecturerId] ?? 0) + s.length;
  }
  const pairs: { c: string; cname: string; s: string }[] = [];
  for (const c of state.classes) for (const s of c.subjectIds) if (subj.has(s)) pairs.push({ c: c.id, cname: c.name, s });
  const qual = (sid: string) => state.lecturers.filter((l) => l.subjectIds.includes(sid));
  pairs.sort((a, b) => qual(a.s).length - qual(b.s).length);
  for (const { c, cname, s } of pairs) {
    const sb = subj.get(s)!, k = `${c}|${s}`;
    const lockedHrs = locked.filter((x) => x.classId === c && x.subjectId === s).reduce((a, x) => a + x.length, 0);
    const rem = sb.weeklyHours - lockedHrs;
    if (map[k]) { load[map[k]] = (load[map[k]] ?? 0) + rem; continue; }
    const q = qual(s);
    if (!q.length) { errors.push({ constraint: "Qualified lecturer", message: `No lecturer can teach ${sb.name} (${sb.code}) for ${cname}.`, fix: `Add ${sb.code} to a lecturer's subjects, or add a new lecturer.` }); continue; }
    const fit = q.filter((l) => (load[l.id] ?? 0) + rem <= l.maxPerWeek)
      .sort((a, b) => (load[a.id] ?? 0) / a.maxPerWeek - (load[b.id] ?? 0) / b.maxPerWeek);
    if (!fit.length) { errors.push({ constraint: "Lecturer weekly limit", message: `All lecturers qualified for ${sb.code} (${q.map((l) => l.name).join(", ")}) would exceed their max hours/week when adding ${cname}.`, fix: "Raise a lecturer's max hours/week or qualify another lecturer for this subject." }); continue; }
    map[k] = fit[0].id; load[fit[0].id] = (load[fit[0].id] ?? 0) + rem;
  }
  return { map, load, errors };
}

/* ---------- soft score ---------- */
export function softPenalty(state: AppState, sessions: Session[]) {
  const teach = teachingIndexes(state.settings), last = teach[teach.length - 1];
  const ord = (p: number) => teach.indexOf(p);
  const subj = new Map(state.subjects.map((s) => [s.id, s]));
  const d = { sameDay: 0, gaps: 0, afternoonHeavy: 0, labLast: 0, longRuns: 0 };
  const csd = new Map<string, number>();
  for (const s of sessions) {
    const k = `${s.classId}|${s.subjectId}|${s.day}`; csd.set(k, (csd.get(k) ?? 0) + 1);
    const sb = subj.get(s.subjectId);
    if (sb?.heavy && ord(s.period) >= Math.ceil(teach.length / 2)) d.afternoonHeavy++;
    if (sb?.type === "lab" && s.period + s.length - 1 === last) d.labLast++;
  }
  csd.forEach((n) => { if (n > 1) d.sameDay += n - 1; });
  const byKey = (key: (s: Session) => string) => {
    const m = new Map<string, number[]>();
    for (const s of sessions) for (const p of sessionPeriods(s)) { const k = `${key(s)}|${s.day}`; m.set(k, [...(m.get(k) ?? []), ord(p)]); }
    return m;
  };
  byKey((s) => s.classId).forEach((o) => { o.sort((a, b) => a - b); d.gaps += o[o.length - 1] - o[0] + 1 - o.length; });
  byKey((s) => s.lecturerId).forEach((o) => {
    o.sort((a, b) => a - b); let run = 1;
    for (let i = 1; i < o.length; i++) { run = o[i] === o[i - 1] + 1 ? run + 1 : 1; if (run > 3) d.longRuns++; }
  });
  return { total: d.sameDay * 10 + d.gaps * 3 + d.afternoonHeavy * 2 + d.labLast * 5 + d.longRuns * 4, ...d };
}

/* ---------- main solver ---------- */
interface Demand { classId: string; subjectId: string; lecturerId: string; len: number; heavy: boolean; isLab: boolean; rooms: Room[]; label: string }
type Tally = { total: number; classBusy: number; lecturerBusy: number; lecturerUnavailable: number; lecturerDailyLimit: number; noRoom: number };

export function solve(state: AppState, opts: { attempts?: number; stepLimit?: number } = {}): SolveResult {
  const t0 = Date.now();
  const attempts = opts.attempts ?? 12, stepLimit = opts.stepLimit ?? 30000;
  const empty = (errors: Diagnostic[]): SolveResult => ({ ok: false, sessions: state.sessions, errors, stats: { steps: 0, ms: Date.now() - t0, attempts: 0, penalty: 0, placed: 0 } });
  const pre = precheck(state);
  if (pre.length) return empty(pre);

  const { settings } = state;
  const ids = (a: { id: string }[]) => new Set(a.map((x) => x.id));
  const [cIds, sIds, lIds, rIds] = [ids(state.classes), ids(state.subjects), ids(state.lecturers), ids(state.rooms)];
  const locked = state.sessions.filter((s) => s.locked && cIds.has(s.classId) && sIds.has(s.subjectId) && lIds.has(s.lecturerId) && rIds.has(s.roomId));
  const lockedClashes = findClashes(state, locked);
  if (lockedClashes.length) return empty([{ constraint: "Locked sessions", message: `Locked sessions conflict: ${lockedClashes[0].message}`, fix: "Unlock or move one of the conflicting locked sessions." }]);

  const asg = assignLecturers(state, locked);
  if (asg.errors.length) return empty(asg.errors);

  const subj = new Map(state.subjects.map((s) => [s.id, s]));
  const lect = new Map(state.lecturers.map((l) => [l.id, { ...l, un: new Set(l.unavailable) }]));
  const demands: Demand[] = [], errors: Diagnostic[] = [];
  for (const c of state.classes) for (const sid of c.subjectIds) {
    const sb = subj.get(sid); if (!sb) continue;
    const rem = sb.weeklyHours - locked.filter((x) => x.classId === c.id && x.subjectId === sid).reduce((a, x) => a + x.length, 0);
    if (rem < 0) { errors.push({ constraint: "Weekly hours", message: `Locked sessions give ${sb.code} more than ${sb.weeklyHours} h for ${c.name}.`, fix: "Unlock some sessions of this subject." }); continue; }
    const len = sb.type === "lab" ? sb.labBlock : 1;
    if (rem % len) { errors.push({ constraint: "Lab block size", message: `Remaining ${rem} h of ${sb.code} for ${c.name} can't form ${len}-period blocks.`, fix: "Unlock the partial lab sessions." }); continue; }
    const rooms = state.rooms.filter((r) => r.type === (sb.type === "lab" ? "lab" : "classroom") && r.capacity >= c.size).sort((a, b) => a.capacity - b.capacity);
    for (let i = 0; i < rem / len; i++)
      demands.push({ classId: c.id, subjectId: sid, lecturerId: asg.map[`${c.id}|${sid}`], len, heavy: sb.heavy, isLab: sb.type === "lab", rooms, label: `${sb.name} (${sb.code}) for ${c.name}` });
  }
  if (errors.length) return empty(errors);

  const teach = teachingIndexes(settings), ord = (p: number) => teach.indexOf(p), lastP = teach[teach.length - 1];
  const starts = new Map<number, number[]>([1, 2, 3].map((n) => [n, blockStarts(settings, n)]));
  let totalSteps = 0, lastFail: { idx: number; tally: Tally } | null = null;
  const failCount = new Array(demands.length).fill(0);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const rnd = attempt === 0 ? () => 0 : Math.random;
    const cls = new Set<string>(), lec = new Set<string>(), room = new Set<string>();
    const cnt = new Map<string, number>();
    const inc = (k: string, n: number) => cnt.set(k, (cnt.get(k) ?? 0) + n);
    const placed: Session[] = [];
    const apply = (s: Session, sign: 1 | -1) => {
      for (const p of sessionPeriods(s)) {
        const op = sign > 0 ? "add" : "delete";
        cls[op](`${s.classId}|${s.day}|${p}`); lec[op](`${s.lecturerId}|${s.day}|${p}`); room[op](`${s.roomId}|${s.day}|${p}`);
      }
      inc(`L|${s.lecturerId}|${s.day}`, sign * s.length); inc(`C|${s.classId}|${s.day}`, sign * s.length); inc(`S|${s.classId}|${s.subjectId}|${s.day}`, sign);
    };
    locked.forEach((s) => apply(s, 1));
    const lecLoad = (id: string) => asg.load[id] ?? 0;
    const order = demands.map((d, i) => ({ d, i, pr: d.len * 100 + lecLoad(d.lecturerId) * 2 - d.rooms.length + rnd() * 8 * attempt }))
      .sort((a, b) => b.pr - a.pr);
    let steps = 0;

    const candidates = (d: Demand) => {
      const L = lect.get(d.lecturerId)!;
      const t: Tally = { total: 0, classBusy: 0, lecturerBusy: 0, lecturerUnavailable: 0, lecturerDailyLimit: 0, noRoom: 0 };
      const out: { day: number; start: number; roomId: string; score: number }[] = [];
      for (let day = 0; day < settings.days; day++) {
        const st = starts.get(d.len)!;
        if ((cnt.get(`L|${d.lecturerId}|${day}`) ?? 0) + d.len > L.maxPerDay) { t.total += st.length; t.lecturerDailyLimit += st.length; continue; }
        const sameDay = cnt.get(`S|${d.classId}|${d.subjectId}|${day}`) ?? 0;
        const dayLoad = cnt.get(`C|${d.classId}|${day}`) ?? 0;
        for (const start of st) {
          t.total++;
          const ps = Array.from({ length: d.len }, (_, k) => start + k);
          if (ps.some((p) => cls.has(`${d.classId}|${day}|${p}`))) { t.classBusy++; continue; }
          if (ps.some((p) => L.un.has(slotKey(day, p)))) { t.lecturerUnavailable++; continue; }
          if (ps.some((p) => lec.has(`${d.lecturerId}|${day}|${p}`))) { t.lecturerBusy++; continue; }
          const r = d.rooms.find((r) => ps.every((p) => !room.has(`${r.id}|${day}|${p}`)));
          if (!r) { t.noRoom++; continue; }
          // ---- soft penalties ----
          let score = sameDay * 12 + dayLoad * 1.5;
          const o0 = ord(start), o1 = ord(start + d.len - 1);
          if (d.heavy && o0 >= Math.ceil(teach.length / 2)) score += 4;
          if (d.isLab && start + d.len - 1 === lastP) score += 6;
          // gap avoidance: stay adjacent to the class's existing periods, else prefer early
          const own = teach.filter((p) => cls.has(`${d.classId}|${day}|${p}`)).map(ord);
          if (own.length) {
            const dist = Math.min(...own.map((o) => (o < o0 ? o0 - o : o - o1)));
            score += (dist - 1) * 2.5;
          } else score += o0 * 0.6;
          // lecturer consecutive-run limit (soft: > 3)
          let run = d.len;
          for (let o = o0 - 1; o >= 0 && lec.has(`${d.lecturerId}|${day}|${teach[o]}`); o--) run++;
          for (let o = o1 + 1; o < teach.length && lec.has(`${d.lecturerId}|${day}|${teach[o]}`); o++) run++;
          if (run > 3) score += (run - 3) * 4;
          score += rnd() * 3;
          out.push({ day, start, roomId: r.id, score });
        }
      }
      out.sort((a, b) => a.score - b.score);
      return { out, t };
    };

    const ABORT = {};
    const place = (k: number): boolean => {
      if (k === order.length) return true;
      if (++steps > stepLimit) throw ABORT;
      const { d, i } = order[k];
      const { out, t } = candidates(d);
      if (!out.length) { failCount[i]++; if (!lastFail || failCount[i] >= failCount[lastFail.idx]) lastFail = { idx: i, tally: t }; return false; }
      for (const c of out.slice(0, 8)) {
        const s: Session = { id: uid(), classId: d.classId, subjectId: d.subjectId, lecturerId: d.lecturerId, roomId: c.roomId, day: c.day, period: c.start, length: d.len, locked: false };
        apply(s, 1); placed.push(s);
        if (place(k + 1)) return true;
        apply(s, -1); placed.pop();
      }
      failCount[i]++;
      return false;
    };
    let ok = false;
    try { ok = place(0); } catch (x) { if (x !== ABORT) throw x; }
    totalSteps += steps;
    if (ok) {
      const sessions = [...locked, ...placed];
      return { ok: true, sessions, errors: [], stats: { steps: totalSteps, ms: Date.now() - t0, attempts: attempt + 1, penalty: softPenalty(state, sessions).total, placed: placed.length } };
    }
  }
  return { ...empty([explainFailure(demands, lastFail, failCount, state)]), stats: { steps: totalSteps, ms: Date.now() - t0, attempts, penalty: 0, placed: 0 } };
}

function explainFailure(demands: Demand[], lastFail: { idx: number; tally: Tally } | null, failCount: number[], state: AppState): Diagnostic {
  let idx = lastFail?.idx ?? failCount.indexOf(Math.max(...failCount));
  if (idx < 0) idx = 0;
  const d = demands[idx];
  const lname = state.lecturers.find((l) => l.id === d?.lecturerId)?.name ?? "the lecturer";
  if (!d) return { constraint: "Search", message: "The solver could not find a schedule.", fix: "Relax constraints and try again." };
  const t = lastFail?.tally;
  if (!t) return { constraint: "Search limit", message: `The search ran out of steps while placing ${d.label}.`, fix: "Reduce weekly hours, add rooms/lecturers, or remove locks, then retry." };
  const reasons: [keyof Tally, string, string][] = [
    ["lecturerBusy", `${lname} is already teaching`, `Qualify another lecturer for this subject or reduce ${lname}'s load.`],
    ["lecturerUnavailable", `${lname} is marked unavailable`, `Remove some unavailable slots for ${lname}.`],
    ["lecturerDailyLimit", `${lname} would exceed max hours/day`, `Raise ${lname}'s max hours per day.`],
    ["classBusy", "the class already has a session", "Reduce the class's weekly hours or add periods/days."],
    ["noRoom", `no suitable ${d.isLab ? "lab" : "classroom"} is free`, `Add another ${d.isLab ? "lab room" : "classroom"} with enough capacity.`],
  ];
  const parts = reasons.filter(([k]) => t[k] > 0).sort((a, b) => t[b[0]] - t[a[0]]);
  const top = parts[0];
  return {
    constraint: top ? top[1].replace(lname, "Lecturer") : "Search",
    message: `Could not place ${d.len > 1 ? `a ${d.len}-period block of ` : ""}${d.label} with ${lname}. Of ${t.total} candidate slots: ${parts.map(([k, txt]) => `${t[k]} blocked because ${txt}`).join("; ")}.`,
    fix: parts.slice(0, 2).map((p) => p[2]).join(" ") || "Relax constraints and retry.",
  };
}

/* ---------- validation ---------- */
export function findClashes(state: AppState, sessions: Session[]): Clash[] {
  const out: Clash[] = [];
  const subj = new Map(state.subjects.map((s) => [s.id, s]));
  const rooms = new Map(state.rooms.map((r) => [r.id, r]));
  const lects = new Map(state.lecturers.map((l) => [l.id, l]));
  const classes = new Map(state.classes.map((c) => [c.id, c]));
  const maps = { Lecturer: new Map<string, string[]>(), Class: new Map<string, string[]>(), Room: new Map<string, string[]>() };
  const P = state.settings.periods;
  for (const s of sessions) {
    const sb = subj.get(s.subjectId), r = rooms.get(s.roomId), l = lects.get(s.lecturerId), c = classes.get(s.classId);
    for (const p of sessionPeriods(s)) {
      if (!P[p] || P[p].isBreak) out.push({ kind: "Break", message: `${sb?.code} overlaps a break or runs past the day.`, ids: [s.id] });
      if (l?.unavailable.includes(slotKey(s.day, p))) out.push({ kind: "Unavailable", message: `${l.name} is unavailable for ${sb?.code} on day ${s.day + 1}.`, ids: [s.id] });
      const push = (m: Map<string, string[]>, k: string) => m.set(k, [...(m.get(k) ?? []), s.id]);
      push(maps.Lecturer, `${s.lecturerId}|${s.day}|${p}`); push(maps.Class, `${s.classId}|${s.day}|${p}`); push(maps.Room, `${s.roomId}|${s.day}|${p}`);
    }
    if (sb?.type === "lab" && r?.type !== "lab") out.push({ kind: "Lab room", message: `${sb.code} lab is not in a lab room.`, ids: [s.id] });
    if (sb?.type === "lab" && (s.length < 2 || s.length > 3)) out.push({ kind: "Lab block", message: `${sb.code} lab must be 2-3 consecutive periods.`, ids: [s.id] });
    if (r && c && r.capacity < c.size) out.push({ kind: "Capacity", message: `${r.name} (${r.capacity}) is too small for ${c.name} (${c.size}).`, ids: [s.id] });
  }
  const seen = new Set<string>();
  (Object.keys(maps) as (keyof typeof maps)[]).forEach((kind) => maps[kind].forEach((ids, k) => {
    if (ids.length < 2) return;
    const sig = kind + ids.slice().sort().join();
    if (seen.has(sig)) return; seen.add(sig);
    const id = k.split("|")[0];
    const name = kind === "Lecturer" ? lects.get(id)?.name : kind === "Class" ? classes.get(id)?.name : rooms.get(id)?.name;
    out.push({ kind: `${kind} double-booked`, message: `${name} has ${ids.length} sessions at the same time.`, ids });
  }));
  return out;
}

/** Compare scheduled hours to required weekly hours per class/subject. */
export function hoursReport(state: AppState, sessions: Session[]) {
  const out: { classId: string; subjectId: string; required: number; scheduled: number }[] = [];
  for (const c of state.classes) for (const sid of c.subjectIds) {
    const sb = state.subjects.find((s) => s.id === sid); if (!sb) continue;
    const scheduled = sessions.filter((s) => s.classId === c.id && s.subjectId === sid).reduce((a, s) => a + s.length, 0);
    out.push({ classId: c.id, subjectId: sid, required: sb.weeklyHours, scheduled });
  }
  return out;
}

/** Validate moving a session to (day, period); finds an alternative room if needed. */
export function checkMove(state: AppState, sessions: Session[], id: string, day: number, period: number) {
  const s = sessions.find((x) => x.id === id);
  const reasons: string[] = [];
  if (!s) return { ok: false, reasons: ["Session not found"], roomId: "" };
  if (s.locked) reasons.push("Session is locked");
  if (!blockStarts(state.settings, s.length).includes(period)) reasons.push("Would overlap a break or run past the day");
  const ps = Array.from({ length: s.length }, (_, k) => period + k);
  const others = sessions.filter((x) => x.id !== id && x.day === day);
  const overlaps = (x: Session) => sessionPeriods(x).some((p) => ps.includes(p));
  if (others.some((x) => x.classId === s.classId && overlaps(x))) reasons.push("Class already has a session then");
  if (others.some((x) => x.lecturerId === s.lecturerId && overlaps(x))) reasons.push("Lecturer is teaching elsewhere");
  const L = state.lecturers.find((l) => l.id === s.lecturerId);
  if (L && ps.some((p) => L.unavailable.includes(slotKey(day, p)))) reasons.push(`${L.name} is unavailable`);
  if (L && others.filter((x) => x.lecturerId === L.id).reduce((a, x) => a + x.length, 0) + s.length > L.maxPerDay) reasons.push(`${L.name} would exceed max hours/day`);
  let roomId = s.roomId;
  if (others.some((x) => x.roomId === roomId && overlaps(x))) {
    const sb = state.subjects.find((x) => x.id === s.subjectId), c = state.classes.find((x) => x.id === s.classId);
    const alt = state.rooms.filter((r) => r.type === (sb?.type === "lab" ? "lab" : "classroom") && r.capacity >= (c?.size ?? 0))
      .find((r) => !others.some((x) => x.roomId === r.id && overlaps(x)));
    if (alt) roomId = alt.id; else reasons.push("No suitable room is free");
  }
  return { ok: reasons.length === 0, reasons, roomId };
}
