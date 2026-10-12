/** Admin pages: dashboard, setup, schedule settings, generator, timetable editor, substitutes, requests, data. */
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Download, FileJson, Lock, Megaphone, Plus, Printer, RefreshCw, Send, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Bar, Confirm, Empty, PageHeader, Stat } from "./common";
import { EntityManager } from "./EntityManager";
import { useEntityConfigs, type EntityKind } from "./entities";
import { TimetableGrid } from "./TimetableGrid";
import { useStore } from "@/lib/tt/store";
import { checkMove, findClashes, hoursReport, sessionPeriods, softPenalty, solve, teachingIndexes, type SolveResult } from "@/lib/tt/solver";
import { download, printTimetable, sessionsCSV, sessionsICS } from "@/lib/tt/export";
import { sampleData } from "@/lib/tt/sample";
import { DAY_NAMES, slotKey, uid, type AppState, type Period } from "@/lib/tt/types";

/* ---------- shared actions ---------- */
export function useActions() {
  const { state, update } = useStore();
  const generate = (): SolveResult => {
    const res = solve(state);
    if (res.ok) {
      update((s) => ({ ...s, sessions: res.sessions }));
      toast.success(`Timetable generated: ${res.stats.placed} sessions placed, 0 clashes`);
    } else toast.error("No valid timetable found — see the explanation");
    return res;
  };
  const publish = () => {
    const clashes = findClashes(state, state.sessions);
    if (!state.sessions.length) return toast.error("Generate a timetable first");
    if (clashes.length) return toast.error("Fix clashes before publishing");
    update((s) => ({ ...s, published: { sessions: s.sessions, at: Date.now() }, notices: [{ id: uid(), ts: Date.now(), kind: "info", text: "A new timetable has been published." }, ...s.notices] }));
    toast.success("Timetable published — students can now see it");
  };
  return { generate, publish };
}
const isDirty = (s: AppState) => !!s.published && JSON.stringify(s.published.sessions) !== JSON.stringify(s.sessions);

