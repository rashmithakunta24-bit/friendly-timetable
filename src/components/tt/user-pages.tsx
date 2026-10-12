/** Student view, lecturer "My Schedule", and onboarding wizard. */
import { useEffect, useState } from "react";
import { Bell, CalendarDays, Printer, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, PageHeader, SlotPicker, Stat } from "./common";
import { EntityManager } from "./EntityManager";
import { useEntityConfigs } from "./entities";
import { GeneratePanel } from "./admin-pages";
import { TimetableGrid, hueFor } from "./TimetableGrid";
import { useStore } from "@/lib/tt/store";
import { download, printTimetable, sessionsICS } from "@/lib/tt/export";
import { teachingIndexes } from "@/lib/tt/solver";
import { sampleData } from "@/lib/tt/sample";
import { DAY_NAMES, uid, type AppState, type Session } from "@/lib/tt/types";
import { cn } from "@/lib/utils";

const mins = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}
function nowNext(state: AppState, sessions: Session[], now: Date) {
  const today = now.getDay() - 1, m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const P = state.settings.periods;
  const t = (s: Session) => ({ start: mins(P[s.period].start), end: mins(P[s.period + s.length - 1].end) });
  const todays = sessions.filter((s) => s.day === today).sort((a, b) => a.period - b.period);
  const cur = todays.find((s) => t(s).start <= m && m < t(s).end);
  let next = todays.find((s) => t(s).start > m), wait = next ? (t(next).start - m) * 60 : 0;
  if (!next) for (let k = 1; k <= 7 && !next; k++) {
    const d = (today + k + 7) % 7; const list = sessions.filter((s) => s.day === d).sort((a, b) => a.period - b.period);
    if (list[0]) { next = list[0]; wait = ((k * 1440) + t(list[0]).start - m) * 60; }
  }
  return { today: today >= 0 && today < state.settings.days ? today : -1, cur, next, wait, curLeft: cur ? (t(cur).end - m) * 60 : 0 };
}
const fmt = (sec: number) => { sec = Math.max(0, Math.floor(sec)); const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return `${d ? d + "d " : ""}${h ? h + "h " : ""}${m}m ${String(s).padStart(2, "0")}s`; };

function Notices({ state, classId }: { state: AppState; classId?: string }) {
  const list = state.notices.filter((n) => !n.classId || n.classId === classId).slice(0, 3);
  if (!list.length) return null;
  return (
    <div className="mb-4 grid gap-2" role="status">
      {list.map((n) => (
        <div key={n.id} className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/15 p-3 text-sm">
          <Bell className="mt-0.5 h-4 w-4 shrink-0" /><div>{n.text}<div className="text-xs text-muted-foreground">{new Date(n.ts).toLocaleString()}</div></div>
        </div>
      ))}
    </div>
  );
}

export function StudentView() {
  const { state, update } = useStore();
  const now = useNow();
  const classId = state.auth?.classId ?? state.classes[0]?.id;
  const [day, setDay] = useState("all"); const [subj, setSubj] = useState("all");
  const cls = state.classes.find((c) => c.id === classId);
  const all = (state.published?.sessions ?? []).filter((s) => s.classId === classId);
  const shown = all.filter((s) => subj === "all" || s.subjectId === subj);
  const nn = nowNext(state, all, now);
  const P = state.settings.periods;
  const label = (s?: Session) => { if (!s) return null; const sb = state.subjects.find((x) => x.id === s.subjectId); return `${sb?.code} ${sb?.name} · ${state.rooms.find((r) => r.id === s.roomId)?.name} · ${state.lecturers.find((l) => l.id === s.lecturerId)?.name}`; };
  return (
    <>
      <PageHeader title={`My timetable${cls ? ` — ${cls.name}` : ""}`} text={state.settings.institution}>
        <Button variant="outline" size="sm" onClick={() => printTimetable(`Timetable ${cls?.name}`)}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
        <Button variant="outline" size="sm" disabled={!all.length} onClick={() => download(`${cls?.name}.ics`, sessionsICS(state, all, `${cls?.name} timetable`), "text/calendar")}><CalendarDays className="mr-1 h-4 w-4" />Add to calendar</Button>
      </PageHeader>
      <Notices state={state} classId={classId} />
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Select value={classId} onValueChange={(v) => update((s) => ({ ...s, auth: { ...s.auth!, classId: v } }))}>
          <SelectTrigger className="w-40" aria-label="Class"><SelectValue /></SelectTrigger>
          <SelectContent>{state.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={day} onValueChange={setDay}><SelectTrigger className="w-40" aria-label="Day filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All days</SelectItem>{Array.from({ length: state.settings.days }, (_, i) => <SelectItem key={i} value={String(i)}>{DAY_NAMES[i]}</SelectItem>)}</SelectContent></Select>
        <Select value={subj} onValueChange={setSubj}><SelectTrigger className="w-52" aria-label="Subject filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All subjects</SelectItem>{cls?.subjectIds.map((id) => <SelectItem key={id} value={id}>{state.subjects.find((x) => x.id === id)?.name}</SelectItem>)}</SelectContent></Select>
      </div>
      {!all.length ? <Empty icon={<CalendarDays className="h-6 w-6" />} title="Timetable not published yet" text="Your timetable will appear here once your lecturers publish it." /> : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 print:hidden">
            <div className="rounded-xl border bg-primary p-4 text-primary-foreground">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Now</div>
              <div className="mt-1 font-display text-lg font-bold">{nn.cur ? label(nn.cur) : "No class right now"}</div>
              {nn.cur && <div className="text-sm opacity-90">Ends in {fmt(nn.curLeft)}</div>}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next</div>
              <div className="mt-1 font-display text-lg font-bold">{label(nn.next) ?? "Nothing scheduled"}</div>
              {nn.next && <div className="text-sm text-muted-foreground">{DAY_NAMES[nn.next.day]} {P[nn.next.period].start} · starts in <strong className="text-foreground">{fmt(nn.wait)}</strong></div>}
            </div>
          </div>
          <div className="hidden md:block print:block">
            <TimetableGrid state={state} sessions={shown} mode="class" todayIdx={nn.today} nowId={nn.cur?.id} nextId={nn.next?.id} dayFilter={day === "all" ? null : Number(day)} />
          </div>
          <div className="grid gap-4 md:hidden print:hidden">
            {Array.from({ length: state.settings.days }, (_, d) => d).filter((d) => day === "all" || Number(day) === d).map((d) => {
              const list = shown.filter((s) => s.day === d).sort((a, b) => a.period - b.period);
              return (
                <section key={d} className={cn("rounded-xl border bg-card p-3", d === nn.today && "border-primary")}>
                  <h2 className="mb-2 font-display font-semibold">{DAY_NAMES[d]}{d === nn.today && <Badge className="ml-2">Today</Badge>}</h2>
                  {!list.length && <p className="text-sm text-muted-foreground">No classes</p>}
                  <div className="grid gap-2">{list.map((s) => {
                    const sb = state.subjects.find((x) => x.id === s.subjectId);
                    return (
                      <div key={s.id} style={{ ["--h" as string]: hueFor(s.subjectId) }} className={cn("tt-chip rounded-md border-l-4 p-2 text-sm", s.id === nn.cur?.id && "ring-2 ring-primary")}>
                        <div className="flex justify-between font-semibold"><span>{sb?.name}</span><span className="text-xs">{P[s.period].start}–{P[s.period + s.length - 1].end}</span></div>
                        <div className="text-xs">{state.lecturers.find((l) => l.id === s.lecturerId)?.name} · {state.rooms.find((r) => r.id === s.roomId)?.name}</div>
                      </div>
                    );
                  })}</div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export function MySchedule() {
  const { state, update } = useStore();
  const me = state.lecturers.find((l) => l.id === state.auth?.lecturerId);
  const [slots, setSlots] = useState<string[]>(me?.unavailable ?? []);
  const [note, setNote] = useState("");
  const now = useNow();
  if (!me) return <Empty icon={<CalendarDays className="h-6 w-6" />} title="Lecturer not found" text="Sign out and pick your name again." />;
  const source = state.published?.sessions ?? state.sessions;
  const mine = source.filter((s) => s.lecturerId === me.id);
  const hrs = mine.reduce((a, s) => a + s.length, 0);
  const free = teachingIndexes(state.settings).length * state.settings.days - hrs;
  const nn = nowNext(state, mine, now);
  const send = () => {
    if (note.length > 300) return toast.error("Keep the note under 300 characters");
    update((s) => ({ ...s, requests: [{ id: uid(), lecturerId: me.id, slots, note: note.trim(), status: "pending", ts: Date.now() }, ...s.requests] }));
    setNote(""); toast.success("Request sent to admin");
  };
  return (
    <>
      <PageHeader title="My schedule" text={me.name}>
        <Button variant="outline" size="sm" onClick={() => printTimetable(`Schedule ${me.name}`)}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
        <Button variant="outline" size="sm" disabled={!mine.length} onClick={() => download("my-schedule.ics", sessionsICS(state, mine, me.name), "text/calendar")}><CalendarDays className="mr-1 h-4 w-4" />iCal</Button>
      </PageHeader>
      <Notices state={state} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Weekly workload" value={`${hrs}h`} hint={`Max ${me.maxPerWeek}h`} />
        <Stat label="Free periods" value={free} hint="per week" />
        <Stat label="Sessions" value={mine.length} />
        <Stat label="Status" value={state.published ? "Published" : "Draft"} />
      </div>
      {mine.length ? <TimetableGrid state={state} sessions={mine} mode="lecturer" todayIdx={nn.today} nowId={nn.cur?.id} nextId={nn.next?.id} />
        : <Empty icon={<CalendarDays className="h-6 w-6" />} title="No classes assigned" text="Your sessions appear here once a timetable is generated." />}
      <section className="mt-6 rounded-xl border bg-card p-5 print:hidden">
        <h2 className="font-display text-lg font-semibold">Request unavailable slots</h2>
        <p className="mb-3 text-sm text-muted-foreground">Mark when you can't teach; the admin approves before the next generation.</p>
        <SlotPicker settings={state.settings} value={slots} onChange={setSlots} />
        <Textarea className="mt-3" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" aria-label="Reason" />
        <Button className="mt-3" onClick={send}><Send className="mr-1 h-4 w-4" />Send request</Button>
        <div className="mt-3 grid gap-1 text-sm">{state.requests.filter((r) => r.lecturerId === me.id).map((r) => <div key={r.id}>{new Date(r.ts).toLocaleDateString()} · {r.slots.length} slots · <Badge variant="outline">{r.status}</Badge></div>)}</div>
      </section>
    </>
  );
}

export function Wizard({ go }: { go: (v: string) => void }) {
  const { state, update } = useStore();
  const cfgs = useEntityConfigs();
  const steps = [["rooms", "Rooms"], ["lecturers", "Lecturers"], ["subjects", "Subjects"], ["classes", "Classes"], ["generate", "Generate"]] as const;
  const [i, setI] = useState(0);
  const [key] = steps[i];
  return (
    <>
      <PageHeader title="Setup wizard" text="Five quick steps to your first clash-free timetable.">
        <Button variant="outline" onClick={() => { update((s) => sampleData(s)); toast.success("Sample data loaded"); setI(4); }}><Sparkles className="mr-1 h-4 w-4" />Load sample data</Button>
      </PageHeader>
      <ol className="mb-6 grid grid-cols-5 gap-2">
        {steps.map(([k, l], j) => (
          <li key={k}><button onClick={() => setI(j)} className={cn("w-full rounded-lg border p-2 text-left text-xs sm:text-sm", j === i ? "border-primary bg-primary text-primary-foreground" : j < i ? "bg-secondary" : "bg-card")} aria-current={j === i ? "step" : undefined}>
            <span className="block font-display font-bold">{j + 1}</span><span className="hidden sm:inline">{l}</span>
          </button></li>
        ))}
      </ol>
      {key === "generate" ? <GeneratePanel onDone={() => { update((s) => ({ ...s, onboardingDone: true })); go("timetable"); }} /> : <EntityManager cfg={cfgs[key]} />}
      <div className="mt-6 flex justify-between">
        <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        {i < 4 && <Button onClick={() => setI(i + 1)} disabled={!(state[key as "rooms"] as unknown[]).length}>Next: {steps[i + 1][1]}</Button>}
      </div>
    </>
  );
}