/* ---------- Dashboard ---------- */
export function Dashboard({ go }: { go: (v: string) => void }) {
  const { state } = useStore();
  const clashes = findClashes(state, state.sessions);
  const teach = teachingIndexes(state.settings).length * state.settings.days;
  const hours = hoursReport(state, state.sessions).filter((h) => h.scheduled !== h.required);
  const soft = softPenalty(state, state.sessions);
  const roomUse = state.rooms.map((r) => ({ r, used: state.sessions.filter((s) => s.roomId === r.id).reduce((a, s) => a + s.length, 0) }));
  const totalUse = teach && state.rooms.length ? Math.round((roomUse.reduce((a, x) => a + x.used, 0) / (teach * state.rooms.length)) * 100) : 0;
  if (!state.classes.length) return (
    <>
      <PageHeader title="Dashboard" />
      <Empty icon={<Sparkles className="h-6 w-6" />} title="Let's set up your institution" text="Use the guided wizard, or load sample data to explore every feature.">
        <Button onClick={() => go("wizard")}>Start setup wizard</Button>
      </Empty>
    </>
  );
  return (
    <>
      <PageHeader title="Dashboard" text={state.settings.institution}>
        <Button variant="outline" onClick={() => go("generate")}><Wand2 className="mr-1 h-4 w-4" />Generate</Button>
        <Button onClick={() => go("timetable")}><CalendarDays className="mr-1 h-4 w-4" />Open timetable</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clashes" value={clashes.length} tone={clashes.length ? "bad" : "good"} hint={clashes.length ? "Must be fixed" : "Clash-free"} />
        <Stat label="Room utilization" value={`${totalUse}%`} hint={`${state.rooms.length} rooms`} />
        <Stat label="Sessions" value={state.sessions.length} hint={`${state.classes.length} classes · ${state.lecturers.length} lecturers`} />
        <Stat label="Status" value={state.published ? (isDirty(state) ? "Changed" : "Live") : "Draft"} hint={state.published ? `Published ${new Date(state.published.at).toLocaleString()}` : "Not yet published"} />
      </div>
      {(hours.length > 0 || clashes.length > 0) && state.sessions.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" />Attention</div>
          <ul className="list-disc pl-5">
            {clashes.slice(0, 5).map((c, i) => <li key={i}>{c.kind}: {c.message}</li>)}
            {hours.slice(0, 5).map((h, i) => <li key={"h" + i}>{state.classes.find((c) => c.id === h.classId)?.name} · {state.subjects.find((x) => x.id === h.subjectId)?.code}: {h.scheduled}/{h.required} hours scheduled</li>)}
          </ul>
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Room utilization</h2>
          <div className="grid gap-3">{roomUse.map(({ r, used }) => <Bar key={r.id} label={`${r.name} (${r.type})`} value={used} max={teach} />)}</div>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Lecturer workload (hours/week)</h2>
          <div className="grid gap-3">{state.lecturers.map((l) => <Bar key={l.id} label={l.name} value={state.sessions.filter((s) => s.lecturerId === l.id).reduce((a, s) => a + s.length, 0)} max={l.maxPerWeek} />)}</div>
        </section>
      </div>
      {state.sessions.length > 0 && (
        <section className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Quality (soft constraints)</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {[["Same subject twice/day", soft.sameDay], ["Gaps in class days", soft.gaps], ["Heavy subjects after midday", soft.afternoonHeavy], ["Labs in last period", soft.labLast], ["Long lecturer runs", soft.longRuns]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-muted p-3"><div className="text-muted-foreground">{l}</div><div className="font-display text-xl font-bold">{v}</div></div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ---------- Setup ---------- */
export function Setup() {
  const cfgs = useEntityConfigs();
  const tabs: EntityKind[] = ["departments", "subjects", "classes", "lecturers", "rooms"];
  return (
    <>
      <PageHeader title="Setup" text="Manage everything the generator needs." />
      <Tabs defaultValue="subjects">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {tabs.map((t) => <TabsTrigger key={t} value={t}>{cfgs[t].title} <Badge variant="secondary" className="ml-1.5">{cfgs[t].items.length}</Badge></TabsTrigger>)}
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>
        {tabs.map((t) => <TabsContent key={t} value={t}><EntityManager cfg={cfgs[t]} /></TabsContent>)}
        <TabsContent value="schedule"><ScheduleSettings /></TabsContent>
      </Tabs>
    </>
  );
}

export function ScheduleSettings() {
  const { state, update } = useStore();
  const [inst, setInst] = useState(state.settings.institution);
  const [days, setDays] = useState<5 | 6>(state.settings.days);
  const [periods, setPeriods] = useState<Period[]>(state.settings.periods);
  const [err, setErr] = useState<string | null>(null);
  const setP = (i: number, patch: Partial<Period>) => setPeriods((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const save = () => {
    if (!inst.trim()) return setErr("Institution name is required");
    if (!periods.some((p) => !p.isBreak)) return setErr("Add at least one teaching period");
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (!p.label.trim()) return setErr(`Row ${i + 1}: label is required`);
      if (!p.start || !p.end || p.start >= p.end) return setErr(`${p.label}: end time must be after start time`);
      if (i > 0 && periods[i - 1].end > p.start) return setErr(`${p.label} starts before the previous slot ends`);
    }
    setErr(null);
    const structural = days !== state.settings.days || JSON.stringify(periods.map((p) => p.isBreak)) !== JSON.stringify(state.settings.periods.map((p) => p.isBreak));
    update((s) => ({ ...s, settings: { institution: inst.trim().slice(0, 100), days, periods }, sessions: structural ? [] : s.sessions }));
    toast.success(structural ? "Schedule saved — timetable cleared, please regenerate" : "Schedule saved");
  };
  return (
    <div className="grid max-w-3xl gap-5 rounded-xl border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="inst">Institution</Label><Input id="inst" value={inst} maxLength={100} onChange={(e) => setInst(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label>Working days</Label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as 5 | 6)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="5">Monday – Friday</SelectItem><SelectItem value="6">Monday – Saturday</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Periods, breaks and lunch</Label>
        <div className="mt-2 grid gap-2">
          {periods.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-2">
              <Input aria-label="Label" value={p.label} onChange={(e) => setP(i, { label: e.target.value })} />
              <Input aria-label="Start" type="time" value={p.start} onChange={(e) => setP(i, { start: e.target.value })} />
              <Input aria-label="End" type="time" value={p.end} onChange={(e) => setP(i, { end: e.target.value })} />
              <label className="flex items-center gap-1 text-xs"><Switch checked={p.isBreak} onCheckedChange={(v) => setP(i, { isBreak: v })} />Break</label>
              <Button variant="ghost" size="icon" aria-label="Remove row" onClick={() => setPeriods((ps) => ps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => {
          const last = periods[periods.length - 1];
          setPeriods([...periods, { label: `P${periods.filter((p) => !p.isBreak).length + 1}`, start: last?.end ?? "09:00", end: last?.end ?? "09:50", isBreak: false }]);
        }}><Plus className="mr-1 h-4 w-4" />Add row</Button>
      </div>
      {err && <p className="text-sm font-medium text-destructive">{err}</p>}
      <p className="text-xs text-muted-foreground">Changing days or break positions clears the current timetable.</p>
      <div><Button onClick={save}>Save schedule</Button></div>
    </div>
  );
}

/* ---------- Generator ---------- */
export function GeneratePanel({ onDone }: { onDone?: () => void }) {
  const { state } = useStore();
  const { generate } = useActions();
  const [res, setRes] = useState<SolveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const lockedCount = state.sessions.filter((s) => s.locked).length;
  const run = () => { setBusy(true); setTimeout(() => { setRes(generate()); setBusy(false); }, 30); };
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <div><span className="text-muted-foreground">Classes</span><div className="font-display text-xl font-bold">{state.classes.length}</div></div>
          <div><span className="text-muted-foreground">Lecturers</span><div className="font-display text-xl font-bold">{state.lecturers.length}</div></div>
          <div><span className="text-muted-foreground">Rooms</span><div className="font-display text-xl font-bold">{state.rooms.length}</div></div>
          <div><span className="text-muted-foreground">Locked sessions kept</span><div className="font-display text-xl font-bold">{lockedCount}</div></div>
        </div>
        <Button size="lg" className="mt-5 w-full sm:w-auto" onClick={run} disabled={busy}>
          {busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}Generate Timetable
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Uses backtracking search with soft-constraint scoring and randomized restarts. Locked sessions stay in place.</p>
      </div>
      {res?.ok && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-5">
          <div className="flex items-center gap-2 font-display text-lg font-semibold"><CheckCircle2 className="h-5 w-5 text-success" />Clash-free timetable created</div>
          <p className="mt-1 text-sm">{res.stats.placed} sessions placed in {res.stats.ms} ms ({res.stats.steps} search steps, attempt {res.stats.attempts}). Hard-constraint clashes: <strong>{findClashes(state, res.sessions).length}</strong>. Soft penalty: {res.stats.penalty}.</p>
          {onDone && <Button className="mt-3" onClick={onDone}>View timetable</Button>}
        </div>
      )}
      {res && !res.ok && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5">
          <div className="flex items-center gap-2 font-display text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-destructive" />No valid schedule exists yet</div>
          <ul className="mt-3 grid gap-3">
            {res.errors.map((e, i) => (
              <li key={i} className="rounded-lg bg-card p-3 text-sm">
                <Badge variant="destructive">{e.constraint}</Badge>
                <p className="mt-2">{e.message}</p>
                <p className="mt-1 text-muted-foreground"><strong className="text-foreground">Suggested fix:</strong> {e.fix}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
export function Generate({ go }: { go: (v: string) => void }) {
  return (<><PageHeader title="Generate timetable" text="All hard constraints are guaranteed; soft constraints are optimised." /><GeneratePanel onDone={() => go("timetable")} /></>);
}

/* ---------- Timetable editor ---------- */
export function TimetableEditor() {
  const { state, update } = useStore();
  const { generate, publish } = useActions();
  const [mode, setMode] = useState<"class" | "lecturer" | "room">("class");
  const lists = { class: state.classes, lecturer: state.lecturers, room: state.rooms };
  const [ent, setEnt] = useState<string>(state.classes[0]?.id ?? "");
  const entityId = lists[mode].some((x) => x.id === ent) ? ent : lists[mode][0]?.id ?? "";
  const field = mode === "class" ? "classId" : mode === "lecturer" ? "lecturerId" : "roomId";
  const shown = state.sessions.filter((s) => s[field] === entityId);
  const clashes = useMemo(() => findClashes(state, state.sessions), [state]);
  const clashIds = new Set(clashes.flatMap((c) => c.ids));
  const entName = lists[mode].find((x) => x.id === entityId)?.name ?? "";

  const onMove = (id: string, day: number, period: number) => {
    const r = checkMove(state, state.sessions, id, day, period);
    if (!r.ok) return toast.error(`Move blocked: ${r.reasons.join("; ")}`);
    const s = state.sessions.find((x) => x.id === id)!;
    update((st) => ({ ...st, sessions: st.sessions.map((x) => (x.id === id ? { ...x, day, period, roomId: r.roomId } : x)) }));
    const sb = state.subjects.find((x) => x.id === s.subjectId);
    toast.success(`${sb?.code} moved to ${DAY_NAMES[day]} ${state.settings.periods[period].label}${r.roomId !== s.roomId ? ` (room changed to ${state.rooms.find((x) => x.id === r.roomId)?.name})` : ""}`);
  };
  if (!state.classes.length) return (<><PageHeader title="Timetable" /><Empty icon={<CalendarDays className="h-6 w-6" />} title="Nothing to show yet" text="Add classes, subjects, lecturers and rooms in Setup, then generate." /></>);
  return (
    <>
      <PageHeader title="Timetable" text={state.published ? (isDirty(state) ? "You have unpublished changes." : "Published and visible to students.") : "Draft — not visible to students yet."}>
        <Button variant="outline" onClick={generate}><Wand2 className="mr-1 h-4 w-4" />Regenerate</Button>
        <Button onClick={publish}><Send className="mr-1 h-4 w-4" />Publish</Button>
      </PageHeader>
      <div className="mb-4 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList><TabsTrigger value="class">By class</TabsTrigger><TabsTrigger value="lecturer">By lecturer</TabsTrigger><TabsTrigger value="room">By room</TabsTrigger></TabsList>
          </Tabs>
          <Select value={entityId} onValueChange={setEnt}>
            <SelectTrigger className="w-52" aria-label="Choose"><SelectValue /></SelectTrigger>
            <SelectContent>{lists[mode].map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => printTimetable(`Timetable - ${entName}`)}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
          <Button variant="outline" size="sm" onClick={() => download(`timetable-${entName}.csv`, sessionsCSV(state, shown), "text/csv")}><Download className="mr-1 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => download(`timetable-${entName}.ics`, sessionsICS(state, shown, entName), "text/calendar")}><CalendarDays className="mr-1 h-4 w-4" />iCal</Button>
          <Button variant="outline" size="sm" onClick={() => download("timetable-all.csv", sessionsCSV(state, state.sessions), "text/csv")}>All CSV</Button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={clashes.length ? "destructive" : "secondary"}>{clashes.length ? `${clashes.length} clashes` : "0 clashes"}</Badge>
        <span className="flex items-center gap-1 text-muted-foreground print:hidden"><Lock className="h-3.5 w-3.5" />Lock sessions to keep them when regenerating. Drag or tap a session to move it.</span>
      </div>
      <h2 className="mb-2 hidden font-display text-xl font-bold print:block">{state.settings.institution} — {entName}</h2>
      {state.sessions.length === 0 ? (
        <Empty icon={<Wand2 className="h-6 w-6" />} title="No timetable generated" text="Press Regenerate to build a clash-free schedule." />
      ) : (
        <TimetableGrid state={state} sessions={shown} mode={mode} editable clashIds={clashIds}
          canMove={(id, d, p) => checkMove(state, state.sessions, id, d, p).ok} onMove={onMove}
          onToggleLock={(id) => update((s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === id ? { ...x, locked: !x.locked } : x)) }))} />
      )}
    </>
  );
}

/* ---------- Substitute lecturer ---------- */
export function Substitute() {
  const { state, update } = useStore();
  const [absent, setAbsent] = useState(state.lecturers[0]?.id ?? "");
  const [day, setDay] = useState(String(Math.max(0, Math.min(state.settings.days - 1, new Date().getDay() - 1))));
  const d = Number(day);
  const list = state.sessions.filter((s) => s.lecturerId === absent && s.day === d).sort((a, b) => a.period - b.period);
  const suggest = (sid: string) => {
    const s = state.sessions.find((x) => x.id === sid)!;
    const ps = sessionPeriods(s);
    return state.lecturers.filter((l) => l.id !== absent && l.subjectIds.includes(s.subjectId))
      .filter((l) => !ps.some((p) => l.unavailable.includes(slotKey(d, p))))
      .filter((l) => !state.sessions.some((x) => x.lecturerId === l.id && x.day === d && sessionPeriods(x).some((p) => ps.includes(p))))
      .filter((l) => state.sessions.filter((x) => x.lecturerId === l.id && x.day === d).reduce((a, x) => a + x.length, 0) + s.length <= l.maxPerDay);
  };
  const assign = (sid: string, lid: string) => {
    const s = state.sessions.find((x) => x.id === sid)!;
    const from = state.lecturers.find((l) => l.id === absent)?.name, to = state.lecturers.find((l) => l.id === lid)?.name;
    const sb = state.subjects.find((x) => x.id === s.subjectId);
    const text = `Substitution: ${sb?.code} ${sb?.name} on ${DAY_NAMES[d]} ${state.settings.periods[s.period].label} — ${to} replaces ${from}.`;
    update((st) => ({
      ...st, sessions: st.sessions.map((x) => (x.id === sid ? { ...x, lecturerId: lid } : x)),
      published: st.published ? { ...st.published, sessions: st.published.sessions.map((x) => (x.id === sid ? { ...x, lecturerId: lid } : x)) } : null,
      notices: [{ id: uid(), ts: Date.now(), kind: "substitution", text, classId: s.classId }, ...st.notices],
    }));
    toast.success(`${to} assigned — students notified`);
  };
  return (
    <>
      <PageHeader title="Substitute lecturer" text="Find free, qualified lecturers when someone is absent." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={absent} onValueChange={setAbsent}><SelectTrigger className="w-60" aria-label="Absent lecturer"><SelectValue placeholder="Absent lecturer" /></SelectTrigger>
          <SelectContent>{state.lecturers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
        <Select value={day} onValueChange={setDay}><SelectTrigger className="w-44" aria-label="Day"><SelectValue /></SelectTrigger>
          <SelectContent>{Array.from({ length: state.settings.days }, (_, i) => <SelectItem key={i} value={String(i)}>{DAY_NAMES[i]}</SelectItem>)}</SelectContent></Select>
      </div>
      {!list.length ? <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="No classes to cover" text="This lecturer has no sessions on the selected day." /> : (
        <div className="grid gap-3">
          {list.map((s) => {
            const sb = state.subjects.find((x) => x.id === s.subjectId), opts = suggest(s.id);
            return (
              <div key={s.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-display font-semibold">{sb?.code} {sb?.name} · {state.classes.find((c) => c.id === s.classId)?.name}</div>
                  <div className="text-sm text-muted-foreground">{state.settings.periods[s.period].start}–{state.settings.periods[s.period + s.length - 1].end} · {state.rooms.find((r) => r.id === s.roomId)?.name}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {opts.length ? opts.map((l) => <Button key={l.id} size="sm" variant="outline" onClick={() => assign(s.id, l.id)}>Assign {l.name}</Button>)
                    : <span className="text-sm text-destructive">No free qualified lecturer. Qualify another lecturer for {sb?.code} or reschedule.</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------- Requests & notices ---------- */
export function Requests() {
  const { state, update } = useStore();
  const [text, setText] = useState("");
  const [cls, setCls] = useState("all");
  const decide = (id: string, ok: boolean) => update((s) => {
    const r = s.requests.find((x) => x.id === id)!;
    const name = s.lecturers.find((l) => l.id === r.lecturerId)?.name;
    return {
      ...s, requests: s.requests.map((x) => (x.id === id ? { ...x, status: ok ? "approved" : "rejected" } : x)),
      lecturers: ok ? s.lecturers.map((l) => (l.id === r.lecturerId ? { ...l, unavailable: r.slots } : l)) : s.lecturers,
      notices: [{ id: uid(), ts: Date.now(), kind: "change", text: `Availability request from ${name} was ${ok ? "approved" : "rejected"}.` }, ...s.notices],
    };
  });
  const post = () => {
    const t = text.trim();
    if (!t) return toast.error("Write a message first");
    if (t.length > 300) return toast.error("Keep notices under 300 characters");
    update((s) => ({ ...s, notices: [{ id: uid(), ts: Date.now(), kind: "change", text: t, classId: cls === "all" ? undefined : cls }, ...s.notices] }));
    setText(""); toast.success("Notice posted");
  };
  const pending = state.requests.filter((r) => r.status === "pending");
  return (
    <>
      <PageHeader title="Requests & notices" text="Approve lecturer availability changes and notify students." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Availability requests</h2>
          {!state.requests.length ? <Empty icon={<Send className="h-6 w-6" />} title="No requests" text="Lecturers can request unavailable slots from My Schedule." /> : (
            <div className="grid gap-3">
              {[...pending, ...state.requests.filter((r) => r.status !== "pending")].map((r) => (
                <div key={r.id} className="rounded-xl border bg-card p-4 text-sm">
                  <div className="flex justify-between gap-2"><strong>{state.lecturers.find((l) => l.id === r.lecturerId)?.name}</strong><Badge variant={r.status === "pending" ? "default" : "secondary"}>{r.status}</Badge></div>
                  <p className="mt-1 text-muted-foreground">{r.slots.length} unavailable slots requested{r.note && ` — “${r.note}”`}</p>
                  {r.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => decide(r.id, true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Reject</Button></div>}
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Post a notice</h2>
          <div className="grid gap-2 rounded-xl border bg-card p-4">
            <Select value={cls} onValueChange={setCls}><SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All classes</SelectItem>{state.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            <Textarea value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="e.g. DS lab moved to CS Lab 2 this week" aria-label="Notice text" />
            <Button onClick={post}><Megaphone className="mr-1 h-4 w-4" />Post notice</Button>
          </div>
          <div className="mt-4 grid gap-2">
            {state.notices.slice(0, 15).map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
                <div><Badge variant="outline" className="mr-2">{n.kind}</Badge>{n.text}<div className="mt-1 text-xs text-muted-foreground">{new Date(n.ts).toLocaleString()} · {n.classId ? state.classes.find((c) => c.id === n.classId)?.name : "All"}</div></div>
                <Button variant="ghost" size="icon" aria-label="Delete notice" onClick={() => update((s) => ({ ...s, notices: s.notices.filter((x) => x.id !== n.id) }))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

/* ---------- Data ---------- */
export function DataPage() {
  const { state, update } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const importJSON = async (f: File) => {
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.subjects) || !Array.isArray(d.classes) || !d.settings) throw new Error();
      update((s) => ({ ...s, ...d, auth: s.auth }));
      toast.success("Data imported");
    } catch { toast.error("That file isn't a valid ClashFree export"); }
  };
  return (
    <>
      <PageHeader title="Data" text="Everything is stored in this browser. Back it up or move it with JSON." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Sample data</h2>
          <p className="mt-1 text-sm text-muted-foreground">2 departments, 3 sections, 10 lecturers, 7 rooms — perfect for a demo.</p>
          <Confirm title="Load sample data?" description="This replaces all current data and timetables." action="Load sample" onConfirm={() => { update((s) => sampleData(s)); toast.success("Sample data loaded"); }}
            trigger={<Button className="mt-4"><Sparkles className="mr-1 h-4 w-4" />Load sample data</Button>} />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">JSON backup</h2>
          <p className="mt-1 text-sm text-muted-foreground">Export or restore the full dataset including timetables.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => download("clashfree-backup.json", JSON.stringify({ ...state, auth: null }, null, 2), "application/json")}><FileJson className="mr-1 h-4 w-4" />Export JSON</Button>
            <input ref={ref} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }} />
            <Button variant="outline" onClick={() => ref.current?.click()}><Upload className="mr-1 h-4 w-4" />Import JSON</Button>
          </div>
        </div>
        <div className="rounded-xl border border-destructive/40 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Reset</h2>
          <p className="mt-1 text-sm text-muted-foreground">Delete all data from this browser.</p>
          <Confirm title="Erase everything?" description="All departments, subjects, classes, lecturers, rooms and timetables will be deleted." action="Erase all"
            onConfirm={() => { update((s) => ({ ...sampleData(s), departments: [], subjects: [], classes: [], lecturers: [], rooms: [], onboardingDone: false })); toast.success("All data erased"); }}
            trigger={<Button variant="destructive" className="mt-4"><Trash2 className="mr-1 h-4 w-4" />Erase all data</Button>} />
        </div>
      </div>
    </>
  );
}
